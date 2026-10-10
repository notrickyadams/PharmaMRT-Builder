import { GoogleGenAI } from "@google/genai";
import { GEMINI_PROVIDER } from "@/lib/config";

export const REQUEST_TIMEOUT_MS = 15_000;

export function createGeminiClient() {
  const managed = GEMINI_PROVIDER === "managed";
  const apiKey = managed
    ? process.env.AI_INTEGRATIONS_GEMINI_API_KEY
    : process.env.GEMINI_API_KEY;
  const baseUrl = managed ? process.env.AI_INTEGRATIONS_GEMINI_BASE_URL : undefined;
  if (!apiKey || (managed && !baseUrl)) throw new Error("Gemini is not configured.");
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      ...(managed ? { baseUrl, apiVersion: "" } : {}),
      timeout: REQUEST_TIMEOUT_MS,
      retryOptions: { attempts: 1 },
    },
  });
}

// The integration documents responseMimeType, but not responseSchema support.
// Use an explicit JSON contract on managed calls, not a speculative schema
// request followed by a second billed attempt. Zod remains authoritative.
export function jsonContract(schema: unknown) {
  return GEMINI_PROVIDER === "managed"
    ? ` Return only one JSON object, without markdown or additional fields. All required fields must be present. Follow this JSON field/type/enum contract exactly (nullable means the value may be null): ${JSON.stringify(schema)}`
    : "";
}

export function structuredOutput<T>(schema: T) {
  return {
    responseMimeType: "application/json",
    ...(GEMINI_PROVIDER === "personal" ? { responseSchema: schema } : {}),
  };
}

// Bound the body while reading, even when Content-Length is absent or incorrect.
// Check the deadline before returning so a timed-out upload cannot start a call.
export async function readBoundedJson(request: Request, maxBytes: number, signal: AbortSignal) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    throw new Error("Invalid request size.");
  }
  if (!request.body) throw new Error("Missing request body.");
  const reader = request.body.getReader();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) throw new Error("Invalid request size.");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks, length).toString("utf8")) as unknown;
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
