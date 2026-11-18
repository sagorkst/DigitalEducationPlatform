
"use client";

import { useRef, useState } from "react";

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
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAllBatch, setSelectAllBatch] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [batchMetadata, setBatchMetadata] = useState({
    institution: "",
    examName: "",
    examYear: "",
    postName: "",
    department: "",
  });
  const [batchOccurrences, setBatchOccurrences] = useState([
    { examName: "", examYear: "", postName: "", department: "" },
  ]);
  const [editingRowId, setEditingRowId] = useState("");
  const [editingData, setEditingData] = useState<Record<string, any> | null>(null);
  const [editingOptions, setEditingOptions] = useState<Array<{ label: string; optionText: string; isCorrect: boolean; sortOrder: number }>>([]);
  const [savingEdit, setSavingEdit] = useState(false);


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
    setRows([]);
    setBatchId("");
    setSelectedIds([]);
    setSelectAllBatch(false);
  }

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
      setError("প্রথমে একটি ফাইল নির্বাচন করুন।");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setSummary(null);
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
    setSelectAllBatch(false);
    setSelectedIds((current) =>
      checked
        ? [...current, id]
        : current.filter((item) => item !== id),
    );
  }

  function selectAllValid() {
    setSelectedIds([]);
    setSelectAllBatch(true);
  }

  async function performAction(action: "commit" | "skip") {
    const actionIds =
      action === "commit"
        ? rows
            .filter(
              (row) =>
                ["VALID", "DUPLICATE"].includes(row.status) && selectedIds.includes(row.id),
            )
            .map((row) => row.id)
        : selectedIds;

    if (!batchId || (!selectAllBatch && actionIds.length === 0)) {
      setError("অন্তত একটি উপযুক্ত Row নির্বাচন করুন।");
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
          body: JSON.stringify(
            selectAllBatch
              ? { allRows: true }
              : { rowIds: actionIds },
          ),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Operation failed.");
      }

      setSelectedIds([]);
      setSelectAllBatch(false);

      setMessage(
        action === "commit"
          ? `${result.data?.importedRows ?? 0}টি প্রশ্ন Import হয়েছে।`
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

  function addBatchOccurrence() {
    setBatchOccurrences((current) => [...current, { examName: "", examYear: "", postName: "", department: "" }]);
  }

  function updateBatchOccurrence(index: number, field: string, value: string) {
    setBatchOccurrences((current) => current.map((item, i) => i === index ? { ...item, [field]: value } : item));
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

  function setCorrectEditingOption(index: number) {
    setEditingOptions((current) => current.map((option, i) => ({ ...option, isCorrect: i === index })));
    setEditingData((current) => current ? { ...current, correctAnswer: editingOptions[index]?.label ?? "" } : current);
  }

  function removeEditingOption(index: number) {
    setEditingOptions((current) => current.filter((_, i) => i !== index).map((option, i) => ({ ...option, sortOrder: i })));
  }

  function startManualImportEdit(row: ImportRow) {
    const raw = JSON.parse(JSON.stringify(row.rawData ?? {}));
    const occurrence = Array.isArray(raw.occurrences)
      ? raw.occurrences[0] ?? {}
      : {};

    setEditingRowId(row.id);
    setEditingData(raw);
    setEditingOptions(Array.isArray(raw.options) ? raw.options.map((option: any, index: number) => ({ label: String(option.label ?? String.fromCharCode(65 + index)), optionText: String(option.optionText ?? ""), isCorrect: Boolean(option.isCorrect), sortOrder: Number(option.sortOrder ?? index) })) : []);
    setError("");
    setMessage("");
  }

  async function applyBatchMetadataNow() {
    if (!batchId) return;

    const occurrences = batchOccurrences
      .filter((item) => item.examName.trim())
      .map((item) => ({
        examName: item.examName.trim(),
        examYear: item.examYear.trim() ? Number(item.examYear) : undefined,
        postName: item.postName.trim() || undefined,
        department: item.department.trim() || undefined,
      }));
    const body = {
      institution: batchMetadata.institution.trim() || undefined,
      examName: batchMetadata.examName.trim() || undefined,
      examYear: batchMetadata.examYear.trim() ? Number(batchMetadata.examYear) : undefined,
      postName: batchMetadata.postName.trim() || undefined,
      department: batchMetadata.department.trim() || undefined,
      occurrences: occurrences.length ? occurrences : undefined,
      rowIds: selectedIds.length && !selectAllBatch ? selectedIds : undefined,
      applyTo: selectedIds.length && !selectAllBatch ? "selected" : "all",
      overwriteExisting: false,
    };

    if (!body.institution && !body.examName && !body.examYear && !body.postName && !body.department && !body.occurrences) {
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
      setMessage(`Batch Metadata ${payload.updatedRows ?? 0}টি প্রশ্নে প্রয়োগ হয়েছে। আগে থেকে থাকা তথ্য অক্ষত রাখা হয়েছে।`);
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
    if (editingData.questionType === "MCQ" && (normalizedOptions.length < 2 || normalizedOptions.filter((option) => option.isCorrect).length !== 1)) {
      setError("MCQ-এর জন্য অন্তত ২টি Option এবং ঠিক ১টি সঠিক উত্তর নির্বাচন করুন।");
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
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        প্রশ্ন Import
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
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

            <div className="overflow-y-auto p-4 sm:p-7">
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
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

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-lg">
                        PDF
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          PDF Import
                        </p>
                        <p className="text-xs text-slate-400">
                          Text extraction & OCR â€” Coming in a later phase
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-lg">
                        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-amber-700">
                          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.7" />
                          <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="m4 17 5-5 3 3 3-4 5 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Image Import
                        </p>
                        <p className="text-xs text-slate-400">
                          OCR & question extraction â€” Coming in a later phase
                        </p>
                      </div>
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
                  <section className="rounded-xl border border-blue-200 bg-white p-4 sm:p-5">
                    <h3 className="text-base font-bold text-slate-900">
                      Batch Metadata — Apply to Missing Information
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      একই পরীক্ষার Institution, Exam, Year ও Post একবার লিখুন।
                      আগে থেকে থাকা প্রশ্নের তথ্য পরিবর্তন হবে না।
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <input value={batchMetadata.institution} onChange={(e) => setBatchMetadata((v) => ({ ...v, institution: e.target.value }))} placeholder="Shared Institution" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      <input value={batchMetadata.examName} onChange={(e) => setBatchMetadata((v) => ({ ...v, examName: e.target.value }))} placeholder="Default Exam Name (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      <input value={batchMetadata.examYear} onChange={(e) => setBatchMetadata((v) => ({ ...v, examYear: e.target.value }))} placeholder="Default Exam Year" inputMode="numeric" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      <input value={batchMetadata.postName} onChange={(e) => setBatchMetadata((v) => ({ ...v, postName: e.target.value }))} placeholder="Shared Post Name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      <input value={batchMetadata.department} onChange={(e) => setBatchMetadata((v) => ({ ...v, department: e.target.value }))} placeholder="Shared Department" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="mt-4 rounded-lg border border-slate-200 p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-700">একই প্রশ্নের জন্য একাধিক Exam যুক্ত করুন</p>
                        <button type="button" onClick={addBatchOccurrence} className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50">+ Add Exam</button>
                      </div>
                      <div className="space-y-3">
                        {batchOccurrences.map((item, index) => (
                          <div key={index} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
                            <input value={item.examName} onChange={(e) => updateBatchOccurrence(index, "examName", e.target.value)} placeholder={`Exam Name ${index + 1}`} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                            <input value={item.examYear} onChange={(e) => updateBatchOccurrence(index, "examYear", e.target.value)} placeholder="Year" inputMode="numeric" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                            <input value={item.postName} onChange={(e) => updateBatchOccurrence(index, "postName", e.target.value)} placeholder="Post" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                            <div className="flex gap-2">
                              <input value={item.department} onChange={(e) => updateBatchOccurrence(index, "department", e.target.value)} placeholder="Department" className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                              <button type="button" onClick={() => setBatchOccurrences((current) => current.filter((_, i) => i !== index))} disabled={batchOccurrences.length === 1} aria-label="Remove exam" className="rounded-md border border-red-200 px-2 text-red-600 disabled:opacity-30">×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Apply target: {selectAllBatch ? "সব import row" : selectedIds.length ? `${selectedIds.length}টি selected row` : "সব import row"}।
                    </p>

                    <button
                      type="button"
                      onClick={applyBatchMetadataNow}
                      disabled={loading}
                      className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Apply to Missing Fields & Revalidate
                    </button>
                  </section>

                  <section id="manual-question-edit-form" className="rounded-xl border border-amber-200 bg-white p-4 sm:p-5">
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
                                <label className="flex items-center gap-1 text-xs text-slate-600"><input type="radio" name="correct-import-option" checked={option.isCorrect} onChange={() => setCorrectEditingOption(index)} /> Correct</label>
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
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Import Preview
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Review the extracted records before committing.
                      </p>
                    </div>
                    <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                      Batch: {batchId.slice(0, 8)}
                    </span>
                  </div>

                  <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                      {
                        label: "Total Questions",
                        value: summary.totalRows,
                        color: "text-slate-900",
                        icon: "▤",
                      },
                      {
                        label: "Valid",
                        value: summary.validRows,
                        color: "text-emerald-700",
                        icon: "✓",
                      },
                      {
                        label: "Invalid",
                        value: summary.invalidRows,
                        color: "text-red-700",
                        icon: "!",
                      },
                      {
                        label: "Duplicates",
                        value: summary.duplicateRows,
                        color: "text-amber-700",
                        icon: "↗",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-500">
                            {item.label}
                          </p>
                          <span className={`text-lg font-bold ${item.color}`}>
                            {item.icon}
                          </span>
                        </div>
                        <p className={`mt-2 text-2xl font-black ${item.color}`}>
                          {item.value.toLocaleString("en-US")}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Extracted Questions
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Select records to commit or skip.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={selectAllValid}
                        disabled={loading || (summary.validRows === 0 && summary.duplicateRows === 0)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Select All Rows (Across All Pages)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelectedIds([]); setSelectAllBatch(false); }}
                        disabled={loading || (selectedIds.length === 0 && !selectAllBatch)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                    <span className="mr-auto text-xs font-semibold text-slate-600">
                      {selectAllBatch ? "All eligible rows across every page selected" : `${selectedIds.length} selected`}
                    </span>

                    <button
                      type="button"
                      onClick={() => performAction("commit")}
                      disabled={
                        loading ||
                        (selectAllBatch
                          ? summary.validRows + summary.duplicateRows === 0
                          : !rows.some((row) => ["VALID", "DUPLICATE"].includes(row.status) && selectedIds.includes(row.id)))
                      }
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                      Commit Selected
                    </button>

                    <button
                      type="button"
                      onClick={() => performAction("skip")}
                      disabled={loading || (!selectAllBatch && selectedIds.length === 0) || (selectAllBatch && summary.totalRows === 0)}
                      className="rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      Skip Selected
                    </button>

                    <a
                      href={`/api/imports/${batchId}/error-report?format=csv`}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Error Report →
                    </a>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
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
                                <td className="p-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(row.id)}
                                    disabled={!selectable || loading}
                                    onChange={(event) =>
                                      toggleRow(row.id, event.target.checked)
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>

                                <td className="p-3 font-semibold text-slate-500">
                                  {row.rowNumber}
                                </td>

                                <td className="max-w-sm whitespace-normal p-3 font-medium text-slate-800">
                                  {String(raw.questionText ?? "â€”")}
                                  {Array.isArray(raw.options) && raw.options.length > 0 && (
                                    <div className="mt-3 space-y-1.5">
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

                                  {raw.correctAnswer != null && (
                                    <p className="mt-3 text-xs font-semibold text-emerald-700">
                                      Correct Answer: {String(raw.correctAnswer)}
                                    </p>
                                  )}

                                  {raw.explanation != null && String(raw.explanation).trim() !== "" && (
                                    <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">
                                      Explanation: {String(raw.explanation)}
                                    </p>
                                  )}
                                </td>

                                <td className="p-3 text-slate-700">
                                  {String(raw.subject ?? "â€”")}
                                  <p className="mt-1 text-xs text-slate-400">
                                    {String(raw.topic ?? "â€”")}
                                  </p>
                                </td>

                                <td className="p-3">
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
                                <td className="p-3">
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

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={page <= 1 || loading}
                        onClick={() => loadRows(batchId, page - 1)}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={page >= totalPages || loading}
                        onClick={() => loadRows(batchId, page + 1)}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
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
