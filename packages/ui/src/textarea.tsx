import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export function Textarea({
  label,
  error,
  id,
  className = "",
  ...props
}: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="mb-2 block text-sm font-bold text-slate-700"
        >
          {label}
        </label>
      )}

      <textarea
        id={id}
        className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 ${error ? "border-red-400" : ""} ${className}`}
        aria-invalid={!!error}
        {...props}
      />

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
