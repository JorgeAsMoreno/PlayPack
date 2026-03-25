# PlayPack

Download any public Spotify playlist as MP3 files — via YouTube.

PlayPack reads your playlist from the Spotify API, searches each track on YouTube, downloads the best audio source, converts it to **MP3 at 192 kbps**, and packages everything into a ZIP. It ships with a React web UI and a standalone CLI.

---

## Features

- **Real-time progress** — track-by-track status via Server-Sent Events
- **Smart skip** — already-downloaded tracks are detected and skipped automatically
- **ZIP download** — all MP3s bundled in one click when the job completes
- **Dark / light theme** — persisted in `localStorage`
- **English / Spanish UI** — toggle in the navbar, persisted across sessions
- **CLI mode** — run headless from the terminal with optional `--limit` flag

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python 3.11 · FastAPI · Uvicorn |
| Spotify | Spotipy (Client Credentials flow) |
| Download | yt-dlp · ffmpeg |
| Frontend | React 18 · TypeScript · Vite |
| Styling | Tailwind CSS |
| Streaming | Server-Sent Events (SSE) |
| Deploy | Render |

---

## Prerequisites

- **Python 3.11+**
- **Node.js 18+** (only needed to run the web UI)
- **ffmpeg** — required by yt-dlp for audio conversion

  ```bash
  # macOS
  brew install ffmpeg

  # Ubuntu / Debian
  sudo apt install ffmpeg

  # Windows (via winget)
  winget install ffmpeg
  ```

- **Spotify API credentials** — create a free app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard). You only need the *Client ID* and *Client Secret* (no redirect URI required).

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/JorgeAsMoreno/PlayPack.git
cd playpack
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```bash
export SPOTIFY_CLIENT_ID="your_client_id_here"
export SPOTIFY_CLIENT_SECRET="your_client_secret_here"
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4. Install frontend dependencies (web UI only)

```bash
cd frontend && npm install && cd ..
```

---

## Usage

### Web UI — development

Start the API and the frontend dev server in two terminals:

```bash
# Terminal 1 — API
source .env
uvicorn api.main:app --reload --port 8000
```

```bash
# Terminal 2 — frontend
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), paste a Spotify playlist URL, and click **Download**.

### Web UI — production build

Build the frontend and serve everything through FastAPI:

```bash
source .env
cd frontend && npm run build && cd ..
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

Open [http://localhost:8000](http://localhost:8000).

### CLI

```bash
source .env
python playpack.py <spotify-playlist-url>
```

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--output`, `-o` | `./downloads` | Destination folder |
| `--limit`, `-l` | `0` (all) | Max number of tracks to download |

**Examples:**

```bash
# Download a full playlist
python playpack.py https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M

# Download only the first 10 tracks
python playpack.py https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M --limit 10

# Save to a custom folder
python playpack.py https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M -o ~/Music/playlists
```

Files are saved to `downloads/<playlist-name>/Artist - Title.mp3`.

---

## Project structure

```
playpack/
├── playpack.py          # Core logic + CLI entry point
├── requirements.txt
├── render.yaml          # Render deployment config
├── .env.example
│
├── api/
│   └── main.py          # FastAPI app — SSE streaming, ZIP endpoint
│
└── frontend/
    ├── src/
    │   ├── App.tsx       # Main React component
    │   ├── i18n.ts       # English / Spanish translations
    │   ├── main.tsx
    │   └── index.css
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

---

## Deploying to Render

The repo includes a `render.yaml` for a free [Render](https://render.com) web service.

1. Push the repo to GitHub.
2. Go to **dashboard.render.com → New Web Service** and connect your repo.
3. Render will pick up `render.yaml` automatically. Add the two env vars in the dashboard:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
4. Hit **Deploy**. The build step installs Python deps, builds the React app, and starts Uvicorn.

---

## How it works

```
Spotify URL
    │
    ▼
Spotify API ──► fetch track list (name, artist, duration)
    │
    ▼
For each track
    │
    ├── already exists on disk? ──► skip
    │
    └── search YouTube ──► yt-dlp download ──► ffmpeg → MP3 192kbps
    │
    ▼
SSE event stream ──► React UI updates in real time
    │
    ▼
ZIP archive ready for download
```

Track status meanings:

| Status | Meaning |
|---|---|
| `ok` | Downloaded and converted successfully |
| `skipped` | File already existed — no re-download |
| `failed` | No YouTube result found or download error |

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | Yes | From your Spotify app dashboard |
| `SPOTIFY_CLIENT_SECRET` | Yes | From your Spotify app dashboard |

---

## License

MIT
