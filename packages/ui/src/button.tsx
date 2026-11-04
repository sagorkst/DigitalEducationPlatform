import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const variants = {
    primary: "bg-blue-700 text-white hover:bg-blue-800 shadow-sm",
    secondary: "bg-teal-600 text-white hover:bg-teal-700",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  };

  const sizes = {
    sm: "min-h-9 px-3 text-sm",
    md: "min-h-11 px-5 text-sm",
    lg: "min-h-12 px-6 text-base",
  };

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
