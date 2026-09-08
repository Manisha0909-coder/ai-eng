import React, { useState } from "react";
import { motion } from "framer-motion";
import { SHOW_REASONING } from "@/env";
import ToolExecution from "@/features/tools/components/ToolExecution/ToolExecution";
import { TruncatedReasoning } from "./ReasoningBlock";

const NewtonProcessBlock: React.FC<{
  entries: any[];
  reasoningMarkdownProps: any;
  defaultOpen?: boolean;
}> = ({
  entries,
  reasoningMarkdownProps,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Filter entries based on SHOW_REASONING
  const visibleEntries = entries.filter((entry) => {
    if (entry.type === "reasoning") return SHOW_REASONING;
    return true;
  });

  if (!visibleEntries || visibleEntries.length === 0) return null;

  return (
    <motion.div
      className="mb-2 mt-1 rounded-lg text-xs overflow-hidden bg-primary/10 border border-primary/20"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 py-1.5 px-3 text-sm rounded-t transition-colors w-full text-left text-primary hover:text-primary/80"
      >
        <svg
          className="w-4 h-4 transition-transform duration-300 text-primary"
          style={{
            transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
        <span className="font-medium text-primary">
          {isOpen
            ? SHOW_REASONING
              ? "Hide Thoughts & Tools"
              : "Hide Tool Calls"
            : SHOW_REASONING
              ? "Show Thoughts & Tools"
              : "Show Tool Calls"}
        </span>
      </button>
      <div
        style={{
          maxHeight: isOpen ? "500px" : "0px",
          opacity: isOpen ? 1 : 0,
          transition: "max-height 0.4s ease-out, opacity 0.3s ease-out",
          contain: "layout",
          overflowY: isOpen ? "auto" : "hidden",
        }}
        className="scrollbar-hide bg-primary/5"
      >
        <div className="p-3">
          <div className="flex flex-col gap-4">
            {visibleEntries.map((entry, idx) => {
              if (entry.type === "reasoning") {
                return (
                  <div
                    key={`reasoning-${idx}`}
                    className="opacity-90 border-l-2 border-primary/20 pl-3"
                  >
                    <TruncatedReasoning
                      content={entry.content}
                      reasoningMarkdownProps={reasoningMarkdownProps}
                    />
                  </div>
                );
              }
              if (entry.type === "tool_call") {
                return (
                  <ToolExecution
                    key={`tool-${idx}`}
                    toolName={entry.tool_name}
                    toolCallMessage={entry.content || entry.tool_call_message}
                    iconName={entry.tool_icon || entry.icon_name}
                    status={entry.status}
                    duration={entry.duration}
                    isLastItem={idx === visibleEntries.length - 1}
                  />
                );
              }
              return null;
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default NewtonProcessBlock;
