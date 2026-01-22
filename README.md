# Audio Translator (Speech → Translated Speech)

Simple web UI to upload an audio file, choose source + target language, and download a translated audio file.

Pipeline:

1. Speech → text (transcription)
2. Text → target language text (GPT translation)
3. Target language text → speech (TTS audio)

## Requirements

- Node.js 20+ (this repo works on Node 22)
- An OpenAI API key

## Setup

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and set:

```bash
OPENAI_API_KEY=...
```

Install dependencies:

```bash
npm install
```

## Run (dev)

This starts both the backend (`http://localhost:8787`) and the frontend (`http://localhost:5173`):

```bash
npm run dev
```

Open the UI and upload an audio file. After processing, click **Download** to save the translated audio.

## Deploy to Vercel

This repo includes Vercel Serverless Functions under `api/` and a `vercel.json` that builds the Vite app in `client/`.

- **Set env var**: in Vercel project settings, add `OPENAI_API_KEY`.
- **Deploy**: import the repo into Vercel and deploy (no extra config required).

After deploy:

- Frontend is served at `/`
- API endpoints:
  - `GET /api/health`
  - `POST /api/translate-audio` (multipart form field `file`)

## Notes

- Upload limit is **25MB**.
- Source language can be `auto`, a language name (e.g. `French`), or a short code like `en`, `es`, `pt-BR`.
- The UI shows transcript/translation text only for reference (trimmed for header safety).

