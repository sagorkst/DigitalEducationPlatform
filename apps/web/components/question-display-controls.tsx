"use client";

type Props = {
  showOptions: boolean;
  showAnswers: boolean;
  showExplanations: boolean;
  onOptionsChange: (value: boolean) => void;
  onAnswersChange: (value: boolean) => void;
  onExplanationsChange: (value: boolean) => void;
};

export default function QuestionDisplayControls({
  showOptions,
  showAnswers,
  showExplanations,
  onOptionsChange,
  onAnswersChange,
  onExplanationsChange,
}: Props) {
  const controls = [
    { label: "অপশন", value: showOptions, onChange: onOptionsChange },
    { label: "উত্তর", value: showAnswers, onChange: onAnswersChange },
    { label: "ব্যাখ্যা", value: showExplanations, onChange: onExplanationsChange },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {controls.map((control) => (
        <button
          key={control.label}
          type="button"
          aria-pressed={control.value}
          onClick={() => control.onChange(!control.value)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
        >
          <span>{control.label} দেখান</span>
          <span
            className={`relative h-5 w-9 rounded-full transition ${
              control.value ? "bg-emerald-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                control.value ? "left-[18px]" : "left-0.5"
              }`}
            />
          </span>
        </button>
      ))}
    </div>
  );
}
