import { cn } from "@/lib/utils";
import {
  getDisplayInitials,
  personaTypeDisplayLabel,
} from "../utils/dashboardHelper";

export interface PersonaTypeAvatarProps {
  name?: string | null;
  type?: "chat" | "dashboard" | "api" | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-7 w-7 text-2xs",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
} as const;

export function PersonaTypeAvatar({
  name,
  type,
  size = "md",
  className,
}: PersonaTypeAvatarProps) {
  const isDashboard = type === "dashboard";
  const displayName = (name ?? "").trim() || "Persona";
  const typeLabel = personaTypeDisplayLabel(
    type === "dashboard" ? "dashboard" : "chat",
  );

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-display font-semibold",
        sizeClasses[size],
        isDashboard
          ? "text-accent [background:linear-gradient(135deg,rgb(var(--color-accent)/0.15),rgb(var(--color-accent)/0.08))] [box-shadow:inset_0_0_0_1px_rgb(var(--color-accent)/0.18)]"
          : "text-primary [background:linear-gradient(135deg,rgb(var(--color-primary)/0.15),rgb(var(--color-primary)/0.08))] [box-shadow:inset_0_0_0_1px_rgb(var(--color-primary)/0.18)]",
        className,
      )}
      aria-label={`${displayName}, ${typeLabel} persona`}
    >
      {getDisplayInitials(name)}
    </span>
  );
}
