import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  accentColor?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, accentColor = "rgba(0,229,255,0.6)", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-label-caps text-on-surface-variant uppercase">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-body-md text-on-surface placeholder:text-zinc-600",
            "outline-none transition-all duration-200",
            "focus:border-[var(--accent)] focus:shadow-[0_0_0_1px_var(--accent),0_0_12px_var(--accent-glow)]",
            error && "border-error focus:border-error",
            className
          )}
          style={{ "--accent": accentColor, "--accent-glow": accentColor.replace("0.6", "0.2") } as React.CSSProperties}
          {...props}
        />
        {error && <p className="text-body-sm text-error">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
