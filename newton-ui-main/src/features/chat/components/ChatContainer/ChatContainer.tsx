import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";
import Lottie from "@/components/LottieAnimation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ScrollToBottom, { useScrollToBottom } from "react-scroll-to-bottom";

import { ChevronDown } from "lucide-react";
import DotsLoading from "@/assets/DotsLoading.json";
import NewtonLoading from "@/assets/NewtonLoading.json";
import { Message, UploadedFileMetadata } from "@/types/message";
import { ChatMessage } from "@/features/chat/components/ChatMessage/ChatMessage";
import { assistantHasRenderableBody } from "@/features/chat/components/ChatMessage/utils";
import { VisualizationSidebar } from "@/features/visualization/components/VisualizationSidebar";
import { fetchUserProfile, type UserProfile } from "@/services/user/userApi";
import LoadingChatSkeleton from "./LoadingChatSkeleton";

// Debounce function to prevent excessive updates
const debounce = (func: (...args: unknown[]) => void, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return function executedFunction(...args: unknown[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Loading Animation Component
const LoadingAnimation = React.memo(({ text }: { text: string }) => (
  <>
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.6,
        ease: "easeOut",
        scale: {
          type: "spring",
          damping: 20,
          stiffness: 100,
        },
      }}
      className="flex flex-col items-center justify-center h-full min-h-[300px] relative z-50"
    >
      <div className="flex flex-col items-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            delay: 0.2,
            ease: "easeOut",
          }}
        >
          <Lottie
            animationData={NewtonLoading}
            loop={true}
            style={{ width: 120, height: 120 }}
            className="relative z-10"
          >
            <motion.div
              initial={{ rotate: -10, scale: 0.9 }}
              animate={{
                rotate: 10,
                scale: 1.1,
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
            >
              <Lottie
                animationData={DotsLoading}
                loop={true}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                style={{ opacity: 0.8, width: 60, height: 60 }}
              />
            </motion.div>
          </Lottie>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.8,
            delay: 0.4,
            ease: "easeOut",
          }}
        >
          <motion.span className="text-lg font-medium relative z-10 text-white">
            {text}
            <motion.span
              animate={{
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              ...
            </motion.span>
          </motion.span>
        </motion.div>
      </div>
    </motion.div>
  </>
));

LoadingAnimation.displayName = "LoadingAnimation";

const SCROLL_ESCAPE_THRESHOLD_PX = 100;

function getChatScrollContainer(): HTMLElement | null {
  return document.querySelector(".chat-scroll-container") as HTMLElement | null;
}

// Scroll-follow with escape hatch: auto-scroll during streaming only when near bottom.
const ScrollFollowController: React.FC<{
  messages: Message[];
  isTyping: boolean;
  isMobile: boolean;
  bottomRef: React.RefObject<HTMLDivElement>;
  userScrolledUp: boolean;
  setUserScrolledUp: (value: boolean) => void;
}> = ({
  messages,
  isTyping,
  isMobile,
  bottomRef,
  userScrolledUp,
  setUserScrolledUp,
}) => {
  const scrollToBottom = useScrollToBottom();
  const prevMessagesLengthRef = useRef(messages.length);
  const prevLastAssistantMessageIdRef = useRef<string | null>(null);
  const prevIsStreamingRef = useRef(false);

  const isStreaming =
    isTyping ||
    messages.some((m) => m.type === "assistant" && Boolean(m.isStreaming));

  const lastMessage = messages[messages.length - 1];
  const streamingContentKey =
    lastMessage?.type === "assistant"
      ? `${lastMessage.id}:${lastMessage.content?.length ?? 0}:${lastMessage.message_timeline?.length ?? 0}`
      : "";

  const scrollContainerToEnd = useCallback(
    (behavior: "auto" | "smooth" = isMobile ? "auto" : "smooth") => {
      const el = getChatScrollContainer();
      if (el) {
        el.scrollTop = el.scrollHeight;
      } else {
        scrollToBottom({ behavior });
      }

      if (isMobile) {
        requestAnimationFrame(() =>
          bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" }),
        );
      }
    },
    [scrollToBottom, isMobile, bottomRef],
  );

  // Re-enable follow when the stream ends.
  useEffect(() => {
    if (!isStreaming) {
      setUserScrolledUp(false);
    }
  }, [isStreaming, setUserScrolledUp]);

  // New messages should always scroll into view (e.g. user just sent a message).
  useEffect(() => {
    const lastMessageId = lastMessage?.id ?? null;
    const isLastMessageAssistant = lastMessage?.type === "assistant";

    if (messages.length !== prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length;
      if (isLastMessageAssistant) {
        prevLastAssistantMessageIdRef.current = lastMessageId;
      }
      const delay = isMobile ? 150 : 50;
      const timer = setTimeout(() => scrollContainerToEnd(), delay);
      return () => clearTimeout(timer);
    }

    if (
      isLastMessageAssistant &&
      lastMessageId !== prevLastAssistantMessageIdRef.current
    ) {
      prevLastAssistantMessageIdRef.current = lastMessageId;
      const delay = isMobile ? 150 : 50;
      const timer = setTimeout(() => scrollContainerToEnd(), delay);
      return () => clearTimeout(timer);
    }
  }, [messages.length, lastMessage, isMobile, scrollContainerToEnd]);

  // Follow streaming content only while the user is already near the bottom.
  useEffect(() => {
    if (!isStreaming || userScrolledUp) return;
    scrollContainerToEnd("auto");
  }, [streamingContentKey, isStreaming, userScrolledUp, scrollContainerToEnd]);

  // One final scroll when streaming completes if the user was following.
  useEffect(() => {
    if (prevIsStreamingRef.current && !isStreaming && !userScrolledUp) {
      const delay = isMobile ? 150 : 50;
      const timer = setTimeout(() => scrollContainerToEnd(), delay);
      prevIsStreamingRef.current = isStreaming;
      return () => clearTimeout(timer);
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming, userScrolledUp, isMobile, scrollContainerToEnd]);

  return null;
};

// Memoize individual chat message component with smooth, stable animations
const AnimatedMessage = React.memo(
  ({
    message,
    onEditMessage,
    onRetry,
    onAllFormsSubmitted,
    isTyping,
    speakText,
    stopSpeaking,
    isSpeaking,
    isLoadingTTS,
    isFirstMessage = false,
    isMobile = false,
    disableEditUntilResponseComplete = false,
  }: {
    message: Message;
    onEditMessage?: (
      messageId: string,
      newContent: string,
      fileMetadata?: UploadedFileMetadata | UploadedFileMetadata[]
    ) => void;
    onRetry?: (messageId: string) => void;
    onAllFormsSubmitted?: () => void;
    isTyping: boolean;
    disableEditUntilResponseComplete?: boolean;
    speakText?: (text: string) => Promise<void>;
    stopSpeaking?: () => void;
    isSpeaking?: boolean;
    isLoadingTTS?: boolean;
    isFirstMessage?: boolean;
    isMobile?: boolean;
  }) => {
    const isLoading =
      isTyping &&
      message.type === "assistant" &&
      !assistantHasRenderableBody(message);

    return (
      <motion.div
        key={message.id}
        // Smooth fade-in animation without bouncing
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.4,
          ease: "easeOut",
          delay: 0.05, // Subtle delay for polish
        }}
        className="w-full"
        style={{
          // Prevent layout shifts and bouncing while allowing smooth fade
          contain: "layout",
          willChange: "opacity",
          backfaceVisibility: "hidden",
          transform: "translateZ(0)", // GPU acceleration
          // Add scroll-margin-top for first message on mobile to account for header
          scrollMarginTop:
            isFirstMessage && isMobile ? "70px" : undefined,
        }}
      >
        <ChatMessage
          message={message}
          formFields={message.formFields}
          onEditMessage={onEditMessage}
          onRetry={onRetry}
          onAllFormsSubmitted={onAllFormsSubmitted}
          isLoading={isLoading}
          speakText={speakText}
          stopSpeaking={stopSpeaking}
          isSpeaking={isSpeaking}
          isLoadingTTS={isLoadingTTS}
          disableEditUntilResponseComplete={disableEditUntilResponseComplete}
        />
      </motion.div>
    );
  }
);

AnimatedMessage.displayName = "AnimatedMessage";

interface ChatContainerProps {
  messages: Message[];
  isTyping: boolean;
  onMessageSubmit: (
    content: string,
    fileMetadata?: UploadedFileMetadata | UploadedFileMetadata[]
  ) => Promise<void>;
  onEditMessage?: (
    messageId: string,
    newContent: string,
    fileMetadata?: UploadedFileMetadata | UploadedFileMetadata[]
  ) => void;
  onRetry?: (messageId: string) => void;
  isLoadingMessages?: boolean;
  speakText?: (text: string) => Promise<void>;
  stopSpeaking?: () => void;
  isSpeaking?: boolean;
  isLoadingTTS?: boolean;
  /** When in dashboard layout, the input to render at the bottom of the chat sidebar. */
  chatSidebarInput?: React.ReactNode;
}

const CHAT_SIDEBAR_MIN = 280;
const CHAT_SIDEBAR_MAX_RATIO = 0.5;
const CHAT_SIDEBAR_DEFAULT = 380;

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  isTyping,
  onMessageSubmit,
  onEditMessage,
  onRetry,
  isLoadingMessages = false,
  speakText,
  stopSpeaking,
  isSpeaking = false,
  isLoadingTTS = false,
  chatSidebarInput,
}) => {
  const { selectedPersonaId, personas, newChatType } = useStore();
  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);
  const showVisualizationSidebar =
    newChatType !== "analytical" && selectedPersona?.type !== "chat";
  // Default dashboard is shown in landscape for dashboard mode, not in sidebar
  const suppressDefaultDashboard =
    newChatType === "analytical" || selectedPersona?.type === "chat";
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dashboardLayoutRef = useRef<HTMLDivElement>(null);
  const isResizingChatSidebarRef = useRef(false);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(
    !(isLoadingMessages && messages.length === 0)
  );
  const [chatSidebarWidth, setChatSidebarWidth] = useState(CHAT_SIDEBAR_DEFAULT);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const isDashboardFullscreen = useStore((s) => s.isDashboardFullscreen);
  const isMobile = window.innerWidth <= 768;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [chatInputHeight, setChatInputHeight] = useState(0);
  const sidebarGreetingMessage = selectedPersona?.greeting_message?.trim();
  const givenName = userProfile?.given_name || "";
  const sidebarGreetingTitle = givenName ? `Hi, ${givenName}` : "Welcome back";
  const showSidebarCenterGreeting =
    showVisualizationSidebar &&
    !isMobile &&
    messages.length === 0 &&
    !isTyping &&
    !isLoadingMessages &&
    selectedPersona != null;

  useEffect(() => {
    if (!showSidebarCenterGreeting) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchUserProfile();
        if (!cancelled) setUserProfile(profile);
      } catch (err) {
        console.error("Failed to load user profile:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showSidebarCenterGreeting]);

  // When all forms in an assistant message are submitted, send this prompt to /create so the assistant can continue
  const onAllFormsSubmitted = useCallback(() => {
    onMessageSubmit?.("All forms have been submitted successfully.");
  }, [onMessageSubmit]);

  // Only hide the thread when loading and there is nothing to show yet.
  // If messages exist (e.g. first user message + streaming), keep the chat visible
  // so the user sees their message and assistant loading dots, not a blank area.
  useEffect(() => {
    if (isLoadingMessages && messages.length === 0) {
      setIsChatVisible(false);
    } else {
      const delay = messages.length > 0 ? 0 : 200;
      const timer = setTimeout(() => {
        setIsChatVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isLoadingMessages, messages.length]);

  // Measure ChatInput height on mobile (it's in normal flow)
  useEffect(() => {
    if (!isMobile) {
      setChatInputHeight(0);
      return;
    }

    const measureChatInput = () => {
      // Find the ChatInput container - it's a sibling of main-content
      const mainContent = document.querySelector(".main-content");
      if (mainContent) {
        const chatInputContainer =
          mainContent.nextElementSibling as HTMLElement;
        if (chatInputContainer) {
          const height = chatInputContainer.offsetHeight;
          // Add extra padding for safety
          setChatInputHeight(Math.max(height, 100));
        } else {
          // Fallback: use a safe default height
          setChatInputHeight(120);
        }
      } else {
        // Fallback: use a safe default height
        setChatInputHeight(120);
      }
    };

    // Measure initially with a delay to ensure DOM is ready
    const timer = setTimeout(measureChatInput, 100);

    // Also measure on resize
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(measureChatInput, 50);
    });
    const mainContent = document.querySelector(".main-content");
    if (mainContent?.nextElementSibling) {
      resizeObserver.observe(mainContent.nextElementSibling);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [isMobile]);

  // Handle keyboard appearance on mobile
  const updateContainerHeight = useCallback(() => {
    // Skip in desktop mode
    if (!isMobile) return;

    if (isIOS) {
      if (window.visualViewport) {
        const windowHeight = window.innerHeight;
        const keyboardHeight = Math.max(
          windowHeight - window.visualViewport.height,
          0
        );
        setKeyboardHeight(keyboardHeight);
      }
    }
  }, [isMobile, isIOS]);

  const handleKeyboard = () => {
    // Only in mobile mode
    if (!isMobile) return;
    updateContainerHeight();
  };

  // Debounced version of updateContainerHeight
  const debouncedUpdateHeight = useCallback(
    debounce(updateContainerHeight, 100),
    [updateContainerHeight]
  );

  // Handle keyboard and viewport changes
  useEffect(() => {
    if (isMobile) {
      // For iOS, listen to visualViewport changes
      if (isIOS && window.visualViewport) {
        window.visualViewport.addEventListener("resize", debouncedUpdateHeight);
        window.visualViewport.addEventListener("scroll", debouncedUpdateHeight);
      }
      // For all mobile devices, detect keyboard via focus events
      window.addEventListener("focusin", handleKeyboard);
      window.addEventListener("focusout", handleKeyboard);

      // Initial update
      updateContainerHeight();

      // Cleanup
      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener(
            "resize",
            debouncedUpdateHeight
          );
          window.visualViewport.removeEventListener(
            "scroll",
            debouncedUpdateHeight
          );
        }
        window.removeEventListener("focusin", handleKeyboard);
        window.removeEventListener("focusout", handleKeyboard);
      };
    }
  }, [isMobile, isIOS, debouncedUpdateHeight]);

  // Detect when the user scrolls away from the bottom during streaming.
  useEffect(() => {
    const handleScroll = () => {
      const el = getChatScrollContainer();
      if (!el) return;
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      setUserScrolledUp(distanceFromBottom > SCROLL_ESCAPE_THRESHOLD_PX);
    };

    const attachListener = () => {
      const el = getChatScrollContainer();
      if (!el) return undefined;
      el.addEventListener("scroll", handleScroll, { passive: true });
      return () => el.removeEventListener("scroll", handleScroll);
    };

    let cleanup = attachListener();
    const timer = setTimeout(() => {
      cleanup?.();
      cleanup = attachListener();
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanup?.();
    };
  }, [isChatVisible, messages.length]);

  const resumeScrollFollow = useCallback(() => {
    setUserScrolledUp(false);
    const el = getChatScrollContainer();
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // Apply scroll styles to the ScrollToBottom scroll container
  useEffect(() => {
    const applyScrollStyles = () => {
      // Find the ScrollToBottom wrapper (has class containing 'react-scroll-to-bottom')
      const scrollWrapper = containerRef.current?.closest(
        '[class*="react-scroll-to-bottom"]'
      ) as HTMLElement;
      const scrollContainer = document.querySelector(
        ".chat-scroll-container"
      ) as HTMLElement;

      if (scrollWrapper) {
        scrollWrapper.style.height = "100%";
        scrollWrapper.style.display = "flex";
        scrollWrapper.style.flexDirection = "column";
        scrollWrapper.style.overflow = "hidden";
      }

      if (scrollContainer) {
        scrollContainer.style.height = "100%";
        scrollContainer.style.maxHeight = "100%";
        scrollContainer.style.overflowY = "auto";
        scrollContainer.style.overflowX = "hidden";
        (scrollContainer.style as any).webkitOverflowScrolling = "touch";
        scrollContainer.style.scrollPaddingTop = isMobile ? "70px" : "0px";

        if (isMobile) {
          // Keyboard-independent base clearance; --kb-offset (the amount the
          // chat input is lifted above the keyboard) rides on top via CSS so
          // the padding doesn't animate in competition with the input's own
          // transform — the old keyboardHeight-based padding double-compensated
          // and made opening a chat visibly "re-sort" itself.
          const base = chatInputHeight > 0 ? chatInputHeight + 60 : 220;
          scrollContainer.style.paddingBottom = `calc(${base}px + var(--kb-offset, 0px))`;
        } else {
          scrollContainer.style.paddingBottom = "";
        }
      }
    };

    // Apply styles initially and when dependencies change
    applyScrollStyles();

    // Also apply after a short delay to ensure DOM is ready
    const timer = setTimeout(applyScrollStyles, 100);
    const timer2 = setTimeout(applyScrollStyles, 300);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [isMobile, isIOS, keyboardHeight, chatInputHeight]);

  // If the last assistant message contains html_data, scroll its carousel into view when ready
  useEffect(() => {
    const onReady = (e: Event) => {
      const last = messages[messages.length - 1];
      const hasHtml = !!(
        last &&
        last.type === "assistant" &&
        ((last as any).html_data || (last as any).json_data?.html_data)
      );
      if (!hasHtml) return;
      const el = (e as CustomEvent).detail?.el as HTMLElement | undefined;
      if (el) {
        try {
          // On mobile, scroll to end to ensure action buttons are visible
          // On desktop, scroll to start for better UX
          const scrollBlock = isMobile ? "end" : "start";
          el.scrollIntoView({ behavior: "smooth", block: scrollBlock });

          // On mobile, add extra scroll after a delay to account for action buttons
          if (isMobile) {
            setTimeout(() => {
              const container = containerRef.current;
              if (container) {
                container.scrollTop = container.scrollHeight;
              }
            }, 400);
          }
        } catch {}
      }
    };
    window.addEventListener(
      "chat:html-carousel-ready",
      onReady as EventListener
    );
    return () =>
      window.removeEventListener(
        "chat:html-carousel-ready",
        onReady as EventListener
      );
  }, [messages, isMobile]);

  // Handle reasoning message updates with improved focus
  // useEffect(() => {
  //   if (propReasoningMessage && propReasoningMessage !== reasoningMessage) {
  //     setReasoningMessage(propReasoningMessage);
  //   }
  // }, [propReasoningMessage, reasoningMessage]);

  // Resizable chat sidebar (dashboard layout): drag handle on left edge of right sidebar
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingChatSidebarRef.current || !dashboardLayoutRef.current) return;
      const rect = dashboardLayoutRef.current.getBoundingClientRect();
      const vw = rect.width;
      const min = CHAT_SIDEBAR_MIN;
      const max = Math.max(min, Math.floor(vw * CHAT_SIDEBAR_MAX_RATIO));
      const raw = rect.right - e.clientX;
      setChatSidebarWidth(Math.min(Math.max(raw, min), max));
    };
    const handleMouseUp = () => {
      isResizingChatSidebarRef.current = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const awaitingAssistantResponse = React.useMemo(
    () =>
      isTyping ||
      messages.some(
        (m) => m.type === "assistant" && Boolean(m.isStreaming),
      ),
    [isTyping, messages],
  );

  const showBottomLoadingMessage =
    isTyping && !messages[messages.length - 1]?.isStreaming;

  // Prepare messages list with animations
  const messagesList = React.useMemo(() => {
    return messages.map((message, index) => (
      <AnimatedMessage
        key={message.id}
        message={message}
        onEditMessage={onEditMessage}
        onRetry={onRetry}
        onAllFormsSubmitted={onAllFormsSubmitted}
        isTyping={isTyping}
        speakText={speakText}
        stopSpeaking={stopSpeaking}
        isSpeaking={isSpeaking}
        isLoadingTTS={isLoadingTTS}
        isFirstMessage={index === 0}
        isMobile={isMobile}
        disableEditUntilResponseComplete={awaitingAssistantResponse}
      />
    ));
  }, [
    messages,
    onEditMessage,
    onRetry,
    isTyping,
    speakText,
    stopSpeaking,
    isSpeaking,
    isLoadingTTS,
    isMobile,
    awaitingAssistantResponse,
  ]);

  const chatContent = (
    <>
      <div className="flex-1 relative min-h-0" style={{ overflow: "hidden" }}>
        {showSidebarCenterGreeting && isChatVisible && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4"
          >
            <div className="max-w-[280px] text-center">
              <h1 className="inline-flex items-baseline gap-1 text-2xl font-semibold">
                <span
                  style={{
                    background:
                      "linear-gradient(135deg, rgb(var(--color-text)), color-mix(in srgb, rgb(var(--color-primary)) 65%, rgb(var(--color-text))))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {sidebarGreetingTitle}
                </span>
                <motion.span
                  className="inline-block w-[2px] self-stretch rounded-full"
                  style={{
                    background: "rgb(var(--color-primary))",
                    minHeight: "0.85em",
                  }}
                  animate={{ opacity: [1, 1, 0, 0] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    times: [0, 0.5, 0.5, 1],
                    ease: "linear",
                  }}
                  aria-hidden="true"
                />
              </h1>
              <p className="mt-3 text-sm text-text-muted">
                {sidebarGreetingMessage || "Ready when you are."}
              </p>
            </div>
          </motion.div>
        )}
        <ScrollToBottom
          className="h-full w-full"
          followButtonClassName="hidden"
          scrollViewClassName={`chat-scroll-container overflow-y-auto px-2 ${
            isMobile ? "pb-2" : "pb-10"
          } sm:px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
          checkInterval={isMobile ? 300 : 150}
          initialScrollBehavior={isMobile ? "auto" : "smooth"}
          mode="bottom"
          debounce={isMobile ? 50 : 17}
        >
          <ScrollFollowController
            messages={messages}
            isTyping={isTyping}
            isMobile={isMobile}
            bottomRef={bottomRef}
            userScrolledUp={userScrolledUp}
            setUserScrolledUp={setUserScrolledUp}
          />
          <div ref={containerRef} className="h-full">
            {!isChatVisible && (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <LoadingChatSkeleton />
              </motion.div>
            )}
            {isChatVisible && (
              <div className="transition-opacity duration-300">
                <div style={{ overflowAnchor: "none" }}>{messagesList}</div>
                {showBottomLoadingMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      ease: "easeOut",
                    }}
                    className="w-full"
                    style={{
                      contain: "layout",
                      backfaceVisibility: "hidden",
                      transform: "translateZ(0)",
                    }}
                  >
                    <ChatMessage
                      message={
                        {
                          id: "loading-message",
                          type: "assistant",
                          content: "",
                          timestamp: new Date(),
                          formFields: [],
                        } as Message
                      }
                      formFields={[]}
                      isLoading={true}
                      speakText={speakText}
                      stopSpeaking={stopSpeaking}
                      isSpeaking={isSpeaking}
                      isLoadingTTS={isLoadingTTS}
                    />
                  </motion.div>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollToBottom>
      </div>
    </>
  );

  if (showVisualizationSidebar && !isMobile) {
    const sidebarTransition = {
      type: "tween" as const,
      ease: [0.22, 1, 0.36, 1] as const,
      duration: 0.28,
    };
    return (
      <div
        ref={dashboardLayoutRef}
        className="relative w-full h-full flex"
        style={
          {
            minHeight: 0,
            overflow: "hidden",
            "--chat-sidebar-width": isDashboardFullscreen
              ? "0px"
              : `${chatSidebarWidth}px`,
            "--chat-divider-width": isDashboardFullscreen ? "0px" : "2px",
          } as React.CSSProperties
        }
      >
        {/* Dashboard (center / left) - constrained width, no horizontal expansion */}
        <div
          className="flex-1 min-w-0 min-h-0 flex flex-col scrollbar-themed"
          style={{ overflowX: "hidden", overflowY: "auto", maxWidth: "100%", position: "relative" }}
        >
          <VisualizationSidebar
            messages={messages}
            suppressDefaultDashboard={suppressDefaultDashboard}
            variant="inline"
          />
        </div>
        {/* Smoothly animated resize handle (hide/show with sidebar) */}
        <motion.div
          role="separator"
          aria-label="Resize chat sidebar"
          onMouseDown={() => {
            if (!isDashboardFullscreen) isResizingChatSidebarRef.current = true;
          }}
          animate={{
            width: isDashboardFullscreen ? 0 : 2,
            minWidth: isDashboardFullscreen ? 0 : 2,
            opacity: isDashboardFullscreen ? 0 : 1,
          }}
          transition={sidebarTransition}
          style={{
            cursor: isDashboardFullscreen ? "default" : "col-resize",
            background: "rgb(var(--color-border))",
            flexShrink: 0,
            pointerEvents: isDashboardFullscreen ? "none" : "auto",
          }}
          className="hover:bg-primary/30 transition-colors"
        />

        {/* Chat sidebar (right) — keep mounted, animate width + slide */}
        <motion.div
          className="flex flex-col flex-shrink-0 overflow-hidden border-l border-border-main bg-background"
          animate={{
            width: isDashboardFullscreen ? 0 : chatSidebarWidth,
            opacity: isDashboardFullscreen ? 0 : 1,
            x: isDashboardFullscreen ? 24 : 0,
          }}
          transition={sidebarTransition}
          style={{
            minWidth: isDashboardFullscreen ? 0 : CHAT_SIDEBAR_MIN,
            maxWidth: isDashboardFullscreen ? 0 : "50vw",
            borderLeftWidth: isDashboardFullscreen ? 0 : 1,
            pointerEvents: isDashboardFullscreen ? "none" : "auto",
          }}
        >
          <div className="flex flex-col h-full min-h-0 w-full max-w-full overflow-hidden">
            {chatContent}
          </div>
          {chatSidebarInput != null && (
            <div className="flex-shrink-0 border-border-main pb-[3rem]">
              {chatSidebarInput}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div
        className="flex flex-col w-full max-w-4xl mx-auto overflow-hidden"
        style={{
          height: "100%",
          minHeight: 0,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {chatContent}
      </div>
      {showVisualizationSidebar && (
        <VisualizationSidebar
          messages={messages}
          suppressDefaultDashboard={suppressDefaultDashboard}
        />
      )}
    </div>
  );
};

export default ChatContainer;
