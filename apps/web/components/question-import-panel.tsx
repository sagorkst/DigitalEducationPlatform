
"use client";

import { useEffect, useRef, useState } from "react";
import OcrQuestionImportPanel from "./ocr-question-import-panel";

type ImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
};

type HtmlParserSummary = {
  detectedStructure: string;
  totalCandidates: number;
  extractedCount: number;
  skippedCount: number;
  warnings: string[];
};

type ImportRow = {
  id: string;
  rowNumber: number;
  status: string;
  rawData?: Record<string, unknown>;
  errorMessages?: string[] | string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const PAGE_SIZE = 100;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv", ".json", ".html", ".htm", ".xhtml", ".mhtml", ".mht"];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusStyle(status: string) {
  switch (status) {
    case "VALID":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "INVALID":
      return "bg-red-50 text-red-700 ring-red-200";
    case "DUPLICATE":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "IMPORTED":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "SKIPPED":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

function getBatchSuggestions(rows: ImportRow[], field: string) {
  return Array.from(new Set(rows.map((row) => String(row.rawData?.[field] ?? "").trim()).filter(Boolean))).slice(0, 50);
}

function FileIcon({ type }: { type: string }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
      {type === "excel" ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M13 2v7h7M8 13l5 6m0-6-5 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      ) : type === "csv" ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M13 2v7h7M8 13h8M8 16h8M8 19h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M13 2v7h7M8 13h8M8 16h8M8 19h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

export default function QuestionImportPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [parserSummary, setParserSummary] = useState<HtmlParserSummary | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAllBatch, setSelectAllBatch] = useState(false);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [detailOverrides, setDetailOverrides] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [batchMetadata, setBatchMetadata] = useState({
    institution: "",
    examName: "",
    examYear: "",
    postName: "",
  });
  const [batchOverwriteExisting, setBatchOverwriteExisting] = useState(false);
  const [editingRowId, setEditingRowId] = useState("");
  const [editingData, setEditingData] = useState<Record<string, unknown> | null>(null);
  const [editingOptions, setEditingOptions] = useState<Array<{ label: string; optionText: string; isCorrect: boolean; sortOrder: number }>>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (editingData) document.getElementById("manual-question-edit-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editingData]);

  function validateFile(selectedFile: File | null) {
    if (!selectedFile) return;

    const extension = `.${selectedFile.name.split(".").pop()?.toLowerCase()}`;

    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setError("Excel, CSV, JSON অথবা HTML/MHTML ফাইল নির্বাচন করুন।");
      return;
    }

    const isHtml = [".html", ".htm", ".xhtml", ".mhtml", ".mht"].includes(extension);
    const maxSize = isHtml ? 5 * 1024 * 1024 : MAX_FILE_SIZE;
    if (selectedFile.size > maxSize) {
      setError(isHtml ? "HTML ফাইলের সর্বোচ্চ সাইজ ৫ MB।" : "ফাইলের সর্বোচ্চ সাইজ ১০ MB হতে পারবে।");
      return;
    }

    setFile(selectedFile);
    setError("");
    setMessage("");
    setSummary(null);
    setParserSummary(null);
    setRows([]);
    setBatchId("");
    setSelectedIds([]);
    setSelectAllBatch(false);
  }

  async function loadRows(id: string, _pageNumber = 1) {
    const firstResponse = await fetch(`/api/imports/${id}/rows?page=1&limit=${PAGE_SIZE}`, { cache: "no-store" });
    const firstResult = await firstResponse.json();
    if (!firstResponse.ok || !firstResult.success) throw new Error(firstResult.message || "Import rows load failed.");
    const allRows: ImportRow[] = Array.isArray(firstResult.data) ? firstResult.data : [];
    const pageCount = Math.max(1, Number(firstResult.pagination?.totalPages) || 1);
    if (pageCount > 1) {
      const remainingPages = await Promise.all(Array.from({ length: pageCount - 1 }, async (_, index) => {
        const pageNumber = index + 2;
        const response = await fetch(`/api/imports/${id}/rows?page=${pageNumber}&limit=${PAGE_SIZE}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || `Import rows page ${pageNumber} load failed.`);
        return Array.isArray(result.data) ? result.data as ImportRow[] : [];
      }));
      allRows.push(...remainingPages.flat());
    }
    setRows(allRows);
    setPage(1);
    setTotalPages(1);
  }

  async function previewImport() {
    if (!file) {
      setError("প্রথমে একটি ফাইল নির্বাচন করুন।");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setSummary(null);
    setParserSummary(null);
    setRows([]);
    setSelectedIds([]);
    setSelectAllBatch(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
      const isHtml = [".html", ".htm", ".xhtml", ".mhtml", ".mht"].includes(extension);
      const previewEndpoint = isHtml ? "/api/imports/html/preview" : "/api/imports/preview";
      const response = await fetch(previewEndpoint, {
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
      setParserSummary(result.parser ?? null);
      await loadRows(id, 1);
      setMessage("ফাইল সফলভাবে Preview তৈরি হয়েছে।");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Import Preview ব্যর্থ হয়েছে।",
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleRow(id: string, checked: boolean) {
    if (selectAllBatch) {
      setExcludedIds((current) =>
        checked
          ? current.filter((item) => item !== id)
          : current.includes(id) ? current : [...current, id],
      );
      return;
    }
    setSelectedIds((current) =>
      checked
        ? current.includes(id) ? current : [...current, id]
        : current.filter((item) => item !== id),
    );
  }

  function selectAllValid() {
    setSelectedIds([]);
    setExcludedIds([]);
    setSelectAllBatch(true);
  }

  async function performAction(action: "commit" | "skip") {
    let actionIds = selectedIds;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (action === "commit" && selectAllBatch) {
        const firstResponse = await fetch(
          `/api/imports/${batchId}/rows?page=1&limit=${PAGE_SIZE}`,
          { cache: "no-store" },
        );
        const firstResult = await firstResponse.json();

        if (!firstResponse.ok || !firstResult.success) {
          throw new Error(firstResult.message || "সব Import Row লোড করা যায়নি।");
        }

        const allRows: ImportRow[] = Array.isArray(firstResult.data)
          ? firstResult.data
          : [];
        const pageCount = Math.max(
          1,
          Number(firstResult.pagination?.totalPages) || 1,
        );

        if (pageCount > 1) {
          const remainingPages = await Promise.all(
            Array.from({ length: pageCount - 1 }, async (_, index) => {
              const pageNumber = index + 2;
              const pageResponse = await fetch(
                `/api/imports/${batchId}/rows?page=${pageNumber}&limit=${PAGE_SIZE}`,
                { cache: "no-store" },
              );
              const pageResult = await pageResponse.json();

              if (!pageResponse.ok || !pageResult.success) {
                throw new Error(
                  pageResult.message || `Import Row page ${pageNumber} লোড করা যায়নি।`,
                );
              }

              return Array.isArray(pageResult.data)
                ? (pageResult.data as ImportRow[])
                : [];
            }),
          );
          allRows.push(...remainingPages.flat());
        }

        actionIds = allRows
          .filter((row) => ["VALID", "DUPLICATE"].includes(row.status))
          .filter((row) => !excludedIds.includes(row.id))
          .map((row) => row.id);
      }

      if (!batchId || (actionIds.length === 0 && !(action === "skip" && selectAllBatch))) {
        throw new Error("অন্তত একটি উপযুক্ত Row নির্বাচন করুন।");
      }

      const requestBody =
        action === "commit"
          ? { rowIds: actionIds }
          : selectAllBatch
            ? {
                allRows: true,
                ...(excludedIds.length > 0
                  ? { excludedRowIds: excludedIds }
                  : {}),
              }
            : { rowIds: actionIds };

      const response = await fetch(
        `/api/imports/${batchId}/${action}`,
        {
          method: action === "commit" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Operation failed.");
      }

      setSelectedIds([]);
      setSelectAllBatch(false);
      setExcludedIds([]);

      setMessage(
        action === "commit"
          ? `${result.data?.importedRows ?? 0}টি প্রশ্ন Import হয়েছে।${result.data?.failedRows ? ` ${result.data.failedRows}টি Row Import হয়নি—Row-এর Error দেখুন।` : ""}`
          : `${result.data?.skippedRows ?? actionIds.length}টি Row Skip হয়েছে।`,
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

  function updateEditingField(field: string, value: string) {
    setEditingData((current) =>
      current ? { ...current, [field]: value } : current,
    );
  }

  function updateEditingOccurrence(index: number, field: string, value: string) {
    setEditingData((current) => {
      if (!current) return current;
      const occurrences = Array.isArray(current.occurrences) ? [...current.occurrences] : [];
      occurrences[index] = {
        ...(occurrences[index] ?? {}),
        [field]: field === "examYear" && value.trim() !== "" ? Number(value) : value,
      };
      return { ...current, occurrences };
    });
  }


  function addEditingOccurrence() {
    setEditingData((current) => current ? { ...current, occurrences: [...(Array.isArray(current.occurrences) ? current.occurrences : []), {}] } : current);
  }

  function removeEditingOccurrence(index: number) {
    setEditingData((current) => current ? { ...current, occurrences: (Array.isArray(current.occurrences) ? current.occurrences : []).filter((_: unknown, i: number) => i !== index) } : current);
  }

  function addEditingOption() {
    setEditingOptions((current) => [...current, {
      label: String.fromCharCode(65 + current.length),
      optionText: "",
      isCorrect: false,
      sortOrder: current.length,
    }]);
  }

  function updateEditingOption(index: number, field: "optionText" | "label", value: string) {
    setEditingOptions((current) => current.map((option, i) => i === index ? { ...option, [field]: value } : option));
  }

  function toggleCorrectEditingOption(index: number) {
    const nextOptions = editingOptions.map((option, i) =>
      i === index ? { ...option, isCorrect: !option.isCorrect } : option,
    );
    setEditingOptions(nextOptions);
    setEditingData((current) =>
      current
        ? {
            ...current,
            correctAnswer: nextOptions
              .filter((option) => option.isCorrect)
              .map((option) => option.label)
              .join(", "),
          }
        : current,
    );
  }

  function removeEditingOption(index: number) {
    setEditingOptions((current) => current.filter((_, i) => i !== index).map((option, i) => ({ ...option, sortOrder: i })));
  }

  function startManualImportEdit(row: ImportRow) {
    const raw = JSON.parse(JSON.stringify(row.rawData ?? {})) as Record<string, unknown>;

    setEditingRowId(row.id);
    setEditingData(raw);
    setEditingOptions(
      Array.isArray(raw.options)
        ? raw.options.map((option: unknown, index: number) => {
            const optionData = isRecord(option) ? option : {};
            return {
              label: String(optionData.label ?? String.fromCharCode(65 + index)),
              optionText: String(optionData.optionText ?? ""),
              isCorrect: Boolean(optionData.isCorrect),
              sortOrder: Number(optionData.sortOrder ?? index),
            };
          })
        : [],
    );
    setError("");
    setMessage("");
  }

  async function applyBatchMetadataNow(setAsPrimary = false) {
    if (!batchId) return;

    const body = {
      institution: batchMetadata.institution.trim() || undefined,
      examName: batchMetadata.examName.trim() || undefined,
      examYear: batchMetadata.examYear.trim() ? Number(batchMetadata.examYear) : undefined,
      postName: batchMetadata.postName.trim() || undefined,
      rowIds: selectedIds.length && !selectAllBatch ? selectedIds : undefined,
      applyTo: selectedIds.length && !selectAllBatch ? "selected" : "all",
      overwriteExisting: batchOverwriteExisting,
      setAsPrimary,
    };

    if (setAsPrimary && !body.examName) {
      setError("Primary Occurrence নির্ধারণের জন্য Exam Name দিন।");
      return;
    }

    if (!body.institution && !body.examName && !body.examYear && !body.postName) {
      setError("কমপক্ষে একটি Batch Metadata দিন।");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/imports/${batchId}/metadata`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Batch metadata apply করা যায়নি।");
      }

      const payload = result.data ?? result;
      const counts = payload.summary ?? payload;

      setSummary((current) =>
        current ? { ...current, ...counts } : current,
      );
      await loadRows(batchId, page);
      setMessage(setAsPrimary
        ? `Primary Occurrence ${payload.updatedRows ?? 0}টি প্রশ্নের জন্য নির্ধারণ করা হয়েছে। অন্য Exam Occurrence অক্ষত আছে।`
        : `Batch Metadata ${payload.updatedRows ?? 0}টি প্রশ্নে প্রয়োগ হয়েছে। আগে থেকে থাকা তথ্য অক্ষত রাখা হয়েছে।`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch metadata apply failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveManualImportEdit() {
    if (!batchId || !editingRowId || !editingData) return;

    const normalizedOptions = editingOptions
      .filter((option) => option.optionText.trim())
      .map((option, index) => ({ ...option, optionText: option.optionText.trim(), sortOrder: index }));
    if (normalizedOptions.length > 4) {
      setError("সর্বোচ্চ ৪টি Option দেওয়া যাবে। Option ও Correct Answer ফাঁকা রাখা যাবে।");
      return;
    }
    const rawData = { ...editingData, options: normalizedOptions };

    setSavingEdit(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/imports/${batchId}/rows/${editingRowId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawData }),
        },
      );

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Question update করা যায়নি।");
      }

      const payload = result.data ?? result;
      const counts = payload.summary ?? payload;

      setSummary((current) =>
        current ? { ...current, ...counts } : current,
      );
      setEditingRowId("");
      setEditingData(null);
      await loadRows(batchId, page);
      setMessage("Question update হয়েছে এবং validation আবার চালানো হয়েছে।");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Question update failed.");
    } finally {
      setSavingEdit(false);
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
    setParserSummary(null);
    setRows([]);
    setSelectedIds([]);
    setPage(1);
    setTotalPages(1);
    setMessage("");
    setError("");
  }

  return (
    <>
      <OcrQuestionImportPanel embedded />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center gap-3 rounded-md bg-transparent px-1 text-center text-sm font-bold leading-tight text-slate-800 transition-colors hover:bg-emerald-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300"
      >
        <svg viewBox="0 0 24 24" fill="none" className="hidden h-4 w-4">
          <path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-emerald-700"><svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM13 2v7h7M12 12v7m-3.5-3.5h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <span className="text-center text-sm font-bold leading-tight">Import</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-5">
          <div className={`flex w-full flex-col overflow-hidden bg-slate-50 shadow-2xl ${summary ? "max-h-[96vh] max-w-[98vw] rounded-xl" : "max-h-[95vh] max-w-6xl rounded-2xl"}`}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                    <path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                    Question Import Center
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Bulk upload and manage your question data
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closePanel}
                disabled={loading}
                aria-label="Close import panel"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <div className={`min-h-0 overflow-y-auto ${summary ? "p-2 sm:p-3" : "p-4 sm:p-7"}`}>
              <div className={`${summary ? "hidden" : ""} mb-6 grid gap-3 sm:grid-cols-3`}>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Supported formats
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    Excel · CSV · JSON · HTML
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    XLSX, XLS, CSV, JSON and HTML/HTM
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Maximum file size
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    10 MB
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Per upload file
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Maximum records
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    10,000
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Questions per import batch
                  </p>
                </div>
              </div>

              {!summary && (
                <>
                  <div className="mb-5">
                    <h3 className="text-base font-bold text-slate-900">
                      Upload your question file
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Select a supported file to validate and preview your questions.
                    </p>
                  </div>

                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setIsDragging(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsDragging(false);
                      validateFile(event.dataTransfer.files?.[0] ?? null);
                    }}
                    className={`rounded-2xl border-2 border-dashed p-7 text-center transition sm:p-12 ${
                      isDragging
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.json,.html,.htm,.xhtml,.mhtml,.mht"
                      className="hidden"
                      disabled={loading}
                      onChange={(event) => {
                        validateFile(event.target.files?.[0] ?? null);
                        event.target.value = "";
                      }}
                    />

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                      <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8">
                        <path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    <h4 className="mt-5 text-base font-bold text-slate-900">
                      {isDragging
                        ? "এখানে ফাইল ছেড়ে দিন"
                        : "Drag and drop your file here"}
                    </h4>
                    <p className="mt-2 text-sm text-slate-500">
                      অথবা কম্পিউটার থেকে ফাইল নির্বাচন করুন
                    </p>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      Browse Files
                    </button>

                    <p className="mt-4 text-xs text-slate-400">
                      XLSX, XLS, CSV, JSON (10 MB) · HTML/HTM/XHTML (5 MB)
                    </p>
                  </div>

                  <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                            <path d="M5 3h9l5 5v13H5zM14 3v5h5M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">PDF / Image থেকে OCR Import</p>
                          <p className="mt-0.5 text-xs text-slate-500">স্ক্যান করা PDF, PDF text এবং JPG/PNG থেকে প্রশ্ন শনাক্ত ও যাচাই করুন</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => window.dispatchEvent(new Event("shikhasetu:open-ocr-import"))}
                        disabled={loading}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                      >
                        <span>＋</span> OCR PDF / Image Add
                      </button>
                    </div>
                  </div>
                </>
              )}

              {file && !summary && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileIcon
                      type={
                        file.name.toLowerCase().endsWith(".xlsx") ||
                        file.name.toLowerCase().endsWith(".xls")
                          ? "excel"
                          : file.name.toLowerCase().endsWith(".csv")
                            ? "csv"
                            : "json"
                      }
                    />
                    <div className="min-w-0">
                      <p className="break-all text-sm font-bold text-slate-900">
                        {file.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatBytes(file.size)} · Ready to upload
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    disabled={loading}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove file
                  </button>
                </div>
              )}

              {error && (
                <div className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <span className="font-bold">!</span>
                  <p>{error}</p>
                </div>
              )}

              {message && (
                <div className="mt-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  <span className="font-bold">✓</span>
                  <p>{message}</p>
                </div>
              )}

              {!summary && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
                  <p className="text-xs text-slate-500">
                    Your existing questions will not be changed during preview.
                  </p>
                  <button
                    type="button"
                    onClick={previewImport}
                    disabled={!file || loading}
                    className="inline-flex min-w-44 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Processing...
                      </>
                    ) : (
                      "Upload & Preview"
                    )}
                  </button>
                </div>
              )}

              {summary && (
                <div className="mb-6 space-y-5">
                  <section className="mb-3 grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-white p-2 lg:grid-cols-5">
                    <div className="flex h-full flex-col justify-between gap-3 rounded-md border border-slate-200 p-2 lg:col-span-2">
                      <div className="grid flex-1 grid-cols-2 gap-2">
                        <input list="batch-institution-suggestions" value={batchMetadata.institution} onChange={(e) => setBatchMetadata((v) => ({ ...v, institution: e.target.value }))} placeholder="Institution" title={batchMetadata.institution} className="h-11 min-w-0 w-full rounded-md border border-slate-300 px-2.5 text-xs" />
                        <input list="batch-exam-suggestions" value={batchMetadata.examName} onChange={(e) => setBatchMetadata((v) => ({ ...v, examName: e.target.value }))} placeholder="Exam Name" title={batchMetadata.examName} className="h-11 min-w-0 w-full rounded-md border border-slate-300 px-2.5 text-xs" />
                        <input list="batch-post-suggestions" value={batchMetadata.postName} onChange={(e) => setBatchMetadata((v) => ({ ...v, postName: e.target.value }))} placeholder="Post Name" title={batchMetadata.postName} className="h-11 min-w-0 w-full rounded-md border border-slate-300 px-2.5 text-xs" />
                        <input list="batch-year-suggestions" value={batchMetadata.examYear} onChange={(e) => setBatchMetadata((v) => ({ ...v, examYear: e.target.value }))} placeholder="Year" inputMode="numeric" title={batchMetadata.examYear} className="h-11 min-w-0 w-full rounded-md border border-slate-300 px-2.5 text-xs" />
                      </div>
                      <datalist id="batch-institution-suggestions">{getBatchSuggestions(rows, "institution").map((value) => <option key={value} value={value} />)}</datalist>
                      <datalist id="batch-exam-suggestions">{getBatchSuggestions(rows, "examName").map((value) => <option key={value} value={value} />)}</datalist>
                      <datalist id="batch-year-suggestions">{getBatchSuggestions(rows, "examYear").map((value) => <option key={value} value={value} />)}</datalist>
                      <datalist id="batch-post-suggestions">{getBatchSuggestions(rows, "postName").map((value) => <option key={value} value={value} />)}</datalist>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-700"><input type="checkbox" checked={batchOverwriteExisting} onChange={(e) => setBatchOverwriteExisting(e.target.checked)} className="rounded border-slate-300" /><span>Replace existing</span></label>
                        <span className="text-[10px] text-slate-500">{selectAllBatch ? "All rows" : selectedIds.length ? `${selectedIds.length} selected` : "All rows"}</span>
                        <button type="button" onClick={() => applyBatchMetadataNow()} disabled={loading} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{batchOverwriteExisting ? "↻ Replace & Apply" : "✓ Apply"}</button>
                        <button type="button" onClick={() => applyBatchMetadataNow(true)} disabled={loading || !batchMetadata.examName.trim()} title="Set as primary occurrence" className="rounded-md border border-emerald-300 px-2 py-1.5 text-[10px] font-semibold text-emerald-700 disabled:opacity-40">★ Primary</button>
                      </div>
                    </div>
                    <div className="flex h-full flex-col justify-between gap-2 rounded-md border border-slate-200 p-2 lg:col-span-3">
                      <div className="grid flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {[
                          { label: "Total Questions", value: summary.totalRows, icon: "▤", color: "text-slate-900" },
                          { label: "Valid", value: summary.validRows, icon: "✓", color: "text-emerald-700" },
                          { label: "Invalid", value: summary.invalidRows, icon: "!", color: "text-red-700" },
                          { label: "Duplicates", value: summary.duplicateRows, icon: "⧉", color: "text-amber-700" },
                          { label: "Source Records", value: parserSummary?.totalCandidates ?? 0, icon: "▥", color: "text-slate-700" },
                          { label: "Needs Review", value: parserSummary?.skippedCount ?? 0, icon: "⌕", color: "text-amber-700" },
                        ].map((item) => (
                          <div key={item.label} className="flex min-h-[54px] items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1">
                            <span className="min-w-0 text-[10px] font-medium leading-tight text-slate-500">{item.label}</span>
                            <span className={`shrink-0 text-base font-black tabular-nums ${item.color}`}><span className="mr-1 text-xs">{item.icon}</span>{item.value.toLocaleString("en-US")}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-2">
                        <button type="button" onClick={selectAllValid} disabled={loading || (summary.validRows === 0 && summary.duplicateRows === 0)} className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-700 disabled:opacity-40">☑ Select All</button>
                        <button type="button" onClick={() => { setSelectedIds([]); setExcludedIds([]); setSelectAllBatch(false); }} disabled={loading || (selectedIds.length === 0 && !selectAllBatch)} className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-slate-600 disabled:opacity-40">✕ Clear</button>
                        <button type="button" onClick={() => performAction("commit")} disabled={loading || (selectAllBatch ? summary.validRows + summary.duplicateRows <= excludedIds.length : !rows.some((row) => ["VALID", "DUPLICATE"].includes(row.status) && selectedIds.includes(row.id)))} className="flex-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-[10px] font-semibold text-emerald-700 disabled:opacity-40">✓ Commit</button>
                        <button type="button" onClick={() => performAction("skip")} disabled={loading || (!selectAllBatch && selectedIds.length === 0) || (selectAllBatch && summary.totalRows === 0)} className="flex-1 rounded border border-red-200 px-2 py-1.5 text-[10px] font-semibold text-red-600 disabled:opacity-40">↷ Skip</button>
                        <a href={`/api/imports/${batchId}/error-report?format=csv`} className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-center text-[10px] font-semibold text-slate-700">⇩ Error Report</a>
                      </div>
                    </div>
                  </section>

                  <section id="manual-question-edit-form" className={`rounded-lg border border-amber-200 bg-white p-3 ${editingData ? "" : "hidden"}`}>
                    <h3 className="text-base font-bold text-slate-900">
                      Manual Question Edit
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      কোনো প্রশ্নের তথ্য অনুপস্থিত বা ভুল হলে প্রশ্ন নির্বাচন করে সম্পাদনা করুন।
                    </p>

                    <select
                      value={editingRowId}
                      onChange={(e) => {
                        const row = rows.find((item) => item.id === e.target.value);
                        if (row) startManualImportEdit(row);
                        else {
                          setEditingRowId("");
                          setEditingData(null);
                        }
                      }}
                      className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">প্রশ্ন নির্বাচন করুন</option>
                      {rows.map((row) => (
                        <option key={row.id} value={row.id}>
                          Row {row.rowNumber} — {String(row.rawData?.questionText ?? "").slice(0, 100)}
                        </option>
                      ))}
                    </select>

                    {editingData && (
                      <div className="mt-4 space-y-3">
                        <textarea
                          value={String(editingData.questionText ?? "")}
                          onChange={(e) => updateEditingField("questionText", e.target.value)}
                          placeholder="Question Text"
                          rows={3}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />

                        <div className="grid gap-3 sm:grid-cols-2">
                          <input value={String(editingData.subject ?? "")} onChange={(e) => updateEditingField("subject", e.target.value)} placeholder="Subject" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                          <input value={String(editingData.topic ?? "")} onChange={(e) => updateEditingField("topic", e.target.value)} placeholder="Topic" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <select value={String(editingData.questionType ?? "MCQ")} onChange={(e) => updateEditingField("questionType", e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                            <option value="MCQ">MCQ</option><option value="TRUE_FALSE">True / False</option><option value="FILL_IN_THE_BLANKS">Fill in the Blanks</option><option value="WRITTEN">Written</option>
                          </select>
                          <select value={String(editingData.difficulty ?? "MEDIUM")} onChange={(e) => updateEditingField("difficulty", e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                            <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
                          </select>
                          <select value={String(editingData.status ?? "DRAFT")} onChange={(e) => updateEditingField("status", e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                            <option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="HIDDEN">Hidden</option><option value="ARCHIVED">Archived</option>
                          </select>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-3">
                          <p className="mb-2 text-sm font-semibold text-slate-700">Primary / Source Metadata</p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {(["institution","examName","examYear","postName","department","source","sourcePage","sourceUrl"] as const).map((field) => (
                              <input key={field} value={String(editingData[field] ?? "")} onChange={(e) => updateEditingField(field, e.target.value)} placeholder={field} inputMode={field === "examYear" || field === "sourcePage" ? "numeric" : undefined} className="min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                            ))}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-3">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-700">Exam Occurrences</p>
                            <button type="button" onClick={addEditingOccurrence} className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50">+ Add Exam</button>
                          </div>
                          <div className="space-y-3">
                            {(Array.isArray(editingData.occurrences) ? editingData.occurrences : []).map((occurrence: Record<string, unknown>, index: number) => (
                              <div key={index} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
                                <input value={String(occurrence.institution ?? "")} onChange={(e) => updateEditingOccurrence(index, "institution", e.target.value)} placeholder="Institution" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                                <input value={String(occurrence.examName ?? "")} onChange={(e) => updateEditingOccurrence(index, "examName", e.target.value)} placeholder="Exam Name" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                                <input value={String(occurrence.examYear ?? "")} onChange={(e) => updateEditingOccurrence(index, "examYear", e.target.value)} placeholder="Exam Year" inputMode="numeric" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                                <input value={String(occurrence.postName ?? "")} onChange={(e) => updateEditingOccurrence(index, "postName", e.target.value)} placeholder="Post Name" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                                <input value={String(occurrence.department ?? "")} onChange={(e) => updateEditingOccurrence(index, "department", e.target.value)} placeholder="Department" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                                <input value={String(occurrence.questionNumber ?? "")} onChange={(e) => updateEditingOccurrence(index, "questionNumber", e.target.value)} placeholder="Question Number" inputMode="numeric" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                                <input value={String(occurrence.source ?? "")} onChange={(e) => updateEditingOccurrence(index, "source", e.target.value)} placeholder="Source" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                                <input value={String(occurrence.sourcePage ?? "")} onChange={(e) => updateEditingOccurrence(index, "sourcePage", e.target.value)} placeholder="Source Page" inputMode="numeric" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                                <input value={String(occurrence.sourceUrl ?? "")} onChange={(e) => updateEditingOccurrence(index, "sourceUrl", e.target.value)} placeholder="Source URL" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm sm:col-span-2" />
                                <div className="flex gap-2">
                                  <input value={String(occurrence.postName ?? "")} onChange={(e) => updateEditingOccurrence(index, "postName", e.target.value)} placeholder="Post Name" className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                                  <button type="button" onClick={() => removeEditingOccurrence(index)} aria-label="Remove exam occurrence" className="rounded-md border border-red-200 px-2 text-red-600">×</button>
                                </div>
                              </div>
                            ))}
                            {(!Array.isArray(editingData.occurrences) || editingData.occurrences.length === 0) && <p className="text-xs text-slate-500">এখনো কোনো Exam যুক্ত হয়নি।</p>}
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 p-3">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-700">Question Options</p>
                            <button type="button" onClick={addEditingOption} disabled={editingOptions.length >= 4} className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-40">+ Add Option</button>
                          </div>
                          <div className="space-y-2">
                            {editingOptions.map((option, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <input value={option.label} onChange={(e) => updateEditingOption(index, "label", e.target.value)} aria-label="Option label" className="w-14 rounded-md border border-slate-300 px-2 py-2 text-sm" />
                                <input value={option.optionText} onChange={(e) => updateEditingOption(index, "optionText", e.target.value)} placeholder={`Option ${index + 1}`} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
                                <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={option.isCorrect} onChange={() => toggleCorrectEditingOption(index)} /> Correct</label>
                                <button type="button" onClick={() => removeEditingOption(index)} aria-label="Remove option" className="rounded-md border border-red-200 px-2 py-2 text-red-600">×</button>
                              </div>
                            ))}
                            {editingOptions.length === 0 && <p className="text-xs text-slate-500">এই প্রশ্নে এখনো কোনো Option নেই।</p>}
                          </div>
                        </div>

                        <input
                          value={String(editingData.correctAnswer ?? "")}
                          onChange={(e) => updateEditingField("correctAnswer", e.target.value)}
                          placeholder="Correct Answer"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />

                        <textarea
                          value={String(editingData.explanation ?? "")}
                          onChange={(e) => updateEditingField("explanation", e.target.value)}
                          placeholder="Explanation"
                          rows={3}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={saveManualImportEdit}
                            disabled={savingEdit || loading}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {savingEdit ? "Saving..." : "Save & Revalidate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRowId("");
                              setEditingData(null);
                            }}
                            disabled={savingEdit}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              )}
              {summary && (
                <>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-900">Import Preview <span className="font-normal text-slate-400">/</span> <span className="text-blue-700">Extracted Questions</span></h3><span className="rounded bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">Batch: {batchId.slice(0, 8)}</span></div>


                      {parserSummary.warnings.length > 0 && (
                        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
                          {parserSummary.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )}



                  <div className="mb-1 flex justify-end"><button type="button" onClick={() => { setShowAllDetails((current) => !current); setDetailOverrides({}); }} className="rounded px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50">{showAllDetails ? "Hide Details" : "Show Details"}</button></div><div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-left text-xs">
                        <thead className="bg-slate-100 text-xs font-bold uppercase tracking-wide text-slate-600">
                          <tr>
                            <th className="w-12 p-3">Select</th>
                            <th className="w-16 p-3">Row</th>
                            <th className="p-3">Question</th>
                            <th className="p-3">Subject / Topic</th>
                            <th className="p-3">Status / Errors</th>
                            <th className="w-24 p-3">Action</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {rows.map((row) => {
                            const raw = row.rawData ?? {};
                            const errors = getErrors(row);
                            const selectable = [
                              "VALID",
                              "INVALID",
                              "DUPLICATE",
                            ].includes(row.status);

                            return (
                              <tr
                                key={row.id}
                                className="align-top transition hover:bg-slate-50"
                              >
                                <td className="px-2 py-1.5">
                                  <input
                                    type="checkbox"
                                    checked={
                                      selectAllBatch
                                        ? ["VALID", "DUPLICATE"].includes(row.status) && !excludedIds.includes(row.id)
                                        : selectedIds.includes(row.id)
                                    }
                                    disabled={
                                      !selectable ||
                                      loading ||
                                      (selectAllBatch && !["VALID", "DUPLICATE"].includes(row.status))
                                    }
                                    onChange={(event) =>
                                      toggleRow(row.id, event.target.checked)
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>

                                <td className="px-2 py-1.5 font-semibold text-slate-500">
                                  {row.rowNumber}
                                </td>

                                <td className="whitespace-normal px-2 py-1.5 font-medium text-slate-800">
                                  {Boolean(raw.htmlImportMetadata) &&
                                    typeof raw.htmlImportMetadata === "object" &&
                                    typeof (raw.htmlImportMetadata as Record<string, unknown>).sourceQuestionId === "string" && (
                                      <p className="mb-1 text-[10px] font-semibold text-blue-700">
                                        Source ID: {String((raw.htmlImportMetadata as Record<string, unknown>).sourceQuestionId)}
                                      </p>
                                    )}
                                  {String(raw.questionText ?? "â€”")}
                                  {Array.isArray(raw.options) && raw.options.length > 0 && (
                                    <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 lg:grid-cols-4">
                                      {raw.options.map((option: { label?: string; optionText?: string; text?: string; isCorrect?: boolean }, index: number) => (
                                        <div
                                          key={`${option.label ?? index}-${index}`}
                                          className={`rounded-lg px-3 py-2 text-xs ${
                                            option.isCorrect
                                              ? "border border-emerald-200 bg-emerald-50 font-semibold text-emerald-800"
                                              : "border border-slate-100 bg-slate-50 text-slate-700"
                                          }`}
                                        >
                                          <span className="mr-2 font-bold">
                                            {option.label ?? String.fromCharCode(65 + index)}.
                                          </span>
                                          {option.optionText ?? option.text ?? ""}
                                          {option.isCorrect && (
                                            <span className="ml-2">✓ Correct</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <details open={detailOverrides[row.id] ?? showAllDetails} onToggle={(event) => { const isOpen = event.currentTarget.open; setDetailOverrides((current) => ({ ...current, [row.id]: isOpen })); }} className="mt-1 rounded border border-slate-200 bg-slate-50 px-2 py-1">
                                    <summary className="cursor-pointer text-[10px] font-semibold text-blue-700">Answer · metadata · explanation · source · occurrences</summary>
                                    <div className="grid grid-cols-1 gap-x-3 gap-y-1 pt-1 sm:grid-cols-2 xl:grid-cols-3">
                                      {raw.correctAnswer != null && <p className="text-[11px] font-semibold text-emerald-700"><strong>Correct Answer:</strong> {String(raw.correctAnswer)}</p>}
                                      {raw.questionType != null && <p className="text-[11px]"><strong>Type:</strong> {String(raw.questionType)}</p>}
                                      {raw.difficulty != null && <p className="text-[11px]"><strong>Difficulty:</strong> {String(raw.difficulty)}</p>}
                                      {raw.examName != null && <p className="text-[11px]"><strong>Exam:</strong> {String(raw.examName)}</p>}
                                      {raw.examYear != null && <p className="text-[11px]"><strong>Year:</strong> {String(raw.examYear)}</p>}
                                      {raw.institution != null && <p className="text-[11px]"><strong>Institution:</strong> {String(raw.institution)}</p>}
                                      {raw.postName != null && <p className="text-[11px]"><strong>Post:</strong> {String(raw.postName)}</p>}
                                      {raw.department != null && <p className="text-[11px]"><strong>Department:</strong> {String(raw.department)}</p>}
                                      {raw.explanation != null && String(raw.explanation).trim() !== "" && <p className="whitespace-pre-wrap text-[11px]"><strong>Explanation:</strong> {String(raw.explanation)}</p>}
                                      {raw.source != null && <p className="text-[11px]"><strong>Source:</strong> {String(raw.source)}</p>}
                                      {raw.sourcePage != null && <p className="text-[11px]"><strong>Source Page:</strong> {String(raw.sourcePage)}</p>}
                                      {raw.sourceUrl != null && <p className="break-all text-[11px]"><strong>Source URL:</strong> {String(raw.sourceUrl)}</p>}
                                      {raw.repeatGroupId != null && <p className="text-[11px]"><strong>Repeat Group:</strong> {String(raw.repeatGroupId)}</p>}
                                      {Array.isArray(raw.occurrences) && raw.occurrences.map((occurrence: unknown, index: number) => { const item = isRecord(occurrence) ? occurrence : {}; return <p key={index} className="text-[11px]"><strong>{String(item.examName ?? "Exam")}:</strong> {[item.examYear, item.postName, item.department, item.isPrimary ? "Primary" : "Additional"].filter(Boolean).map(String).join(" · ")}</p>; })}
                                      {Object.entries(raw).filter(([key, value]) => !["questionText","options","correctAnswer","explanation","subject","topic","questionType","difficulty","status","institution","examName","examYear","postName","department","source","sourcePage","sourceUrl","occurrences","repeatGroupId","htmlImportMetadata"].includes(key) && value !== null && value !== undefined && value !== "").map(([key,value]) => <p key={key} className="break-words text-[11px]"><strong>{key}:</strong> {typeof value === "object" ? JSON.stringify(value) : String(value)}</p>)}
                                    </div>
                                  </details>
                                </td>

                                <td className="px-2 py-1.5 text-slate-700">
                                  {String(raw.subject ?? "â€”")}
                                  <p className="mt-1 text-xs text-slate-400">
                                    {String(raw.topic ?? "â€”")}
                                  </p>
                                </td>

                                <td className="px-2 py-1.5">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${statusStyle(row.status)}`}
                                  >
                                    {row.status}
                                  </span>
                                  {errors.length > 0 && (
                                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-600">
                                      {errors.map((item, index) => (
                                        <li key={index}>{item}</li>
                                      ))}
                                    </ul>
                                  )}
                                </td>
                                <td className="px-2 py-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      startManualImportEdit(row);
                                      document.getElementById("manual-question-edit-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }}
                                    disabled={loading || !["PENDING", "VALID", "INVALID", "DUPLICATE"].includes(row.status)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            );
                          })}

                          {rows.length === 0 && (
                            <tr>
                              <td
                                colSpan={6}
                                className="p-10 text-center text-sm text-slate-500"
                              >
                                এই পেজে কোনো Row পাওয়া যায়নি।
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-2 text-center text-[10px] text-slate-500">Showing all {rows.length.toLocaleString("en-US")} import rows in this workspace · no pagination</div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500 sm:px-7">
              <span>Shikhasetu · Question Bank Import</span>
              <span>Secure preview before importing</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

