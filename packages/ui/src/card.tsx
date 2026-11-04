import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
      {...props}
    />
  );
}

export function CardHeader({ className = "", ...props }: CardProps) {
  return <div className={`p-6 pb-3 ${className}`} {...props} />;
}

export function CardTitle({ className = "", ...props }: CardProps) {
  return (
    <h3
      className={`text-lg font-extrabold text-slate-900 ${className}`}
      {...props}
    />
  );
}

export function CardDescription({ className = "", ...props }: CardProps) {
  return (
    <p className={`text-sm leading-6 text-slate-500 ${className}`} {...props} />
  );
}

export function CardContent({ className = "", ...props }: CardProps) {
  return <div className={`p-6 pt-3 ${className}`} {...props} />;
}

export function CardFooter({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`flex items-center gap-3 border-t border-slate-100 p-6 ${className}`}
      {...props}
    />
  );
}
