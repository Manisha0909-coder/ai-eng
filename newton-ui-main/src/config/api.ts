import { VITE_API_BASE_URL } from "@/env";

const root = (VITE_API_BASE_URL || "").replace(/\/$/, "");
const apiBase = root
  ? `${root}/mid`.replace(/\/$/, "")
  : typeof window !== "undefined"
    ? window.location.origin
    : "";
const coreBase = root ? `${root}/core`.replace(/\/$/, "") : "";

export const API_CONFIG = {
  LOCAL_API_BASE_URL: apiBase,
  EMAIL_SERVER_BASE_URL: (apiBase || "").replace(/\/$/, ""),
  DASHBOARD_API_BASE_URL: coreBase,
  DEFAULT_TEMPERATURE: 0.7,
  MAX_TOKENS: 1500,
  FILE_SIZE_LIMITS: {
    IMAGE: 5 * 1024 * 1024, // 5MB
    PDF: 10 * 1024 * 1024, // 10MB
  },
  IMAGE_DIMENSION_LIMIT: 4000,
  API_HEADERS: {
    "Content-Type": "application/json",
    "HTTP-Referer": globalThis?.location?.origin ?? "",
    "X-Title": "Newton Chat",
  },
};
