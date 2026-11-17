"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

type Exam = {
  id: string;
  name: string;
  examYear: number | null;
  examType: string | null;
  grade: string | null;
  questionCount: number;
  institution: { id: string; name: string } | null;
  post: { id: string; name: string } | null;
};

type Question = {
  id: string;
  questionText: string;
  questionType: string;
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
  isRepeated: boolean;
  occurrenceCount: number;
  options: { id: string; label: string; optionText: string }[];
  occurrences: {
    institution: string;
    examName: string;
    examYear: number | null;
    postName: string | null;
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

type Topic = {
  id: string;
  name: string;
  subjectId: string;
  parentId: string | null;
  count?: number;
  subject?: { name: string };
};

type CountOption = { id: string; name: string; count: number };

type Filters = {
  institutions: CountOption[];
  exams: Exam[];
  posts: CountOption[];
  years: { year: number; count: number }[];
  topics: Topic[];
  examTypes: { name: string; count: number }[];
  grades: { name: string; count: number }[];
  summary: { questions: number; exams: number; institutions: number; subjects: number; topics: number };
};

type ViewMode = "cards" | "all" | "institutions" | "subjects" | "topics";

const PAGE_SIZE = 20;

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

function FilterField({
  label,
  icon,
  active = false,
  children,
}: {
  label: string;
  icon: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-2 transition hover:border-emerald-300 hover:shadow-sm">
      <label className="mb-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-slate-600">
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] ${active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`} aria-hidden="true">{icon}</span>
        <span className="truncate">{label}</span>
        {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="সক্রিয়" />}
      </label>
      <div className="relative">
        {children}
        <svg aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.22 7.47a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
  );
}

const filterSelectClass =
  "w-full min-w-0 appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-2.5 pr-7 text-xs font-medium text-slate-700 outline-none transition hover:bg-white focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

const emptyFilters: Filters = {
  institutions: [],
  exams: [],
  posts: [],
  years: [],
  topics: [],
  examTypes: [],
  grades: [],
  summary: { questions: 0, exams: 0, institutions: 0, subjects: 0, topics: 0 },
};

export default function PublicQuestionBank({
  initialSubjectId,
  initialTopicId,
}: {
  initialSubjectId?: string;
  initialTopicId?: string;
}) {
  const [view, setView] = useState<ViewMode>("all");
  const [activeSummaryCard, setActiveSummaryCard] = useState<"all" | "exam" | "institution" | "subject" | "topic">("all");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [exams, setExams] = useState<Exam[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; _count?: { questions: number } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadedPages, setLoadedPages] = useState(1);
  const [sort, setSort] = useState("newest");

  const [search, setSearch] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [postId, setPostId] = useState("");
  const [grade, setGrade] = useState("");
  const [examId, setExamId] = useState("");
  const [examType, setExamType] = useState("");
  const [examYear, setExamYear] = useState("");
  const [subTopicId, setSubTopicId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [hasAnswer, setHasAnswer] = useState("");
  const [hasExplanation, setHasExplanation] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? "");
  const [topicId, setTopicId] = useState(initialTopicId ?? "");
  const [difficulty, setDifficulty] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [isRepeated, setIsRepeated] = useState("");

  const {
    visibility: globalVisibility,
    mode: visibilityMode,
    setGlobal: setGlobalVisibility,
    setMode: setVisibilityMode,
    setQuestion: setQuestionVisibility,
    getEffective: getEffectiveVisibility,
  } = useQuestionVisibility();

  const [answers, setAnswers] = useState<Record<string, AnswerData>>({});
  const [loadingAnswers, setLoadingAnswers] = useState<Record<string, boolean>>({});

  const loadAnswer = useCallback(
    async (questionId: string) => {
      if (answers[questionId] || loadingAnswers[questionId]) return;

      setLoadingAnswers((current) => ({
        ...current,
        [questionId]: true,
      }));

      try {
        const response = await fetch(
          `/api/public/questions/${questionId}`,
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
        setError(
          e instanceof Error ? e.message : "উত্তর লোড করা যায়নি।",
        );
      } finally {
        setLoadingAnswers((current) => ({
          ...current,
          [questionId]: false,
        }));
      }
    },
    [answers, loadingAnswers],
  );

  useEffect(() => {
    if (view !== "all") return;

    questions.forEach((question) => {
      const effective = getEffectiveVisibility(question.id);
      if ((effective.answers || effective.explanations) &&
          !answers[question.id] && !loadingAnswers[question.id]) {
        void loadAnswer(question.id);
      }
    });
  }, [getEffectiveVisibility, view, questions, answers, loadingAnswers, loadAnswer]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (search.trim()) params.set("search", search.trim());
    if (institutionId) params.set("institutionId", institutionId);
    if (postId) params.set("postId", postId);
    if (grade) params.set("grade", grade);
    if (examId) params.set("examId", examId);
    if (examType) params.set("examType", examType);
    if (examYear) params.set("examYear", examYear);
    const effectiveTopicId = chapterId || subTopicId || topicId;
    if (effectiveTopicId) params.set("topicId", effectiveTopicId);
    if (hasAnswer) params.set("hasAnswer", hasAnswer);
    if (hasExplanation) params.set("hasExplanation", hasExplanation);
    if (yearFrom) params.set("yearFrom", yearFrom);
    if (yearTo) params.set("yearTo", yearTo);
    if (subjectId) params.set("subjectId", subjectId);
    if (difficulty) params.set("difficulty", difficulty);
    if (questionType) params.set("questionType", questionType);
    if (isRepeated) params.set("isRepeated", isRepeated);
    if (sort !== "newest") params.set("sort", sort);

    return params.toString();
  }, [
    search,
    institutionId,
    postId,
    grade,
    examId,
    examType,
    examYear,
    subTopicId,
    chapterId,
    hasAnswer,
    hasExplanation,
    yearFrom,
    yearTo,
    subjectId,
    topicId,
    difficulty,
    questionType,
    isRepeated,
    sort,
  ]);

  const loadInitial = useCallback(async () => {
    try {
      const [filterResponse, subjectResponse] = await Promise.all([
        fetch("/api/public/filters", { cache: "no-store" }),
        fetch("/api/public/subjects", { cache: "no-store" }),
      ]);

      const filterJson = await filterResponse.json();
      const subjectJson = await subjectResponse.json();

      if (!filterResponse.ok) {
        throw new Error(
          filterJson.message || "Filter data could not be loaded.",
        );
      }

      setFilters(filterJson.data ?? emptyFilters);
      setSubjects(subjectJson.data ?? []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load Question Bank.",
      );
    }
  }, []);

  const loadExams = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/public/exams${queryString ? `?${queryString}` : ""}`,
        { cache: "no-store" },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Exam list could not be loaded.");
      }

      setExams(result.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load exams.");
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams(queryString);
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));

      const response = await fetch(
        `/api/public/questions?${params.toString()}`,
        { cache: "no-store" },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Questions could not be loaded.",
        );
      }

      setQuestions(result.data ?? []);
      setLoadedPages(1);
      setTotal(Number(result.pagination?.total ?? 0));
      setTotalPages(
        Math.max(1, Number(result.pagination?.totalPages ?? 1)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load questions.");
      setQuestions([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [queryString, page]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || page + loadedPages > totalPages) return;

    setLoadingMore(true);
    setError("");

    try {
      const params = new URLSearchParams(queryString);
      params.set("page", String(page + loadedPages));
      params.set("limit", String(PAGE_SIZE));

      const response = await fetch(
        `/api/public/questions?${params.toString()}`,
        { cache: "no-store" },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "More questions could not be loaded.");
      }

      const nextQuestions: Question[] = result.data ?? [];

      setQuestions((current) => {
        const existingIds = new Set(current.map((question) => question.id));
        return [
          ...current,
          ...nextQuestions.filter((question) => !existingIds.has(question.id)),
        ];
      });

      setTotal(Number(result.pagination?.total ?? total));
      setTotalPages(
        Math.max(1, Number(result.pagination?.totalPages ?? totalPages)),
      );
      setLoadedPages((current) => current + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load more questions.",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [
    queryString,
    page,
    loadedPages,
    totalPages,
    total,
    loading,
    loadingMore,
  ]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    setPage(1);
  }, [queryString, view]);

  useEffect(() => {
    if (view === "cards") {
      void loadExams();
    } else if (view === "all") {
      void loadQuestions();
    }
  }, [view, loadExams, loadQuestions]);

  const filteredExams = useMemo(() => {
    const copy = exams.filter((exam) => {
      if (exam.examYear === null) {
        return !yearFrom && !yearTo;
      }

      const examYear = exam.examYear;

      if (yearFrom && yearTo) {
        return examYear >= Number(yearFrom) && examYear <= Number(yearTo);
      }

      if (yearFrom) return examYear === Number(yearFrom);
      if (yearTo) return examYear === Number(yearTo);

      return true;
    });

    if (sort === "az") {
      copy.sort((a, b) => a.name.localeCompare(b.name, "bn"));
    } else if (sort === "za") {
      copy.sort((a, b) => b.name.localeCompare(a.name, "bn"));
    }

    return copy;
  }, [exams, sort, yearFrom, yearTo]);

  const displayedQuestions = useMemo(() => {
    const copy = [...questions];

    if (sort === "az") {
      copy.sort((a, b) =>
        a.questionText.localeCompare(b.questionText, "bn", {
          numeric: true,
        }),
      );
    } else if (sort === "za") {
      copy.sort((a, b) =>
        b.questionText.localeCompare(a.questionText, "bn", {
          numeric: true,
        }),
      );
    }

    return copy;
  }, [questions, sort]);

  const visibleQuestions = displayedQuestions;

  const activeFilterCount = [
    institutionId, examId, examType, postId, grade, examYear, subjectId, topicId,
    subTopicId, chapterId, questionType, difficulty, hasAnswer, hasExplanation,
    isRepeated, yearFrom, yearTo,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setInstitutionId("");
    setPostId("");
    setGrade("");
    setExamId("");
    setExamType("");
    setExamYear("");
    setSubTopicId("");
    setChapterId("");
    setHasAnswer("");
    setHasExplanation("");
    setYearFrom("");
    setYearTo("");
    setSubjectId("");
    setTopicId("");
    setDifficulty("");
    setQuestionType("");
    setIsRepeated("");
    setSort("newest");
    setPage(1);
  };

  const changeView = (next: ViewMode) => {
    setView(next);
    setActiveSummaryCard(next === "cards" ? "exam" : "all");
    setPage(1);
  };

  const selectSummaryCard = (key: "all" | "exam" | "institution" | "subject" | "topic") => {
    setActiveSummaryCard(key);
    if (key === "exam") {
      setView("cards");
    } else if (key === "institution") {
      setInstitutionId("");
      setExamId("");
      setView("institutions");
    } else if (key === "subject") {
      setSubjectId("");
      setTopicId("");
      setSubTopicId("");
      setChapterId("");
      setView("subjects");
    } else if (key === "topic") {
      setTopicId("");
      setSubTopicId("");
      setChapterId("");
      setView("topics");
    } else {
      setView("all");
    }
    setPage(1);
  };

  const selectInstitution = (id: string) => {
    setInstitutionId(id);
    setExamId("");
    setView("all");
    setActiveSummaryCard("institution");
    setPage(1);
  };

  const selectSubject = (id: string) => {
    setSubjectId(id);
    setTopicId("");
    setSubTopicId("");
    setChapterId("");
    setView("all");
    setActiveSummaryCard("subject");
    setPage(1);
  };

  const selectTopic = (topic: Topic) => {
    setSubjectId(topic.subjectId);
    setTopicId(topic.id);
    setSubTopicId("");
    setChapterId("");
    setView("all");
    setActiveSummaryCard("topic");
    setPage(1);
  };

  const renderQuestion = (question: Question) => {
    const questionVisibility = getEffectiveVisibility(question.id);
    const needsAnswer = questionVisibility.answers || questionVisibility.explanations;
    const answer = needsAnswer ? answers[question.id] : undefined;

    return (
      <article
        key={question.id}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
            {question.subject || "সাধারণ"}
          </span>
          {question.topic && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{question.topic}</span>
          )}
          {question.difficulty && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{question.difficulty}</span>
          )}
          {question.isRepeated && (
            <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">Repeated</span>
          )}
        </div>

        <h3 className="whitespace-pre-wrap text-base font-semibold leading-7 text-slate-800">
          {question.questionText}
        </h3>

        {questionVisibility.options && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
                  <span className="mr-2 font-semibold">{option.label}.</span>
                  {option.optionText}
                  {revealedOption?.isCorrect && (
                    <span className="ml-2 font-bold">✓ সঠিক উত্তর</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {needsAnswer && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            {loadingAnswers[question.id] && !answer ? (
              <p className="text-sm text-slate-500">উত্তর লোড হচ্ছে...</p>
            ) : answer ? (
              <div className="space-y-3">
                {questionVisibility.answers && answer.correctAnswer && (
                  <p className="text-sm font-semibold text-emerald-800">
                    সঠিক উত্তর: {answer.correctAnswer}
                  </p>
                )}
                {questionVisibility.explanations && answer.explanation && (
                  <div className="rounded-lg bg-emerald-50 p-4 text-sm leading-7 text-slate-700">
                    <p className="mb-1 font-bold text-emerald-800">ব্যাখ্যা</p>
                    {answer.explanation}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-rose-600">উত্তর লোড করা যায়নি।</p>
            )}
          </div>
        )}

        <QuestionVisibilityControls
          visibility={questionVisibility}
          onChange={(key, value) => setQuestionVisibility(question.id, key, value)}
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-500">
            {question.occurrenceCount ?? 0} occurrence(s)
          </span>
          <Link
            href={`/question-bank/${question.id}`}
            className="text-sm font-semibold text-emerald-700 hover:underline"
          >
            বিস্তারিত ও উত্তর দেখুন →
          </Link>
        </div>
      </article>
    );
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">সকল প্রশ্ন</p>
          <h1 className="text-2xl font-bold text-slate-900">Question Bank</h1>
          <p className="mt-1 text-sm text-slate-500">{filters.summary.questions.toLocaleString("en-US")} Questions</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Compact Design</span>
      </header>

      <section aria-label="Question Bank categories" className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {([
          { key: "all", label: "সকল প্রশ্ন", value: filters.summary.questions, note: "প্রকাশিত প্রশ্ন" },
          { key: "exam", label: "Exam Wise", value: filters.summary.exams, note: "পরীক্ষার সংগ্রহ" },
          { key: "institution", label: "Institution", value: filters.summary.institutions, note: "প্রতিষ্ঠান" },
          { key: "subject", label: "Subject", value: filters.summary.subjects, note: "বিষয়" },
          { key: "topic", label: "Topic", value: filters.summary.topics, note: "টপিক" },
        ] as { key: "all" | "exam" | "institution" | "subject" | "topic"; label: string; value: number; note: string }[]).map((card) => {
          const active = activeSummaryCard === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => selectSummaryCard(card.key)}
              aria-pressed={active}
              className={`flex min-h-[104px] w-full flex-col justify-between rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${active ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200" : "border-slate-200 bg-white"}`}
            >
              <span className="text-xs font-semibold text-slate-500">{card.label}</span>
              <span className="flex items-end justify-between gap-2">
                <span className="text-2xl font-bold leading-none tabular-nums text-slate-900">{card.value.toLocaleString("en-US")}</span>
                <span className="text-[11px] font-medium text-slate-400">{card.note}</span>
              </span>
            </button>
          );
        })}
      </section>

      <section aria-label="প্রশ্ন ব্যাংক ফিল্টার" className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50/40 p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm">
              <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h16M7 12h10m-7 7h4" /><path d="M6 5v3m12-3v3M9 12v3m6-3v3" />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-extrabold text-slate-900 sm:text-base">প্রশ্ন খুঁজুন — স্মার্ট ফিল্টার</h2>
              <p className="text-[11px] text-slate-500">আপনার প্রয়োজন অনুযায়ী ১৮টি ফিল্টার ব্যবহার করুন</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              {activeFilterCount}টি ফিল্টার সক্রিয়
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {view === "cards" ? filteredExams.length.toLocaleString("en-US") : total.toLocaleString("en-US")} ফলাফল
            </span>
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-100">
              <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" /><path d="M3 3v5h5" />
              </svg>
              সব Filter Reset করুন
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <FilterField label="সকল প্রতিষ্ঠান" icon="🏢" active={Boolean(institutionId)}>
            <select aria-label="সকল প্রতিষ্ঠান" value={institutionId} onChange={(e) => { setInstitutionId(e.target.value); setExamId(""); }} className={filterSelectClass}>
              <option value="">সকল প্রতিষ্ঠান</option>
              {filters.institutions.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.count.toLocaleString("en-US")})</option>)}
            </select>
          </FilterField>

          <FilterField label="সকল পরীক্ষা" icon="📝" active={Boolean(examId)}>
            <select aria-label="সকল পরীক্ষা" value={examId} onChange={(e) => setExamId(e.target.value)} className={filterSelectClass}>
              <option value="">সকল পরীক্ষা</option>
              {filters.exams.filter((exam) => !institutionId || exam.institution?.id === institutionId).map((exam) => <option key={exam.id} value={exam.id}>{exam.name} · {exam.examYear ?? "—"} ({exam.questionCount.toLocaleString("en-US")})</option>)}
            </select>
          </FilterField>

          <FilterField label="পরীক্ষার ধরন" icon="📑" active={Boolean(examType)}>
            <select aria-label="সকল পরীক্ষার ধরন" value={examType} onChange={(e) => setExamType(e.target.value)} className={filterSelectClass}>
              <option value="">সকল পরীক্ষার ধরন</option>
              {filters.examTypes.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count.toLocaleString("en-US")})</option>)}
            </select>
          </FilterField>

          <FilterField label="সকল পদ" icon="💼" active={Boolean(postId)}>
            <select aria-label="সকল পদ" value={postId} onChange={(e) => setPostId(e.target.value)} className={filterSelectClass}>
              <option value="">সকল পদ</option>
              {filters.posts.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.count.toLocaleString("en-US")})</option>)}
            </select>
          </FilterField>

          <FilterField label="পদের গ্রেড" icon="🏷️" active={Boolean(grade)}>
            <select aria-label="সকল পদের গ্রেড" value={grade} onChange={(e) => setGrade(e.target.value)} className={filterSelectClass}>
              <option value="">সকল পদের গ্রেড</option>
              {filters.grades.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count.toLocaleString("en-US")})</option>)}
            </select>
          </FilterField>

          <FilterField label="পরীক্ষার বছর" icon="📅" active={Boolean(examYear)}>
            <select aria-label="সকল পরীক্ষার বছর" value={examYear} onChange={(e) => setExamYear(e.target.value)} className={filterSelectClass}>
              <option value="">সকল পরীক্ষার বছর</option>
              {filters.years.map((item) => <option key={item.year} value={item.year}>{item.year} ({item.count.toLocaleString("en-US")})</option>)}
            </select>
          </FilterField>

          <FilterField label="সকল বিষয়" icon="📚" active={Boolean(subjectId)}>
            <select aria-label="সকল বিষয়" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(""); setSubTopicId(""); setChapterId(""); }} className={filterSelectClass}>
              <option value="">সকল বিষয়</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}{subject._count?.questions !== undefined ? ` (${subject._count.questions.toLocaleString("en-US")})` : ""}</option>)}
            </select>
          </FilterField>

          <FilterField label="সকল টপিক" icon="🗂️" active={Boolean(topicId)}>
            <select aria-label="সকল টপিক" value={topicId} onChange={(e) => { setTopicId(e.target.value); setSubTopicId(""); setChapterId(""); }} className={filterSelectClass}>
              <option value="">সকল টপিক</option>
              {filters.topics.filter((topic) => topic.parentId === null && (!subjectId || topic.subjectId === subjectId)).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}{topic.count !== undefined ? ` (${topic.count.toLocaleString("en-US")})` : ""}</option>)}
            </select>
          </FilterField>

          <FilterField label="সকল Sub-topic" icon="📖" active={Boolean(subTopicId)}>
            <select aria-label="সকল Sub-topic" value={subTopicId} onChange={(e) => { setSubTopicId(e.target.value); setChapterId(""); }} disabled={!topicId} className={filterSelectClass}>
              <option value="">সকল Sub-topic</option>
              {filters.topics.filter((topic) => topic.parentId === topicId).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}{topic.count !== undefined ? ` (${topic.count.toLocaleString("en-US")})` : ""}</option>)}
            </select>
          </FilterField>

          <FilterField label="সকল Chapter" icon="📘" active={Boolean(chapterId)}>
            <select aria-label="সকল Chapter" value={chapterId} onChange={(e) => setChapterId(e.target.value)} disabled={!subTopicId} className={filterSelectClass}>
              <option value="">সকল Chapter</option>
              {filters.topics.filter((topic) => topic.parentId === subTopicId).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}{topic.count !== undefined ? ` (${topic.count.toLocaleString("en-US")})` : ""}</option>)}
            </select>
          </FilterField>

          <FilterField label="প্রশ্নের ধরন" icon="❔" active={Boolean(questionType)}>
            <select aria-label="সকল প্রশ্নের ধরন" value={questionType} onChange={(e) => setQuestionType(e.target.value)} className={filterSelectClass}>
              <option value="">সকল প্রশ্নের ধরন</option><option value="MCQ">MCQ</option><option value="TRUE_FALSE">True / False</option><option value="FILL_IN_THE_BLANKS">Fill in the blanks</option><option value="WRITTEN">Written</option>
            </select>
          </FilterField>

          <FilterField label="কঠিনতার স্তর" icon="🎯" active={Boolean(difficulty)}>
            <select aria-label="সকল কঠিনতার স্তর" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={filterSelectClass}>
              <option value="">সকল কঠিনতার স্তর</option><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
            </select>
          </FilterField>

          <FilterField label="প্রশ্নের অবস্থা" icon="🌐">
            <select aria-label="প্রকাশিত প্রশ্ন" value="PUBLISHED" disabled className={filterSelectClass}><option value="PUBLISHED">প্রকাশিত প্রশ্ন</option></select>
          </FilterField>

          <FilterField label="উত্তরের অবস্থা" icon="✓" active={Boolean(hasAnswer)}>
            <select aria-label="উত্তর: সব" value={hasAnswer} onChange={(e) => setHasAnswer(e.target.value)} className={filterSelectClass}>
              <option value="">উত্তর: সব</option><option value="true">উত্তর আছে</option><option value="false">উত্তর নেই</option>
            </select>
          </FilterField>

          <FilterField label="ব্যাখ্যার অবস্থা" icon="💡" active={Boolean(hasExplanation)}>
            <select aria-label="ব্যাখ্যা: সব" value={hasExplanation} onChange={(e) => setHasExplanation(e.target.value)} className={filterSelectClass}>
              <option value="">ব্যাখ্যা: সব</option><option value="true">ব্যাখ্যা আছে</option><option value="false">ব্যাখ্যা নেই</option>
            </select>
          </FilterField>

          <FilterField label="পুনরাবৃত্ত প্রশ্ন" icon="🔁" active={Boolean(isRepeated)}>
            <select aria-label="Repeated: সব" value={isRepeated} onChange={(e) => setIsRepeated(e.target.value)} className={filterSelectClass}>
              <option value="">Repeated: সব</option><option value="true">শুধু Repeated</option><option value="false">শুধু Non-repeated</option>
            </select>
          </FilterField>

          <FilterField label="Year From" icon="⏮️" active={Boolean(yearFrom)}>
            <select aria-label="Year From" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} className={filterSelectClass}>
              <option value="">Year From</option>
              {filters.years.map((item) => <option key={item.year} value={item.year}>{item.year} ({item.count.toLocaleString("en-US")})</option>)}
            </select>
          </FilterField>

          <FilterField label="Year To" icon="⏭️" active={Boolean(yearTo)}>
            <select aria-label="Year To" value={yearTo} onChange={(e) => setYearTo(e.target.value)} className={filterSelectClass}>
              <option value="">Year To</option>
              {filters.years.map((item) => <option key={item.year} value={item.year}>{item.year} ({item.count.toLocaleString("en-US")})</option>)}
            </select>
          </FilterField>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="newest">সর্বশেষ আগে</option><option value="az">A–Z</option><option value="za">Z–A</option></select>
        <GlobalVisibilityControls visibility={globalVisibility} onChange={setGlobalVisibility} />
      </div>

      <div className="mb-5 w-full">
        <div className="relative">
          <svg aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="প্রতিষ্ঠান, পদ, পরীক্ষা, বিষয় ও বছর অনুযায়ী প্রশ্ন খুঁজুন" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-500">লোড হচ্ছে...</div>
      ) : view === "institutions" ? (
        <section aria-label="প্রতিষ্ঠান তালিকা">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">প্রতিষ্ঠান অনুযায়ী প্রশ্ন</h2>
            <span className="text-sm text-slate-500">মোট {filters.institutions.length}টি প্রতিষ্ঠান</span>
          </div>
          {filters.institutions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">কোনো প্রতিষ্ঠান পাওয়া যায়নি।</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filters.institutions.map((institution) => (
                <button key={institution.id} type="button" onClick={() => selectInstitution(institution.id)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50">
                  <span className="font-semibold text-slate-800">{institution.name}</span>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{institution.count.toLocaleString("en-US")} প্রশ্ন</span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : view === "subjects" ? (
        <section aria-label="বিষয় তালিকা">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">বিষয় অনুযায়ী প্রশ্ন</h2>
            <span className="text-sm text-slate-500">মোট {subjects.length}টি বিষয়</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {subjects.map((subject) => (
              <button key={subject.id} type="button" onClick={() => selectSubject(subject.id)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50">
                <span className="font-semibold text-slate-800">{subject.name}</span>
                <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{(subject._count?.questions ?? 0).toLocaleString("en-US")} প্রশ্ন</span>
              </button>
            ))}
          </div>
        </section>
      ) : view === "topics" ? (
        <section aria-label="টপিক তালিকা">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">টপিক অনুযায়ী প্রশ্ন</h2>
            <span className="text-sm text-slate-500">মোট {filters.topics.length}টি টপিক</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filters.topics.map((topic) => (
              <button key={topic.id} type="button" onClick={() => selectTopic(topic)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50">
                <span className="block font-semibold text-slate-800">{topic.name}</span>
                <span className="mt-1 block text-xs text-slate-500">{(topic.subject?.name ?? "বিষয় অনির্ধারিত") + (topic.count !== undefined ? " · " + topic.count.toLocaleString("en-US") + " প্রশ্ন" : "")}</span>
              </button>
            ))}
          </div>
        </section>
      ) : view === "cards" ? (
        <>
          <div className="mb-4 text-sm text-slate-600">
            মোট {filteredExams.length}টি পরীক্ষার সংগ্রহ
          </div>

          {filteredExams.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
              কোনো প্রকাশিত পরীক্ষার প্রশ্ন পাওয়া যায়নি।
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredExams.map((exam) => (
                <Link
                  key={exam.id}
                  href={`/question-bank/exam/${exam.id}`}
                  className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-400 hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {exam.examYear ?? "বছর অনির্ধারিত"}
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {exam.questionCount}টি প্রশ্ন
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700">
                    {exam.post?.name || exam.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{exam.name}</p>

                  <div className="mt-4 space-y-1 text-sm text-slate-500">
                    <p>
                      প্রতিষ্ঠান:{" "}
                      <span className="font-medium text-slate-700">
                        {exam.institution?.name || "উল্লেখ নেই"}
                      </span>
                    </p>
                    {exam.grade && (
                      <p>
                        পদের গ্রেড: <span className="font-medium text-slate-700">{exam.grade}</span>
                      </p>
                    )}
                    {exam.examType && (
                      <p>
                        পরীক্ষার ধরন:{" "}
                        <span className="font-medium text-slate-700">
                          {exam.examType}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-3 text-sm font-bold text-emerald-700">
                    প্রশ্ন ও সমাধান দেখুন →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 text-sm text-slate-600">
            মোট {total}টি প্রশ্ন
          </div>

          {questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
              কোনো প্রকাশিত প্রশ্ন পাওয়া যায়নি।
            </div>
          ) : (
            <div className="space-y-4">
              {visibleQuestions.map(renderQuestion)}
            </div>
          )}

          {page + loadedPages - 1 < totalPages && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadMore()}
                className="rounded-lg bg-green-700 px-6 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingMore ? "লোড হচ্ছে..." : "আরও প্রশ্ন দেখুন ↓"}
                {!loadingMore && (
                  <span className="ml-2 text-green-100">
                    Load More · পরবর্তী ২০টি প্রশ্ন
                  </span>
                )}
              </button>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex flex-col items-center gap-4">
              
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
                >
                  আগের পৃষ্ঠা
                </button>

                {Array.from(
                  { length: Math.min(6, totalPages) },
                  (_, index) =>
                    Math.max(1, Math.min(page - 2, totalPages - 5)) + index,
                ).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    disabled={loading}
                    onClick={() => setPage(pageNumber)}
                    className={`min-w-10 rounded-lg border px-3 py-2 text-sm ${
                      page === pageNumber
                        ? "border-green-700 bg-green-700 font-bold text-white"
                        : "border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}

                {totalPages > 6 && page < totalPages - 2 && (
                  <>
                    <span className="px-1 text-slate-500">...</span>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setPage(totalPages)}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        page === totalPages
                          ? "border-green-700 bg-green-700 font-bold text-white"
                          : "border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      Last ({totalPages})
                    </button>
                  </>
                )}

                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
                >
                  পরের পৃষ্ঠা
                </button>
              </div>

              <p className="text-sm text-slate-500">
                পৃষ্ঠা {page} / {totalPages} · মোট {total}টি প্রশ্ন
              </p>
            </div>
          )}
        </>
      )}
    </main>
  );
}
