
"use client";

import { useMemo, useState } from "react";
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

const initialQuestions: Question[] = [
  {
    id: "Q-001",
    institution: "BCS",
    exam: "৪৫তম BCS প্রিলিমিনারি",
    year: 2022,
    post: "ক্যাডার",
    department: "সাধারণ",
    subject: "বাংলা",
    topic: "সাধারণ জ্ঞান",
    questionType: "MCQ",
    question: "বাংলাদেশের জাতীয় ফুল কোনটি?",
    optionA: "গোলাপ",
    optionB: "শাপলা",
    optionC: "জবা",
    optionD: "বেলি",
    correctAnswer: "B",
    explanation: "বাংলাদেশের জাতীয় ফুল শাপলা।",
    difficulty: "Easy",
    repeatGroupId: "",
    source: "Demo Question",
    status: "Published",
  },
  {
    id: "Q-002",
    institution: "BCS",
    exam: "৪৬তম BCS প্রিলিমিনারি",
    year: 2024,
    post: "ক্যাডার",
    department: "সাধারণ",
    subject: "বাংলা",
    topic: "সাহিত্য",
    questionType: "MCQ",
    question: "বাংলা ভাষার আদি নিদর্শন কোনটি?",
    optionA: "শ্রীকৃষ্ণকীর্তন",
    optionB: "মঙ্গলকাব্য",
    optionC: "চর্যাপদ",
    optionD: "বৈষ্ণব পদাবলি",
    correctAnswer: "C",
    explanation: "চর্যাপদ বাংলা ভাষা ও সাহিত্যের প্রাচীনতম নিদর্শন।",
    difficulty: "Easy",
    repeatGroupId: "",
    source: "Demo Question",
    status: "Published",
  },
  {
    id: "Q-003",
    institution: "বাংলাদেশ ব্যাংক",
    exam: "Officer Exam",
    year: 2023,
    post: "Officer",
    department: "সাধারণ",
    subject: "English",
    topic: "Vocabulary",
    questionType: "MCQ",
    question: "What is the synonym of Abundant?",
    optionA: "Scarce",
    optionB: "Plentiful",
    optionC: "Limited",
    optionD: "Rare",
    correctAnswer: "B",
    explanation: "Abundant means available in large quantities; plentiful is its synonym.",
    difficulty: "Easy",
    repeatGroupId: "",
    source: "Demo Question",
    status: "Published",
  },
  {
    id: "Q-004",
    institution: "DPP",
    exam: "নিয়োগ পরীক্ষা",
    year: 2025,
    post: "অফিস সহকারী",
    department: "সাধারণ",
    subject: "কম্পিউটার",
    topic: "Computer Basics",
    questionType: "MCQ",
    question: "কম্পিউটারের মস্তিষ্ক বলা হয় কাকে?",
    optionA: "RAM",
    optionB: "CPU",
    optionC: "Monitor",
    optionD: "Keyboard",
    correctAnswer: "B",
    explanation: "CPU নির্দেশনা প্রক্রিয়াকরণ ও কম্পিউটারের কার্যক্রম নিয়ন্ত্রণ করে।",
    difficulty: "Easy",
    repeatGroupId: "",
    source: "Demo Question",
    status: "Published",
  },
  {
    id: "Q-005",
    institution: "প্রাথমিক শিক্ষা অধিদপ্তর",
    exam: "সহকারী শিক্ষক নিয়োগ",
    year: 2023,
    post: "সহকারী শিক্ষক",
    department: "প্রাথমিক শিক্ষা",
    subject: "বাংলা",
    topic: "বাংলাদেশ বিষয়াবলি",
    questionType: "MCQ",
    question: "বাংলাদেশের সংবিধান কার্যকর হয় কবে?",
    optionA: "২৬ মার্চ ১৯৭১",
    optionB: "১৬ ডিসেম্বর ১৯৭১",
    optionC: "৪ নভেম্বর ১৯৭২",
    optionD: "১৬ ডিসেম্বর ১৯৭২",
    correctAnswer: "D",
    explanation: "বাংলাদেশের সংবিধান ১৬ ডিসেম্বর ১৯৭২ তারিখে কার্যকর হয়।",
    difficulty: "Easy",
    repeatGroupId: "",
    source: "Demo Question",
    status: "Published",
  },
];

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

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [selected, setSelected] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formError, setFormError] = useState("");

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const term = search.toLowerCase().trim();

      return (
        (!term ||
          q.question.toLowerCase().includes(term) ||
          q.id.toLowerCase().includes(term) ||
          q.exam.toLowerCase().includes(term) ||
          q.correctAnswer.toLowerCase().includes(term) ||
          q.subject.toLowerCase().includes(term)) &&
        (!filters.from || q.year >= Number(filters.from)) &&
        (!filters.to || q.year <= Number(filters.to)) &&
        (!filters.institution || q.institution === filters.institution) &&
        (!filters.exam || q.exam === filters.exam) &&
        (!filters.post || q.post === filters.post) &&
        (!filters.subject || q.subject === filters.subject) &&
        (!filters.topic || q.topic === filters.topic)
      );
    });
  }, [questions, search, filters]);

  const updateFilter = (key: keyof typeof initialFilters, value: string) => {
    setFilters((old) => ({ ...old, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setSearch("");
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

  const saveQuestion = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const requiredFields: (keyof FormData)[] = [
      "institution",
      "exam",
      "year",
      "post",
      "department",
      "subject",
      "topic",
      "questionType",
      "question",
      "optionA",
      "optionB",
      "optionC",
      "optionD",
      "correctAnswer",
      "difficulty",
      "source",
      "status",
    ];

    if (requiredFields.some((key) => !String(form[key]).trim())) {
      setFormError("চিহ্নিত প্রয়োজনীয় ঘরগুলো পূরণ করুন।");
      return;
    }

    if (!["A", "B", "C", "D"].includes(form.correctAnswer)) {
      setFormError("সঠিক উত্তর A, B, C অথবা D নির্বাচন করুন।");
      return;
    }

    const year = Number(form.year);

    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      setFormError("সঠিক সাল লিখুন (১৯০০–২১০০)।");
      return;
    }

    if (editingId) {
      setQuestions((old) =>
        old.map((q) =>
          q.id === editingId ? { ...q, ...form, year } : q
        )
      );
      setSelected(editingId);
    } else {
      const nextNumber =
        questions.reduce((max, q) => {
          const match = q.id.match(/^Q-(\d+)$/);
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0) + 1;

      const newQuestion: Question = {
        id: `Q-${String(nextNumber).padStart(3, "0")}`,
        ...form,
        year,
      };

      setQuestions((old) => [newQuestion, ...old]);
      setSelected(newQuestion.id);
      resetFilters();
    }

    setIsFormOpen(false);
    setFormError("");
  };

  const deleteQuestion = (id: string) => {
    if (!window.confirm("আপনি কি এই প্রশ্নটি Delete করতে চান?")) return;

    setQuestions((old) => old.filter((q) => q.id !== id));

    if (selected === id) setSelected(null);
  };

  const filterOptions = [
    {
      key: "institution",
      label: "প্রতিষ্ঠান",
      options: [...new Set(questions.map((q) => q.institution))],
    },
    {
      key: "exam",
      label: "পরীক্ষার নাম",
      options: [...new Set(questions.map((q) => q.exam))],
    },
    {
      key: "post",
      label: "পদ",
      options: [...new Set(questions.map((q) => q.post))],
    },
    {
      key: "subject",
      label: "বিষয়",
      options: [...new Set(questions.map((q) => q.subject))],
    },
    {
      key: "topic",
      label: "টপিক",
      options: [...new Set(questions.map((q) => q.topic))],
    },
  ];

  const textField = (
    key: keyof FormData,
    label: string,
    placeholder = "",
    required = true
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
            <Button
              variant="outline"
              onClick={() => alert("Bulk Import সুবিধা পরবর্তী ধাপে তৈরি হবে।")}
            >
              ↑ Import Questions
            </Button>
            <Button onClick={openAddForm}>+ নতুন প্রশ্ন</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: "মোট প্রশ্ন",
              value: questions.length.toLocaleString("bn-BD"),
              icon: "📚",
            },
            {
              label: "প্রতিষ্ঠান",
              value: new Set(questions.map((q) => q.institution)).size.toLocaleString("bn-BD"),
              icon: "🏛️",
            },
            {
              label: "পরীক্ষা",
              value: new Set(questions.map((q) => q.exam)).size.toLocaleString("bn-BD"),
              icon: "📝",
            },
            {
              label: "বিষয়",
              value: new Set(questions.map((q) => q.subject)).size.toLocaleString("bn-BD"),
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
                  <h3 className="font-bold text-slate-800">
                    পরীক্ষার তথ্য
                  </h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    {textField("institution", "Organization / প্রতিষ্ঠান", "যেমন: বাংলাদেশ সরকারি কর্ম কমিশন")}
                    {textField("exam", "Exam Name / পরীক্ষার নাম", "যেমন: ৪৬তম BCS Preliminary")}
                    {textField("year", "Year / সাল", "যেমন: 2024")}
                    {textField("post", "Post Name / পদের নাম", "যেমন: অফিস সহকারী")}
                    {textField("department", "Department / বিভাগ", "যেমন: সাধারণ")}
                    {textField("subject", "Subject / বিষয়", "যেমন: বাংলা")}
                    {textField("topic", "Topic / অধ্যায়", "যেমন: সন্ধি")}

                    <Select
                      label="Question Type / প্রশ্নের ধরন *"
                      value={form.questionType}
                      onChange={(e) => updateForm("questionType", e.target.value)}
                    >
                      <option value="MCQ">MCQ</option>
                      <option value="Written">Written</option>
                      <option value="True/False">True / False</option>
                      <option value="Fill in the Blanks">Fill in the Blanks</option>
                    </Select>
                  </div>
                </section>

                <section className="space-y-3 border-t border-slate-100 pt-5">
                  <h3 className="font-bold text-slate-800">
                    প্রশ্ন ও অপশন
                  </h3>

                  <div className="grid gap-4">
                    {textField("question", "Question / প্রশ্ন", "সম্পূর্ণ প্রশ্ন লিখুন")}

                    <div className="grid gap-4 md:grid-cols-2">
                      {textField("optionA", "Option A", "প্রথম অপশন")}
                      {textField("optionB", "Option B", "দ্বিতীয় অপশন")}
                      {textField("optionC", "Option C", "তৃতীয় অপশন")}
                      {textField("optionD", "Option D", "চতুর্থ অপশন")}
                    </div>

                    <Select
                      label="Correct Answer / সঠিক উত্তর *"
                      value={form.correctAnswer}
                      onChange={(e) => updateForm("correctAnswer", e.target.value)}
                    >
                      <option value="">সঠিক অপশন নির্বাচন করুন</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </Select>

                    <label className="block text-sm font-medium text-slate-700">
                      Explanation / ব্যাখ্যা (ঐচ্ছিক)
                      <textarea
                        className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="উত্তরের বিস্তারিত ব্যাখ্যা লিখুন"
                        value={form.explanation}
                        onChange={(e) => updateForm("explanation", e.target.value)}
                      />
                    </label>
                  </div>
                </section>

                <section className="space-y-3 border-t border-slate-100 pt-5">
                  <h3 className="font-bold text-slate-800">
                    অতিরিক্ত তথ্য
                  </h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Select
                      label="Difficulty / কঠিনতার মাত্রা *"
                      value={form.difficulty}
                      onChange={(e) => updateForm("difficulty", e.target.value)}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </Select>

                    {textField(
                      "repeatGroupId",
                      "Repeat Group ID",
                      "একই প্রশ্নের গ্রুপ ID (না থাকলে ফাঁকা রাখুন)",
                      false
                    )}

                    {textField("source", "Source / উৎস", "যেমন: Demo Question, PDF নাম")}

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
                  {editingId || "নতুন প্রশ্ন সংরক্ষণ করলে স্বয়ংক্রিয়ভাবে তৈরি হবে"}
                </div>

                {formError && (
                  <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
                    {formError}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button type="submit">
                    {editingId ? "পরিবর্তন সংরক্ষণ" : "প্রশ্ন যোগ করুন"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsFormOpen(false)}
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
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>

              <Select
                label="Year To"
                value={filters.to}
                onChange={(e) => updateFilter("to", e.target.value)}
              >
                <option value="">শেষ বছর</option>
                {Array.from({ length: 27 }, (_, i) => 2000 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
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
                      e.target.value
                    )
                  }
                >
                  <option value="">সকল</option>
                  {filter.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-600">
                পাওয়া গেছে:{" "}
                <strong className="text-blue-700">
                  {filteredQuestions.length}
                </strong>{" "}
                টি প্রশ্ন
              </p>
              <Badge>Multi-Filter Active</Badge>
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
                    <Button size="sm" variant="outline" onClick={() => openEditForm(q)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteQuestion(q.id)}>
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
          </CardContent>
        </Card>

        {selectedQuestion && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>প্রশ্নের বিস্তারিত</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
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

              <div className="grid gap-2 sm:grid-cols-2">
                <p>A. {selectedQuestion.optionA}</p>
                <p>B. {selectedQuestion.optionB}</p>
                <p>C. {selectedQuestion.optionC}</p>
                <p>D. {selectedQuestion.optionD}</p>
              </div>

              <p className="font-semibold text-green-700">
                সঠিক উত্তর: {selectedQuestion.correctAnswer}
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
                <p>Repeat Group ID: {selectedQuestion.repeatGroupId || "নেই"}</p>
                <p>Source: {selectedQuestion.source}</p>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </main>
  );
}
