import { useEffect, useRef, useState } from 'react'
import { type Lang, getSavedLang, getTranslations } from './i18n'

const GITHUB_URL = 'https://github.com/JorgeAsMoreno/PlayPack'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'connecting' | 'spotify_ok' | 'downloading' | 'complete' | 'error'
type TrackStatus = 'pending' | 'downloading' | 'ok' | 'failed' | 'skipped'

interface TrackItem {
  label: string
  status: TrackStatus
}

interface DLState {
  phase: Phase
  playlistName: string
  total: number
  current: number
  successful: number
  failed: number
  skipped: number
  tracks: TrackItem[]
  jobId: string
  errorMessage: string
}

const initial: DLState = {
  phase: 'idle',
  playlistName: '',
  total: 0,
  current: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  tracks: [],
  jobId: '',
  errorMessage: '',
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconSun() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

function IconMusic() {
  return (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 3v12" />
    </svg>
  )
}

function IconGithub() {
  return (
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function Spinner({ size = 14, color = 'border-spotify' }: { size?: number; color?: string }) {
  return (
    <span
      className={`inline-block border-2 ${color} border-t-transparent rounded-full animate-spin flex-shrink-0`}
      style={{ width: size, height: size }}
    />
  )
}

function StatusIcon({ status }: { status: TrackStatus }) {
  if (status === 'ok')          return <span className="text-spotify text-xs font-bold">✓</span>
  if (status === 'failed')      return <span className="text-red-400 text-xs font-bold">✗</span>
  if (status === 'skipped')     return <span className="text-amber-400 text-xs font-bold">↩</span>
  if (status === 'downloading') return <Spinner size={12} color="border-blue-400" />
  return <span className="text-neutral-400 dark:text-neutral-600 text-xs">·</span>
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar({
  dark,
  onToggle,
  lang,
  onToggleLang,
}: {
  dark: boolean
  onToggle: () => void
  lang: Lang
  onToggleLang: () => void
}) {
  return (
    <header className="fixed top-0 inset-x-0 z-10 h-14
                       bg-white/80 dark:bg-[#111]/80 backdrop-blur-md
                       border-b border-neutral-200 dark:border-white/5
                       transition-colors duration-300">
      <div className="max-w-2xl mx-auto h-full px-4 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-2 select-none">
          <span className="text-spotify"><IconMusic /></span>
          <span className="font-semibold text-base tracking-tight text-neutral-900 dark:text-white">
            PlayPack
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="w-9 h-9 flex items-center justify-center rounded-lg
                       text-neutral-500 dark:text-neutral-400
                       hover:bg-neutral-100 dark:hover:bg-white/10
                       hover:text-neutral-900 dark:hover:text-white
                       transition-colors"
          >
            <IconGithub />
          </a>

          {/* Language toggle — shows the language you will switch TO */}
          <button
            onClick={onToggleLang}
            aria-label="Toggle language"
            className="w-9 h-9 flex items-center justify-center rounded-lg
                       text-neutral-500 dark:text-neutral-400
                       hover:bg-neutral-100 dark:hover:bg-white/10
                       hover:text-neutral-900 dark:hover:text-white
                       transition-colors text-xs font-semibold tracking-wide"
          >
            {lang === 'en' ? 'ES' : 'EN'}
          </button>

          <button
            onClick={onToggle}
            aria-label="Toggle theme"
            className="w-9 h-9 flex items-center justify-center rounded-lg
                       text-neutral-500 dark:text-neutral-400
                       hover:bg-neutral-100 dark:hover:bg-white/10
                       hover:text-neutral-900 dark:hover:text-white
                       transition-colors"
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </div>
    </header>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-neutral-100 dark:bg-white/5 rounded-2xl p-4 text-center">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-neutral-500 text-xs mt-0.5 font-medium">{label}</p>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [url, setUrl]     = useState('')
  const [state, setState] = useState<DLState>(initial)
  const esRef             = useRef<EventSource | null>(null)
  const listRef           = useRef<HTMLDivElement>(null)

  // Read initial theme from DOM (set by index.html inline script before React mounts)
  const [dark, setDark] = useState(
    () => document.documentElement.classList.contains('dark')
  )

  // Language state — persisted in localStorage
  const [lang, setLang] = useState<Lang>(getSavedLang)

  // Active translations object
  const t = getTranslations(lang)

  // Toggle theme: update DOM + localStorage immediately, no useEffect needed
  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('pp-theme', next ? 'dark' : 'light')
  }

  // Toggle language: update state, localStorage, and html[lang] attribute
  function toggleLang() {
    const next: Lang = lang === 'en' ? 'es' : 'en'
    setLang(next)
    localStorage.setItem('pp-lang', next)
    document.documentElement.setAttribute('lang', next)
  }

  // Auto-scroll track list
  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight
  }, [state.current])

  // ── SSE logic ──────────────────────────────────────────────────────────────

  async function handleStart() {
    if (!url.trim()) return
    if (esRef.current) esRef.current.close()
    setState({ ...initial, phase: 'connecting' })

    try {
      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      if (!res.ok) throw new Error(t.err_start_download)
      const { job_id } = await res.json()
      setState(s => ({ ...s, jobId: job_id }))

      const es = new EventSource(`/api/events/${job_id}`)
      esRef.current = es

      es.onmessage = (e) => {
        const ev = JSON.parse(e.data)
        if (ev.type === 'ping') return

        // Spotify connection succeeded — playlist info is arriving
        if (ev.type === 'playlist_info') {
          setState(s => ({ ...s, phase: 'spotify_ok' }))
          // Small delay so the "connected" message is visible before the card appears
          setTimeout(() => setState(s => ({
            ...s,
            phase: 'downloading',
            playlistName: ev.name,
            total: ev.total,
            tracks: Array.from({ length: ev.total }, (_, i) => ({
              label: t.track_placeholder(i + 1),
              status: 'pending',
            })),
          })), 800)
        }

        if (ev.type === 'track_start') {
          setState(s => {
            const tracks = [...s.tracks]
            if (tracks[ev.current - 1])
              tracks[ev.current - 1] = { label: ev.track, status: 'downloading' }
            return { ...s, current: ev.current, tracks }
          })
        }

        if (ev.type === 'track_done') {
          setState(s => {
            const tracks = [...s.tracks]
            if (tracks[ev.current - 1])
              tracks[ev.current - 1] = { label: ev.track, status: ev.status }
            return {
              ...s,
              current: ev.current,
              successful: ev.successful,
              failed: ev.failed,
              skipped: ev.skipped,
              tracks,
            }
          })
        }

        if (ev.type === 'complete') {
          setState(s => ({
            ...s,
            phase: 'complete',
            successful: ev.successful,
            failed: ev.failed,
            skipped: ev.skipped,
          }))
          es.close()
        }

        if (ev.type === 'error') {
          setState(s => ({ ...s, phase: 'error', errorMessage: ev.message }))
          es.close()
        }
      }

      es.onerror = () => {
        setState(s =>
          s.phase !== 'complete'
            ? { ...s, phase: 'error', errorMessage: t.err_connection_lost }
            : s
        )
        es.close()
      }
    } catch (err) {
      setState(s => ({
        ...s,
        phase: 'error',
        errorMessage: err instanceof Error ? err.message : t.err_unknown,
      }))
    }
  }

  function handleReset() {
    if (esRef.current) esRef.current.close()
    setState(initial)
    setUrl('')
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const completed    = state.phase === 'complete'
    ? state.total
    : Math.max(0, state.successful + state.failed + state.skipped)
  const pct          = state.total > 0 ? Math.round((completed / state.total) * 100) : 0
  const isRunning    = state.phase === 'connecting' || state.phase === 'spotify_ok' || state.phase === 'downloading'
  const currentTrack = state.tracks[state.current - 1]

  const avatarColors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-pink-500', 'bg-orange-500', 'bg-cyan-500']
  const avatarColor  = avatarColors[(state.playlistName.charCodeAt(0) || 0) % avatarColors.length]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-white
                    transition-colors duration-300 flex flex-col">
      <Navbar dark={dark} onToggle={toggleTheme} lang={lang} onToggleLang={toggleLang} />

      <main className="flex-1 pt-24 pb-16 px-4 flex flex-col items-center">

        {/* Hero */}
        <div className="mb-10 text-center animate-fade-in">
          <h2 className="text-3xl font-bold tracking-tight mb-2">
            {t.hero_title}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            {t.hero_subtitle}
          </p>
        </div>

        <div className="w-full max-w-2xl space-y-4 animate-fade-in">

          {/* URL input */}
          <div className={`flex gap-2 p-1.5 rounded-2xl border transition-colors duration-200
            ${isRunning
              ? 'bg-neutral-100 dark:bg-white/5 border-neutral-200 dark:border-white/10'
              : 'bg-white dark:bg-white/5 border-neutral-200 dark:border-white/10 shadow-sm focus-within:border-spotify dark:focus-within:border-spotify'
            }`}
          >
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isRunning && handleStart()}
              placeholder="https://open.spotify.com/playlist/..."
              disabled={isRunning}
              className="flex-1 bg-transparent px-3 py-2 text-sm outline-none
                         placeholder-neutral-400 dark:placeholder-neutral-600
                         disabled:opacity-50"
            />
            {!isRunning ? (
              <button
                onClick={handleStart}
                disabled={!url.trim()}
                className="bg-spotify hover:bg-spotify-light active:scale-95
                           disabled:opacity-40 disabled:cursor-not-allowed
                           text-black font-semibold rounded-xl px-5 py-2 text-sm
                           transition-all whitespace-nowrap"
              >
                {t.btn_download}
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="bg-neutral-200 hover:bg-neutral-300 dark:bg-white/10 dark:hover:bg-white/20
                           text-neutral-700 dark:text-white font-semibold rounded-xl px-5 py-2
                           text-sm transition-colors whitespace-nowrap"
              >
                {t.btn_cancel}
              </button>
            )}
          </div>

          {/* Error */}
          {state.phase === 'error' && (
            <div className="animate-slide-down flex items-start gap-3 bg-red-50 dark:bg-red-950/40
                            border border-red-200 dark:border-red-900/60 rounded-2xl px-4 py-3">
              <span className="text-red-500 mt-0.5 flex-shrink-0">✕</span>
              <p className="text-red-600 dark:text-red-300 text-sm">{state.errorMessage}</p>
            </div>
          )}

          {/* Connecting / Spotify OK */}
          {(state.phase === 'connecting' || state.phase === 'spotify_ok') && (
            <div className="animate-slide-down flex flex-col items-center gap-3 py-8">
              <div className="flex items-center gap-3 text-neutral-500 dark:text-neutral-400 text-sm">
                {state.phase === 'connecting' ? (
                  <>
                    <Spinner size={16} color="border-spotify" />
                    <span>{t.connecting_spotify}</span>
                  </>
                ) : (
                  <>
                    <span className="text-spotify font-bold text-base">✓</span>
                    <span className="text-spotify font-medium">{t.spotify_ok}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Progress card */}
          {(state.phase === 'downloading' || state.phase === 'complete') && (
            <div className="animate-slide-down bg-white dark:bg-[#141414]
                            border border-neutral-200 dark:border-white/8
                            rounded-3xl p-6 shadow-sm space-y-5">

              {/* Header */}
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${avatarColor} flex items-center justify-center
                                 text-white font-bold text-lg flex-shrink-0 shadow-sm`}>
                  {state.playlistName.charAt(0).toUpperCase() || '♫'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base truncate">
                    {state.playlistName}
                  </p>
                  <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-0.5">
                    {t.songs(state.total)}
                  </p>
                </div>
                {state.phase === 'complete' && (
                  <a
                    href={`/api/download/${state.jobId}`}
                    className="flex items-center gap-1.5 bg-spotify hover:bg-spotify-light active:scale-95
                               text-black font-semibold rounded-xl px-4 py-2 text-sm transition-all
                               flex-shrink-0"
                  >
                    <IconDownload /> ZIP
                  </a>
                )}
              </div>

              <div className="border-t border-neutral-100 dark:border-white/5" />

              {/* Progress bar */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {state.phase === 'complete'
                      ? t.completed
                      : t.progress(completed, state.total)}
                  </span>
                  <span className="text-xs font-mono font-semibold text-neutral-600 dark:text-neutral-300">
                    {pct}%
                  </span>
                </div>
                <div className="h-2 bg-neutral-100 dark:bg-white/8 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-spotify rounded-full transition-all duration-500 ease-out
                                relative overflow-hidden
                                ${state.phase === 'downloading' ? 'shimmer' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {state.phase === 'downloading' && currentTrack && (
                  <div className="flex items-center gap-2 mt-2">
                    <Spinner size={11} color="border-spotify" />
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {currentTrack.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard value={state.successful} label={t.stat_successful} color="text-spotify" />
                <StatCard value={state.failed}     label={t.stat_failed}     color="text-red-400" />
                <StatCard value={state.skipped}    label={t.stat_skipped}    color="text-amber-400" />
              </div>

              {/* Track list */}
              <div ref={listRef} className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-0.5">
                {state.tracks.map((track, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm
                                transition-all duration-200
                      ${track.status === 'downloading'
                        ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40'
                        : 'hover:bg-neutral-50 dark:hover:bg-white/[0.03]'
                      }`}
                  >
                    <span className="w-4 flex-shrink-0 flex items-center justify-center">
                      <StatusIcon status={track.status} />
                    </span>
                    <span className={`truncate flex-1 text-xs leading-relaxed
                      ${track.status === 'downloading' ? 'text-blue-700 dark:text-blue-300 font-medium' : ''}
                      ${track.status === 'ok'          ? 'text-neutral-600 dark:text-neutral-400' : ''}
                      ${track.status === 'failed'      ? 'text-red-400' : ''}
                      ${track.status === 'skipped'     ? 'text-amber-500' : ''}
                      ${track.status === 'pending'     ? 'text-neutral-400 dark:text-neutral-600' : ''}
                    `}>
                      {track.label}
                    </span>
                    {track.status === 'downloading' && (
                      <span className="text-blue-500 dark:text-blue-400 text-xs flex-shrink-0 font-medium">
                        {t.track_downloading}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Complete banner */}
              {state.phase === 'complete' && (
                <div className="animate-fade-in flex items-center gap-3 bg-spotify/10
                                border border-spotify/20 rounded-2xl px-4 py-3">
                  <span className="text-spotify text-lg">✓</span>
                  <div>
                    <p className="text-spotify text-sm font-semibold">{t.complete_title}</p>
                    <p className="text-neutral-500 dark:text-neutral-400 text-xs">
                      {t.complete_desc(state.successful, state.failed)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-white/5 py-5 px-4 transition-colors duration-300">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2
                        text-xs text-neutral-400 dark:text-neutral-600">
          <div className="flex items-center gap-2">
            <span className="text-spotify font-semibold">PlayPack</span>
            <span>·</span>
            <span>{t.footer_desc}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>MP3 · 192kbps</span>
            <span>·</span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors"
            >
              <IconGithub />
              {t.open_source}
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
