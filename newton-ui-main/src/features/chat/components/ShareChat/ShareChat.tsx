import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { AlertCircle, Loader2, Moon, Sun } from "lucide-react";
import { Message } from "@/types/message";
import { ChatMessage } from "@/features/chat/components/ChatMessage/ChatMessage";
import {
  COLOR_SCHEME_CHANGED,
  isDarkMode,
  toggleDarkMode,
} from "@/utils/theme";
import notify from "@/utils/notify";
import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope } from "@/services/api/envelope";
import {
  assignAttachmentsToUserMessages,
  filePathsToAttachments,
} from "@/services/chat/attachmentUtils";
import {
  assistantContentFromTimeline,
  consolidateMessageTimeline,
} from "@/services/chat/timelineUtils";
import { IconButton } from "@/components/ui/icon-button";
import { NewtonMark } from "@/components/branding/NewtonLogo";
import { useStore } from "@/store/useStore";

interface SharedChatData {
  chat_title: string;
  messages: Message[];
  shared_by?: string | null;
}

function formatSharedBy(userId?: string | null): string | null {
  if (!userId?.trim()) return null;
  const raw = userId.trim();
  const local = raw.includes("@") ? raw.split("@")[0] : raw;
  const display = local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return display || raw;
}

function extractChatTitle(data: Record<string, unknown>, messages: any[]): string {
  if (typeof data.chat_title === "string" && data.chat_title.trim()) {
    return data.chat_title.trim();
  }
  for (const msg of messages) {
    if (typeof msg?.chat_title === "string" && msg.chat_title.trim()) {
      return msg.chat_title.trim();
    }
  }
  return "Shared chat";
}

const ShareChat: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [chatData, setChatData] = useState<SharedChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => isDarkMode());

  useEffect(() => {
    const handler = () => setIsDark(isDarkMode());
    window.addEventListener(COLOR_SCHEME_CHANGED, handler);
    return () => window.removeEventListener(COLOR_SCHEME_CHANGED, handler);
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useStore();
  const isPublicShare = location.pathname.includes("public");

  useEffect(() => {
    if (!isPublicShare && !isAuthenticated) {
      navigate("/login", {
        state: { returnUrl: location.pathname },
        replace: true,
      });
    }
  }, [isPublicShare, isAuthenticated, navigate, location.pathname]);

  useEffect(() => {
    const fetchSharedChat = async () => {
      if (!isPublicShare && !isAuthenticated) {
        setLoading(false);
        return;
      }

      if (!id) {
        setError("not-found");
        setLoading(false);
        return;
      }

      try {
        const apiBase = API_CONFIG.LOCAL_API_BASE_URL.replace(/\/$/, "");
        const url = isPublicShare
          ? `${apiBase}/chat_share/${id}/public`
          : `${apiBase}/chat_share/${id}`;
        const response = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (!response.ok) {
          if (
            !isPublicShare &&
            (response.status === 401 || response.status === 403)
          ) {
            navigate("/login", {
              state: { returnUrl: location.pathname },
              replace: true,
            });
            setLoading(false);
            return;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = unwrapEnvelope<Record<string, any>>(await response.json());
        const conversationMessages = data?.conversation?.conversation;
        const sharedBy = formatSharedBy(
          typeof data?.user_id === "string" ? data.user_id : null,
        );

        if (Array.isArray(conversationMessages)) {
          const validMessages = conversationMessages.map((msg, index) => {
            const docSearchData = msg.json_data?.doc_search_data || {};

            let toolExecutions = msg.toolExecutions || msg.tool_executions || [];
            if (toolExecutions && typeof toolExecutions === "string") {
              try {
                toolExecutions = JSON.parse(toolExecutions);
              } catch {
                toolExecutions = [];
              }
            }

            let timeline: any[] = [];
            if (msg.message_timeline) {
              timeline = msg.message_timeline;
            } else if (msg.json_data?.message_timeline) {
              timeline = msg.json_data.message_timeline;
            } else if (msg.role !== "user") {
              if (msg.reasoning) {
                timeline.push({
                  type: "reasoning",
                  content: msg.reasoning,
                  timestamp: msg.date || new Date().toISOString(),
                });
              }
              if (toolExecutions && toolExecutions.length > 0) {
                toolExecutions.forEach((te: any) => {
                  timeline.push({
                    type: "tool_call",
                    tool_call_id: te.tool_call_id || te.tool_call_id,
                    tool_name: te.tool_name,
                    tool_icon: te.icon_name,
                    content: te.tool_call_message || te.content,
                    status: te.status,
                    duration: te.duration,
                    timestamp: te.timestamp
                      ? new Date(te.timestamp).toISOString()
                      : new Date().toISOString(),
                  });
                });
              }
              if (
                msg.content &&
                !timeline.some((entry) => entry.type === "assistant_message")
              ) {
                timeline.push({
                  type: "assistant_message",
                  content: msg.content,
                  timestamp: msg.date || new Date().toISOString(),
                });
              }
            }

            const processedTimeline = consolidateMessageTimeline(timeline, {
              inferMissingToolStatuses: true,
            });

            const finalContent =
              msg.content ||
              assistantContentFromTimeline(processedTimeline) ||
              "";

            const rawForms =
              msg.json_data?.forms ??
              (msg as { formFields?: unknown }).formFields ??
              (msg as { forms?: unknown }).forms;
            const formFieldsList = Array.isArray(rawForms) ? rawForms : [];

            const filePaths = Array.isArray(msg.file_paths) ? msg.file_paths : [];
            const attachments =
              filePaths.length > 0
                ? filePathsToAttachments(filePaths)
                : undefined;

            return {
              id: msg.message_id || `msg-${index}`,
              message_id: msg.message_id || `msg-${index}`,
              content: finalContent,
              type: msg.role || "assistant",
              timestamp: msg.date ? new Date(msg.date) : new Date(),
              reasoningMessage: msg.reasoning || "",
              originalMessage: msg,
              formFields: formFieldsList,
              html_data:
                (msg as { html_data?: unknown }).html_data ??
                msg.json_data?.html_data,
              calendarData: msg.json_data?.calendar_data,
              json_data: {
                session_id: msg.json_data?.session_id || null,
                cards: msg.json_data?.cards || [],
                doc_search_data: {
                  analysis: docSearchData.analysis || "",
                  document_search_data:
                    docSearchData.document_search_data || [],
                },
                ...(msg.json_data?.forms != null
                  ? { forms: msg.json_data.forms }
                  : {}),
                ...(msg.json_data?.html_data != null
                  ? { html_data: msg.json_data.html_data }
                  : {}),
                ...(msg.json_data?.calendar_data != null
                  ? { calendar_data: msg.json_data.calendar_data }
                  : {}),
              },
              ...(attachments && { attachments }),
              documentSearchData: {
                analysis: docSearchData.analysis || "",
                document_search_data: docSearchData.document_search_data || [],
              },
              cards: msg.json_data?.cards || [],
              session_id: msg.json_data?.session_id || null,
              message_timeline:
                processedTimeline.length > 0 ? processedTimeline : undefined,
              toolExecutions:
                toolExecutions.length > 0 ? toolExecutions : undefined,
              isFromRecentChats: true,
            };
          });

          setChatData({
            chat_title: extractChatTitle(data, conversationMessages),
            messages: assignAttachmentsToUserMessages(validMessages),
            shared_by: sharedBy,
          });
        } else {
          console.warn(
            "Expected conversationMessages to be an array, but got:",
            conversationMessages,
          );
          setChatData({
            chat_title: extractChatTitle(data, []),
            messages: [],
            shared_by: sharedBy,
          });
        }
      } catch (err) {
        console.error("Error fetching shared chat:", err);
        setError("not-found");
        notify.error("Failed to load shared chat.");
      } finally {
        setLoading(false);
      }
    };

    fetchSharedChat();
  }, [id, isPublicShare, isAuthenticated, navigate, location.pathname]);

  const handleToggleTheme = () => {
    try {
      toggleDarkMode();
      setIsDark(isDarkMode());
    } catch (e) {
      console.warn("Theme toggle failed", e);
    }
  };

  const title = chatData?.chat_title || "Shared chat";

  return (
    <div className="flex flex-col h-screen bg-background text-text-main antialiased">
      <div className="spectrum-rule shrink-0" />

      <header className="relative flex h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] shrink-0 items-center border-b border-border-main bg-surface/80 px-4 backdrop-blur-md">
        <div className="flex-1" />
        <div className="absolute left-1/2 flex max-w-[min(100%,28rem)] -translate-x-1/2 items-center gap-2 px-10">
          <NewtonMark size={18} className="shrink-0" />
          <h1 className="truncate font-display text-base font-semibold">
            {loading ? "Shared chat" : title}
          </h1>
        </div>
        <div className="flex flex-1 justify-end">
          <IconButton
            aria-label="Toggle theme"
            size="sm"
            shape="square"
            variant="ghost"
            className="text-text-muted hover:bg-surface-2 hover:text-text-main"
            onClick={handleToggleTheme}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>
        </div>
      </header>

      {!loading && !error && chatData?.shared_by && (
        <div className="shrink-0 border-b border-border-main bg-surface/50 py-3 text-center">
          <p className="font-mono text-2xs uppercase tracking-wider text-text-muted">
            Shared by {chatData.shared_by}
          </p>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-4 py-8 scrollbar-themed">
        <div className="mx-auto max-w-xl space-y-6">
          {loading && (
            <div className="flex items-center justify-center gap-2.5 py-8 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading shared chat…
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <AlertCircle
                size={28}
                strokeWidth={1.5}
                className="text-text-muted"
                aria-hidden="true"
              />
              <p className="text-sm font-medium">
                This link has expired or doesn&apos;t exist.
              </p>
              <p className="text-xs text-text-muted">
                Ask the owner to reshare this conversation.
              </p>
            </div>
          )}

          {!loading && !error && chatData?.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <p className="text-sm font-medium">No messages in this chat.</p>
              <p className="text-xs text-text-muted">
                This shared conversation is empty.
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            chatData?.messages.map((message: Message) => (
              <ChatMessage
                key={message.id}
                message={message}
                formFields={
                  Array.isArray(message.formFields) ? message.formFields : []
                }
                onEditMessage={() => {}}
                isLoading={false}
                isReadOnly
              />
            ))}
        </div>
      </main>

      {isAuthenticated && !loading && !error && (
        <div className="flex shrink-0 justify-center border-t border-border-main bg-surface/80 px-4 py-4 backdrop-blur-md">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-lift transition-opacity hover:opacity-90"
          >
            <NewtonMark size={15} tone="current" />
            Back to Newton
          </button>
        </div>
      )}
    </div>
  );
};

export default ShareChat;
