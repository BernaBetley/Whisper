import cors from "cors";
import "dotenv/config";
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { z } from "zod";

const PORT = Number.parseInt(process.env.PORT ?? "8787", 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let openaiClient = null;
function getOpenAIClient() {
  if (!OPENAI_API_KEY) return null;
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  return openaiClient;
}

const app = express();

// In dev, the Vite client will run on a separate port.
app.use(
  cors({
    origin: true,
    credentials: false,
    exposedHeaders: ["x-transcript", "x-translation", "x-text-trimmed"],
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Matches Audio API upload limit.
    fileSize: 25 * 1024 * 1024,
  },
});

const TranslateAudioBody = z.object({
  sourceLanguage: z.string().trim().optional().default("auto"),
  targetLanguage: z.string().trim().min(1),
  voice: z.string().trim().optional().default("cedar"),
  responseFormat: z.enum(["mp3", "wav", "flac"]).optional().default("mp3"),
  styleNotes: z.string().trim().optional().default(""),
});

function guessAudioContentType(responseFormat) {
  switch (responseFormat) {
    case "wav":
      return "audio/wav";
    case "flac":
      return "audio/flac";
    case "mp3":
    default:
      return "audio/mpeg";
  }
}

function shouldSendLanguageCode(lang) {
  // OpenAI STT "language" param expects a BCP-47-ish short code in practice (e.g. "en", "es", "pt-BR").
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(lang);
}

app.post("/api/translate-audio", upload.single("file"), async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      res.status(500).json({
        error:
          "Missing OPENAI_API_KEY. Set it in your environment before starting the server.",
      });
      return;
    }
    const client = getOpenAIClient();
    if (!client) {
      res.status(500).json({ error: "OpenAI client not initialized." });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "Missing audio file (form field: file)." });
      return;
    }

    const parsed = TranslateAudioBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { sourceLanguage, targetLanguage, voice, responseFormat, styleNotes } =
      parsed.data;

    const ext = path.extname(req.file.originalname || "") || ".audio";
    const tmpPath = path.join(
      os.tmpdir(),
      `stt-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`,
    );

    await fsp.writeFile(tmpPath, req.file.buffer);

    let transcriptText = "";
    let translatedText = "";

    try {
      // 1) Speech -> text (transcribe)
      const transcription = await client.audio.transcriptions.create({
        model: "gpt-4o-mini-transcribe",
        file: fs.createReadStream(tmpPath),
        ...(sourceLanguage && sourceLanguage !== "auto" && shouldSendLanguageCode(sourceLanguage)
          ? { language: sourceLanguage }
          : {}),
      });

      transcriptText = transcription.text ?? "";

      // 2) Text -> target language text
      const translationPrompt = [
        sourceLanguage && sourceLanguage !== "auto"
          ? `Translate from ${sourceLanguage} into ${targetLanguage}.`
          : `Translate into ${targetLanguage}.`,
        "Keep it natural and conversational.",
        "Do not add new information. Preserve meaning, names, numbers, and intent.",
        styleNotes ? `Style notes: ${styleNotes}` : "",
        "",
        transcriptText,
      ]
        .filter(Boolean)
        .join("\n");

      const tr = await client.responses.create({
        model: "gpt-4.1-mini",
        input: translationPrompt,
      });

      translatedText = tr.output_text ?? "";

      // 3) Target language text -> speech (audio file)
      const speech = await client.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice,
        input: translatedText,
        response_format: responseFormat,
      });

      const buffer = Buffer.from(await speech.arrayBuffer());

      // Optional: expose text in headers (trimmed to avoid giant headers).
      const headerLimit = 1500;
      const transcriptHeader =
        transcriptText.length > headerLimit
          ? transcriptText.slice(0, headerLimit)
          : transcriptText;
      const translationHeader =
        translatedText.length > headerLimit
          ? translatedText.slice(0, headerLimit)
          : translatedText;

      res.setHeader("x-text-trimmed", String(
        transcriptText.length > headerLimit || translatedText.length > headerLimit,
      ));
      res.setHeader("x-transcript", encodeURIComponent(transcriptHeader));
      res.setHeader("x-translation", encodeURIComponent(translationHeader));

      res.setHeader("Content-Type", guessAudioContentType(responseFormat));
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="translated.${responseFormat}"`,
      );
      res.status(200).send(buffer);
    } finally {
      await fsp.rm(tmpPath, { force: true }).catch(() => {});
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error processing audio." });
  }
});

// Serve built client (optional, for production).
const clientDistPath = path.join(process.cwd(), "..", "client", "dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

