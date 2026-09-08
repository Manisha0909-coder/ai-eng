import { useState, useRef, useEffect, useCallback } from "react";
import { ARABIC_KEY_MAP } from "@/utils/arabicKeyMap";

interface UseChatInputStateOptions {
  languageType: "EN" | "AR";
  isMobile: boolean;
}

export const useChatInputState = ({
  languageType,
  isMobile,
}: UseChatInputStateOptions) => {
  const [input, setInput] = useState("");
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const adjustTextareaHeight = () => {
      const minHeight = 52;
      const maxHeight = 70;
      
      // Reset height to auto to get accurate scrollHeight
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      
      if (scrollHeight <= minHeight) {
        // Content fits in minimum height
        textarea.style.height = `${minHeight}px`;
        textarea.style.overflowY = "hidden";
      } else if (scrollHeight <= maxHeight) {
        // Content needs more space but within max - grow to fit
        textarea.style.height = `${scrollHeight}px`;
        textarea.style.overflowY = "hidden";
      } else {
        // Content exceeds max - cap height and show scrollbar
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = "auto";
      }
    };

    adjustTextareaHeight();

    const resizeObserver = new ResizeObserver(() => {
      adjustTextareaHeight();
    });
    resizeObserver.observe(textarea);

    return () => resizeObserver.disconnect();
  }, [input]);

  // Set text direction based on language
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.textAlign =
        languageType === "AR" ? "right" : "left";
      textareaRef.current.style.direction =
        languageType === "AR" ? "rtl" : "ltr";
    }
  }, [languageType]);

  /**
   * Handle Arabic key mapping when in Arabic mode
   * Returns true if the event was handled
   */
  const handleArabicKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (languageType !== "AR") return false;

      const isCharacterKey =
        e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (isCharacterKey && ARABIC_KEY_MAP[e.key]) {
        e.preventDefault();
        const textarea = e.target as HTMLTextAreaElement;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const arabicChar = ARABIC_KEY_MAP[e.key];

        const newValue =
          input.substring(0, start) + arabicChar + input.substring(end);
        setInput(newValue);

        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd =
            start + arabicChar.length;
        }, 0);
        return true;
      }
      return false;
    },
    [languageType, input]
  );

  /**
   * Handle history navigation with arrow keys
   * Returns true if the event was handled
   */
  const handleHistoryNavigation = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      switch (e.key) {
        case "ArrowUp":
          if (
            inputHistory.length > 0 &&
            historyIndex < inputHistory.length - 1 &&
            (input.trim() === "" || historyIndex >= 0)
          ) {
            e.preventDefault();
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setInput(inputHistory[inputHistory.length - 1 - newIndex]);
            return true;
          }
          break;
        case "ArrowDown":
          if (historyIndex > 0) {
            e.preventDefault();
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setInput(inputHistory[inputHistory.length - 1 - newIndex]);
            return true;
          } else if (historyIndex === 0) {
            e.preventDefault();
            setHistoryIndex(-1);
            setInput("");
            return true;
          }
          break;
      }
      return false;
    },
    [inputHistory, historyIndex, input]
  );

  /**
   * Handle Enter key for submission
   * Returns true if should submit, false otherwise
   */
  const handleEnterKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (e.key !== "Enter") return false;

      if (isMobile) {
        // On mobile, Enter adds newline, Shift+Enter also adds newline
        return false;
      } else {
        // Desktop: Shift+Enter adds newline, Enter submits
        if (e.shiftKey) {
          return false;
        }
        e.preventDefault();
        return true;
      }
    },
    [isMobile]
  );

  const addToHistory = useCallback((message: string) => {
    if (message.length > 0) {
      setInputHistory((prev) => [...prev, message]);
      setHistoryIndex(-1);
    }
  }, []);

  const resetInput = useCallback(() => {
    setInput("");
  }, []);

  const restoreInput = useCallback((content: string, adjustHeight = true) => {
    setInput(content);
    if (adjustHeight) {
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          const minHeight = 52;
          const maxHeight = 200;
          
          // Reset height to auto to get accurate scrollHeight
          textarea.style.height = "auto";
          const scrollHeight = textarea.scrollHeight;
          
          if (scrollHeight <= minHeight) {
            textarea.style.height = `${minHeight}px`;
            textarea.style.overflowY = "hidden";
          } else if (scrollHeight <= maxHeight) {
            textarea.style.height = `${scrollHeight}px`;
            textarea.style.overflowY = "hidden";
          } else {
            textarea.style.height = `${maxHeight}px`;
            textarea.style.overflowY = "auto";
          }
        }
      }, 10);
    }
  }, []);

  const focusTextarea = useCallback((platform: string) => {
    if (textareaRef.current) {
      if (platform === "iOS") {
        textareaRef.current.blur();
      } else {
        textareaRef.current.focus();
      }
    }
  }, []);

  return {
    // State
    input,
    setInput,
    textareaRef,
    inputHistory,
    // Handlers
    handleArabicKeyDown,
    handleHistoryNavigation,
    handleEnterKey,
    // Actions
    addToHistory,
    resetInput,
    restoreInput,
    focusTextarea,
  };
};
