import type { FormField } from "../types";

/** `number` / `integer` / `int` — API may send `defaultValue: null`; treat as 0. */
export const isNumericFormField = (field: FormField): boolean => {
  const t = String(field.type ?? "").toLowerCase();
  return t === "number" || t === "integer" || t === "int";
};

export const isHtmlContentField = (field: FormField): boolean =>
  field.contentType?.toLowerCase() === "html";

/** Strip HTML for display in a plain textarea (textareas cannot render HTML). */
export const stripHtmlForTextareaDisplay = (raw: string): string =>
  raw
    .replace(/<\/?(html|body)[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .trim();

/** Parse a duration string like "1h 30m" into { hours, minutes }. */
export const parseDurationValue = (
  value: string
): { hours: number; minutes: number } => {
  if (!value || typeof value !== "string") return { hours: 0, minutes: 0 };
  const hoursMatch = value.match(/(\d+)h/);
  const minutesMatch = value.match(/(\d+)m/);
  return {
    hours: hoursMatch ? parseInt(hoursMatch[1], 10) : 0,
    minutes: minutesMatch ? parseInt(minutesMatch[1], 10) : 0,
  };
};
