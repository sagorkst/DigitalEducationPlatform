"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Question = {
  id: string;
  questionText: string;
  questionType: string;
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
  options: { id: string; label: string; optionText: string }[];
  occurrences: {
    institution: string;
    examName: string;
    examYear: number | null;
    postName: string | null;
    examRef?: {
      id: string;
      name: string;
      examYear: number | null;
      examType: string | null;
    };
  }[];
};

type AnswerData = {
  correctAnswer: string | null;
  explanation: string | null;
  options: {
    id: string;
    label: string;
    optionText: string;
    isCorrect: boolean;
  }[];
};

type ExamInfo = {
  id: string;
  name: string;
  examYear: number | null;
  examType: string | null;
  questionCount: number;
  institution: { name: string } | null;
  post: { name: string } | null;
};

const PAGE_SIZE = 20;
const API_PAGE_SIZE = 100;

type VisibilityKey = "options" | "answers" | "explanations";
type VisibilitySettings = Record<VisibilityKey, boolean>;
type VisibilityOverrides = Record<string, Partial<VisibilitySettings>>;
type VisibilityMode = "global" | "individual";

const VISIBILITY_STORAGE_KEYS: Record<VisibilityKey, string> = {
  options: "shikhasetu_qbank_show_options_v2",
  answers: "shikhasetu_qbank_show_answers_v2",
  explanations: "shikhasetu_qbank_show_explanations_v2",
};

const VISIBILITY_MODE_KEY = "shikhasetu_qbank_visibility_mode_v2";
const VISIBILITY_OVERRIDES_KEY = "shikhasetu_qbank_individual_visibility_v2";
const LEGACY_ANSWER_KEY = "shikhasetu_qbank_show_all_answers";

const DEFAULT_VISIBILITY: VisibilitySettings = {
  options: true,
  answers: false,
  explanations: false,
};

function effectiveVisibility(
  global: VisibilitySettings,
  overrides: Partial<VisibilitySettings> | undefined,
  mode: VisibilityMode,
): VisibilitySettings {

  return {
    options: overrides?.options ?? global.options,
    answers: overrides?.answers ?? global.answers,
    explanations: overrides?.explanations ?? global.explanations,
  };
}

function useQuestionVisibility() {
  const [visibility, setVisibility] = useState<VisibilitySettings>(DEFAULT_VISIBILITY);
  const [mode, setModeState] = useState<VisibilityMode>("global");
  const [overrides, setOverrides] = useState<VisibilityOverrides>({});

  useEffect(() => {
    const readStorage = () => {
      try {
        const next = { ...DEFAULT_VISIBILITY };

        (Object.keys(VISIBILITY_STORAGE_KEYS) as VisibilityKey[]).forEach((key) => {
          const value = window.localStorage.getItem(VISIBILITY_STORAGE_KEYS[key]);

          if (value === "true") next[key] = true;
          if (value === "false") next[key] = false;
        });

        const legacy = window.localStorage.getItem(LEGACY_ANSWER_KEY);

        if (
          window.localStorage.getItem(VISIBILITY_STORAGE_KEYS.answers) === null &&
          legacy !== null
        ) {
          next.answers = legacy === "true";
        }

        if (
          window.localStorage.getItem(VISIBILITY_STORAGE_KEYS.explanations) === null &&
          legacy !== null
        ) {
          next.explanations = legacy === "true";
        }

        setVisibility(next);

        const savedMode = window.localStorage.getItem(VISIBILITY_MODE_KEY);
        setModeState(savedMode === "individual" ? "individual" : "global");

        const savedOverrides = window.localStorage.getItem(VISIBILITY_OVERRIDES_KEY);
        if (savedOverrides) {
          const parsed = JSON.parse(savedOverrides);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            setOverrides(parsed as VisibilityOverrides);
          }
        }
      } catch {
        // Keep defaults if browser storage is unavailable or invalid.
      }
    };

    readStorage();

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === VISIBILITY_MODE_KEY ||
        event.key === VISIBILITY_OVERRIDES_KEY ||
        event.key === LEGACY_ANSWER_KEY ||
        Object.values(VISIBILITY_STORAGE_KEYS).includes(event.key)
      ) {
        readStorage();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setGlobal = useCallback((key: VisibilityKey, value: boolean) => {
    setVisibility((current) => ({ ...current, [key]: value }));

    setOverrides((current) => {
      const next: VisibilityOverrides = {};

      Object.entries(current).forEach(([questionId, settings]) => {
        next[questionId] = { ...settings, [key]: value };
      });

      try {
        window.localStorage.setItem(VISIBILITY_OVERRIDES_KEY, JSON.stringify(next));
        window.localStorage.setItem(VISIBILITY_STORAGE_KEYS[key], String(value));
      } catch {
        // In-memory state remains available.
      }

      return next;
    });
  }, []);

  const setMode = useCallback((nextMode: VisibilityMode) => {
    setModeState(nextMode);

    try {
      window.localStorage.setItem(VISIBILITY_MODE_KEY, nextMode);
    } catch {
      // In-memory state remains available.
    }
  }, []);

  const setQuestion = useCallback((
    questionId: string,
    key: VisibilityKey,
    value: boolean,
  ) => {
    setOverrides((current) => {
      const next = {
        ...current,
        [questionId]: {
          ...current[questionId],
          [key]: value,
        },
      };

      try {
        window.localStorage.setItem(VISIBILITY_OVERRIDES_KEY, JSON.stringify(next));
      } catch {
        // In-memory state remains available.
      }

      return next;
    });
  }, []);

  const getEffective = useCallback(
    (questionId: string) =>
      effectiveVisibility(visibility, overrides[questionId], mode),
    [visibility, overrides, mode],
  );

  return {
    visibility,
    mode,
    overrides,
    setGlobal,
    setMode,
    setQuestion,
    getEffective,
  };
}

function VisibilitySwitch({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="text-xs font-semibold text-slate-700">
        {label} {value ? "ON" : "OFF"}
      </span>
      <span className={`relative h-5 w-9 rounded-full transition ${value ? "bg-emerald-600" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${value ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function VisibilityModeSelector({
  mode,
  onChange,
}: {
  mode: VisibilityMode;
  onChange: (mode: VisibilityMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-500">নিয়ন্ত্রণ:</span>
      <button
        type="button"
        onClick={() => onChange("global")}
        aria-pressed={mode === "global"}
        className={`rounded-lg px-3 py-2 text-xs font-semibold ${
          mode === "global"
            ? "bg-emerald-700 text-white"
            : "border border-slate-300 bg-white text-slate-700"
        }`}
      >
        Global Mode
      </button>
      <button
        type="button"
        onClick={() => onChange("individual")}
        aria-pressed={mode === "individual"}
        className={`rounded-lg px-3 py-2 text-xs font-semibold ${
          mode === "individual"
            ? "bg-emerald-700 text-white"
            : "border border-slate-300 bg-white text-slate-700"
        }`}
      >
        Individual Mode
      </button>
    </div>
  );
}

function GlobalVisibilityControls({
  visibility,
  onChange,
}: {
  visibility: VisibilitySettings;
  onChange: (key: VisibilityKey, value: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="সকল প্রশ্নের দৃশ্যমানতা">
      <VisibilitySwitch label="Options" value={visibility.options} onChange={(value) => onChange("options", value)} />
      <VisibilitySwitch label="Answer" value={visibility.answers} onChange={(value) => onChange("answers", value)} />
      <VisibilitySwitch label="Explanation" value={visibility.explanations} onChange={(value) => onChange("explanations", value)} />
    </div>
  );
}

function QuestionVisibilityControls({
  visibility,
  onChange,
  disabled = false,
}: {
  visibility: VisibilitySettings;
  onChange: (key: VisibilityKey, value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
      <span className="mr-1 text-xs font-semibold text-slate-500">এই প্রশ্ন:</span>
      <VisibilitySwitch label="Options" value={visibility.options} onChange={(value) => onChange("options", value)} disabled={disabled} />
      <VisibilitySwitch label="Answer" value={visibility.answers} onChange={(value) => onChange("answers", value)} disabled={disabled} />
      <VisibilitySwitch label="Explanation" value={visibility.explanations} onChange={(value) => onChange("explanations", value)} disabled={disabled} />
    </div>
  );
}
export default function PublicExamQuestions({ examId }: { examId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerData>>({});
  const [loadingAnswers, setLoadingAnswers] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const {
    visibility: globalVisibility,
    mode: visibilityMode,
    setGlobal: setGlobalVisibility,
    setMode: setVisibilityMode,
    setQuestion: setQuestionVisibility,
    getEffective: getEffectiveVisibility,
  } = useQuestionVisibility();
  const [subjectFilter, setSubjectFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<"default" | "asc" | "desc">("default");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setQuestions([]);
      setExam(null);
      setAnswers({});
      setCurrentPage(1);

      try {
        const [firstQuestionResponse, examResponse] = await Promise.all([
          fetch(
            `/api/public/questions?examId=${encodeURIComponent(examId)}&page=1&limit=${API_PAGE_SIZE}`,
            { cache: "no-store" },
          ),
          fetch("/api/public/filters", { cache: "no-store" }),
        ]);

        const firstQuestionResult = await firstQuestionResponse.json();
        const examResult = await examResponse.json();

        if (!firstQuestionResponse.ok) {
          throw new Error(firstQuestionResult.message || "প্রশ্ন লোড করা যায়নি।");
        }

        if (!examResponse.ok) {
          throw new Error(examResult.message || "পরীক্ষার তথ্য লোড করা যায়নি।");
        }

        const found = (examResult.data?.exams ?? []).find(
          (item: ExamInfo) => item.id === examId,
        );

        if (!found) {
          throw new Error(
            "এই পরীক্ষার কোনো প্রকাশিত প্রশ্ন পাওয়া যায়নি অথবা পরীক্ষাটি বর্তমানে প্রকাশিত নয়।",
          );
        }

        const allQuestions: Question[] = firstQuestionResult.data ?? [];
        const totalQuestionPages = Math.max(
          1,
          Number(firstQuestionResult.pagination?.totalPages ?? 1),
        );

        if (totalQuestionPages > 1) {
          const remainingPages = await Promise.all(
            Array.from(
              { length: totalQuestionPages - 1 },
              (_, index) => index + 2,
            ).map(async (page) => {
              const response = await fetch(
                `/api/public/questions?examId=${encodeURIComponent(examId)}&page=${page}&limit=${API_PAGE_SIZE}`,
                { cache: "no-store" },
              );

              const result = await response.json();

              if (!response.ok) {
                throw new Error(
                  result.message || `পৃষ্ঠা ${page} লোড করা যায়নি।`,
                );
              }

              return (result.data ?? []) as Question[];
            }),
          );

          for (const pageQuestions of remainingPages) {
            allQuestions.push(...pageQuestions);
          }
        }

        if (cancelled) return;

        setQuestions(allQuestions);
        setExam(found);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "তথ্য লোড করা যায়নি।");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [examId]);

  const loadAnswer = useCallback(
    async (questionId: string) => {
      if (answers[questionId] || loadingAnswers[questionId]) return;

      setLoadingAnswers((current) => ({
        ...current,
        [questionId]: true,
      }));

      try {
        const response = await fetch(
          `/api/public/questions/${questionId}?examId=${encodeURIComponent(examId)}`,
          { cache: "no-store" },
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "উত্তর লোড করা যায়নি।");
        }

        setAnswers((current) => ({
          ...current,
          [questionId]: result.data,
        }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "উত্তর লোড করা যায়নি।");
      } finally {
        setLoadingAnswers((current) => ({
          ...current,
          [questionId]: false,
        }));
      }
    },
    [answers, loadingAnswers, examId],
  );

  const subjects = useMemo(
    () =>
      [
        ...new Set(
          questions
            .map((question) => question.subject)
            .filter(Boolean) as string[],
        ),
      ].sort((a, b) => a.localeCompare(b, "bn")),
    [questions],
  );

  const topics = useMemo(
    () =>
      [
        ...new Set(
          questions
            .filter(
              (question) =>
                !subjectFilter || question.subject === subjectFilter,
            )
            .map((question) => question.topic)
            .filter(Boolean) as string[],
        ),
      ].sort((a, b) => a.localeCompare(b, "bn")),
    [questions, subjectFilter],
  );

  const filteredQuestions = useMemo(() => {
    let result = questions.filter((question) => {
      if (subjectFilter && question.subject !== subjectFilter) return false;
      if (topicFilter && question.topic !== topicFilter) return false;
      if (difficultyFilter && question.difficulty !== difficultyFilter) return false;
      return true;
    });

    if (sortOrder !== "default") {
      result = [...result].sort((a, b) => {
        const comparison = a.questionText.localeCompare(b.questionText, "bn", {
          sensitivity: "base",
          numeric: true,
        });

        return sortOrder === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [questions, subjectFilter, topicFilter, difficultyFilter, sortOrder]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredQuestions.length / PAGE_SIZE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const visibleQuestions = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredQuestions.slice(start, start + PAGE_SIZE);
  }, [filteredQuestions, safeCurrentPage]);

  useEffect(() => {
    if (loading || visibleQuestions.length === 0) return;

    visibleQuestions.forEach((question) => {
      const effective = getEffectiveVisibility(question.id);
      if ((effective.answers || effective.explanations) &&
          !answers[question.id] && !loadingAnswers[question.id]) {
        void loadAnswer(question.id);
      }
    });
  }, [globalVisibility, visibilityMode, getEffectiveVisibility, loading, visibleQuestions, answers, loadingAnswers, loadAnswer]);


  useEffect(() => {
    setCurrentPage(1);
  }, [subjectFilter, topicFilter, difficultyFilter, sortOrder]);

  function resetFilters() {
    setSubjectFilter("");
    setTopicFilter("");
    setDifficultyFilter("");
    setSortOrder("default");
    setCurrentPage(1);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/question-bank"
        className="mb-5 inline-block text-sm font-semibold text-emerald-700 hover:underline"
      >
        ← Question Bank-এ ফিরে যান
      </Link>

      {loading ? (
        <div className="py-16 text-center text-slate-500">
          পরীক্ষার প্রশ্ন লোড হচ্ছে...
        </div>
      ) : error && !exam ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
          <p className="font-semibold">{error}</p>
          <Link
            href="/question-bank"
            className="mt-3 inline-block text-sm font-semibold underline"
          >
            Question Bank-এ ফিরে যান
          </Link>
        </div>
      ) : (
        <>
          <header className="mb-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-emerald-700">
              {exam?.institution?.name || "প্রতিষ্ঠান উল্লেখ নেই"}
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              {exam?.post?.name || exam?.name}
            </h1>

            <p className="mt-1 text-sm text-slate-600">{exam?.name}</p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-sm">
                {exam?.examYear && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                    {exam.examYear}
                  </span>
                )}

                {exam?.examType && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                    {exam.examType}
                  </span>
                )}

                <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                  মোট {questions.length}টি প্রকাশিত প্রশ্ন
                </span>
              </div>

              <div className="flex flex-col items-end gap-3">
                <GlobalVisibilityControls visibility={globalVisibility} onChange={setGlobalVisibility} />
              </div>
            </div>
          </header>

          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-slate-900">
                এই পরীক্ষার প্রশ্ন ফিল্টার
              </h2>

              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-semibold text-emerald-700 hover:underline"
              >
                Filter মুছুন
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-medium text-slate-700">
                বিষয়
                <select
                  value={subjectFilter}
                  onChange={(event) => {
                    setSubjectFilter(event.target.value);
                    setTopicFilter("");
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="">সকল বিষয়</option>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700">
                টপিক
                <select
                  value={topicFilter}
                  onChange={(event) => setTopicFilter(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="">সকল টপিক</option>
                  {topics.map((topic) => (
                    <option key={topic} value={topic}>{topic}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700">
                কঠিনতার স্তর
                <select
                  value={difficultyFilter}
                  onChange={(event) => setDifficultyFilter(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="">সকল স্তর</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700">
                সাজানোর ক্রম
                <select
                  value={sortOrder}
                  onChange={(event) =>
                    setSortOrder(
                      event.target.value as "default" | "asc" | "desc",
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="default">ডিফল্ট ক্রম</option>
                  <option value="asc">A–Z</option>
                  <option value="desc">Z–A</option>
                </select>
              </label>
            </div>

            <p className="mt-4 text-sm text-slate-500">
              ফিল্টার অনুযায়ী {filteredQuestions.length}টি প্রশ্ন পাওয়া গেছে।
            </p>
          </section>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {filteredQuestions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <h2 className="font-bold text-slate-800">
                কোনো প্রশ্ন পাওয়া যায়নি
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                নির্বাচিত ফিল্টার পরিবর্তন করুন অথবা সব ফিল্টার মুছে দেখুন।
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                সব ফিল্টার মুছুন
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                <span>
                  {(safeCurrentPage - 1) * PAGE_SIZE + 1}
                  {" - "}
                  {Math.min(safeCurrentPage * PAGE_SIZE, filteredQuestions.length)}
                  {" / "}
                  {filteredQuestions.length}টি প্রশ্ন
                </span>
                <span>প্রতি পৃষ্ঠায় {PAGE_SIZE}টি</span>
              </div>

              <div className="space-y-5">
                {visibleQuestions.map((question, index) => {
                  const questionVisibility = getEffectiveVisibility(question.id);
                  const answer = (questionVisibility.answers || questionVisibility.explanations)
                    ? answers[question.id]
                    : undefined;
                  const questionNumber =
                    (safeCurrentPage - 1) * PAGE_SIZE + index + 1;

                  return (
                    <article
                      key={question.id}
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-emerald-700">
                          প্রশ্ন {questionNumber}
                        </span>

                        <span className="text-xs text-slate-500">
                          {[question.subject, question.topic, question.difficulty]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                      </div>

                      <h2 className="whitespace-pre-wrap text-base font-semibold leading-7 text-slate-800">
                        {question.questionText}
                      </h2>

                      {questionVisibility.options && <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {question.options?.map((option) => {
                          const revealedOption = questionVisibility.answers
                            ? answer?.options?.find((item) => item.id === option.id)
                            : undefined;

                          return (
                            <div
                              key={option.id}
                              className={`rounded-lg border p-3 text-sm ${
                                revealedOption?.isCorrect
                                  ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                                  : "border-slate-200 bg-slate-50 text-slate-700"
                              }`}
                            >
                              <span className="mr-2 font-semibold">
                                {option.label}.
                              </span>
                              {option.optionText}
                              {revealedOption?.isCorrect && (
                                <span className="ml-2 font-bold">
                                  ✓ সঠিক উত্তর
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>}

                      {(questionVisibility.answers || questionVisibility.explanations) && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          {loadingAnswers[question.id] && !answer ? (
                            <p className="text-sm text-slate-500">
                              উত্তর লোড হচ্ছে...
                            </p>
                          ) : answer ? (
                            <div className="space-y-3">
                              {questionVisibility.answers && answer.correctAnswer && (
                                <p className="text-sm font-semibold text-emerald-800">
                                  সঠিক উত্তর: {answer.correctAnswer}
                                </p>
                              )}

                              {questionVisibility.explanations && answer.explanation && (
                                <div className="rounded-lg bg-emerald-50 p-4 text-sm leading-7 text-slate-700">
                                  <p className="mb-1 font-bold text-emerald-800">
                                    ব্যাখ্যা
                                  </p>
                                  {answer.explanation}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-rose-600">
                              উত্তর লোড করা যায়নি।
                            </p>
                          )}
                        </div>
                      )}

                      <QuestionVisibilityControls
                        visibility={questionVisibility}
                        onChange={(key, value) => setQuestionVisibility(question.id, key, value)}
                      />
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <Link
                          href={`/question-bank/${question.id}?examId=${encodeURIComponent(examId)}`}
                          className="text-sm font-semibold text-blue-700 hover:underline"
                        >
                          বিস্তারিত দেখুন →
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <nav
                  aria-label="প্রশ্নের পৃষ্ঠা"
                  className="mt-8 flex flex-wrap items-center justify-center gap-2"
                >
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safeCurrentPage === 1}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← আগের
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1)
                    .filter(
                      (page) =>
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - safeCurrentPage) <= 2,
                    )
                    .map((page, index, pages) => (
                      <span key={page} className="contents">
                        {index > 0 && pages[index - 1] !== page - 1 && (
                          <span className="px-1 text-slate-400">…</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          aria-current={page === safeCurrentPage ? "page" : undefined}
                          className={`min-w-10 rounded-lg border px-3 py-2 text-sm font-semibold ${
                            page === safeCurrentPage
                              ? "border-emerald-700 bg-emerald-700 text-white"
                              : "border-slate-300 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {page}
                        </button>
                      </span>
                    ))}

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={safeCurrentPage === totalPages}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    পরের →
                  </button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
