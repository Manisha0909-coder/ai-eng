import type { Persona } from "@/services/rbac/types";

export function personaTypeDisplayLabel(
  type?: "chat" | "dashboard" | null
): string {
  return type === "dashboard" ? "Dashboard" : "Chat";
}

export function getDisplayInitials(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/[\s_@.]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/** §14 — "Created" column: permanent audit fact, never relative. */
export function formatExactDate(dateString?: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** §14 — Tooltip for relative date cells: "Jan 4, 2025 at 14:23 UTC" */
export function formatTimestampForTooltip(dateString?: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const datePart = formatExactDate(dateString);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${datePart} at ${hours}:${minutes} UTC`;
}

/**
 * "Last Updated" column — full-word relative time for readability.
 * e.g. "Just now", "5 mins ago", "1 hr ago", "3 hrs ago", "Yesterday", "4 days ago", "Jan 4, 2025"
 */
export function formatLastUpdated(dateString?: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} mins ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return "1 hr ago";
  if (diffHr < 24) return `${diffHr} hrs ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;

  return formatExactDate(dateString);
}

/**
 * §14 — "Last Updated" column: relative up to 6 days, exact date at 7+ days.
 * Thresholds: <1min → "Just now", 1–59min → "Xm ago", 1–23h → "Xh ago",
 * ~1 day → "Yesterday", 2–6 days → "Xd ago", ≥7 days → exact date.
 */
export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;

  return formatExactDate(dateString);
}

export function countPersonaToolTags(tags: Persona["tool_tags"]): number {
  if (!tags?.length) return 0;
  return tags.length;
}

export function countPersonaDocumentTags(tags: Persona["document_tags"]): number {
  if (!tags?.length) return 0;
  return tags.length;
}

export function countPersonaDatasources(persona: Persona): number {
  const ids = new Set<string>();
  persona.datasources?.forEach((s) => s?.id && ids.add(s.id));
  persona.datasource_ids?.forEach((id) => id && ids.add(id));
  persona.data_sources?.forEach((source) => {
    if (typeof source === "string") ids.add(source);
    else {
      const id = source.source_id || source.id;
      if (id) ids.add(id);
    }
  });
  return ids.size;
}

/** Persona detail sheet / version inspector panels */
export const personaDetailPanelClass =
  'rounded-lg border border-border-main/60 bg-surface';

export const personaDetailSectionLabelClass =
  'text-2xs font-semibold uppercase tracking-wider text-text-muted';
