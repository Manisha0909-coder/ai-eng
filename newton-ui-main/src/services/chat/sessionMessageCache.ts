import { Message } from "@/types/message";

/**
 * In-memory LRU of recently viewed sessions' messages, so switching between
 * conversations renders instantly from cache (then silently revalidates)
 * instead of blanking the thread behind a "Loading session" skeleton on every
 * click. Keeping the chat id alongside the messages preserves message object
 * identity across revisits, which keeps ChatContainer's keyed fade-in from
 * re-animating the whole thread.
 */
interface SessionCacheEntry {
  chatId: string;
  messages: Message[];
  fetchedAt: number;
}

const MAX_ENTRIES = 20;

// Map iteration order doubles as LRU order: delete+set moves a key to the end.
const cache = new Map<string, SessionCacheEntry>();

export const sessionMessageCache = {
  get(sessionId: string): SessionCacheEntry | undefined {
    const entry = cache.get(sessionId);
    if (entry) {
      cache.delete(sessionId);
      cache.set(sessionId, entry);
    }
    return entry;
  },

  set(sessionId: string, entry: { chatId: string; messages: Message[] }): void {
    if (entry.messages.length === 0) return;
    cache.delete(sessionId);
    cache.set(sessionId, { ...entry, fetchedAt: Date.now() });
    while (cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  },

  delete(sessionId: string): void {
    cache.delete(sessionId);
  },

  clear(): void {
    cache.clear();
  },
};
