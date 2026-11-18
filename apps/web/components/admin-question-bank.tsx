
"use client";

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

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [bulkDifficulty, setBulkDifficulty] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [draftCount, setDraftCount] = useState(0);

  const [viewMode, setViewMode] = useState<QuestionViewMode>("single");
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
    void loadGroupOptions();
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
    void refreshDraftCount();
  }, [refreshDraftCount]);

  useEffect(() => {
    setSelectedQuestionIds([]);
    setAllMatchingSelected(false);
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

  const applyBulkEdit = async () => {
    if (!allMatchingSelected && selectedQuestionIds.length === 0) {
      setBulkError("প্রথমে প্রশ্ন নির্বাচন করুন অথবা সব Filtered প্রশ্ন নির্বাচন করুন।");
      return;
    }

    if (!allMatchingSelected && selectedQuestionIds.length > 500) {
      setBulkError("একবারে সর্বোচ্চ ৫০০টি প্রশ্ন পরিবর্তন করা যাবে।");
      return;
    }

    const updates: Record<string, string> = {};

    if (bulkDifficulty) updates.difficulty = bulkDifficulty;
    if (bulkStatus) updates.status = bulkStatus;

    if (Object.keys(updates).length === 0) {
      setBulkError("পরিবর্তনের জন্য Difficulty অথবা Status নির্বাচন করুন।");
      return;
    }

    if (!window.confirm(
      `${allMatchingSelected ? totalQuestions : selectedQuestionIds.length}টি প্রশ্নের তথ্য একসঙ্গে পরিবর্তন করবেন?`,
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
          ? { filters: currentFilterPayload(), updates: { ...updates, changeNote: "Bulk update across all filtered questions." } }
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
      setBulkError("প্রথমে প্রশ্ন নির্বাচন করুন অথবা সব Filtered প্রশ্ন নির্বাচন করুন।");
      return;
    }

    if (!allMatchingSelected && selectedQuestionIds.length > 500) {
      setBulkError("একবারে সর্বোচ্চ ৫০০টি প্রশ্ন Trash-এ পাঠানো যাবে।");
      return;
    }

    if (!window.confirm(
      `আপনি কি ${allMatchingSelected ? totalQuestions : selectedQuestionIds.length}টি matching প্রশ্ন Trash-এ পাঠাতে চান? Trash থেকে পরে Recover করা যাবে।`,
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
        body: JSON.stringify(allMatchingSelected ? { filters: currentFilterPayload() } : { ids: idsToDelete }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "নির্বাচিত প্রশ্ন Trash-এ পাঠানো যায়নি।");
      }

      const count = Number(result.deletedCount ?? (allMatchingSelected ? totalQuestions : idsToDelete.length));

      setBulkSuccess(`${count}টি প্রশ্ন সফলভাবে Trash-এ পাঠানো হয়েছে।`);
      setSelectedQuestionIds([]);
      setAllMatchingSelected(false);

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

    const optionValues = [
      ["A", form.optionA],
      ["B", form.optionB],
      ["C", form.optionC],
      ["D", form.optionD],
    ] as const;

    const options = isMcq
      ? optionValues
          .filter(([, value]) => value.trim())
          .map(([label, optionText], index) => ({
            label,
            optionText: optionText.trim(),
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

  const filterOptions = [
    {
      key: "institution",
      label: "প্রতিষ্ঠান",
      options: [...new Set(groupOptions.institutions.map((item) => item.name).filter(Boolean))],
    },
    {
      key: "exam",
      label: "পরীক্ষার নাম",
      options: [...new Set(questions.map((q) => q.exam).filter(Boolean))],
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
    <main className="min-h-screen bg-slate-50 p-3 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-blue-700">
              SHIKHASETU / QUESTION BANK
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">
              প্রশ্নব্যাংক
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              সকল প্রতিষ্ঠানের বিগত পরীক্ষার প্রশ্ন এক জায়গায় পরিচালনা করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
  {!showTrash && (
    <Button onClick={openAddForm} className="h-10 min-w-[140px] justify-center">
      + নতুন প্রশ্ন
    </Button>
  )}
</div>
        </div>

        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div>
                  <CardTitle>Import &amp; Data Tools</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">প্রশ্ন প্রস্তুত, OCR এবং ডেটা পরিচালনা করুন</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {!showTrash && (
              <>
              <div className="flex min-h-14 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-emerald-300 hover:bg-emerald-50/40">
                <QuestionImportPanel />
              </div>
              <div className="flex min-h-14 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-violet-300 hover:bg-violet-50/40">
                <QuestionImportTemplates />
              </div>
              <div className="flex min-h-14 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-amber-300 hover:bg-amber-50/40">
                <QuestionImportHistory />
              </div>
              </>
              )}
              <div className="flex min-h-14 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-red-300 hover:bg-red-50/40">
                <button type="button" onClick={toggleTrash} className="flex min-h-[68px] w-full items-center justify-start gap-3 rounded-lg bg-white px-3 py-2 text-left text-red-700 transition hover:bg-red-50/60">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{showTrash ? "Trash বন্ধ করুন" : "Trash"}</span>
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">{deletedQuestions.length > 0 ? `${deletedQuestions.length.toLocaleString("bn-BD")}টি মুছে ফেলা প্রশ্ন` : "মুছে ফেলা প্রশ্ন পুনরুদ্ধার করুন"}</span>
                  </span>
                </button>
              </div>
            </CardContent>
          </Card>

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

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: "মোট প্রশ্ন",
              value: totalQuestions.toLocaleString("bn-BD"),
              icon: "📚",
            },
            {
              label: "প্রতিষ্ঠান",
              value: new Set(
                questions.map((q) => q.institution).filter(Boolean),
              ).size.toLocaleString("bn-BD"),
              icon: "🏛️",
            },
            {
              label: "পরীক্ষা",
              value: new Set(
                questions.map((q) => q.exam).filter(Boolean),
              ).size.toLocaleString("bn-BD"),
              icon: "📝",
            },
            {
              label: "বিষয়",
              value: new Set(
                questions.map((q) => q.subject).filter(Boolean),
              ).size.toLocaleString("bn-BD"),
              icon: "📖",
            },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="rounded-xl bg-blue-50 p-3 text-2xl">
                  {item.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-900">
                    {item.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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

                      <p className="mt-3 font-bold text-slate-900">
                        {q.question}
                      </p>

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

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle>প্রশ্ন দেখার পদ্ধতি</CardTitle>
            <p className="text-sm text-slate-500">
              সব প্রশ্ন একসঙ্গে, Exam অনুযায়ী অথবা Institution অনুযায়ী দেখুন।
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-0">
            <Button
              variant={viewMode === "single" ? "outline" : "ghost"}
              onClick={() => {
                setViewMode("single");
                setSelectedExamGroup(null);
                setSelectedInstitutionKey(null);
                setSelected(null);
              }}
            >
              Single List
            </Button>
            <Button
              variant={viewMode === "exam" ? "outline" : "ghost"}
              onClick={() => {
                setViewMode("exam");
                setSelectedExamGroup(null);
                setSelectedInstitutionKey(null);
                setSelected(null);
                void loadGroupOptions();
              }}
            >
              Exam Wise
            </Button>
            <Button
              variant={viewMode === "institution" ? "outline" : "ghost"}
              onClick={() => {
                setViewMode("institution");
                setSelectedExamGroup(null);
                setSelectedInstitutionKey(null);
                setSelected(null);
                void loadGroupOptions();
              }}
            >
              Institution Wise
            </Button>
          </CardContent>
        </Card>

        {true && (
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Advanced Question Search</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  একাধিক Filter একসঙ্গে ব্যবহার করে প্রশ্ন খুঁজুন।
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                ↻ Reset Filters
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            <Input
              placeholder="প্রশ্ন, Keyword, Exam অথবা Question ID দিয়ে খুঁজুন..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label="Year From"
                value={filters.from}
                onChange={(e) => updateFilter("from", e.target.value)}
              >
                <option value="">শুরু বছর</option>
                {Array.from({ length: 27 }, (_, i) => 2000 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>

              <Select
                label="Year To"
                value={filters.to}
                onChange={(e) => updateFilter("to", e.target.value)}
              >
                <option value="">শেষ বছর</option>
                {Array.from({ length: 27 }, (_, i) => 2000 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>

              <Select
                label="Status"
                value={filters.status}
                onChange={(e) => updateFilter("status", e.target.value)}
              >
                <option value="">সকল</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="HIDDEN">Hidden</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
              {filterOptions.map((filter) => (
                <Select
                  key={filter.key}
                  label={filter.label}
                  value={filters[filter.key as keyof typeof initialFilters]}
                  onChange={(e) =>
                    updateFilter(
                      filter.key as keyof typeof initialFilters,
                      e.target.value,
                    )
                  }
                >
                  <option value="">সকল</option>
                  {filter.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <p className="text-sm text-slate-600">
                পাওয়া গেছে:{" "}
                <strong className="text-blue-700">
                  {totalQuestions.toLocaleString("bn-BD")}
                </strong>{" "}
                টি প্রশ্ন
              </p>
              <Badge>Backend Filters Active</Badge>
            </div>
          </CardContent>
        </Card>
        )}

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
                    <button
                      key={institution.groupKey}
                      type="button"
                      onClick={() => setSelectedInstitutionKey(institution.groupKey)}
                      className={`rounded-xl border p-4 text-left transition ${
                        selectedInstitutionKey === institution.groupKey
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      <p className="font-bold text-slate-900">{institution.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {institution.exams.length.toLocaleString("bn-BD")} টি Exam
                      </p>
                    </button>
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
                    <button
                      key={group.groupKey}
                      type="button"
                      onClick={() => void loadGroupQuestions(group)}
                      className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50"
                    >
                      <p className="font-bold text-slate-900">{group.examName}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {group.institutionName} · {group.examYear}
                        {group.postName ? ` · ${group.postName}` : ""}
                        {group.department ? ` · ${group.department}` : ""}
                      </p>
                    </button>
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

        {true && (
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle>Bulk Question Management</CardTitle>
              <p className="text-sm text-slate-500">
                একাধিক প্রশ্ন নির্বাচন করে একসঙ্গে পরিবর্তন করুন অথবা সব Draft Publish করুন।
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={toggleCurrentPageSelection}
                  disabled={loading || filteredQuestions.length === 0 || bulkSaving}
                >
                  {filteredQuestions.length > 0 &&
                  filteredQuestions.every((q) => selectedQuestionIds.includes(q.id))
                    ? "বর্তমান তালিকার নির্বাচন বাতিল"
                    : "বর্তমান তালিকার সব নির্বাচন"}
                </Button>

                <span className="text-sm text-slate-600">
                  নির্বাচিত: {allMatchingSelected ? totalQuestions : selectedQuestionIds.length}টি {allMatchingSelected ? "(সব Filtered)" : ""}
                </span>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setSelectedQuestionIds([]); setAllMatchingSelected(true); setBulkError(""); setBulkSuccess(""); }}
                  disabled={loading || totalQuestions === 0 || bulkSaving || viewMode !== "single"}
                >
                  সব Filtered প্রশ্ন নির্বাচন ({totalQuestions.toLocaleString("bn-BD")})
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedQuestionIds([]);
                    setAllMatchingSelected(false);
                    setBulkError("");
                    setBulkSuccess("");
                  }}
                  disabled={(selectedQuestionIds.length === 0 && !allMatchingSelected) || bulkSaving}
                >
                  Selection Clear
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Bulk Difficulty"
                  value={bulkDifficulty}
                  onChange={(e) => setBulkDifficulty(e.target.value)}
                  disabled={bulkSaving}
                >
                  <option value="">পরিবর্তন করবেন না</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </Select>

                <Select
                  label="Bulk Status"
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  disabled={bulkSaving}
                >
                  <option value="">পরিবর্তন করবেন না</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="HIDDEN">Hidden</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <Button
                  type="button"
                  onClick={() => void applyBulkEdit()}
                  disabled={bulkSaving || (selectedQuestionIds.length === 0 && !allMatchingSelected)}
                >
                  {bulkSaving ? "Processing..." : "Apply Bulk Edit"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void bulkDeleteQuestions()}
                  disabled={bulkSaving || (selectedQuestionIds.length === 0 && !allMatchingSelected)}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  {bulkSaving ? "Processing..." : "নির্বাচিত প্রশ্ন Trash-এ পাঠান"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void publishAllDrafts()}
                  disabled={bulkSaving || draftCount === 0}
                >
                  Publish All Drafts ({draftCount.toLocaleString("bn-BD")})
                </Button>
              </div>

              {bulkError && (
                <p role="alert" className="text-sm text-red-600">
                  {bulkError}
                </p>
              )}

              {bulkSuccess && (
                <p role="status" className="text-sm text-green-700">
                  {bulkSuccess}
                </p>
              )}

              <p className="text-xs text-slate-500">
                বর্তমান পেজের নির্বাচন আলাদা। “সব Filtered প্রশ্ন নির্বাচন” সক্রিয় Filter/Search অনুযায়ী সব matching প্রশ্ন server-side-এ নির্বাচন করে; এটি ৫০০টির সীমায় আবদ্ধ নয়। Publish All Drafts database-এর সব active Draft প্রশ্নে কাজ করে; Trash-এর প্রশ্ন এতে অন্তর্ভুক্ত নয়।
              </p>
            </CardContent>
          </Card>
        )}
        </div>

        {(viewMode === "single" || selectedExamGroup) && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>প্রশ্নের তালিকা</CardTitle>
            <p className="text-sm text-slate-500">
              প্রশ্ন নির্বাচন করে বিস্তারিত তথ্য দেখুন।
            </p>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="rounded-xl bg-slate-50 p-10 text-center text-slate-500">
                Database থেকে প্রশ্ন লোড হচ্ছে...
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="relative rounded-lg border border-slate-200 bg-white p-3 pl-11 transition hover:border-blue-300 hover:shadow-sm"
                  >
                    {true && (
                      <input
                        type="checkbox"
                        aria-label="প্রশ্ন নির্বাচন করুন"
                        checked={allMatchingSelected || selectedQuestionIds.includes(q.id)}
                        disabled={bulkSaving || allMatchingSelected}
                        onChange={() => {
                          setSelectedQuestionIds((previous) =>
                            previous.includes(q.id)
                              ? previous.filter((id) => id !== q.id)
                              : previous.length < 500
                                ? [...previous, q.id]
                                : previous,
                          );
                          setBulkError("");
                          setBulkSuccess("");
                        }}
                        className="absolute left-4 top-5 h-4 w-4"
                      />
                    )}
                    <button
                      onClick={() =>
                        setSelected(selected === q.id ? null : q.id)
                      }
                      className="w-full text-left"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-blue-700">
                          {q.id}
                        </span>
                        <Badge>{q.year}</Badge>
                      </div>

                      <p className="mt-3 font-bold text-slate-900">
                        {q.question}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{q.institution}</span>
                        <span>•</span>
                        <span>{q.exam}</span>
                        <span>•</span>
                        <span>{q.subject}</span>
                      </div>
                    </button>

                    <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditForm(q)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void deleteQuestion(q.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}

                {filteredQuestions.length === 0 && (
                  <div className="rounded-xl bg-slate-50 p-10 text-center">
                    <p className="font-bold text-slate-700">
                      কোনো প্রশ্ন পাওয়া যায়নি
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Search অথবা Filter পরিবর্তন করে আবার চেষ্টা করুন।
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {true && (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
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
                {selectedQuestion.question}
              </h3>

              {selectedQuestion.questionType === "MCQ" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedQuestion.optionA && (
                    <p>A. {selectedQuestion.optionA}</p>
                  )}
                  {selectedQuestion.optionB && (
                    <p>B. {selectedQuestion.optionB}</p>
                  )}
                  {selectedQuestion.optionC && (
                    <p>C. {selectedQuestion.optionC}</p>
                  )}
                  {selectedQuestion.optionD && (
                    <p>D. {selectedQuestion.optionD}</p>
                  )}
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
