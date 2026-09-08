import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

import { copyToClipboard, extractFormattedText } from "../../utils/textUtils";
import notify from "@/utils/notify";
import { Tooltip } from "react-tooltip";

interface CopyButtonProps {
  text?: string;
  elementRef?: React.RefObject<HTMLElement>;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "outline" | "default";
  showToast?: boolean;
  tooltipText?: string;
  /** Show visible label beside the icon (e.g. "Copy") */
  label?: string;
  iconSize?: number;
  /**
   * Override the icon's color class. Pass "" to let the icon inherit the
   * button's currentColor (so muted→hover styling works for icon-only buttons).
   */
  iconClassName?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  elementRef,
  showToast = true,
  // tooltipText = "Copy to clipboard",
  className = "",
  label,
  iconSize = 18,
  iconClassName,
}) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    let contentToCopy = text || "";

    // If we have an element reference, extract formatted text from it
    if (elementRef?.current && !text) {
      contentToCopy = extractFormattedText(elementRef.current);
    }

    if (!contentToCopy) {
      if (showToast) {
        notify.error("No content to copy");
      }
      return;
    }

    const success = await copyToClipboard(contentToCopy);

    if (success) {
      setCopied(true);
      if (showToast) {
        notify.success("Copied to clipboard!");
      }

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } else {
      if (showToast) {
        notify.error("Failed to copy to clipboard");
      }
    }
  };

  return (
    <>
      <button
        onClick={handleCopy}
        className={` 
          inline-flex items-center justify-center rounded-md transition-colors
          focus:outline-none focus:ring-2 focus:ring-opacity-50
          ${label ? "gap-1.5 h-7 px-2 shrink-0 whitespace-nowrap" : "h-8 w-8"}
          ${copied ? "copy-success" : ""}
          ${className}
          
        `}
        // data-tooltip-id="copy-tooltip"
        // data-tooltip-content={tooltipText}
        // aria-label={tooltipText}
        onMouseDown={(e) => {
          // Prevent focus outline on mouse click
          if (e.detail > 0) {
            e.preventDefault();
          }
        }}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {copied ? (
          <Check size={iconSize} className="text-green-500" />
        ) : (
          <Copy
            size={iconSize}
            className={
              iconClassName ??
              (label ? undefined : "text-[var(--color-text)]")
            }
          />
        )}
        {label && (
          <span className="text-2xs">{copied ? "Copied" : label}</span>
        )}
      </button>
      <Tooltip
        id="copy-tooltip"
        place="bottom"
        className="hidden md:block"
        style={{
          backgroundColor: "var(--color-surface)",
          color: "var(--color-text)",
        }}
      />
    </>
  );
};
