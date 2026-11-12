
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
import QuestionImportPanel from "../../components/question-import-panel";
import QuestionImportTemplates from "../../components/question-import-templates";
import QuestionImportHistory from "../../components/question-import-history";

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

const initialFilters = {
  from: "",
  to: "",
  institution: "",
  exam: "",
  post: "",
  subject: "",
  topic: "",
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

  const [showTrash, setShowTrash] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
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

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "100");

      if (search.trim()) params.set("search", search.trim());
      if (filters.from) params.set("yearFrom", filters.from);
      if (filters.to) params.set("yearTo", filters.to);
      if (filters.institution) params.set("institution", filters.institution);
      if (filters.exam) params.set("exam", filters.exam);
      if (filters.post) params.set("post", filters.post);
      if (filters.subject) params.set("subject", filters.subject);
      if (filters.topic) params.set("topic", filters.topic);

      const response = await fetch(`/api/questions?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "প্রশ্ন লোড করা যায়নি।");
      }

      const records: ApiQuestion[] = Array.isArray(result.data)
        ? result.data
        : [];

      setQuestions(records.map(mapQuestion));
      setTotalQuestions(result.pagination?.total ?? records.length);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "প্রশ্ন লোড করতে সমস্যা হয়েছে।",
      );
    } finally {
      setLoading(false);
    }
  }, [search, filters]);

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
    const timer = setTimeout(() => {
      void loadQuestions();
    }, 300);

    return () => clearTimeout(timer);
  }, [loadQuestions]);

  const filteredQuestions = useMemo(() => questions, [questions]);

  const updateFilter = (key: keyof typeof initialFilters, value: string) => {
    setFilters((old) => ({ ...old, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setSearch("");
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
      options: [...new Set(questions.map((q) => q.institution).filter(Boolean))],
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
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
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

          <div className="flex flex-wrap gap-2">
            <QuestionImportPanel />
<QuestionImportTemplates />
<QuestionImportHistory />
            <Button variant="outline" onClick={toggleTrash}>
              🗑 {showTrash ? "Trash বন্ধ করুন" : "Trash"}
              {deletedQuestions.length > 0
                ? ` (${deletedQuestions.length.toLocaleString("bn-BD")})`
                : ""}
            </Button>
            <Button onClick={openAddForm}>+ নতুন প্রশ্ন</Button>
          </div>
        </div>

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

        <Card>
          <CardHeader>
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

          <CardContent className="space-y-5">
            <Input
              placeholder="প্রশ্ন, Keyword, Exam অথবা Question ID দিয়ে খুঁজুন..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
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

        <Card>
          <CardHeader>
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
                    className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-300"
                  >
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
