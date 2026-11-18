"use client";

import { useEffect, useState } from "react";

type OptionKey = "A" | "B" | "C" | "D";
type SaveState = "NOT_SAVED" | "SAVED" | "FAILED" | "SKIPPED";

type DuplicateMatch = {
  source: "DATABASE" | "OCR_BATCH";
  questionId?: string;
  questionIndex?: number;
  questionText: string;
  similarity: number;
  matchType: "EXACT" | "SIMILAR";
};

type DuplicateDecision = "NONE" | "PENDING" | "SAVE_ANYWAY" | "SKIP";
type DuplicateCheckStatus = "IDLE" | "CHECKING" | "COMPLETE" | "FAILED";

type DuplicateCheckResponse = {
  success?: boolean;
  message?: string;
  results?: Array<{
    clientId: string;
    duplicateFound: boolean;
    matches: DuplicateMatch[];
  }>;
  scanTruncated?: boolean;
  scannedDatabaseQuestions?: number;
  databaseScanLimit?: number;
  data?: DuplicateCheckResponse;
};

type ParsedQuestion = {
  questionNumber: number | null;
  questionText: string;
  options: Record<OptionKey, string>;
  correctAnswer: OptionKey | null;
  sourcePage: number;
  reviewRequired: boolean;
  reviewReasons: string[];
  rawText: string;
};

type EditableQuestion = ParsedQuestion & {
  manuallyVerified: boolean;
  saveState: SaveState;
  saveError?: string;
  savedQuestionId?: string;
  historyRowId: string;
  duplicateMatches: DuplicateMatch[];
  duplicateDecision: DuplicateDecision;
};

type OcrPage = {
  page: number;
  text: string;
  confidence: number;
  method: "TEXT" | "OCR";
};

type OcrHistoryRow = {
  id: string;
  rowNumber: number;
  status: string;
  rawData?: Record<string, unknown> | null;
  errorMessages?: unknown;
  questionId?: string | null;
};

type OcrResumePayload = {
  batch: {
    id: string;
    fileName: string;
    fileType: string;
  };
  rows: OcrHistoryRow[];
};

type OcrStoredMetadata = {
  sourceFileName?: string;
  institution?: string;
  examName?: string;
  examYear?: string;
  subject?: string;
  topic?: string;
  manuallyVerified?: boolean;
  saveError?: string;
  duplicateMatches?: DuplicateMatch[];
  duplicateDecision?: DuplicateDecision;
  savedQuestionId?: string;
};

type OcrResponse = {
  success?: boolean;
  message?: string;
  totalPages?: number;
  text?: string;
  pages?: OcrPage[];
  parsedQuestions?: ParsedQuestion[];
  parserSummary?: {
    totalQuestions: number;
    reviewRequired: number;
    readyForReview: number;
    savedToQuestionBank: boolean;
  };
  history?: {
    batchId: string;
    rows: Array<{ id: string; rowNumber: number }>;
  } | null;
  data?: OcrResponse;
};

type QuestionApiResponse = {
  success?: boolean;
  message?: string;
  data?: {
    id?: string;
  };
};

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

export default function OcrQuestionImportPanel() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [pages, setPages] = useState<OcrPage[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [historyBatchId, setHistoryBatchId] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [progressDirty, setProgressDirty] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressSavedAt, setProgressSavedAt] = useState("");
  const [duplicateScanTruncated, setDuplicateScanTruncated] = useState(false);
  const [acceptIncompleteDuplicateScan, setAcceptIncompleteDuplicateScan] =
    useState(false);

  const [institution, setInstitution] = useState("");
  const [examName, setExamName] = useState("");
  const [examYear, setExamYear] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicateCheckStatus, setDuplicateCheckStatus] =
    useState<DuplicateCheckStatus>("IDLE");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function updateHistoryRow(
    rowId: string,
    status: "PENDING" | "VALID" | "INVALID" | "DUPLICATE" | "IMPORTED" | "SKIPPED",
    errorMessages?: string[],
    questionId?: string | null,
    rawData?: Record<string, unknown>,
  ): Promise<boolean> {
    if (!historyBatchId || !rowId) {
      setError("OCR History ID পাওয়া যায়নি।");
      return false;
    }

    try {
      const response = await fetch(
        `/api/imports/ocr/history/${historyBatchId}/rows/${rowId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            ...(errorMessages !== undefined ? { errorMessages } : {}),
            ...(questionId !== undefined ? { questionId } : {}),
            ...(rawData !== undefined ? { rawData } : {}),
          }),
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "History update failed.");
      }

      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? `History Update Error: ${err.message}`
          : "OCR History update failed.",
      );
      return false;
    }
  }
  function resetPanel() {
    setFile(null);
    setQuestions([]);
    setPages([]);
    setTotalPages(0);
    setHistoryBatchId("");
    setSourceFileName("");
    setProgressDirty(false);
    setProgressSavedAt("");
    setDuplicateScanTruncated(false);
    setAcceptIncompleteDuplicateScan(false);
    setDuplicateCheckStatus("IDLE");

    setInstitution("");
    setExamName("");
    setExamYear("");
    setSubject("");
    setTopic("");

    setError("");
    setMessage("");
  }

  async function closePanel() {
    if (loading || saving || progressSaving || duplicateCheckStatus === "CHECKING") return;

    if (historyBatchId && progressDirty) {
      const saved = await saveOcrProgress();
      if (!saved) {
        setError("OCR progress History-তে Save হয়নি। Error ঠিক করে আবার চেষ্টা করুন।");
        return;
      }
    }

    setOpen(false);
    resetPanel();
  }

  function selectFile(selectedFile: File | null) {
    setError("");
    setMessage("");

    if (historyBatchId && questions.length > 0 && selectedFile) {
      setError(
        "বর্তমান OCR Batch আগে Close করুন। এটি History-তে সংরক্ষিত থাকবে; তারপর নতুন ফাইল নির্বাচন করুন।",
      );
      return;
    }

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const extension = selectedFile.name
      .split(".")
      .pop()
      ?.toLowerCase();

    if (!["pdf", "png", "jpg", "jpeg"].includes(extension ?? "")) {
      setFile(null);
      setError("শুধু PDF, PNG, JPG ও JPEG ফাইল গ্রহণ করা হবে।");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setFile(null);
      setError("ফাইলের সর্বোচ্চ সাইজ ১০ MB হতে পারবে।");
      return;
    }

    setFile(selectedFile);
    setQuestions([]);
    setPages([]);
    setTotalPages(0);
    setHistoryBatchId("");
    setSourceFileName(selectedFile.name);
    setProgressDirty(false);
    setDuplicateScanTruncated(false);
    setAcceptIncompleteDuplicateScan(false);
    setDuplicateCheckStatus("IDLE");
  }

  async function runOcrPreview() {
    if (!file) {
      setError("প্রথমে একটি PDF অথবা Image নির্বাচন করুন।");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setQuestions([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/imports/ocr/preview", {
        method: "POST",
        body: formData,
        cache: "no-store",
      });

      const result = (await response.json()) as OcrResponse;
      const payload = (result.data ?? result) as OcrResponse;

      if (!response.ok || payload.success !== true) {
        throw new Error(
          payload.message || result.message || "OCR Preview ব্যর্থ হয়েছে।",
        );
      }

      const parsedQuestions = payload.parsedQuestions ?? [];

      if (parsedQuestions.length === 0) {
        throw new Error(
          "OCR Text পাওয়া গেছে, কিন্তু কোনো প্রশ্ন শনাক্ত করা যায়নি।",
        );
      }

      const historyRows = payload.history?.rows ?? [];
      if (
        !payload.history?.batchId ||
        historyRows.length !== parsedQuestions.length ||
        historyRows.some((row) => !row.id)
      ) {
        throw new Error(
          "OCR History Batch তৈরি হয়নি। নিরাপদে Preview চালিয়ে যাওয়া যাচ্ছে না।",
        );
      }

      const editableQuestions: EditableQuestion[] = parsedQuestions.map(
        (question, index) => ({
          ...question,
          options: {
            A: question.options?.A ?? "",
            B: question.options?.B ?? "",
            C: question.options?.C ?? "",
            D: question.options?.D ?? "",
          },
          manuallyVerified: false,
          saveState: "NOT_SAVED",
          historyRowId:
            historyRows.find((row) => row.rowNumber === index + 1)?.id ?? "",
          duplicateMatches: [],
          duplicateDecision: "NONE",
        }),
      );

      setQuestions(editableQuestions);
      setHistoryBatchId(payload.history.batchId);
      setSourceFileName(file.name);
      setProgressDirty(true);
      setPages(payload.pages ?? []);
      setTotalPages(payload.totalPages ?? 0);
      setDuplicateScanTruncated(false);
      setAcceptIncompleteDuplicateScan(false);

      setMessage(
        `${parsedQuestions.length}টি প্রশ্ন শনাক্ত হয়েছে। এখন প্রশ্নগুলো যাচাই ও সংশোধন করুন।`,
      );

      await runDuplicateCheck(editableQuestions);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "OCR Preview তৈরি করা যায়নি।",
      );
    } finally {
      setLoading(false);
    }
  }

  async function runDuplicateCheck(
    sourceQuestions: EditableQuestion[],
  ) {
    if (sourceQuestions.length === 0) return;

    setDuplicateCheckStatus("CHECKING");
    setDuplicateScanTruncated(false);
    setAcceptIncompleteDuplicateScan(false);
    setError("");

    try {
      const response = await fetch("/api/duplicates/check-ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: sourceQuestions.map((question, index) => ({
            clientId: `ocr-${index}`,
            questionText: question.questionText,
            questionType: "MCQ",
          })),
          ignoreQuestionIds: sourceQuestions
            .map((question) => question.savedQuestionId)
            .filter((id): id is string => Boolean(id)),
        }),
        cache: "no-store",
      });

      const rawResult =
        (await response.json()) as DuplicateCheckResponse;
      const result = (rawResult.data ?? rawResult) as DuplicateCheckResponse;

      if (
        !response.ok ||
        result.success !== true ||
        !Array.isArray(result.results) ||
        result.results.length !== sourceQuestions.length
      ) {
        throw new Error(
          result.message || "Duplicate Check সম্পন্ন করা যায়নি।",
        );
      }

      const matchesByIndex: DuplicateMatch[][] =
        sourceQuestions.map(() => []);

      result.results.forEach((item) => {
        const currentIndex = Number(item.clientId.replace("ocr-", ""));

        if (
          !Number.isInteger(currentIndex) ||
          currentIndex < 0 ||
          currentIndex >= sourceQuestions.length
        ) {
          return;
        }

        for (const match of item.matches ?? []) {
          matchesByIndex[currentIndex].push(match);

          if (
            match.source === "OCR_BATCH" &&
            typeof match.questionIndex === "number" &&
            match.questionIndex >= 0 &&
            match.questionIndex < sourceQuestions.length
          ) {
            matchesByIndex[match.questionIndex].push({
              source: "OCR_BATCH",
              questionIndex: currentIndex,
              questionText: sourceQuestions[currentIndex].questionText,
              similarity: match.similarity,
              matchType: match.matchType,
            });
          }
        }
      });

      const updatedQuestions = sourceQuestions.map((question, index) => {
        const matches = matchesByIndex[index];

        return {
          ...question,
          duplicateMatches: matches,
          duplicateDecision:
            question.saveState === "SAVED"
              ? question.duplicateDecision
              : question.saveState === "SKIPPED"
                ? "SKIP"
                : matches.length > 0
                  ? "PENDING"
                  : "NONE",
        };
      });

      setQuestions(updatedQuestions);
      setDuplicateScanTruncated(Boolean(result.scanTruncated));
      setAcceptIncompleteDuplicateScan(false);
      setDuplicateCheckStatus("COMPLETE");
      setProgressDirty(true);

      if (result.scanTruncated) {
        setMessage(
          `সর্বশেষ ${result.scannedDatabaseQuestions ?? 5000}টি প্রশ্ন পরীক্ষা হয়েছে। Database-এ আরও প্রশ্ন থাকতে পারে; সতর্কতা দেখে সিদ্ধান্ত নিন।`,
        );
      }
    } catch (err) {
      setDuplicateCheckStatus("FAILED");
      setError(
        err instanceof Error
          ? `Duplicate Check ব্যর্থ: ${err.message} Save বন্ধ থাকবে।`
          : "Duplicate Check ব্যর্থ। Save বন্ধ থাকবে।",
      );
    }
  }

  async function setDuplicateDecision(
    index: number,
    decision: "SAVE_ANYWAY" | "SKIP",
  ) {
    const question = questions[index];

    if (!question || question.saveState === "SAVED") return;

    const status =
      decision === "SKIP"
        ? "SKIPPED"
        : question.manuallyVerified
          ? "VALID"
          : "DUPLICATE";

    const updatedQuestion: EditableQuestion = {
      ...question,
      duplicateDecision: decision,
      saveState: decision === "SKIP" ? "SKIPPED" : "NOT_SAVED",
      manuallyVerified:
        decision === "SKIP" ? false : question.manuallyVerified,
    };

    if (
      !(await updateHistoryRow(
        question.historyRowId,
        status,
        undefined,
        undefined,
        buildHistoryRawData(updatedQuestion),
      ))
    ) {
      return;
    }

    setQuestions((current) =>
      current.map((item, questionIndex) =>
        questionIndex === index ? updatedQuestion : item,
      ),
    );
    setProgressDirty(true);
  }
  function restoreSkippedQuestion(index: number) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index
          ? {
              ...question,
              saveState: "NOT_SAVED",
              duplicateDecision: "PENDING",
              manuallyVerified: false,
            }
          : question,
      ),
    );
    setDuplicateCheckStatus("IDLE");
    setProgressDirty(true);
  }

  function updateQuestion(
    index: number,
    field: "questionText",
    value: string,
  ) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index
          ? {
              ...question,
              [field]: value,
              manuallyVerified: false,
              saveState: "NOT_SAVED",
              saveError: undefined,
              duplicateMatches: [],
              duplicateDecision: "NONE",
            }
          : question,
      ),
    );
    setDuplicateCheckStatus("IDLE");
    setDuplicateScanTruncated(false);
    setAcceptIncompleteDuplicateScan(false);
    setProgressDirty(true);
  }

  function updateQuestionNumber(index: number, value: string) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index
          ? {
              ...question,
              questionNumber: value === "" ? null : Number(value),
              manuallyVerified: false,
              saveState: "NOT_SAVED",
              saveError: undefined,
            }
          : question,
      ),
    );
    setProgressDirty(true);
  }

  function updateOption(
    index: number,
    key: OptionKey,
    value: string,
  ) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index
          ? {
              ...question,
              options: {
                ...question.options,
                [key]: value,
              },
              manuallyVerified: false,
              saveState: "NOT_SAVED",
              saveError: undefined,
            }
          : question,
      ),
    );
    setProgressDirty(true);
  }

  function updateAnswer(index: number, value: string) {
    const answer =
      OPTION_KEYS.find((option) => option === value) ?? null;

    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index
          ? {
              ...question,
              correctAnswer: answer,
              manuallyVerified: false,
              saveState: "NOT_SAVED",
              saveError: undefined,
            }
          : question,
      ),
    );
    setProgressDirty(true);
  }

  async function toggleVerified(index: number, checked: boolean) {
    const question = questions[index];

    if (!question || question.saveState === "SAVED") return;
    if (question.duplicateDecision === "SKIP") return;

    if (checked) {
      const issues = getQuestionIssues(question);

      if (issues.length > 0) {
        setError(`Question ${index + 1}: ${issues.join(" ")}`);
        return;
      }
    }

    const status =
      question.duplicateMatches.length > 0 &&
      question.duplicateDecision !== "SAVE_ANYWAY"
        ? "DUPLICATE"
        : checked
          ? "VALID"
          : "PENDING";

    const updatedQuestion = {
      ...question,
      manuallyVerified: checked,
    };

    if (
      !(await updateHistoryRow(
        question.historyRowId,
        status,
        undefined,
        undefined,
        buildHistoryRawData(updatedQuestion),
      ))
    ) {
      return;
    }

    setQuestions((current) =>
      current.map((item, questionIndex) =>
        questionIndex === index ? updatedQuestion : item,
      ),
    );
    setProgressDirty(true);
  }

  function getQuestionIssues(question: EditableQuestion): string[] {
    const issues: string[] = [];

    if (!question.questionText.trim()) {
      issues.push("Question Text required.");
    }

    if (question.questionText.length > 1000) {
      issues.push("Question Text maximum 1000 characters.");
    }

    for (const key of OPTION_KEYS) {
      if (!question.options[key]?.trim()) {
        issues.push(`Option ${key} is required.`);
      } else if (question.options[key].length > 2000) {
        issues.push(`Option ${key} exceeds 2000 characters.`);
      }
    }

    if (!question.correctAnswer) {
      issues.push("Correct Answer নির্বাচন করতে হবে.");
    } else if (!question.options[question.correctAnswer]?.trim()) {
      issues.push("Correct Answer-এর Option খালি.");
    }

    if (
      question.questionNumber !== null &&
      (!Number.isInteger(question.questionNumber) ||
        question.questionNumber < 1)
    ) {
      issues.push("Question Number অবশ্যই ধনাত্মক পূর্ণসংখ্যা হতে হবে.");
    }

    return issues;
  }

  function getMetadataIssues(): string[] {
    const issues: string[] = [];

    if (!institution.trim()) {
      issues.push("Institution required.");
    }

    if (institution.trim().length > 200) {
      issues.push("Institution maximum 200 characters.");
    }

    if (!examName.trim()) {
      issues.push("Exam Name required.");
    }

    if (examName.trim().length > 200) {
      issues.push("Exam Name maximum 200 characters.");
    }

    const year = Number(examYear);

    if (
      !examYear.trim() ||
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 2100
    ) {
      issues.push("Exam Year অবশ্যই 1900 থেকে 2100-এর মধ্যে হতে হবে.");
    }

    if (!subject.trim()) {
      issues.push("Subject required.");
    }

    if (subject.trim().length > 200) {
      issues.push("Subject maximum 200 characters.");
    }

    if (!topic.trim()) {
      issues.push("Topic required.");
    }

    if (topic.trim().length > 200) {
      issues.push("Topic maximum 200 characters.");
    }

    return issues;
  }

  const verifiedCount = questions.filter(
    (question) => question.manuallyVerified,
  ).length;

  const savedCount = questions.filter(
    (question) => question.saveState === "SAVED",
  ).length;

  const failedCount = questions.filter(
    (question) => question.saveState === "FAILED",
  ).length;
  const skippedCount = questions.filter(
    (question) => question.saveState === "SKIPPED",
  ).length;

  const readyQuestions = questions.filter(
    (question) =>
      duplicateCheckStatus === "COMPLETE" &&
      (!duplicateScanTruncated || acceptIncompleteDuplicateScan) &&
      question.manuallyVerified &&
      question.saveState !== "SAVED" &&
      question.duplicateDecision !== "PENDING" &&
      question.duplicateDecision !== "SKIP" &&
      (
        question.duplicateMatches.length === 0 ||
        question.duplicateDecision === "SAVE_ANYWAY"
      ) &&
      getQuestionIssues(question).length === 0,
  );

  const metadataIssues = getMetadataIssues();

  function getHistoryRowStatus(
    question: EditableQuestion,
  ): "PENDING" | "VALID" | "INVALID" | "DUPLICATE" | "IMPORTED" | "SKIPPED" {
    if (question.saveState === "SAVED") return "IMPORTED";
    if (question.saveState === "SKIPPED") return "SKIPPED";
    if (question.saveState === "FAILED") return "INVALID";
    if (
      question.duplicateMatches.length > 0 &&
      question.duplicateDecision !== "SAVE_ANYWAY"
    ) {
      return "DUPLICATE";
    }
    if (question.manuallyVerified && getQuestionIssues(question).length === 0) {
      return "VALID";
    }
    return "PENDING";
  }

  function buildHistoryRawData(
    question: EditableQuestion,
  ): Record<string, unknown> {
    return {
      questionNumber: question.questionNumber,
      questionText: question.questionText,
      options: question.options,
      correctAnswer: question.correctAnswer,
      sourcePage: question.sourcePage,
      reviewRequired: question.reviewRequired,
      reviewReasons: question.reviewReasons,
      rawText: question.rawText,
      _ocr: {
        sourceFileName,
        institution,
        examName,
        examYear,
        subject,
        topic,
        manuallyVerified: question.manuallyVerified,
        saveState: question.saveState,
        saveError: question.saveError ?? "",
        savedQuestionId: question.savedQuestionId ?? "",
        duplicateMatches: question.duplicateMatches,
        duplicateDecision: question.duplicateDecision,
      },
    };
  }

  async function saveOcrProgress(): Promise<boolean> {
    if (!historyBatchId || questions.length === 0) return false;
    if (progressSaving) return false;

    setProgressSaving(true);

    try {
      const response = await fetch(
        `/api/imports/ocr/history/${historyBatchId}/progress`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: questions.map((question) => ({
              rowId: question.historyRowId,
              status: getHistoryRowStatus(question),
              rawData: buildHistoryRawData(question),
              ...(question.savedQuestionId
                ? { questionId: question.savedQuestionId }
                : {}),
              errorMessages: question.saveError
                ? [question.saveError]
                : null,
            })),
          }),
          cache: "no-store",
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "OCR progress could not be saved.");
      }

      setProgressDirty(false);
      setProgressSavedAt(new Date().toLocaleTimeString("bn-BD"));
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? `Progress Save Error: ${err.message}`
          : "OCR progress save failed.",
      );
      return false;
    } finally {
      setProgressSaving(false);
    }
  }

  async function saveVerifiedQuestions() {
    setError("");
    setMessage("");

    if (duplicateCheckStatus !== "COMPLETE") {
      setError("Duplicate Check সম্পূর্ণ না হওয়া পর্যন্ত Save করা যাবে না।");
      return;
    }

    if (duplicateScanTruncated && !acceptIncompleteDuplicateScan) {
      setError("Database Duplicate Scan অসম্পূর্ণ। সতর্কতা বুঝে সম্মতি না দেওয়া পর্যন্ত Save বন্ধ থাকবে।");
      return;
    }

    if (metadataIssues.length > 0) {
      setError(
        `Batch Information সম্পূর্ণ করুন: ${metadataIssues.join(" ")}`,
      );
      return;
    }

    if (readyQuestions.length === 0) {
      setError(
        "Save করার মতো কোনো সম্পূর্ণ ও হাতে যাচাই করা প্রশ্ন পাওয়া যায়নি।",
      );
      return;
    }

    setSaving(true);

    let successCount = 0;
    let failureCount = 0;

    try {
      for (let index = 0; index < questions.length; index++) {
        const question = questions[index];

        const shouldSave =
          question.manuallyVerified &&
          question.saveState !== "SAVED" &&
          question.duplicateDecision !== "PENDING" &&
          question.duplicateDecision !== "SKIP" &&
          (
            question.duplicateMatches.length === 0 ||
            question.duplicateDecision === "SAVE_ANYWAY"
          ) &&
          duplicateCheckStatus === "COMPLETE" &&
          (!duplicateScanTruncated || acceptIncompleteDuplicateScan) &&
          getQuestionIssues(question).length === 0;

        if (!shouldSave) {
          continue;
        }

        try {
          const payload = {
            questionText: question.questionText.trim(),
            questionType: "MCQ",
            subject: subject.trim(),
            topic: topic.trim(),
            correctAnswer: question.correctAnswer,
            difficulty: "MEDIUM",
            status: "DRAFT",
            options: OPTION_KEYS.map((key, optionIndex) => ({
              label: key,
              optionText: question.options[key].trim(),
              isCorrect: question.correctAnswer === key,
              sortOrder: optionIndex,
            })),
            occurrences: [
              {
                institution: institution.trim(),
                examName: examName.trim(),
                examYear: Number(examYear),
                ...(question.questionNumber !== null
                  ? { questionNumber: question.questionNumber }
                  : {}),
                source: sourceFileName || file?.name || "OCR Import",
                sourcePage: question.sourcePage,
              },
            ],
          };

          const response = await fetch("/api/questions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            cache: "no-store",
          });

          const result =
            (await response.json()) as QuestionApiResponse;

          if (!response.ok || result.success !== true) {
            throw new Error(
              result.message || `Question ${index + 1} Save failed.`,
            );
          }

          successCount++;

          await updateHistoryRow(
            question.historyRowId,
            "IMPORTED",
            undefined,
            result.data?.id ?? null,
            buildHistoryRawData({
              ...question,
              saveState: "SAVED",
              savedQuestionId: result.data?.id,
              manuallyVerified: true,
            }),
          );

          setQuestions((current) =>
            current.map((item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    saveState: "SAVED",
                    savedQuestionId: result.data?.id,
                    saveError: undefined,
                    manuallyVerified: true,
                  }
                : item,
            ),
          );
          setProgressDirty(true);
        } catch (err) {
          failureCount++;

          const saveError =
            err instanceof Error
              ? err.message
              : "Unknown Save Error.";

          await updateHistoryRow(
            question.historyRowId,
            "INVALID",
            [saveError],
            undefined,
            buildHistoryRawData({
              ...question,
              saveState: "FAILED",
              saveError,
            }),
          );

          setQuestions((current) =>
            current.map((item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    saveState: "FAILED",
                    saveError,
                  }
                : item,
            ),
          );
          setProgressDirty(true);
        }
      }

      if (successCount > 0) {
        setMessage(
          `${successCount}টি প্রশ্ন সফলভাবে Question Bank-এ DRAFT হিসেবে Save হয়েছে।`,
        );

        window.dispatchEvent(
          new CustomEvent("shikhasetu:questions-updated"),
        );
      }

      if (failureCount > 0) {
        setDuplicateCheckStatus("IDLE");
        setDuplicateScanTruncated(false);
        setAcceptIncompleteDuplicateScan(false);
        setError(
          `${failureCount}টি প্রশ্ন Save হয়নি। Error দেখে সংশোধন করুন, তারপর Recheck Duplicates চালিয়ে Retry করুন।`,
        );
      }

      if (successCount === 0 && failureCount === 0) {
        setError("কোনো নতুন প্রশ্ন Save করার প্রয়োজন নেই।");
      }
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (
      !open ||
      !historyBatchId ||
      questions.length === 0 ||
      !progressDirty ||
      loading ||
      saving ||
      progressSaving
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveOcrProgress();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    open,
    historyBatchId,
    questions,
    institution,
    examName,
    examYear,
    subject,
    topic,
    progressDirty,
    loading,
    saving,
  ]);

  useEffect(() => {
    const handleResume = (event: Event) => {
      const detail = (event as CustomEvent<OcrResumePayload>).detail;
      if (!detail?.batch?.id || !Array.isArray(detail.rows)) return;

      const firstRaw = detail.rows[0]?.rawData ?? {};
      const firstMeta = (
        typeof firstRaw._ocr === "object" && firstRaw._ocr !== null
          ? firstRaw._ocr
          : {}
      ) as OcrStoredMetadata;

      const resumedQuestions: EditableQuestion[] = detail.rows.map((row) => {
        const raw = (row.rawData ?? {}) as Record<string, unknown>;
        const meta = (
          typeof raw._ocr === "object" && raw._ocr !== null
            ? raw._ocr
            : {}
        ) as OcrStoredMetadata;

        const rawOptions = (
          typeof raw.options === "object" && raw.options !== null
            ? raw.options
            : {}
        ) as Partial<Record<OptionKey, string>>;

        const status = row.status.toUpperCase();
        const saveState: SaveState =
          status === "IMPORTED"
            ? "SAVED"
            : status === "SKIPPED" ||
                (status === "DUPLICATE" && meta.duplicateDecision === "SKIP")
              ? "SKIPPED"
              : status === "INVALID"
                ? "FAILED"
                : "NOT_SAVED";

        const matches = Array.isArray(meta.duplicateMatches)
          ? meta.duplicateMatches
          : [];

        return {
          questionNumber:
            typeof raw.questionNumber === "number"
              ? raw.questionNumber
              : null,
          questionText: String(raw.questionText ?? ""),
          options: {
            A: String(rawOptions.A ?? ""),
            B: String(rawOptions.B ?? ""),
            C: String(rawOptions.C ?? ""),
            D: String(rawOptions.D ?? ""),
          },
          correctAnswer:
            ["A", "B", "C", "D"].includes(String(raw.correctAnswer))
              ? (String(raw.correctAnswer) as OptionKey)
              : null,
          sourcePage:
            typeof raw.sourcePage === "number" ? raw.sourcePage : 1,
          reviewRequired: Boolean(raw.reviewRequired),
          reviewReasons: Array.isArray(raw.reviewReasons)
            ? raw.reviewReasons.map(String)
            : [],
          rawText: String(raw.rawText ?? raw.questionText ?? ""),
          manuallyVerified:
            Boolean(meta.manuallyVerified) || status === "IMPORTED",
          saveState,
          saveError:
            meta.saveError ||
            (Array.isArray(row.errorMessages)
              ? row.errorMessages.map(String).join("; ")
              : ""),
          savedQuestionId: row.questionId ?? meta.savedQuestionId,
          historyRowId: row.id,
          duplicateMatches: matches,
          duplicateDecision:
            status === "SKIPPED"
              ? "SKIP"
              : (meta.duplicateDecision ??
                (status === "DUPLICATE" ? "PENDING" : "NONE")),
        };
      });

      setHistoryBatchId(detail.batch.id);
      setSourceFileName(detail.batch.fileName);
      setFile(null);
      setQuestions(resumedQuestions);
      setPages([]);
      setTotalPages(
        Math.max(0, ...resumedQuestions.map((question) => question.sourcePage)),
      );
      setInstitution(firstMeta.institution ?? "");
      setExamName(firstMeta.examName ?? "");
      setExamYear(firstMeta.examYear ?? "");
      setSubject(firstMeta.subject ?? "");
      setTopic(firstMeta.topic ?? "");
      setDuplicateCheckStatus("IDLE");
      setDuplicateScanTruncated(false);
      setAcceptIncompleteDuplicateScan(false);
      setProgressDirty(false);
      setError("");
      setMessage(
        `"${detail.batch.fileName}" OCR History থেকে Resume হয়েছে। Duplicate আবার যাচাই করুন।`,
      );
      setOpen(true);

      window.setTimeout(() => {
        void runDuplicateCheck(resumedQuestions);
      }, 0);
    };

    window.addEventListener(
      "shikhasetu:resume-ocr-import",
      handleResume as EventListener,
    );

    return () => {
      window.removeEventListener(
        "shikhasetu:resume-ocr-import",
        handleResume as EventListener,
      );
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-semibold text-violet-800 shadow-sm transition hover:bg-violet-100"
      >
        <span className="text-base">▤</span>
        OCR Import
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  OCR Question Import
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  বাংলা ও English PDF/Image থেকে প্রশ্ন শনাক্ত, যাচাই ও Save করুন
                </p>
              </div>

              <button
                type="button"
                onClick={closePanel}
                disabled={loading || saving || progressSaving || duplicateCheckStatus === "CHECKING"}
                className="rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                aria-label="Close OCR panel"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6">
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <strong>Manual Review Required:</strong> OCR থেকে পাওয়া
                প্রশ্ন ও উত্তর যাচাই করুন। হাতে যাচাই না করা প্রশ্ন Save করা যাবে না।
                সব প্রশ্ন DRAFT হিসেবে সংরক্ষিত হবে।
              </div>

              <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-5">
                <label className="block text-sm font-semibold text-slate-800">
                  PDF অথবা Image নির্বাচন করুন
                </label>

                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  disabled={loading || saving || progressSaving || questions.length > 0}
                  onChange={(event) =>
                    selectFile(event.target.files?.[0] ?? null)
                  }
                  className="mt-3 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:font-semibold file:text-violet-700 hover:file:bg-violet-100"
                />

                {file && (
                  <p className="mt-3 break-all text-xs text-slate-500">
                    {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}

                <button
                  type="button"
                  onClick={runOcrPreview}
                  disabled={!file || loading || saving}
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {loading
                    ? "OCR Processing..."
                    : "Upload & Generate Preview"}
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              {message && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  {message}
                </div>
              )}

              {questions.length > 0 && (
                <>
                  <div className="mt-6">
                    <h3 className="text-base font-bold text-slate-900">
                      Batch Examination Information
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      এই তথ্যগুলো একই PDF-এর সব প্রশ্নের সঙ্গে যুক্ত হবে।
                      Subject ও Topic-এর নাম Question Bank-এর বিদ্যমান নামের সঙ্গে মিলিয়ে দিন।
                    </p>

                    <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Institution *
                        </label>
                        <input
                          value={institution}
                          onChange={(event) => {
                            setInstitution(event.target.value);
                            setProgressDirty(true);
                          }}
                          disabled={saving || progressSaving}
                          maxLength={200}
                          placeholder="যেমন: Bangladesh Public Service Commission"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Exam Name *
                        </label>
                        <input
                          value={examName}
                          onChange={(event) => {
                            setExamName(event.target.value);
                            setProgressDirty(true);
                          }}
                          disabled={saving || progressSaving}
                          maxLength={200}
                          placeholder="যেমন: Preliminary Examination"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Exam Year *
                        </label>
                        <input
                          type="number"
                          min="1900"
                          max="2100"
                          step="1"
                          value={examYear}
                          onChange={(event) => {
                            setExamYear(event.target.value);
                            setProgressDirty(true);
                          }}
                          disabled={saving || progressSaving}
                          placeholder="যেমন: 2025"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Subject *
                        </label>
                        <input
                          value={subject}
                          onChange={(event) => {
                            setSubject(event.target.value);
                            setProgressDirty(true);
                          }}
                          disabled={saving || progressSaving}
                          maxLength={200}
                          placeholder="যেমন: English"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          Topic *
                        </label>
                        <input
                          value={topic}
                          onChange={(event) => {
                            setTopic(event.target.value);
                            setProgressDirty(true);
                          }}
                          disabled={saving || progressSaving}
                          maxLength={200}
                          placeholder="যেমন: Grammar"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                        />
                      </div>
                    </div>

                    {metadataIssues.length > 0 && (
                      <p className="mt-2 text-xs text-amber-700">
                        Save করার আগে Institution, Exam, Year, Subject ও Topic সম্পূর্ণ করুন।
                      </p>
                    )}
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs text-slate-500">
                        Total Questions
                      </p>
                      <p className="mt-1 text-2xl font-black text-slate-900">
                        {questions.length}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs text-slate-500">Pages</p>
                      <p className="mt-1 text-2xl font-black text-slate-900">
                        {totalPages}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs text-slate-500">
                        Manually Verified
                      </p>
                      <p className="mt-1 text-2xl font-black text-emerald-700">
                        {verifiedCount}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs text-slate-500">Saved</p>
                      <p className="mt-1 text-2xl font-black text-blue-700">
                        {savedCount}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Editable Questions
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        প্রশ্ন, চারটি Option ও সঠিক উত্তর যাচাই করুন।
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void saveOcrProgress()}
                      disabled={saving || progressSaving || !historyBatchId}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      {progressSaving ? "Saving Progress..." : "Save Progress"}
                    </button>
                    <button
                      type="button"
                      onClick={() => runDuplicateCheck(questions)}
                      disabled={saving || loading || progressSaving || duplicateCheckStatus === "CHECKING"}
                      className="rounded-lg border border-orange-300 bg-white px-3 py-2 text-xs font-bold text-orange-800 hover:bg-orange-50 disabled:opacity-40"
                    >
                      {duplicateCheckStatus === "CHECKING"
                        ? "Checking Duplicates..."
                        : "Recheck Duplicates"}
                    </button>
                    <span className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800">
                      Ready to Save: {readyQuestions.length}
                    </span>
                  </div>

                  {duplicateScanTruncated && (
                    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                      <p className="text-sm font-bold text-amber-900">
                        Duplicate Scan সীমাবদ্ধতা
                      </p>
                      <p className="mt-1 text-xs text-amber-800">
                        Database-এর সর্বশেষ ৫,০০০টি প্রশ্ন পরীক্ষা হয়েছে। আরও পুরোনো প্রশ্ন থাকলে সেগুলো এই Scan-এ আসেনি।
                      </p>
                      <label className="mt-3 flex items-start gap-2 text-xs text-amber-900">
                        <input
                          type="checkbox"
                          checked={acceptIncompleteDuplicateScan}
                          onChange={(event) => {
                            setAcceptIncompleteDuplicateScan(event.target.checked);
                            setProgressDirty(true);
                          }}
                          disabled={saving || progressSaving}
                          className="mt-0.5 h-4 w-4"
                        />
                        সীমাবদ্ধতা বুঝে এই অসম্পূর্ণ Scan-এর ভিত্তিতে এগিয়ে যেতে সম্মতি দিচ্ছি।
                      </label>
                    </div>
                  )}

                  {duplicateCheckStatus !== "COMPLETE" && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      Duplicate Check সম্পূর্ণ না হওয়া পর্যন্ত Save বন্ধ থাকবে।
                    </div>
                  )}

                  <div className="mt-4 space-y-4">
                    {questions.map((question, index) => {
                      const pageInfo = pages.find(
                        (page) => page.page === question.sourcePage,
                      );

                      const issues = getQuestionIssues(question);
                      const isSaved = question.saveState === "SAVED";
                      const isSkipped = question.saveState === "SKIPPED";

                      return (
                        <section
                          key={`${question.sourcePage}-${index}`}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                        >
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                                Question {index + 1}
                              </span>
                              <span className="text-xs text-slate-500">
                                Page {question.sourcePage}
                                {pageInfo
                                  ? ` · OCR ${pageInfo.confidence}% · ${pageInfo.method}`
                                  : ""}
                              </span>
                            </div>

                            {isSaved ? (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                                Saved · DRAFT
                              </span>
                            ) : question.saveState === "FAILED" ? (
                              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                                Save Failed
                              </span>
                            ) : question.saveState === "SKIPPED" ? (
                              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                                Skipped
                              </span>
                            ) : question.manuallyVerified ? (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                                Manually Verified
                              </span>
                            ) : question.reviewRequired ? (
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                                OCR Review Needed
                              </span>
                            ) : (
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                                OCR Parsed
                              </span>
                            )}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">
                                Question No.
                              </label>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={question.questionNumber ?? ""}
                                disabled={saving || progressSaving || isSaved || isSkipped}
                                onChange={(event) =>
                                  updateQuestionNumber(
                                    index,
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">
                                Question Text
                              </label>
                              <textarea
                                rows={2}
                                value={question.questionText}
                                disabled={saving || progressSaving || isSaved || isSkipped}
                                maxLength={1000}
                                onChange={(event) =>
                                  updateQuestion(
                                    index,
                                    "questionText",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                              />
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {OPTION_KEYS.map((key) => (
                              <div key={key}>
                                <label className="mb-1 block text-xs font-bold text-slate-700">
                                  Option {key}
                                </label>
                                <textarea
                                  rows={2}
                                  value={question.options[key]}
                                  disabled={saving || progressSaving || isSaved || isSkipped}
                                  maxLength={2000}
                                  onChange={(event) =>
                                    updateOption(
                                      index,
                                      key,
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:items-end">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">
                                Correct Answer
                              </label>
                              <select
                                value={question.correctAnswer ?? ""}
                                disabled={saving || progressSaving || isSaved || isSkipped}
                                onChange={(event) =>
                                  updateAnswer(index, event.target.value)
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                              >
                                <option value="">Not identified</option>
                                {OPTION_KEYS.map((key) => (
                                  <option key={key} value={key}>
                                    Option {key}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <label className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={question.manuallyVerified}
                                disabled={saving || progressSaving || isSaved || isSkipped}
                                onChange={(event) =>
                                  toggleVerified(index, event.target.checked)
                                }
                                className="h-4 w-4 rounded border-slate-300 text-violet-600"
                              />
                              আমি প্রশ্নটি হাতে যাচাই করেছি
                            </label>
                          </div>

                          {question.reviewReasons.length > 0 && (
                            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <p className="text-xs font-bold text-amber-900">
                                Original OCR Review Reasons
                              </p>
                              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-800">
                                {question.reviewReasons.map(
                                  (reason, reasonIndex) => (
                                    <li key={reasonIndex}>{reason}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}

                          {question.duplicateMatches.length > 0 && !isSaved && (
                            <div className="mt-4 rounded-lg border border-orange-300 bg-orange-50 p-3">
                              <p className="text-sm font-bold text-orange-900">
                                সম্ভাব্য Duplicate পাওয়া গেছে
                              </p>

                              <div className="mt-2 space-y-2">
                                {question.duplicateMatches.map((match, matchIndex) => (
                                  <div
                                    key={`${match.source}-${match.questionId ?? match.questionIndex}-${matchIndex}`}
                                    className="rounded-lg border border-orange-200 bg-white p-3"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-xs font-bold text-orange-800">
                                        {match.matchType === "EXACT" ? "Exact Match" : "Similar Question"}
                                      </span>
                                      <span className="text-xs font-semibold text-slate-600">
                                        Similarity: {(match.similarity * 100).toFixed(1)}%
                                      </span>
                                    </div>

                                    <p className="mt-2 text-sm text-slate-800">
                                      {match.questionText}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                      {match.source === "DATABASE"
                                        ? `Existing Question ID: ${match.questionId}`
                                        : `একই OCR Batch-এর Question ${Number(match.questionIndex) + 1}`}
                                    </p>
                                  </div>
                                ))}
                              </div>

                              {question.duplicateDecision !== "SKIP" && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={saving || progressSaving}
                                    onClick={() => setDuplicateDecision(index, "SKIP")}
                                    className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-40"
                                  >
                                    Duplicate হিসেবে Skip
                                  </button>

                                  <button
                                    type="button"
                                    disabled={saving || progressSaving}
                                    onClick={() => setDuplicateDecision(index, "SAVE_ANYWAY")}
                                    className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-40"
                                  >
                                    তবুও Save Anyway
                                  </button>
                                </div>
                              )}
                              {question.duplicateDecision === "SKIP" && (
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                  <p className="text-xs font-bold text-orange-800">
                                    এই প্রশ্নটি Skip করা হয়েছে।
                                  </p>
                                  <button
                                    type="button"
                                    disabled={saving || progressSaving}
                                    onClick={() => restoreSkippedQuestion(index)}
                                    className="rounded-lg border border-orange-300 bg-white px-3 py-2 text-xs font-bold text-orange-800 hover:bg-orange-100 disabled:opacity-40"
                                  >
                                    Restore for Review
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          {question.manuallyVerified &&
                            !isSaved &&
                            issues.length > 0 && (
                              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                                <p className="text-xs font-bold text-red-800">
                                  Save Validation
                                </p>
                                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-700">
                                  {issues.map((issue, issueIndex) => (
                                    <li key={issueIndex}>{issue}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                          {question.saveError && (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                              Save Error: {question.saveError}
                            </div>
                          )}

                          <details className="mt-4">
                            <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-violet-700">
                              Original OCR Text দেখুন
                            </summary>
                            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-xs leading-6 text-slate-700">
                              {question.rawText}
                            </pre>
                          </details>
                        </section>
                      );
                    })}
                  </div>

                  <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Save Verified Questions
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Verified ও সম্পূর্ণ প্রশ্নগুলো Question Bank-এ DRAFT হিসেবে সংরক্ষণ হবে।
                        </p>
                        {failedCount > 0 && (
                          <p className="mt-1 text-xs text-red-600">
                            {failedCount}টি প্রশ্নের Save ব্যর্থ হয়েছে। সংশোধন করে Retry করতে পারবেন।
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={saveVerifiedQuestions}
                        disabled={
                          saving ||
                          loading ||
                          progressSaving ||
                          duplicateCheckStatus !== "COMPLETE" ||
                          (duplicateScanTruncated && !acceptIncompleteDuplicateScan) ||
                          readyQuestions.length === 0 ||
                          metadataIssues.length > 0
                        }
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {saving
                          ? "Saving Questions..."
                          : `Save Verified Questions (${readyQuestions.length})`}
                      </button>
                    </div>

                    <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      Total: {questions.length} · Verified: {verifiedCount} ·
                      Saved: {savedCount} · Skipped: {skippedCount} · Failed: {failedCount}
                      {progressSavedAt ? ` · Progress saved ${progressSavedAt}` : ""}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Save সফল হলে প্রশ্ন DRAFT থাকবে। একই প্রশ্ন দ্বিতীয়বার
                      Save করা হবে না। ব্যর্থ প্রশ্ন সংশোধন করে Retry করা যাবে।
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
              <span className="text-xs text-slate-500">
                Shikhasetu · OCR Question Import
              </span>

              <button
                type="button"
                onClick={closePanel}
                disabled={loading || saving || progressSaving || duplicateCheckStatus === "CHECKING"}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
