"use client";

import { useState } from "react";
import type {
  LabOrder,
  Medication,
  MedicationOrderStatus,
  Prescription,
  Problem,
} from "@/lib/types";

type ScanResponse =
  | { prescription: Prescription; source: "ai" }
  | { source: "failed"; error: string };

type AnalyzeResponse =
  | { problems: Problem[]; source: "ai" }
  | { source: "failed"; error: string };

const MAX_DIMENSION = 2400;
const IDENTIFIERS_STORAGE_KEY = "pharmamrp:last-scan-identifiers:v1";

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

function maskPatientName(value: string | null): string {
  if (!value) return "Not found";
  return value
    .trim()
    .split(/\s+/)
    .map((word) => `${word.slice(0, 2)}***`)
    .join(" ");
}

function maskFileNumber(value: string | null): string {
  if (!value) return "Not found";
  return "••••";
}

function displayedScanJson(
  response: ScanResponse,
  identifiersVisible: boolean,
): ScanResponse {
  if (response.source === "failed" || identifiersVisible) return response;

  return {
    ...response,
    prescription: {
      ...response.prescription,
      patientName: maskPatientName(response.prescription.patientName),
      fileNumber: maskFileNumber(response.prescription.fileNumber),
    },
  };
}

export default function TestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [scanResponse, setScanResponse] = useState<ScanResponse | null>(null);
  const [analyzeResponse, setAnalyzeResponse] = useState<AnalyzeResponse | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [identifiersVisible, setIdentifiersVisible] = useState(false);
  const [detailsConfirmed, setDetailsConfirmed] = useState(false);

  function clearSavedIdentifiers() {
    try {
      window.localStorage.removeItem(IDENTIFIERS_STORAGE_KEY);
      setStorageNotice(null);
    } catch {
      setStorageNotice("Saved identifiers could not be cleared from this browser.");
    }
  }

  function updateMedication<K extends keyof Medication>(
    index: number,
    key: K,
    value: Medication[K],
  ) {
    setPrescription((current) =>
      current
        ? {
            ...current,
            medications: current.medications.map((medication, medicationIndex) =>
              medicationIndex === index
                ? { ...medication, [key]: value }
                : medication,
            ),
          }
        : current,
    );
    setDetailsConfirmed(false);
    setAnalyzeResponse(null);
    setAnalyzeError(null);
  }

  function updateLabOrder<K extends keyof LabOrder>(
    index: number,
    key: K,
    value: LabOrder[K],
  ) {
    setPrescription((current) =>
      current
        ? {
            ...current,
            labOrders: current.labOrders.map((order, orderIndex) =>
              orderIndex === index ? { ...order, [key]: value } : order,
            ),
          }
        : current,
    );
    setDetailsConfirmed(false);
    setAnalyzeResponse(null);
    setAnalyzeError(null);
  }

  async function scan() {
    if (!file || scanLoading || analyzeLoading) return;

    clearSavedIdentifiers();
    setPrescription(null);
    setScanResponse(null);
    setAnalyzeResponse(null);
    setScanError(null);
    setAnalyzeError(null);
    setIdentifiersVisible(false);
    setDetailsConfirmed(false);
    setScanLoading(true);

    try {
      const resized = await resizeImage(file);
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resized),
      });
      const payload = (await response.json()) as ScanResponse;
      setScanResponse(payload);

      if (payload.source === "failed") {
        setScanError(payload.error);
        return;
      }

      setPrescription(payload.prescription);
      try {
        window.localStorage.setItem(
          IDENTIFIERS_STORAGE_KEY,
          JSON.stringify({
            patientName: payload.prescription.patientName,
            fileNumber: payload.prescription.fileNumber,
          }),
        );
        setStorageNotice(null);
      } catch {
        setStorageNotice(
          "Identifiers could not be saved locally. They are available only until you leave this page.",
        );
      }
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Scan could not be completed.";
      setScanError(message);
      setScanResponse({ source: "failed", error: message });
    } finally {
      setScanLoading(false);
    }
  }

  async function analyze() {
    if (!prescription || !detailsConfirmed || analyzeLoading || scanLoading) return;

    setAnalyzeLoading(true);
    setAnalyzeError(null);
    setAnalyzeResponse(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medications: prescription.medications.map((medication) => ({
            id: medication.id,
            name: medication.name,
            genericName: medication.genericName,
            dose: medication.dose,
            unit: medication.unit,
            frequency: medication.frequency,
            route: medication.route,
            duration: medication.duration,
            confidence: medication.confidence,
            conditions: medication.conditions,
            startDate: medication.startDate,
            orderStatus: medication.orderStatus,
            sourceText: medication.sourceText,
          })),
          labOrders: prescription.labOrders.map((order) => ({
            test: order.test,
            date: order.date,
            sourceText: order.sourceText,
          })),
          ward: prescription.ward,
          patientAge: prescription.patientAge,
          patientGender: prescription.patientGender,
        }),
      });
      const payload = (await response.json()) as AnalyzeResponse;
      setAnalyzeResponse(payload);
      if (payload.source === "failed") {
        setAnalyzeError(payload.error);
      }
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Analysis could not be completed.";
      setAnalyzeError(message);
      setAnalyzeResponse({ source: "failed", error: message });
    } finally {
      setAnalyzeLoading(false);
    }
  }

  const isBusy = scanLoading || analyzeLoading;

  return (
    <main>
      <h1>Prescription scan test</h1>
      <label htmlFor="prescription-image">Prescription image</label>{" "}
      <input
        id="prescription-image"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          setFile(event.currentTarget.files?.[0] ?? null);
          setPrescription(null);
          setScanResponse(null);
          setAnalyzeResponse(null);
          setScanError(null);
          setAnalyzeError(null);
          setDetailsConfirmed(false);
          setIdentifiersVisible(false);
          clearSavedIdentifiers();
        }}
      />{" "}
      <button type="button" onClick={scan} disabled={!file || isBusy}>
        {scanLoading ? "Scanning…" : "Scan"}
      </button>
      {scanLoading && <p role="status">Scanning prescription…</p>}
      {scanError && <p role="alert">{scanError}</p>}

      {prescription && (
        <>
          <section aria-labelledby="identifiers-heading">
            <h2 id="identifiers-heading">Patient identifiers</h2>
            <p>
              <strong>Patient name:</strong>{" "}
              {identifiersVisible
                ? prescription.patientName || "Not found"
                : maskPatientName(prescription.patientName)}
            </p>
            <p>
              <strong>File number:</strong>{" "}
              {identifiersVisible
                ? prescription.fileNumber || "Not found"
                : maskFileNumber(prescription.fileNumber)}
            </p>
            <p>Identifier confidence: {prescription.identifierConfidence ?? "unknown"}</p>
            <button
              type="button"
              onClick={() => setIdentifiersVisible((visible) => !visible)}
            >
              {identifiersVisible ? "Hide identifiers" : "Show identifiers"}
            </button>
            {storageNotice && <p role="status">{storageNotice}</p>}
          </section>

          <section aria-labelledby="medications-heading">
            <h2 id="medications-heading">Medications</h2>
            {prescription.medications.length === 0 ? (
              <p>No medications were extracted.</p>
            ) : (
              prescription.medications.map((medication, index) => (
                <fieldset key={medication.id}>
                  <legend>
                    Medication {index + 1}{" "}
                    {medication.confidence === "low" && (
                      <strong>Low confidence — verify this row</strong>
                    )}
                    {medication.confidence === null && <strong>Confidence unknown</strong>}
                  </legend>
                  <p>
                    <strong>Source text:</strong>{" "}
                    <q>{medication.sourceText ?? "Unknown"}</q>
                  </p>
                  <label>
                    Name{" "}
                    <input
                      value={medication.name ?? ""}
                      onChange={(event) =>
                        updateMedication(index, "name", event.currentTarget.value || null)
                      }
                    />
                  </label>{" "}
                  <label>
                    Generic name{" "}
                    <input
                      value={medication.genericName ?? ""}
                      onChange={(event) =>
                        updateMedication(
                          index,
                          "genericName",
                          event.currentTarget.value || null,
                        )
                      }
                    />
                  </label>{" "}
                  <label>
                    Dose{" "}
                    <input
                      value={medication.dose ?? ""}
                      onChange={(event) =>
                        updateMedication(index, "dose", event.currentTarget.value || null)
                      }
                    />
                  </label>{" "}
                  <label>
                    Unit{" "}
                    <input
                      value={medication.unit ?? ""}
                      onChange={(event) =>
                        updateMedication(index, "unit", event.currentTarget.value || null)
                      }
                    />
                  </label>{" "}
                  <label>
                    Frequency{" "}
                    <input
                      value={medication.frequency ?? ""}
                      onChange={(event) =>
                        updateMedication(
                          index,
                          "frequency",
                          event.currentTarget.value || null,
                        )
                      }
                    />
                  </label>{" "}
                  <label>
                    Route{" "}
                    <input
                      value={medication.route ?? ""}
                      onChange={(event) =>
                        updateMedication(index, "route", event.currentTarget.value || null)
                      }
                    />
                  </label>{" "}
                  <label>
                    Duration{" "}
                    <input
                      value={medication.duration ?? ""}
                      onChange={(event) =>
                        updateMedication(
                          index,
                          "duration",
                          event.currentTarget.value || null,
                        )
                      }
                    />
                  </label>{" "}
                  <label>
                    Start date{" "}
                    <input
                      value={medication.startDate ?? ""}
                      onChange={(event) =>
                        updateMedication(
                          index,
                          "startDate",
                          event.currentTarget.value || null,
                        )
                      }
                    />
                  </label>{" "}
                  <label>
                    Conditions (separate with semicolons){" "}
                    <input
                      value={medication.conditions?.join("; ") ?? ""}
                      onChange={(event) => {
                        const conditions = event.currentTarget.value
                          .split(";")
                          .map((condition) => condition.trim())
                          .filter(Boolean);
                        updateMedication(index, "conditions", conditions.length ? conditions : null);
                      }}
                    />
                  </label>{" "}
                  <label>
                    Confidence{" "}
                    <select
                      value={medication.confidence ?? ""}
                      onChange={(event) =>
                        updateMedication(
                          index,
                          "confidence",
                          event.currentTarget.value === "high" ||
                            event.currentTarget.value === "low"
                            ? event.currentTarget.value
                            : null,
                        )
                      }
                    >
                      <option value="">Unknown</option>
                      <option value="high">High</option>
                      <option value="low">Low</option>
                    </select>
                  </label>{" "}
                  <label>
                    Order status{" "}
                    <select
                      value={medication.orderStatus}
                      onChange={(event) =>
                        updateMedication(
                          index,
                          "orderStatus",
                          event.currentTarget.value as MedicationOrderStatus,
                        )
                      }
                    >
                      <option value="active">Active</option>
                      <option value="stopped">Stopped</option>
                      <option value="modified">Modified</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </label>
                </fieldset>
              ))
            )}
          </section>

          <section aria-labelledby="labs-heading">
            <h2 id="labs-heading">Lab orders</h2>
            {prescription.labOrders.length === 0 ? (
              <p>No lab orders were extracted.</p>
            ) : (
              prescription.labOrders.map((order, index) => (
                <fieldset key={`${order.sourceText}-${index}`}>
                  <legend>Lab order {index + 1}</legend>
                  <p>
                    <strong>Source text:</strong> <q>{order.sourceText ?? "Unknown"}</q>
                  </p>
                  <label>
                    Test{" "}
                    <input
                      value={order.test ?? ""}
                      onChange={(event) =>
                        updateLabOrder(index, "test", event.currentTarget.value || null)
                      }
                    />
                  </label>{" "}
                  <label>
                    Date{" "}
                    <input
                      value={order.date ?? ""}
                      onChange={(event) =>
                        updateLabOrder(index, "date", event.currentTarget.value || null)
                      }
                    />
                  </label>
                </fieldset>
              ))
            )}
          </section>

          <label>
            <input
              type="checkbox"
              checked={detailsConfirmed}
              onChange={(event) => setDetailsConfirmed(event.currentTarget.checked)}
            />{" "}
            I have checked and confirmed the medication and lab details.
          </label>{" "}
          <button
            type="button"
            onClick={analyze}
            disabled={!detailsConfirmed || isBusy}
          >
            {analyzeLoading ? "Analyzing…" : "Analyze"}
          </button>
          {analyzeLoading && <p role="status">Analyzing confirmed orders…</p>}
          {analyzeError && <p role="alert">{analyzeError}</p>}
        </>
      )}

      {scanResponse && (
        <details>
          <summary>Raw scan JSON — source: {scanResponse.source}</summary>
          {!identifiersVisible && <p>Identifiers are masked here by default.</p>}
          <pre>
            {JSON.stringify(
              displayedScanJson(scanResponse, identifiersVisible),
              null,
              2,
            )}
          </pre>
        </details>
      )}
      {analyzeResponse && (
        <details>
          <summary>Raw analyze JSON — source: {analyzeResponse.source}</summary>
          <pre>{JSON.stringify(analyzeResponse, null, 2)}</pre>
        </details>
      )}
    </main>
  );
}
