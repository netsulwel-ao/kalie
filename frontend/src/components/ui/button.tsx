import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "glass";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variantClasses = {
  primary:
    "bg-white text-zinc-950 hover:bg-zinc-200 shadow-[0_4px_20px_rgba(255,255,255,0.2)] active:scale-95",
  secondary:
    "glass-panel-light text-on-surface hover:bg-white/10 active:scale-95",
  ghost:
    "text-on-surface-variant hover:bg-white/5 active:scale-95",
  danger:
    "bg-error text-on-error hover:brightness-110 active:scale-95",
  glass:
    "glass-panel text-on-surface hover:bg-white/10 active:scale-[0.98]",
};

const sizeClasses = {
  sm: "px-4 py-2 text-sm rounded-full",
  md: "px-6 py-3 text-button rounded-full",
  lg: "px-8 py-4 text-button rounded-full",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-button transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
