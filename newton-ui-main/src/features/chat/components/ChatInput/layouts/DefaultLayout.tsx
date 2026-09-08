import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, Image, Mic, Send, Square } from "lucide-react";
import { Tooltip } from "react-tooltip";
import { FilePreviewList, DictateRecorder } from "../components";
import { cn } from "@/lib/utils";
import type { ChatInputLayoutProps } from "../types";

export const DefaultLayout: React.FC<ChatInputLayoutProps> = ({
  input,
  textareaRef,
  languageType,
  isSmallScreen,
  selectedFiles,
  filePreviewUrls,
  fileUploadStates,
  fileInputRef,
  isDragOver,
  onFileSelect,
  onFileRemove,
  onFileUpload,
  onDragOver,
  onDragLeave,
  onDrop,
  supportsImages = false,
  onInputChange,
  onKeyDown,
  onSubmit,
  isGenerating,
  isLoading,
  isSubmitDisabled,
  onStopRequest,
  isRecording,
  isProcessing,
  isConfirming,
  audioLevel,
  onStartRecording,
  onConfirmRecording,
  onCancelRecording,
  onLanguageToggle,
  hoverMotion,
  focusRingClass,
  showFileUploadWarning,
  fileWarningMessage,
}) => {
  return (
    <div
      className="flex flex-col mx-auto w-full max-w-xl px-2 sm:px-4"
    >
      <form onSubmit={onSubmit} className="relative">
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileSelect}
          className="hidden"
          accept=".jpg,.jpeg,.png,.gif,.bmp,.tiff,.tif"
          multiple
        />

        <FilePreviewList
          files={selectedFiles}
          previewUrls={filePreviewUrls}
          uploadStates={fileUploadStates}
          onRemove={onFileRemove}
          variant="default"
        />

        {isSmallScreen ? (
          /* Compact single-row input (ChatGPT-style). The focus-time lift
             that keeps it clear of the keyboard is a constant CSS rule on
             .chat-input-anchor (index.css). */
          <div
            className={cn(
              "flex items-center gap-0.5 rounded-3xl border px-1.5 py-1.5 shadow-lift bg-input-bg transition-all",
              "focus-within:border-primary/40",
              supportsImages && isDragOver
                ? "border-primary bg-primary/10"
                : "border-border-main",
            )}
            {...(supportsImages && { onDragOver, onDragLeave, onDrop })}
          >
            <motion.button
              type="button"
              onClick={onLanguageToggle}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1 rounded-full px-2 hover:bg-white/10",
                focusRingClass,
              )}
              style={{ color: "rgb(var(--color-text))" }}
              aria-pressed={languageType === "AR"}
              {...(hoverMotion as any)}
            >
              <Globe size={18} />
              <span className="text-2xs font-medium">
                {languageType === "EN" ? "EN" : "AR"}
              </span>
            </motion.button>

            {supportsImages && (
              <motion.button
                type="button"
                onClick={onFileUpload}
                className={cn(
                  "flex h-10 w-9 shrink-0 items-center justify-center rounded-full text-text-main hover:bg-surface-2",
                  focusRingClass,
                )}
                aria-label="Upload image"
                {...(hoverMotion as any)}
              >
                <Image size={17} />
              </motion.button>
            )}

            <textarea
              name="chat"
              id="chat"
              rows={1}
              disabled={isGenerating || isLoading}
              ref={textareaRef}
              value={input}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
              placeholder={
                languageType === "AR" ? "اكتب رسالة..." : "Type a message…"
              }
              className="chat-input-textarea themed-placeholder max-h-28 min-w-0 flex-1 overflow-auto border-none bg-transparent px-1 py-2.5 text-base outline-none focus:outline-none focus-visible:outline-none scroll-mb-10"
              style={{
                color: "rgb(var(--color-text))",
                resize: "none",
                textAlign: languageType === "AR" ? "right" : "left",
                direction: languageType === "AR" ? "rtl" : "ltr",
              }}
              aria-label="Chat message"
              aria-multiline="true"
              aria-busy={isGenerating || isLoading}
              aria-disabled={isGenerating || isLoading}
            />

            <div className="relative shrink-0">
              {isRecording || isConfirming || isProcessing ? (
                <DictateRecorder
                  isRecording={isRecording}
                  isProcessing={isProcessing}
                  isConfirming={isConfirming}
                  audioLevel={audioLevel}
                  onConfirm={onConfirmRecording}
                  onCancel={onCancelRecording}
                />
              ) : (
                <motion.button
                  type="button"
                  onClick={onStartRecording}
                  className={cn(
                    "flex h-10 w-9 items-center justify-center rounded-full hover:bg-white/10",
                    focusRingClass,
                  )}
                  disabled={isProcessing || isGenerating}
                  whileTap={{ scale: 0.95 }}
                  {...(hoverMotion as any)}
                >
                  <Mic size={19} style={{ color: "rgb(var(--color-text))" }} />
                </motion.button>
              )}
            </div>

            {isGenerating ? (
              <motion.button
                type="button"
                onClick={onStopRequest}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-status-error/40 text-status-error hover:bg-status-error/5"
                aria-label="Stop generating"
                {...(hoverMotion as any)}
              >
                <Square size={13} fill="currentColor" className="rounded-sm" />
              </motion.button>
            ) : (
              <motion.button
                type="submit"
                disabled={isSubmitDisabled}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary",
                  focusRingClass,
                )}
                aria-label="Send message"
                {...(hoverMotion as any)}
              >
                <Send size={23} />
              </motion.button>
            )}
          </div>
        ) : (
        <div
          className={cn(
            "rounded-2xl overflow-visible min-w-[340px] w-full transition-all border shadow-lift bg-input-bg",
            "focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_rgb(var(--color-primary)/0.08)]",
            supportsImages && isDragOver
              ? "border-primary bg-primary/10"
              : "border-border-main",
          )}
          {...(supportsImages && {
            onDragOver,
            onDragLeave,
            onDrop,
          })}
        >
          {/* Animated placeholder */}
          {input.length === 0 && selectedFiles.length === 0 && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={languageType}
                className={`pointer-events-none absolute top-[1.2rem] ml-1 text-base ${
                  languageType === "AR" ? "right-4" : "left-4"
                }`}
                style={{ color: "var(--color-text)" }}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 0.4, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              >
                {languageType === "AR"
                  ? `اكتب رسالة...${
                      supportsImages && isDragOver ? " / أفلت الملفات هنا" : ""
                    }`
                  : `What would you like to know?${
                      supportsImages && isDragOver ? " / Drop files here" : ""
                    }`}
              </motion.span>
            </AnimatePresence>
          )}

          <textarea
            name="chat"
            id="chat"
            disabled={isGenerating || isLoading}
            ref={textareaRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            placeholder=""
            className={`h-[52px] px-4 py-3 mt-1 text-base outline-none focus:outline-none focus-visible:outline-none ${
              input.length > 0 ? "pb-10" : "pb-0"
            } bg-transparent border-none w-full themed-placeholder transition-all duration-200 overflow-auto chat-input-textarea`}
            style={{
              color: "var(--color-text)",
              width: "100%",
              resize: "none",
              textAlign: languageType === "AR" ? "right" : "left",
              direction: languageType === "AR" ? "rtl" : "ltr",
            }}
            aria-label="Chat message"
            aria-multiline="true"
            aria-busy={isGenerating || isLoading}
            aria-disabled={isGenerating || isLoading}
          />

          <div className="flex items-center justify-between py-2 px-3">
            <div className="flex items-center gap-1">
            <div className="overflow-visible relative group inline-block">
                <motion.button
                  type="button"
                  onClick={onLanguageToggle}
                  className={`flex items-center space-x-1 px-2 py-1 rounded-full hover:bg-white/10 ${focusRingClass}`}
                  style={{ color: "var(--color-text)" }}
                  aria-pressed={languageType === "AR"}
                  {...(hoverMotion as any)}
                >
                  <Globe size={18} className="mr-1" />
                  <span
                    className={`text-xs ${
                      languageType === "EN" ? "text-blue-300" : "text-green-300"
                    }`}
                    style={{ color: "var(--color-text)" }}
                  >
                    {languageType === "EN" ? "EN" : "AR"}
                  </span>
                </motion.button>
              </div>

              {supportsImages && (
                <motion.button
                  type="button"
                  onClick={onFileUpload}
                  className={cn(
                    "p-2 rounded-full hover:bg-surface-2 transition-colors text-text-main",
                    focusRingClass,
                    // !selectedFiles.length ? "text-text-muted" : "text-text-main",
                  )}
                  aria-label="Upload image"
                  {...(hoverMotion as any)}
                >
                  <Image size={16} />
                </motion.button>
              )}

          
            </div>

            <div className="flex items-center gap-2">
              {/* Dictate Button with Waveform */}
              <div className="relative">
                {isRecording || isConfirming || isProcessing ? (
                  <DictateRecorder
                    isRecording={isRecording}
                    isProcessing={isProcessing}
                    isConfirming={isConfirming}
                    audioLevel={audioLevel}
                    onConfirm={onConfirmRecording}
                    onCancel={onCancelRecording}
                  />
                ) : (
                  <motion.button
                    type="button"
                    onClick={onStartRecording}
                    className={`relative p-2 rounded-full hover:bg-white/10 transition-all ${focusRingClass}`}
                    disabled={isProcessing || isGenerating}
                    whileTap={{ scale: 0.95 }}
                    {...(hoverMotion as any)}
                  >
                    <Mic size={18} style={{ color: "var(--color-text)" }} />
                  </motion.button>
                )}
              </div>

              {isGenerating ? (
                <motion.button
                  type="button"
                  onClick={onStopRequest}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-status-error/40 text-status-error text-xs hover:bg-status-error/5 transition-colors"
                  aria-label="Stop generating"
                  {...(hoverMotion as any)}
                >
                  <Square size={12} fill="currentColor" className="rounded-sm" />
                </motion.button>
              ) : (
                <motion.button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-colors text-primary",
                    focusRingClass,
                    // isSubmitDisabled
                    //   ? "text-text-muted opacity-40"
                    //   : "bg-primary text-white hover:bg-primary/90 shadow-sm dark:text-[#0d1411]",
                  )}
                  aria-label="Send message"
                  {...(hoverMotion as any)}
                  {...(!isSmallScreen && {
                    "data-tooltip-id": "send-tooltip",
                  })}
                >
                  <Send size={20} />
                </motion.button>
              )}
            </div>
          </div>
        </div>
        )}

        {!isSmallScreen && (
          <>
            <Tooltip
              id="dictate-tooltip"
              style={{
                backgroundColor: "var(--color-background)",
                borderColor: "rgb(var(--color-border))",
                color: "var(--color-text)",
              }}
            />
            <Tooltip
              id="stop-recording-tooltip"
              style={{
                backgroundColor: "var(--color-background)",
                borderColor: "rgb(var(--color-border))",
                color: "var(--color-text)",
              }}
            />
            <Tooltip
              id="confirm-tooltip"
              style={{
                backgroundColor: "var(--color-background)",
                borderColor: "rgb(var(--color-border))",
                color: "var(--color-text)",
              }}
            />
            <Tooltip
              id="cancel-tooltip"
              style={{
                backgroundColor: "var(--color-background)",
                borderColor: "rgb(var(--color-border))",
                color: "var(--color-text)",
              }}
            />
            <Tooltip
              id="upload-tooltip"
              style={{
                backgroundColor: "var(--color-background)",
                borderColor: "rgb(var(--color-border))",
                color: "var(--color-text)",
              }}
            />
            <Tooltip
              id="send-tooltip"
              style={{
                backgroundColor: "var(--color-background)",
                borderColor: "rgb(var(--color-border))",
                color: "var(--color-text)",
              }}
            />
          </>
        )}

        {showFileUploadWarning && (
          <div className="absolute -top-14 left-0 right-0 z-10 bg-orange-600/90 text-white p-2 rounded-lg text-center text-sm message-fade-in shadow-lg">
            {fileWarningMessage}
          </div>
        )}
      </form>
    </div>
  );
};
