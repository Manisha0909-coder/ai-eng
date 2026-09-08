import { Brain, ChevronDown, ChevronUp } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { SHOW_REASONING } from "@/env";

// Sub-component for rendering truncated reasoning content
export const TruncatedReasoning: React.FC<{
  content: string;
  reasoningMarkdownProps: any;
}> = ({ content, reasoningMarkdownProps }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && !isExpanded) {
      const hasOverflow =
        contentRef.current.scrollHeight > contentRef.current.clientHeight;
      setIsTruncated(hasOverflow);
    }
  }, [content, isExpanded]);

  return (
    <div className="flex flex-col">
      <div
        ref={contentRef}
        className={`reasoning-markdown text-xs leading-relaxed text-text-main ${
          !isExpanded ? "line-clamp-3" : ""
        }`}
        style={{
          display: !isExpanded ? "-webkit-box" : "block",
          WebkitLineClamp: !isExpanded ? 3 : "unset",
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        <ReactMarkdown {...reasoningMarkdownProps}>{content}</ReactMarkdown>
      </div>
      {(isTruncated || isExpanded) && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-1 text-primary hover:opacity-80 transition-opacity text-2xs font-medium w-fit flex items-center gap-0.5"
        >
          {isExpanded ? (
            <>
              less <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              see more <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
};

// Sub-component for rendering interleaved reasoning (thoughts) with independent expansion
const ReasoningBlock: React.FC<{
  content: string;
  reasoningMarkdownProps: any;
  defaultOpen?: boolean;
}> = ({ content, reasoningMarkdownProps }) => {
  // Early return if reasoning is disabled
  if (!SHOW_REASONING) {
    return null;
  }

  return (
    <motion.div
      className="mb-2 mt-1 rounded-lg text-xs overflow-hidden bg-primary/10 border border-primary/20"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-2 opacity-80">
          <Brain className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium uppercase tracking-wider text-2xs text-primary">
            Newton Thoughts
          </span>
        </div>
        <TruncatedReasoning
          content={content}
          reasoningMarkdownProps={reasoningMarkdownProps}
        />
      </div>
    </motion.div>
  );
};

export default ReasoningBlock;
