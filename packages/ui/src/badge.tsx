import type { HTMLAttributes } from "react";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  size?: "sm" | "md";
};

const variants = {
  default: "bg-slate-100 text-slate-700",
  primary: "bg-blue-100 text-blue-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
};

const sizes = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
};

export function Badge({
  variant = "default",
  size = "sm",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
