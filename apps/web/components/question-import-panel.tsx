
"use client";

import { useState } from "react";

type ImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
};

type ImportRow = {
  id: string;
  rowNumber: number;
  status: string;
  rawData?: Record<string, unknown>;
  errorMessages?: string[] | string;
};

const PAGE_SIZE = 100;

export default function QuestionImportPanel() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadRows(id: string, pageNumber = 1) {
    const response = await fetch(
      `/api/imports/${id}/rows?page=${pageNumber}&limit=${PAGE_SIZE}`,
      { cache: "no-store" },
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Import rows load failed.");
    }

    setRows(Array.isArray(result.data) ? result.data : []);
    setPage(pageNumber);

    const pages = Number(result.pagination?.totalPages);
    setTotalPages(Number.isFinite(pages) && pages > 0 ? pages : 1);
  }

  async function previewImport() {
    if (!file) {
      setError("প্রথমে একটি Excel, CSV অথবা JSON ফাইল নির্বাচন করুন।");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setSummary(null);
    setRows([]);
    setSelectedIds([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/imports/preview", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Preview তৈরি করা যায়নি।");
      }

      const id = result.data?.batch?.id;

      if (!id) {
        throw new Error("Import batch ID পাওয়া যায়নি।");
      }

      setBatchId(id);
      setSummary(result.data.summary);
      await loadRows(id, 1);
      setMessage("ফাইল Preview সফলভাবে তৈরি হয়েছে।");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Import Preview ব্যর্থ হয়েছে।",
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? [...current, id]
        : current.filter((item) => item !== id),
    );
  }

  function selectAllValid() {
    const validIds = rows
      .filter((row) => row.status === "VALID")
      .map((row) => row.id);

    setSelectedIds((current) =>
      Array.from(new Set([...current, ...validIds])),
    );
  }

  async function performAction(action: "commit" | "skip") {
    if (!batchId || selectedIds.length === 0) {
      setError("অন্তত একটি Row নির্বাচন করুন।");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/imports/${batchId}/${action}`,
        {
          method: action === "commit" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rowIds: selectedIds }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Operation failed.");
      }

      setSelectedIds([]);
      setMessage(
        action === "commit"
          ? `${result.data?.importedRows ?? 0}টি প্রশ্ন Import হয়েছে।`
          : `${result.data?.skippedRows ?? selectedIds.length}টি Row Skip হয়েছে।`,
      );

      await loadRows(batchId, page);

      const batchResponse = await fetch(`/api/imports/${batchId}`, {
        cache: "no-store",
      });

      const batchResult = await batchResponse.json();

      if (batchResult.success && batchResult.data?.summary) {
        setSummary(batchResult.data.summary);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Operation সম্পন্ন হয়নি।",
      );
    } finally {
      setLoading(false);
    }
  }

  function getErrors(row: ImportRow): string[] {
    if (Array.isArray(row.errorMessages)) return row.errorMessages;
    if (typeof row.errorMessages === "string") {
      return [row.errorMessages];
    }
    return [];
  }

  function closePanel() {
    if (loading) return;

    setOpen(false);
    setFile(null);
    setBatchId("");
    setSummary(null);
    setRows([]);
    setSelectedIds([]);
    setPage(1);
    setTotalPages(1);
    setMessage("");
    setError("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        ↑ Import Questions
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-5 text-gray-900 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Bulk Question Import
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Excel, CSV অথবা JSON ফাইল Upload করুন।
                </p>
              </div>

              <button
                type="button"
                onClick={closePanel}
                disabled={loading}
                className="rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-100"
              >
                ✕ বন্ধ
              </button>
            </div>

            <div className="rounded-lg border border-dashed border-gray-300 p-5">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                disabled={loading}
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
                className="block w-full text-sm"
              />

              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {file.name}
                </p>
              )}

              <button
                type="button"
                onClick={previewImport}
                disabled={!file || loading}
                className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Processing..." : "Upload & Preview"}
              </button>

              <p className="mt-2 text-xs text-gray-500">
                সর্বোচ্চ ফাইল সাইজ 10 MB এবং সর্বোচ্চ 10,000 Rows।
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {message && (
              <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                {message}
              </div>
            )}

            {summary && (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ["Total", summary.totalRows],
                    ["Valid", summary.validRows],
                    ["Invalid", summary.invalidRows],
                    ["Duplicate", summary.duplicateRows],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border p-4"
                    >
                      <p className="text-sm text-gray-500">{label}</p>
                      <p className="mt-1 text-2xl font-bold">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllValid}
                    disabled={loading}
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Select Valid Rows
                  </button>

                  <button
                    type="button"
                    onClick={() => performAction("commit")}
                    disabled={
                      loading ||
                      selectedIds.length === 0 ||
                      !rows.some(
                        (row) =>
                          row.status === "VALID" &&
                          selectedIds.includes(row.id),
                      )
                    }
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Commit Selected
                  </button>

                  <button
                    type="button"
                    onClick={() => performAction("skip")}
                    disabled={loading || selectedIds.length === 0}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
                  >
                    Skip Selected
                  </button>

                  <a
                    href={`/api/imports/${batchId}/error-report?format=csv`}
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Download Error Report
                  </a>
                </div>

                <div className="mt-5 overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[750px] text-left text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-3">Select</th>
                        <th className="p-3">Row</th>
                        <th className="p-3">Question</th>
                        <th className="p-3">Subject / Topic</th>
                        <th className="p-3">Status / Errors</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((row) => {
                        const raw = row.rawData ?? {};
                        const errors = getErrors(row);
                        const selectable = [
                          "VALID",
                          "INVALID",
                          "DUPLICATE",
                        ].includes(row.status);

                        return (
                          <tr key={row.id} className="border-t align-top">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(row.id)}
                                disabled={!selectable || loading}
                                onChange={(event) =>
                                  toggleRow(row.id, event.target.checked)
                                }
                              />
                            </td>

                            <td className="p-3">{row.rowNumber}</td>

                            <td className="max-w-sm whitespace-normal p-3">
                              {String(raw.questionText ?? "—")}
                            </td>

                            <td className="p-3">
                              {String(raw.subject ?? "—")}
                              <br />
                              <span className="text-gray-500">
                                {String(raw.topic ?? "—")}
                              </span>
                            </td>

                            <td className="p-3">
                              <span className="font-semibold">
                                {row.status}
                              </span>

                              {errors.length > 0 && (
                                <ul className="mt-1 list-inside list-disc text-xs text-red-600">
                                  {errors.map((item, index) => (
                                    <li key={index}>{item}</li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-6 text-center text-gray-500"
                          >
                            এই পেজে কোনো Row পাওয়া যায়নি।
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 1 || loading}
                      onClick={() => loadRows(batchId, page - 1)}
                      className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                    >
                      Previous
                    </button>

                    <button
                      type="button"
                      disabled={page >= totalPages || loading}
                      onClick={() => loadRows(batchId, page + 1)}
                      className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
