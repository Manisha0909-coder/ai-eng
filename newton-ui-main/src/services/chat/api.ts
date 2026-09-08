import { API_CONFIG } from "../../config/api";
import { unwrapEnvelope, throwEnvelopeErrorFromResponse } from "../api/envelope";
import {
  getSessionId,
  getUserIdValue,
  setSessionIdValue,
} from "../../store/useStore";
import { Message, MessageTimelineEntry } from "../../types/message";
import {
  assistantContentFromTimeline,
  consolidateMessageTimeline,
} from "./timelineUtils";
import { fileUrl, middlewareFilePath } from "../../utils/fileStaticPath";
// import { useEmailModeStore } from "../store/useEmailMode";
// const emailModeStore = useEmailModeStore.getState();

export const handleApiError = (error: any): string => {
  const errorMsg = error?.message || String(error);

  if (errorMsg.includes("Local API error")) {
    if (
      errorMsg.includes("Failed to fetch") ||
      errorMsg.includes("ECONNREFUSED")
    ) {
      return "Couldn't connect to the local model server. Please make sure the server is running on the correct port.";
    }
    return "There was an error with the local model. Please check the server logs for more information.";
  } else if (errorMsg.includes("too large")) {
    return "The file you uploaded is too large. Please use a smaller file (under 10MB for PDFs, under 5MB for images).";
  } else if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
    return "The request timed out. This often happens with large files or when the model is busy. Please try again with a smaller file.";
  }

  return "Sorry, there was an error processing your request. Please try again.";
};

const getHeaders = async (): Promise<Record<string, string>> => {
  return {
    "Content-Type": "application/json",
  };
};

// export const sendMessageToAPI = async (
//   message: Message,
//   token: string,
//   mode?: string,
//   signal?: AbortSignal,
//   language?: "EN" | "AR"
// ): Promise<Message> => {
//   const { setReplyClicked, setReplyAllClicked, setForwardClicked } =
//     useEmailStore.getState();
//   let messageContent: any = message.content;
//   // Get timezone and replace deprecated "Asia/Calcutta" with "Asia/Kolkata"
//   let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
//   if (timezone === "Asia/Calcutta") {
//     timezone = "Asia/Kolkata";
//   }
//   // Handle attachments if present
//   if (message.attachments && message.attachments.length > 0) {
//     const attachment = message.attachments[0];
//     try {
//       if (attachment.type.startsWith("image/")) {
//         // Handle image attachments
//         messageContent = message.content || "Please analyze this image.";
//       } else if (attachment.type === "application/pdf") {
//         // Handle PDF attachments
//         messageContent = message.content || "Please analyze this PDF.";
//       }
//     } catch (error) {
//       throw error;
//     }
//   }

//   const headers: Record<string, string> = {
//     ...API_CONFIG.API_HEADERS,
//   };

//   // Add token to headers if provided
//   if (token) {
//     // Authorization is now handled via cookies
//   }

//   const sessionId = getSessionId();
//   const storedPersonaId = getSelectedPersonaId();
//   // Always include persona_id if available to ensure persona is always in the payload
//   const personaIdToUse = storedPersonaId !== null && storedPersonaId !== undefined ? storedPersonaId : undefined;

//   const requestBody = {
//     time_zone: timezone,
//     session_id: sessionId,
//     query: messageContent,
//     // Always include persona_id if we have one - this ensures persona is always in the payload
//     ...(personaIdToUse !== undefined && personaIdToUse !== null && { persona_id: personaIdToUse }),
//     email_context: message.emailContext
//       ? {
//           email_id: message.emailContext.emailId,
//           conversation_id: message.emailContext.conversationId,
//         }
//       : undefined,
//     language: language,
//   };
//   let email_sync_id = "";
//   if (emailModeStore.isGmail) {
//     email_sync_id = emailModeStore.gmailUserId;
//   } else if (emailModeStore.isOutlook) {
//     email_sync_id = emailModeStore.outlookUserId;
//   }

//   const response = await fetch(
//     `${API_CONFIG.LOCAL_API_BASE_URL}/chat/create`,
//     {
//       method: "POST",
//       headers,
//       body: JSON.stringify({
//         ...requestBody,
//         // email_provider: emailModeStore.isGmail ? "gsuite" : "outlook",
//         // email_sync_id: email_sync_id,
//       }),
//       signal,
//     }
//   );

//   if (!response.ok) {
//     const errorData = await response.json().catch(() => ({
//       error: { message: `HTTP error ${response.status}` },
//     }));
//     throw new Error(
//       `Local API error ${response.status}: ${
//         errorData.error?.message || "Unknown error"
//       }`
//     );
//   }

//   // Handle SSE response
//   const reader = response.body?.getReader();
//   if (!reader) {
//     throw new Error("Failed to get response reader");
//   }

//   let accumulatedContent = "";
//   let forms = [];
//   let calendarData = null;
//   let webAnalysisData: Message["webAnalysisData"] = undefined;
//   let documentSearchData: Message["documentSearchData"] = undefined;
//   const decoder = new TextDecoder();
//   // Buffer to accumulate SSE chunks that may arrive split across multiple reads
//   let buffer = "";

//   while (true) {
//     // Check if request is aborted
//     if (signal?.aborted) {
//       return {
//         id: (Date.now() + 1).toString(),
//         content: "Generation Stopped",
//         type: "assistant" as const,
//         timestamp: new Date(),
//         mode: mode,
//       } as Message;
//     }

//     const { done, value } = await reader.read();

//     // If the stream has ended, process any remaining buffered data and exit the loop
//     if (done) {
//       // There might be a final event without a trailing newline
//       if (buffer.trim().startsWith("data: ")) {
//         const line = buffer.trim();
//         try {
//           const data = JSON.parse(line.slice(6));
//           // Re-use the same handler logic for the final chunk
//           if (data.assistant_message_chunk) {
//             accumulatedContent += data.assistant_message_chunk;
//             if (accumulatedContent.length > 10) {
//               getTextDirection(accumulatedContent);
//             }
//           }
//           if (data.forms) forms = data.forms;
//           if (data.calendar_data) calendarData = data.calendar_data;
//           if (data.document_search_data)
//             documentSearchData = data.document_search_data as any;
//           if (data.doc_search_data)
//             documentSearchData = data.doc_search_data as any;
//           // Handle session_id from backend (for new chats)
//           if (data.session_id) {
//             const currentSessionId = getSessionId();
//             if (!currentSessionId || currentSessionId !== data.session_id) {
//               setSessionIdValue(data.session_id);
//             }
//           }
//           // Handle chat_title from backend
//           if (data.chat_title) {
//           }
//         } catch (e) {
//           // Failed to parse final SSE data
//         }
//       }
//       break;
//     }

//     // Decode the current chunk and append it to the buffer. Using the streaming
//     // flag ensures multi-byte characters are handled correctly across chunks.
//     buffer += decoder.decode(value, { stream: true });

//     // Split the buffer into complete lines. The last entry may be an incomplete
//     // line, so we preserve it in the buffer for the next iteration.
//     const parts = buffer.split("\n");
//     buffer = parts.pop() || ""; // Remainder (possibly incomplete)

//     for (const rawLine of parts) {
//       const line = rawLine.trim();
//       if (line.startsWith("data: ")) {
//         try {
//           const data = JSON.parse(line.slice(6));

//           // Handle reasoning message chunks (removed - not needed for web analysis)
//           // Handle the assistant message chunk
//           if (data.assistant_message_chunk) {
//             accumulatedContent += data.assistant_message_chunk;

//             // Optional: You can dispatch events here to update UI with text direction
//             // if you want real-time text direction updates during streaming
//             if (accumulatedContent.length > 10) {
//               const textDirection = getTextDirection(accumulatedContent);
//               // You can dispatch this information if needed for real-time updates
//             }
//           }
//           // Store forms if available
//           if (data.forms) {
//             forms = data.forms;
//           }
//           // Handle calendar data if available
//           if (data.calendar_data) {
//             calendarData = data.calendar_data;
//           }
//           // Handle web analysis data if available
//           if (data.web_analysis_data) {
//             webAnalysisData = data.web_analysis_data;
//           }
//           if (data.doc_search_data) {
//             documentSearchData = data.doc_search_data as any;
//           }
//           if (data.document_search_data) {
//             documentSearchData = data.document_search_data;
//           }
//           // Handle session_id from backend (for new chats)
//           if (data.session_id) {
//             const currentSessionId = getSessionId();
//             if (!currentSessionId || currentSessionId !== data.session_id) {
//               setSessionIdValue(data.session_id);
//             }
//           }
//           // Handle chat_title from backend
//           if (data.chat_title) {
//           }
//         } catch (e) {
//           // Most parsing errors are due to incomplete JSON from chunk splits.
//           // Accumulate the line back into the buffer for the next iteration.
//           buffer = line + "\n" + buffer;
//         } finally {
//           setReplyClicked(false);
//           setReplyAllClicked(false);
//           setForwardClicked(false);
//         }
//       }
//     }
//   }

//   if (!accumulatedContent) {
//     throw new Error("No content received from API");
//   }

//   return {
//     id: (Date.now() + 1).toString(),
//     content: accumulatedContent.trim(),
//     type: "assistant" as const,
//     timestamp: new Date(),
//     mode: mode,
//     formFields: forms,
//     calendarData: calendarData,
//     webAnalysisData: webAnalysisData,
//     documentSearchData: documentSearchData,
//     ambiguousRecipients:
//       forms.length > 0 ? forms[1]?.ambiguousRecipients || [] : undefined,
//     // Add text direction information to the message
//     textDirection: getTextDirection(accumulatedContent.trim()),
//   } as Message;
// };

export const fetchUserMessages = async (
  sessionIdOverride?: string,
): Promise<Message[]> => {
  const sessionIdFromStore = getSessionId();
  const sessionId = sessionIdOverride ?? sessionIdFromStore;

  if (!sessionId) {
    return [];
  }

  try {
    const response = await fetch(
      `${API_CONFIG.LOCAL_API_BASE_URL}/session/list_message`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
        }), 
        credentials: "include",
      }
    );

    if (!response.ok) {
      // If session not found (404 or similar), clear local storage
      if (response.status === 404 || response.status === 400) {
        // Only clear global sessionId when we're using the stored value.
        if (!sessionIdOverride) {
          setSessionIdValue(null);
        }
        return [];
      }
      throw new Error(`Failed to fetch messages: ${response.status}`);
    }

    const data = unwrapEnvelope<{ messages?: unknown[] }>(await response.json());

    if (!Array.isArray(data.messages) || data.messages.length === 0) {
      return [];
    }

    // Non-empty history: transform to Message[]
    {
      // Transform backend messages to frontend Message format
      const transformedMessages = await Promise.all(
        data.messages.map(async (msg: any, index: number) => {
          // Check if message has forms and should show expired form
          const hasForms = msg.json_data?.forms || msg.formFields;
          const shouldShowExpiredForm = hasForms && !msg.isCurrentSession;

          // Handle document search data from multiple possible locations
          let documentSearchData =
            msg.documentSearchData ||
            msg.document_search_data ||
            msg.doc_search_data ||
            msg.json_data?.document_search_data ||
            msg.json_data?.doc_search_data;
          if (documentSearchData && typeof documentSearchData === "string") {
            try {
              documentSearchData = JSON.parse(documentSearchData);
            } catch (e) {
              documentSearchData = null;
            }
          }

          // Handle images from json_data
          let images = msg.images || msg.json_data?.images;
          if (images && typeof images === "string") {
            try {
              images = JSON.parse(images);
            } catch (e) {
              images = null;
            }
          }

          // Handle cards from json_data
          let cards = msg.cards || msg.json_data?.cards;
          if (cards && typeof cards === "string") {
            try {
              cards = JSON.parse(cards);
            } catch (e) {
              cards = null;
            }
          }

          // Handle package from json_data or root level (support both singular and plural)
          let packageData = msg.package || msg.json_data?.package;
          if (packageData && typeof packageData === "string") {
            try {
              packageData = JSON.parse(packageData);
            } catch (e) {
              packageData = null;
            }
          }

          // Handle packages array from json_data or root level
          let packagesData = msg.packages || msg.json_data?.packages;
          if (packagesData && typeof packagesData === "string") {
            try {
              packagesData = JSON.parse(packagesData);
            } catch (e) {
              packagesData = null;
            }
          }
          // Ensure packagesData is an array if it exists
          if (packagesData && !Array.isArray(packagesData)) {
            packagesData = null;
          }

          // Handle tool_calls from backend and transform to toolExecutions
          let toolExecutions = null;
          const toolCalls = msg.tool_calls || msg.json_data?.tool_calls;
          if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
            toolExecutions = toolCalls.map((toolCall: any, idx: number) => {
              // Map tool_call_status and tool_call_duration from backend
              // Default to "error" if no status is provided
              const toolStatus =
                toolCall.tool_call_status || toolCall.status || "error";
              const toolDuration =
                toolCall.tool_call_duration !== undefined
                  ? toolCall.tool_call_duration
                  : toolCall.duration;
              const toolName = toolCall.tool_name || "";
              const toolMessage = toolCall.tool_call_message || "";
              // Handle both tool_icon and icon_name from backend, prefer tool_icon
              const iconName = toolCall.tool_icon || toolCall.icon_name; // Extract icon name from backend

              return {
                ...(toolCall.tool_call_id && {
                  tool_call_id: toolCall.tool_call_id,
                }),
                tool_name: toolName,
                tool_call_message: toolMessage,
                ...(iconName && { icon_name: iconName }), // Include icon name if provided by backend
                timestamp: Date.now() - (toolCalls.length - idx) * 1000, // Stagger timestamps

                status: toolStatus as
                  | "running"
                  | "completed"
                  | "success"
                  | "error",
                ...(toolDuration !== undefined && { duration: toolDuration }),
              };
            });
          }

          // Transform file_paths into attachments
          let attachments = msg.attachments;
          if (
            msg.file_paths &&
            Array.isArray(msg.file_paths) &&
            msg.file_paths.length > 0
          ) {
            attachments = await Promise.all(
              msg.file_paths.map(async (filePath: string) => {
                const normalizedPath = middlewareFilePath(filePath);
                // Extract filename from path for display
                const fileName = normalizedPath.split("/").pop() || "image.png";
                const isImage = fileName
                  .toLowerCase()
                  .match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/);

                let imageUrl = fileUrl(filePath);
                if (isImage) {
                  imageUrl = await fetchImageWithToken(filePath);
                }

                return {
                  type: isImage ? "image/png" : "application/octet-stream",
                  content: isImage ? imageUrl : "",
                  name: fileName,
                  preview: isImage ? imageUrl : undefined,
                  static_path: normalizedPath,
                  original_filename: fileName,
                  mimetype: isImage ? "image/png" : "application/octet-stream",
                };
              })
            );
          }

          // Backwards-compatible support for Plotly dashboards stored on messages
          // loaded via list_message. Normalize any plotly_json_config payload into
          // json_data.dashboard_data so visualization components can consume it
          // consistently with streaming messages.
          let dashboardData =
            msg.dashboard_data || msg.json_data?.dashboard_data;
          if (!dashboardData) {
            const plotlyFromJsonData = msg.json_data?.plotly_json_config;
            const plotlyFromRoot = msg.plotly_json_config;
            if (plotlyFromJsonData || plotlyFromRoot) {
              const plotlyConfigArray =
                plotlyFromJsonData || plotlyFromRoot || [];
              dashboardData = {
                plotly_json_config: plotlyConfigArray,
                dashboard_metadata:
                  msg.json_data?.metadata ||
                  msg.json_data?.dashboard_metadata ||
                  msg.dashboard_metadata ||
                  {},
              };
            }
          }

          const normalizedJsonData = dashboardData
            ? {
                ...(msg.json_data || {}),
                dashboard_data: dashboardData,
              }
            : msg.json_data;

          let rawTimeline: MessageTimelineEntry[] | undefined;
          if (msg.message_timeline) {
            rawTimeline = msg.message_timeline;
          } else if (msg.json_data?.message_timeline) {
            rawTimeline = msg.json_data.message_timeline;
          } else if (msg.role !== "user") {
            const legacyTimeline: MessageTimelineEntry[] = [];
            if (msg.reasoning) {
              legacyTimeline.push({
                type: "reasoning",
                content: msg.reasoning,
                timestamp: msg.date || new Date().toISOString(),
              });
            }
            if (toolExecutions && toolExecutions.length > 0) {
              toolExecutions.forEach((te: any) => {
                legacyTimeline.push({
                  type: "tool_call",
                  tool_call_id: te.tool_call_id,
                  tool_name: te.tool_name,
                  tool_icon: te.icon_name,
                  content: te.tool_call_message,
                  status: te.status,
                  duration: te.duration,
                  timestamp: new Date(te.timestamp).toISOString(),
                });
              });
            }
            if (msg.content) {
              legacyTimeline.push({
                type: "assistant_message",
                content: msg.content,
                timestamp: msg.date || new Date().toISOString(),
              });
            }
            rawTimeline =
              legacyTimeline.length > 0 ? legacyTimeline : undefined;
          }

          const message_timeline = rawTimeline?.length
            ? consolidateMessageTimeline(rawTimeline, {
                inferMissingToolStatuses: true,
              })
            : undefined;

          const content =
            msg.content ||
            (message_timeline
              ? assistantContentFromTimeline(message_timeline)
              : "") ||
            "";

          return {
            id: msg.id || `${Date.now()}-${index}`,
            message_id: msg.message_id, // Preserve message_id
            content,
            type: msg.role === "user" ? "user" : "assistant",
            timestamp: msg.date ? new Date(msg.date) : new Date(),
            ...(msg.reasoning && { reasoningMessage: msg.reasoning }),
            ...(attachments && { attachments: attachments }),
            ...(msg.formFields && { formFields: msg.formFields }),
            ...(msg.mode && { mode: msg.mode }),
            ...(msg.emailContext && { emailContext: msg.emailContext }),
            ...(normalizedJsonData && { json_data: normalizedJsonData }),
            // Pass through root-level HTML payloads for iframe rendering
            ...(msg.html_data && { html_data: msg.html_data }),
            ...(msg.chat_title && { chat_title: msg.chat_title }),
            ...(documentSearchData && {
              documentSearchData: documentSearchData,
            }),
            ...(images && { images: images }),
            ...(cards && { cards: cards }),
            ...(packageData && { package: packageData }),
            ...(packagesData && { packages: packagesData }),
            ...(toolExecutions && { toolExecutions: toolExecutions }),
            ...(message_timeline && { message_timeline }),
            // Add flag to indicate if this is from recent chats (not current session)
            isFromRecentChats: true,
            // Add flag to show expired form
            showExpiredForm: shouldShowExpiredForm,
          };
        })
      );

      // Post-process messages to handle attachments:
      // 1. If assistant message has file_paths but no preceding user message, create a user message
      // 2. Move attachments from assistant to user message for messages with same message_id
      const finalMessages: any[] = [];
      
      transformedMessages.forEach((currentMsg: any) => {
        // Check if this is an assistant message with attachments
        if (
          currentMsg.type === "assistant" &&
          currentMsg.attachments &&
          currentMsg.attachments.length > 0
        ) {
          // Check if there's already a user message with the same message_id
          const hasUserMessage = finalMessages.some(
            (msg) =>
              msg.type === "user" && msg.message_id === currentMsg.message_id
          );
          
          if (!hasUserMessage) {
            // Create a user message for the image upload (user uploaded image without text)
            const userMessage: any = {
              id: `${currentMsg.id}-user`,
              message_id: currentMsg.message_id,
              content: "", // Empty content since user only uploaded image
              type: "user",
              timestamp: currentMsg.timestamp
                ? new Date(
                    currentMsg.timestamp instanceof Date
                      ? currentMsg.timestamp.getTime() - 1000
                      : new Date(currentMsg.timestamp).getTime() - 1000
                  )
                : new Date(Date.now() - 1000),
              attachments: [...currentMsg.attachments],
              isFromRecentChats: true,
            };
            finalMessages.push(userMessage);
            // Clear attachments from assistant message since we moved them to user message
            currentMsg.attachments = [];
          } else {
            // Handle normal case: move attachments from assistant to existing user message
            const userMsgIndex = finalMessages.findIndex(
              (msg) =>
                msg.type === "user" && msg.message_id === currentMsg.message_id
            );
            if (userMsgIndex !== -1) {
              const userMsg = finalMessages[userMsgIndex];
              if (!userMsg.attachments) {
                userMsg.attachments = [];
              }
              userMsg.attachments.push(...currentMsg.attachments);
              // Clear attachments from assistant message
              currentMsg.attachments = [];
            }
          }
        }
        
        finalMessages.push(currentMsg);
      });

      return finalMessages as Message[];
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Whether the backend still has an active Redis stream for this session.
 * Use when `list_message` is empty but generation may still be in progress.
 */
export const checkChatStreamStatus = async (
  sessionId: string
): Promise<boolean | null> => {
  if (!sessionId?.trim()) return null;
  try {
    const res = await fetch(
      `${API_CONFIG.LOCAL_API_BASE_URL}/chat/sessions/${encodeURIComponent(
        sessionId.trim()
      )}/status`,
      { method: "GET", credentials: "include" }
    );
    if (!res.ok) return null;
    const raw = await res.json().catch(() => null);
    if (!raw) return null;
    const json = unwrapEnvelope<{ streaming?: unknown }>(raw);
    if (typeof json.streaming !== "boolean") return null;
    return Boolean(json.streaming);
  } catch {
    return null;
  }
};

/** Filter sessions by persona type. "all" = no filter (backend may return all). */
export type SessionTypeFilter = "all" | "chat" | "dashboard";

export const fetchChatSessions = async (
  limit: number = 20,
  offset: number = 0,
  persona_id?: number,
  sessionType?: SessionTypeFilter
): Promise<{
  sessions: Array<{
    session_id: string;
    chat_title: string;
    user_id: string;
    is_pin?: boolean;
    updated_at?: string;
    created_at?: string;
    timestamp?: string;
    persona_id: number;
    persona_name?: string;
    type?: "chat" | "dashboard";
    last_source?: string;
  }>;
  hasMore: boolean;
  total: number;
}> => {
  try {
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString(),
    });

    // Filter by session/persona type; omit for "all" so backend can return all types
    if (sessionType === "chat" || sessionType === "dashboard") {
      params.set("type", sessionType);
    }

    // Add persona_id query parameter if provided
    if (persona_id !== undefined && persona_id !== null) {
      params.append("persona_id", persona_id.toString());
    }

    // Add cache-busting parameter if skipCache is true
    // if (skipCache) {
    //   params.append('t', Date.now().toString());
    // }

    const response = await fetch(
      `${API_CONFIG.LOCAL_API_BASE_URL}/session/list_chat_sessions?${params}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch chat sessions: ${response.status}`);
    }

    const data = unwrapEnvelope<{
      sessions?: Array<{
        session_id: string;
        chat_title: string;
        user_id: string;
        is_pin?: boolean;
        updated_at?: string;
        created_at?: string;
        timestamp?: string;
        persona_id: number;
        persona_name?: string;
        type?: "chat" | "dashboard";
      }>;
      count?: number;
      total?: number;
    }>(await response.json());

    if (Array.isArray(data.sessions)) {
      const sessions = data.sessions;
      const total = data.total ?? data.count ?? sessions.length;
      const hasMore = sessions.length === limit;
      return { sessions, hasMore, total };
    }

    return { sessions: [], hasMore: false, total: 0 };
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    throw error;
  }
};

export const fetchArchivedChatSessions = async (
  limit: number = 20,
  offset: number = 0,
  persona_id?: number
): Promise<{
  sessions: Array<{
    session_id: string;
    chat_title: string;
    is_archived: boolean;
    persona_id: number;
    persona_name?: string;
    type?: "chat" | "dashboard";
  }>;
  count: number;
  offset: number;
  limit: number;
}> => {
  try {
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString(),
    });

    if (persona_id !== undefined && persona_id !== null) {
      params.append("persona_id", persona_id.toString());
    }

    const response = await fetch(
      `${API_CONFIG.LOCAL_API_BASE_URL}/session/list_archived_chat_sessions?${params}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch archived chat sessions: ${response.status}`);
    }

    const data = unwrapEnvelope<{
      sessions?: Array<{
        session_id: string;
        chat_title: string;
        is_archived: boolean;
        persona_id: number;
        persona_name?: string;
        type?: "chat" | "dashboard";
      }>;
      count?: number;
      offset?: number;
      limit?: number;
    }>(await response.json());

    if (Array.isArray(data.sessions)) {
      return {
        sessions: data.sessions,
        count: data.count ?? data.sessions.length,
        offset: data.offset ?? offset,
        limit: data.limit ?? limit,
      };
    }

    return { sessions: [], count: 0, offset, limit };
  } catch (error) {
    console.error("Error fetching archived chat sessions:", error);
    throw error;
  }
};

// Validate if a session exists on the server
// Optionally accepts a sessions array to check first before making API calls
export const validateSession = async (
  sessionId: string,
  existingSessions?: Array<{ session_id: string }>
): Promise<boolean> => {
  try {
    // First check in existing sessions if provided
    if (
      existingSessions &&
      existingSessions.some((session) => session.session_id === sessionId)
    ) {
      return true;
    }

    const userId = getUserIdValue();
    if (!userId) return false;

    const pageSize = 50;
    let offset = 0;

    while (true) {
      const result = await fetchChatSessions(
        pageSize,
        offset
      );

      if (result.sessions.some((session) => session.session_id === sessionId)) {
        return true;
      }

      if (!result.hasMore) {
        break;
      }

      offset += pageSize;
    }

    return false;
  } catch (error) {
    return false;
  }
};

export const updateChatPin = async (
  sessionId: string,
  isPin: boolean
): Promise<void> => {
  const headers = await getHeaders();

  const response = await fetch(
    `${API_CONFIG.LOCAL_API_BASE_URL}/session/update_chat_session_pin`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        session_id: sessionId,
        is_pin: isPin,
      }),
      credentials: "include",
    }
  );

  if (!response.ok) await throwEnvelopeErrorFromResponse(response);
  unwrapEnvelope(await response.json(), { method: "POST" });
};

export const deleteChatSession = async (
  sessionId?: string
): Promise<void> => {
  const body = sessionId ? { session_id: sessionId } : { session_id: null };

  const response = await fetch(
    `${API_CONFIG.LOCAL_API_BASE_URL}/session/delete_chat_session`,
    {
      method: "POST",
      headers: {
        ...API_CONFIG.API_HEADERS,
        ...(await getHeaders()),
      },
      body: JSON.stringify(body),
      credentials: "include",
    }
  );

  if (!response.ok) await throwEnvelopeErrorFromResponse(response);
  unwrapEnvelope(await response.json(), { method: "POST" });
};

export const archiveChatSession = async (
  sessionId: string
): Promise<void> => {
  const response = await fetch(
    `${API_CONFIG.LOCAL_API_BASE_URL}/session/archive_chat_session`,
    {
      method: "POST",
      headers: {
        ...API_CONFIG.API_HEADERS,
        ...(await getHeaders()),
      },
      body: JSON.stringify({
        session_id: sessionId,
      }),
      credentials: "include",
    }
  );

  if (!response.ok) await throwEnvelopeErrorFromResponse(response);
  unwrapEnvelope(await response.json(), { method: "POST" });
};

export const unarchiveChatSession = async (
  sessionId: string
): Promise<void> => {
  const response = await fetch(
    `${API_CONFIG.LOCAL_API_BASE_URL}/session/unarchive_chat_session`,
    {
      method: "POST",
      headers: {
        ...API_CONFIG.API_HEADERS,
        ...(await getHeaders()),
      },
      body: JSON.stringify({
        session_id: sessionId,
      }),
      credentials: "include",
    }
  );

  if (!response.ok) await throwEnvelopeErrorFromResponse(response);
  unwrapEnvelope(await response.json(), { method: "POST" });
};

export const searchChats = async (
  query: string,
  limit: number = 10,
  personaIds?: number[] | null
): Promise<{
  results: Array<{
    session_id: string;
    chat_title: string;
    preview_text: string;
    match_type: "title" | "message" | "assistant";
    rank: number;
    created_at: string;
    persona_id?: number;
  }>;
  count: number;
  query: string;
}> => {
  try {
    const params = new URLSearchParams({
      query: query.trim(),
      limit: limit.toString(),
    });

    // Persona filtering:
    // - No personaIds or empty array  => search across all personas (no filter params)
    // - One id                       => send persona_id
    // - Multiple ids                 => send persona_ids as comma-separated list
    if (Array.isArray(personaIds) && personaIds.length > 0) {
      const uniqueIds = Array.from(new Set(personaIds));
      if (uniqueIds.length === 1) {
        params.append("persona_id", uniqueIds[0]!.toString());
      } else {
        params.append(
          "persona_ids",
          uniqueIds.map((id) => id.toString()).join(","),
        );
      }
    }

    const response = await fetch(
      `${API_CONFIG.LOCAL_API_BASE_URL}/chat/search?${params}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to search chats: ${response.status}`);
    }

    const data = unwrapEnvelope<{
      results: Array<{
        session_id: string;
        chat_title: string;
        preview_text: string;
        match_type: "title" | "message" | "assistant";
        rank: number;
        created_at: string;
        persona_id?: number;
      }>;
      count: number;
      query: string;
    }>(await response.json());
    return data;
  } catch (error) {
    console.error("Error searching chats:", error);
    throw error;
  }
};

export const fetchImageWithToken = async (
  filePath: string,
): Promise<string> => {
  try {
    const headers = await getHeaders();
    const url = fileUrl(filePath);
    const response = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    return filePath;
  }
};

