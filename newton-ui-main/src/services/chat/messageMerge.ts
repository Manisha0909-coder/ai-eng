import { Message } from "@/types/message";

const normalizeContent = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

/**
 * Merge freshly fetched (persisted) messages into the locally rendered list.
 *
 * Server order is canonical, but we keep the *local* message object whenever we
 * can match it (by message_id, id, or content — same role only; the user and
 * assistant halves of one turn share a message_id). That matters twice over:
 * `fetchUserMessages` generates unstable fallback ids, and ChatContainer keys
 * rows by id with a fade-in on mount — reusing local objects means a new turn
 * fades in while the rest of the thread doesn't re-animate.
 *
 * Local messages with no server counterpart are kept only when they represent
 * genuinely unpersisted work: user messages and still-streaming replies.
 * Finished assistant remnants whose content already exists in the merged
 * thread (e.g. from a replayed or double-attached stream) are dropped — they
 * are duplicates, not data.
 *
 * Returns null when nothing changed.
 */
export function mergeServerMessages(
  local: Message[],
  server: Message[]
): Message[] | null {
  const used = new Set<Message>();
  const pickLocalMatch = (sm: Message): Message | null => {
    const smMessageId = (sm as any).message_id;
    const smContent = normalizeContent(sm.content);
    for (const lm of local) {
      if (used.has(lm)) continue;
      if (lm.type !== sm.type) continue;
      const lmMessageId = (lm as any).message_id;
      const idsMatch =
        (smMessageId != null && lmMessageId != null && smMessageId === lmMessageId) ||
        lm.id === sm.id;
      const contentMatches =
        smContent !== "" && normalizeContent(lm.content) === smContent;
      if (idsMatch || contentMatches) {
        used.add(lm);
        return lm;
      }
    }
    return null;
  };

  const merged = server.map((sm) => pickLocalMatch(sm) ?? sm);

  const mergedAssistantContents = new Set(
    merged
      .filter((m) => m.type === "assistant")
      .map((m) => normalizeContent(m.content))
  );
  const leftovers = local.filter((m) => {
    if (used.has(m)) return false;
    if (m.type !== "assistant") return true;
    if ((m as any).isStreaming) return true;
    const content = normalizeContent(m.content);
    if (!content) return false; // finished empty placeholder — noise
    return !mergedAssistantContents.has(content); // content twin → duplicate
  });
  const result = [...merged, ...leftovers];

  const unchanged =
    result.length === local.length && result.every((m, i) => m === local[i]);
  return unchanged ? null : result;
}
