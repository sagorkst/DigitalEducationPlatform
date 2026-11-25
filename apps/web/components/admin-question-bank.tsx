
"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors are required for API file downloads. */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Badge,
} from "@shikhasetu/ui";
import QuestionImportPanel from "./question-import-panel";
import QuestionImportTemplates from "./question-import-templates";
import QuestionImportHistory from "./question-import-history";

type QuestionStatus = "Draft" | "Published" | "Hidden" | "Archived";

type Question = {
  id: string;
  institution: string;
  exam: string;
  year: number;
  post: string;
  department: string;
  subject: string;
  topic: string;
  questionType: string;
  question: string;
  imageReferences: string[];
  optionImages: Record<string, string[]>;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  repeatGroupId: string;
  source: string;
  status: QuestionStatus;
};

type ApiOption = {
  label: string;
  optionText: string;
  imageReferences?: string[];
  isCorrect: boolean;
  sortOrder?: number;
};

type ApiOccurrence = {
  institution?: string;
  examName?: string;
  examYear?: number;
  postName?: string;
  department?: string;
  source?: string;
};

type ApiQuestion = {
  id: string;
  questionCode?: string;
  questionText: string;
  imageReferences?: string[];
  questionType: string;
  subject: string;
  topic: string;
  correctAnswer?: string;
  explanation?: string;
  difficulty: string;
  status: string;
  options?: ApiOption[];
  occurrences?: ApiOccurrence[];
};

type ExamGroup = {
  id: string | null;
  groupKey: string;
  institutionId: string | null;
  institutionName: string;
  examName: string;
  examYear: number;
  postName?: string | null;
  department?: string | null;
};

type InstitutionGroup = {
  id: string | null;
  groupKey: string;
  name: string;
  exams: ExamGroup[];
};

type QuestionViewMode = "single" | "exam" | "institution";

const initialFilters = {
  from: "",
  to: "",
  institution: "",
  exam: "",
  post: "",
  subject: "",
  topic: "",
  status: "",
};

const emptyForm = {
  institution: "",
  exam: "",
  year: String(new Date().getFullYear()),
  post: "",
  department: "",
  subject: "",
  topic: "",
  questionType: "MCQ",
  question: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctAnswer: "",
  explanation: "",
  difficulty: "Medium",
  repeatGroupId: "",
  source: "",
  status: "Draft" as QuestionStatus,
};

type FormData = typeof emptyForm;

const toApiType = (value: string) => {
  const types: Record<string, string> = {
    MCQ: "MCQ",
    Written: "WRITTEN",
    "True/False": "TRUE_FALSE",
    "Fill in the Blanks": "FILL_IN_THE_BLANKS",
  };
  return types[value] ?? "MCQ";
};

const fromApiType = (value: string) => {
  const types: Record<string, string> = {
    MCQ: "MCQ",
    WRITTEN: "Written",
    TRUE_FALSE: "True/False",
    FILL_IN_THE_BLANKS: "Fill in the Blanks",
  };
  return types[value] ?? value;
};

const toApiStatus = (value: string) => value.toUpperCase();

const fromApiStatus = (value: string): QuestionStatus => {
  const statuses: Record<string, QuestionStatus> = {
    DRAFT: "Draft",
    PUBLISHED: "Published",
    HIDDEN: "Hidden",
    ARCHIVED: "Archived",
  };
  return statuses[value] ?? "Draft";
};

const toApiDifficulty = (value: string) => value.toUpperCase();

const fromApiDifficulty = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase();

function mapQuestion(item: ApiQuestion): Question {
  const options = item.options ?? [];
  const occurrence = item.occurrences?.[0] ?? {};
  const optionText = (label: string) =>
    options.find((option) => option.label === label)?.optionText ?? "";
  const correctOption = options.find((option) => option.isCorrect);

  return {
    id: item.id,
    institution: occurrence.institution ?? "",
    exam: occurrence.examName ?? "",
    year: occurrence.examYear ?? new Date().getFullYear(),
    post: occurrence.postName ?? "",
    department: occurrence.department ?? "",
    subject: item.subject ?? "",
    topic: item.topic ?? "",
    questionType: fromApiType(item.questionType),
    question: item.questionText,
    imageReferences: Array.isArray(item.imageReferences) ? item.imageReferences.filter((value): value is string => typeof value === "string") : [],
    optionImages: Object.fromEntries(options.map((option) => [option.label, Array.isArray(option.imageReferences) ? option.imageReferences.filter((value): value is string => typeof value === "string") : []])),
    optionA: optionText("A"),
    optionB: optionText("B"),
    optionC: optionText("C"),
    optionD: optionText("D"),
    correctAnswer: correctOption?.label ?? item.correctAnswer ?? "",
    explanation: item.explanation ?? "",
    difficulty: fromApiDifficulty(item.difficulty ?? "MEDIUM"),
    repeatGroupId: "",
    source: occurrence.source ?? "",
    status: fromApiStatus(item.status),
  };
}

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [deletedQuestions, setDeletedQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [selected, setSelected] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [globalStats, setGlobalStats] = useState({ totalQuestions: 0, totalInstitutions: 0, totalExams: 0, totalSubjects: 0 });

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [excludedQuestionIds, setExcludedQuestionIds] = useState<string[]>([]);
  const [tableDensity, setTableDensity] = useState<"compact" | "ultra">("compact");
  const [bulkDifficulty, setBulkDifficulty] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [draftCount, setDraftCount] = useState(0);

  const [viewMode, setViewMode] = useState<QuestionViewMode>("single");
  const [managementWorkspaceOpen, setManagementWorkspaceOpen] = useState(true);
  const [groupOptions, setGroupOptions] = useState<{
    institutions: InstitutionGroup[];
    exams: ExamGroup[];
  }>({ institutions: [], exams: [] });
  const [selectedInstitutionKey, setSelectedInstitutionKey] = useState<string | null>(null);
  const [selectedExamGroup, setSelectedExamGroup] = useState<ExamGroup | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showTrash, setShowTrash] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [trashError, setTrashError] = useState("");
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const [permanentDeletingId, setPermanentDeletingId] = useState<string | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] =
    useState<Question | null>(null);

  const [successDialog, setSuccessDialog] = useState<{
    title: string;
    message: string;
    questionId: string;
  } | null>(null);

  const loadQuestions = useCallback(async (requestedPage = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setPageError("");
    }

    try {
      const params = new URLSearchParams();
      params.set("page", String(requestedPage));
      params.set("limit", "25");

      if (search.trim()) params.set("search", search.trim());
      if (filters.from) params.set("yearFrom", filters.from);
      if (filters.to) params.set("yearTo", filters.to);
      if (filters.institution) params.set("institution", filters.institution);
      if (filters.exam) params.set("exam", filters.exam);
      if (filters.post) params.set("post", filters.post);
      if (filters.subject) params.set("subject", filters.subject);
      if (filters.topic) params.set("topic", filters.topic);
      if (filters.status) params.set("status", filters.status.toUpperCase());

      const response = await fetch(`/api/questions?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "প্রশ্ন লোড করা যায়নি।");
      }

      const records: ApiQuestion[] = Array.isArray(result.data) ? result.data : [];
      const mapped = records.map(mapQuestion);

      setQuestions((old) => append ? [...old, ...mapped] : mapped);

      const total = result.pagination?.total ?? records.length;
      const totalPages = result.pagination?.totalPages ?? 1;

      setTotalQuestions(total);
      setTotalPages(totalPages);
      setCurrentPage(requestedPage);
      setHasMore(requestedPage < totalPages);
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "প্রশ্ন লোড করতে সমস্যা হয়েছে।",
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, filters]);

  const loadGroupOptions = useCallback(async () => {
    try {
      const response = await fetch("/api/questions/group-options", {
        method: "GET",
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Exam group লোড করা যায়নি।");
      }

      setGroupOptions({
        institutions: result.data?.institutions ?? [],
        exams: result.data?.exams ?? [],
      });
      if (result.stats) {
        setGlobalStats({
          totalQuestions: Number(result.stats.totalQuestions ?? 0),
          totalInstitutions: Number(result.stats.totalInstitutions ?? 0),
          totalExams: Number(result.stats.totalExams ?? 0),
          totalSubjects: Number(result.stats.totalSubjects ?? 0),
        });
      }
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Exam group লোড করতে সমস্যা হয়েছে।",
      );
    }
  }, []);

  const loadGroupQuestions = useCallback(async (group: ExamGroup) => {
    setLoading(true);
    setPageError("");
    setSelectedExamGroup(group);
    setSelected(null);

    try {
      const params = new URLSearchParams();

      if (group.id) {
        params.set("examId", group.id);
      } else {
        params.set("institution", group.institutionName);
        params.set("examName", group.examName);
        params.set("examYear", String(group.examYear));
        if (group.postName) params.set("postName", group.postName);
        if (group.department) params.set("department", group.department);
      }

      const response = await fetch(`/api/questions/by-group?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "এই Exam-এর প্রশ্ন লোড করা যায়নি।");
      }

      const records: ApiQuestion[] = Array.isArray(result.data) ? result.data : [];

      const mapped = records.map((item) => {
        const question = mapQuestion(item);
        return {
          ...question,
          institution: group.institutionName,
          exam: group.examName,
          year: group.examYear,
          post: group.postName ?? question.post,
          department: group.department ?? question.department,
        };
      });

      setQuestions(mapped);
      setTotalQuestions(mapped.length);
      setCurrentPage(1);
      setHasMore(false);
    } catch (error) {
      setQuestions([]);
      setTotalQuestions(0);
      setPageError(
        error instanceof Error ? error.message : "Exam-এর প্রশ্ন লোড করতে সমস্যা হয়েছে।",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    setTrashError("");

    try {
      const response = await fetch("/api/questions/trash", {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Trash লোড করা যায়নি।");
      }

      const records: ApiQuestion[] = Array.isArray(result.data)
        ? result.data
        : [];

      setDeletedQuestions(records.map(mapQuestion));
    } catch (error) {
      setTrashError(
        error instanceof Error
          ? error.message
          : "Trash লোড করতে সমস্যা হয়েছে।",
      );
    } finally {
      setTrashLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadGroupOptions());
  }, [loadGroupOptions]);

  useEffect(() => {
    if (viewMode !== "single" || showTrash) return;

    const timer = setTimeout(() => {
      void loadQuestions(1, false);
    }, 300);

    return () => clearTimeout(timer);
  }, [loadQuestions, viewMode, showTrash]);

  useEffect(() => {
    const refreshQuestions = () => {
      if (viewMode === "single") {
        void loadQuestions(1, false);
      } else if (selectedExamGroup) {
        void loadGroupQuestions(selectedExamGroup);
      }
      void loadGroupOptions();
    };

    window.addEventListener("shikhasetu:questions-updated", refreshQuestions);
    return () => {
      window.removeEventListener(
        "shikhasetu:questions-updated",
        refreshQuestions,
      );
    };
  }, [loadQuestions, loadGroupOptions, loadGroupQuestions, viewMode, selectedExamGroup]);

  const filteredQuestions = useMemo(() => questions, [questions]);

  const refreshDraftCount = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/questions?status=DRAFT&page=1&limit=1",
        { method: "GET", cache: "no-store" },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setDraftCount(Number(result.pagination?.total ?? 0));
      }
    } catch {
      // Count refresh failure must not interrupt Question Bank usage.
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => refreshDraftCount());
  }, [refreshDraftCount]);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      setSelectedQuestionIds([]);
      setAllMatchingSelected(false);
      setExcludedQuestionIds([]);
    });

    return () => {
      cancelled = true;
    };
  }, [search, filters]);

  const currentFilterPayload = () => ({
    search: search.trim() || undefined,
    yearFrom: filters.from || undefined,
    yearTo: filters.to || undefined,
    institution: filters.institution || undefined,
    exam: filters.exam || undefined,
    post: filters.post || undefined,
    subject: filters.subject || undefined,
    topic: filters.topic || undefined,
    status: filters.status ? filters.status.toUpperCase() : undefined,
  });

  const bulkSelectionCount = allMatchingSelected
    ? Math.max(0, totalQuestions - excludedQuestionIds.length)
    : selectedQuestionIds.length;


  const toggleCurrentPageSelection = () => {
    setAllMatchingSelected(false);
    const currentIds = filteredQuestions.map((question) => question.id);
    const allSelected =
      currentIds.length > 0 &&
      currentIds.every((id) => selectedQuestionIds.includes(id));

    if (allSelected) {
      setSelectedQuestionIds((previous) =>
        previous.filter((id) => !currentIds.includes(id)),
      );
    } else {
      const nextIds = Array.from(
        new Set([...selectedQuestionIds, ...currentIds]),
      );

      if (nextIds.length > 500) {
        setBulkError("একবারে সর্বোচ্চ ৫০০টি প্রশ্ন নির্বাচন করা যাবে। কিছু নির্বাচন Clear করে আবার চেষ্টা করুন।");
        setBulkSuccess("");
        return;
      }

      setSelectedQuestionIds(nextIds);
    }

    setBulkError("");
    setBulkSuccess("");
  };

  const invertCurrentPageSelection = () => {
    const currentIds = filteredQuestions.map((question) => question.id);

    if (allMatchingSelected) {
      const nextExcluded = new Set(excludedQuestionIds);
      currentIds.forEach((id) => {
        if (nextExcluded.has(id)) nextExcluded.delete(id);
        else nextExcluded.add(id);
      });
      setExcludedQuestionIds(Array.from(nextExcluded));
    } else {
      const nextIds = selectedQuestionIds.filter((id) => !currentIds.includes(id));
      const newlySelectedIds = currentIds.filter((id) => !selectedQuestionIds.includes(id));
      const combinedIds = [...nextIds, ...newlySelectedIds];

      if (combinedIds.length > 500) {
        setBulkError("একবারে সর্বোচ্চ ৫০০টি প্রশ্ন নির্বাচন করা যাবে। কিছু নির্বাচন Clear করে আবার চেষ্টা করুন।");
        setBulkSuccess("");
        return;
      }

      setSelectedQuestionIds(combinedIds);
    }

    setBulkError("");
    setBulkSuccess("");
  };

  const applyBulkEdit = async (statusOverride?: string) => {
    if (!allMatchingSelected && selectedQuestionIds.length === 0) {
      setBulkError("প্রথমে প্রশ্ন নির্বাচন করুন অথবা সব Filtered প্রশ্ন নির্বাচন করুন।");
      return;
    }

    if (!allMatchingSelected && selectedQuestionIds.length > 500) {
      setBulkError("একবারে সর্বোচ্চ ৫০০টি প্রশ্ন পরিবর্তন করা যাবে।");
      return;
    }

    const updates: Record<string, string> = {};

    if (bulkDifficulty && !statusOverride) updates.difficulty = bulkDifficulty;
    if (bulkStatus || statusOverride) updates.status = statusOverride || bulkStatus;

    if (Object.keys(updates).length === 0) {
      setBulkError("পরিবর্তনের জন্য Difficulty অথবা Status নির্বাচন করুন।");
      return;
    }

    if (!window.confirm(
      `${allMatchingSelected ? totalQuestions - excludedQuestionIds.length : selectedQuestionIds.length}টি প্রশ্নের তথ্য একসঙ্গে পরিবর্তন করবেন?`,
    )) {
      return;
    }

    setBulkSaving(true);
    setBulkError("");
    setBulkSuccess("");

    try {
      const response = await fetch(allMatchingSelected ? "/api/questions/bulk/filtered" : "/api/questions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(allMatchingSelected
          ? { filters: currentFilterPayload(), excludedIds: excludedQuestionIds, updates: { ...updates, changeNote: "Bulk update across all filtered questions." } }
          : { ids: selectedQuestionIds, updates: { ...updates, changeNote: "Bulk update from Question Bank management." } }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Bulk update করা যায়নি।");
      }

      const count = Number(result.updatedCount ?? 0);

      setBulkSuccess(`${count}টি প্রশ্ন সফলভাবে পরিবর্তন হয়েছে।`);
      setSelectedQuestionIds([]);
      setAllMatchingSelected(false);
      setExcludedQuestionIds([]);
      setBulkDifficulty("");
      setBulkStatus("");

      await loadQuestions(1, false);
      await refreshDraftCount();
      window.dispatchEvent(new Event("shikhasetu:questions-updated"));
    } catch (error) {
      setBulkError(
        error instanceof Error ? error.message : "Bulk update ব্যর্থ হয়েছে।",
      );
    } finally {
      setBulkSaving(false);
    }
  };

  const bulkDeleteQuestions = async () => {
    if (!allMatchingSelected && selectedQuestionIds.length === 0) {
      setBulkError("প্রথমে প্রশ্ন নির্বাচন করুন অথবা সব Filtered প্রশ্ন নির্বাচন করুন।");      return;    }
    if (!allMatchingSelected && selectedQuestionIds.length > 500) {
      setBulkError("একবারে সর্বোচ্চ ৫০০টি প্রশ্ন Trash-এ পাঠানো যাবে।");
      return;
    }

    if (!window.confirm(
      `আপনি কি ${allMatchingSelected ? totalQuestions - excludedQuestionIds.length : selectedQuestionIds.length}টি matching প্রশ্ন Trash-এ পাঠাতে চান? Trash থেকে পরে Recover করা যাবে।`,
    )) {
      return;
    }

    setBulkSaving(true);
    setBulkError("");
    setBulkSuccess("");

    try {
      const idsToDelete = [...selectedQuestionIds];

      const response = await fetch(allMatchingSelected ? "/api/questions/bulk/delete-filtered" : "/api/questions/bulk/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(allMatchingSelected ? { filters: currentFilterPayload(), excludedIds: excludedQuestionIds } : { ids: idsToDelete }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "নির্বাচিত প্রশ্ন Trash-এ পাঠানো যায়নি।");
      }

      const count = Number(result.deletedCount ?? (allMatchingSelected ? totalQuestions : idsToDelete.length));

      setBulkSuccess(`${count}টি প্রশ্ন সফলভাবে Trash-এ পাঠানো হয়েছে।`);
      setSelectedQuestionIds([]);
      setAllMatchingSelected(false);
      setExcludedQuestionIds([]);

      if (allMatchingSelected || (selected && idsToDelete.includes(selected))) {
        setSelected(null);
      }

      if (selectedExamGroup) {
        await loadGroupQuestions(selectedExamGroup);
      } else {
        await loadQuestions(1, false);
      }

      await refreshDraftCount();
      await loadGroupOptions();
      window.dispatchEvent(new Event("shikhasetu:questions-updated"));
    } catch (error) {
      setBulkError(
        error instanceof Error
          ? error.message
          : "Bulk Delete করতে সমস্যা হয়েছে।",
      );
    } finally {
      setBulkSaving(false);
    }
  };
  const bulkPermanentDeleteQuestions = async () => {
    if (bulkSelectionCount === 0) {
      setBulkError("প্রথমে প্রশ্ন নির্বাচন করুন।");
      return;
    }

    const count = bulkSelectionCount;
    if (!window.confirm(`সতর্কতা: ${count.toLocaleString("bn-BD")}টি নির্বাচিত প্রশ্ন সরাসরি Database থেকে স্থায়ীভাবে মুছে যাবে। Trash-এ যাবে না এবং আর Recover করা যাবে না। আপনি কি নিশ্চিত?`)) return;

    setBulkSaving(true);
    setBulkError("");
    setBulkSuccess("");

    try {
      const response = await fetch(allMatchingSelected ? "/api/questions/bulk/permanent-delete-filtered" : "/api/questions/bulk/permanent-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(allMatchingSelected
          ? { filters: currentFilterPayload(), excludedIds: excludedQuestionIds }
          : { ids: selectedQuestionIds }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "নির্বাচিত প্রশ্ন স্থায়ীভাবে মুছে ফেলা যায়নি।");

      const deletedCount = Number(result.deletedCount ?? count);
      setBulkSuccess(`${deletedCount.toLocaleString("bn-BD")}টি প্রশ্ন Trash-এ না পাঠিয়ে স্থায়ীভাবে মুছে ফেলা হয়েছে।`);
      setSelectedQuestionIds([]);
      setAllMatchingSelected(false);
      setExcludedQuestionIds([]);
      setSelected(null);
      await loadQuestions(1, false);
      await refreshDraftCount();
      await loadGroupOptions();
      window.dispatchEvent(new Event("shikhasetu:questions-updated"));
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Permanent Delete ব্যর্থ হয়েছে।");
    } finally {
      setBulkSaving(false);
    }
  };

  const publishAllDrafts = async () => {
    if (draftCount <= 0) {
      setBulkError("Publish করার মতো কোনো Draft প্রশ্ন পাওয়া যায়নি।");
      return;
    }

    if (!window.confirm(
      `Database-এর সব ${draftCount}টি active Draft প্রশ্ন Published করবেন? এই কাজটি সব Draft প্রশ্নের জন্য প্রযোজ্য হবে।`,
    )) {
      return;
    }

    setBulkSaving(true);
    setBulkError("");
    setBulkSuccess("");

    try {
      const response = await fetch("/api/questions/bulk/publish-drafts", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Draft publish করা যায়নি।");
      }

      const count = Number(result.publishedCount ?? 0);

      setBulkSuccess(`${count}টি Draft প্রশ্ন Published হয়েছে।`);
      setSelectedQuestionIds([]);
      await loadQuestions(1, false);
      await refreshDraftCount();
      window.dispatchEvent(new Event("shikhasetu:questions-updated"));
    } catch (error) {
      setBulkError(
        error instanceof Error ? error.message : "Bulk publish ব্যর্থ হয়েছে।",
      );
    } finally {
      setBulkSaving(false);
    }
  };

  const updateFilter = (key: keyof typeof initialFilters, value: string) => {
    setFilters((old) => ({ ...old, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setSearch("");
  };

  const emptyTrash = async () => {
    if (deletedQuestions.length === 0 || emptyingTrash) return;

    const confirmed = window.confirm(
      `Trash-এর ${deletedQuestions.length}টি প্রশ্ন স্থায়ীভাবে Delete করবেন? এই কাজ Undo বা Recover করা যাবে না।`,
    );

    if (!confirmed) return;

    setEmptyingTrash(true);
    setTrashError("");

    try {
      const response = await fetch("/api/questions/trash/empty", {
        method: "DELETE",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Trash খালি করা যায়নি।");
      }

      const deletedCount = Number(result.data?.deletedCount ?? 0);

      setDeletedQuestions([]);
      setPermanentDeleteTarget(null);

      window.alert(
        `${deletedCount.toLocaleString("bn-BD")}টি প্রশ্ন স্থায়ীভাবে Delete করা হয়েছে।`,
      );
    } catch (error) {
      setTrashError(
        error instanceof Error
          ? error.message
          : "Trash খালি করতে সমস্যা হয়েছে।",
      );
    } finally {
      setEmptyingTrash(false);
    }
  };
  const toggleTrash = () => {
    const nextState = !showTrash;
    setShowTrash(nextState);
    if (nextState) void loadTrash();
  };

  const selectedQuestion = questions.find((q) => q.id === selected);

  const openAddForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm, year: String(new Date().getFullYear()) });
    setFormError("");
    setIsFormOpen(true);
  };

  const openEditForm = (q: Question) => {
    setEditingId(q.id);
    setForm({
      institution: q.institution,
      exam: q.exam,
      year: String(q.year),
      post: q.post,
      department: q.department,
      subject: q.subject,
      topic: q.topic,
      questionType: q.questionType,
      question: q.question,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      repeatGroupId: q.repeatGroupId,
      source: q.source,
      status: q.status,
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const updateForm = (key: keyof FormData, value: string) => {
    setForm((old) => ({ ...old, [key]: value }));
  };

  const saveQuestion = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError("");

    const commonRequired: (keyof FormData)[] = [
      "institution",
      "exam",
      "year",
      "post",
      "department",
      "subject",
      "topic",
      "questionType",
      "question",
      "correctAnswer",
      "difficulty",
      "source",
      "status",
    ];

    if (commonRequired.some((key) => !String(form[key]).trim())) {
      setFormError("চিহ্নিত প্রয়োজনীয় ঘরগুলো পূরণ করুন।");
      return;
    }

    const year = Number(form.year);

    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      setFormError("সঠিক সাল লিখুন (১৯০০–২১০০)।");
      return;
    }

    const isMcq = form.questionType === "MCQ";
    const editingQuestion = editingId
      ? questions.find((question) => question.id === editingId)
      : undefined;

    const optionValues = [
      ["A", form.optionA],
      ["B", form.optionB],
      ["C", form.optionC],
      ["D", form.optionD],
    ] as const;

    const options = isMcq
      ? optionValues
          .filter(([label, value]) => value.trim() || (editingQuestion?.optionImages[label]?.length ?? 0) > 0)
          .map(([label, optionText], index) => ({
            label,
            optionText: optionText.trim(),
            imageReferences: editingQuestion?.optionImages[label] ?? [],
            isCorrect: form.correctAnswer === label,
            sortOrder: index,
          }))
      : undefined;

    if (isMcq) {
      if (!options || options.length < 2) {
        setFormError("MCQ প্রশ্নের জন্য অন্তত ২টি Option দিতে হবে।");
        return;
      }

      if (!["A", "B", "C", "D"].includes(form.correctAnswer)) {
        setFormError("সঠিক উত্তর A, B, C অথবা D নির্বাচন করুন।");
        return;
      }

      if (!options.some((option) => option.isCorrect)) {
        setFormError("সঠিক উত্তর হিসেবে দেওয়া Option-টি পূরণ করুন।");
        return;
      }
    }

    const occurrence = {
      institution: form.institution.trim(),
      examName: form.exam.trim(),
      examYear: year,
      postName: form.post.trim(),
      department: form.department.trim(),
      source: form.source.trim(),
    };

    const payload = {
      questionText: form.question.trim(),
      questionType: toApiType(form.questionType),
      subject: form.subject.trim(),
      topic: form.topic.trim(),
      correctAnswer: form.correctAnswer.trim(),
      explanation: form.explanation.trim(),
      difficulty: toApiDifficulty(form.difficulty),
      status: toApiStatus(form.status),
      ...(options ? { options } : {}),
      ...(!editingId ? { occurrences: [occurrence] } : {}),
    };

    setSaving(true);

    try {
      const url = editingId
        ? `/api/questions/${encodeURIComponent(editingId)}`
        : "/api/questions";

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId
            ? {
                ...payload,
                changeNote: "Updated from Question Bank",
              }
            : payload,
        ),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "প্রশ্ন সংরক্ষণ করা যায়নি।");
      }

      const wasEditing = Boolean(editingId);
      const savedQuestionId = result.data?.id ?? editingId ?? "";

      setIsFormOpen(false);
      setSelected(editingId);
      setFormError("");
      await loadQuestions();

      setSuccessDialog({
        title: wasEditing
          ? "প্রশ্ন আপডেট সফল হয়েছে"
          : "নতুন প্রশ্ন সংরক্ষণ হয়েছে",
        message: wasEditing
          ? "প্রশ্নের পরিবর্তন সফলভাবে সংরক্ষণ করা হয়েছে।"
          : "নতুন প্রশ্নটি সফলভাবে Question Bank-এ যোগ হয়েছে।",
        questionId: savedQuestionId,
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "প্রশ্ন সংরক্ষণ করতে সমস্যা হয়েছে।",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!window.confirm("আপনি কি এই প্রশ্নটি Delete করতে চান?")) return;

    try {
      const response = await fetch(
        `/api/questions/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "প্রশ্ন Delete করা যায়নি।");
      }

      if (selected === id) setSelected(null);

      await loadQuestions();

      if (showTrash) await loadTrash();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Delete করতে সমস্যা হয়েছে।",
      );
    }
  };

  const recoverQuestion = async (id: string) => {
    setRecoveringId(id);
    setTrashError("");

    try {
      const response = await fetch(
        `/api/questions/${encodeURIComponent(id)}/recover`,
        { method: "POST" },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "প্রশ্ন Recover করা যায়নি।");
      }

      setDeletedQuestions((old) => old.filter((q) => q.id !== id));

      await loadQuestions();

      setSuccessDialog({
        title: "প্রশ্ন Recover সফল হয়েছে",
        message:
          "প্রশ্নটি সফলভাবে Trash থেকে ফিরিয়ে Question Bank-এ যোগ করা হয়েছে।",
        questionId: id,
      });
    } catch (error) {
      setTrashError(
        error instanceof Error
          ? error.message
          : "প্রশ্ন Recover করতে সমস্যা হয়েছে।",
      );
    } finally {
      setRecoveringId(null);
    }
  };

  const permanentlyDeleteQuestion = async () => {
    if (!permanentDeleteTarget) return;

    const id = permanentDeleteTarget.id;
    setPermanentDeletingId(id);
    setTrashError("");

    try {
      const response = await fetch(
        `/api/questions/${encodeURIComponent(id)}/permanent`,
        { method: "DELETE" },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "প্রশ্ন স্থায়ীভাবে Delete করা যায়নি।",
        );
      }

      setDeletedQuestions((old) => old.filter((q) => q.id !== id));
      setPermanentDeleteTarget(null);

      setSuccessDialog({
        title: "Permanent Delete সফল হয়েছে",
        message:
          "প্রশ্নটি Database থেকে স্থায়ীভাবে মুছে ফেলা হয়েছে। এটি আর Recover করা যাবে না।",
        questionId: id,
      });

      if (showTrash) {
        await loadTrash();
      }
    } catch (error) {
      setTrashError(
        error instanceof Error
          ? error.message
          : "Permanent Delete করতে সমস্যা হয়েছে।",
      );
    } finally {
      setPermanentDeletingId(null);
    }
  };

  const trashQuestionsByScope = async (
    label: string,
    scopeFilters: Record<string, string | undefined>,
  ) => {
    const scope = Object.fromEntries(
      Object.entries(scopeFilters).filter(([, value]) => Boolean(value)),
    );
    if (Object.keys(scope).length === 0) {
      setBulkError("প্রশ্নের Scope নির্ধারণ করা যায়নি।");
      return;
    }

    const confirmed = window.confirm(
      `“${label}” এর সঙ্গে মেলা সব প্রশ্ন Trash-এ পাঠাবেন? প্রশ্নগুলো পরে Trash থেকে Recover করা যাবে।`,
    );
    if (!confirmed) return;

    setBulkSaving(true);
    setBulkError("");
    setBulkSuccess("");
    try {
      const response = await fetch("/api/questions/bulk/delete-filtered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: scope }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "প্রশ্নগুলো Trash-এ পাঠানো যায়নি।");
      }

      const count = Number(result.deletedCount ?? 0);
      setBulkSuccess(`${label} থেকে ${count.toLocaleString("bn-BD")}টি প্রশ্ন Trash-এ পাঠানো হয়েছে।`);
      setSelectedQuestionIds([]);
      setAllMatchingSelected(false);
      setSelected(null);
      await loadQuestions(1, false);
      await loadGroupOptions();
      await refreshDraftCount();
      window.dispatchEvent(new Event("shikhasetu:questions-updated"));
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Bulk Trash ব্যর্থ হয়েছে।");
    } finally {
      setBulkSaving(false);
    }
  };

  const filterOptions = [
    {
      key: "institution",
      label: "প্রতিষ্ঠান",
      options: [...new Set(groupOptions.institutions.map((item) => item.name).filter(Boolean))],
    },
    {
      key: "exam",
      label: "পরীক্ষার নাম",
      options: [...new Set(groupOptions.exams.map((item) => item.examName).filter(Boolean))],
    },
    {
      key: "post",
      label: "পদ",
      options: [...new Set(questions.map((q) => q.post).filter(Boolean))],
    },
    {
      key: "subject",
      label: "বিষয়",
      options: [...new Set(questions.map((q) => q.subject).filter(Boolean))],
    },
    {
      key: "topic",
      label: "টপিক",
      options: [...new Set(questions.map((q) => q.topic).filter(Boolean))],
    },
  ];

  const textField = (
    key: keyof FormData,
    label: string,
    placeholder = "",
    required = true,
  ) => (
    <Input
      label={`${label}${required ? " *" : ""}`}
      placeholder={placeholder}
      value={String(form[key])}
      onChange={(e) => updateForm(key, e.target.value)}
    />
  );

  return (
    <main className="min-h-screen bg-[#f3f6fb] px-3 pb-3 pt-[3px] md:px-5 md:pb-5 md:pt-[3px]">
      <style jsx global>{`@keyframes filter-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } } .filter-marquee-track { animation: filter-marquee 8s linear infinite; } .filter-marquee-track:hover { animation-play-state: paused; }`}</style>
      <div className="mx-auto w-full max-w-none space-y-4">
        <section className="min-h-[76px] rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(360px,0.82fr)_minmax(0,2.18fr)] lg:items-center lg:gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-lg">📖</div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.11em] text-blue-700">SHIKHASETU / ADMIN WORKSPACE</p>
                <h1 className="mt-0.5 whitespace-nowrap text-base font-black leading-tight tracking-tight text-slate-950 xl:text-lg">Question Bank Control Center</h1>
                <p className="mt-0.5 text-sm font-semibold text-slate-600">Manage all questions</p>
              </div>
            </div>
            <div className="grid min-w-0 items-stretch gap-2 lg:grid-cols-[108px_minmax(0,1fr)] lg:border-l lg:border-slate-100 lg:pl-4">              <div className="flex min-h-[64px] items-center justify-center border-b border-slate-100 pb-2 text-center lg:border-b-0 lg:border-r lg:pb-0 lg:pr-2">
                <h2 className="flex flex-col gap-1 whitespace-nowrap text-base font-black leading-none text-slate-900"><span>Import</span><span>&amp;</span><span>Data Tools</span></h2>              </div>
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">                {!showTrash && (
                  <>
                    <Button onClick={openAddForm} className="flex h-full min-h-[80px] w-full min-w-0 flex-col items-center justify-center gap-3 whitespace-normal rounded-md bg-blue-700 px-1 text-sm font-bold leading-tight text-white hover:bg-blue-800"><svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg><span className="text-center text-sm font-bold">নতুন প্রশ্ন</span></Button>
                    <div className="flex h-full min-h-[80px] min-w-0 w-full items-center justify-center rounded-md border border-emerald-200 bg-emerald-50/40 transition-colors hover:border-emerald-400 hover:bg-emerald-100/80"><QuestionImportPanel /></div>
                    <a href="/api/imports/export?format=xlsx" className="inline-flex h-full min-h-[80px] w-full min-w-0 flex-col items-center justify-center gap-3 whitespace-normal rounded-md border border-slate-300 bg-white px-1 text-sm font-bold leading-tight text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100"><svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 shrink-0"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 17v4h14v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg><span className="text-sm font-bold">Export</span></a>
                    <div className="flex h-full min-h-[80px] min-w-0 w-full items-center justify-center rounded-md border border-violet-200 bg-violet-50/40 transition-colors hover:border-violet-400 hover:bg-violet-100/80"><QuestionImportTemplates /></div>
                    <div className="flex h-full min-h-[80px] min-w-0 w-full items-center justify-center rounded-md border border-blue-200 bg-blue-50/40 transition-colors hover:border-blue-400 hover:bg-blue-100/80"><QuestionImportHistory /></div>
                  </>
                )}
                <button type="button" onClick={toggleTrash} className={`flex h-full min-h-[80px] w-full min-w-0 flex-col items-center justify-center gap-3 whitespace-normal rounded-md border px-1 text-sm font-bold leading-tight transition-colors ${showTrash ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100" : "border-red-200 bg-red-50/50 text-red-700 hover:bg-red-50"}`}>
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="text-center text-sm font-bold">{showTrash ? "Question Bank" : "Trash"}{!showTrash && deletedQuestions.length > 0 ? ` (${deletedQuestions.length.toLocaleString("bn-BD")})` : ""}</span>
                </button>
              </div>
            </div>
          </div>
        </section>



        {!showTrash && (
          <>
        {pageError && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {pageError}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadQuestions()}
              className="ml-3"
            >
              আবার চেষ্টা করুন
            </Button>
          </div>
        )}

          </>
        )}

        {showTrash && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>🗑 মুছে ফেলা প্রশ্ন (Trash)</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    প্রশ্ন Recover অথবা স্থায়ীভাবে Delete করতে পারবেন।
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void emptyTrash()}
                  disabled={
                    deletedQuestions.length === 0 ||
                    trashLoading ||
                    emptyingTrash ||
                    recoveringId !== null ||
                    permanentDeletingId !== null
                  }
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  {emptyingTrash ? "Trash খালি হচ্ছে..." : "সব Trash Delete করুন"}
                </Button>                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void loadTrash()}
                  disabled={trashLoading || permanentDeletingId !== null}
                >
                  ↻ Refresh
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {trashError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {trashError}
                </div>
              )}

              {trashLoading ? (
                <div className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
                  Trash থেকে প্রশ্ন লোড হচ্ছে...
                </div>
              ) : deletedQuestions.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-8 text-center">
                  <p className="text-2xl">🗑️</p>
                  <p className="mt-2 font-bold text-slate-700">Trash খালি</p>
                  <p className="mt-1 text-sm text-slate-500">
                    বর্তমানে কোনো মুছে ফেলা প্রশ্ন নেই।
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deletedQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-orange-200 bg-orange-50/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="break-all text-xs font-bold text-slate-600">
                          {q.id}
                        </span>
                        <Badge>Trash</Badge>
                      </div>

                      <p className={`${tableDensity === "ultra" ? "mt-1 text-sm" : "mt-2 font-bold text-slate-900"}`}>
                        {q.question}
                      </p>
                      {q.imageReferences.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{q.imageReferences.map((source, imageIndex) => <img key={imageIndex} src={source} alt={`Question image ${imageIndex + 1}`} loading="lazy" className="max-h-28 max-w-48 rounded border border-slate-200 object-contain" />)}</div>}

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        {q.institution && <span>{q.institution}</span>}
                        {q.exam && <span>• {q.exam}</span>}
                        {q.year && <span>• {q.year}</span>}
                        {q.subject && <span>• {q.subject}</span>}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 border-t border-orange-100 pt-3">
                        <Button
                          size="sm"
                          onClick={() => void recoverQuestion(q.id)}
                          disabled={
                            recoveringId !== null ||
                            permanentDeletingId !== null
                          }
                        >
                          {recoveringId === q.id
                            ? "Recover হচ্ছে..."
                            : "↶ Recover"}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPermanentDeleteTarget(q)}
                          disabled={
                            recoveringId !== null ||
                            permanentDeletingId !== null
                          }
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          {permanentDeletingId === q.id
                            ? "Delete হচ্ছে..."
                            : "✕ Permanent Delete"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!showTrash && (
          <>
        {isFormOpen && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>
                  {editingId ? "প্রশ্ন Edit করুন" : "নতুন প্রশ্ন যোগ করুন"}
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsFormOpen(false)}
                >
                  ✕ বন্ধ
                </Button>
              </div>
              <p className="text-sm text-slate-500">
                * চিহ্নিত ঘরগুলো পূরণ করা বাধ্যতামূলক।
              </p>
            </CardHeader>

            <CardContent>
              <form onSubmit={saveQuestion} className="space-y-6">
                <section className="space-y-3">
                  <h3 className="font-bold text-slate-800">পরীক্ষার তথ্য</h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    {textField("institution", "Organization / প্রতিষ্ঠান")}
                    {textField("exam", "Exam Name / পরীক্ষার নাম")}
                    {textField("year", "Year / সাল", "যেমন: 2024")}
                    {textField("post", "Post Name / পদের নাম")}
                    {textField("department", "Department / বিভাগ")}
                    {textField("subject", "Subject / বিষয়")}
                    {textField("topic", "Topic / অধ্যায়")}

                    <Select
                      label="Question Type / প্রশ্নের ধরন *"
                      value={form.questionType}
                      onChange={(e) => {
                        updateForm("questionType", e.target.value);
                        updateForm("correctAnswer", "");
                      }}
                    >
                      <option value="MCQ">MCQ</option>
                      <option value="Written">Written</option>
                      <option value="True/False">True / False</option>
                      <option value="Fill in the Blanks">
                        Fill in the Blanks
                      </option>
                    </Select>
                  </div>
                </section>

                <section className="space-y-3 border-t border-slate-100 pt-5">
                  <h3 className="font-bold text-slate-800">প্রশ্ন ও অপশন</h3>

                  <div className="grid gap-4">
                    {textField(
                      "question",
                      "Question / প্রশ্ন",
                      "সম্পূর্ণ প্রশ্ন লিখুন",
                    )}

                    {form.questionType === "MCQ" && (
                      <div className="grid gap-4 md:grid-cols-2">
                        {textField("optionA", "Option A", "প্রথম অপশন")}
                        {textField("optionB", "Option B", "দ্বিতীয় অপশন")}
                        {textField("optionC", "Option C", "তৃতীয় অপশন", false)}
                        {textField("optionD", "Option D", "চতুর্থ অপশন", false)}
                      </div>
                    )}

                    {form.questionType === "MCQ" ? (
                      <Select
                        label="Correct Answer / সঠিক উত্তর *"
                        value={form.correctAnswer}
                        onChange={(e) =>
                          updateForm("correctAnswer", e.target.value)
                        }
                      >
                        <option value="">সঠিক অপশন নির্বাচন করুন</option>
                        {["A", "B", "C", "D"].map((option) => (
                          <option
                            key={option}
                            value={option}
                            disabled={
                              !form[
                                `option${option}` as
                                  | "optionA"
                                  | "optionB"
                                  | "optionC"
                                  | "optionD"
                              ].trim()
                            }
                          >
                            {option}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      textField(
                        "correctAnswer",
                        "Correct Answer / সঠিক উত্তর",
                        "সঠিক উত্তর লিখুন",
                      )
                    )}

                    <label className="block text-sm font-medium text-slate-700">
                      Explanation / ব্যাখ্যা (ঐচ্ছিক)
                      <textarea
                        className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="উত্তরের বিস্তারিত ব্যাখ্যা লিখুন"
                        value={form.explanation}
                        onChange={(e) =>
                          updateForm("explanation", e.target.value)
                        }
                      />
                    </label>
                  </div>
                </section>

                <section className="space-y-3 border-t border-slate-100 pt-5">
                  <h3 className="font-bold text-slate-800">অতিরিক্ত তথ্য</h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Select
                      label="Difficulty / কঠিনতার মাত্রা *"
                      value={form.difficulty}
                      onChange={(e) =>
                        updateForm("difficulty", e.target.value)
                      }
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </Select>

                    {textField(
                      "repeatGroupId",
                      "Repeat Group ID",
                      "একই প্রশ্নের গ্রুপ ID",
                      false,
                    )}

                    {textField("source", "Source / উৎস", "যেমন: PDF নাম")}

                    <Select
                      label="Status / অবস্থা *"
                      value={form.status}
                      onChange={(e) => updateForm("status", e.target.value)}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Published">Published</option>
                      <option value="Hidden">Hidden</option>
                      <option value="Archived">Archived</option>
                    </Select>
                  </div>
                </section>

                <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  <strong>Question ID:</strong>{" "}
                  {editingId ||
                    "নতুন প্রশ্ন সংরক্ষণ করলে Backend ID তৈরি করবে"}
                </div>

                {formError && (
                  <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
                    {formError}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving
                      ? "সংরক্ষণ হচ্ছে..."
                      : editingId
                        ? "পরিবর্তন সংরক্ষণ"
                        : "প্রশ্ন যোগ করুন"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsFormOpen(false)}
                    disabled={saving}
                  >
                    বাতিল
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setManagementWorkspaceOpen((open) => !open)}
              aria-expanded={managementWorkspaceOpen}
              aria-label={managementWorkspaceOpen ? "Hide Control Center" : "Show Control Center"}
              className="flex h-10 shrink-0 items-center gap-2 rounded-md px-1 text-left text-base font-black tracking-tight text-slate-950 transition-colors hover:bg-slate-50 focus-visible:outline-none sm:text-lg"
            >
              <span className="text-xl" aria-hidden="true">▦</span>
              <span className="whitespace-nowrap">Management &amp; Control</span>
              <span className="ml-1 text-sm text-slate-500" aria-hidden="true">{managementWorkspaceOpen ? "⌃" : "⌄"}</span>
            </button>

            <div className="mx-[100px] min-w-[220px] flex-1">
              <div className="box-border flex h-10 min-w-0 items-center gap-2 rounded-md border-2 border-slate-400 bg-white px-3 transition-[border-color,background-color,box-shadow] duration-150 focus-within:border-blue-700 focus-within:bg-white focus-within:shadow-none">
                <span className="shrink-0 text-lg text-slate-500" aria-hidden="true">⌕</span>
                <input
                  type="search"
                  aria-label="Search questions"
                  placeholder="Search questions by keyword..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-sm text-slate-900 shadow-none outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                disabled={loading || filteredQuestions.length === 0 || bulkSaving}
                onClick={toggleCurrentPageSelection}
                aria-label="Select current page"
                aria-pressed={filteredQuestions.length > 0 && filteredQuestions.every((q) => selectedQuestionIds.includes(q.id))}
                className={`flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 ${filteredQuestions.length > 0 && filteredQuestions.every((q) => selectedQuestionIds.includes(q.id)) ? "border-blue-700 bg-blue-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800"}`}
              >
                <span aria-hidden="true">☑</span><span>Select</span>
              </button>
              <button
                type="button"
                disabled={loading || totalQuestions === 0 || bulkSaving}
                onClick={() => { setSelectedQuestionIds([]); setAllMatchingSelected(true); setExcludedQuestionIds([]); setBulkError(""); setBulkSuccess(""); }}
                aria-label="Select all filtered questions"
                aria-pressed={allMatchingSelected}
                className={`flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 ${allMatchingSelected ? "border-blue-700 bg-blue-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800"}`}
              >
                <span aria-hidden="true">▣</span><span>Select All</span>
              </button>
              <button
                type="button"
                disabled={loading || filteredQuestions.length === 0 || bulkSaving}
                onClick={invertCurrentPageSelection}
                aria-label="Invert current page selection"
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true">⇄</span><span>Invert</span>
              </button>
              <button
                type="button"
                disabled={(selectedQuestionIds.length === 0 && !allMatchingSelected) || bulkSaving}
                onClick={() => { setSelectedQuestionIds([]); setAllMatchingSelected(false); setExcludedQuestionIds([]); setBulkError(""); setBulkSuccess(""); }}
                aria-label="Clear selection"
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true">✕</span><span>Clear</span>
              </button>
            </div>

          </div>

          {managementWorkspaceOpen && (
            <div className="mt-2 space-y-2">
              <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 xl:grid-cols-2 xl:gap-x-6"><div className="flex min-w-0 flex-col">
                  <div className="mb-1 flex items-center gap-2 px-0.5 text-[11px] font-bold tracking-wide text-slate-500">
                    <span className="whitespace-nowrap">Management Workspace</span>
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="mx-auto grid w-full min-w-0 grid-cols-4 gap-3">
                    <button
                      type="button"
                      aria-pressed={viewMode === "single" && !filters.subject}
                      onClick={() => { setViewMode("single"); setSelectedExamGroup(null); setSelectedInstitutionKey(null); setSelected(null); setSelectedQuestionIds([]); setAllMatchingSelected(false); setExcludedQuestionIds([]); }}
                      className={`flex h-[58px] w-full min-w-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md border px-1 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${viewMode === "single" && !filters.subject ? "border-blue-700 bg-blue-700 text-white shadow-sm" : "border-blue-200 bg-blue-50/60 text-blue-800 hover:border-blue-400 hover:bg-blue-100"}`}
                    >
                      <span className="text-2xl leading-none" aria-hidden="true">▰</span>
                      <span className="text-sm font-extrabold whitespace-nowrap">All Ques - <strong className="text-base font-black tabular-nums">{globalStats.totalQuestions.toLocaleString("en-US")}</strong></span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={viewMode === "institution"}
                      onClick={() => { setViewMode("institution"); setSelectedExamGroup(null); setSelectedInstitutionKey(null); setSelected(null); setSelectedQuestionIds([]); setAllMatchingSelected(false); setExcludedQuestionIds([]); void loadGroupOptions(); }}
                      className={`flex h-[58px] w-full min-w-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md border px-1 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${viewMode === "institution" ? "border-blue-700 bg-blue-700 text-white shadow-sm" : "border-blue-200 bg-blue-50/60 text-blue-800 hover:border-blue-400 hover:bg-blue-100"}`}
                    >
                      <span className="text-2xl leading-none" aria-hidden="true">🏛️</span>
                      <span className="text-sm font-extrabold whitespace-nowrap">Institute - <strong className="text-base font-black tabular-nums">{String(globalStats.totalInstitutions).padStart(2, "0")}</strong></span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={viewMode === "exam"}
                      onClick={() => { setViewMode("exam"); setSelectedExamGroup(null); setSelectedInstitutionKey(null); setSelected(null); setSelectedQuestionIds([]); setAllMatchingSelected(false); setExcludedQuestionIds([]); void loadGroupOptions(); }}
                      className={`flex h-[58px] w-full min-w-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md border px-1 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${viewMode === "exam" ? "border-blue-700 bg-blue-700 text-white shadow-sm" : "border-blue-200 bg-blue-50/60 text-blue-800 hover:border-blue-400 hover:bg-blue-100"}`}
                    >
                      <span className="text-2xl leading-none" aria-hidden="true">📋</span>
                      <span className="text-sm font-extrabold whitespace-nowrap">Exam - <strong className="text-base font-black tabular-nums">{String(globalStats.totalExams).padStart(2, "0")}</strong></span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={Boolean(filters.subject)}
                      onClick={() => { setViewMode("single"); setSelectedExamGroup(null); setSelectedInstitutionKey(null); setSelected(null); setSelectedQuestionIds([]); setAllMatchingSelected(false); setExcludedQuestionIds([]); setFilters({ ...initialFilters, subject: "" }); setSearch(""); }}
                      className={`flex h-[58px] w-full min-w-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md border px-1 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${filters.subject ? "border-blue-700 bg-blue-700 text-white shadow-sm" : "border-blue-200 bg-blue-50/60 text-blue-800 hover:border-blue-400 hover:bg-blue-100"}`}
                    >
                      <span className="text-2xl leading-none" aria-hidden="true">📖</span>
                      <span className="text-sm font-extrabold whitespace-nowrap">Subjects - <strong className="text-base font-black tabular-nums">{String(globalStats.totalSubjects).padStart(2, "0")}</strong></span>
                    </button>
                  </div>
                </div><div className="flex min-w-0 flex-col"><div className="mb-1 flex items-center gap-2 px-0.5 text-[11px] font-bold tracking-wide text-slate-500"><span className="whitespace-nowrap">Actions</span><span className="h-px flex-1 bg-slate-200" /></div><div className="grid min-w-0 grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.35fr)] auto-rows-[58px] gap-3">
                  <button type="button" disabled={bulkSaving || draftCount === 0} onClick={() => void publishAllDrafts()} className="flex h-[58px] w-full min-w-0 flex-col items-center justify-center overflow-hidden gap-1.5 rounded-md border border-emerald-700 bg-emerald-700 px-0.5 py-1 text-center text-white transition-colors hover:border-emerald-800 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                    <span className="text-[11px] font-extrabold leading-tight">Publish All</span><strong className="text-xs font-black tabular-nums">{draftCount.toLocaleString("en-US")}</strong>
                  </button>
                  <a href="/api/imports/export?format=json" className="flex h-[58px] w-full min-w-0 items-center justify-center gap-2 overflow-hidden rounded-md border border-blue-200 bg-blue-50/60 px-0.5 text-center text-[11px] font-extrabold text-blue-800 transition-colors hover:border-blue-400 hover:bg-blue-100">
                    <span className="text-lg leading-none">{"{ }"}</span><span>JSON</span><span className="text-base leading-none" aria-hidden="true">⇩</span>
                  </a>
                  <a href="/api/imports/export?format=csv" className="flex h-[58px] w-full min-w-0 items-center justify-center gap-2 overflow-hidden rounded-md border border-blue-200 bg-blue-50/60 px-0.5 text-center text-[11px] font-extrabold text-blue-800 transition-colors hover:border-blue-400 hover:bg-blue-100">
                    <span className="text-lg leading-none">▤</span><span>CSV</span><span className="text-base leading-none" aria-hidden="true">⇩</span>
                  </a>
                  <a href="/api/imports/export?format=xlsx" className="flex h-[58px] w-full min-w-0 items-center justify-center gap-2 overflow-hidden rounded-md border border-blue-200 bg-blue-50/60 px-0.5 text-center text-[11px] font-extrabold text-blue-800 transition-colors hover:border-blue-400 hover:bg-blue-100">
                    <span className="text-lg leading-none">▦</span><span>Excel</span><span className="text-base leading-none" aria-hidden="true">⇩</span>
                  </a>
                  <button type="button" disabled={bulkSaving || bulkSelectionCount === 0} onClick={() => void bulkDeleteQuestions()} className="flex h-[58px] w-full min-w-0 flex-col items-center justify-center overflow-hidden gap-2 rounded-md border border-amber-700 bg-amber-600 px-0.5 py-1 text-center text-white transition-colors hover:border-amber-800 hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">
                    <span className="text-xl leading-none" aria-hidden="true">🗑</span><span className="text-[11px] font-extrabold leading-tight">Delete</span>
                  </button>
                  <button type="button" disabled={bulkSaving || bulkSelectionCount === 0} onClick={() => void bulkPermanentDeleteQuestions()} className="flex h-[58px] w-full min-w-0 flex-col items-center justify-center overflow-hidden gap-2 rounded-md border border-red-700 bg-red-700 px-0.5 py-1 text-center text-white transition-colors hover:border-red-800 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
                    <span className="text-xl leading-none" aria-hidden="true">⚠</span><span className="text-[11px] font-extrabold leading-tight">Permanent Delete</span>
                  </button>
                  </div></div></div><div className="min-w-0"><div className="mb-1 flex items-center gap-2 px-0.5 text-[11px] font-bold tracking-wide text-slate-500"><span className="whitespace-nowrap">Filters</span><span className="h-px flex-1 bg-slate-200" /></div><div className="rounded-md border border-slate-200 bg-slate-50/70 p-2">
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-[repeat(8,minmax(0,1fr))_36px]">
                  {filterOptions.slice(0, 3).map((item) => {
                    const value = filters[item.key as keyof typeof initialFilters];
                    const display = value || (item.key === "institution" ? "Institution" : item.key === "exam" ? "Exam" : "Post");
                    const long = display.length > 15;
                    return (
                      <div key={item.key} className="relative h-10 w-full min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white">
                        <select aria-label={item.key} value={value} onChange={(e) => updateFilter(item.key as keyof typeof initialFilters, e.target.value)} className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none border-0 bg-transparent px-2 text-transparent outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400">
                          <option value="">{item.key === "institution" ? "Institution" : item.key === "exam" ? "Exam" : "Post"}</option>
                          {item.options.map((option) => <option key={option} value={option} className="text-slate-900">{option}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-5">
                          {long ? (
                            <span className="filter-marquee-track flex w-max shrink-0 items-center gap-8 whitespace-nowrap text-[13px] font-medium text-slate-700">
                              <span>{display}</span><span aria-hidden="true">{display}</span>
                            </span>
                          ) : (
                            <span className="max-w-full truncate whitespace-nowrap text-center text-[13px] font-medium text-slate-700">{display}</span>
                          )}
                        </div>
                        <span className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 text-[10px] text-slate-500">▾</span>
                      </div>
                    );
                  })}
                  <div className="relative h-10 w-full min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white">
                    <select aria-label="Year From" value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none border-0 bg-transparent px-2 text-transparent outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400">
                      <option value="">Year From</option>{Array.from({ length: 27 }, (_, i) => 2000 + i).map((year) => <option key={year} value={year} className="text-slate-900">{year}</option>)}
                    </select>
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center whitespace-nowrap text-[13px] font-medium text-slate-700">{filters.from || "Year From"}</span>
                    <span className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 text-[10px] text-slate-500">▾</span>
                  </div>
                  <div className="relative h-10 w-full min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white">
                    <select aria-label="Year To" value={filters.to} onChange={(e) => updateFilter("to", e.target.value)} className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none border-0 bg-transparent px-2 text-transparent outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400">
                      <option value="">Year To</option>{Array.from({ length: 27 }, (_, i) => 2000 + i).map((year) => <option key={year} value={year} className="text-slate-900">{year}</option>)}
                    </select>
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center whitespace-nowrap text-[13px] font-medium text-slate-700">{filters.to || "Year To"}</span>
                    <span className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 text-[10px] text-slate-500">▾</span>
                  </div>
                  {filterOptions.slice(3).map((item) => {
                    const value = filters[item.key as keyof typeof initialFilters];
                    const display = value || (item.key === "subject" ? "Subject" : "Topics");
                    const long = display.length > 15;
                    return (
                      <div key={item.key} className="relative h-10 w-full min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white">
                        <select aria-label={item.key} value={value} onChange={(e) => updateFilter(item.key as keyof typeof initialFilters, e.target.value)} className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none border-0 bg-transparent px-2 text-transparent outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400">
                          <option value="">{item.key === "subject" ? "Subject" : "Topics"}</option>
                          {item.options.map((option) => <option key={option} value={option} className="text-slate-900">{option}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-5">
                          {long ? (
                            <span className="filter-marquee-track flex w-max shrink-0 items-center gap-8 whitespace-nowrap text-[13px] font-medium text-slate-700">
                              <span>{display}</span><span aria-hidden="true">{display}</span>
                            </span>
                          ) : (
                            <span className="max-w-full truncate whitespace-nowrap text-center text-[13px] font-medium text-slate-700">{display}</span>
                          )}
                        </div>
                        <span className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 text-[10px] text-slate-500">▾</span>
                      </div>
                    );
                  })}
                  <div className="relative h-10 w-full min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white">
                    <select aria-label="Status" value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none border-0 bg-transparent px-2 text-transparent outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400">
                      <option value="">Status</option><option value="DRAFT" className="text-slate-900">Draft</option><option value="PUBLISHED" className="text-slate-900">Published</option><option value="HIDDEN" className="text-slate-900">Hidden</option><option value="ARCHIVED" className="text-slate-900">Archived</option>
                    </select>
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center whitespace-nowrap text-[13px] font-medium text-slate-700">{filters.status ? ({ DRAFT: "Draft", PUBLISHED: "Published", HIDDEN: "Hidden", ARCHIVED: "Archived" } as Record<string, string>)[filters.status] : "Status"}</span>
                    <span className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 text-[10px] text-slate-500">▾</span>
                  </div>
                  <button type="button" onClick={resetFilters} aria-label="Reset all filters" title="Reset filters" className="flex h-10 w-full items-center justify-center rounded-md border border-amber-300 bg-amber-50 text-lg font-black text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">↻</button>
                </div>
              </div></div>

              <div className="min-w-0"><div className="mb-2 flex items-center gap-2 px-0.5 text-[11px] font-bold tracking-wide text-slate-500"><span className="whitespace-nowrap">Bulk Edit</span><span className="h-px flex-1 bg-slate-200" /></div><div className="grid min-w-0 grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 auto-rows-[70px] gap-1.5">
                    <label className="flex h-[70px] w-full min-w-0 flex-col items-center justify-center overflow-hidden gap-1 rounded-md border border-blue-200 bg-blue-50/60 p-1.5 text-center text-[11px] font-extrabold text-blue-800 transition-colors hover:border-blue-400 hover:bg-blue-100">
                      Difficulty
                      <Select aria-label="Bulk Difficulty" value={bulkDifficulty} onChange={(e) => setBulkDifficulty(e.target.value)} disabled={bulkSaving} className="h-8 min-h-8 w-full min-w-0 px-1 text-[11px]">
                        <option value="">No change</option><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
                      </Select>
                    </label>
                    <label className="flex h-[70px] w-full min-w-0 flex-col items-center justify-center overflow-hidden gap-1 rounded-md border border-blue-200 bg-blue-50/60 p-1.5 text-center text-[11px] font-extrabold text-blue-800 transition-colors hover:border-blue-400 hover:bg-blue-100">
                      Status
                      <Select aria-label="Bulk Status" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} disabled={bulkSaving} className="h-8 min-h-8 w-full min-w-0 px-1 text-[11px]">
                        <option value="">No change</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="HIDDEN">Hidden</option><option value="ARCHIVED">Archived</option>
                      </Select>
                    </label>
                    {["Subject", "Topic", "Institution", "Exam", "Post"].map((field) => (
                      <div key={field} aria-label={`Bulk ${field} (not available yet)`} className="flex h-[70px] w-full min-w-0 flex-col items-center justify-center overflow-hidden gap-1 rounded-md border border-blue-200 bg-blue-50/60 p-1.5 text-center text-[11px] font-extrabold text-blue-800 transition-colors hover:border-blue-400 hover:bg-blue-100">
                        {field}
                        <span className="flex h-8 w-full items-center justify-center overflow-hidden rounded-md border border-blue-200 bg-white px-1 text-center text-[10px] font-semibold">Coming soon</span>
                      </div>
                    ))}
                    <button type="button" disabled={bulkSaving || bulkSelectionCount === 0 || (!bulkDifficulty && !bulkStatus)} onClick={() => void applyBulkEdit()} className="flex h-[70px] w-full min-w-0 flex-col items-center justify-center overflow-hidden gap-1 rounded-md border border-blue-200 bg-blue-50/60 px-1 py-1.5 text-center text-blue-800 transition-colors hover:border-blue-400 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                      <span className="text-lg leading-none" aria-hidden="true">✓</span><span className="text-[11px] font-extrabold leading-tight">Apply</span>
                    </button>
                  </div></div>
              {(bulkError || bulkSuccess) && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  {bulkError && <p role="alert" className="text-xs font-medium text-red-700">{bulkError}</p>}
                  {bulkSuccess && <p role="status" className="text-xs font-medium text-emerald-800">{bulkSuccess}</p>}
                </div>
              )}

              <div className="flex min-w-0 flex-wrap items-center justify-start gap-x-[100px] gap-y-2 overflow-visible rounded-md border border-slate-200 bg-white py-2 pl-[100px] pr-4 text-base font-semibold text-slate-700">
                <p className="whitespace-nowrap text-left">Found: <strong className="text-lg font-extrabold text-blue-700">{totalQuestions.toLocaleString("en-US")}</strong> Questions</p>
                <p className="whitespace-nowrap text-left text-sm font-extrabold tabular-nums text-blue-800">Total: {bulkSelectionCount.toLocaleString("en-US")} Selected</p>
                <p className="whitespace-nowrap text-left text-base font-bold text-slate-700">📊 Operation Report: <span className="font-semibold">Success: — | Failed: —</span></p>
              </div>
            </div>
          )}
        </section>

        {viewMode !== "single" && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>
                    {viewMode === "exam" ? "পরীক্ষাভিত্তিক প্রশ্ন" : "প্রতিষ্ঠানভিত্তিক প্রশ্ন"}
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    একটি নির্দিষ্ট Exam নির্বাচন করলে শুধু সেই Exam-এর প্রশ্ন লোড হবে।
                  </p>
                </div>
                {selectedExamGroup && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedExamGroup(null);
                      setSelected(null);
                      setQuestions([]);
                      setTotalQuestions(0);
                    }}
                  >
                    ← Exam তালিকায় ফিরুন
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedExamGroup && viewMode === "institution" && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {groupOptions.institutions.map((institution) => (
                    <div
                      key={institution.groupKey}
                      className={`rounded-xl border p-4 transition ${
                        selectedInstitutionKey === institution.groupKey
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-blue-300"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedInstitutionKey(institution.groupKey)}
                        className="w-full text-left"
                      >
                        <p className="font-bold text-slate-900">{institution.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {institution.exams.length.toLocaleString("bn-BD")} টি Exam
                        </p>
                      </button>
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={bulkSaving}
                          onClick={() => void trashQuestionsByScope(
                            institution.name,
                            { institution: institution.name },
                          )}
                          className="border-red-200 text-red-700 hover:bg-red-50"
                        >
                          প্রতিষ্ঠানের সব প্রশ্ন Trash
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setFilters({ ...initialFilters, institution: institution.name });
                            setSearch("");
                            setViewMode("single");
                            setSelectedInstitutionKey(null);
                            setSelectedExamGroup(null);
                          }}
                        >
                          প্রশ্নগুলো দেখুন
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!selectedExamGroup && (
                <div className="space-y-2">
                  {(
                    viewMode === "exam"
                      ? groupOptions.exams
                      : groupOptions.institutions.find(
                          (item) => item.groupKey === selectedInstitutionKey,
                        )?.exams ?? []
                  ).map((group) => (
                    <div
                      key={group.groupKey}
                      className="w-full rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300"
                    >
                      <button
                        type="button"
                        onClick={() => void loadGroupQuestions(group)}
                        className="w-full text-left"
                      >
                        <p className="font-bold text-slate-900">{group.examName}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {group.institutionName} · {group.examYear}
                          {group.postName ? ` · ${group.postName}` : ""}                          {group.department ? ` · ${group.department}` : ""}                        </p>
                      </button>
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={bulkSaving}
                          onClick={() => void trashQuestionsByScope(
                            `${group.institutionName} / ${group.examName} / ${group.examYear}`,
                            {
                              institution: group.institutionName,
                              exam: group.examName,
                              yearFrom: String(group.examYear),
                              yearTo: String(group.examYear),
                              ...(group.postName ? { post: group.postName } : {}),
                            },
                          )}
                          className="border-red-200 text-red-700 hover:bg-red-50"
                        >
                          এই Exam-এর সব প্রশ্ন Trash
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setFilters({
                              ...initialFilters,
                              institution: group.institutionName,
                              exam: group.examName,
                              from: String(group.examYear),
                              to: String(group.examYear),
                              ...(group.postName ? { post: group.postName } : {}),
                            });
                            setSearch("");
                            setViewMode("single");
                            setSelectedExamGroup(null);
                          }}
                        >
                          প্রশ্নগুলো দেখুন
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!selectedExamGroup &&
                (viewMode === "exam" ? groupOptions.exams.length === 0 : groupOptions.institutions.length === 0) && (
                  <p className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
                    কোনো Exam group পাওয়া যায়নি।
                  </p>
                )}

              {!selectedExamGroup &&
                viewMode === "institution" &&
                selectedInstitutionKey &&
                (groupOptions.institutions.find(
                  (item) => item.groupKey === selectedInstitutionKey,
                )?.exams.length ?? 0) === 0 && (
                  <p className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
                    এই প্রতিষ্ঠানের কোনো Exam পাওয়া যায়নি।
                  </p>
                )}

              {selectedExamGroup && (
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="font-bold text-blue-900">
                    {selectedExamGroup.institutionName} — {selectedExamGroup.examName}
                  </p>
                  <p className="mt-1 text-sm text-blue-800">
                    {selectedExamGroup.examYear}
                    {selectedExamGroup.postName ? ` · ${selectedExamGroup.postName}` : ""}
                    {selectedExamGroup.department ? ` · ${selectedExamGroup.department}` : ""}
                    {" · "}
                    {totalQuestions.toLocaleString("bn-BD")} টি প্রশ্ন
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}


        {(viewMode === "single" || selectedExamGroup) && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle>প্রশ্নের তালিকা</CardTitle>
              <p className="text-sm text-slate-500">
                প্রশ্ন নির্বাচন করে বিস্তারিত তথ্য দেখুন।
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label="Table density">
              <button type="button" onClick={() => setTableDensity("compact")} aria-pressed={tableDensity === "compact"} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${tableDensity === "compact" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Compact</button>
              <button type="button" onClick={() => setTableDensity("ultra")} aria-pressed={tableDensity === "ultra"} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${tableDensity === "ultra" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Ultra compact</button>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="rounded-xl bg-slate-50 p-10 text-center text-slate-500">
                Database থেকে প্রশ্ন লোড হচ্ছে...
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                  <thead className="bg-slate-100/90 text-xs font-bold uppercase text-slate-600">
                    <tr>
                      <th className="w-12 px-3 py-3"><input type="checkbox" aria-label="বর্তমান পৃষ্ঠার সব প্রশ্ন নির্বাচন" checked={filteredQuestions.length > 0 && filteredQuestions.every((q) => selectedQuestionIds.includes(q.id))} onChange={toggleCurrentPageSelection} disabled={loading || bulkSaving || allMatchingSelected} className="h-4 w-4 accent-blue-600" /></th>
                      <th className="px-3 py-3">#</th><th className="px-3 py-3">প্রশ্ন</th><th className="px-3 py-3">প্রতিষ্ঠান</th><th className="px-3 py-3">পরীক্ষা</th><th className="px-3 py-3">বিষয়</th><th className="px-3 py-3">পদ</th><th className="px-3 py-3">স্থিতি</th><th className="px-3 py-3 text-right">কার্যক্রম</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredQuestions.map((q, index) => (
                      <tr key={q.id} className={`transition hover:bg-blue-50/50 ${(allMatchingSelected && !excludedQuestionIds.includes(q.id)) || selectedQuestionIds.includes(q.id) ? "bg-blue-50/70" : "bg-white"} ${tableDensity === "ultra" ? "text-xs" : "text-sm"}`}>
                        <td className="px-3 py-2"><input type="checkbox" aria-label="প্রশ্ন নির্বাচন করুন" checked={allMatchingSelected ? !excludedQuestionIds.includes(q.id) : selectedQuestionIds.includes(q.id)} disabled={bulkSaving} onChange={() => { if (allMatchingSelected) { setExcludedQuestionIds((previous) => previous.includes(q.id) ? previous.filter((id) => id !== q.id) : [...previous, q.id]); } else { setSelectedQuestionIds((previous) => previous.includes(q.id) ? previous.filter((id) => id !== q.id) : previous.length < 500 ? [...previous, q.id] : previous); } setBulkError(""); setBulkSuccess(""); }} className="h-4 w-4 accent-blue-600" /></td>
                        <td className="px-3 py-2 font-semibold text-slate-500">{((currentPage - 1) * 25 + index + 1).toLocaleString("bn-BD")}</td>
                        <td className="max-w-[340px] px-3 py-2"><button type="button" onClick={() => setSelected(selected === q.id ? null : q.id)} className="text-left font-semibold text-slate-900 hover:text-blue-700">{q.question || "Image-based question"}</button>{q.imageReferences.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{q.imageReferences.map((source, imageIndex) => <img key={imageIndex} src={source} alt={`Question image ${imageIndex + 1}`} loading="lazy" className="max-h-16 max-w-24 rounded border border-slate-200 object-contain" />)}</div>}<p className="mt-1 text-[11px] text-slate-400">{q.questionType} · {q.difficulty} · {q.id.slice(0, 8)}</p></td>
                        <td className="px-3 py-2 text-slate-700">{q.institution || "—"}</td><td className="px-3 py-2 text-slate-700">{q.exam || "—"}{q.year ? <span className="block text-[11px] text-slate-400">{q.year}</span> : null}</td><td className="px-3 py-2 text-slate-700">{q.subject || "—"}</td><td className="px-3 py-2 text-slate-700">{q.post || "—"}</td>
                        <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${q.status === "Published" ? "bg-emerald-100 text-emerald-800" : q.status === "Draft" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>{q.status === "Published" ? "প্রকাশিত" : q.status === "Draft" ? "খসড়া" : q.status}</span></td>
                        <td className="px-3 py-2"><div className="flex justify-end gap-1.5"><Button size="sm" variant="outline" onClick={() => setSelected(selected === q.id ? null : q.id)}>দেখুন</Button><Button size="sm" variant="outline" onClick={() => openEditForm(q)}>সম্পাদনা</Button><Button size="sm" variant="outline" onClick={() => void deleteQuestion(q.id)} className="border-red-200 text-red-700 hover:bg-red-50">Trash</Button></div></td>
                      </tr>
                    ))}
                    {filteredQuestions.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">কোনো প্রশ্ন পাওয়া যায়নি। Search অথবা Filter পরিবর্তন করে আবার চেষ্টা করুন।</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {true && (
          <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
            {hasMore && (
              <Button
                type="button"
                disabled={loading || loadingMore}
                onClick={() => void loadQuestions(currentPage + 1, true)}
                className="bg-green-700 text-white hover:bg-green-800"
              >
                {loadingMore ? "লোড হচ্ছে..." : "আরও প্রশ্ন দেখুন ↓"}
                {!loadingMore && (
                  <span className="ml-2">Load More · পরবর্তী ২৫টি প্রশ্ন</span>
                )}
              </Button>
            )}

            {totalPages > 1 && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => void loadQuestions(currentPage - 1, false)}
                  >
                    আগের পৃষ্ঠা
                  </Button>

                  {Array.from(
                    { length: Math.min(6, totalPages) },
                    (_, index) =>
                      Math.max(1, Math.min(currentPage - 2, totalPages - 5)) + index,
                  ).map((pageNumber) => (
                    <Button
                      key={pageNumber}
                      type="button"
                      size="sm"
                      variant={currentPage === pageNumber ? "primary" : "outline"}
                      disabled={loading}
                      onClick={() => void loadQuestions(pageNumber, false)}
                      className={
                        currentPage === pageNumber
                          ? "border-green-700 bg-green-700 text-white hover:bg-green-800"
                          : ""
                      }
                    >
                      {pageNumber}
                    </Button>
                  ))}

                  {totalPages > 6 && currentPage < totalPages - 2 && (
                    <>
                      <span className="px-1 text-slate-500">...</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => void loadQuestions(totalPages, false)}
                      >
                        Last ({totalPages})
                      </Button>
                    </>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => void loadQuestions(currentPage + 1, false)}
                  >
                    পরের পৃষ্ঠা
                  </Button>
                </div>

                <p className="text-sm text-slate-500">
                  পৃষ্ঠা {currentPage} / {totalPages} · মোট {totalQuestions.toLocaleString("bn-BD")}টি প্রশ্ন
                </p>
              </div>
            )}

            {totalPages <= 1 && (
              <p className="text-sm text-slate-500">
                মোট {totalQuestions.toLocaleString("bn-BD")}টি প্রশ্ন
              </p>
            )}
          </div>
        )}

        {selectedQuestion && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>প্রশ্নের বিস্তারিত</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(null)}
                >
                  ✕ বন্ধ করুন
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge>{selectedQuestion.id}</Badge>
                <Badge>{selectedQuestion.status}</Badge>
                <Badge>{selectedQuestion.difficulty}</Badge>
              </div>

              <h3 className="text-lg font-bold">
                {selectedQuestion.question || "Image-based question"}
              </h3>
              {selectedQuestion.imageReferences.length > 0 && <div className="flex flex-wrap gap-2">{selectedQuestion.imageReferences.map((source, imageIndex) => <img key={imageIndex} src={source} alt={`Question image ${imageIndex + 1}`} className="max-h-56 max-w-full rounded border border-slate-200 object-contain" />)}</div>}

              {["MCQ", "True/False"].includes(selectedQuestion.questionType) && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["A", "B", "C", "D"] as const).map((label) => {
                    const text = selectedQuestion[`option${label}`];
                    const images = selectedQuestion.optionImages[label] ?? [];
                    if (!text && images.length === 0) return null;
                    return <div key={label} className="rounded-lg border border-slate-200 p-3"><p className="text-sm">{label}. {text}</p>{images.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{images.map((source, imageIndex) => <img key={imageIndex} src={source} alt={`Option ${label} image ${imageIndex + 1}`} className="max-h-36 max-w-full rounded border border-slate-200 object-contain" />)}</div>}</div>;
                  })}
                </div>
              )}

              <p className="font-semibold text-green-700">
                সঠিক উত্তর: {selectedQuestion.correctAnswer || "উল্লেখ নেই"}
              </p>

              {selectedQuestion.explanation && (
                <p>ব্যাখ্যা: {selectedQuestion.explanation}</p>
              )}

              <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
                <p>প্রতিষ্ঠান: {selectedQuestion.institution}</p>
                <p>পরীক্ষা: {selectedQuestion.exam}</p>
                <p>সাল: {selectedQuestion.year}</p>
                <p>পদ: {selectedQuestion.post}</p>
                <p>বিভাগ: {selectedQuestion.department}</p>
                <p>বিষয়: {selectedQuestion.subject}</p>
                <p>টপিক: {selectedQuestion.topic}</p>
                <p>প্রশ্নের ধরন: {selectedQuestion.questionType}</p>
                <p>Source: {selectedQuestion.source}</p>
              </div>
            </CardContent>
          </Card>
        )}

          </>
        )}

        {permanentDeleteTarget && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="permanent-delete-title"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
                ⚠️
              </div>

              <h2
                id="permanent-delete-title"
                className="mt-4 text-center text-xl font-black text-slate-900"
              >
                স্থায়ীভাবে Delete করবেন?
              </h2>

              <p className="mt-3 text-center text-sm text-slate-600">
                এই প্রশ্নটি Database থেকে স্থায়ীভাবে মুছে যাবে। এরপর আর Recover
                করা সম্ভব হবে না।
              </p>

              <div className="mt-4 rounded-lg bg-red-50 p-3">
                <p className="text-sm font-bold text-slate-800">
                  {permanentDeleteTarget.question}
                </p>
                <p className="mt-2 break-all text-xs text-slate-500">
                  ID: {permanentDeleteTarget.id}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setPermanentDeleteTarget(null)}
                  disabled={permanentDeletingId !== null}
                >
                  বাতিল
                </Button>

                <Button
                  onClick={() => void permanentlyDeleteQuestion()}
                  disabled={permanentDeletingId !== null}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  {permanentDeletingId
                    ? "স্থায়ীভাবে মুছছে..."
                    : "হ্যাঁ, স্থায়ীভাবে মুছুন"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {successDialog && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-dialog-title"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-4xl font-bold text-green-600">
                ✓
              </div>

              <h2
                id="success-dialog-title"
                className="mt-4 text-xl font-black text-slate-900"
              >
                {successDialog.title}
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                {successDialog.message}
              </p>

              {successDialog.questionId && (
                <div className="mt-4 break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <strong>Question ID:</strong>
                  <p className="mt-1">{successDialog.questionId}</p>
                </div>
              )}

              <Button
                className="mt-6 w-full"
                onClick={() => setSuccessDialog(null)}
              >
                ঠিক আছে
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}