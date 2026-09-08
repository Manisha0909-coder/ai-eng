import {
  AssistantMessageTimelineEntry,
  MessageTimelineEntry,
  ToolCallTimelineEntry,
} from "../../types/message";

export interface ConsolidateTimelineOptions {
  /**
   * When true, consecutive tool_call entries form a batch: if any batch member has
   * `error`, siblings without a tool_return are inferred as `error` too.
   * Remaining tools without status use `completed` (neutral), never `success`.
   */
  inferMissingToolStatuses?: boolean;
}

/**
 * Normalizes a persisted message_timeline for display:
 * - merges tool_return into tool_call and drops return rows
 * - concatenates consecutive reasoning / assistant_message chunks (per-token SSE dumps)
 * - collapses duplicate tool_call rows for the same tool_call_id
 */
export function consolidateMessageTimeline(
  timeline: MessageTimelineEntry[],
  options: ConsolidateTimelineOptions = {},
): MessageTimelineEntry[] {
  if (!timeline?.length) return [];

  const toolReturnMap = new Map<
    string,
    { status: ToolCallTimelineEntry["status"]; duration?: number }
  >();
  for (const entry of timeline) {
    if (entry.type === "tool_return" && entry.tool_call_id) {
      toolReturnMap.set(entry.tool_call_id, {
        status: (entry.status || "success") as ToolCallTimelineEntry["status"],
        duration: entry.duration,
      });
    }
  }

  const merged: MessageTimelineEntry[] = [];

  const appendMerged = (entry: MessageTimelineEntry) => {
    const last = merged[merged.length - 1];
    if (entry.type === "reasoning" && last?.type === "reasoning") {
      merged[merged.length - 1] = {
        ...last,
        content: last.content + (entry.content ?? ""),
        timestamp: entry.timestamp || last.timestamp,
      };
      return;
    }
    if (entry.type === "assistant_message" && last?.type === "assistant_message") {
      merged[merged.length - 1] = {
        ...last,
        content: last.content + (entry.content ?? ""),
        timestamp: entry.timestamp || last.timestamp,
      };
      return;
    }
    merged.push(entry);
  };

  for (const entry of timeline) {
    if (entry.type === "tool_return") continue;

    if (entry.type === "tool_call" && entry.tool_call_id) {
      const returnData = toolReturnMap.get(entry.tool_call_id);
      let toolEntry: ToolCallTimelineEntry = returnData
        ? {
            ...entry,
            status: returnData.status,
            duration: returnData.duration ?? entry.duration,
          }
        : { ...entry };

      const last = merged[merged.length - 1];
      if (
        last?.type === "tool_call" &&
        last.tool_call_id === toolEntry.tool_call_id
      ) {
        merged[merged.length - 1] = {
          ...last,
          ...toolEntry,
          content: toolEntry.content || last.content,
          tool_name: toolEntry.tool_name || last.tool_name,
          tool_icon: toolEntry.tool_icon || last.tool_icon,
        };
        continue;
      }

      appendMerged(toolEntry);
      continue;
    }

    appendMerged(entry);
  }

  if (options.inferMissingToolStatuses) {
    inferMissingToolStatuses(merged);
  }

  return merged;
}

/** Infer status for tool_call rows missing tool_return after list_message load. */
function inferMissingToolStatuses(timeline: MessageTimelineEntry[]): void {
  const hasAssistantMessage = timeline.some(
    (entry) => entry.type === "assistant_message",
  );
  if (!hasAssistantMessage) return;

  let batchStart = -1;

  const flushBatch = (batchEnd: number) => {
    if (batchStart < 0) return;
    const batch = timeline.slice(batchStart, batchEnd + 1) as ToolCallTimelineEntry[];
    const hasError = batch.some((entry) => entry.status === "error");
    for (const entry of batch) {
      if (!entry.status) {
        entry.status = hasError ? "error" : "completed";
      }
    }
    batchStart = -1;
  };

  timeline.forEach((entry, index) => {
    if (entry.type === "tool_call") {
      if (batchStart < 0) batchStart = index;
      return;
    }
    flushBatch(index - 1);
  });
  flushBatch(timeline.length - 1);
}

/** Full assistant text from consolidated timeline entries (token chunks joined without separators). */
export function assistantContentFromTimeline(
  timeline: MessageTimelineEntry[],
): string {
  return timeline
    .filter(
      (entry): entry is AssistantMessageTimelineEntry =>
        entry.type === "assistant_message",
    )
    .map((entry) => entry.content ?? "")
    .join("");
}
