import toast from "react-hot-toast";
import type { ToastOptions } from "react-hot-toast";

/**
 * Themed toast style that uses CSS custom properties for consistent theming.
 */
const themedStyle: React.CSSProperties = {
  backgroundColor: "rgb(var(--color-surface))",
  color: "rgb(var(--color-text))",
  border: "1px solid rgb(var(--color-border))",
  borderRadius: "0.75rem",
  boxShadow: "var(--shadow-md)",
  maxWidth: "22rem",
  fontFamily: '"Instrument Sans", system-ui, sans-serif',
  fontSize: "0.875rem",
  padding: "12px 16px",
};

const DEFAULT_DURATION = 5000;

function mergeOptions(options?: ToastOptions): ToastOptions {
  return {
    duration: DEFAULT_DURATION,
    ...options,
    style: { ...themedStyle, ...options?.style },
  };
}

/**
 * Extract a human-readable error message from various error shapes
 * (Axios errors, native Error objects, plain strings, etc.)
 */
export function extractErrorMessage(
  error: unknown,
  defaultMessage = "Something went wrong. Please try again."
): string {
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const err = error as Record<string, any>;

    // Axios-style: error.response.data.message / error.response.data.detail
    const serverMsg =
      err.response?.data?.message ??
      err.response?.data?.detail ??
      err.response?.data?.error;
    if (typeof serverMsg === "string" && serverMsg) return serverMsg;

    // Native Error.message
    if (typeof err.message === "string" && err.message) return err.message;
  }

  return defaultMessage;
}

// ─── Public API ───────────────────────────────────────────────

const notify = {
  /**
   * Show a success toast.
   *
   * @example
   * notify.success("Data source created successfully");
   */
  success(message: string, options?: ToastOptions) {
    return toast.success(message, mergeOptions(options));
  },

  /**
   * Show an error toast.
   * Accepts a raw error object (Axios / Error / string) or a plain message string.
   * Automatically extracts the most useful message and annotates server errors.
   *
   * @example
   * // With a caught error:
   * notify.error(error, "Failed to create data source.");
   *
   * // With a plain string:
   * notify.error("Validation failed: name is required");
   */
  error(error: unknown, defaultMessage?: string, options?: ToastOptions) {
    // Envelope errors auto-toast in the axios interceptor / unwrapEnvelope,
    // so catch-block callers would otherwise double-toast.
    if (
      error &&
      typeof error === "object" &&
      (error as { envelopeToasted?: boolean }).envelopeToasted === true
    ) {
      return;
    }
    const message = extractErrorMessage(error, defaultMessage);
    return toast.error(message, mergeOptions(options));
  },

  /**
   * Show a neutral toast — no icon, no colour. For outcomes that are neither
   * a success nor a failure, where a tick or a cross would both be a lie.
   *
   * @example
   * notify.info("Can't verify an API key connection — nothing to refresh");
   */
  info(message: string, options?: ToastOptions) {
    return toast(message, mergeOptions(options));
  },

  /**
   * Show a loading toast. Returns the toast ID so it can be dismissed.
   *
   * @example
   * const id = notify.loading("Uploading...");
   * // later:
   * notify.dismiss(id);
   */
  loading(message: string, options?: ToastOptions) {
    return toast.loading(message, mergeOptions(options));
  },

  /**
   * Wrap a promise with automatic loading / success / error toasts.
   *
   * @example
   * await notify.promise(deleteUser(id), {
   *   loading: "Deleting user...",
   *   success: "User deleted successfully",
   *   error: "Failed to delete user",
   * });
   */
  promise<T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string },
    options?: ToastOptions
  ) {
    return toast.promise(promise, messages, mergeOptions(options));
  },

  /** Dismiss a specific toast by ID, or all toasts if no ID is given. */
  dismiss(toastId?: string) {
    toast.dismiss(toastId);
  },
};

export default notify;
