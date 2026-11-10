
"use client";

import { useState } from "react";

type ImportBatch = {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  createdAt: string;
  completedAt?: string | null;
  rolledBackAt?: string | null;
  _count?: {
    rows: number;
  };
};

type ImportRow = {
  id: string;
  rowNumber: number;
  status: string;
  rawData?: Record<string, unknown> | null;
  errorMessages?: unknown;
  questionId?: string | null;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export default function QuestionImportHistory() {
  const [open, setOpen] = useState(false);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selected, setSelected] = useState<ImportBatch | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadHistory(targetPage = 1) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/imports?page=${targetPage}&limit=20`,
        { cache: "no-store" },
      );

      const result: ApiResponse<ImportBatch[]> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Import History load failed.");
      }

      setBatches(result.data || []);
      setPage(result.pagination?.page || targetPage);
      setTotalPages(Math.max(1, result.pagination?.totalPages || 1));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function openHistory() {
    setOpen(true);
    setSelected(null);
    setRows([]);
    setSuccess("");
    await loadHistory(1);
  }

  async function viewDetails(batch: ImportBatch) {
    setSelected(batch);
    setRows([]);
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(
        `/api/imports/${batch.id}/rows?page=1&limit=20`,
        { cache: "no-store" },
      );

      const result: ApiResponse<ImportRow[]> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not load import rows.");
      }

      setRows(result.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load import rows.",
      );
    } finally {
      setLoading(false);
    }
  }

  function closeHistory() {
    if (rollingBack) return;

    setOpen(false);
    setSelected(null);
    setRows([]);
    setError("");
    setSuccess("");
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("bn-BD");
  }

  function getErrors(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }

    if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value);

        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item));
        }

        return [value];
      } catch {
        return [value];
      }
    }

    return [];
  }

  async function rollbackBatch(batch: ImportBatch) {
    if (batch.status !== "COMPLETED" || batch.rolledBackAt) {
      return;
    }

    const confirmed = window.confirm(
      `আপনি কি নিশ্চিত?\n\n"${batch.fileName}" Batch থেকে Import করা প্রশ্নগুলো Rollback করা হবে। এই কাজটি পুনরায় করা যাবে না।`,
    );

    if (!confirmed) return;

    setRollingBack(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/imports/${batch.id}/rollback`,
        {
          method: "POST",
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Rollback failed.");
      }

      setSuccess(result.message || "Import Batch successfully rolled back.");

      // Refresh batch details from backend.
      const detailResponse = await fetch(
        `/api/imports/${batch.id}`,
        { cache: "no-store" },
      );

      const detailResult: ApiResponse<ImportBatch> =
        await detailResponse.json();

      if (!detailResponse.ok || !detailResult.success) {
        throw new Error(
          detailResult.message || "Rollback completed, but refresh failed.",
        );
      }

      setSelected(detailResult.data);

      // Refresh import rows.
      const rowsResponse = await fetch(
        `/api/imports/${batch.id}/rows?page=1&limit=20`,
        { cache: "no-store" },
      );

      const rowsResult: ApiResponse<ImportRow[]> =
        await rowsResponse.json();

      if (rowsResponse.ok && rowsResult.success) {
        setRows(rowsResult.data || []);
      }

      // Refresh history list.
      const historyResponse = await fetch(
        `/api/imports?page=${page}&limit=20`,
        { cache: "no-store" },
      );

      const historyResult: ApiResponse<ImportBatch[]> =
        await historyResponse.json();

      if (historyResponse.ok && historyResult.success) {
        setBatches(historyResult.data || []);
        setTotalPages(
          Math.max(1, historyResult.pagination?.totalPages || 1),
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Rollback failed.",
      );
    } finally {
      setRollingBack(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openHistory}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
      >
        Import History
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">
                Import History
              </h2>

              <button
                type="button"
                onClick={closeHistory}
                disabled={rollingBack}
                className="rounded-lg px-3 py-2 hover:bg-gray-100 disabled:opacity-50"
              >
                ✕ Close
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                {success}
              </div>
            )}

            {selected ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setRows([]);
                    setError("");
                    setSuccess("");
                  }}
                  disabled={rollingBack}
                  className="mb-4 text-sm font-semibold text-blue-600 disabled:opacity-50"
                >
                  ← Back to History
                </button>

                <div className="mb-4 rounded-lg border p-4">
                  <h3 className="font-bold">{selected.fileName}</h3>

                  <p className="mt-1 break-all text-xs text-gray-500">
                    Batch ID: {selected.id}
                  </p>

                  <p className="mt-2 text-sm">
                    Status: <strong>{selected.status}</strong>
                    {" · "}Type: {selected.fileType}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Created: {formatDate(selected.createdAt)}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                    {[
                      ["Total", selected.totalRows],
                      ["Valid", selected.validRows],
                      ["Invalid", selected.invalidRows],
                      ["Duplicate", selected.duplicateRows],
                      ["Imported", selected.importedRows],
                      ["Skipped", selected.skippedRows],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-lg bg-gray-50 p-3"
                      >
                        <p className="text-xs text-gray-500">
                          {label}
                        </p>
                        <p className="text-xl font-bold">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {(selected.invalidRows > 0 ||
                    selected.duplicateRows > 0) && (
                    <a
                      href={`/api/imports/${selected.id}/error-report?format=csv`}
                      className="mt-4 inline-block rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      Download Error Report
                    </a>
                  )}

                  {selected.rolledBackAt && (
                    <p className="mt-3 text-sm text-red-600">
                      Rolled back: {formatDate(selected.rolledBackAt)}
                    </p>
                  )}

                  {selected.status === "COMPLETED" &&
                    !selected.rolledBackAt && (
                      <button
                        type="button"
                        onClick={() => rollbackBatch(selected)}
                        disabled={rollingBack || loading}
                        className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {rollingBack
                          ? "Rolling Back..."
                          : "Rollback Imported Questions"}
                      </button>
                    )}
                </div>

                <h3 className="mb-3 font-semibold">
                  Import Rows
                </h3>

                {loading ? (
                  <p className="p-5 text-center text-gray-500">
                    Loading rows...
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[650px] text-left text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3">Row</th>
                          <th className="p-3">Question</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Errors</th>
                        </tr>
                      </thead>

                      <tbody>
                        {rows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t align-top"
                          >
                            <td className="p-3">
                              {row.rowNumber}
                            </td>

                            <td className="max-w-sm whitespace-normal p-3">
                              {String(
                                row.rawData?.questionText ?? "—",
                              )}
                            </td>

                            <td className="p-3 font-semibold">
                              {row.status}
                            </td>

                            <td className="p-3 text-xs text-red-600">
                              {getErrors(row.errorMessages).join(", ") || "—"}
                            </td>
                          </tr>
                        ))}

                        {rows.length === 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="p-5 text-center text-gray-500"
                            >
                              No rows found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => loadHistory(page)}
                    disabled={loading}
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    ↻ Refresh
                  </button>
                </div>

                {loading ? (
                  <p className="p-8 text-center text-gray-500">
                    Loading Import History...
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3">File Name</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Total</th>
                          <th className="p-3">Valid</th>
                          <th className="p-3">Invalid</th>
                          <th className="p-3">Duplicate</th>
                          <th className="p-3">Imported</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Details</th>
                        </tr>
                      </thead>

                      <tbody>
                        {batches.map((batch) => (
                          <tr
                            key={batch.id}
                            className="border-t"
                          >
                            <td className="max-w-[200px] break-words p-3 font-medium">
                              {batch.fileName}
                              <p className="text-xs text-gray-500">
                                {batch.fileType}
                              </p>
                            </td>

                            <td className="p-3">
                              {batch.status}
                            </td>

                            <td className="p-3">
                              {batch.totalRows}
                            </td>

                            <td className="p-3">
                              {batch.validRows}
                            </td>

                            <td className="p-3">
                              {batch.invalidRows}
                            </td>

                            <td className="p-3">
                              {batch.duplicateRows}
                            </td>

                            <td className="p-3">
                              {batch.importedRows}
                            </td>

                            <td className="whitespace-nowrap p-3">
                              {formatDate(batch.createdAt)}
                            </td>

                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => viewDetails(batch)}
                                className="font-semibold text-blue-600 hover:underline"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}

                        {batches.length === 0 && (
                          <tr>
                            <td
                              colSpan={9}
                              className="p-8 text-center text-gray-500"
                            >
                              No Import History found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 1 || loading}
                      onClick={() => loadHistory(page - 1)}
                      className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                    >
                      Previous
                    </button>

                    <button
                      type="button"
                      disabled={page >= totalPages || loading}
                      onClick={() => loadHistory(page + 1)}
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
