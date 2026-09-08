import { motion } from "framer-motion";

interface DashboardLoaderProps {
  message?: string;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "center" | "inline";
  /** "white" for spinners on solid colored badges/buttons; "current" inherits computed text color. */
  color?: "primary" | "current" | "white";
  className?: string;
}

export const DashboardLoader = ({
  message,
  size,
  variant = "center",
  color = "primary",
  className = "",
}: DashboardLoaderProps) => {
  /** Inline loaders sit in buttons/toolbars; default to xs so they match control height (~32–36px). */
  const resolvedSize = size ?? (variant === "inline" ? "xs" : "md");

  const sizeClasses = {
    xs: "w-5 h-5",
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const borderClass = resolvedSize === "xs" ? "border-[1.5px]" : "border-2";
  const spinnerColor =
    color === "white"
      ? "white"
      : color === "current"
        ? "currentColor"
        : "var(--color-primary)";

  const spinner = (
    <div className={`relative shrink-0 ${sizeClasses[resolvedSize]}`}>
      <motion.div
        className={`absolute inset-0 rounded-full ${borderClass} ${
          color === "white" ? "border-white/30" : "border-transparent"
        }`}
        style={
          color === "white"
            ? { borderTopColor: "white" }
            : {
                borderTopColor: spinnerColor,
                borderRightColor: spinnerColor,
              }
        }
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );

  if (variant === "inline") {
    return (
      <div className={`flex shrink-0 items-center justify-center ${className}`}>
        {spinner}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      {spinner}

      {message && (
        <motion.p
          className="text-sm text-muted-foreground font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.p>
      )}
    </div>
  );
};