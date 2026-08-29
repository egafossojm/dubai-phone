import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  message?: string;
  className?: string;
};

export function LoadingState({
  message = "Chargement en cours…",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-3 text-[var(--muted-foreground)]",
        className,
      )}
    >
      <Spinner />
      <p className="text-sm">{message}</p>
    </div>
  );
}
