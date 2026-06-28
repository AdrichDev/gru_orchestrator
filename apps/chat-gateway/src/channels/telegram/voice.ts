import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { pipeline } from "@huggingface/transformers";

const TELEGRAM_API = "https://api.telegram.org";
// Multilingual Whisper (handles Spanish). Override via env if desired.
const MODEL = process.env.TELEGRAM_WHISPER_MODEL?.trim() || "Xenova/whisper-base";

type Transcriber = (
  audio: Float32Array,
  opts?: Record<string, unknown>,
) => Promise<{ text?: string } | Array<{ text?: string }>>;

// Lazy singleton: the model (~100MB) downloads on first voice note, then caches.
let asrPromise: Promise<Transcriber> | null = null;
function getTranscriber(): Promise<Transcriber> {
  if (!asrPromise) {
    asrPromise = pipeline("automatic-speech-recognition", MODEL) as unknown as Promise<Transcriber>;
  }
  return asrPromise;
}

async function downloadVoiceFile(token: string, fileId: string): Promise<string> {
  const metaRes = await fetch(`${TELEGRAM_API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!metaRes.ok) throw new Error(`getFile ${metaRes.status}`);
  const meta = (await metaRes.json()) as { ok: boolean; result?: { file_path?: string } };
  const filePath = meta.result?.file_path;
  if (!filePath) throw new Error("getFile returned no file_path");

  // NOTE: Telegram's file API requires the bot token in the URL path (unavoidable
  // per their API). Keep this URL out of logs; only HTTP status is logged below.
  const dlRes = await fetch(`${TELEGRAM_API}/file/bot${token}/${filePath}`);
  if (!dlRes.ok) throw new Error(`file download ${dlRes.status}`);
  const buf = Buffer.from(await dlRes.arrayBuffer());

  const tmp = path.join(os.tmpdir(), `tg-voice-${Date.now()}-${Math.random().toString(36).slice(2)}.ogg`);
  await fs.writeFile(tmp, buf);
  return tmp;
}

/** Decode any audio file to mono 16 kHz float32 PCM via the bundled ffmpeg. */
function decodeToFloat32(inputPath: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    // ffmpeg-static exports the binary path as its default (a string at runtime);
    // its bundled types misrepresent it as a namespace, so cast through unknown.
    const bin = ffmpegPath as unknown as string | null;
    if (!bin) {
      reject(new Error("ffmpeg-static binary not found"));
      return;
    }
    const ff = spawn(bin, ["-i", inputPath, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    // Cap decoded PCM to bound memory (16kHz mono f32 ≈ 64KB/s → 64MB ≈ 17 min).
    const MAX_PCM_BYTES = 64 * 1024 * 1024;
    let outBytes = 0;
    ff.stdout.on("data", (c: Buffer) => {
      outBytes += c.length;
      if (outBytes > MAX_PCM_BYTES) {
        ff.kill("SIGKILL");
        reject(new Error("audio too long: decoded PCM exceeds 64MB cap"));
        return;
      }
      out.push(c);
    });
    ff.stderr.on("data", (c: Buffer) => err.push(c));
    ff.on("error", reject);
    ff.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(err).toString().slice(-300)}`));
        return;
      }
      const buf = Buffer.concat(out);
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      resolve(new Float32Array(ab));
    });
  });
}

/**
 * Download a Telegram voice/audio file and transcribe it locally (no cloud).
 * Returns the recognized text (trimmed; "" if nothing was recognized).
 */
export async function transcribeVoice(token: string, fileId: string, language = "spanish"): Promise<string> {
  const oggPath = await downloadVoiceFile(token, fileId);
  try {
    const samples = await decodeToFloat32(oggPath);
    const transcriber = await getTranscriber();
    const result = await transcriber(samples, { language, task: "transcribe" });
    const text = Array.isArray(result) ? result[0]?.text : result.text;
    return (text ?? "").trim();
  } finally {
    await fs.rm(oggPath, { force: true });
  }
}
