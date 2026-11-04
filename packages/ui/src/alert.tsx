import type { HTMLAttributes, ReactNode } from "react";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: ReactNode;
};

const variants = {
  info: "border-blue-200 bg-blue-50 text-blue-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
};

export function Alert({
  variant = "info",
  title,
  children,
  className = "",
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={`rounded-xl border p-4 ${variants[variant]} ${className}`}
      {...props}
    >
      {title && <h3 className="mb-1 font-bold">{title}</h3>}
      <div className="text-sm leading-6">{children}</div>
    </div>
  );
}
