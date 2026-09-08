## US: 001

As a logged-in User, I want to create a private share link for a chat, so that only authenticated users I share it with can view it.

**Acceptance Criteria:**
    - User can click a "Share" button on any chat they own.
    - User can select "Private" as the link visibility option.
    - System generates a unique, hard-to-guess private link.
    - The link requires authentication to access.
    - The generated link is associated with the user's account and the specific chat.


## US: 002

As a logged-in User, I want to create a public share link for a chat, so that anyone with the link can view it without needing to log in.

**Acceptance Criteria:**
    - User can select "Public" as the link visibility option when sharing a chat.
    - System generates a unique, hard-to-guess public link.
    - The link is accessible to anyone without authentication.
    - User is informed that the chat will be publicly visible before confirming.
    - The generated link is associated with the user's account and the specific chat.


## US: 003

As an authenticated User with access to a private share link, I want to view the shared chat in read-only mode, so that I can review the conversation without being able to modify it.

**Acceptance Criteria:**
    - Unauthenticated users visiting a private link are redirected to the login page.
    - After login, the user is redirected back to the shared chat.
    - The chat is displayed in read-only mode with no editing or reply capabilities.
    - The UI clearly indicates the chat is shared and view-only.
    - Users without an account cannot access the content.


## US: 004

As any User (authenticated or not) with access to a public share link, I want to view the shared chat in read-only mode, so that I can review the conversation without needing to log in.

**Acceptance Criteria:**
    - Public share links are accessible without authentication.
    - The chat is displayed in read-only mode with no editing or reply capabilities.
    - The UI clearly indicates the chat is shared and view-only.


## US: 005

As a logged-in User, I want to delete or revoke a share link I created, so that I can immediately stop others from accessing that shared chat.

**Acceptance Criteria:**
    - User can revoke any active share link from the chat or from their shared chats list.
    - Revoking a link immediately invalidates it.
    - Anyone visiting a revoked link sees a clear "Link no longer available" message.
    - Revocation is reflected instantly across both private and public link types.


## US: 006

As a logged-in User, I want to view a list of all chats I have shared, so that I can manage my active share links in one place.

**Acceptance Criteria:**
    - User can access a "Shared Chats" section from their account or settings.
    - The list displays each shared chat's name, link type (public/private), and creation date.
    - User can revoke any link directly from the list.
    - List is paginated or scrollable if the number of shared chats is large.
    - Only the authenticated owner can see their own shared chats list.


## US: 007

As a logged-in User, I want to copy a share link to my clipboard with a single click, so that I can quickly share it without manually selecting and copying the URL.

**Acceptance Criteria:**
    - A "Copy Link" button is available alongside the generated share link.
    - Clicking the button copies the full URL to the user's clipboard.
    - A confirmation message or tooltip (e.g. "Link copied!") is shown after copying.
    - The feature works for both public and private share links.
