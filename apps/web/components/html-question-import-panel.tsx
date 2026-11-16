"use client";

import { useState } from "react";

type PreviewResult = {
  success?: boolean;
  message?: string;
  data?: {
    batch?: { id?: string; status?: string };
    summary?: {
      totalRows?: number;
      validRows?: number;
      invalidRows?: number;
      duplicateRows?: number;
    };
  };
  parser?: {
    detectedStructure?: string;
    totalCandidates?: number;
    extractedCount?: number;
    skippedCount?: number;
    warnings?: string[];
  };
};

export default function HtmlQuestionImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PreviewResult | null>(null);

  async function previewHtml() {
    if (!file) {
      setError("প্রথমে একটি HTML ফাইল নির্বাচন করুন।");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/imports/html/preview", {
        method: "POST",
        body: formData,
        cache: "no-store",
      });

      const data = (await response.json()) as PreviewResult;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "HTML Preview তৈরি করা যায়নি।");
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "HTML Import failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          HTML Question Import
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Saved HTML বা HTM ফাইল থেকে প্রশ্ন শনাক্ত করে Import Preview তৈরি করুন।
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="file"
          accept=".html,.htm,.xhtml,text/html"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
            setError("");
          }}
          className="block w-full rounded-lg border border-slate-300 p-3 text-sm"
        />

        {file && (
          <p className="break-all text-xs text-slate-500">
            নির্বাচিত ফাইল: {file.name}
          </p>
        )}

        <button
          type="button"
          onClick={previewHtml}
          disabled={!file || loading}
          className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "প্রসেস হচ্ছে..." : "Upload & Preview HTML"}
        </button>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-800">
              {result.message || "HTML Preview তৈরি হয়েছে।"}
            </p>

            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div>
                <p className="text-slate-500">মোট প্রশ্ন</p>
                <p className="text-xl font-bold">{result.data?.summary?.totalRows ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">Valid</p>
                <p className="text-xl font-bold text-emerald-700">{result.data?.summary?.validRows ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">Invalid</p>
                <p className="text-xl font-bold text-red-700">{result.data?.summary?.invalidRows ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">Duplicate</p>
                <p className="text-xl font-bold">{result.data?.summary?.duplicateRows ?? 0}</p>
              </div>
            </div>

            {result.data?.batch?.id && (
              <p className="break-all text-xs text-slate-600">
                Batch ID: {result.data.batch.id}
              </p>
            )}

            {result.parser && (
              <div className="border-t border-emerald-200 pt-3 text-sm">
                <p>Detected structure: {result.parser.detectedStructure || "Unknown"}</p>
                <p>Extracted: {result.parser.extractedCount ?? 0}</p>
                <p>Skipped: {result.parser.skippedCount ?? 0}</p>
                {result.parser.warnings && result.parser.warnings.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-amber-800">
                    {result.parser.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
