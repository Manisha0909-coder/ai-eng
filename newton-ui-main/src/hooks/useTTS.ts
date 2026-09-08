import { useCallback, useRef, useState } from "react";
import notify from "@/utils/notify";
import { textToSpeech } from "../services/infrastructure/textToSpeech";
import {
  useTTSState,
  useTTSActions,
  useLanguageState,
} from "../store/selectors";
import { useStableCallback } from "./usePerformance";

export const useTTS = () => {
  const { isSpeaking, isSTTActive } = useTTSState();
  const { setIsSpeaking } = useTTSActions();
  // Dedicated TTS-only playing state to avoid clashing with recording
  const [isTTSSpeaking, setIsTTSSpeaking] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const { languageType } = useLanguageState();

  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  // Guard against concurrent starts and rapid double-clicks
  const isStartingRef = useRef<boolean>(false);
  // Cache map: text -> objectURL
  const audioCacheRef = useRef<Map<string, string>>(new Map());

  // Clean up audio resources
  const cleanupAudio = useCallback(() => {
    // Stop browser speech synthesis
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
      speechSynthesisRef.current = null;
    }

    // Stop API-based audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      audioElementRef.current = null;
    }

    isStartingRef.current = false;
    setIsTTSLoading(false);
    setIsSpeaking(false);
    setIsTTSSpeaking(false);
  }, [setIsSpeaking]);

  // Detect if text contains Arabic characters
  const isArabicText = useCallback((text: string) => {
    const arabicPattern = /[\u0600-\u06FF]/;
    return arabicPattern.test(text);
  }, []);

  // Stop any ongoing speech
  const stopSpeaking = useStableCallback(() => {
    cleanupAudio();
  });

  // Main TTS function
  const speakText = useStableCallback(
    async (text: string): Promise<void> => {
      // Don't speak if text is empty
      if (!text.trim()) {
        return;
      }

      // Normalize text for cache key consistency
      const normalizedText = text.trim().toLowerCase();

      // Toggle: if already speaking or starting, stop immediately and exit
      if (isStartingRef.current || isTTSSpeaking) {
        cleanupAudio();
        return;
      }

      // Stop any ongoing speech
      cleanupAudio();

      try {
        isStartingRef.current = true;
        setIsTTSLoading(true);
        // Don't set isSpeaking/isTTSSpeaking yet - wait until audio actually starts playing


        // Helper to start playback from an object URL
        const playFromUrl = (objectUrl: string) => {
          try {
            const audio = new Audio(objectUrl);
            audioElementRef.current = audio;

            // Set speaking state when audio actually starts
            audio.onplay = () => {
              setIsTTSLoading(false);
              setIsSpeaking(true);
              setIsTTSSpeaking(true);
            };

            audio.onended = () => {
              audioElementRef.current = null;
              setIsTTSSpeaking(false);
              setIsSpeaking(false);
              setIsTTSLoading(false);
            };
            audio.onerror = () => {
              audioElementRef.current = null;
              setIsTTSSpeaking(false);
              setIsSpeaking(false);
              setIsTTSLoading(false);
            };
            // Start playback
            audio.play().catch((error) => {
              console.error("❌ useTTS: Audio play error:", error);
              setIsTTSLoading(false);
              setIsSpeaking(false);
              setIsTTSSpeaking(false);
            });
          } catch (e) {
            console.error("Audio playback error", e);
            setIsTTSSpeaking(false);
            setIsSpeaking(false);
            setIsTTSLoading(false);
          }
        };

        // 1) Try cache
        const cached = audioCacheRef.current.get(normalizedText);
        if (cached) {
          playFromUrl(cached);
          return;
        }

        // 2) Fetch from API, build object URL, cache and play
        const { audioData, contentType } = await textToSpeech(text);

        if (!audioData) throw new Error("No audio data received from API");

        // Convert base64 -> Blob -> objectURL
        const byteCharacters = atob(audioData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++)
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: contentType || "audio/mpeg",
        });
        const objectUrl = URL.createObjectURL(blob);

        audioCacheRef.current.set(normalizedText, objectUrl);
        playFromUrl(objectUrl);
      } catch (apiError) {
        console.warn("API TTS failed:", apiError);

        // Show user-friendly error message
        notify.error(
          languageType === "AR"
            ? "فشل في تشغيل النص الصوتي"
            : "Failed to play text-to-speech",
        );

        // Browser speech synthesis fallback (commented out)
        // if (fallbackToSynthesis) {
        //   try {
        //     // Fallback to browser speech synthesis
        //     await startBrowserSpeech(text);
        //   } catch (fallbackError) {
        //     console.error("Both API and browser TTS failed:", fallbackError);
        //   }
        // } else {
        //   throw apiError;
        // }
      } finally {
        isStartingRef.current = false;
        // If stop wasn't requested mid-flight, we'll clear speaking when playback ends
        // For API path, onended handler clears speaking; for synthesis path, onend clears it
        // As a safety, if neither path set audio/synthesis, clear here
        if (!audioElementRef.current && !speechSynthesisRef.current) {
          setIsSpeaking(false);
          setIsTTSSpeaking(false);
          setIsTTSLoading(false);
        }
      }
    },
  );

  // Browser speech synthesis fallback
  const startBrowserSpeech = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        try {
          // Cancel any ongoing speech
          window.speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(text);

          // Set language based on text content and app language
          if (isArabicText(text)) {
            utterance.lang = "ar-SA";
          } else {
            utterance.lang = languageType === "AR" ? "ar-SA" : "en-US";
          }

          // Configure speech parameters
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          // Handle events
          utterance.onstart = () => {
            setIsTTSLoading(false);
            setIsSpeaking(true);
            setIsTTSSpeaking(true);
          };

          utterance.onend = () => {
            setIsSpeaking(false);
            setIsTTSSpeaking(false);
            setIsTTSLoading(false);
            speechSynthesisRef.current = null;
            audioElementRef.current = null; // Clear audio reference
            resolve();
          };

          utterance.onerror = (event) => {
            console.error("Browser TTS error:", event);
            setIsSpeaking(false);
            setIsTTSSpeaking(false);
            setIsTTSLoading(false);
            speechSynthesisRef.current = null;
            audioElementRef.current = null; // Clear audio reference
            reject(new Error(`Speech synthesis error: ${event.error}`));
          };

          // Store reference for cleanup
          speechSynthesisRef.current = utterance;

          // Start speaking
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          setIsSpeaking(false);
          setIsTTSSpeaking(false);
          setIsTTSLoading(false);
          reject(error);
        }
      });
    },
    [isArabicText, languageType, setIsSpeaking],
  );

  // Speak assistant responses automatically
  const speakAssistantResponse = useStableCallback(async (content: string) => {
    // Only auto-speak when explicitly enabled
    if (!isSTTActive || !content) return;

    // Clean the content for better TTS experience
    const cleanContent = content
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold markdown
      .replace(/\*(.*?)\*/g, "$1") // Remove italic markdown
      .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Remove links, keep text
      .replace(/#{1,6}\s/g, "") // Remove headers
      .replace(/\n+/g, " ") // Replace line breaks with spaces
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .trim();

    if (!cleanContent) return;

    // Speak the entire cleaned content (no truncation)
    await speakText(cleanContent);
  });

  // Initialize audio context for better browser compatibility
  const initializeAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();

        // Resume audio context if suspended (mobile requirement)
        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }
      } catch (error) {
        console.warn("Failed to initialize AudioContext:", error);
      }
    }
  }, []);

  // Check TTS availability
  const isTTSAvailable = useCallback(() => {
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }, []);

  return {
    // Core functions
    speakText,
    speakAssistantResponse,
    stopSpeaking,

    // State
    isSpeaking,
    isSTTActive,
    isTTSSpeaking,
    isTTSLoading,

    // Utilities
    initializeAudioContext,
    isTTSAvailable,
    isArabicText,
    cleanupAudio,
    // Expose cache for diagnostics (optional)
    // _audioCache: audioCacheRef.current,

    // Internal functions (for testing)
    startBrowserSpeech,
  };
};

export default useTTS;
