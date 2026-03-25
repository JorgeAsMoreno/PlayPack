#!/usr/bin/env python3
"""
Playpack - Descarga canciones de una playlist de Spotify via YouTube
"""

import os
import sys
import re
import time
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import yt_dlp

# ─── Config ──────────────────────────────────────────────────────────────────

SPOTIFY_CLIENT_ID     = os.getenv("SPOTIFY_CLIENT_ID", "ebdcff6c474e4a52b8444cb96868b6b8")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "6bef0d673e8b4577af6c885ccaf4666d")

DOWNLOADS_DIR = Path(__file__).parent / "downloads"
DOWNLOADS_DIR.mkdir(exist_ok=True)

# ─── Data ─────────────────────────────────────────────────────────────────────

@dataclass
class Track:
    name: str
    artist: str
    album: str
    duration_ms: int

    @property
    def search_query(self) -> str:
        return f"{self.artist} - {self.name}"

    @property
    def safe_filename(self) -> str:
        name = f"{self.artist} - {self.name}"
        return re.sub(r'[\\/*?:"<>|]', "_", name)

    def __str__(self) -> str:
        mins = self.duration_ms // 60000
        secs = (self.duration_ms % 60000) // 1000
        return f"{self.artist} - {self.name} ({mins}:{secs:02d})"


@dataclass
class DownloadStats:
    total: int = 0
    successful: int = 0
    failed: int = 0
    skipped: int = 0
    failed_tracks: list = field(default_factory=list)

    def print_progress(self, current: int, track: Track):
        bar_width = 30
        filled = int(bar_width * current / self.total) if self.total else 0
        bar = "█" * filled + "░" * (bar_width - filled)
        pct = int(100 * current / self.total) if self.total else 0
        print(f"\n[{bar}] {pct}% — Canción {current}/{self.total}")
        print(f"  ▶  {track}")
        print(f"  ✓ Exitosas: {self.successful}  ✗ Fallidas: {self.failed}  ⟳ Omitidas: {self.skipped}")

    def print_summary(self):
        print("\n" + "═" * 60)
        print("  RESUMEN FINAL")
        print("═" * 60)
        print(f"  Total canciones   : {self.total}")
        print(f"  ✓ Exitosas        : {self.successful}")
        print(f"  ⟳ Ya existían     : {self.skipped}")
        print(f"  ✗ Fallidas        : {self.failed}")
        if self.failed_tracks:
            print("\n  Canciones que fallaron:")
            for t in self.failed_tracks:
                print(f"    - {t}")
        print("═" * 60)


# ─── Spotify ──────────────────────────────────────────────────────────────────

def get_spotify_client() -> spotipy.Spotify:
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        print("\n[ERROR] Faltan credenciales de Spotify.")
        print("  Configura las variables de entorno:")
        print("    export SPOTIFY_CLIENT_ID='tu_client_id'")
        print("    export SPOTIFY_CLIENT_SECRET='tu_client_secret'")
        print("\n  O crea un .env y ejecútalo con: source .env && python playpack.py <url>")
        print("\n  Obtén tus credenciales en: https://developer.spotify.com/dashboard")
        sys.exit(1)

    auth = SpotifyClientCredentials(
        client_id=SPOTIFY_CLIENT_ID,
        client_secret=SPOTIFY_CLIENT_SECRET,
    )
    return spotipy.Spotify(auth_manager=auth)


def extract_playlist_id(url: str) -> str:
    # Toma el último ID válido (base62, 15-30 chars) para manejar URLs duplicadas
    matches = re.findall(r"playlist/([A-Za-z0-9]{15,30})", url)
    if not matches:
        print(f"[ERROR] URL inválida: {url}")
        sys.exit(1)
    return matches[-1]  # último match = el ID real, no "https" ni duplicados


def fetch_playlist_tracks(sp: spotipy.Spotify, playlist_id: str) -> tuple[str, list[Track]]:
    print(f"\nObteniendo información de la playlist...")
    playlist = sp.playlist(playlist_id, fields="name,tracks.total")
    playlist_name = playlist["name"]
    print(f"  Playlist: {playlist_name}")

    tracks = []
    offset = 0
    limit = 100

    while True:
        results = sp.playlist_tracks(
            playlist_id,
            fields="items(track(name,artists,album.name,duration_ms)),next",
            limit=limit,
            offset=offset,
        )
        items = results.get("items", [])
        if not items:
            break

        for item in items:
            track_data = item.get("track")
            if not track_data or not track_data.get("name"):
                continue
            artists = ", ".join(a["name"] for a in track_data.get("artists", []))
            tracks.append(Track(
                name=track_data["name"],
                artist=artists,
                album=track_data.get("album", {}).get("name", ""),
                duration_ms=track_data.get("duration_ms", 0),
            ))

        if not results.get("next"):
            break
        offset += limit
        time.sleep(0.1)

    print(f"  Canciones encontradas: {len(tracks)}")
    return playlist_name, tracks


# ─── Download ─────────────────────────────────────────────────────────────────

def build_ydl_opts(output_path: Path, filename_template: Optional[str] = None) -> dict:
    outtmpl = filename_template or str(output_path / "%(title)s.%(ext)s")
    opts = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
        "quiet": True,
        "no_warnings": True,
        "ignoreerrors": True,
        "noplaylist": True,
        "socket_timeout": 30,
        "retries": 3,
        "extractor_args": {
            "youtube": {
                "player_client": ["android", "web"],
            }
        },
    }
    return opts


def download_track(track: Track, output_dir: Path) -> str:
    """Returns 'ok', 'skipped', or 'failed'"""
    target_mp3 = output_dir / f"{track.safe_filename}.mp3"
    if target_mp3.exists():
        return "skipped"

    search_url = f"ytsearch1:{track.search_query}"
    outtmpl = str(output_dir / f"{track.safe_filename}.%(ext)s")
    opts = build_ydl_opts(output_dir, filename_template=outtmpl)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([search_url])

        return "ok" if target_mp3.exists() else "failed"
    except Exception:
        return "failed"


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Descarga canciones de una playlist de Spotify via YouTube"
    )
    parser.add_argument("url", help="URL de la playlist de Spotify")
    parser.add_argument(
        "--output", "-o",
        default=str(DOWNLOADS_DIR),
        help=f"Carpeta de destino (default: {DOWNLOADS_DIR})",
    )
    parser.add_argument(
        "--limit", "-l",
        type=int,
        default=0,
        help="Limitar número de canciones a descargar (0 = todas)",
    )
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("  PLAYPACK — Descargador de playlists de Spotify")
    print("=" * 60)

    sp = get_spotify_client()
    playlist_id = extract_playlist_id(args.url)
    playlist_name, tracks = fetch_playlist_tracks(sp, playlist_id)

    if args.limit:
        tracks = tracks[:args.limit]

    # Subcarpeta con nombre de la playlist
    safe_playlist_name = re.sub(r'[\\/*?:"<>|]', "_", playlist_name)
    playlist_dir = output_dir / safe_playlist_name
    playlist_dir.mkdir(exist_ok=True)

    print(f"\n  Descargando en: {playlist_dir}")
    print(f"  Canciones a descargar: {len(tracks)}\n")

    stats = DownloadStats(total=len(tracks))

    for i, track in enumerate(tracks, 1):
        stats.print_progress(i, track)

        result = download_track(track, playlist_dir)

        if result == "ok":
            stats.successful += 1
            print(f"  → Descargada exitosamente")
        elif result == "skipped":
            stats.skipped += 1
            print(f"  → Ya existe, omitida")
        else:
            stats.failed += 1
            stats.failed_tracks.append(str(track))
            print(f"  → FALLÓ la descarga")

    stats.print_summary()


if __name__ == "__main__":
    main()
