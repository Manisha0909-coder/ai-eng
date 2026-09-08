import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { NewtonAvatar } from "@/components/branding/NewtonLogo";
import { SHOW_REASONING } from "@/env";
import { MarkdownComponents } from "./MarkdownRenderer";
import { assistantHasRenderableBody, groupTimelineEntries } from "./utils";
import ReasoningBlock from "./ReasoningBlock";
import NewtonProcessBlock from "./NewtonProcessBlock";
import { StreamingStatusBubble, ThinkingDots } from "./ThinkingDots";
import type { LoadingMessageProps } from "./types";

const LoadingMessage: React.FC<LoadingMessageProps> = ({
  message,
  markdownProps,
}) => {
  const [loadingStartTime] = useState(Date.now());
  const [, setElapsedTime] = useState(0);
  const [, setToolsExpanded] = useState(true);

  // Tool execution state management
  const allToolsComplete = useMemo(() => {
    return (
      message?.toolExecutions?.every(
        (te) =>
          te.status === "success" ||
          te.status === "error" ||
          te.status === "completed",
      ) ?? false
    );
  }, [message?.toolExecutions]);

  const hasRunningTools = useMemo(() => {
    return (
      message?.toolExecutions?.some((te) => te.status === "running") ?? false
    );
  }, [message?.toolExecutions]);

  // Update elapsed time every second during loading
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - loadingStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [loadingStartTime]);

  // Auto-expand when tools are running, auto-collapse when all complete
  useEffect(() => {
    if (hasRunningTools) {
      setToolsExpanded(true);
    } else if (
      allToolsComplete &&
      message?.toolExecutions &&
      message.toolExecutions.length > 0
    ) {
      // Auto-collapse after a delay when all tools complete
      const timer = setTimeout(() => {
        setToolsExpanded(false);
      }, 2000); // Wait 2 seconds after completion
      return () => clearTimeout(timer);
    }
  }, [hasRunningTools, allToolsComplete, message?.toolExecutions]);

  const hasRenderableBody = assistantHasRenderableBody(message);
  // Hide dots once assistant text exists; keep `!== false` so placeholders without
  // an explicit isStreaming flag (e.g. bottom loading-message) still animate.
  const showTimelineDots =
    message?.isStreaming !== false && !hasRenderableBody;
  const showEmptyContentDots =
    showTimelineDots && !message?.message_timeline?.length;

  // Reasoning markdown props for consistency
  const reasoningMarkdownProps = useMemo(
    () => ({
      ...markdownProps,
      components: {
        ...MarkdownComponents,
        p: ({ children }: { children: React.ReactNode }) => (
          <p className="mb-1 last:mb-0">{children}</p>
        ),
      },
    }),
    [markdownProps],
  );

  return (
    <div className="flex justify-start group relative" dir="ltr">
      <div className="flex items-start gap-2 my-3 max-w-[100%]">
        {/* <div className="pt-[7px]">
          <motion.img
            src={currentTheme.assets.botLogo || botLogo}
            alt="Bot"
            className={`text-white transform h-[${currentTheme.assets.botLogoHeight}px] w-[${currentTheme.assets.botLogoWidth}px] transition-all duration-300 rounded-full object-cover`}
            animate={{
              scale: [1.10, 1.05, 1],
              opacity: [1, 0.8, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div> */}
        <NewtonAvatar className="mt-0.5" />

        <div className="flex-1 relative">
          {message.message_timeline && message.message_timeline.length > 0 ? (
            <div
              className={`w-fit text-text-main text-base user-message group`}
            >
              <div className="flex flex-col gap-3">
                {groupTimelineEntries(message.message_timeline).map(
                  (entry, idx) => {
                    if (entry.type === "reasoning") {
                      // This case might not be hit if all reasoning is grouped,
                      // but we keep it for robustness if grouping logic changes
                      return SHOW_REASONING ? (
                        <ReasoningBlock
                          key={`loading-reasoning-${idx}`}
                          content={entry.content}
                          reasoningMarkdownProps={reasoningMarkdownProps}
                          defaultOpen={idx === 0} // Open first one by default
                        />
                      ) : null;
                    }
                    if (entry.type === "process_group") {
                      return (
                        <NewtonProcessBlock
                          key={`loading-process-group-${idx}`}
                          entries={entry.entries}
                          reasoningMarkdownProps={reasoningMarkdownProps}
                          defaultOpen={false}
                        />
                      );
                    }
                    if (entry.type === "assistant_message") {
                      return (
                        <div
                          key={`loading-assistant-${idx}`}
                          className="markdown-content-wrapper text-text-main bg-background rounded-xl"
                          dir="auto"
                          style={{
                            padding: "8px 12px",
                          }}
                        >
                          <ReactMarkdown
                            {...markdownProps}
                            className="markdown-content"
                          >
                            {entry.content}
                          </ReactMarkdown>
                        </div>
                      );
                    }
                    return null;
                  },
                )}
                {showTimelineDots && (
                  <ThinkingDots className="mt-1 px-1" />
                )}
              </div>
            </div>
          ) : showEmptyContentDots ? (
            <div className="flex flex-col gap-3">
              {((SHOW_REASONING && message?.reasoningMessage) ||
                (message?.toolExecutions &&
                  message.toolExecutions.length > 0)) && (
                <NewtonProcessBlock
                  entries={[
                    ...(SHOW_REASONING && message?.reasoningMessage
                      ? [
                          {
                            type: "reasoning",
                            content: message.reasoningMessage,
                          },
                        ]
                      : []),
                    ...(message?.toolExecutions || []).map((te) => ({
                      ...te,
                      type: "tool_call",
                    })),
                  ]}
                  reasoningMarkdownProps={reasoningMarkdownProps}
                  defaultOpen={true}
                />
              )}
              <StreamingStatusBubble />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {((SHOW_REASONING && message?.reasoningMessage) ||
                (message?.toolExecutions &&
                  message.toolExecutions.length > 0)) && (
                <NewtonProcessBlock
                  entries={[
                    ...(SHOW_REASONING && message?.reasoningMessage
                      ? [
                          {
                            type: "reasoning",
                            content: message.reasoningMessage,
                          },
                        ]
                      : []),
                    ...(message?.toolExecutions || []).map((te) => ({
                      ...te,
                      type: "tool_call",
                    })),
                  ]}
                  reasoningMarkdownProps={reasoningMarkdownProps}
                  defaultOpen={true}
                />
              )}
              {message?.content ? (
                <div
                  dir="auto"
                  className="user-message w-fit rounded-2xl p-1 text-base text-text-main"
                  style={{
                    contain: "layout style",
                    backgroundColor: "var(--color-background)",
                  }}
                >
                  <div className="markdown-content max-w-none">
                    <div className="relative">
                      <div className="assistant-content">
                        <div className="whitespace-pre-wrap break-words text-base leading-relaxed text-text-main">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoadingMessage;
