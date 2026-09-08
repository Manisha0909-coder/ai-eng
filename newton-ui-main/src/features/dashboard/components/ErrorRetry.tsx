import { memo } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorRetryProps {
  error: string | null;
  onRetry: () => void;
  isLoading?: boolean;
}

export const ErrorRetry = memo(
  ({ error, onRetry, isLoading = false }: ErrorRetryProps) => {
    if (!error) return null;

    return (
      <div className="flex flex-col items-center justify-center p-6 border border-destructive/50 rounded-lg bg-destructive/5 dark:bg-destructive/10">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Retrying..." : "Retry"}
        </Button>
      </div>
    );
  }
);

ErrorRetry.displayName = "ErrorRetry";

