import { AlertCircle, RefreshCw } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

export function ErrorAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "shrink-0 w-7 h-7 rounded-lg bg-status-error/10 flex items-center justify-center",
        className,
      )}
    >
      <AlertCircle size={14} className="text-status-error" strokeWidth={2} />
    </div>
  );
}

interface ErrorCardProps {
  errorMessage: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({
  errorMessage,
  onRetry,
  isRetrying = false,
}) => {
  return (
    <div className="w-full max-w-xl">
      <div className="bg-status-error/5 border border-status-error/25 rounded-2xl rounded-tl-sm px-4 py-3.5">
        <p className="text-sm font-medium text-status-error mb-1">
          Something went wrong
        </p>
        <p className="text-sm text-text-muted mb-3 break-words">
          {errorMessage ||
            "Newton couldn't complete this request. Check your connection and try again."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="h-8 px-4 rounded-lg text-xs font-medium bg-status-error text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isRetrying ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Retrying...
            </span>
          ) : (
            "Retry"
          )}
        </button>
      </div>
    </div>
  );
};
