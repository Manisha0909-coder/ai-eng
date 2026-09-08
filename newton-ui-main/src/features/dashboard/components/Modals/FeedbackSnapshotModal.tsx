import { useEffect, useRef, useState } from "react";
import { X, AlertCircle, CheckCircle } from "lucide-react";
import { fetchFeedbackSnapshots, SnapshotMessage } from "@/services/rbac/feedbackApi";
import { Message } from "@/types/message";
import { ChatMessage } from "@/features/chat/components/ChatMessage/ChatMessage";
import { DashboardLoader } from "@/components/ContentLoader";

interface FeedbackSnapshotModalProps {
  feedbackId: number;
  highlightMessageId: string;
  isOpen: boolean;
  onClose: () => void;
  isResolved?: boolean;
  onResolve?: () => void;
}

/**
 * Transform snapshot messages from backend format to UI Message format
 */
function snapshotToMessages(
  snapshots: SnapshotMessage[],
  highlightMessageId: string
): Message[] {
  return snapshots.map((snapshot) => {
    // Extract content from message_timeline if available (for assistant messages)
    let content = snapshot.content || "";
    if (!content && snapshot.message_timeline) {
      // Find the last assistant_message entry in timeline
      const assistantMessage = snapshot.message_timeline
        .filter((entry: any) => entry.type === "assistant_message")
        .pop();
      if (assistantMessage?.content) {
        content = assistantMessage.content;
      }
    }

    const message: Message = {
      id: snapshot.message_id,
      content: content,
      type: snapshot.role === "user" ? "user" : "assistant",
      timestamp: new Date(snapshot.date),
      role: snapshot.role,
      date: snapshot.date,
      message_id: snapshot.message_id,
      // Add highlight flag
      isHighlighted: snapshot.message_id === highlightMessageId,
    };

    // Handle message_timeline (interleaved timeline support)
    if (snapshot.message_timeline && Array.isArray(snapshot.message_timeline)) {
      message.message_timeline = snapshot.message_timeline;
    }

    // Handle json_data fields
    if (snapshot.json_data) {
      // Cards
      if (snapshot.json_data.cards) {
        message.cards = snapshot.json_data.cards;
      }

      // Chart data
      // if (snapshot.json_data.chart_data) {
      //   message.chartData = {
      //     type: snapshot.json_data.chart_data.data?.[0]?.type || "bar",
      //     data: snapshot.json_data.chart_data.data || [],
      //     title: snapshot.json_data.chart_data.layout?.title?.text || "",
      //     xAxis: snapshot.json_data.chart_data.layout?.xaxis?.title?.text,
      //     yAxis: snapshot.json_data.chart_data.layout?.yaxis?.title?.text,
      //   };

      //   message.apiChartData = {
      //     chart_data: {
      //       data: snapshot.json_data.chart_data.data || [],
      //       layout: snapshot.json_data.chart_data.layout || {},
      //       template: snapshot.json_data.chart_data.layout?.template,
      //     },
      //   };
      // }

      // Forms
      if (snapshot.json_data.forms) {
        message.formFields = snapshot.json_data.forms;
      }

      // Calendar data
      if (snapshot.json_data.calendar_data) {
        message.calendarData = snapshot.json_data.calendar_data;
      }

      // HTML data
      if (snapshot.json_data.html_data) {
        message.html_data = snapshot.json_data.html_data;
      }

      // Travel packages (support both singular and plural)
      if (snapshot.json_data.package) {
        message.package = snapshot.json_data.package;
      }
      if (snapshot.json_data.packages && Array.isArray(snapshot.json_data.packages)) {
        message.packages = snapshot.json_data.packages;
      }
    }

    return message;
  });
}

export default function FeedbackSnapshotModal({
  feedbackId,
  highlightMessageId,
  isOpen,
  onClose,
  isResolved = false,
  onResolve,
}: FeedbackSnapshotModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !feedbackId  || hasFetchedRef.current) return;

    const loadSnapshots = async () => {
      setIsLoading(true);
      setError(null);
      hasFetchedRef.current = true;
      try {
        const response = await fetchFeedbackSnapshots(feedbackId);
        
        if (response.snapshots && response.snapshots.length > 0) {
          const snapshot = response.snapshots[0]; // Take the first (most recent) snapshot
          const transformedMessages = snapshotToMessages(
            snapshot.chat_history_snapshot,
            highlightMessageId
          );
          setMessages(transformedMessages);
        } else {
          setError("No chat history found for this feedback.");
        }
      } catch (err) {
        console.error("Error fetching snapshots:", err);
        setError("Failed to load chat history. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadSnapshots();
  }, [isOpen, feedbackId, highlightMessageId]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      hasFetchedRef.current = false;
      setMessages([]);
    }
  }, [isOpen]);
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => {
        // Close when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-background rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-main bg-background">
          <h2 className="text-xl font-semibold text-text-main">
            Chat History Snapshot
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full">
              <DashboardLoader size="md"/>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertCircle className="w-12 h-12 text-destructive mb-3" />
              <p className="text-lg font-medium text-text-main mb-2">
                {error}
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          )}

          {!isLoading && !error && messages.length > 0 && (
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  formFields={message.formFields || []}
                  isLoading={false}
                  isReadOnly={true}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-main bg-background">
          <div className="flex items-center justify-between text-sm text-text-muted">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-status-error" />
              <span>Highlighted message = feedback source</span>
            </div>
            <div className="flex items-center gap-2">
              {!isResolved && onResolve && (
                <button
                  onClick={onResolve}
                  className="px-4 py-2 bg-surface text-text-main rounded hover:bg-surface flex items-center gap-2 transition-colors border border-border-main"
                >
                  <CheckCircle className="w-5 h-5 text-status-success" />
                  Mark as Resolved
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

