import './App.css'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'

type WhisperLanguage = { code: string; name: string }

// Whisper language list (codes supported by Whisper models).
// Source: OpenAI Whisper supported languages list (ISO-ish codes used by Whisper).
const WHISPER_LANGUAGES: WhisperLanguage[] = [
  { code: 'af', name: 'Afrikaans' },
  { code: 'am', name: 'Amharic' },
  { code: 'ar', name: 'Arabic' },
  { code: 'as', name: 'Assamese' },
  { code: 'az', name: 'Azerbaijani' },
  { code: 'ba', name: 'Bashkir' },
  { code: 'be', name: 'Belarusian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'bn', name: 'Bengali' },
  { code: 'bo', name: 'Tibetan' },
  { code: 'br', name: 'Breton' },
  { code: 'bs', name: 'Bosnian' },
  { code: 'ca', name: 'Catalan' },
  { code: 'cs', name: 'Czech' },
  { code: 'cy', name: 'Welsh' },
  { code: 'da', name: 'Danish' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'et', name: 'Estonian' },
  { code: 'eu', name: 'Basque' },
  { code: 'fa', name: 'Persian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fo', name: 'Faroese' },
  { code: 'fr', name: 'French' },
  { code: 'gl', name: 'Galician' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'ha', name: 'Hausa' },
  { code: 'haw', name: 'Hawaiian' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hr', name: 'Croatian' },
  { code: 'ht', name: 'Haitian Creole' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'hy', name: 'Armenian' },
  { code: 'id', name: 'Indonesian' },
  { code: 'is', name: 'Icelandic' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'jw', name: 'Javanese' },
  { code: 'ka', name: 'Georgian' },
  { code: 'kk', name: 'Kazakh' },
  { code: 'km', name: 'Khmer' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ko', name: 'Korean' },
  { code: 'la', name: 'Latin' },
  { code: 'lb', name: 'Luxembourgish' },
  { code: 'ln', name: 'Lingala' },
  { code: 'lo', name: 'Lao' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lv', name: 'Latvian' },
  { code: 'mg', name: 'Malagasy' },
  { code: 'mi', name: 'Maori' },
  { code: 'mk', name: 'Macedonian' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mn', name: 'Mongolian' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ms', name: 'Malay' },
  { code: 'mt', name: 'Maltese' },
  { code: 'my', name: 'Burmese' },
  { code: 'ne', name: 'Nepali' },
  { code: 'nl', name: 'Dutch' },
  { code: 'nn', name: 'Norwegian Nynorsk' },
  { code: 'no', name: 'Norwegian' },
  { code: 'oc', name: 'Occitan' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'pl', name: 'Polish' },
  { code: 'ps', name: 'Pashto' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sa', name: 'Sanskrit' },
  { code: 'sd', name: 'Sindhi' },
  { code: 'si', name: 'Sinhala' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'sn', name: 'Shona' },
  { code: 'so', name: 'Somali' },
  { code: 'sq', name: 'Albanian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'su', name: 'Sundanese' },
  { code: 'sv', name: 'Swedish' },
  { code: 'sw', name: 'Swahili' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'tg', name: 'Tajik' },
  { code: 'th', name: 'Thai' },
  { code: 'tk', name: 'Turkmen' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'tr', name: 'Turkish' },
  { code: 'tt', name: 'Tatar' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'uz', name: 'Uzbek' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'yi', name: 'Yiddish' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'zh', name: 'Chinese' },
]

type OutputAudioFormat = 'mp3' | 'wav' | 'flac' | 'aac' | 'opus' | 'pcm'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

function inferPreferredOutputFormatFromFilename(filename: string): OutputAudioFormat {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'mp3':
      return 'mp3'
    case 'wav':
      return 'wav'
    case 'flac':
      return 'flac'
    case 'aac':
      return 'aac'
    case 'opus':
      return 'opus'
    case 'ogg':
    case 'oga':
      return 'opus'
    case 'm4a':
      // m4a is typically AAC-in-MP4; closest TTS output is raw AAC.
      return 'aac'
    default:
      return 'mp3'
  }
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceLanguage, setSourceLanguage] = useState<string>('auto')
  const [targetLanguagePreset, setTargetLanguagePreset] = useState<string>('es')
  const [useCustomTargetLanguage, setUseCustomTargetLanguage] = useState<boolean>(false)
  const [targetLanguageCustom, setTargetLanguageCustom] = useState<string>('Spanish')
  const [voice, setVoice] = useState<string>('cedar')
  const [responseFormat, setResponseFormat] = useState<OutputAudioFormat>('mp3')
  const [styleNotes, setStyleNotes] = useState<string>('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [transcript, setTranscript] = useState<string>('')
  const [translation, setTranslation] = useState<string>('')
  const [textTrimmed, setTextTrimmed] = useState<boolean>(false)

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const downloadFilename = useMemo(
    () => `translated.${responseFormat}`,
    [responseFormat],
  )

  const voiceOptions = useMemo(() => ['cedar', 'alloy', 'coral'], [])

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    }
  }, [downloadUrl])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setTranscript('')
    setTranslation('')
    setTextTrimmed(false)

    if (!file) {
      setError('Please choose an audio file to upload.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('File too large. Please choose a file up to 50MB.')
      return
    }
    const targetLanguage = useCustomTargetLanguage
      ? targetLanguageCustom.trim()
      : targetLanguagePreset.trim()
    if (!targetLanguage) {
      setError('Please choose a target language.')
      return
    }

    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl)
      setDownloadUrl(null)
    }

    const form = new FormData()
    form.append('file', file)
    form.append('sourceLanguage', sourceLanguage)
    form.append('targetLanguage', targetLanguage)
    form.append('voice', voice)
    form.append('responseFormat', responseFormat)
    form.append('styleNotes', styleNotes)

    setIsSubmitting(true)
    try {
      const resp = await fetch('/api/translate-audio', {
        method: 'POST',
        body: form,
      })

      if (!resp.ok) {
        let message = `Request failed (${resp.status}).`
        try {
          const j = (await resp.json()) as { error?: unknown }
          if (typeof j?.error === 'string') message = j.error
          else if (j?.error) message = JSON.stringify(j.error)
        } catch {
          try {
            const t = await resp.text()
            if (t) message = `${message} ${t}`
          } catch {
            // ignore
          }
        }
        setError(message)
        return
      }

      const hTranscript = resp.headers.get('x-transcript')
      const hTranslation = resp.headers.get('x-translation')
      const hTrimmed = resp.headers.get('x-text-trimmed')

      if (hTranscript) setTranscript(decodeURIComponent(hTranscript))
      if (hTranslation) setTranslation(decodeURIComponent(hTranslation))
      if (hTrimmed) setTextTrimmed(hTrimmed === 'true')

      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Audio Translator</h1>
        <p className="subheader">
          Upload audio → transcribe → translate → generate a new spoken audio file.
        </p>
      </header>

      <form className="panel" onSubmit={onSubmit}>
        <div className="grid">
          <label className="field">
            <span className="label">Audio file (max 50MB)</span>
            <input
              type="file"
              accept="audio/*,.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,.aac,.ogg,.oga,.opus"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null
                setFile(next)
                if (next) setResponseFormat(inferPreferredOutputFormatFromFilename(next.name))
              }}
              disabled={isSubmitting}
            />
            {file ? (
              <span className="hint">
                Selected: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
              </span>
            ) : (
              <span className="hint">Supported: mp3, m4a, wav, webm, mp4, ogg, opus, aac.</span>
            )}
          </label>

          <label className="field">
            <span className="label">Source language</span>
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="auto">Auto-detect</option>
              {WHISPER_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
            <span className="hint">This dropdown is the full Whisper language set (or auto-detect).</span>
          </label>

          <label className="field">
            <span className="label">Target language</span>
            {!useCustomTargetLanguage ? (
              <>
                <select
                  value={targetLanguagePreset}
                  onChange={(e) => setTargetLanguagePreset(e.target.value)}
                  disabled={isSubmitting}
                >
                  {WHISPER_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
                <span className="hint">Select a Whisper language, or switch to custom for dialects/notes.</span>
              </>
            ) : (
              <>
                <input
                  value={targetLanguageCustom}
                  onChange={(e) => setTargetLanguageCustom(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. Arabic (Saudi, Najdi slang)"
                />
                <span className="hint">Custom target language text (useful for dialects or style constraints).</span>
              </>
            )}
            <label className="hint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={useCustomTargetLanguage}
                onChange={(e) => setUseCustomTargetLanguage(e.target.checked)}
                disabled={isSubmitting}
              />
              Use custom target language
            </label>
          </label>

          <label className="field">
            <span className="label">Voice</span>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              disabled={isSubmitting}
            >
              {voiceOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">Output format</span>
            <select
              value={responseFormat}
              onChange={(e) => setResponseFormat(e.target.value as OutputAudioFormat)}
              disabled={isSubmitting}
            >
              <option value="mp3">mp3</option>
              <option value="wav">wav</option>
              <option value="flac">flac</option>
              <option value="aac">aac</option>
              <option value="opus">opus</option>
              <option value="pcm">pcm</option>
            </select>
            <span className="hint">Defaults to “match input” when possible. Note: m4a/mp4 are containers; TTS outputs audio codecs/streams.</span>
          </label>

          <label className="field fieldFull">
            <span className="label">Style notes (optional)</span>
            <textarea
              value={styleNotes}
              onChange={(e) => setStyleNotes(e.target.value)}
              disabled={isSubmitting}
              placeholder="E.g., keep it casual, keep slang, avoid overly formal language."
              rows={3}
            />
          </label>
        </div>

        <div className="actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Processing…' : 'Translate & Generate Audio'}
          </button>

          {downloadUrl ? (
            <a className="buttonSecondary" href={downloadUrl} download={downloadFilename}>
              Download {downloadFilename}
            </a>
          ) : null}
        </div>

        {error ? <div className="error">{error}</div> : null}
      </form>

      {(transcript || translation) && (
        <section className="panel">
          <h2>Text (for reference)</h2>
          {textTrimmed ? (
            <p className="hint">
              Note: text is trimmed in the UI for safety (headers limit). The audio is generated from the full text.
            </p>
          ) : null}

          <div className="twoCol">
            <div>
              <h3>Transcript</h3>
              <pre className="pre">{transcript || '—'}</pre>
            </div>
            <div>
              <h3>Translation</h3>
              <pre className="pre">{translation || '—'}</pre>
            </div>
          </div>
        </section>
      )}

      <footer className="footer">
        <p className="hint">
          Backend uses OpenAI: transcription → GPT translation → TTS. Your audio is processed on your server.
        </p>
      </footer>
    </div>
  )
}

export default App
