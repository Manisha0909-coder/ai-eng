import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import React from "react";

interface ThinkingDotsProps {
  className?: string;
}

export const ThinkingDots: React.FC<ThinkingDotsProps> = ({ className }) => (
  <div className={cn("flex items-center gap-1", className)}>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="thinking-dot inline-block h-2 w-2 rounded-full bg-primary"
      />
    ))}
  </div>
);

interface StreamingStatusBubbleProps {
  className?: string;
}

export const StreamingStatusBubble: React.FC<StreamingStatusBubbleProps> = ({
  className,
}) => (
  <motion.div
    className={cn(
      "flex w-fit items-center gap-3 rounded-2xl rounded-tl-sm border border-border-main bg-surface px-4 py-3.5",
      className,
    )}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.2 }}
  >
    <ThinkingDots />
    <span className="text-sm text-text-muted">Generating response…</span>
  </motion.div>
);
