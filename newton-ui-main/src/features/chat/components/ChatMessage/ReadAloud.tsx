import React from "react";
import { Volume2, Square } from "lucide-react";
import { useReadAloud } from "@/hooks/useReadAloud";

interface ReadAloudProps {
  /** The message content to read aloud */
  content: string;
  /** Whether this is currently the active/speaking message */
  isActive?: boolean;
  /** Icon size */
  iconSize?: number;
  /** Show visible "Read aloud" label beside the icon */
  showLabel?: boolean;
  /** Override the icon-only button classes (ignored when showLabel is true) */
  className?: string;
}

const SimpleLoadingAnimation: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    className="animate-pulse"
    style={{
      width: size,
      height: size,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--color-text)",
    }}
  >
    •••
  </div>
);

const ReadAloud: React.FC<ReadAloudProps> = ({
  content,
  isActive = false,
  iconSize = 18,
  showLabel = false,
  className,
}) => {
  const { isLoading, isPlaying, readAloud, cleanTextForTTS } = useReadAloud({
    fallbackToSynthesis: true,
    autoCleanup: true,
  });

  // Log state changes for debugging
  React.useEffect(() => {
  }, [isLoading, isPlaying, isActive, content]);

  const handleClick = () => {
    const cleanContent = cleanTextForTTS(content);
    if (cleanContent) {
      readAloud(cleanContent);
    }
  };

  const getTooltipContent = () => {
    if (isLoading) return "Loading audio...";
    if (isPlaying) return "Stop reading";
    return "Read aloud";
  };

  const getAriaLabel = () => {
    if (isLoading) return "Loading audio";
    if (isPlaying) return "Stop reading aloud";
    return "Read message aloud";
  };

  const renderIcon = () => {
    if (isLoading) {
      return <SimpleLoadingAnimation size={iconSize} />;
    }

    if (isPlaying) {
      return <Square size={iconSize} />;
    }

    return <Volume2 size={iconSize} />;
  };

  return (
    <button
      onClick={handleClick}
      disabled={!content.trim()}
      className={
        showLabel
          ? `flex items-center gap-1.5 h-7 px-2 shrink-0 rounded-md text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors whitespace-nowrap ${
              !content.trim() ? "opacity-50 cursor-not-allowed" : ""
            }`
          : `${
              className ??
              "p-1 rounded-lg hover:bg-surface transition-colors text-[--color-text] h-8 w-8 flex items-center justify-center"
            } ${!content.trim() ? "opacity-50 cursor-not-allowed" : ""}`
      }
      title={getTooltipContent()}
      aria-label={getAriaLabel()}
    >
      {renderIcon()}
      {showLabel && <span className="text-2xs whitespace-nowrap">Read aloud</span>}

      {/* Accessibility: Screen reader only text */}
      {!showLabel && <span className="sr-only">{getAriaLabel()}</span>}
    </button>
  );
};

export default ReadAloud;
