import './App.css'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [sourceLanguage, setSourceLanguage] = useState<string>('auto')
  const [targetLanguage, setTargetLanguage] = useState<string>('Spanish')
  const [voice, setVoice] = useState<string>('cedar')
  const [responseFormat, setResponseFormat] = useState<'mp3' | 'wav' | 'flac'>('mp3')
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

  const languageSuggestions = useMemo(
    () => [
      'English',
      'Spanish',
      'French',
      'German',
      'Italian',
      'Portuguese',
      'Arabic',
      'Hindi',
      'Japanese',
      'Korean',
      'Chinese (Simplified)',
      'Russian',
      'Turkish',
      'Vietnamese',
      'Thai',
    ],
    [],
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
    if (!targetLanguage.trim()) {
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
          // ignore
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
              accept="audio/*,.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={isSubmitting}
            />
            {file ? (
              <span className="hint">
                Selected: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
              </span>
            ) : (
              <span className="hint">Supported: mp3, m4a, wav, webm, mp4.</span>
            )}
          </label>

          <label className="field">
            <span className="label">Source language</span>
            <input
              list="languages"
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              disabled={isSubmitting}
              placeholder="auto"
            />
            <span className="hint">Use “auto”, or a language name, or a code like “en”, “es”, “pt-BR”.</span>
          </label>

          <label className="field">
            <span className="label">Target language</span>
            <input
              list="languages"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <span className="hint">Example: “Spanish” or “Arabic (Saudi, Najdi slang)”.</span>
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
              onChange={(e) => setResponseFormat(e.target.value as 'mp3' | 'wav' | 'flac')}
              disabled={isSubmitting}
            >
              <option value="mp3">mp3</option>
              <option value="wav">wav</option>
              <option value="flac">flac</option>
            </select>
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

        <datalist id="languages">
          {languageSuggestions.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>

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
