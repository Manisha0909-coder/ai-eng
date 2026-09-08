import { Message } from "../../types/message";
import { API_CONFIG } from "../../config/api";
import { useEmailStore } from "../../store/emailStore";
import { getTextDirection } from "../../utils/textUtils";
import { STREAMING_CONFIG } from "../../config/streaming";
import {
  getSessionId,
  getUserIdValue,
  setSessionIdValue,
  getSelectedPersonaId,
  setSelectedPersonaIdValue,
  getPersonas,
} from "../../store/useStore";
import { SHOW_REASONING } from "@/env";
import { fetchUserMessages } from "./api";
import {
  handleSessionExpired,
  shouldSkipAuthHandling,
} from "@/services/api/sessionExpiry";
import notify from "@/utils/notify";

export interface StreamingMessage {
  id: string;
  content: string;
  type: "user" | "assistant";
  timestamp: Date;
  mode?: string;
  messageId?: string; // ID from backend response for editing
  formFields?: any[];
  calendarData?: any;
  ambiguousRecipients?: any[];
  textDirection?: "ltr" | "rtl";
  isStreaming?: boolean;
  isError?: boolean; // Flag to indicate error state
  reasoningMessage?: string;
  assistantMessage?: string;
  chatTitle?: string;
  images?: Array<{
    image_id: string;
    tool_name: string;
    image_name: string;
    static_path: string;
    file_url?: string;
  }>;
  cards?: Array<{
    id: string;
    type: "card";
    orientation: "portrait" | "landscape";
    content: {
      image?: {
        type: "url";
        value: string;
      };
      title: {
        type: "text";
        value: string;
      };
      description?: {
        type: "text";
        value: string;
      };
      footer?: {
        type: "text";
        value: string;
      };
    };
    metadata?: {
      linkUrl?: string;
      variant?: string;
      interactionType?: "link" | "button";
    };
  }>;
  toolExecutions?: Array<{
    tool_call_id?: string;
    tool_name: string;
    tool_call_message: string;
    icon_name?: string;
    timestamp: number;
    duration?: number;

    status?: "running" | "completed" | "success" | "error";
  }>;
  package?: {
    packageId: string;
    packageName: string;
    currency: string;
    items: Array<{
      id: number;
      type: "visa" | "flight" | "hotel" | "itinerary";
      title: string;
      description: string;
      cost: number | null;
      details: Record<string, any>;
    }>;
    totalCost: number;
    cost_per_passenger?: number;
    discounts: Array<any>;
    taxes: number;
    description?: string;
  };
  packages?: Array<{
    packageId: string;
    packageName: string;
    currency: string;
    items: Array<{
      id: number;
      type: "visa" | "flight" | "hotel" | "itinerary";
      title: string;
      description: string;
      cost: number | null;
      details: Record<string, any>;
    }>;
    totalCost: number;
    cost_per_passenger?: number;
    discounts: Array<any>;
    taxes: number;
    description?: string;
  }>;
}

export interface StreamingCallbacks {
  onReasoningUpdate?: (reasoning: string) => void;
  onAssistantUpdate?: (assistant: string) => void;
  onToolExecution?: (toolExecution: {
    tool_call_id?: string;
    tool_name: string;
    tool_call_message: string;
    icon_name?: string;
    timestamp: number;
    duration?: number;

    status?: "running" | "completed" | "success" | "error";
  }) => void;
  onFinalData?: (data: {
    chat_title?: string;
    html_data?: string;
    dashboard_data?: any;
    forms?: any[];
    calendar_data?: any;
    ambiguousRecipients?: any[];
    document_search_data?: {
      analysis: string;
      document_search_data: Array<{
        id: number;
        title: string;
        url: string;
        content: string;
      }>;
    };
    doc_search_data?: {
      analysis: string;
      document_search_data: Array<{
        id: number;
        title: string;
        url: string;
        content: string;
      }>;
    };
    images?: Array<{
      image_id: string;
      tool_name: string;
      image_name: string;
      static_path: string;
      file_url?: string;
    }>;
    cards?: Array<{
      id: string;
      type: "card";
      orientation: "portrait" | "landscape";
      content: {
        image?: {
          type: "url";
          value: string;
        };
        title: {
          type: "text";
          value: string;
        };
        description?: {
          type: "text";
          value: string;
        };
        footer?: {
          type: "text";
          value: string;
        };
      };
      metadata?: {
        linkUrl?: string;
        variant?: string;
        interactionType?: "link" | "button";
      };
    }>;
    package?: StreamingMessage["package"];
    packages?: StreamingMessage["packages"];
    messageId?: string; // Add messageId to the interface
  }) => void;
  onError?: (error: string) => void;
  onComplete?: (finalMessage: StreamingMessage) => void;
}

export const handleStreamingApiError = (error: any): string => {
  // Network errors
  if (error.name === "TypeError" && error.message.includes("fetch")) {
    return "Network error. Please check your connection and try again.";
  }

  // Timeout errors
  if (error.name === "AbortError" || error.message.includes("timeout")) {
    return "Request timed out. Please try again.";
  }

  // Server errors
  if (error.status >= 500) {
    return "Server error. Please try again in a moment.";
  }

  // Client errors
  if (error.status >= 400) {
    return error.message || "Bad request. Please check your input.";
  }

  const errorMsg = error?.message || String(error);

  if (errorMsg.includes("Local API error")) {
    if (
      errorMsg.includes("Failed to fetch") ||
      errorMsg.includes("ECONNREFUSED")
    ) {
      return "Couldn't connect to the local model server. Please make sure the server is running.";
    }
    return "Error with the local model. Please check the server logs.";
  }

  if (errorMsg.includes("too large")) {
    return "File too large. Please use a smaller file (PDFs < 10MB, images < 5MB).";
  }

  return "Sorry, there was an error. Please try again.";
};

// Production-grade content accumulator with frame-based updates and proper throttling
class OptimizedStreamingContentAccumulator {
  private content: string = "";
  private buffer: string = "";
  private bufferSize: number = STREAMING_CONFIG.BATCH_UPDATE_SIZE;
  private flushCallback: (content: string) => void;
  private flushTimeout: NodeJS.Timeout | null = null;
  private rafId: number | null = null;
  private maxFlushDelay: number = STREAMING_CONFIG.CONTENT_DEBOUNCE_DELAY;
  private pendingFlush: boolean = false;
  private updateQueue: string[] = [];
  private isDestroyed: boolean = false;

  constructor(onFlush: (content: string) => void) {
    this.flushCallback = onFlush;
  }

  add(chunk: string) {
    if (this.isDestroyed) return;

    this.buffer += chunk;
    this.content += chunk;
    this.updateQueue.push(chunk);

    // Clear any pending operations
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Immediate flush for first content to reduce perceived latency
    if (this.content.length === chunk.length) {
      this.scheduleImediateFlush();
      return;
    }

    // Use requestAnimationFrame for smooth updates when available
    if (
      STREAMING_CONFIG.USE_RAF_UPDATES &&
      typeof requestAnimationFrame !== "undefined"
    ) {
      this.scheduleRAFFlush();
    } else {
      // Fallback to timeout-based batching
      this.scheduleTimeoutFlush();
    }
  }

  private scheduleImediateFlush() {
    if (this.pendingFlush || this.isDestroyed) return;
    this.pendingFlush = true;

    // Use microtask for immediate flush
    Promise.resolve().then(() => {
      if (!this.isDestroyed) {
        this.flush();
      }
    });
  }

  private scheduleRAFFlush() {
    if (this.pendingFlush || this.isDestroyed) return;

    this.rafId = requestAnimationFrame(() => {
      if (this.isDestroyed) return;

      // Batch multiple updates within the same frame
      if (
        this.buffer.length >= this.bufferSize ||
        this.updateQueue.length >= STREAMING_CONFIG.MAX_UPDATES_PER_FRAME
      ) {
        this.flush();
      } else {
        // Schedule timeout as fallback
        this.scheduleTimeoutFlush();
      }
    });
  }

  private scheduleTimeoutFlush() {
    if (this.pendingFlush || this.isDestroyed) return;

    this.flushTimeout = setTimeout(() => {
      if (!this.isDestroyed) {
        this.flush();
      }
    }, this.maxFlushDelay);
  }

  flush() {
    if (this.isDestroyed) return;

    // Clear all pending operations
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.buffer.length > 0) {
      try {
        this.flushCallback(this.content);
        this.buffer = "";
        this.updateQueue = [];
      } catch (error) {}
    }

    this.pendingFlush = false;
  }

  getContent() {
    return this.content;
  }

  clear() {
    this.content = "";
    this.buffer = "";
    this.updateQueue = [];
    this.pendingFlush = false;

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy() {
    this.isDestroyed = true;
    this.clear();
  }
}

export const processStreamingData = (
  data: any,
  callbacks?: StreamingCallbacks
) => {
  const contentAccumulator = new OptimizedStreamingContentAccumulator(
    (content) => {
      callbacks?.onAssistantUpdate?.(content);
    }
  );

  let messageId: string | undefined;
  let chatTitle: string | undefined;
  let forms: any[] | undefined;
  let calendarData: any;
  let ambiguousRecipients: any;
  let documentSearchData: any;
  let cards: any;

  // Handle reasoning message chunks immediately (from 'reasoning' event type)
  if (data.reasoning_message_chunk && SHOW_REASONING) {
    // For the exported function, we need to accumulate chunks like the local function does
    // This function is not currently used, but keeping it consistent
    callbacks?.onReasoningUpdate?.(data.reasoning_message_chunk);
  }

  // Handle complete reasoning message (fallback)
  if (data.reasoning_message && SHOW_REASONING) {
    callbacks?.onReasoningUpdate?.(data.reasoning_message);
  }

  // Handle assistant message chunks efficiently
  if (data.assistant_message_chunk) {
    contentAccumulator.add(data.assistant_message_chunk);
  }

  // Handle metadata
  if (data.id) messageId = data.id;
  if (data.chat_title) chatTitle = data.chat_title;
  if (data.forms) forms = data.forms;
  if (data.calendar_data) calendarData = data.calendar_data;
  if (data.ambiguousRecipients) ambiguousRecipients = data.ambiguousRecipients;
  if (data.document_search_data) documentSearchData = data.document_search_data;
  if (data.doc_search_data) documentSearchData = data.doc_search_data;
  if (data.cards) cards = data.cards;

  // Handle final message
  if (data.final_message) {
    contentAccumulator.flush();

    const finalMessage = {
      id: messageId,
      content: contentAccumulator.getContent(),
      chat_title: chatTitle,
      forms,
      calendar_data: calendarData,
      ambiguousRecipients,
      document_search_data: documentSearchData,
      cards: cards,
      messageId: messageId, // Include messageId from backend response
    };

    callbacks?.onFinalData?.(finalMessage);
    contentAccumulator.destroy();
  }

  return {
    messageId,
    content: contentAccumulator.getContent(),
    chatTitle,
    forms,
    calendarData,
    ambiguousRecipients,
    cards,
  };
};

export const sendStreamingMessageToAPI = async (
  message: Message,
  mode?: string,
  signal?: AbortSignal,
  language?: "EN" | "AR",
  callbacks?: StreamingCallbacks,
  fileIds?: string[],
  personaId?: number,
  /** Skip POST /chat/create and attach to GET /chat/sessions/{id}/stream (e.g. after empty list_message). */
  streamResume?: { sessionId: string; lastId?: string | null },
  /** When set, the request will include `message_id` so the backend treats this as an edit. */
  editMessageId?: string
): Promise<StreamingMessage> => {
  const sessionId = getSessionId();
  const storedPersonaId = getSelectedPersonaId();
  
  // Get default persona from store if needed
  const getDefaultPersonaId = (): number | undefined => {
    const personas = getPersonas();
    if (personas && personas.length > 0) {
      const defaultPersona = personas.find((persona) => persona.is_default === true);
      if (defaultPersona) {
        return defaultPersona.id;
      }
      // Fallback to first persona if no default exists
      return personas[0].id;
    }
    return undefined;
  };
  
  // Use the selected persona if available, otherwise use the default persona
  // Priority: personaId parameter > storedPersonaId > default persona
  let personaIdToUse: number | undefined;
  
  personaIdToUse =
    personaId !== undefined && personaId !== null
      ? personaId
      : storedPersonaId !== null && storedPersonaId !== undefined
      ? storedPersonaId
      : getDefaultPersonaId(); // Use default if no persona is selected
  
  // Get timezone and replace deprecated "Asia/Calcutta" with "Asia/Kolkata"
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timezone === "Asia/Calcutta") {
    timezone = "Asia/Kolkata";
  }

  const { setReplyClicked, setReplyAllClicked, setForwardClicked } =
    useEmailStore.getState();

  const headers: Record<string, string> = {
    ...API_CONFIG.API_HEADERS,
  };


  const requestBody: Record<string, any> = {
    timezone: timezone,
    session_id: sessionId,
    query: message.content,
    // Always include persona_id - required for new chats, optional for existing chats
    // For new chats, we use the default persona if no persona is selected
    ...(personaIdToUse !== undefined &&
      personaIdToUse !== null && { persona_id: personaIdToUse }),
    email_context: message.emailContext
      ? {
          email_id: message.emailContext.emailId,
          conversation_id: message.emailContext.conversationId,
        }
      : undefined,
    language: language,
    ...(fileIds && fileIds.length > 0 && { file_ids: fileIds }),
    ...(editMessageId && { message_id: editMessageId }),
  };

  // Handle "Session already streaming" error by reconnecting to stream endpoint
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  if (streamResume?.sessionId) {
    const qs =
      streamResume.lastId != null && String(streamResume.lastId).length > 0
        ? `?last_id=${encodeURIComponent(String(streamResume.lastId))}`
        : "";
    const resumeUrl = `${API_CONFIG.LOCAL_API_BASE_URL}/chat/sessions/${encodeURIComponent(
      streamResume.sessionId
    )}/stream${qs}`;
    const resumeResponse = await fetch(resumeUrl, {
      method: "GET",
      credentials: "include",
      signal,
    });
    if (resumeResponse.status === 404) {
      const err: any = new Error(
        "Stream not found. It may have completed or expired."
      );
      err.status = 404;
      throw err;
    }
    if (resumeResponse.status === 403) {
      const err: any = new Error("Session not found or unauthorized");
      err.status = 403;
      throw err;
    }
    if (!resumeResponse.ok) {
      throw new Error(`Resume stream failed: HTTP ${resumeResponse.status}`);
    }
    reader = resumeResponse.body?.getReader() || null;
    if (!reader) throw new Error("Failed to get response reader");
  } else {
  const response = await fetch(
    `${API_CONFIG.LOCAL_API_BASE_URL}/chat/create`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal,
      credentials: "include", // Include cookies in the request
    }
  );

  if (response.status === 401 && !shouldSkipAuthHandling()) {
    const errorData = await response.json().catch(() => ({
      error: { message: "Session expired" },
    }));
    const errorMessage =
      errorData.message || errorData.error?.message || "Session expired";
    notify.error(errorMessage);
    handleSessionExpired();
    // Stall until navigation unloads the page — avoids a flash of error/idle UI.
    await new Promise<never>(() => {});
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: { message: `HTTP error ${response.status}` },
    }));
    
    const errorMessage = errorData.message || errorData.error?.message || "Unknown error";
    
    // Check if session is already streaming and we need to reconnect
    if (errorMessage.includes("Session already streaming") || errorMessage.includes("already streaming")) {
      // Extract session_id from error response or use the one from request
      const reconnectSessionId = errorData.session_id || sessionId;
      
      if (reconnectSessionId) {
        // Update session ID if it was provided in error response
        if (errorData.session_id && errorData.session_id !== sessionId) {
          setSessionIdValue(errorData.session_id);
        }
        
        // Reconnect to the stream endpoint
        try {
          const reconnectUrl = `${API_CONFIG.LOCAL_API_BASE_URL}/chat/sessions/${encodeURIComponent(
            reconnectSessionId
          )}/stream`;
          const reconnectResponse = await fetch(reconnectUrl, {
            method: "GET",
            credentials: "include",
            signal,
          });
          
          if (reconnectResponse.ok) {
            reader = reconnectResponse.body?.getReader() || null;
            if (!reader) {
              throw new Error("Failed to get reconnection reader");
            }
          } else {
            throw new Error(
              `Reconnection failed: HTTP ${reconnectResponse.status}`
            );
          }
        } catch (reconnectError) {
          throw new Error(
            `Session already streaming but reconnection failed: ${
              reconnectError instanceof Error ? reconnectError.message : "Unknown error"
            }`
          );
        }
      } else {
        throw new Error(
          `Session already streaming but no session_id available for reconnection`
        );
      }
    } else {
      // For other errors, throw normally
      throw new Error(
        `API error ${response.status}: ${errorMessage}`
      );
    }
  } else {
    // Handle streaming response normally
    reader = response.body?.getReader() || null;
    if (!reader) throw new Error("Failed to get response reader");
  }
  }

  let accumulatedContent = "";
  let reasoningMessage = "";
  let assistantMessage = "";
  let forms: any[] = [];
  let calendarData: any = null;
  let ambiguousRecipients: any[] = [];
  let chatTitle = "";
  let documentSearchData: any = undefined;
  let images: StreamingMessage["images"] = undefined;
  let cards: StreamingMessage["cards"] = undefined;
  let htmlData: any = undefined;
  let dashboardData: any = undefined;
  let packageData: StreamingMessage["package"] = undefined;
  let packagesData: StreamingMessage["packages"] = undefined;
  let messageId: string | undefined = undefined; // Track message ID from response
  let isStreamingComplete = false;
  let onCompleteCalled = false; // Track if onComplete was already called (to prevent duplicates)
  let errorHandled = false; // Track if an error event was already handled
  // Track persona_id used for the first message to store it with the session
  const personaIdForSession = personaIdToUse;
  let toolExecutions: Array<{
    tool_call_id?: string;
    tool_name: string;
    tool_call_message: string;
    icon_name?: string;
    timestamp: number;
    duration?: number;

    status?: "running" | "completed" | "success" | "error";
  }> = [];

  // Production-grade throttling and batching system
  let assistantBuffer = "";
  const BUFFER_THRESHOLD = STREAMING_CONFIG.BUFFER_THRESHOLD;
  const BUFFER_TIMEOUT = STREAMING_CONFIG.BUFFER_TIMEOUT;
  let assistantBufferTimeout: NodeJS.Timeout | null = null;
  let reasoningBufferTimeout: NodeJS.Timeout | null = null;

  // Optimized throttling with frame-based updates
  let lastAssistantUpdateTs = 0;
  let assistantThrottleTimeout: NodeJS.Timeout | null = null;
  let rafUpdateId: number | null = null;
  const MIN_UPDATE_INTERVAL = STREAMING_CONFIG.MIN_UPDATE_INTERVAL;

  // Track reasoning for the current segment (resets on tool calls)
  let currentStepReasoning = "";

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEventType: string | null = null; // Track current SSE event type
  // Redis Stream message id from SSE `id:` field (for reconnection)
  let lastRedisStreamId: string | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 3;
  /** Set when Redis stream is gone (404) or status says done but we hydrate from DB per integration guide. */
  let dbFallbackStreamMessage: StreamingMessage | null = null;

  const getActiveSessionIdForReconnect = () => {
    const sid = getSessionId();
    return typeof sid === "string" && sid.trim().length > 0 ? sid : null;
  };

  const checkStreamStatus = async (sessionIdToCheck: string) => {
    const statusUrl = `${API_CONFIG.LOCAL_API_BASE_URL}/chat/sessions/${encodeURIComponent(
      sessionIdToCheck
    )}/status`;
    try {
      const res = await fetch(statusUrl, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      if (!json || typeof json.streaming !== "boolean") return null;
      return Boolean(json.streaming);
    } catch {
      return null;
    }
  };

  const openReconnectStream = async (
    sessionIdToReconnect: string,
    lastId: string | null
  ) => {
    const qs = lastId ? `?last_id=${encodeURIComponent(lastId)}` : "";
    const url = `${API_CONFIG.LOCAL_API_BASE_URL}/chat/sessions/${encodeURIComponent(
      sessionIdToReconnect
    )}/stream${qs}`;
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      signal,
    });
    if (res.status === 404) {
      const err: any = new Error(
        "Stream not found. It may have completed or expired."
      );
      err.status = 404;
      throw err;
    }
    if (res.status === 403) {
      const err: any = new Error("Session not found or unauthorized");
      err.status = 403;
      throw err;
    }
    if (!res.ok) {
      const err: any = new Error(`Reconnect failed: HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const r = res.body?.getReader();
    if (!r) throw new Error("Failed to get reconnection reader");
    return r;
  };

  /**
   * When the Redis stream is deleted (completed) or the client has no local chunks,
   * load the assistant turn from the database (same as guide: fetch after 404 / stream gone).
   */
  const tryCompleteFromPersistedSession = async (
    activeSessionId: string
  ): Promise<StreamingMessage | null> => {
    try {
      const messages = await fetchUserMessages(activeSessionId);
      if (!messages.length) return null;
      const lastAssistant = [...messages]
        .reverse()
        .find((m) => m.type === "assistant");
      if (!lastAssistant) return null;

      isStreamingComplete = true;
      const ts =
        lastAssistant.timestamp instanceof Date
          ? lastAssistant.timestamp
          : new Date(lastAssistant.timestamp);
      const stopMessage: StreamingMessage = {
        id: lastAssistant.id,
        content: lastAssistant.content || "",
        type: "assistant",
        timestamp: ts,
        mode: lastAssistant.mode,
        messageId: lastAssistant.message_id,
        formFields: lastAssistant.formFields,
        calendarData: (lastAssistant as any).calendarData,
        ambiguousRecipients: lastAssistant.ambiguousRecipients,
        textDirection: getTextDirection(lastAssistant.content || ""),
        isStreaming: false,
        isError: lastAssistant.isError,
        reasoningMessage: (lastAssistant as any).reasoningMessage,
        assistantMessage: (lastAssistant as any).assistantMessage,
        images: (lastAssistant as any).images,
        cards: (lastAssistant as any).cards,
        toolExecutions: (lastAssistant as any).toolExecutions,
        package: (lastAssistant as any).package,
        packages: (lastAssistant as any).packages,
      };
      callbacks?.onComplete?.(stopMessage);
      onCompleteCalled = true;
      return stopMessage;
    } catch {
      return null;
    }
  };

  const maybeReconnect = async () => {
    if (signal?.aborted) return null;
    if (isStreamingComplete) return null;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return null;

    const activeSessionId = getActiveSessionIdForReconnect();
    // If we never received a session_id yet, we can't reconnect.
    if (!activeSessionId) return null;

    // If backend says it’s not streaming anymore, treat as completed and stop dots.
    const streaming = await checkStreamStatus(activeSessionId);
    if (streaming === false) {
      const empty =
        !accumulatedContent.trim() && !assistantMessage.trim();
      if (empty) {
        const fromDb = await tryCompleteFromPersistedSession(activeSessionId);
        if (fromDb) {
          dbFallbackStreamMessage = fromDb;
          return null;
        }
      }
      isStreamingComplete = true;
      const stopMessage: StreamingMessage = {
        id: (Date.now() + 1).toString(),
        content: assistantMessage || accumulatedContent.trim(),
        type: "assistant" as const,
        timestamp: new Date(),
        mode: mode,
        messageId: messageId,
        formFields: forms,
        calendarData: calendarData,
        ambiguousRecipients: ambiguousRecipients,
        textDirection: getTextDirection(
          accumulatedContent.trim() || assistantMessage
        ),
        isStreaming: false,
        isError: errorHandled,
        reasoningMessage: reasoningMessage,
        assistantMessage: assistantMessage,
  
        images: images,
        cards: cards,
        toolExecutions: toolExecutions,
        package: packageData,
        packages: packagesData,
      };
      callbacks?.onComplete?.(stopMessage);
      onCompleteCalled = true;
      return null;
    }

    // Backoff a bit before reconnecting
    const delayMs = 500 * Math.max(1, reconnectAttempts + 1);
    reconnectAttempts++;
    await new Promise((r) => setTimeout(r, delayMs));

    try {
      return await openReconnectStream(activeSessionId, lastRedisStreamId);
    } catch (e: any) {
      // Stream deleted after completion — hydrate from DB (Redis integration guide).
      if (e?.status === 404) {
        const fromDb = await tryCompleteFromPersistedSession(activeSessionId);
        if (fromDb) {
          dbFallbackStreamMessage = fromDb;
          return null;
        }
      }
      return null;
    }
  };

  const cancelPendingAssistantUpdates = () => {
    if (assistantBufferTimeout) {
      clearTimeout(assistantBufferTimeout);
      assistantBufferTimeout = null;
    }
    if (assistantThrottleTimeout) {
      clearTimeout(assistantThrottleTimeout);
      assistantThrottleTimeout = null;
    }
    if (rafUpdateId) {
      cancelAnimationFrame(rafUpdateId);
      rafUpdateId = null;
    }
  };

  // Coalescing update scheduler — one RAF or timeout at a time; chunks batch into it
  const scheduleAssistantUpdate = (force: boolean = false) => {
    if (isStreamingComplete) return false;

    const elapsed = Date.now() - lastAssistantUpdateTs;

    const executeUpdate = () => {
      if (isStreamingComplete) return;

      try {
        callbacks?.onAssistantUpdate?.(assistantMessage);
        lastAssistantUpdateTs = Date.now();
      } catch (error) {
        // Error in assistant update callback
      }
    };

    const clearScheduledUpdates = () => {
      if (assistantThrottleTimeout) {
        clearTimeout(assistantThrottleTimeout);
        assistantThrottleTimeout = null;
      }
      if (rafUpdateId) {
        cancelAnimationFrame(rafUpdateId);
        rafUpdateId = null;
      }
    };

    // Force immediate update for first content or explicit force
    if (
      force &&
      (elapsed >= MIN_UPDATE_INTERVAL ||
        assistantMessage.length <= BUFFER_THRESHOLD)
    ) {
      clearScheduledUpdates();
      executeUpdate();
      return true;
    }

    // Coalesce — pending callback reads latest assistantMessage from closure
    if (assistantThrottleTimeout || rafUpdateId) {
      return false;
    }

    const delay = Math.max(0, MIN_UPDATE_INTERVAL - elapsed);

    if (
      STREAMING_CONFIG.USE_RAF_UPDATES &&
      typeof requestAnimationFrame !== "undefined" &&
      delay === 0
    ) {
      rafUpdateId = requestAnimationFrame(() => {
        rafUpdateId = null;
        if (!isStreamingComplete) {
          executeUpdate();
        }
      });
    } else {
      assistantThrottleTimeout = setTimeout(() => {
        assistantThrottleTimeout = null;
        if (!isStreamingComplete) {
          executeUpdate();
        }
      }, Math.max(delay, 16));
    }

    return true;
  };

  const flushAssistantToUI = () => {
    if (isStreamingComplete) return;
    cancelPendingAssistantUpdates();
    try {
      callbacks?.onAssistantUpdate?.(assistantMessage);
      lastAssistantUpdateTs = Date.now();
    } catch (error) {
      // Error in assistant update callback
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && !isStreamingComplete) {
      flushAssistantToUI();
    }
  };

  const cleanupVisibilityListener = () => {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  while (true) {
    if (signal?.aborted) {
      cleanupVisibilityListener();
      return {
        id: (Date.now() + 1).toString(),
        content: "Generation Stopped",
        type: "assistant" as const,
        timestamp: new Date(),
        mode: mode,
        isStreaming: false,
      } as StreamingMessage;
    }

    let done: boolean;
    let value: Uint8Array | undefined;
    try {
      const readResult = await reader.read();
      done = readResult.done;
      value = readResult.value;
    } catch (e) {
      // Network/stream read error; attempt reconnection
      const reconnectedReader = await maybeReconnect();
      if (reconnectedReader) {
        reader = reconnectedReader;
        buffer = "";
        currentEventType = null;
        continue;
      }
      // Status endpoint said stream finished, or DB fallback completed the turn
      if (isStreamingComplete || dbFallbackStreamMessage) {
        break;
      }
      throw e;
    }

    if (done) {
      // Process any remaining buffered data
      if (buffer.trim().startsWith("data: ")) {
        const line = buffer.trim();
        try {
          const data = JSON.parse(line.slice(6));
          processStreamingData(data, currentEventType);
        } catch (e) {}
      }
      // If stop event wasn't received, try reconnecting before giving up.
      if (!isStreamingComplete) {
        const reconnectedReader = await maybeReconnect();
        if (reconnectedReader) {
          reader = reconnectedReader;
          buffer = "";
          currentEventType = null;
          continue;
        }
        if (dbFallbackStreamMessage) {
          break;
        }
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";

    for (const rawLine of parts) {
      const line = rawLine.trim();

      // Track Redis stream message id for reconnection (SSE `id:`)
      if (line.startsWith("id:")) {
        // Support both `id: 123` and `id:123`
        const idVal = line.slice(3).trim();
        if (idVal) lastRedisStreamId = idVal;
        continue;
      }

      // Handle event type line
      if (line.startsWith("event: ")) {
        currentEventType = line.slice(7).trim();
        continue;
      }

      // Handle data line
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          processStreamingData(data, currentEventType);
          // Reset event type after processing data
          currentEventType = null;
        } catch (e) {
          buffer = line + "\n" + buffer;
        } finally {
          setReplyClicked(false);
          setReplyAllClicked(false);
          setForwardClicked(false);
        }
      }
    }
  }

  if (dbFallbackStreamMessage) {
    cleanupVisibilityListener();
    return dbFallbackStreamMessage;
  }

  // Only complete if stop event was received (isStreamingComplete = true)
  // If stop event wasn't received, don't complete streaming yet
  if (!isStreamingComplete) {
    // Stream ended but no stop event - this shouldn't happen in normal flow
    // but we'll return the message with isStreaming: true to keep dots showing
    // The backend should always send stop event
    cleanupVisibilityListener();
    return {
      id: (Date.now() + 1).toString(),
      content: accumulatedContent.trim() || assistantMessage,
      type: "assistant" as const,
      timestamp: new Date(),
      mode: mode,
      messageId: messageId,
      formFields: forms,
      calendarData: calendarData,
      ambiguousRecipients: ambiguousRecipients,
      textDirection: getTextDirection(
        accumulatedContent.trim() || assistantMessage
      ),
      isStreaming: true, // Keep streaming true if no stop event
      reasoningMessage: reasoningMessage,
      assistantMessage: assistantMessage,

      images: images,
      cards: cards,
      toolExecutions: toolExecutions,
    } as StreamingMessage;
  }

  if (!accumulatedContent && !assistantMessage) {
    throw new Error("No content received from API");
  }

  // Fallback: ensure any tools still marked as "running" are marked "error"
  // This means they didn't receive a tool_return event
  // Preserve "success" status from tool_return events
  toolExecutions = toolExecutions.map((te) => ({
    ...te,
    status: te.status === "running" ? ("error" as const) : te.status,
  }));

  const finalMessage: StreamingMessage = {
    id: (Date.now() + 1).toString(),
    content: accumulatedContent.trim() || assistantMessage,
    type: "assistant" as const,
    timestamp: new Date(),
    mode: mode,
    messageId: messageId, // Include message ID from response
    formFields: forms,
    calendarData: calendarData,
    ambiguousRecipients: ambiguousRecipients,
    textDirection: getTextDirection(
      accumulatedContent.trim() || assistantMessage
    ),
    isStreaming: false,
    reasoningMessage: reasoningMessage,
    assistantMessage: assistantMessage,
    images: images,
    cards: cards,
    toolExecutions: toolExecutions,
    package: packageData,
    packages: packagesData,
  };

  // Call final callback only if stop event was received and onComplete wasn't already called
  // (onComplete is called in stop event handler, so this is just a fallback)
  if (isStreamingComplete && !onCompleteCalled) {
    callbacks?.onComplete?.(finalMessage);
  }

  cleanupVisibilityListener();
  return finalMessage;

  function processStreamingData(data: any, eventType: string | null = null) {
    // Handle error event - server error during streaming
    if (eventType === "error" || data.error) {
      isStreamingComplete = true;
      errorHandled = true;

      // Clear timeouts and cancel in-flight throttled updates
      if (reasoningBufferTimeout) clearTimeout(reasoningBufferTimeout);
      cancelPendingAssistantUpdates();

      // Extract error message from data
      const errorMessage =
        data.message ||
        data.error?.message ||
        data.error ||
        "I apologize, but I encountered an error Please try again.";

      // Call onError callback if available
      callbacks?.onError?.(errorMessage);

      // Create error message with accumulated content if any, otherwise show error
      const errorContent =
        accumulatedContent.trim() || assistantMessage || errorMessage;

      // Immediately update message state with error
      callbacks?.onAssistantUpdate?.(errorContent);

      // Create error message object
      const errorStreamingMessage: StreamingMessage = {
        id: (Date.now() + 1).toString(),
        content: errorContent,
        type: "assistant" as const,
        timestamp: new Date(),
        mode: mode,
        messageId: messageId,
        formFields: forms,
        calendarData: calendarData,
        ambiguousRecipients: ambiguousRecipients,
        textDirection: getTextDirection(errorContent),
        isStreaming: false,
        isError: true, // Mark as error
        reasoningMessage: reasoningMessage,
        assistantMessage: assistantMessage,
  
        images: images,
        cards: cards,
        toolExecutions: toolExecutions,
      };

      // Call onComplete with error message
      callbacks?.onComplete?.(errorStreamingMessage);
      onCompleteCalled = true;

      // Update accumulated content with error message for return value
      accumulatedContent = errorContent;
      assistantMessage = errorContent;

      cleanupVisibilityListener();
      return;
    }

    // Handle stop event - explicitly mark streaming as complete
    if (eventType === "stop" || data.stop_message) {
      isStreamingComplete = true;

      // Clear timeouts and cancel any in-flight throttled/RAF updates so they
      // cannot call onAssistantUpdate after onComplete (which would re-enable
      // the thinking-dots loader).
      if (reasoningBufferTimeout) clearTimeout(reasoningBufferTimeout);
      cancelPendingAssistantUpdates();

      // Don't call onAssistantUpdate here - it would set isStreaming back to true
      // Instead, directly call onComplete with isStreaming: false to stop the animation
      // Call onComplete to set isStreaming to false, which will hide the thinking dots
      const stopMessage: StreamingMessage = {
        id: (Date.now() + 1).toString(),
        content: assistantMessage || accumulatedContent.trim(),
        type: "assistant" as const,
        timestamp: new Date(),
        mode: mode,
        messageId: messageId,
        formFields: forms,
        calendarData: calendarData,
        ambiguousRecipients: ambiguousRecipients,
        textDirection: getTextDirection(
          accumulatedContent.trim() || assistantMessage
        ),
        isStreaming: false, // Set to false when stop_message is received
        isError: errorHandled, // Preserve error state if error was handled
        reasoningMessage: reasoningMessage,
        assistantMessage: assistantMessage,
  
        images: images,
        cards: cards,
        toolExecutions: toolExecutions,
        package: packageData,
        packages: packagesData,
      };

      // Always call onComplete when stop event is received to ensure completeStreaming is called
      // This stops the loading animation - animation will remain visible until this is called
      callbacks?.onComplete?.(stopMessage);
      onCompleteCalled = true;

      cleanupVisibilityListener();
      return;
    }

    // Handle error data that might come without explicit event type (fallback)
    if (
      !eventType &&
      (data.error || (data.message && data.message.includes("error")))
    ) {
      const errorMessage =
        data.message ||
        data.error?.message ||
        data.error ||
        "Please try again.";

      // Call onError callback if available
      callbacks?.onError?.(errorMessage);

      // Mark streaming as complete
      isStreamingComplete = true;

      // Clear timeouts
      if (reasoningBufferTimeout) clearTimeout(reasoningBufferTimeout);
      if (assistantBufferTimeout) clearTimeout(assistantBufferTimeout);
      if (assistantThrottleTimeout) clearTimeout(assistantThrottleTimeout);

      // Create error message
      const errorContent =
        accumulatedContent.trim() || assistantMessage || errorMessage;
      accumulatedContent = errorContent;
      assistantMessage = errorContent;

      cleanupVisibilityListener();
      return;
    }

    if (isStreamingComplete) {
      return;
    }

    // Handle tool_call event - when a tool starts executing
    // Backend may send tool_call with only tool_call_id, or with full details
    if (eventType === "tool_call" && data.tool_call_id) {
      // Check if tool execution already exists (from a previous tool_call with only ID)
      const existingIndex = toolExecutions.findIndex(
        (te) => te.tool_call_id === data.tool_call_id
      );

      if (existingIndex !== -1) {
        // Update existing tool execution with new details if provided
        const existingTool = toolExecutions[existingIndex];
        const updatedTool = {
          ...existingTool,
          ...(data.tool_name && { tool_name: data.tool_name }),
          ...(data.tool_call_message && {
            tool_call_message: data.tool_call_message,
          }),
          ...(data.tool_icon && { icon_name: data.tool_icon }),
          ...(data.icon_name && { icon_name: data.icon_name }),
          status: "running" as const,
        };
        toolExecutions[existingIndex] = updatedTool;
        callbacks?.onToolExecution?.(updatedTool);
      } else {
        // Create new tool execution
        // Extract tool name from tool_call_id if not provided (e.g., "tool_0_hotel_search_tool_b2LoR30Mb5" -> "hotel search tool")
        let toolName = data.tool_name;
        if (!toolName && data.tool_call_id) {
          // Try to extract tool name from tool_call_id format: "tool_0_hotel_search_tool_b2LoR30Mb5"
          // Pattern: tool_<number>_<tool_name>_<random_id>
          const parts = data.tool_call_id.split("_");
          if (parts.length >= 3) {
            // Skip "tool" and the number, take everything except the last part (random ID)
            toolName = parts
              .slice(2, -1)
              .join(" ")
              .replace(/\b\w/g, (l: string) => l.toUpperCase());
          } else {
            toolName = "Tool"; // Fallback
          }
        }

        const iconName = data.tool_icon || data.icon_name;
        const toolExecution = {
          tool_call_id: data.tool_call_id,
          tool_name: toolName || "Tool",
          tool_call_message: data.tool_call_message || "Executing...",
          ...(iconName && { icon_name: iconName }),
          timestamp: Date.now(),
          status: "running" as const,
        };
        toolExecutions.push(toolExecution);
        callbacks?.onToolExecution?.(toolExecution);
      }

      // Reset current step reasoning when a tool call starts
      currentStepReasoning = "";
      return;
    }

    // Handle tool_return event - when a tool completes with status and duration
    // This may also include tool_name and tool_call_message if they weren't in tool_call
    if (eventType === "tool_return" && data.tool_call_id) {
      const toolIndex = toolExecutions.findIndex(
        (te) => te.tool_call_id === data.tool_call_id
      );

      if (toolIndex !== -1) {
        // Update existing tool execution
        const existingTool = toolExecutions[toolIndex];
        const updatedTool = {
          ...existingTool,
          ...(data.tool_name && { tool_name: data.tool_name }),
          ...(data.tool_call_message && {
            tool_call_message: data.tool_call_message,
          }),
          ...(data.tool_icon && { icon_name: data.tool_icon }),
          ...(data.icon_name && { icon_name: data.icon_name }),
          status: data.tool_call_status || "success",
          duration: data.tool_call_duration,
        };
        toolExecutions[toolIndex] = updatedTool;

        // Notify callback with updated tool execution
        callbacks?.onToolExecution?.(updatedTool);
      } else {
        // Tool return received but no tool_call was processed - create it now
        let toolName = data.tool_name;
        if (!toolName && data.tool_call_id) {
          // Extract tool name from tool_call_id format: "tool_0_hotel_search_tool_b2LoR30Mb5"
          const parts = data.tool_call_id.split("_");
          if (parts.length >= 3) {
            // Skip "tool" and the number, take everything except the last part (random ID)
            toolName = parts
              .slice(2, -1)
              .join(" ")
              .replace(/\b\w/g, (l: string) => l.toUpperCase());
          } else {
            toolName = "Tool";
          }
        }

        const iconName = data.tool_icon || data.icon_name;
        const toolExecution = {
          tool_call_id: data.tool_call_id,
          tool_name: toolName || "Tool",
          tool_call_message: data.tool_call_message || "Completed",
          ...(iconName && { icon_name: iconName }),
          timestamp: Date.now(),
          status: data.tool_call_status || "success",
          duration: data.tool_call_duration,
        };
        toolExecutions.push(toolExecution);
        callbacks?.onToolExecution?.(toolExecution);
      }

      // Reset current step reasoning when a tool call finishes (next reasoning is a new segment)
      currentStepReasoning = "";
      return;
    }

    // Legacy support: Handle tool execution data without event type (backward compatibility)
    if (!eventType && data.tool_name && data.tool_call_message) {
      // Mark the previous tool as completed when a new one arrives (sequential execution)
      if (toolExecutions.length > 0) {
        const lastTool = toolExecutions[toolExecutions.length - 1];
        if (lastTool.status === "running") {
          toolExecutions[toolExecutions.length - 1] = {
            ...lastTool,
            status: "completed" as const,
          };
        }
      }

      // Handle both tool_icon and icon_name from backend, prefer tool_icon
      const iconName = data.tool_icon || data.icon_name;
      const toolExecution = {
        tool_call_id: data.tool_call_id,
        tool_name: data.tool_name,
        tool_call_message: data.tool_call_message,
        ...(iconName && { icon_name: iconName }), // Extract icon name if provided
        timestamp: Date.now(),
        status: "running" as const,
        ...(data.duration !== undefined && { duration: data.duration }),
      };
      toolExecutions.push(toolExecution);
      callbacks?.onToolExecution?.(toolExecution);

      // Reset current step reasoning for legacy tool execution path
      currentStepReasoning = "";
    }

    // Handle reasoning message chunks immediately (from 'reasoning' event type)
    if (
      data.reasoning_message_chunk ||
      (eventType === "reasoning" && data.reasoning_message_chunk !== undefined)
    ) {
      reasoningMessage += data.reasoning_message_chunk;
      currentStepReasoning += data.reasoning_message_chunk;
      callbacks?.onReasoningUpdate?.(currentStepReasoning);
    }

    // Handle assistant message chunks with buffering and throttling
    if (data.assistant_message_chunk) {
      assistantBuffer += data.assistant_message_chunk;
      assistantMessage += data.assistant_message_chunk;
      accumulatedContent += data.assistant_message_chunk;

      // Mark all running tool executions as error when assistant starts responding
      // This means they didn't receive a tool_return event
      // Preserve "success" status from tool_return events
      if (
        assistantBuffer.length === data.assistant_message_chunk.length &&
        toolExecutions.length > 0
      ) {
        const hasRunningTools = toolExecutions.some(
          (te) => te.status === "running"
        );
        if (hasRunningTools) {
          toolExecutions = toolExecutions.map((te) => ({
            ...te,
            status: te.status === "running" ? ("error" as const) : te.status,
          }));
        }
      }

      // Only reset the buffer fallback — do not cancel the throttle timer
      if (assistantBufferTimeout) {
        clearTimeout(assistantBufferTimeout);
        assistantBufferTimeout = null;
      }

      const isFirstChunk =
        assistantBuffer.length === data.assistant_message_chunk.length;
      scheduleAssistantUpdate(isFirstChunk);

      // Safety flush only when no throttle / RAF is scheduled
      assistantBufferTimeout = setTimeout(() => {
        if (
          !isStreamingComplete &&
          !assistantThrottleTimeout &&
          !rafUpdateId
        ) {
          flushAssistantToUI();
          assistantBuffer = "";
        }
      }, BUFFER_TIMEOUT);
    }

    // Handle final structured data
    if (data.id) {
      messageId = data.id;
    }

    if (data.chat_title) {
      chatTitle = data.chat_title;
      
      // If we have a session_id and chat_title is received, update the session in sidebar
      // This handles the case where chat_title arrives after session_id
      // Use persona_id from the first message to ensure it's stored correctly
      if (typeof window !== "undefined") {
        const currentSessionId = getSessionId();
        if (currentSessionId) {
          const currentUserId = getUserIdValue() || "";
          const currentPersonaId = getSelectedPersonaId();
          // Use persona_id from the first message if available, otherwise fall back to current store value
          const personaId = personaIdForSession !== undefined && personaIdForSession !== null 
            ? personaIdForSession 
            : (currentPersonaId !== null && currentPersonaId !== undefined ? currentPersonaId : undefined);
          
          window.dispatchEvent(
            new CustomEvent("addNewChatSession", {
              detail: {
                session_id: currentSessionId,
                chat_title: data.chat_title,
                user_id: currentUserId,
                persona_id: personaId,
              },
            })
          );
        }
      }
    }

    // Handle session_id from backend (for new chats)
    if (data.session_id) {
      const currentSessionId = getSessionId();
      if (!currentSessionId || currentSessionId !== data.session_id) {
        const isNewSession = !currentSessionId || currentSessionId !== data.session_id;
        // Dispatch BEFORE setSessionIdValue so App.tsx can set newlyCreatedSessionRef
        // and skip list_message (fetchUserMessages) - prevents session flicker on first chat
        if (isNewSession && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("sessionCreatedByStreaming", {
              detail: { session_id: data.session_id },
            })
          );
        }
        setSessionIdValue(data.session_id);
        // Set persona_id from store when new session is created
        const currentPersonaId = getSelectedPersonaId();
        if (currentPersonaId !== null && currentPersonaId !== undefined) {
          setSelectedPersonaIdValue(currentPersonaId);
        }
        
        // Dispatch event to update chat session list in sidebar (without triggering message loading)
        // Use the persona_id from the first message (personaIdForSession) to ensure it's stored correctly
        if (isNewSession && typeof window !== "undefined") {
          const currentUserId = getUserIdValue() || "";
          // Use persona_id from the first message if available, otherwise fall back to current store value
          const personaId = personaIdForSession !== undefined && personaIdForSession !== null 
            ? personaIdForSession 
            : (currentPersonaId !== null && currentPersonaId !== undefined ? currentPersonaId : undefined);
          const sessionTitle = chatTitle || data.chat_title || "New Chat";
          
          window.dispatchEvent(
            new CustomEvent("addNewChatSession", {
              detail: {
                session_id: data.session_id,
                chat_title: sessionTitle,
                user_id: currentUserId,
                persona_id: personaId,
              },
            })
          );
        }
      }
    }

    if (data.forms) {
      forms = data.forms;
    }

    if (data.calendar_data) {
      calendarData = data.calendar_data;
    }

    if (data.ambiguousRecipients) {
      ambiguousRecipients = data.ambiguousRecipients;
    }

    if (data.document_search_data) {
      documentSearchData = data.document_search_data;
    }
    if (data.doc_search_data) {
      documentSearchData = data.doc_search_data;
    }

    if (data.images) {
      images = data.images;
    }

    if (data.cards) {
      cards = data.cards;
    }
    if (data.html_data !== undefined) {
      htmlData = data.html_data;
    }
    if (data.dashboard_data) {
      dashboardData = data.dashboard_data;
      // For dashboard payloads, also expose underlying html_data
      if (
        htmlData === undefined &&
        Array.isArray(data.dashboard_data.html_data)
      ) {
        htmlData = data.dashboard_data.html_data;
      }
    }
    // Plotly dashboards often send `plotly_json_config` at the top level of `data`
    // (separate SSE chunk from `assistant_message_chunk`). Merge whenever present.
    // Important: do not gate on `!dashboardData` — an earlier chunk may have set
    // `dashboard_data` to `{}` (truthy), which would otherwise block this merge and
    // leave the visualization sidebar on the default dashboard.
    if ((data as any).plotly_json_config) {
      const prev = dashboardData && typeof dashboardData === "object" ? dashboardData : {};
      dashboardData = {
        ...prev,
        plotly_json_config: (data as any).plotly_json_config,
        dashboard_metadata:
          (data as any).metadata ||
          (data as any).dashboard_metadata ||
          (prev as any)?.dashboard_metadata ||
          {},
      };
    }

    // Handle package data from message event (support both singular and plural)
    if (eventType === "message") {
      if (data.package) {
        packageData = data.package;
      }
      if (data.packages && Array.isArray(data.packages)) {
        packagesData = data.packages;
      }
    }

    // Call final data callback when we have structured data
    if (
      data.chat_title ||
      data.forms ||
      data.calendar_data ||
      htmlData !== undefined ||
      dashboardData ||
      (data as any).plotly_json_config ||
      data.images ||
      data.cards ||
      data.document_search_data ||
      data.doc_search_data ||
      packageData ||
      packagesData
    ) {
      // NOTE: Do NOT set isStreamingComplete here - wait for stop event
      // This allows structured data to be received but keeps streaming active

      // Clear timeouts (but don't mark as complete)
      if (reasoningBufferTimeout) clearTimeout(reasoningBufferTimeout);
      if (assistantBufferTimeout) clearTimeout(assistantBufferTimeout);

      if (assistantMessage.length > 0) {
        scheduleAssistantUpdate(true);
      }

      callbacks?.onFinalData?.({
        chat_title: data.chat_title,
        html_data: htmlData,
        dashboard_data: dashboardData,
        forms: data.forms,
        calendar_data: data.calendar_data,
        ambiguousRecipients: data.ambiguousRecipients,
        document_search_data: documentSearchData,
        // doc_search_data is sent by some backends instead of document_search_data
        doc_search_data: data.doc_search_data ?? undefined,
        images: images,
        cards: cards,
        package: packageData,
        packages: packagesData,
        messageId: messageId, // Include messageId from backend response
      });
    }
  }
};
