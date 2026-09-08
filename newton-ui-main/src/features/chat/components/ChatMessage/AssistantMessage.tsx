import { Share2 } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";

import { NewtonAvatar } from "@/components/branding/NewtonLogo";
import Calendar from "@/components/Calendar";
import IFrame from "@/components/IFrame";
import { CopyButton } from "@/components/ui/copy-button";
import { SHOW_REASONING } from "@/env";
import DocumentSearch from "@/features/documents/components/Document/DocumentSearch";
import CardsContainer from "@/features/travel/components/Cards/CardsContainer";
import DynamicForm, {
  DynamicFormRef,
} from "@/features/chat/components/DynamicForm/DynamicForm";
import {
  ErrorAvatar,
  ErrorCard,
} from "@/features/chat/components/ErrorCard/ErrorCard";
import FeedBackButtons from "@/features/chat/components/feedback/FeedBackButtons";
import FeedbackList from "@/features/chat/components/feedback/FeedbackList";
import { useLanguageStore } from "@/store/languageStore";
import { Message, MessageTimelineEntry } from "@/types/message";

import { MSG_ACTION_BTN } from "./actionButton";
import HtmlCarousel from "./HtmlCarousel";
import ImageCarousel from "./ImageCarousel";
import LoadingMessage from "./LoadingMessage";
import { StreamingStatusBubble, ThinkingDots } from "./ThinkingDots";
import { MarkdownComponents, ReasoningMarkdownComponents } from "./MarkdownRenderer";
import MessageAttachments from "./MessageAttachments";
import NewtonProcessBlock from "./NewtonProcessBlock";
import ReadAloud from "./ReadAloud";
import ReasoningBlock from "./ReasoningBlock";
import {
  chatSanitizeSchema,
  decodeUnicodeEscapes,
  groupTimelineEntries,
  isPrimarilyArabicScript,
  prepareMarkdownContent,
  rehypeStripBreakNewlines,
} from "./utils";
import type { Attachment } from "./types";

interface AssistantMessageProps {
  message: Message;
  isLoading?: boolean;
  isSpeaking?: boolean;
  isLoadingTTS?: boolean;
  isReadOnly?: boolean;
  isChatShare: boolean;
  onRetry?: (messageId: string) => void;
  onAllFormsSubmitted?: () => void;
  onShareOpen: () => void;
}

const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  isLoading,
  isSpeaking,
  isLoadingTTS,
  isReadOnly = false,
  isChatShare,
  onRetry,
  onAllFormsSubmitted,
  onShareOpen,
}) => {
  const { languageType } = useLanguageStore();

  const messageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Form state
  const [isFormVisible, setIsFormVisible] = useState(true);
  const formRef = useRef<DynamicFormRef>(null);
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [formTitle, setFormTitle] = useState<string>("");
  const [selectedFormIndex, setSelectedFormIndex] = useState<number>(0);
  const [isFormSubmitted, setIsFormSubmitted] = useState<
    Record<number, boolean>
  >({});
  const [submittedFormValues, setSubmittedFormValues] = useState<
    Record<number, Record<string, any>>
  >({});
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const allFormsSubmittedSentRef = useRef(false);

  // Reasoning panel visibility is user-controlled via the Thoughts button
  const [isReasoningVisible] = useState(false);

  // Content state management - optimized
  const [stableContent, setStableContent] = useState(message.content || "");

  // Memoized markdown props with better optimization
  const markdownProps: any = useMemo(
    () => ({
      remarkPlugins: [remarkGfm],
      // rehype-sanitize strips <script>, <iframe>, on*= handlers etc. from
      // model output before React renders it. Must run AFTER rehype-raw.
      rehypePlugins: (message.isStreaming
        ? [
            rehypeRaw,
            [rehypeSanitize, chatSanitizeSchema],
            rehypeStripBreakNewlines,
          ]
        : [
            rehypeRaw,
            [rehypeSanitize, chatSanitizeSchema],
            rehypeStripBreakNewlines,
            rehypeHighlight,
          ]) as any,
      components: MarkdownComponents,
      skipHtml: false,
    }),
    [message.isStreaming],
  );

  const reasoningMarkdownProps: any = useMemo(
    () => ({
      remarkPlugins: [remarkGfm],
      rehypePlugins: (message.isStreaming
        ? [
            rehypeRaw,
            [rehypeSanitize, chatSanitizeSchema],
            rehypeStripBreakNewlines,
          ]
        : [
            rehypeRaw,
            [rehypeSanitize, chatSanitizeSchema],
            rehypeStripBreakNewlines,
            rehypeHighlight,
          ]) as any,
      components: ReasoningMarkdownComponents,
      skipHtml: false,
    }),
    [message.isStreaming],
  );

  useEffect(() => {
    if (message.content !== stableContent) {
      setStableContent(message.content || "");
    }
  }, [message.content, stableContent]);

  const currentContent = useMemo(() => {
    const rawContent = message.content || stableContent || "";
    if (!rawContent) return "";
    return prepareMarkdownContent(rawContent);
  }, [message.content, stableContent]);

  // Raw content for copying (decoded but not preprocessed)
  const rawContentForCopyOrRead = useMemo(() => {
    let rawContent = "";
    if (message.message_timeline?.length) {
      const assistantEntries = message.message_timeline.filter(
        (entry): entry is MessageTimelineEntry & { content: string } =>
          entry.type === "assistant_message" &&
          typeof entry.content === "string" &&
          entry.content.trim().length > 0,
      );
      if (assistantEntries.length > 0) {
        rawContent = assistantEntries.map((entry) => entry.content).join("");
      }
    }
    if (!rawContent) {
      rawContent = message.content ?? stableContent ?? "";
    }
    if (!rawContent) return "";

    return decodeUnicodeEscapes(rawContent);
  }, [message.content, stableContent, message.message_timeline]);

  const cleanedContentForCopy = rawContentForCopyOrRead;

  // Form handlers
  const handleFormClose = useCallback(() => {
    setIsFormVisible(false);
  }, []);

  const findNextUnsubmittedForm = useCallback(
    (currentIndex: number) => {
      const availableForms = message.formFields?.filter(
        (item: any) => item.formTitle || item.letterType,
      );
      if (availableForms) {
        for (let i = currentIndex + 1; i < availableForms.length; i++) {
          if (!isFormSubmitted[i]) {
            return { form: availableForms[i], index: i };
          }
        }
      }
      return null;
    },
    [message.formFields, isFormSubmitted],
  );

  const handleFormSubmit = useCallback(
    (data: any) => {
      if (isReadOnly) return;

      setSubmittedFormValues((prev) => ({
        ...prev,
        [selectedFormIndex]: data,
      }));

      setIsFormVisible(false);
      const next = findNextUnsubmittedForm(selectedFormIndex);
      if (next) {
        setSelectedForm(next.form);
        setFormTitle(next.form.formTitle || next.form.letterType);
        setSelectedFormIndex(next.index);
      }
    },
    [selectedFormIndex, findNextUnsubmittedForm, isReadOnly],
  );

  const formStatus = useCallback((index: number, status: boolean) => {
    setIsFormSubmitted((prev) => ({ ...prev, [index]: status }));
  }, []);

  const handleFormButtonClick = useCallback(
    (form: any, formTitle: string, index: number) => {
      if (isReadOnly) return;
      setSelectedForm(form);
      setFormTitle(formTitle || form.letterType);
      setSelectedFormIndex(index);
      setIsFormVisible(true);
    },
    [isReadOnly],
  );

  const handleAllFormsSubmitted = useCallback(() => {
    setShowSuccessMessage(true);
  }, []);

  // Form initialization effect
  useEffect(() => {
    if (message.formFields && message.formFields.length > 0) {
      setSelectedForm(message.formFields[0]);
      setFormTitle(
        message.formFields[0]?.formTitle ||
          message.formFields[0]?.letterType ||
          "",
      );
      setSelectedFormIndex(0);
      setIsFormVisible(true);
    }
  }, [message.formFields]);

  // Form submission completion effect: when ALL forms in this message are submitted
  const formsList = message.formFields || message.json_data?.forms;
  useEffect(() => {
    const formCount = formsList?.length ?? 0;
    if (formCount === 0) return;

    const allSubmitted =
      formCount > 0 &&
      Array.from({ length: formCount }, (_, i) => i).every(
        (i) => isFormSubmitted[i] === true,
      );

    if (!allSubmitted) return;

    handleAllFormsSubmitted();

    // Send follow-up prompt to /create API once so the assistant can continue
    if (onAllFormsSubmitted && !allFormsSubmittedSentRef.current) {
      allFormsSubmittedSentRef.current = true;
      onAllFormsSubmitted();
    }
  }, [
    isFormSubmitted,
    formsList?.length,
    handleAllFormsSubmitted,
    onAllFormsSubmitted,
  ]);

  // Memoized attachment rendering
  const attachmentContent = useMemo(() => {
    if (!message.attachments || message.attachments.length === 0) return null;
    return (
      <MessageAttachments attachments={message.attachments as Attachment[]} />
    );
  }, [message.attachments]);

  // Cards content for hotel/resource recommendations
  const cardsContent = (() => {
    if (!message.cards || message.cards.length === 0) return null;

    return (
      <div
        className="-mt-3 relative"
        style={{
          clear: "both",
          contain: "layout",
          position: "relative",
          zIndex: 1,
          overflow: "visible",
        }}
      >
        <CardsContainer cards={message.cards} />
      </div>
    );
  })();

  // Images content with shadcn carousel
  const imagesContent = (() => {
    if (!message.images || message.images.length === 0) return null;
    return <ImageCarousel images={message.images} messageId={message.id} />;
  })();

  // Memoized generic HTML embed content (reduces nested functions in JSX)
  const htmlDataContent = useMemo(() => {
    const raw =
      (message as any).html_data || (message.json_data as any)?.html_data;
    if (!raw) return null;

    const normalize = (val: any): { html: string; title?: string } => {
      if (typeof val === "string") return { html: val };
      if (val && typeof val === "object") {
        if (typeof val.string === "string")
          return { html: val.string, title: val.metadata?.title };
      }
      return { html: "" };
    };

    if (Array.isArray(raw)) {
      const entries = raw
        .map((entry: any) => normalize(entry))
        .filter((e) => e.html);
      if (entries.length === 0) return null;
      return (
        <HtmlCarousel
          entries={entries}
          baseTitle={(message as any).chat_title}
        />
      );
    }

    const { html, title } = normalize(raw);
    if (!html) return null;
    return (
      <IFrame
        title={(message as any).chat_title || title || "Embedded HTML"}
        content={{ kind: "html", value: html }}
        size={{ mode: "auto", min: 240, max: 2400 }}
        sandboxLevel="scripts"
      />
    );
  }, [message]);

  // Memoized calendar content
  const calendarContent = useMemo(() => {
    const calendarData =
      message.calendarData || message.json_data?.calendar_data;
    if (!calendarData || calendarData.length === 0) return null;

    return (
      <div className="mt-4 mb-4">
        <Calendar events={calendarData} />
      </div>
    );
  }, [message.calendarData, message.json_data?.calendar_data]);

  // Memoized form content
  const formContent = useMemo(() => {
    const forms = message.formFields || message.json_data?.forms;
    if (!forms || forms.length === 0) return null;

    // Determine if form should be read-only (submitted or from previous chat)
    const isFormReadOnly = (idx: number) => {
      return isFormSubmitted[idx] || message.showExpiredForm || isReadOnly;
    };

    return (
      <div className="">
        {forms.length >= 1 && (
          <div className="flex flex-wrap items-center gap-2 mb-4 text-text-main">
            <p className="text-sm sm:text-base font-medium shrink-0">
              {languageType === "AR" ? "الأشكال" : "Forms"}:
            </p>
            {forms.map((each: any, idx: number) => {
              const decodedFormTitle = decodeUnicodeEscapes(
                each.formTitle || each.letterType || "",
              );
              const decodedArabicTitle = decodeUnicodeEscapes(
                each.arabicFormTitle || "",
              );
              const displayTitle =
                languageType === "AR" && decodedArabicTitle
                  ? decodedArabicTitle
                  : decodedFormTitle;
              const formTitleKey = each.formTitle || each.letterType;
              const isSubmitted =
                each.submitted === true || isFormSubmitted[idx] === true;
              const hasDuplicateTitles =
                forms.filter(
                  (f: any) => (f.formTitle || f.letterType) === formTitleKey,
                ).length > 1;
              const isActive = selectedFormIndex === idx;

              return (
                <button
                  key={idx}
                  onClick={() =>
                    handleFormButtonClick(each, each.formTitle, idx)
                  }
                  className={`inline-flex items-center gap-1.5 px-3 sm:px-3 py-2 sm:py-1.5 rounded-lg text-sm m2-2 transition-all duration-200 group border
                   ${
                     isSubmitted
                       ? "bg-status-success text-primary-foreground border-status-success"
                       : message.showExpiredForm
                         ? "bg-text-muted text-surface border-border-main"
                         : isActive
                           ? "border-primary bg-surface text-text-main"
                           : "border-border-main text-text-muted hover:bg-surface"
                   }`}
                >
                  {hasDuplicateTitles && (
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-2xs font-bold
                      ${isSubmitted ? "bg-primary-foreground/30 text-primary-foreground" : isActive ? "bg-primary text-primary-foreground" : "bg-text-muted text-surface"}`}
                    >
                      {idx + 1}
                    </span>
                  )}
                  {displayTitle}
                  {isSubmitted && (
                    <svg
                      className="w-5 h-5 mr-2 ml-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                  )}
                  {message.showExpiredForm && !isSubmitted && (
                    <svg
                      className="w-4 h-4 mr-2 ml-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selectedForm && isFormVisible && (
          <DynamicForm
            key={selectedFormIndex}
            ref={formRef}
            formFields={selectedForm.formFields?.map((field: any) => ({
              ...field,
              label: decodeUnicodeEscapes(field.label || ""),
              arabicLabel: decodeUnicodeEscapes(field.arabicLabel || ""),
              placeholder: decodeUnicodeEscapes(field.placeholder || ""),
              arabicPlaceholder: decodeUnicodeEscapes(
                field.arabicPlaceholder || "",
              ),
              defaultValue:
                typeof field.defaultValue === "string"
                  ? decodeUnicodeEscapes(field.defaultValue)
                  : field.defaultValue,
              arabicDefaultValue: decodeUnicodeEscapes(
                field.arabicDefaultValue || "",
              ),
              options:
                field.options?.map((option: any) => ({
                  ...option,
                  label: decodeUnicodeEscapes(option.label || ""),
                  arabicLabel: decodeUnicodeEscapes(option.arabicLabel || ""),
                })) || field.options,
            }))}
            formButtons={selectedForm.buttons?.map((button: any) => ({
              ...button,
              title: decodeUnicodeEscapes(button.title || ""),
              arabicTitle: decodeUnicodeEscapes(button.arabicTitle || ""),
            }))}
            closeForm={handleFormClose}
            onSubmit={handleFormSubmit}
            formTitle={decodeUnicodeEscapes(formTitle)}
            arabicFormTitle={decodeUnicodeEscapes(
              selectedForm.arabicFormTitle || "",
            )}
            formStatus={formStatus}
            formIndex={selectedFormIndex}
            isReadOnly={
              isFormReadOnly(selectedFormIndex) || message.showExpiredForm
            }
            formId={selectedForm.form_id}
            metadata={selectedForm._metadata}
            submittedValues={
              selectedForm.submitted_values ||
              submittedFormValues[selectedFormIndex] ||
              undefined
            }
            submitted={
              selectedForm.submitted === true ||
              isFormSubmitted[selectedFormIndex] === true
            }
          />
        )}

        {showSuccessMessage && (
          <p className="text-status-success text-sm font-medium mt-2">
            Form(s) submission successful
          </p>
        )}
      </div>
    );
  }, [
    message.formFields,
    message.json_data?.forms,
    message.showExpiredForm,
    languageType,
    isFormSubmitted,
    formTitle,
    handleFormButtonClick,
    selectedForm,
    isFormVisible,
    handleFormClose,
    handleFormSubmit,
    formStatus,
    showSuccessMessage,
    isReadOnly,
  ]);

  const [thumbsDownClicked, setThumbsDownClicked] = useState<boolean>(false);

  // Debug: Monitor thumbs down state changes
  useEffect(() => {}, [thumbsDownClicked]);

  const showStreamingDots = message.isStreaming && !message.isError;

  // Optimized assistant message content with improved reasoning rendering
  const assistantMessageContent = useMemo(() => {
    const hasTimeline =
      message?.message_timeline && message.message_timeline.length > 0;

    // Check if there's any reasoning content (only if SHOW_REASONING is enabled)
    const hasReasoning =
      SHOW_REASONING &&
      (hasTimeline
        ? message.message_timeline?.some(
            (entry) => entry.type === "reasoning",
          )
        : !!message?.reasoningMessage);

    const assistantCopySample =
      cleanedContentForCopy || rawContentForCopyOrRead || "";
    const alignAssistantActionsEnd =
      isPrimarilyArabicScript(assistantCopySample);

    return (
      <div ref={messageRef} className="flex justify-start group relative" dir="ltr">
        <div className="flex items-start gap-2 my-3 w-full max-w-full">
          {message.isError ? (
            <ErrorAvatar className="mt-0.5" />
          ) : (
            <NewtonAvatar className="mt-0.5" />
          )}
          <div className="flex-1 min-w-0 relative group/assistant-message">
            <div
              dir="auto"
              className={`w-full min-w-0 text-text-main text-base user-message rounded-2xl${
                message.isHighlighted
                  ? " border bg-status-error/[var(--pill-status-bg-alpha)] border-status-error/[var(--pill-status-border-alpha)]"
                  : ""
              }`}
              style={{
                contain: "layout",
              }}
            >
              {message?.showSecurityReport ? (
                <></>
              ) : (
                <div>
                  <div
                    ref={contentRef}
                    className="markdown-content max-w-none"
                  >
                    <div className="relative">
                      {/* Render Interleaved Timeline if available, otherwise fallback to legacy */}
                      {!message.isError &&
                        (message.message_timeline &&
                        message.message_timeline.length > 0 ? (
                          <>
                            <div className="interleaved-timeline">
                              {groupTimelineEntries(
                                message.message_timeline,
                              ).map((entry, index) => {
                                switch (entry.type) {
                                  case "reasoning":
                                    return SHOW_REASONING ? (
                                      <ReasoningBlock
                                        key={`reasoning-${index}`}
                                        content={entry.content}
                                        reasoningMarkdownProps={
                                          reasoningMarkdownProps
                                        }
                                        defaultOpen={index === 0}
                                      />
                                    ) : null;

                                  case "process_group":
                                    return (
                                      <NewtonProcessBlock
                                        key={`process-group-${index}`}
                                        entries={entry.entries}
                                        reasoningMarkdownProps={
                                          reasoningMarkdownProps
                                        }
                                        defaultOpen={false}
                                      />
                                    );

                                  case "assistant_message": {
                                    const isOnlyAssistantEntry =
                                      (message.message_timeline?.filter(
                                        (e) => e.type === "assistant_message",
                                      ).length ?? 0) <= 1;
                                    const contentForDisplay =
                                      (typeof entry.content === "string" &&
                                        entry.content.trim()) ||
                                      (isOnlyAssistantEntry
                                        ? message.content
                                        : "") ||
                                      "";
                                    const normalizedContent =
                                      prepareMarkdownContent(contentForDisplay);

                                    return (
                                      <div
                                        key={`assistant-${index}`}
                                        className="markdown-content-wrapper mb-3"
                                        dir="auto"
                                      >
                                        {normalizedContent && (
                                          <ReactMarkdown {...markdownProps}>
                                            {normalizedContent}
                                          </ReactMarkdown>
                                        )}
                                      </div>
                                    );
                                  }

                                  default:
                                    return null;
                                }
                              })}
                            </div>
                            {/* Edit / stop-resume: content may stream on message.content before assistant_message exists in timeline */}
                            {message.content?.trim() &&
                              !message.message_timeline?.some(
                                (e) => e.type === "assistant_message",
                              ) && (
                                <div
                                  className="markdown-content-wrapper mb-3 mt-2"
                                  dir="auto"
                                >
                                  <ReactMarkdown {...markdownProps}>
                                    {currentContent}
                                  </ReactMarkdown>
                                </div>
                              )}
                          </>
                        ) : (
                          /* Legacy Fallback Rendering */
                          <>
                            {/* Unified Process Display (Legacy Fallback) */}
                            {((SHOW_REASONING && message.reasoningMessage) ||
                              (message.toolExecutions &&
                                message.toolExecutions.length > 0)) && (
                              <div className="mt-3 mb-3">
                                <NewtonProcessBlock
                                  entries={[
                                    ...(SHOW_REASONING &&
                                    message.reasoningMessage
                                      ? [
                                          {
                                            type: "reasoning",
                                            content: message.reasoningMessage,
                                          },
                                        ]
                                      : []),
                                    ...(message.toolExecutions || []).map(
                                      (te) => ({ ...te, type: "tool_call" }),
                                    ),
                                  ]}
                                  reasoningMarkdownProps={
                                    reasoningMarkdownProps
                                  }
                                  defaultOpen={false}
                                />
                              </div>
                            )}

                            {/* Legacy Main Content */}
                            <div
                              className={`markdown-content-wrapper${
                                (SHOW_REASONING &&
                                  message.reasoningMessage) ||
                                (message.toolExecutions &&
                                  message.toolExecutions.length > 0)
                                  ? " mt-2"
                                  : ""
                              }`}
                              dir="auto"
                            >
                              <ReactMarkdown {...markdownProps}>
                                {currentContent ||
                                  prepareMarkdownContent(
                                    message.content || "",
                                  )}
                              </ReactMarkdown>
                            </div>
                          </>
                        ))}

                      {/* Final Data Components (Images, Cards, etc.) */}
                      {imagesContent && (
                        <motion.div
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.28 }}
                          className="mt-3"
                        >
                          {imagesContent}
                        </motion.div>
                      )}

                      {cardsContent && (
                        <motion.div
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.3 }}
                          className="mt-4"
                        >
                          {cardsContent}
                        </motion.div>
                      )}

                      {/* Additional Elements Container */}
                      <div
                        className="assistant-additional-elements relative group/message text-text-main"
                        style={{
                          minHeight: hasTimeline ? "0" : "20px",
                          contain: "layout",
                          clear: "both",
                          position: "relative",
                          zIndex: 2,
                        }}
                      >
                        {message.isError ? (
                          <ErrorCard
                            errorMessage={currentContent.replace(
                              /^Error:\s*/gi,
                              "",
                            )}
                            onRetry={() => onRetry?.(message.id)}
                            isRetrying={message.isRetrying}
                          />
                        ) : (
                          <div className="mt-2">
                            {/* Generic HTML embed from backend
                             *
                             * NOTE: Visualizations (e.g. Plotly charts) are now rendered
                             * in a persistent right-hand sidebar preview panel instead of
                             * inline in the conversation. We intentionally do NOT render
                             * htmlDataContent here anymore to avoid duplicate/inlined charts.
                             */}
                            {false && htmlDataContent && (
                              <div className="mt-4 space-y-4 mb-4 sm:mb-2">
                                {htmlDataContent}
                              </div>
                            )}
                            {(message.documentSearchData ||
                              (message as any).doc_search_data) && (
                              <DocumentSearch
                                analysis={
                                  (
                                    message.documentSearchData ||
                                    (message as any).doc_search_data
                                  ).analysis
                                }
                                items={
                                  (
                                    message.documentSearchData ||
                                    (message as any).doc_search_data
                                  ).document_search_data
                                }
                              />
                            )}
                          </div>
                        )}

                        {currentContent && !message.isError && (
                          <div
                            className={
                              htmlDataContent ? "mb-8 sm:mb-4" : "mb-2"
                            }
                          />
                        )}

                        {/* Show animation even when there's no content yet (during reasoning/tool execution phase) */}
                        {showStreamingDots && !currentContent && (
                          <StreamingStatusBubble
                            className={hasReasoning ? "mt-2" : undefined}
                          />
                        )}
                        {showStreamingDots && currentContent && (
                          <div className="mb-2">
                            <ThinkingDots className="pl-4 pt-2 pb-1" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {attachmentContent}

              {calendarContent && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    ease: "easeOut",
                    delay: 0.3,
                  }}
                  style={{
                    contain: "layout",
                    backfaceVisibility: "hidden",
                    transform: "translateZ(0)",
                  }}
                >
                  {calendarContent}
                </motion.div>
              )}
              {formContent && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    ease: "easeOut",
                  }}
                  className={calendarContent ? "mt-6 sm:mt-8" : undefined}
                  style={{
                    contain: "layout",
                    backfaceVisibility: "hidden",
                    transform: "translateZ(0)",
                  }}
                >
                  {formContent}
                </motion.div>
              )}

              {/* Action buttons - appear after forms when hovering over message or forms */}
              {!message.isError && !message.isStreaming && (
                <motion.div
                  initial={false}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className={`
                    relative z-10 w-full
                    ${
                      isSpeaking || isLoadingTTS
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none group-hover/assistant-message:opacity-100 group-hover/assistant-message:pointer-events-auto"
                    }
                    transition-opacity duration-200 flex items-center gap-1 mt-3
                    ${alignAssistantActionsEnd ? "justify-end" : "justify-start"}
                  `}
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "translateZ(0)",
                  }}
                >
                  <CopyButton
                    text={cleanedContentForCopy}
                    iconSize={14}
                    iconClassName=""
                    className={MSG_ACTION_BTN}
                    size="md"
                    tooltipText=""
                  />
                  {!isChatShare && !isReadOnly && (
                    <button
                      onClick={() => onShareOpen()}
                      className={MSG_ACTION_BTN}
                      aria-label="Share"
                      title="Share"
                    >
                      <Share2 size={14} />
                    </button>
                  )}

                  {message.type === "assistant" && (
                    <ReadAloud
                      content={rawContentForCopyOrRead}
                      iconSize={16}
                      className={MSG_ACTION_BTN}
                    />
                  )}

                  {!isChatShare && !isReadOnly && (
                    <>
                      <span
                        className="w-px h-5 bg-border-main mx-1 shrink-0"
                        aria-hidden="true"
                      />
                      <FeedBackButtons
                        thumbsDownClicked={thumbsDownClicked}
                        setThumbsDownClicked={setThumbsDownClicked}
                        message_id={message.message_id as string}
                      />
                    </>
                  )}
                </motion.div>
              )}
              {thumbsDownClicked === true && (
                <FeedbackList
                  message_id={message.message_id as string}
                  onClose={() => setThumbsDownClicked(false)}
                />
              )}
              {message.showScheduleMeetingForm && (
                <motion.div
                  className="mt-4"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    ease: "easeOut",
                  }}
                  style={{
                    contain: "layout",
                    backfaceVisibility: "hidden",
                    transform: "translateZ(0)",
                  }}
                ></motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }, [
    message.type,
    message.isError,
    message.showSecurityReport,
    message.showScheduleMeetingForm,
    message.isStreaming,
    message.content,
    message.id,
    currentContent,
    markdownProps,
    isReasoningVisible,
    attachmentContent,
    calendarContent,
    formContent,
    thumbsDownClicked,
    isSpeaking,
    isLoadingTTS,
    imagesContent,
    cardsContent,
    isChatShare,
    isReadOnly,
    onShareOpen,
    message.message_timeline,
    cleanedContentForCopy,
    rawContentForCopyOrRead,
  ]);

  if (isLoading) {
    return (
      <LoadingMessage
        message={message}
        markdownProps={markdownProps}
      />
    );
  }

  return <>{assistantMessageContent}</>;
};

export default AssistantMessage;