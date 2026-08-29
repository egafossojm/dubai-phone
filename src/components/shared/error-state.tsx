import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = "Une erreur est survenue",
  message = "Veuillez réessayer. Si le problème persiste, contactez l'administrateur.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-3 px-4 text-center",
        className,
      )}
    >
      <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
      <p className="max-w-md text-sm text-[var(--muted-foreground)]">{message}</p>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}
