import { useCallback, useRef, useState, useEffect } from "react";
import notify from "@/utils/notify";
import { textToSpeech } from "../services/infrastructure/textToSpeech";
import { useLanguageState } from "../store/selectors";

export interface ReadAloudState {
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
}

export interface UseReadAloudOptions {
  fallbackToSynthesis?: boolean;
  voice?: string;
  autoCleanup?: boolean;
}

export const useReadAloud = (options: UseReadAloudOptions = {}) => {
  const {
    fallbackToSynthesis = true,
    voice = "onyx",
    autoCleanup = true,
  } = options;
  const { languageType } = useLanguageState();

  // State management
  const [state, setState] = useState<ReadAloudState>({
    isLoading: false,
    isPlaying: false,
    error: null,
  });

  // Refs for cleanup
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isStartingRef = useRef(false);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update state helper
  const updateState = useCallback((updates: Partial<ReadAloudState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Clean up all audio resources
  const cleanup = useCallback(() => {
    // Clear any fade timeout
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }

    // Stop and cleanup audio element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      // Don't revoke URL immediately - let it cleanup naturally
      audioRef.current = null;
    }

    // Stop speech synthesis
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
      speechSynthesisRef.current = null;
    }

    isStartingRef.current = false;
    updateState({ isLoading: false, isPlaying: false, error: null });
  }, [updateState]);

  // Detect Arabic text
  const isArabicText = useCallback((text: string) => {
    const arabicPattern = /[\u0600-\u06FF]/;
    return arabicPattern.test(text);
  }, []);

  // Stop with smooth fade-out
  const stop = useCallback(() => {
    if (audioRef.current && state.isPlaying) {
      const audio = audioRef.current;
      const originalVolume = audio.volume;

      // Smooth fade out
      let currentVolume = originalVolume;
      const fadeStep = originalVolume / 10;

      const fadeOut = () => {
        currentVolume -= fadeStep;
        if (currentVolume <= 0) {
          audio.volume = 0;
          cleanup();
        } else {
          audio.volume = currentVolume;
          fadeTimeoutRef.current = setTimeout(fadeOut, 50);
        }
      };

      fadeOut();
    } else {
      cleanup();
    }
  }, [state.isPlaying, cleanup]);

  // Browser speech synthesis fallback
  const speakWithBrowser = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        try {
          window.speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(text);

          // Set language
          utterance.lang = isArabicText(text)
            ? "ar-SA"
            : languageType === "AR"
              ? "ar-SA"
              : "en-US";

          // Configure speech
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          utterance.onstart = () => {
            updateState({ isLoading: false, isPlaying: true });
          };

          utterance.onend = () => {
            cleanup();
            resolve();
          };

          utterance.onerror = (event) => {
            const error = `Speech synthesis error: ${event.error}`;
            updateState({ isLoading: false, isPlaying: false, error });
            cleanup();
            reject(new Error(error));
          };

          speechSynthesisRef.current = utterance;
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          const errorMsg =
            error instanceof Error
              ? error.message
              : "Unknown speech synthesis error";
          updateState({ isLoading: false, isPlaying: false, error: errorMsg });
          reject(error);
        }
      });
    },
    [isArabicText, languageType, updateState, cleanup],
  );

  // Main read aloud function
  const readAloud = useCallback(
    async (text: string) => {
      // Validate input
      if (!text?.trim()) {
        console.warn("readAloud: No text provided");
        return;
      }

      // Toggle: if already playing or loading, stop
      if (state.isPlaying || state.isLoading || isStartingRef.current) {
        stop();
        return;
      }

      const normalizedText = text.trim().toLowerCase();

      try {
        isStartingRef.current = true;
        updateState({ isLoading: true, isPlaying: false, error: null });

        // Check cache first
        const cachedUrl = audioCacheRef.current.get(normalizedText);
        if (cachedUrl) {
          const audio = new Audio(cachedUrl);
          audioRef.current = audio;

          // Set up audio events
          audio.onplay = () => {
            updateState({ isLoading: false, isPlaying: true });
          };

          audio.onended = () => {
            cleanup();
          };

          audio.onerror = () => {
            // If cached audio fails, try fresh fetch
            audioCacheRef.current.delete(normalizedText);
            updateState({
              isLoading: false,
              isPlaying: false,
              error: "Audio playback failed",
            });
            cleanup();
          };

          await audio.play();
          return;
        }

        // Fetch from API
        const { audioData, contentType } = await textToSpeech(text);

        if (!audioData) {
          throw new Error("No audio data received");
        }

        // Convert base64 to blob URL
        const byteCharacters = atob(audioData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: contentType || "audio/mpeg",
        });
        const objectUrl = URL.createObjectURL(blob);

        // Cache the URL
        audioCacheRef.current.set(normalizedText, objectUrl);

        // Create and play audio
        const audio = new Audio(objectUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          updateState({ isLoading: false, isPlaying: true });
        };

        audio.onended = () => {
          cleanup();
        };

        audio.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          audioCacheRef.current.delete(normalizedText);
          updateState({
            isLoading: false,
            isPlaying: false,
            error: "Audio playback failed",
          });
          cleanup();
        };

        await audio.play();
      } catch (apiError) {
        console.warn("API TTS failed:", apiError);

        const errorMsg =
          languageType === "AR"
            ? "فشل في تشغيل النص الصوتي"
            : "Failed to play text-to-speech";

        notify.error(errorMsg);

        updateState({
          isLoading: false,
          isPlaying: false,
          error: apiError instanceof Error ? apiError.message : "TTS API failed",
        });

        // Browser speech synthesis fallback (commented out)
        // if (fallbackToSynthesis) {
        //   try {
        //     await speakWithBrowser(text);
        //   } catch (fallbackError) {
        //     console.error("Both API and browser TTS failed:", fallbackError);
        //   }
        // }
      } finally {
        isStartingRef.current = false;
      }
    },
    [
      state.isPlaying,
      state.isLoading,
      stop,
      updateState,
      voice,
      languageType,
      fallbackToSynthesis,
      speakWithBrowser,
      cleanup,
    ],
  );

  // Clean text for better TTS experience
  const cleanTextForTTS = useCallback((text: string): string => {
    return text
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold markdown
      .replace(/\*(.*?)\*/g, "$1") // Remove italic markdown
      .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Remove links, keep text
      .replace(/#{1,6}\s/g, "") // Remove headers
      .replace(/\n+/g, " ") // Replace line breaks with spaces
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .trim();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    if (!autoCleanup) return;

    return () => {
      cleanup();
      // Clean up cached URLs
      const currentCache = audioCacheRef.current;
      currentCache.forEach((url) => URL.revokeObjectURL(url));
      currentCache.clear();
    };
  }, [cleanup, autoCleanup]);

  // Check if TTS is available
  const isAvailable = useCallback(() => {
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }, []);

  return {
    // State
    isLoading: state.isLoading,
    isPlaying: state.isPlaying,
    error: state.error,

    // Actions
    readAloud,
    stop,
    cleanup,

    // Utilities
    cleanTextForTTS,
    isAvailable,
    isArabicText,
  };
};

export default useReadAloud;
