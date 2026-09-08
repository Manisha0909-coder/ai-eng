import React, { useMemo, useState } from "react";
import FullScreenViewer from "@/features/travel/components/Cards/FullScreenViewer";
import AuthenticatedImage from "./AuthenticatedImage";
import type { Attachment } from "./types";

const AttachmentWithFullScreen: React.FC<{
  attachment: Attachment;
  layout?: "full" | "gallery";
}> = ({ attachment, layout = "full" }) => {
  const [showFullScreen, setShowFullScreen] = useState(false);

  if (
    !(attachment.static_path || attachment.preview) ||
    !(attachment.mimetype || attachment.type || "").startsWith("image/")
  ) {
    return null;
  }

  const imageSrc = attachment.static_path || attachment.preview || "";
  const altText =
    attachment.original_filename || attachment.name || "Image attachment";

  if (layout === "gallery") {
    return (
      <div className="relative aspect-square min-h-0 w-full overflow-hidden rounded-xl border border-border-main/30 bg-black/20 shadow-sm">
        <div
          className="cursor-pointer hover:opacity-90 transition-opacity h-full w-full"
          onClick={() => setShowFullScreen(true)}
        >
          <AuthenticatedImage
            src={imageSrc}
            alt={altText}
            className="h-full w-full object-cover"
            staticPath={attachment.static_path}
            fallbackSrc={attachment.preview}
          />
        </div>

        {showFullScreen && (
          <FullScreenViewer
            src={imageSrc}
            onClose={() => setShowFullScreen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 p-2">
      <div
        className="cursor-pointer hover:opacity-90 transition-opacity inline-block"
        onClick={() => setShowFullScreen(true)}
      >
        <AuthenticatedImage
          src={imageSrc}
          alt={altText}
          className="mt-2 max-w-full max-h-48 object-contain rounded border border-border-main/30"
          staticPath={attachment.static_path}
          fallbackSrc={attachment.preview}
        />
      </div>

      {showFullScreen && (
        <FullScreenViewer
          src={imageSrc}
          onClose={() => setShowFullScreen(false)}
        />
      )}
    </div>
  );
};

interface MessageAttachmentsProps {
  attachments?: Attachment[];
}

const MessageAttachments: React.FC<MessageAttachmentsProps> = ({
  attachments,
}) => {
  const content = useMemo(() => {
    if (!attachments || attachments.length === 0) return null;

    const isImageAttachment = (a: Attachment) =>
      Boolean(
        (a.static_path || a.preview) &&
          (a.mimetype || a.type || "").startsWith("image/"),
      );

    const imageAttachments = attachments.filter(isImageAttachment);
    const attachmentKey = (a: Attachment, i: number) =>
      a.name || a.static_path || a.preview || `attachment-${i}`;

    if (imageAttachments.length > 1) {
      return (
        <div className="mt-1 grid w-full max-w-[min(100%,220px)] sm:max-w-[280px] grid-cols-2 gap-1.5">
          {imageAttachments.map((attachment, idx) => (
            <AttachmentWithFullScreen
              key={attachmentKey(attachment, idx)}
              attachment={attachment}
              layout="gallery"
            />
          ))}
        </div>
      );
    }

    if (imageAttachments.length === 1) {
      return (
        <AttachmentWithFullScreen
          key={attachmentKey(imageAttachments[0], 0)}
          attachment={imageAttachments[0]}
          layout="full"
        />
      );
    }

    return (
      <>
        {attachments.map((attachment, idx) => (
          <AttachmentWithFullScreen
            key={attachmentKey(attachment, idx)}
            attachment={attachment}
            layout="full"
          />
        ))}
      </>
    );
  }, [attachments]);

  return <>{content}</>;
};

export { AttachmentWithFullScreen };
export default MessageAttachments;
