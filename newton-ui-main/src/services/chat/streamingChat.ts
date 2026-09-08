import { Message, MessageTimelineEntry } from "../../types/message";
import { sendStreamingMessageToAPI, StreamingCallbacks } from "./streamingApi";
import { getSessionId } from "../../store/useStore";

// Simplified unified chat state - no separate streamingMessage
export interface UnifiedChatState {
  messages: Message[];
  isTyping: boolean;
  error?: string;
  message_timeline?: MessageTimelineEntry[];
}

export const initialUnifiedChatState: UnifiedChatState = {
  messages: [],
  isTyping: false,
  error: undefined,
  message_timeline: [],
};

// Set typing state
export const setTyping = (
  state: UnifiedChatState,
  isTyping: boolean
): UnifiedChatState => {
  return {
    ...state,
    isTyping,
  };
};

// Set error state
export const setError = (
  state: UnifiedChatState,
  error: string
): UnifiedChatState => {
  return {
    ...state,
    error,
    isTyping: false,
  };
};

// Add or update message in-place (unified streaming approach)
export const addOrUpdateMessage = (
  state: UnifiedChatState,
  message: Partial<Message> & { id: string }
): UnifiedChatState => {
  const messages = [...state.messages];
  const existingIndex = messages.findIndex((m) => m.id === message.id);

  if (existingIndex >= 0) {
    // Update existing message (streaming updates)
    messages[existingIndex] = {
      ...messages[existingIndex],
      ...message,
      // If we are converting an error bubble into streaming/success, clear error flags
      ...(message.isStreaming ? { isError: false } : {}),
    };
  } else {
    // Add new message
    const newMessage: Message = {
      type: "assistant",
      timestamp: new Date(),
      content: "",
      isStreaming: false,
      ...message,
    };
    messages.push(newMessage);
  }

  return {
    ...state,
    messages,
  };
};

// Complete streaming for a message
export const completeStreaming = (
  state: UnifiedChatState,
  messageId: string
): UnifiedChatState => {
  const messages = state.messages.map((msg) =>
    msg.id === messageId ? { ...msg, isStreaming: false } : msg
  );

  return {
    ...state,
    messages,
    isTyping: false,
    message_timeline: [], // Clear timeline when streaming completes
  };
};

// Add or update tool execution in the timeline
export const addOrUpdateToolExecution = (
  state: UnifiedChatState,
  toolExecution: {
    tool_call_id?: string;
    tool_name: string;
    tool_call_message: string;
    icon_name?: string;
    timestamp: number;
    duration?: number;
    status?: "running" | "completed" | "success" | "error";
  }
): UnifiedChatState => {
  const timeline = [...(state.message_timeline || [])];

  if (toolExecution.tool_call_id) {
    const existingIndex = timeline.findIndex(
      (entry) =>
        entry.type === "tool_call" &&
        entry.tool_call_id === toolExecution.tool_call_id
    );

    if (existingIndex !== -1) {
      const toolCall = timeline[existingIndex] as any;

      // Update the tool_call entry
      timeline[existingIndex] = {
        ...toolCall,
        status: toolExecution.status,
        duration: toolExecution.duration,
        // If it's a tool_return, we might want to update the content too
        ...(toolExecution.status === "success" ||
        toolExecution.status === "error"
          ? {
              type: "tool_call", // Keep as tool_call but with updated status
              status: toolExecution.status,
              success: toolExecution.status === "success",
            }
          : {}),
      };

      return { ...state, message_timeline: timeline };
    }
  }

  // Add new tool_call entry
  timeline.push({
    type: "tool_call",
    tool_call_id: toolExecution.tool_call_id || `tool_${Date.now()}`,
    tool_name: toolExecution.tool_name,
    tool_icon: toolExecution.icon_name,
    content: toolExecution.tool_call_message,
    timestamp: new Date(toolExecution.timestamp).toISOString(),
    // @ts-ignore - internal status tracking
    status: toolExecution.status || "running",
  } as any);

  return { ...state, message_timeline: timeline };
};

// Update reasoning in the timeline
export const updateReasoning = (
  state: UnifiedChatState,
  reasoning: string
): UnifiedChatState => {
  const timeline = [...(state.message_timeline || [])];
  const lastEntry = timeline[timeline.length - 1];

  if (lastEntry && lastEntry.type === "reasoning") {
    timeline[timeline.length - 1] = {
      ...lastEntry,
      content: reasoning,
      timestamp: new Date().toISOString(),
    };
  } else {
    timeline.push({
      type: "reasoning",
      content: reasoning,
      timestamp: new Date().toISOString(),
    });
  }

  return { ...state, message_timeline: timeline };
};

// Update assistant message in the timeline.
//
// `content` is the full accumulated assistant text so far. When a reasoning or
// tool event lands between two assistant chunks, this function pushes a *new*
// assistant_message entry. If we stored `content` as-is on the new entry, it
// would already include the text held by earlier assistant_message entries —
// the renderer iterates each entry independently, so the earlier text would
// render twice. To prevent that we store only the *delta* (the text not yet
// covered by prior assistant_message entries).
export const updateAssistantMessageInTimeline = (
  state: UnifiedChatState,
  content: string
): UnifiedChatState => {
  const timeline = [...(state.message_timeline || [])];
  const lastEntry = timeline[timeline.length - 1];
  const isLastAssistantMessage =
    !!lastEntry && lastEntry.type === "assistant_message";

  // Compute the text already represented by earlier assistant_message entries.
  // If the last entry IS an assistant_message we'll update it in place, so its
  // content is excluded from the "prior" total.
  const priorEntries = isLastAssistantMessage
    ? timeline.slice(0, -1)
    : timeline;
  const priorAssistantContent = priorEntries
    .filter(
      (e): e is typeof e & { content?: string } =>
        e.type === "assistant_message",
    )
    .map((e) => e.content || "")
    .join("");
  const deltaContent = content.startsWith(priorAssistantContent)
    ? content.slice(priorAssistantContent.length)
    : content;

  if (isLastAssistantMessage) {
    timeline[timeline.length - 1] = {
      ...lastEntry,
      content: deltaContent,
      timestamp: new Date().toISOString(),
    };
  } else {
    if (!deltaContent.trim()) {
      return state;
    }
    timeline.push({
      type: "assistant_message",
      content: deltaContent,
      timestamp: new Date().toISOString(),
    });
  }

  return { ...state, message_timeline: timeline };
};

// Clear error
export const clearError = (state: UnifiedChatState): UnifiedChatState => {
  return {
    ...state,
    error: undefined,
  };
};

// New unified streaming processor - now connected to real API
export const processUnifiedStreamingMessage = async (
  language: "EN" | "AR",
  state: UnifiedChatState,
  content: string,
  onUpdate: (newState: UnifiedChatState) => void,
  onError?: (error: string) => void,
  fileIds?: string[],
  mode?: string,
  emailContext?: {
    emailId: string;
    conversationId: string;
  },
  options?: {
    reuseAssistantId?: string;
    skipAddingUserMessage?: boolean;
    attachments?: any[];
    personaId?: number;
    /** Attach to GET /chat/sessions/{id}/stream (e.g. list_message empty but Redis stream active). */
    streamResume?: { sessionId: string; lastId?: string | null };
    /** When set, the backend will treat the request as an edit of the given message_id. */
    editMessageId?: string;
  },
  signal?: AbortSignal
): Promise<{
  state: UnifiedChatState;
  shouldRefreshSessions: boolean;
  newSession?: { session_id: string; chat_title: string; user_id: string };
  updatedTitle?: { session_id: string; chat_title: string };
}> => {
  let currentState: UnifiedChatState = state;
  let assistantId: string | null = null;
  let errorHandled = false;
  let shouldRefreshSessions = false; // Track if we need to refresh chat sessions
  let newSessionId: string | null = null; // Track new session ID if created
  let newChatTitle: string | null = null; // Track new chat title if received

  // Track if this is the first message (before adding any messages)
  const isFirstMessage = state.messages.length === 0;

  // Always add user message and assistant placeholder BEFORE network calls
  if (!options?.skipAddingUserMessage) {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      type: "user",
      timestamp: new Date(),
      emailContext,
      mode,
      ...(options?.personaId !== undefined && { personaId: options.personaId }),
      attachments: options?.attachments,
    };
    currentState = addOrUpdateMessage(currentState, userMessage);
  }
  currentState = setTyping(currentState, true);
  onUpdate(currentState);

  assistantId = options?.reuseAssistantId || (Date.now() + 1).toString();
  currentState = addOrUpdateMessage(currentState, {
    id: assistantId,
    type: "assistant",
    content: "",
    isStreaming: true,
    timestamp: new Date(),
  });
  onUpdate(currentState);

  try {
    // Check if already aborted
    if (signal?.aborted) {
      throw new Error("Request was aborted");
    }

    // Set up streaming callbacks
    const streamingCallbacks: StreamingCallbacks = {
      onReasoningUpdate: (reasoning: string) => {
        currentState = updateReasoning(currentState, reasoning);
        // Also update the current streaming message with the timeline
        currentState = addOrUpdateMessage(currentState, {
          id: assistantId,
          message_timeline: currentState.message_timeline,
          isStreaming: true,
        });
        onUpdate(currentState);
      },
      onAssistantUpdate: (
        assistantContent: string,
      ) => {
        // Mark all running tool executions in the timeline as error if they haven't finished
        if (currentState.message_timeline) {
          const updatedTimeline = currentState.message_timeline.map((entry) => {
            if (entry.type === "tool_call") {
              const entryAny = entry as any;
              if (entryAny.status === "running") {
                return { ...entryAny, status: "error" };
              }
            }
            return entry;
          });
          currentState = { ...currentState, message_timeline: updatedTimeline };
        }

        currentState = updateAssistantMessageInTimeline(
          currentState,
          assistantContent
        );

        currentState = addOrUpdateMessage(currentState, {
          id: assistantId,
          content: assistantContent,
          isStreaming: true,
          message_timeline: currentState.message_timeline,
        });
        onUpdate(currentState);
      },
      onToolExecution: (toolExecution) => {
        // Add or update tool execution in the timeline
        currentState = addOrUpdateToolExecution(currentState, toolExecution);

        // Update the streaming message with the updated timeline
        currentState = addOrUpdateMessage(currentState, {
          id: assistantId,
          message_timeline: currentState.message_timeline,
          isStreaming: true,
        });
        onUpdate(currentState);
      },
      onFinalData: (data) => {
        // Ensure all tools are marked as completed/error if still running
        if (currentState.message_timeline) {
          const finalizedTimeline = currentState.message_timeline.map(
            (entry) => {
              if (entry.type === "tool_call") {
                const entryAny = entry as any;
                if (entryAny.status === "running") {
                  return { ...entryAny, status: "error" };
                }
              }
              return entry;
            }
          );
          currentState = {
            ...currentState,
            message_timeline: finalizedTimeline,
          };
        }

        // Track chat title and session ID for new session creation
        if (data.chat_title) {
          newChatTitle = data.chat_title;
          if (!isFirstMessage && !newSessionId) {
            shouldRefreshSessions = true;
          }
        }

        // Add final metadata and preserve interleaved timeline
        const dashboardData = (data as any).dashboard_data;

        currentState = addOrUpdateMessage(currentState, {
          id: assistantId,
          formFields: data.forms || [],
          calendarData: data.calendar_data,
          documentSearchData: (data as any).document_search_data,
          images: data.images,
          cards: data.cards,
          html_data: data.html_data,
          chat_title: data.chat_title,
          package: data.package,
          packages: data.packages,
          isStreaming: true,
          message_timeline: currentState.message_timeline,
          message_id: data.messageId,
          ...(dashboardData && {
            // Mirror backend dashboard payload shape under json_data
            json_data: {
              html_data: data.html_data ?? dashboardData.html_data,
              dashboard_data: dashboardData,
            } as any,
          }),
        });

        // Don't clear message_timeline here unlike reasoningMessage as it's the source of truth for rendering
        onUpdate(currentState);
      },
      onError: (error: string) => {
        if (errorHandled) return;
        errorHandled = true;
        currentState = addOrUpdateMessage(currentState, {
          id: assistantId!,
          content: `Error: ${error}`,
          isStreaming: false,
          isError: true,
          message_timeline: currentState.message_timeline,
        });
        currentState = setError(currentState, error);
        onUpdate(currentState);
        onError?.(error);
      },
      onComplete: (finalMessage) => {
        if (assistantId) {
          const finalContent =
            finalMessage?.assistantMessage ||
            finalMessage?.content ||
            "";

          if (finalContent) {
            currentState = updateAssistantMessageInTimeline(
              currentState,
              finalContent
            );
          }

          const updateData: any = {
            id: assistantId,
            isStreaming: false,
            ...(finalContent && { content: finalContent }),
            ...(finalMessage?.isError !== undefined && {
              isError: finalMessage.isError,
            }),
            message_timeline: currentState.message_timeline,
          };

          if (finalMessage?.messageId) {
            updateData.message_id = finalMessage.messageId;

            const userMessage = currentState.messages.find(
              (msg) =>
                msg.type === "user" &&
                msg.id !== assistantId &&
                msg.content === content
            );
            if (userMessage) {
              currentState = addOrUpdateMessage(currentState, {
                id: userMessage.id,
                message_id: finalMessage.messageId,
              });
            }
          }

          currentState = addOrUpdateMessage(currentState, updateData);
          currentState = completeStreaming(currentState, assistantId);
        }
        currentState = setTyping(currentState, false);
        onUpdate(currentState);
      },
    };

    // Track current session ID before API call to detect new session creation
    const sessionIdBeforeCall = getSessionId();

    // Call the real streaming API
    await sendStreamingMessageToAPI(
      {
        id: Date.now().toString(),
        content,
        type: "user",
        timestamp: new Date(),
        emailContext,
        mode,
        ...(options?.personaId !== undefined && {
          personaId: options.personaId,
        }),
      },
      mode,
      signal, // Pass the AbortSignal
      language,
      streamingCallbacks,
      fileIds,
      options?.personaId,
      options?.streamResume,
      options?.editMessageId
    );

    // Check if a new session was created (session_id changed)
    const sessionIdAfterCall = getSessionId();
    if (sessionIdAfterCall && sessionIdAfterCall !== sessionIdBeforeCall) {
      newSessionId = sessionIdAfterCall;
      // For new sessions, we'll add directly to sidebar instead of refreshing
      // Never refresh when a new session is created - it will be added via event
      // Reset shouldRefreshSessions if it was set earlier (e.g., from title update)
      shouldRefreshSessions = false;
    }

    // Return updated title for existing sessions when title changes
    const updatedTitle =
      shouldRefreshSessions && newChatTitle && !newSessionId
        ? {
            session_id: sessionIdBeforeCall || "",
            chat_title: newChatTitle,
          }
        : undefined;

    return {
      state: currentState,
      shouldRefreshSessions,
      ...(newSessionId && newChatTitle
        ? {
            newSession: {
              session_id: newSessionId,
              chat_title: newChatTitle,
              user_id: "", // Will be set by sidebar from store
            },
          }
        : {}),
      ...(updatedTitle ? { updatedTitle } : {}),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    // Graceful handling for user-cancelled/aborted requests
    if (
      (error instanceof Error &&
        (error.name === "AbortError" || /aborted/i.test(error.message))) ||
      /BodyStreamBuffer was aborted/i.test(String(error))
    ) {
      // Check if this was the first message and session wasn't created yet
      const sessionIdAfterCall = getSessionId();
      if (isFirstMessage && !sessionIdAfterCall) {
        // First message was cancelled before session was created - preserve user message
        // Remove only assistant messages, keep user messages
        const userMessages = currentState.messages.filter((msg) => msg.type === "user");
        const stateWithUserOnly = {
          ...currentState,
          messages: userMessages,
          isTyping: false,
        };
        return {
          state: stateWithUserOnly,
          shouldRefreshSessions: false,
          newSession: undefined,
        };
      }

      if (assistantId) {
        // Preserve whatever content has streamed so far; just stop streaming flags
        currentState = addOrUpdateMessage(currentState, {
          id: assistantId,
          isStreaming: false,
          isError: false,
        });
      }
      // Clear typing
      currentState = setTyping(currentState, false);
      onUpdate(currentState);
      return {
        state: currentState,
        shouldRefreshSessions: false,
        newSession: undefined,
      };
    }
    // Ensure the assistant placeholder becomes an error message
    try {
      const fallbackAssistantId = assistantId || (Date.now() + 1).toString();
      const baseState = currentState || state;
      if (!errorHandled) {
        errorHandled = true;
        const updated = addOrUpdateMessage(baseState, {
          id: fallbackAssistantId,
          type: "assistant",
          content: `Error: ${errorMessage}`,
          isStreaming: false,
          isError: true,
          timestamp: new Date(),
        });
        const withError = setError(updated, errorMessage);
        onUpdate(withError);
        onError?.(errorMessage);
        return {
          state: withError,
          shouldRefreshSessions: false,
          newSession: undefined,
        };
      } else {
        // Error already handled via onError; just ensure typing is stopped
        const stopped = setTyping(baseState, false);
        onUpdate(stopped);
        return {
          state: stopped,
          shouldRefreshSessions: false,
          newSession: undefined,
        };
      }
    } catch {}
    onError?.(errorMessage);
    const fallback = setError(currentState || state, errorMessage);
    onUpdate(fallback);
    return {
      state: fallback,
      shouldRefreshSessions: false,
      newSession: undefined,
    };
  }
};
