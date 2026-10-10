"use client";

import { useEffect, useState } from "react";

type ScanResult = {
  prescription: unknown | null;
  source: "ai" | "demo" | "failed";
  error?: string;
};

const MAX_DIMENSION = 1600;

async function resizeImage(file: File): Promise<{
  imageBase64: string;
  mimeType: "image/jpeg";
}> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("This image could not be prepared for scanning.");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Image conversion failed."))),
      "image/jpeg",
      0.85,
    );
  });

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Image conversion failed."));
    reader.onerror = () => reject(new Error("Image conversion failed."));
    reader.readAsDataURL(blob);
  });

  return {
    imageBase64: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mimeType: "image/jpeg",
  };
}

export default function TestPage() {
  const [demoMode, setDemoMode] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/scan", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Mode status unavailable.");
        const status = await response.json();
        if (typeof status.demoMode !== "boolean") throw new Error("Invalid mode status.");
        if (!controller.signal.aborted) setDemoMode(status.demoMode);
      })
      .catch(() => {
        if (!controller.signal.aborted) setModeError("Demo mode status could not be checked.");
      });
    return () => controller.abort();
  }, []);

  async function scan() {
    if (!file || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resized = await resizeImage(file);
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resized),
      });
      const payload = (await response.json()) as ScanResult;
      setResult(payload);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Scan could not be completed.";
      setError(message);
      setResult({ prescription: null, source: "failed", error: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Prescription scan test</h1>
      {(demoMode || result?.source === "demo") && (
        <p style={{ fontSize: "0.75rem", margin: "0.25rem 0" }}>Demo mode</p>
      )}
      {modeError && <p role="alert">{modeError}</p>}
      <label htmlFor="prescription-image">Prescription image</label>{" "}
      <input
        id="prescription-image"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          setFile(event.currentTarget.files?.[0] ?? null);
          setResult(null);
          setError(null);
        }}
      />{" "}
      <button type="button" onClick={scan} disabled={!file || loading}>
        {loading ? "Scanning…" : "Scan"}
      </button>
      {loading && <p role="status">Scanning prescription…</p>}
      {error && <p role="alert">{error}</p>}
      {result && (
        <section aria-live="polite">
          <h2>Source: {result.source}</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
