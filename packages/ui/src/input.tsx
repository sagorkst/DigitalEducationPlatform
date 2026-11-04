import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { label, error, id, className = "", ...props },
    ref
  ) {
    const inputId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 block text-sm font-bold text-slate-700"
          >
            {label}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`min-h-11 w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 ${
            error ? "border-red-500" : "border-slate-200"
          } ${className}`}
          {...props}
        />

        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);
