import React from "react";
import { motion } from "framer-motion";
import { FaCheck } from "react-icons/fa6";
import { MdError } from "react-icons/md";
import { getIconByName, Settings } from "@/utils/iconRegistry";

interface ToolExecutionProps {
  toolName: string;
  toolCallMessage: string;
  iconName?: string; // Optional: Backend can send specific icon name
  duration?: number;
  status?: "running" | "completed" | "success" | "error";
  isAnimated?: boolean;
  isLastItem?: boolean;
}

export const ToolExecution: React.FC<ToolExecutionProps> = ({
  toolName,
  iconName,
  duration,
  status = "running",
  isAnimated = true,
  isLastItem = false,
}) => {
  // Use backend-provided icon name only, fallback to Settings if not provided
  const ToolIcon = iconName ? getIconByName(iconName) : Settings;

  // Format duration (tool_call_duration is in seconds as a float)
  const formatDuration = (seconds?: number): string => {
    if (!seconds && seconds !== 0) return "";
    // Handle very small durations (less than 1 second) - show with decimal
    if (seconds < 1) {
      return `${(seconds * 1000).toFixed(0)}ms`;
    }
    // Handle seconds
    if (seconds < 60) {
      return `${seconds.toFixed(2)}s`;
    }
    // Handle minutes
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(1);
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Determine if status is success or error
  const isSuccess = status === "success";
  const isError = status === "error";

  const cardVariants = {
    hidden: { opacity: 0, x: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 30,
        duration: 0.4,
      },
    },
  };

  const checkmarkVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 500,
        damping: 25,
        delay: 0.1,
      },
    },
  };

  return (
    <div className="flex relative mb-2 items-center">
      {/* Left Side - Icon and Connection */}
      <div className="flex flex-col items-center mr-3">
        {/* Tool Icon with reserved space for status indicator */}
        <div className="relative flex items-center justify-center w-10 h-8">
          {/* Success Checkmark - Left of Icon */}
          {isSuccess && (
            <motion.div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full flex items-center justify-center bg-status-success"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 25,
                delay: 0.2,
              }}
            >
              <FaCheck className="w-2 h-2 text-text-main" />
            </motion.div>
          )}

          {/* Error Indicator - Left of Icon */}
          {isError && (
            <motion.div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full flex items-center justify-center bg-status-error"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 25,
                delay: 0.2,
              }}
            >
              <MdError className="w-2 h-2 text-text-main" />
            </motion.div>
          )}

          {/* Main Tool Icon */}
          <motion.div
            initial={isAnimated ? "hidden" : false}
            animate={isAnimated ? "visible" : false}
            variants={checkmarkVariants}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              animate={
                status === "running"
                  ? {
                      opacity: [0.3, 0.8, 0.3],
                    }
                  : {
                      opacity: isSuccess ? 1 : isError ? 0.4 : 0.6,
                    }
              }
              transition={
                status === "running"
                  ? {
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
                  : {
                      duration: 0.3,
                    }
              }
            >
              <ToolIcon className="w-6 h-6 text-text-main" />
            </motion.div>
          </motion.div>

          {/* Vertical Dotted Connection Line - Blinks until success/error */}
          {!isLastItem && (
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 flex flex-col items-center justify-start gap-1"
              style={{ marginTop: 12, minHeight: "20px" }}
            >
              <motion.span
                className="w-1 h-1 rounded-full bg-text-main"
                animate={{
                  opacity:
                    status === "running" || status === "completed"
                      ? [0.2, 0.6, 0.2]
                      : 0.3,
                }}
                transition={
                  status === "running" || status === "completed"
                    ? {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }
                    : {
                        duration: 0.3,
                      }
                }
              />
              <motion.span
                className="w-1 h-1 rounded-full bg-text-main"
                animate={{
                  opacity:
                    status === "running" || status === "completed"
                      ? [0.2, 0.6, 0.2]
                      : 0.3,
                }}
                transition={
                  status === "running" || status === "completed"
                    ? {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.2,
                      }
                    : {
                        duration: 0.3,
                      }
                }
              />
              <motion.span
                className="w-1 h-1 rounded-full bg-text-main"
                animate={{
                  opacity:
                    status === "running" || status === "completed"
                      ? [0.2, 0.6, 0.2]
                      : 0.3,
                }}
                transition={
                  status === "running" || status === "completed"
                    ? {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.4,
                      }
                    : {
                        duration: 0.3,
                      }
                }
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Right Side - Tool Details */}
      <motion.div
        className="flex-1"
        initial={isAnimated ? "hidden" : false}
        animate={isAnimated ? "visible" : false}
        variants={cardVariants}
      >
        <div className="flex flex-col gap-1">
          {/* Tool Name and Duration/Status */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-text-main">
              {toolName}
            </span>

            {/* Duration - only show when complete */}
            {duration !== undefined &&
              duration !== null &&
              (status === "success" || status === "completed") && (
                <span className="text-xs whitespace-nowrap text-text-muted">
                  {formatDuration(duration)}
                </span>
              )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Collapsed view component for showing all completed tools
interface ToolExecutionGroupProps {
  toolExecutions: Array<{
    tool_name: string;
    icon_name?: string; // Optional: Backend can send specific icon name
    status?: "running" | "completed" | "success" | "error";
    [key: string]: any;
  }>;
  onClick?: () => void;
}

export const ToolExecutionGroup: React.FC<ToolExecutionGroupProps> = ({
  toolExecutions,
  onClick,
}) => {
  return (
    <motion.div
      className={`flex items-center gap-1 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {toolExecutions.map((tool, index) => {
        // Use backend-provided icon name only, fallback to Settings if not provided
        const ToolIcon = tool.icon_name
          ? getIconByName(tool.icon_name)
          : Settings;
        const isSuccess = tool.status === "success";
        const isError = tool.status === "error";

        return (
          <div key={`${tool.tool_name}-${index}`} className="relative">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className="cursor-pointer group/icon"
            >
              <ToolIcon
                className={`w-6 h-6 text-text-main ${isError ? "opacity-40" : ""}`}
              />
              {/* Tooltip - inside motion.div so it triggers only on icon hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs rounded bg-surface-2 text-text-main border border-border-main whitespace-nowrap opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none z-50">
                {tool.tool_name}
              </div>
            </motion.div>

            {/* Success Checkmark */}
            {isSuccess && (
              <motion.div
                className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-transparent flex items-center justify-center"
                // style={{ backgroundColor: "none" }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: index * 0.1 + 0.2,
                  type: "spring",
                  stiffness: 500,
                  damping: 25,
                }}
              >
                {/* <FaCheck 
                  className="w-2 h-2" 
                  style={{ color: "var(--color-text)" }} 
                /> */}
              </motion.div>
            )}

            {/* Error Indicator */}
            {isError && (
              <motion.div
                className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center bg-status-error"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: index * 0.1 + 0.2,
                  type: "spring",
                  stiffness: 500,
                  damping: 25,
                }}
              >
                <MdError className="w-2 h-2 text-text-main" />
              </motion.div>
            )}
          </div>
        );
      })}

      {/* <span 
        className="text-xs ml-1"
        style={{ color: "var(--color-text)", opacity: 0.6 }}
      >
        {toolExecutions.length} {toolExecutions.length === 1 ? 'tool' : 'tools'} executed
      </span> */}
    </motion.div>
  );
};

export default ToolExecution;
