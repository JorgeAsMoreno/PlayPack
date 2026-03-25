// ─── i18n ─────────────────────────────────────────────────────────────────────

export type Lang = 'en' | 'es'

export interface Translations {
  hero_title: string
  hero_subtitle: string
  btn_download: string
  btn_cancel: string
  connecting: string
  connecting_spotify: string
  spotify_ok: string
  err_connection_lost: string
  err_start_download: string
  err_unknown: string
  songs: (n: number) => string
  progress: (done: number, total: number) => string
  completed: string
  stat_successful: string
  stat_failed: string
  stat_skipped: string
  track_downloading: string
  complete_title: string
  complete_desc: (successful: number, failed: number) => string
  footer_desc: string
  open_source: string
  track_placeholder: (n: number) => string
}

const en: Translations = {
  hero_title: 'Download your playlist',
  hero_subtitle: 'Paste the link of any public Spotify playlist',
  btn_download: 'Download',
  btn_cancel: 'Cancel',
  connecting: 'Connecting to Spotify...',
  connecting_spotify: 'Connecting to Spotify...',
  spotify_ok: 'Connected — fetching playlist',
  err_connection_lost: 'Connection lost with server',
  err_start_download: 'Error starting download',
  err_unknown: 'Unknown error',
  songs: (n) => `${n} song${n === 1 ? '' : 's'}`,
  progress: (done, total) => `${done} of ${total} completed`,
  completed: 'Completed!',
  stat_successful: 'Successful',
  stat_failed: 'Failed',
  stat_skipped: 'Already had',
  track_downloading: 'downloading',
  complete_title: 'Download complete',
  complete_desc: (successful, failed) =>
    `${successful} song${successful === 1 ? '' : 's'} ready · ${failed} failed`,
  footer_desc: 'Download Spotify playlists via YouTube',
  open_source: 'Open source',
  track_placeholder: (n) => `Song ${n}`,
}

const es: Translations = {
  hero_title: 'Descarga tu playlist',
  hero_subtitle: 'Pega el link de cualquier playlist pública de Spotify',
  btn_download: 'Descargar',
  btn_cancel: 'Cancelar',
  connecting: 'Conectando con Spotify...',
  connecting_spotify: 'Conectando con Spotify...',
  spotify_ok: 'Conectado — obteniendo playlist',
  err_connection_lost: 'Conexión perdida con el servidor',
  err_start_download: 'Error al iniciar la descarga',
  err_unknown: 'Error desconocido',
  songs: (n) => `${n} canción${n === 1 ? '' : 'es'}`,
  progress: (done, total) => `${done} de ${total} completadas`,
  completed: '¡Completado!',
  stat_successful: 'Exitosas',
  stat_failed: 'Fallidas',
  stat_skipped: 'Ya tenías',
  track_downloading: 'descargando',
  complete_title: 'Descarga completada',
  complete_desc: (successful, failed) =>
    `${successful} canción${successful === 1 ? '' : 'es'} listas · ${failed} fallidas`,
  footer_desc: 'Descarga playlists de Spotify vía YouTube',
  open_source: 'Open source',
  track_placeholder: (n) => `Canción ${n}`,
}

const dict: Record<Lang, Translations> = { en, es }

export function getSavedLang(): Lang {
  return localStorage.getItem('pp-lang') === 'es' ? 'es' : 'en'
}

export function getTranslations(lang: Lang): Translations {
  return dict[lang]
}
