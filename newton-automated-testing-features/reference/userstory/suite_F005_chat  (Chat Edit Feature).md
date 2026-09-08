---
## US: 001

As a User, I want to upload images in recent chats and ask questions about them so that I can continue visual conversations seamlessly.

**Acceptance Criteria:**

* System must allow image uploads within recent chats.
* AI must process and respond to image-based queries in the same thread.
* Uploaded images must remain accessible within the chat history.
* System must handle invalid or corrupted image uploads gracefully.
---

## US: 002

As a User, I want to upload images in JPG and PNG formats in recent chats so that I can use commonly supported image types.

**Acceptance Criteria:**

- System must accept JPG and PNG file formats.
- Unsupported formats must be rejected with a clear error message.
- File size limits must be enforced (if defined).
- Uploaded files must retain sufficient quality for processing.

---

## US: 003

As a User, I want to use speech-to-text (STT) in recent chats so that I can input messages using my voice.

**Acceptance Criteria:**

- System must provide a microphone input option in recent chats.
- Speech must be converted to text in the input field.
- User must be able to edit transcribed text before sending.
- System must handle errors or unclear speech gracefully.

---

## US: 004

As a User, I want messages in recent chats to display correctly in RTL languages (e.g., Arabic) so that I can read and interact comfortably.

**Acceptance Criteria:**

- System must support RTL layout rendering.
- Text alignment must adjust automatically based on language direction.
- Mixed RTL and LTR content must render correctly.
- Chat UI elements must remain stable in RTL mode.

---

## US: 005

As a User, I should not see or use chat edit features in archived chats so that the experience remains simple and consistent.

**Acceptance Criteria:**

- Edit-related options must not be visible in unarchived chats.
- System must prevent editing actions in unarchived chats.
- UI must clearly reflect that editing is unavailable.
- No errors should occur when interacting with such chats.

---
