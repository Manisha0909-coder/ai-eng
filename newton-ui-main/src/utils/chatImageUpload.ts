/** Max image attachments per message in chat input and message edit flows */
export const MAX_CHAT_IMAGES = 5;

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i;

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT_RE.test(file.name);
}
