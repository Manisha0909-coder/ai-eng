import { useEffect, useRef } from "react";

/**
 * Manages the AudioContext lifecycle and the PWA bottom-padding CSS variable.
 * Extracted from App.tsx to isolate audio / layout concerns.
 */
export function useAudioSetup({ cleanupAudio }: { cleanupAudio: () => void }) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  // One-time: set the visual gap under the chat input for PWA vs. browser
  // chrome. Only the gap comes from JS — the safe-area inset itself is added
  // in CSS via env(), because reading env() through a custom property with
  // getComputedStyle is unreliable on WebKit and a bad token would collapse
  // the whole padding to zero (input cut off by the home indicator).
  useEffect(() => {
    try {
      const isStandalone =
        (window.matchMedia &&
          window.matchMedia("(display-mode: standalone)").matches) ||
        (window.navigator as any).standalone;

      document.documentElement.style.setProperty(
        "--bottom-gap",
        isStandalone ? "6px" : "16px"
      );
    } catch {}
  }, []);

  // One-time: create AudioContext and register touch-to-resume handler for
  // mobile browsers that suspend the context until a user gesture.
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }

    if ("ontouchstart" in window) {
      const resumeOnInteraction = async () => {
        if (audioContextRef.current?.state === "suspended") {
          try {
            await audioContextRef.current.resume();
          } catch {}
        }
        document.body.removeEventListener("touchstart", resumeOnInteraction);
        document.body.removeEventListener("click", resumeOnInteraction);
      };
      document.body.addEventListener("touchstart", resumeOnInteraction);
      document.body.addEventListener("click", resumeOnInteraction);
    }

    return () => {
      cleanupAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (speechSynthesisRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, [cleanupAudio]);

}
