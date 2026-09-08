// Speech-to-text (STT) — same API base and response handling patterns as file upload.

import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope } from "@/services/api/envelope";

export type TranscribeAudioOptions = {
  sessionId?: string;
  userId?: string;
};

function extractTranscriptText(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string") return data.trim();
  if (typeof data !== "object") return "";
  const o = data as Record<string, unknown>;
  const nested = (key: string) =>
    o[key] && typeof o[key] === "object"
      ? (o[key] as Record<string, unknown>)
      : undefined;
  const candidates: unknown[] = [
    o.text,
    o.transcript,
    o.transcription,
    nested("result")?.text,
    nested("data")?.text,
    nested("data")?.transcript,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

export const transcribeAudio = async (
  audioBlob: Blob,
  language: "EN" | "AR" = "EN",
  options?: TranscribeAudioOptions,
): Promise<string> => {
  const languageMap = {
    EN: "en",
    AR: "ar",
  };
  const whisperLanguage = languageMap[language];

  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("language", whisperLanguage);
  if (options?.sessionId) {
    formData.append("session_id", options.sessionId);
  }
  if (options?.userId) {
    formData.append("user_id", options.userId);
  }

  const apiBase = API_CONFIG.LOCAL_API_BASE_URL.replace(/\/$/, "");
  const url = `${apiBase}/audio/speech-to-text`;

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail =
        typeof (errBody as { detail?: string }).detail === "string"
          ? (errBody as { detail: string }).detail
          : typeof (errBody as { message?: string }).message === "string"
            ? (errBody as { message: string }).message
            : "";
    } catch {
      // ignore
    }
    throw new Error(
      detail
        ? `Speech-to-text failed (${response.status}): ${detail}`
        : `Speech-to-text failed: ${response.status}`,
    );
  }

  const data = unwrapEnvelope<unknown>(await response.json());
  const text = extractTranscriptText(data);
  if (!text) {
    console.warn("STT response contained no transcript text", data);
  }
  return text;
};
