/**
 * Shared class string for message action buttons (Variant C — icon-only).
 *
 * A uniform 32px boxed hit target: muted at rest, surfaces a subtle border +
 * background on hover. Used by both AssistantMessage and UserMessage action
 * rows so the two stay visually identical. Feedback thumbs reuse the same box
 * geometry but swap the hover text color for status colors.
 */
export const MSG_ACTION_BTN =
  "w-8 h-8 rounded-lg border border-transparent flex items-center justify-center " +
  "text-text-muted hover:bg-surface-2 hover:border-border-main hover:text-text-main transition-all";
