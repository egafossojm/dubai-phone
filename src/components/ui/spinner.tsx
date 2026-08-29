import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
  label?: string;
};

export function Spinner({ className, label = "Chargement" }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("inline-flex items-center justify-center", className)}
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--muted-foreground)] border-t-[var(--primary)]" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
