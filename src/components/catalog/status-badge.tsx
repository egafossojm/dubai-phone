import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  className?: string;
};

const tones: Record<NonNullable<StatusBadgeProps["tone"]>, string> = {
  neutral: "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
};

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function stockTone(
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK",
): StatusBadgeProps["tone"] {
  if (status === "LOW_STOCK") {
    return "warning";
  }
  if (status === "OUT_OF_STOCK") {
    return "danger";
  }
  return "success";
}

export function productTone(status: string): StatusBadgeProps["tone"] {
  if (status === "ACTIVE") {
    return "success";
  }
  if (status === "INACTIVE") {
    return "danger";
  }
  return "neutral";
}
