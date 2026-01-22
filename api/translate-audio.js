const Busboy = require("busboy");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const MAX_FILE_BYTES = 25 * 1024 * 1024;

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
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(lang);
}

function parseMultipartToTempFile(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 20 },
    });

    const fields = {};
    let tmpPath = null;
    let originalName = "audio";
    let fileWritePromise = null;
    let sawFile = false;
    let fileTooLarge = false;

    bb.on("field", (name, value) => {
      fields[name] = value;
    });

    bb.on("file", (fieldname, file, info) => {
      if (fieldname !== "file") {
        file.resume();
        return;
      }
      sawFile = true;
      originalName = info?.filename || "audio";
      const ext = path.extname(originalName) || ".audio";
      tmpPath = path.join(
        os.tmpdir(),
        `upload-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`,
      );

      fileWritePromise = new Promise((res, rej) => {
        const out = fs.createWriteStream(tmpPath);
        file.on("limit", () => {
          fileTooLarge = true;
          try {
            out.destroy(new Error("File too large"));
          } catch {
            // ignore
          }
        });
        out.on("error", rej);
        out.on("close", res);
        file.pipe(out);
      });
    });

    bb.on("error", reject);

    bb.on("finish", async () => {
      try {
        if (!sawFile || !tmpPath || !fileWritePromise) {
          reject(new Error("Missing audio file (form field: file)."));
          return;
        }
        await fileWritePromise;
        if (fileTooLarge) {
          reject(new Error("File too large (max 25MB)."));
          return;
        }
        resolve({ fields, tmpPath, originalName });
      } catch (err) {
        reject(err);
      }
    });

    req.pipe(bb);
  });
}

module.exports = async (req, res) => {
  // Basic CORS (safe default; same-origin on Vercel is fine too)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "x-transcript, x-translation, x-text-trimmed");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Missing OPENAI_API_KEY." }));
    return;
  }

  let tmpPath = null;
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    const parsed = await parseMultipartToTempFile(req);
    tmpPath = parsed.tmpPath;
    const fields = parsed.fields || {};

    const sourceLanguage = (fields.sourceLanguage || "auto").trim();
    const targetLanguage = (fields.targetLanguage || "").trim();
    const voice = (fields.voice || "cedar").trim();
    const responseFormatRaw = (fields.responseFormat || "mp3").trim();
    const responseFormat = ["mp3", "wav", "flac"].includes(responseFormatRaw)
      ? responseFormatRaw
      : "mp3";
    const styleNotes = (fields.styleNotes || "").trim();

    if (!targetLanguage) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Missing targetLanguage." }));
      return;
    }

    // 1) Speech -> text (transcribe)
    const transcription = await client.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file: fs.createReadStream(tmpPath),
      ...(sourceLanguage &&
      sourceLanguage !== "auto" &&
      shouldSendLanguageCode(sourceLanguage)
        ? { language: sourceLanguage }
        : {}),
    });

    const transcriptText = transcription.text ?? "";

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

    const translatedText = tr.output_text ?? "";

    // 3) Target language text -> speech
    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: translatedText,
      response_format: responseFormat,
    });

    const buffer = Buffer.from(await speech.arrayBuffer());

    // Include text in headers (trimmed to avoid giant headers).
    const headerLimit = 1500;
    const transcriptHeader =
      transcriptText.length > headerLimit
        ? transcriptText.slice(0, headerLimit)
        : transcriptText;
    const translationHeader =
      translatedText.length > headerLimit
        ? translatedText.slice(0, headerLimit)
        : translatedText;

    res.setHeader(
      "x-text-trimmed",
      String(
        transcriptText.length > headerLimit || translatedText.length > headerLimit,
      ),
    );
    res.setHeader("x-transcript", encodeURIComponent(transcriptHeader));
    res.setHeader("x-translation", encodeURIComponent(translationHeader));

    res.setHeader("Content-Type", guessAudioContentType(responseFormat));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="translated.${responseFormat}"`,
    );
    res.statusCode = 200;
    res.end(buffer);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error:
          err instanceof Error
            ? err.message
            : "Server error processing audio.",
      }),
    );
  } finally {
    if (tmpPath) {
      try {
        await fsp.rm(tmpPath, { force: true });
      } catch {
        // ignore
      }
    }
  }
};

