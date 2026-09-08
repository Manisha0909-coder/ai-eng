import React, { useCallback, useState } from "react";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import AssistantMessage from "./AssistantMessage";
import LoadingMessage from "./LoadingMessage";
import { MarkdownComponents } from "./MarkdownRenderer";
import ShareDialog from "./ShareDialog";
import UserMessage from "./UserMessage";
import { chatSanitizeSchema, rehypeStripBreakNewlines } from "./utils";
import type { ChatMessageProps } from "./types";

// Memoized ChatMessage component
const ChatMessage: React.FC<ChatMessageProps> = React.memo(
  ({
    message,
    onEditMessage,
    isLoading,
    isSpeaking,
    isLoadingTTS,
    isReadOnly = false,
    disableEditUntilResponseComplete = false,
    onRetry,
    onAllFormsSubmitted,
  }) => {
    const [isShareOpen, setIsShareOpen] = useState(false);

    const isChatShare = location.pathname.includes("chat_share");

    const handleShareOpen = useCallback(() => {
      setIsShareOpen(true);
    }, []);

    // Loading branch needs markdown props for LoadingMessage timeline rendering.
    // Mirrors the props shape used inside AssistantMessage so timelines look identical
    // whether or not the message is still loading.
    const loadingMarkdownProps: any = React.useMemo(
      () => ({
        remarkPlugins: [remarkGfm],
        rehypePlugins: (message.isStreaming
          ? [
              rehypeRaw,
              [rehypeSanitize, chatSanitizeSchema],
              rehypeStripBreakNewlines,
            ]
          : [
              rehypeRaw,
              [rehypeSanitize, chatSanitizeSchema],
              rehypeStripBreakNewlines,
              rehypeHighlight,
            ]) as any,
        components: MarkdownComponents,
        skipHtml: false,
      }),
      [message.isStreaming],
    );

    if (isLoading) {
      return (
        <>
          <LoadingMessage
            message={message}
            markdownProps={loadingMarkdownProps}
          />
          <ShareDialog
            open={isShareOpen}
            onOpenChange={setIsShareOpen}
            variant="simple"
          />
        </>
      );
    }

    if (message.type === "user") {
      return (
        <>
          <UserMessage
            message={message}
            onEditMessage={onEditMessage}
            isReadOnly={isReadOnly}
            disableEditUntilResponseComplete={disableEditUntilResponseComplete}
            isChatShare={isChatShare}
          />
          <ShareDialog
            open={isShareOpen}
            onOpenChange={setIsShareOpen}
            variant="simple"
          />
        </>
      );
    }

    return (
      <>
        <AssistantMessage
          message={message}
          isSpeaking={isSpeaking}
          isLoadingTTS={isLoadingTTS}
          isReadOnly={isReadOnly}
          isChatShare={isChatShare}
          onRetry={onRetry}
          onAllFormsSubmitted={onAllFormsSubmitted}
          onShareOpen={handleShareOpen}
        />
        <ShareDialog
          open={isShareOpen}
          onOpenChange={setIsShareOpen}
          variant="full"
        />
      </>
    );
  },
);

ChatMessage.displayName = "ChatMessage";

export { ChatMessage };
