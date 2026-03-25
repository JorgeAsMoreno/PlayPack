import asyncio
import io
import json
import logging
import os
import re
import sys
import uuid
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent.parent))
from playpack import (
    DOWNLOADS_DIR,
    Track,
    download_track,
    extract_playlist_id,
    fetch_playlist_tracks,
    get_spotify_client,
)

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("playpack")

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = ThreadPoolExecutor(max_workers=2)
jobs: Dict[str, dict] = {}


class StartRequest(BaseModel):
    url: str


@app.post("/api/start")
async def start_download(body: StartRequest, request: Request):
    job_id = str(uuid.uuid4())
    client_ip = request.client.host if request.client else "unknown"
    log.info("Job %s started | ip=%s url=%s", job_id[:8], client_ip, body.url)

    queue: asyncio.Queue = asyncio.Queue()
    jobs[job_id] = {"queue": queue, "status": "running", "playlist_dir": None}
    loop = asyncio.get_event_loop()
    loop.run_in_executor(executor, _run_download, job_id, body.url, queue, loop)
    return {"job_id": job_id}


@app.get("/api/events/{job_id}")
async def events(job_id: str):
    if job_id not in jobs:
        log.warning("Events requested for unknown job %s", job_id[:8])
        raise HTTPException(404, "Job not found")

    async def generate():
        queue = jobs[job_id]["queue"]
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") in ("complete", "error"):
                    break
            except asyncio.TimeoutError:
                yield "data: {\"type\":\"ping\"}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/download/{job_id}")
async def download_zip(job_id: str):
    job = jobs.get(job_id)
    if not job or not job.get("playlist_dir"):
        log.warning("ZIP requested for unknown/incomplete job %s", job_id[:8])
        raise HTTPException(404, "Job not found or not complete")

    playlist_dir = Path(job["playlist_dir"])
    mp3_files = list(playlist_dir.glob("*.mp3"))
    if not mp3_files:
        log.warning("Job %s — ZIP requested but no MP3s found in %s", job_id[:8], playlist_dir)
        raise HTTPException(404, "No files found")

    log.info("Job %s — serving ZIP with %d files from %s", job_id[:8], len(mp3_files), playlist_dir.name)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for mp3 in mp3_files:
            zf.write(mp3, mp3.name)
    buf.seek(0)

    zip_name = re.sub(r'[\\/*?:"<>|]', "_", playlist_dir.name) + ".zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
    )


def _run_download(job_id: str, url: str, queue: asyncio.Queue, loop):
    def send(event: dict):
        asyncio.run_coroutine_threadsafe(queue.put(event), loop)

    jid = job_id[:8]

    try:
        log.info("Job %s — connecting to Spotify", jid)
        sp = get_spotify_client()
        playlist_id = extract_playlist_id(url)
        playlist_name, tracks = fetch_playlist_tracks(sp, playlist_id)

        log.info("Job %s — playlist '%s' | %d tracks", jid, playlist_name, len(tracks))

        safe_name = re.sub(r'[\\/*?:"<>|]', "_", playlist_name)
        playlist_dir = DOWNLOADS_DIR / safe_name
        playlist_dir.mkdir(parents=True, exist_ok=True)
        jobs[job_id]["playlist_dir"] = str(playlist_dir)

        send({"type": "playlist_info", "name": playlist_name, "total": len(tracks)})

        successful = failed = skipped = 0

        for i, track in enumerate(tracks, 1):
            send({
                "type": "track_start",
                "current": i,
                "total": len(tracks),
                "track": str(track),
            })

            result = download_track(track, playlist_dir)

            if result == "ok":
                successful += 1
            elif result == "skipped":
                skipped += 1
            else:
                failed += 1
                log.warning("Job %s — [%d/%d] FAILED  %s", jid, i, len(tracks), track)

            send({
                "type": "track_done",
                "current": i,
                "total": len(tracks),
                "status": result,
                "successful": successful,
                "failed": failed,
                "skipped": skipped,
                "track": str(track),
            })

        jobs[job_id]["status"] = "complete"
        log.info(
            "Job %s — done | ok=%d failed=%d skipped=%d",
            jid, successful, failed, skipped,
        )
        send({
            "type": "complete",
            "total": len(tracks),
            "successful": successful,
            "failed": failed,
            "skipped": skipped,
        })

    except Exception as e:
        jobs[job_id]["status"] = "error"
        log.error("Job %s — error: %s", jid, e, exc_info=True)
        send({"type": "error", "message": str(e)})


# Serve built frontend in production
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
