import { Message } from "@/types/message";
import { middlewareFilePath } from "@/utils/fileStaticPath";

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i;

/** Map backend `file_paths` to `Message.attachments` for ChatMessage rendering. */
export function filePathsToAttachments(filePaths: string[]) {
  return filePaths.map((filePath) => {
    const normalizedPath = middlewareFilePath(filePath);
    const fileName = normalizedPath.split("/").pop() || "image.png";
    const isImage = IMAGE_EXT.test(fileName);

    return {
      type: isImage ? "image/png" : "application/octet-stream",
      content: "",
      name: fileName,
      static_path: normalizedPath,
      original_filename: fileName,
      mimetype: isImage ? "image/png" : "application/octet-stream",
    };
  });
}

/**
 * Backend stores uploads on the assistant turn; UI shows them on the user bubble.
 * Move attachments to the user message with the same `message_id` when present.
 */
export function assignAttachmentsToUserMessages(messages: Message[]): Message[] {
  const finalMessages: Message[] = [];

  for (const currentMsg of messages) {
    if (
      currentMsg.type === "assistant" &&
      currentMsg.attachments &&
      currentMsg.attachments.length > 0
    ) {
      const userMsgIndex = finalMessages.findIndex(
        (msg) =>
          msg.type === "user" && msg.message_id === currentMsg.message_id,
      );

      if (userMsgIndex !== -1) {
        const userMsg = finalMessages[userMsgIndex];
        userMsg.attachments = [
          ...(userMsg.attachments ?? []),
          ...currentMsg.attachments,
        ];
        finalMessages.push({ ...currentMsg, attachments: [] });
        continue;
      }
    }

    finalMessages.push(currentMsg);
  }

  return finalMessages;
}
