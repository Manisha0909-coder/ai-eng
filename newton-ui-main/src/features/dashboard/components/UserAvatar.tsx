import { cn } from "@/lib/utils";
import { getDisplayInitials } from "../utils/dashboardHelper";

export interface UserAvatarProps {
  /** user_id, email, or display_name — used for initials */
  label: string;
  size?: "sm" | "md";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-2xs",
  md: "h-9 w-9 text-xs",
} as const;

export function UserAvatar({ label, size = "md", className }: UserAvatarProps) {
  const display = label.trim() || "User";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border border-border-main bg-surface-2 font-display font-semibold text-text-main",
        sizeClasses[size],
        className,
      )}
      aria-label={`User: ${display}`}
    >
      {getDisplayInitials(label)}
    </span>
  );
}
