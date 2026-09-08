# Newton UI - Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [API Endpoints](#api-endpoints)
3. [Key Components](#key-components)
4. [Session Handling](#session-handling)
5. [Dynamic Forms](#dynamic-forms)
6. [Cards System](#cards-system)
7. [Session Management](#session-management)
8. [Admin Dashboard](#admin-dashboard)
9. [Zustand State Management](#zustand-state-management)
10. [Architecture & Patterns](#architecture--patterns)
11. [Data-Fetching Hooks](#data-fetching-hooks)

---

## Project Overview

Newton UI is a modern, React-based chat application with AI capabilities, built with TypeScript, Vite, and React Router. The application features:

- **Real-time chat interface** with streaming responses
- **Bilingual support** (English/Arabic)
- **Dynamic form generation** with multi-language support
- **Card-based content display** for recommendations
- **Admin dashboard** for user, role, and tool management
- **Session management** with persistent storage
- **Email integration** (Gmail/Outlook)
- **Theme system** with multiple themes
- **Role-Based Access Control (RBAC)**

### Tech Stack
- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.2
- **State Management**: Zustand 4.5.1
- **Routing**: React Router 7.5.0
- **UI Components**: Radix UI, Tailwind CSS
- **Form Management**: React Hook Form 7.54.2
- **Animations**: Framer Motion 12.6.2
- **HTTP Client**: Axios, Fetch API

---

## API Endpoints

### Authentication Endpoints

#### `POST /v1/auth/login`
- **Purpose**: User authentication
- **Description**: Authenticates users with username and password credentials. Returns JWT tokens for subsequent API requests. Handles login errors and token storage in the application state.
- **Request Body**: 
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**: 
  ```json
  {
    "token": "string",
    "access_token": "string"
  }
  ```
- **Usage**: Located in `AuthScreen.tsx`, handles user login and token storage

### Chat Endpoints

#### `POST /v1/chat`
- **Purpose**: Send chat message and receive streaming response
- **Description**: Primary endpoint for sending messages to the AI and receiving real-time streaming responses via Server-Sent Events (SSE). Supports file attachments, email context, and multilingual responses. Streams text chunks, forms, cards, and other structured data as they are generated.
- **Request Body**:
  ```json
  {
    "session_id": "string",
    "query": "string",
    "time_zone": "string",
    "language": "EN" | "AR",
    "email_context": {
      "email_id": "string",
      "conversation_id": "string"
    },
    "file_ids": ["string"],
    "metaData": {
      "mail": {
        "defaultMailService": "string",
        "defaultMailAddress": "string"
      }
    }
  }
  ```
- **Response**: Server-Sent Events (SSE) stream
- **Response Data**:
  - `assistant_message_chunk`: Streaming text chunks
  - `session_id`: Session identifier
  - `chat_title`: Generated chat title
  - `forms`: Dynamic form definitions
  - `calendar_data`: Calendar event data
  - `web_analysis_data`: Web analysis results
  - `document_search_data`: Document search results
  - `cards`: Card recommendations
- **Usage**: Primary chat endpoint in `api.ts` and `streamingApi.ts`

#### `POST /v1/list_message`
- **Purpose**: Fetch messages for a session
- **Description**: Retrieves all messages associated with a specific session ID. Transforms backend message format to frontend format, including attachments, forms, cards, and tool executions. Used to restore chat history when loading a previous conversation.
- **Request Body**:
  ```json
  {
    "session_id": "string"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "messages": [Message[]]
  }
  ```
- **Usage**: Load chat history in `api.ts`

### Session Management Endpoints

#### `GET /v1/list_chat_sessions`
- **Purpose**: Fetch user's chat sessions
- **Description**: Retrieves paginated list of user's chat sessions with metadata like titles, timestamps, and pin status. Supports pagination with offset/limit parameters. Returns total count and hasMore flag for infinite scroll implementation. Sessions are sorted by most recent activity.
- **Query Parameters**:
  - `offset`: number (default: 0)
  - `limit`: number (default: 20)
- **Response**:
  ```json
  {
    "status": "success",
    "sessions": [
      {
        "session_id": "string",
        "chat_title": "string",
        "user_id": "string",
        "is_pin": boolean,
        "updated_at": "string",
        "created_at": "string"
      }
    ],
    "total": number,
    "hasMore": boolean
  }
  ```
- **Usage**: Load chat sessions in sidebar (`AppSidebar.tsx`)

#### `POST /v1/delete_chat_session`
- **Purpose**: Delete a chat session
- **Description**: Permanently deletes a chat session and all associated messages from the backend. If session_id is null, deletes the current session. Updates local state and UI to reflect the deletion. Shows success/error toast notifications to the user.
- **Request Body**:
  ```json
  {
    "session_id": "string" | null
  }
  ```
- **Usage**: Delete chat functionality

#### `POST /v1/update_chat_session_pin`
- **Purpose**: Pin or unpin a chat session
- **Description**: Toggles the pin status of a chat session. Pinned sessions appear at the top of the session list for easy access. Updates the backend and immediately reflects changes in the UI. Provides visual feedback through toast notifications.
- **Request Body**:
  ```json
  {
    "session_id": "string",
    "is_pin": boolean
  }
  ```
- **Usage**: Pin/unpin chats in sidebar

#### `POST /v1/chat_share/create`
- **Purpose**: Create a shareable chat link
- **Description**: Generates a unique, shareable URL for a chat session. Allows users to share conversations with others via a public link. The shared link provides read-only access to the chat history. Returns the shareable URL for copying or direct sharing.
- **Request Body**:
  ```json
  {
    "session_id": "string"
  }
  ```
- **Response**: Share link URL
- **Usage**: Share chat functionality

### Feedback Endpoints

#### `GET /v1/feedback/all`
- **Purpose**: Fetch all feedback with filters
- **Description**: Retrieves paginated feedback entries with optional filtering by status, type, and search terms. Used in the admin dashboard to display user feedback. Supports pagination and real-time filtering. Returns feedback ratings, comments, timestamps, and associated metadata.
- **Query Parameters**:
  - `limit`: number
  - `offset`: number
  - `search`: string
  - `status`: string
  - `type`: string
- **Usage**: Admin dashboard feedback table

#### `GET /v1/feedback/{feedbackId}/snapshots`
- **Purpose**: Fetch chat history snapshots for feedback
- **Description**: Retrieves the complete chat history snapshot associated with a feedback entry. Allows admins to view the conversation context when the feedback was submitted. Includes all messages, forms, cards, and interactions that occurred during that session.
- **Response**: Snapshot data with chat history
- **Usage**: View feedback context

### RBAC Endpoints

#### Tools Management
- **Description**: CRUD operations for managing AI tools. Tools contain Python code that can be executed by the AI. Admins can create, update, and delete tools with descriptions and code definitions. Tools are associated with tags for role-based access control.
- `GET /v1/tools` - List all tools
- `POST /v1/tools` - Create tool
- `PUT /v1/tools/{name}` - Update tool
- `DELETE /v1/tools/{name}` - Delete tool

#### Tags Management
- **Description**: Manages tags that group related tools together. Tags are used to organize tools and assign them to roles. Admins can create tags, associate tools with tags, and manage tag descriptions. Tags provide a hierarchical organization system for the RBAC structure.
- `GET /v1/tags` - List all tags
- `POST /v1/tags` - Create tag
- `PUT /v1/tags/{id}` - Update tag
- `DELETE /v1/tags/{id}` - Delete tag

#### Roles Management
- **Description**: Manages user roles in the RBAC system. Roles are collections of tags that define what tools and resources a user can access. Admins can create roles, assign tags to roles, and manage role descriptions. Roles are then assigned to users to control their permissions.
- `GET /v1/roles` - List all roles
- `POST /v1/roles` - Create role
- `PUT /v1/roles/{id}` - Update role
- `DELETE /v1/roles/{id}` - Delete role

#### Users Management
- **Description**: Manages user accounts with role assignments and persona configuration. Supports paginated user lists, user creation, role assignment, persona association, and document tag management. Users can have multiple roles and one default persona. Includes search functionality for finding users by user_id.
- `GET /v1/users` - List all users (paginated)
- `POST /v1/users` - Create user
- `PUT /v1/users/{id}` - Update user
- `DELETE /v1/users/{id}` - Delete user

#### Document Tags
- **Description**: Manages tags for categorizing and organizing documents in the system. Document tags help users find and filter documents. Admins can create, update, and delete document tags. Tags can be assigned to users to control document access permissions.
- `GET /v1/document_tags` - List document tags
- `POST /v1/document_tags` - Create document tag
- `PUT /v1/document_tags/{id}` - Update document tag
- `DELETE /v1/document_tags/{id}` - Delete document tag

#### Personas
- **Description**: Manages AI personas that define the behavior and personality of the AI assistant. Personas control how the AI responds to users. Admins can create personas, set default personas, and assign personas to users. Each persona has a name and a detailed personality description.
- `GET /v1/personas` - List personas
- `POST /v1/personas` - Create persona
- `PUT /v1/personas/{id}` - Update persona
- `DELETE /v1/personas/{id}` - Delete persona

### File Endpoints

#### Image Fetching
- **Description**: Retrieves images from the backend using file paths. Requires authentication token in headers for secure access. Images are fetched as blobs and converted to object URLs for display. Handles image loading errors and provides fallback placeholders.
- `GET /{filePath}` - Fetch image with token authentication
- **Headers**: `Authorization: Bearer {token}`
- **Usage**: Display images from backend

---

## Key Components

### 1. ChatContainer
**Location**: `src/components/ChatContainer/ChatContainer.tsx`

**Purpose**: Main chat interface container
- **Description**: Central component that renders the chat interface and manages message display. Handles real-time message updates, auto-scrolling to latest messages, and integrates with the chat store for state management. Supports streaming message rendering and provides loading skeletons during message generation.
- Manages message display
- Handles scrolling and message rendering
- Integrates with chat store
- Supports streaming messages

**Key Features**:
- Auto-scroll to bottom
- Message grouping
- Loading states
- Error handling

### 2. ChatMessage
**Location**: `src/components/ChatMessage/ChatMessage.tsx`

**Purpose**: Individual message rendering
- **Description**: Renders individual chat messages with support for various content types including markdown, images, PDFs, forms, cards, and calendar events. Handles both user and assistant messages with different styling. Includes rich text rendering, image carousels, and interactive elements like forms and cards. Supports message editing and read-aloud functionality.
- Supports user and assistant messages
- Renders markdown content
- Displays attachments (images, PDFs)
- Shows dynamic forms
- Displays cards
- Calendar integration
- Web analysis display
- Tool execution visualization

**Key Features**:
- Markdown rendering with syntax highlighting
- Image carousel
- Form rendering with bilingual support
- Card recommendations
- Read-aloud functionality
- Message editing

### 3. ChatInput
**Location**: `src/features/chat/components/ChatInput/ChatInput.tsx`

**Purpose**: Message input component
- **Description**: Provides the input interface for users to compose and send messages. Supports multiline text input, file uploads via drag-and-drop or file picker, voice input through speech-to-text, and language selection. Includes send button, character counter, and file preview functionality. Handles Arabic keyboard input with proper RTL support.
- Text input with multiline support
- File upload (images, PDFs)
- Voice input (STT)
- Language selection
- Send button

**Key Features**:
- File drag-and-drop
- Image preview
- Voice recording
- Arabic keyboard support

### 4. Header
**Location**: `src/components/Header.tsx`

**Purpose**: Application header
- **Description**: Top navigation bar that displays the current chat title, provides access to settings, delete chat functionality, email mode toggle, and share chat options. Shows user information and handles chat-related actions. Updates dynamically based on the current chat session and user permissions.
- Chat title display
- Settings access
- Delete chat
- Email mode toggle
- Share chat

### 5. AppSidebar
**Location**: `src/components/Sidebar/AppSidebar.tsx`

**Purpose**: Sidebar navigation
- **Description**: Left sidebar that displays the list of chat sessions, provides search functionality, and allows users to create new chats, pin/unpin sessions, and delete chats. Shows user profile information and handles session navigation. Supports pagination and infinite scroll for large session lists. Pinned sessions appear at the top for quick access.
- Chat session list
- New chat button
- Search functionality
- Pin/unpin chats
- Delete chats
- User profile

### 6. Dashboard
**Location**: `src/features/dashboard/Dashboard.tsx`

**Purpose**: Admin dashboard
- **Description**: Comprehensive admin interface for managing users, roles, tools, tags, feedback, logs, documents, and personas. Provides CRUD operations for all RBAC entities, real-time log streaming, feedback management with snapshots, and document upload capabilities. Includes pagination, search, filtering, and export functionality. Protected by admin route guard.
- User management
- Role management
- Tool management
- Tag management
- Feedback management
- Logs streaming
- Document management
- Persona management

### 7. ProtectedRoute
**Location**: `src/components/ProtectedRoute.tsx`

**Purpose**: Route protection
- **Description**: Higher-order component that protects routes by checking user authentication status and token validity. Validates JWT tokens, manages session creation, and redirects unauthenticated users to the login page. Handles token expiration and automatic logout. Supports OAuth callback handling for social login integrations.
- Authentication check
- Token validation
- Session management
- Redirect to auth if not authenticated

### 8. AdminProtectedRoute
**Location**: `src/components/AdminProtectedRoute.tsx`

**Purpose**: Admin route protection
- **Description**: Protects admin-only routes by checking if the user has admin privileges. Redirects non-admin users to the main dashboard with an error message. Works in conjunction with ProtectedRoute to ensure both authentication and authorization. Prevents unauthorized access to administrative features.
- Admin role check
- Redirect if not admin

---

## Session Handling

### Session ID Management

Sessions are managed through Zustand store with persistent storage.

#### Session Creation
- **Description**: Session IDs are generated client-side using timestamp and random string, or received from the backend during chat initialization. Created automatically on user login or when starting a new chat. Session IDs are unique identifiers that track conversations and maintain chat history on the backend.
```typescript
// Session ID is generated on login
const generateSessionId = () => {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Stored in useStore
setSessionId(newSessionId);
```

#### Session Storage
- **Description**: Session data is persisted in browser localStorage using Zustand's persist middleware. This ensures session information survives page refreshes and browser restarts. The storage key is 'newton-storage' and includes session ID, user ID, token, and other authentication state.
- **Location**: `src/store/useStore.ts`
- **Persistence**: localStorage via Zustand persist middleware
- **Storage Key**: `newton-storage`

#### Session Usage in API Calls
- **Description**: All chat-related API calls include the session_id in the request body. This allows the backend to associate messages with the correct conversation and maintain chat history. Session ID is retrieved from the Zustand store and automatically included in API requests.
```typescript
// All chat API calls include session_id
const requestBody = {
  session_id: getSessionId(),
  query: messageContent,
  time_zone: timezone,
  language: language
};
```

#### Session from Backend
- **Description**: The backend can return a session_id in the streaming response, especially for new chats. If the session_id differs from the stored value, it's automatically updated in the Zustand store. Session validation ensures the session exists on the server before proceeding with operations.
- Backend can return `session_id` in streaming response
- If session_id changes, it's updated in store
- Session validation checks if session exists on server

#### Session Lifecycle
1. **Creation**: On user login or new chat
2. **Validation**: Check if session exists on server
3. **Update**: Backend can update session_id
4. **Deletion**: On chat deletion or logout
5. **Persistence**: Stored in localStorage

### Session Validation

- **Description**: Validates that a session exists on the server by fetching the user's sessions and checking if the current session_id is present. Returns true if the session exists, false otherwise. Used to verify session validity before performing operations and to handle cases where sessions may have been deleted on the backend.
```typescript
// Validate session exists on server
export const validateSession = async (
  token: string,
  sessionId: string
): Promise<boolean> => {
  const result = await fetchChatSessions(token, userId, 20, 0, true);
  return result.sessions.some((session) => session.session_id === sessionId);
};
```

### Session in Messages

- **Description**: Every message is associated with a session_id that links it to a specific conversation. Messages are fetched from the backend using the session_id, allowing users to resume previous conversations. The backend maintains the complete chat history for each session, enabling message retrieval and session restoration.
- Each message is associated with a session_id
- Messages are fetched by session_id
- Session history is maintained on backend

---

## Dynamic Forms

### Overview

The Dynamic Form system allows the AI to generate forms dynamically based on user queries. Forms support bilingual (English/Arabic) content and multiple field types.

**Location**: `src/features/chat/components/DynamicForm/DynamicForm.tsx`

### Form Field Types

- **Description**: Dynamic forms support 11 different field types, each with specific validation and rendering logic. Fields can be configured with labels, placeholders, default values, and validation rules. All field types support bilingual content (English and Arabic) for internationalization.
1. **text**: Single-line text input with validation and placeholder support
2. **textArea**: Multi-line text input with rich text editor and character limits
3. **email**: Email input with format validation and multiple email support
4. **number**: Numeric input with min/max validation and step increments
5. **date**: Date picker with range validation and locale-specific formatting
6. **select**: Dropdown selection with dynamic options and search functionality
7. **radio**: Radio button group with multiple options and default selection
8. **file**: File upload with type validation, size limits, and progress tracking
9. **button**: Action button that can trigger custom functions or navigation
10. **info**: Information display field for showing read-only content or instructions
11. **submit**: Form submission button that validates and submits the form data

### Form Field Properties

```typescript
type FormField = {
  type: string;
  label: string;
  arabicLabel?: string;
  name: string;
  defaultValue?: string | boolean | string[];
  arabicDefaultValue?: string;
  required?: boolean;
  placeholder?: string;
  arabicPlaceholder?: string;
  visibleToUser?: boolean;
  isMultipleEmail?: boolean;
  submission_endpoint?: string;
  formatCategory?: string;
  readOnly?: boolean;
  options_endpoint?: string;
  options?: Array<{value: string; label: string; arabicLabel?: string}>;
  contentType?: string;
  minValue?: number;
  maxValue?: number;
  min?: number;
  max?: number;
  step?: number;
};
```

### Bilingual Support

- **Description**: Forms fully support bilingual content for English and Arabic languages. The form automatically detects the user's language preference and displays the appropriate labels, placeholders, and default values. Supports RTL (right-to-left) layout for Arabic content and proper text alignment.
Forms support English and Arabic:
- **Labels**: `label` (EN) and `arabicLabel` (AR) - Displayed based on user's language preference
- **Placeholders**: `placeholder` (EN) and `arabicPlaceholder` (AR) - Shown in the selected language
- **Default Values**: `defaultValue` (EN) and `arabicDefaultValue` (AR) - Pre-filled based on language
- **Options**: Each option can have `label` and `arabicLabel` - Dropdown and radio options are localized

### Arabic Keyboard Mapping

- **Description**: Provides phonetic Arabic input by mapping English keyboard layout to Arabic characters. Users can type Arabic text using English keyboard without switching keyboard layouts. Supports all Arabic letters, numbers, and special characters. Includes diacritics and Arabic punctuation marks.
The form includes Arabic keyboard mapping for phonetic input:
- Maps English keyboard layout to Arabic characters - Enables typing Arabic with English keyboard
- Supports Arabic input without switching keyboard layout - Seamless language switching

### Form Submission

#### Submission Endpoint
```typescript
// Forms can specify custom submission endpoint
submission_endpoint: "/v1/endpoint"
```

#### Submission Process
- **Description**: Form submission follows a six-step process: validate all required fields and data formats, collect form data from all fields, send API request to the specified endpoint with enriched data (user_id, session_id, language, timestamp), handle success/error responses, show toast notifications to the user, and update form status (submitting, success, error). The process includes loading states and error recovery.
1. Form validation - Checks required fields, formats, and constraints
2. Data collection - Gathers data from all form fields and file uploads
3. API call to submission endpoint - Sends POST request with enriched form data
4. Success/error handling - Processes response and handles errors gracefully
5. Toast notifications - Shows user feedback for success or error states
6. Form status update - Updates UI to reflect submission state (success/error/read-only)

#### Form Data Enrichment
```typescript
const enrichedFormData = {
  ...formData,
  user_id: getUserIdValue(),
  session_id: getSessionId(),
  language: languageType,
  timestamp: new Date().toISOString()
};
```

### Form Categories

- **Description**: Forms support field categorization for better organization and user experience. Fields can be grouped into categories using the `formatCategory` property. Categories are displayed as section headers with visual separation. Uncategorized fields are displayed in a default section. This helps organize complex forms with many fields.
Forms support categorization for better organization:
- Fields can be grouped by `formatCategory` - Allows logical grouping of related fields
- Categories are displayed as section headers - Provides visual organization and hierarchy
- Uncategorized fields are displayed separately - Shows fields without category assignment

### Form States

- **Description**: Forms have five distinct states that control user interaction and display. The initial state shows the form ready for input. Submitting state disables form fields and shows loading indicator. Success state shows confirmation message and may hide the form. Error state displays error messages and allows retry. Read-only state displays form data without editing capability.
- **Initial**: Form is displayed - Ready for user input with all fields enabled
- **Submitting**: Form is being submitted - Fields disabled, loading indicator shown
- **Success**: Submission successful - Success message displayed, form may be hidden
- **Error**: Submission failed - Error message shown, form remains editable for retry
- **Read-only**: Form cannot be edited - Data displayed but fields are disabled

### Dynamic Options

- **Description**: Forms support dynamic option loading for select and radio fields. Options can be fetched from a backend endpoint specified in the `options_endpoint` property. This allows options to be generated dynamically based on user context, database queries, or other factors. Options are fetched when the form loads and cached for performance.
Forms support dynamic option loading:
```typescript
options_endpoint: "/v1/options"
```

Options are fetched from the endpoint and populated in select/radio fields. - Supports real-time option updates and context-aware selections

### File Upload in Forms

- **Description**: Forms support file uploads with comprehensive validation and user feedback. Users can upload multiple files via drag-and-drop or file picker. Files are validated for type and size before upload. Upload progress is shown to users, and file previews are displayed. Supports images, PDFs, and other document types.
- Support for multiple file uploads - Allows uploading multiple files in a single field
- File size validation - Enforces maximum file size limits (configurable per field)
- File type validation - Restricts file types to allowed formats (images, PDFs, etc.)
- Progress indication - Shows upload progress percentage and status
- File preview - Displays file thumbnails and allows file removal before submission

### Form Integration with Chat

- **Description**: Forms are seamlessly integrated with the chat interface. They are received as part of AI message responses and displayed inline within chat messages. Multiple forms can be displayed in a single message, each with its own submission endpoint. When a form is submitted, the submission result is added as a new message to the chat, maintaining conversation continuity.
- Forms are received in chat message responses - AI generates forms based on user queries
- Forms are displayed inline in chat messages - Rendered as part of the message content
- Multiple forms can be displayed in a single message - Supports complex interactions with multiple forms
- Form submission adds a message to the chat - Submission results become part of the conversation

---

## Cards System

### Overview

The Cards system displays structured content recommendations (hotels, restaurants, flights, etc.) in a carousel format.

**Location**: `src/features/travel/components/Cards/CardsContainer.tsx` and related card components

### Card Structure

```typescript
interface Card {
  id: string;
  type: "card";
  orientation: "portrait" | "landscape";
  category?: string; // "Hotels", "Restaurants", "Flights", etc.
  content: ContentItem[] | ContentItem;
  metadata?: {
    linkUrl?: string;
    variant?: string;
    interactionType?: "link" | "button";
    departureToken?: string;
  };
}

interface ContentItem {
  image?: { type: "url"; value: string };
  title?: { type: "text"; value: string };
  description?: { type: "text"; value: string };
  footer?: { type: "text"; value: string };
  metadata?: {
    linkUrl?: string;
    variant?: string;
    interactionType?: "link" | "button";
  };
}
```

### Card Types

- **Description**: Cards support five main types, each optimized for specific content and interaction patterns. Hotel and restaurant cards include images, descriptions, and location information with Google Maps integration. Flight cards display multiple segments with departure/arrival information. Image cards show galleries with navigation. Resource cards provide general content display.
1. **Hotels**: Hotel recommendations with images, descriptions, ratings, and location - Includes Google Maps links and booking information
2. **Restaurants**: Restaurant recommendations with cuisine type, ratings, and location - Provides maps integration and contact information
3. **Flights**: Flight information with multiple segments, departure/arrival times, and airlines - Shows route details and booking options
4. **Images**: Image galleries with navigation and full-screen viewing - Supports multiple images with carousel navigation
5. **Resources**: General resource cards for various content types - Flexible card format for diverse content

### Card Features

#### Orientation
- **Description**: Cards support two orientation modes that determine the layout and aspect ratio. Portrait orientation displays cards vertically, ideal for mobile devices and image-focused content. Landscape orientation displays cards horizontally, better for desktop viewing and content with more text.
- **Portrait**: Vertical card layout - Optimized for mobile devices and tall content like images
- **Landscape**: Horizontal card layout - Better for desktop and content with more text and details

#### Categories
- **Description**: Cards are organized into categories for easy filtering and navigation. Users can filter cards by category using category buttons. The default category is automatically selected (e.g., "Hotels" if available). Categories are derived from the card data and displayed as filter buttons above the carousel.
- Cards can be filtered by category - Allows users to focus on specific card types
- Category buttons for quick filtering - Provides easy navigation between card categories
- Default category selection (e.g., "Hotels") - Automatically selects the most relevant category

#### Carousel Display
- **Description**: Cards are displayed in a responsive carousel that adapts to screen size. Desktop shows 3 cards, tablet shows 2 cards, and mobile shows 1 card at a time. Includes smooth scrolling animations, navigation arrows for manual control, and indicator dots showing the current position. Supports touch gestures for mobile devices.
- Responsive carousel (3 on desktop, 2 on tablet, 1 on mobile) - Adapts to screen size for optimal viewing
- Smooth scrolling - Provides fluid transitions between cards
- Navigation arrows - Allows manual navigation through cards
- Indicator dots - Shows current position and total number of cards

#### Interactions
- **Description**: Cards support multiple interaction types based on the card's metadata. Link interactions open URLs in new tabs with security attributes. Button interactions trigger custom actions. Google Maps integration automatically generates Maps URLs for restaurants and hotels without explicit links, enabling location-based searches.
- **Link**: Opens URL in new tab - Navigates to external URLs with security attributes (noopener, noreferrer)
- **Button**: Triggers action - Executes custom JavaScript functions or navigation
- **Google Maps**: Auto-generates Maps URL for restaurants/hotels - Creates search URLs for locations without explicit links

### Card Content Rendering

#### Single Content Card
- **Description**: Single content cards display one content item with standard fields: image, title, description, and footer. The layout is optimized for readability and visual appeal. Images are displayed with proper aspect ratios and lazy loading. Title and description support markdown formatting.
- Displays one content item - Shows a single content object with all its properties
- Image, title, description, footer - Standard card fields with proper styling and formatting

#### Multi-Content Card
- **Description**: Multi-content cards display multiple content items in a scrollable container, ideal for flight information with multiple segments or other sequential data. Includes segment indicators showing the number of items and current position. Supports horizontal scrolling with smooth animations.
- Displays multiple content items (e.g., flight segments) - Shows multiple related items in a single card
- Scrollable content - Allows navigation through multiple items within the card
- Segment indicators - Shows position and total number of segments

### Card Integration with Chat

- **Description**: Cards are seamlessly integrated with the chat interface. They are received as part of AI message responses and displayed inline within chat messages. Multiple cards can be displayed in a single message, organized by category. Cards are automatically filtered and categorized based on their metadata, providing a clean and organized presentation.
- Cards are received in chat message responses - AI generates cards based on user queries and context
- Displayed inline in chat messages - Rendered as part of the message content with proper styling
- Multiple cards can be displayed - Supports showing multiple recommendations in one message
- Cards are filtered and categorized automatically - Organizes cards by category for better user experience

### Card Click Handling

```typescript
onClick={() => {
  if (linkUrl && (interactionType === "link" || interactionType === undefined)) {
    window.open(linkUrl, '_blank', 'noopener,noreferrer');
  }
}}
```

### Image Loading

- **Description**: Card images are loaded efficiently using lazy loading techniques to improve performance. Images that fail to load are handled gracefully with error states and placeholder images. Image dimensions are tracked to maintain proper aspect ratios and prevent layout shifts. Supports progressive image loading for better user experience.
- Lazy loading for performance - Images load only when visible, reducing initial page load time
- Image error handling - Shows placeholders or error states when images fail to load
- Placeholder images - Displays default images while loading or on error
- Image dimensions tracking - Maintains proper aspect ratios and prevents layout shifts

---

## Session Management

### Overview

Session management handles chat sessions, including creation, retrieval, deletion, and pinning.

### Session Operations

#### 1. Create Session
- **Description**: Sessions are automatically created when a user starts a new chat. The session ID can be generated client-side using a combination of timestamp and random string, or received from the backend during the first message. The session ID is stored in the Zustand store with persistence, ensuring it survives page refreshes.
- Automatically created on new chat - No manual session creation required
- Session ID generated client-side or received from backend - Flexible session ID generation
- Stored in Zustand store with persistence - Survives page refreshes and browser restarts

#### 2. Fetch Sessions
- **Description**: Retrieves a paginated list of user's chat sessions from the backend. Supports pagination with limit and offset parameters. Returns session metadata including titles, timestamps, pin status, and creation dates. Includes total count and hasMore flag for implementing infinite scroll or pagination controls.
```typescript
const sessions = await fetchChatSessions(token, userId, limit, offset);
```

**Parameters**:
- `token`: Authentication token - Required for authorization
- `userId`: User identifier - Filters sessions for specific user
- `limit`: Number of sessions to fetch - Controls page size
- `offset`: Pagination offset - Enables pagination through sessions

**Response**:
- List of sessions with metadata - Sessions with titles, timestamps, and pin status
- Total count - Total number of sessions for the user
- Has more flag for pagination - Indicates if more sessions are available

#### 3. Delete Session
- **Description**: Permanently deletes a chat session from the backend and removes it from the local store. Updates the UI to reflect the deletion, including removing the session from the sidebar list. If the deleted session was the current session, switches to another session or creates a new one. Shows success/error toast notifications.
```typescript
await deleteChatSession(token, sessionId);
```

- Deletes session from backend - Removes session and all associated messages from server
- Removes from local store - Clears session from Zustand store and localStorage
- Updates UI - Reflects deletion in sidebar and chat interface immediately

#### 4. Pin/Unpin Session
- **Description**: Toggles the pin status of a chat session. Pinned sessions appear at the top of the session list for easy access, regardless of their last update time. The pin status is persisted on the backend and immediately reflected in the UI. Provides visual distinction for pinned sessions and supports quick access to important conversations.
```typescript
await updateChatPin(token, sessionId, isPin);
```

- Pins session to top of list - Moves session to the top of the sidebar for quick access
- Unpins session - Removes pin status and returns session to normal sorting
- Updates UI immediately - Reflects pin status change without page refresh

#### 5. Load Session Messages
- **Description**: Retrieves all messages for the current session from the backend. Transforms the backend message format to the frontend format, including handling attachments, forms, cards, tool executions, and other message types. Restores the complete chat history, allowing users to continue previous conversations seamlessly.
```typescript
const messages = await fetchUserMessages(token);
```

- Fetches all messages for current session - Retrieves complete chat history from backend
- Transforms backend format to frontend format - Converts message structure for UI rendering
- Handles attachments, forms, cards, etc. - Processes all message types and embedded content

### Session State Management

#### Store Structure
```typescript
interface AuthState {
  sessionId: string | null;
  setSessionId: (sessionId: string | null) => void;
}
```

#### Session Persistence
- **Description**: Session data is persisted in browser localStorage using Zustand's persist middleware. This ensures that session information, including session ID, user ID, and authentication token, survives page refreshes and browser restarts. Session data is automatically cleared when the user logs out, maintaining security and privacy.
- Stored in localStorage via Zustand persist - Uses browser localStorage for persistence
- Persisted across page refreshes - Session data survives page reloads
- Cleared on logout - Session data is removed when user logs out for security

### Session Validation

```typescript
// Check if session exists on server
const isValid = await validateSession(token, sessionId);
```

### Session Lifecycle

- **Description**: Sessions go through a five-stage lifecycle from creation to deletion. Created automatically on user login or when starting a new chat. Messages are loaded when a session is opened. Sessions become active when the user is actively chatting. Completed sessions are archived but remain accessible. Sessions can be deleted permanently by the user.
1. **Creation**: On login or new chat - Session ID generated and stored
2. **Loading**: Fetch messages for session - Restore chat history from backend
3. **Active**: User is chatting - Session is actively being used for conversation
4. **Archived**: Session is completed - Session is no longer active but preserved
5. **Deleted**: Session is removed - Session and messages permanently deleted

### Session List Display

- **Description**: The session list in the sidebar displays sessions with intelligent sorting and filtering. Sessions are sorted by most recent activity (updated_at), with pinned sessions always appearing at the top. Includes search functionality to find specific sessions. Supports pagination and infinite scroll for handling large numbers of sessions efficiently.
- Sorted by updated_at (most recent first) - Shows most recently active sessions first
- Pinned sessions at top - Pinned sessions always appear above unpinned sessions
- Search functionality - Allows users to search sessions by title or content
- Pagination support - Handles large numbers of sessions with pagination
- Infinite scroll option - Alternative to pagination, loads more sessions on scroll

---

## Admin Dashboard

### Overview

The Admin Dashboard provides comprehensive management tools for users, roles, tools, tags, feedback, logs, documents, and personas.

**Location**: `src/components/Dashboard/Dashboard.tsx`

### Dashboard Tabs

#### 1. Tools Management
- **Description**: Comprehensive tool management interface for creating, editing, and deleting AI tools. Tools contain Python code that can be executed by the AI assistant. Admins can view all tools, create new ones with code and descriptions, update existing tools, and delete tools. Tools are associated with tags for role-based access control.
- **List Tools**: View all available tools - Displays all tools with names, types, and descriptions
- **Create Tool**: Add new tool with Python code - Creates new tools with executable Python code
- **Edit Tool**: Update tool description and code - Modifies existing tools and their code
- **Delete Tool**: Remove tool - Permanently removes tools from the system
- **Tool Details**: Name, type, description, Python code - Shows complete tool information and code

#### 2. Tags Management
- **Description**: Manages tags that group related tools together for organization and access control. Admins can view all tags, create new tags with tool associations, update tag names and descriptions, associate/disassociate tools, and delete tags. Tags are used in the RBAC system to control which tools users can access based on their roles.
- **List Tags**: View all tags - Displays all tags with their descriptions and associated tools
- **Create Tag**: Add new tag with tool associations - Creates tags and links them to tools
- **Edit Tag**: Update tag name, description, and tools - Modifies tag properties and tool associations
- **Delete Tag**: Remove tag - Permanently removes tags from the system
- **Tag Details**: Name, description, associated tools - Shows complete tag information and tool list

#### 3. Roles Management
- **Description**: Manages user roles in the RBAC system. Roles are collections of tags that define what tools and resources users can access. Admins can view all roles, create new roles with tag associations, update role names and descriptions, modify tag associations, and delete roles. Roles are then assigned to users to control their permissions.
- **List Roles**: View all roles - Displays all roles with descriptions and associated tags
- **Create Role**: Add new role with tag associations - Creates roles and links them to tags
- **Edit Role**: Update role name, description, and tags - Modifies role properties and tag associations
- **Delete Role**: Remove role - Permanently removes roles from the system
- **Role Details**: Name, description, associated tags - Shows complete role information and tag list

#### 4. Users Management
- **Description**: Comprehensive user management interface for creating, editing, and deleting user accounts. Users can be assigned multiple roles and one default persona. Supports document tag assignment for controlling document access. Includes search functionality and pagination for handling large user lists. Provides detailed user information including roles, persona, and document tags.
- **List Users**: View all users (paginated) - Displays users with pagination support
- **Create User**: Add new user with roles and persona - Creates users and assigns roles/persona
- **Edit User**: Update user roles, persona, and document tags - Modifies user properties and assignments
- **Delete User**: Remove user - Permanently removes users from the system
- **User Details**: User ID, roles, persona, document tags - Shows complete user information
- **Search**: Search users by user_id - Allows finding users by their user ID
- **Pagination**: Page size options (5, 10, 25, 50, 100) - Configurable page sizes for user list

#### 5. Feedback Management
- **Description**: Manages user feedback with comprehensive filtering and viewing capabilities. Admins can view all feedback entries, filter by status and type, search feedback, view chat history snapshots associated with feedback, and export feedback to CSV/Excel. Provides detailed feedback information including ratings, comments, status, type, and timestamps.
- **List Feedback**: View all feedback entries - Displays all user feedback with pagination
- **Filter Feedback**: By status, type, search term - Allows filtering and searching feedback
- **View Snapshots**: View chat history for feedback - Shows the conversation context for feedback
- **Export Feedback**: Export to CSV/Excel - Exports feedback data for analysis
- **Feedback Details**: Rating, comment, status, type, timestamp - Shows complete feedback information

#### 6. Logs Streaming
- **Description**: Real-time log streaming interface that displays application logs as they occur. Supports filtering by log level (INFO, WARN, ERROR, DEBUG), endpoint, user, and request ID. Shows connection status and allows exporting logs to CSV. Displays detailed log information including timestamps, levels, messages, endpoints, and user identifiers. Useful for debugging and monitoring application behavior.
- **Live Logs**: Real-time log streaming - Displays logs as they are generated
- **Log Filters**: Filter by level, endpoint, user, request ID - Allows filtering logs by various criteria
- **Log Export**: Export logs to CSV - Exports filtered logs for analysis
- **Log Details**: Timestamp, level, message, endpoint, user - Shows complete log information
- **Connection Status**: Show connection status - Indicates if log stream is connected
- **Log Levels**: INFO, WARN, ERROR, DEBUG - Supports different log severity levels

#### 7. Document Management
- **Description**: Manages documents in the system with tagging and search capabilities. Admins can upload documents with associated tags, view all documents, manage document tags, and search documents. Documents are organized by tags for easy access and filtering. Supports various document types and provides document metadata management.
- **Upload Documents**: Upload documents with tags - Allows uploading documents with tag associations
- **List Documents**: View all documents - Displays all documents with their tags and metadata
- **Document Tags**: Manage document tags - Creates and manages tags for document organization
- **Document Search**: Search documents - Allows searching documents by name, content, or tags

#### 8. Persona Management
- **Description**: Manages AI personas that define the behavior and personality of the AI assistant. Admins can view all personas, create new personas with names and descriptions, update existing personas, delete personas, and set default personas. Personas control how the AI responds to users and can be assigned to specific users or used as system defaults.
- **List Personas**: View all personas - Displays all personas with their names and descriptions
- **Create Persona**: Add new persona - Creates new personas with personality definitions
- **Edit Persona**: Update persona - Modifies persona names and descriptions
- **Delete Persona**: Remove persona - Permanently removes personas from the system
- **Set Default**: Set default persona - Sets a persona as the system default

### Dashboard Features

#### Pagination
- **Description**: Comprehensive pagination system that supports configurable page sizes, page navigation, total count display, and displayed items count. Allows users to navigate through large datasets efficiently. Supports page size options (5, 10, 25, 50, 100) and provides visual feedback on current page and total items.
- Configurable page size - Allows users to choose how many items to display per page
- Page navigation - Provides previous/next buttons and direct page number access
- Total count display - Shows total number of items in the dataset
- Displayed items count - Indicates how many items are currently visible

#### Search & Filtering
- **Description**: Advanced search and filtering capabilities that allow users to find specific items quickly. Supports searching by name, ID, or description with debounced input to reduce API calls. Provides real-time filtering by status, type, and level. Filters are applied immediately as users type, providing instant feedback.
- Search by name, ID, or description - Allows finding items by various text fields
- Filter by status, type, level - Provides filtering by categorical fields
- Debounced search input - Reduces API calls by waiting for user to finish typing
- Real-time filtering - Applies filters immediately as users interact with controls

#### Export Functionality
- **Description**: Data export functionality that allows admins to export data to CSV/Excel formats. Supports exporting filtered data, ensuring that only the currently visible/filtered items are exported. Handles large datasets efficiently with streaming exports and progress indicators. Useful for data analysis and reporting.
- Export to CSV/Excel - Exports data in common spreadsheet formats
- Filtered data export - Exports only the currently filtered/visible data
- Large dataset support - Handles large exports efficiently with streaming

#### Responsive Design
- **Description**: Fully responsive design that adapts to different screen sizes and devices. Mobile-friendly layout optimizes the interface for small screens with touch-friendly controls. Tablet optimization provides a balanced experience with medium-sized screens. Desktop version includes all features with full functionality and optimal use of screen space.
- Mobile-friendly layout - Optimized for small screens with touch-friendly controls
- Tablet optimization - Balanced layout for medium-sized screens
- Desktop full features - Complete feature set with optimal screen space usage

#### Admin Protection
- **Description**: Security mechanism that restricts dashboard access to admin users only. Checks user roles and permissions before allowing access. Non-admin users are automatically redirected to the main dashboard with an error message. Works in conjunction with authentication to ensure both logged-in status and admin privileges.
- Admin-only access - Restricts dashboard to users with admin role
- Role-based permissions - Checks user roles before granting access
- Redirect if not admin - Automatically redirects non-admin users with error message

### Dashboard State Management

- **Description**: Dashboard state is managed using Zustand stores for global state and React useState for local component state. API calls are made through the `rbacApi.ts` service layer. Supports real-time updates when data changes and includes comprehensive error handling with user-friendly error messages and retry mechanisms.
- Uses Zustand for state - Global state management with Zustand stores
- API calls via `rbacApi.ts` - Centralized API service for RBAC operations
- Real-time updates - Updates UI when data changes on the backend
- Error handling - Comprehensive error handling with user feedback

---

## Zustand State Management

### Overview

Zustand is used for state management throughout the application. Multiple stores handle different aspects of the application state.

### Stores

#### 1. useStore (Main Auth Store)
**Location**: `src/store/useStore.ts`

**Purpose**: Main authentication and app state
- **Description**: Central store for authentication state, user information, session management, theme settings, and application-wide configuration. Manages JWT tokens, user IDs, session IDs, admin status, and theme preferences. Provides login/logout functionality and persists critical state to localStorage. Includes selectors for accessing state outside of React components.

**State**:
```typescript
interface AuthState {
  isAdmin: boolean;
  isAuthenticated: boolean;
  token: string;
  userId: string;
  sessionId: string | null;
  theme: "dark" | "light";
  apiKey: string;
  hasShownSTTMessage: boolean;
  activeThemeName: string | null;
  activeThemeEnvName: string | null;
  selectedEmailService: string;
  allowedUsers: string[];
  userSuggestions: any[];
  emailAuthStatus: any | null;
  dashboardActiveTab: string | null;
}
```

**Actions**:
- `setToken(token: string)`
- `setUserId(userId: string)`
- `setSessionId(sessionId: string | null)`
- `setIsAdmin(isAdmin: boolean)`
- `setTheme(theme: "dark" | "light")`
- `login()`
- `logout()`
- `setDashboardActiveTab(tab: string | null)`

**Persistence**: localStorage (`newton-storage`)

**Selectors**:
- `getAuthState()`
- `getAccessToken()`
- `getSessionId()`
- `getUserIdValue()`
- `setSessionIdValue(sessionId)`

#### 2. useChatStore
**Location**: `src/store/chatStore.ts`

**Purpose**: Chat and message management

**State**:
```typescript
interface ChatState {
  chats: Chat[];
  currentChatId: string | null;
}
```

**Actions**:
- `addChat(chat: Chat)`
- `updateChat(chatId: string, messages: Message[])`
- `setCurrentChat(chatId: string | null)`
- `updateChatTitle(chatId: string, title: string)`
- `deleteChat(chatId: string)`
- `addMessageById(id: string, message: Message)`
- `clearAllChats()`

**Persistence**: localStorage (`chat-storage`)

#### 3. useMessageStore
**Location**: `src/store/useMessageStore.ts`

**Purpose**: Message state management

**State**:
```typescript
interface MessageState {
  messages: Message[];
}
```

**Actions**:
- `setMessages(messages: Message[])`
- `addMessage(message: Message)`
- `addMessageById(id: string, message: Message)`
- `clearMessages()`

**Persistence**: localStorage

#### 4. useEmailStore
**Location**: `src/store/emailStore.ts`

**Purpose**: Email state management

**State**:
```typescript
interface EmailStore {
  isReplyClicked: boolean;
  isReplyAllClicked: boolean;
  isForwardClicked: boolean;
  activeCard: EmailCard | null;
  removedCards: string[];
}
```

**Actions**:
- `setReplyClicked(value: boolean)`
- `setReplyAllClicked(value: boolean)`
- `setForwardClicked(value: boolean)`
- `setActiveCard(card: EmailCard | null)`
- `removeCard(cardId: string)`
- `clearActiveCard()`

**Persistence**: localStorage (`email-storage`)

#### 5. useEmailModeStore
**Location**: `src/store/useEmailMode.ts`

**Purpose**: Email mode and service management

**State**:
```typescript
interface EmailModeState {
  isGmail: boolean;
  isOutlook: boolean;
  isBoth: boolean;
  gmailUserId: string;
  outlookUserId: string;
  emailMode: "gmail" | "outlook" | "both";
  defaultMailService: string;
  defaultMailAddress: string;
}
```

**Actions**:
- `setIsGmail(isGmail: boolean)`
- `setIsOutlook(isOutlook: boolean)`
- `setIsBoth(isBoth: boolean)`
- `setGmailUserId(userId: string)`
- `setOutlookUserId(userId: string)`
- `setEmailMode(mode: "gmail" | "outlook" | "both")`
- `setDefaultMailService(service: string)`
- `setDefaultMailAddress(address: string)`

**Persistence**: localStorage (`email-mode`)

#### 6. useLanguageStore
**Location**: `src/store/languageStore.ts`

**Purpose**: Language and keyboard management

**State**:
```typescript
interface LanguageState {
  languageType: 'EN' | 'AR';
  keyboardDirection: 'ltr' | 'rtl';
  keyboardLanguage: 'en' | 'ar';
}
```

**Actions**:
- `setLanguageType(languageType: 'EN' | 'AR')`
- `setKeyboardDirection(direction: 'ltr' | 'rtl')`
- `setKeyboardLanguage(language: 'en' | 'ar')`

**Persistence**: localStorage

#### 7. useTTSStore
**Location**: `src/store/ttsStore.ts`

**Purpose**: Text-to-speech state management

**State**:
```typescript
interface TTSStore {
  isListening: boolean;
  isSpeaking: boolean;
  isSTTActive: boolean;
}
```

**Actions**:
- `setIsListening(isListening: boolean)`
- `setIsSpeaking(isSpeaking: boolean)`
- `setIsSTTActive(isSTTActive: boolean)`

**Persistence**: localStorage (`tts-storage`)

#### 8. useScreenStore
**Location**: `src/store/useScreenStore.ts`

**Purpose**: Screen navigation state

**State**:
```typescript
interface ScreenState {
  screen: "chat" | "communication" | 'auth';
}
```

**Actions**:
- `setScreen(screen: "chat" | "communication" | 'auth')`

**Persistence**: localStorage (`screen-storage`)

### Zustand Patterns

#### Store Creation
```typescript
export const useStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      token: "",
      // Actions
      setToken: (token) => set({ token }),
    }),
    {
      name: "storage-key",
      partialize: (state) => ({
        // Select what to persist
        token: state.token,
      }),
    }
  )
);
```

#### Using Stores
```typescript
// In component
const { token, setToken } = useStore();

// Outside component
const token = useStore.getState().token;
useStore.getState().setToken("new-token");

// Selectors
const token = useStore((state) => state.token);
```

#### Persistence
- Uses `zustand/middleware/persist`
- Stores data in localStorage
- Supports partial persistence
- Automatic serialization/deserialization

### Store Best Practices

1. **Separation of Concerns**: Each store handles a specific domain
2. **Persistence**: Only persist necessary state
3. **Selectors**: Use selectors to avoid unnecessary re-renders
4. **Actions**: Keep actions pure and predictable
5. **Type Safety**: Use TypeScript interfaces for state

---

## Architecture & Patterns

### Project Structure

```
src/
├── assets/
├── components/              # Truly shared UI components only
│   ├── ContentLoader.tsx    # Loading spinner (shared across 3+ features)
│   ├── IFrame.tsx           # Embeddable iframe (shared by chat + visualization)
│   ├── DataTable/           # Reusable data table with pagination/sorting
│   ├── SearchableDropdown/  # Searchable dropdown select
│   ├── Calendar/            # Calendar component (chat + travel)
│   └── ui/                  # shadcn/Radix primitives (button, input, dialog, etc.)
├── config/                  # API endpoint configuration
├── constants/               # App-wide constants
├── features/                # Feature modules (each follows canonical template)
│   ├── auth/                # Authentication & route protection
│   ├── chat/                # Chat interface
│   │   ├── components/      # ChatInput, ChatMessage, DynamicForm, ErrorCard, etc.
│   │   └── hooks/           # useChatInputState, useFileUpload, useStopRequest
│   ├── dashboard/           # Admin dashboard
│   │   ├── components/      # Forms/, Modals/, Persona, GridList, etc.
│   │   ├── hooks/           # React Query hooks + useDropdown
│   │   ├── sections/        # Tab sections (Tools, Tags, Roles, Users, etc.)
│   │   └── utils/           # dashboardHelper, dashboardRowActionStyles
│   ├── documents/           # Document management
│   ├── payments/            # Payment processing
│   ├── search/              # Search functionality
│   ├── settings/            # User settings
│   ├── tools/               # Tool execution display
│   ├── travel/              # Travel cards & packages
│   └── visualization/       # Charts & data visualization
├── hooks/                   # Global, cross-feature hooks
├── layouts/                 # App layout components (Header, Sidebar, ProtectedRoute)
├── routes/                  # Centralized route definitions
│   └── index.tsx
├── services/                # Domain-scoped API services
│   ├── api/                 # HTTP client (axios instance)
│   ├── chat/                # Chat API, streaming, SSE
│   ├── rbac/                # RBAC API (roles, users, tools, tags, personas)
│   ├── datasources/         # Data source CRUD
│   ├── user/                # User profile, auth, token refresh
│   ├── infrastructure/      # Analytics, TTS, STT, themes, settings
│   ├── visualization/       # Default dashboard API
│   ├── documents/           # File operations
│   └── travel/              # Travel booking API
├── store/                   # Global Zustand stores
├── styles/                  # Global styles & themes
├── types/                   # Shared TypeScript types
└── utils/                   # Shared utility functions
```

### Canonical Feature Template

Every feature follows the same directory structure:

```
src/features/{feature}/
├── components/          # Feature-scoped UI components
│   └── {Component}/
├── hooks/               # Feature-scoped hooks (data-fetching, UI logic)
├── sections/            # Tab/page sections (optional, used by dashboard)
├── utils/               # Feature-scoped utilities (optional)
├── types.ts             # Feature-scoped types (optional)
└── index.ts             # Public API barrel export
```

### Component Ownership Rules

| Rule | Description |
|---|---|
| Used by 2+ features | Lives in `/components/` |
| Used by 1 feature only | Lives in `/features/{feature}/components/` |
| Feature A needs Feature B's component | Component must be promoted to `/components/` first |
| Unused | Delete |

### Hook Location Rules

| Hook Type | Location |
|---|---|
| Cross-feature, global | `/hooks/` |
| Feature-specific | `/features/{feature}/hooks/` |
| Data-fetching (React Query) | `/features/{feature}/hooks/use{Entity}Query.ts` |
| Zustand store (global) | `/store/` |

### Data Flow

1. **User Action** → Component
2. **Component** → Store Action
3. **Store Action** → API Service
4. **API Service** → Backend
5. **Backend** → API Service
6. **API Service** → Store Update
7. **Store Update** → Component Re-render

### State Management Pattern

- **Global State**: Zustand stores
- **Local State**: React useState
- **Server State**: API responses cached in stores
- **Form State**: React Hook Form

### API Communication Pattern

Services are organized by domain under `src/services/`. Each subdirectory owns one domain:

```typescript
// Service layer (src/services/rbac/rbacApi.ts)
export const rbacApi = {
  tags: {
    list: (params) => apiCall("GET", "/v1/tags", params),
    create: (data) => apiCall("POST", "/v1/tags", data),
    update: (id, data) => apiCall("PUT", `/v1/tags/${id}`, data),
    delete: (id) => apiCall("DELETE", `/v1/tags/${id}`),
  },
  // ... other entities
};

// Data-fetching hook (src/features/dashboard/hooks/useTagsQuery.ts)
export function useTagsQuery({ page, pageSize, search, enabled }) {
  return useQuery({
    queryKey: ["dashboard-tags", page, pageSize, search],
    queryFn: () => rbacApi.tags.list({ limit: pageSize, offset: (page - 1) * pageSize, search }),
    enabled,
  });
}

// Component usage
const tagsQuery = useTagsQuery({ page: 1, pageSize: 50, search: "test", enabled: true });
const tags = tagsQuery.data?.data ?? [];
```

### Error Handling

- API errors handled in services
- Toast notifications for user feedback
- Error boundaries for component errors
- Fallback UI for error states

### Performance Optimization

- React.memo for component memoization
- useMemo for expensive computations
- useCallback for function stability
- Lazy loading for routes
- Image lazy loading
- Virtual scrolling for long lists

### Security

- Token-based authentication
- Token expiration checking
- Protected routes
- Admin route protection
- Input validation
- XSS prevention in markdown

### Internationalization

- Bilingual support (EN/AR)
- Language store
- RTL support
- Arabic keyboard mapping
- Localized date/time formatting

---

## Data-Fetching Hooks

### Overview

The dashboard uses React Query (`@tanstack/react-query`) hooks for server state management. These hooks replace manual `useState`/`useCallback`/`useEffect` patterns with declarative data fetching.

**Location**: `src/features/dashboard/hooks/`

### Available Hooks

#### Query Hooks (read data)

| Hook | Purpose | Parameters |
|---|---|---|
| `useTagsQuery()` | Fetch paginated tags | `page`, `pageSize`, `search`, `toolNames`, `enabled` |
| `useRolesQuery()` | Fetch paginated roles | `page`, `pageSize`, `search`, `documentTagIds`, `personaIds`, `enabled` |
| `useUsersQuery()` | Fetch paginated users | `page`, `pageSize`, `search`, `roles`, `enabled` |
| `useDocumentTagsQuery()` | Fetch paginated document tags | `page`, `pageSize`, `search`, `enabled` |
| `usePersonaMemoryBlocksQuery()` | Fetch paginated memory blocks | `page`, `pageSize`, `search`, `personaId`, `enabled` |
| `useToolsQuery()` | Fetch tools | `pageSize`, `search`, `type`, `toolServer`, `enabled` |
| `useToolServerFilterOptions()` | Fetch tool server filter options | `enabled` |
| `useAvailableRoles()` | Fetch all role names for filter dropdowns | none |

#### Mutation Hooks (write data)

Each entity has `useCreate{Entity}()`, `useUpdate{Entity}()`, and `useDelete{Entity}()` hooks. Mutations automatically invalidate the related query cache.

| Hook | Purpose |
|---|---|
| `useCreateTag()`, `useUpdateTag()`, `useDeleteTag()` | Tag CRUD mutations |
| `useCreateRole()`, `useUpdateRole()`, `useDeleteRole()` | Role CRUD mutations |
| `useCreateUser()`, `useUpdateUser()`, `useDeleteUser()` | User CRUD mutations |
| `useCreateDocumentTag()`, `useUpdateDocumentTag()`, `useDeleteDocumentTag()` | Document tag CRUD mutations |
| `useCreatePersonaMemoryBlock()`, `useUpdatePersonaMemoryBlock()`, `useDeletePersonaMemoryBlock()` | Memory block CRUD mutations |
| `useUpdateTool()`, `useDeleteTool()` | Tool mutations |

### Usage Pattern

```tsx
import { useTagsQuery, useCreateTag, useDeleteTag } from "./hooks/useTagsQuery";

function TagsSection() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Query - auto-fetches, caches, and refetches when params change
  const { data, isLoading, error, refetch } = useTagsQuery({
    page,
    pageSize: 50,
    search,
    enabled: true,
  });

  // Mutations - auto-invalidate cache on success, show toast on error
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();

  const handleCreate = (tagData) => {
    createTag.mutate(tagData, {
      onSuccess: () => setFormOpen(false),
    });
  };

  const handleDelete = (tagId) => {
    deleteTag.mutate(tagId);
    // No manual refetch needed - cache auto-invalidates
  };

  if (isLoading) return <ContentLoader />;
  if (error) return <ErrorRetry onRetry={refetch} />;

  return <TagsList tags={data.data} total={data.total} />;
}
```

### React Query Configuration

Configured in `src/main.tsx`:
- **refetchOnWindowFocus**: `false` - prevents refetches when tab regains focus
- **retry**: `1` - single retry on failure
- **staleTime**: `5 minutes` - data considered fresh for 5 minutes (hooks override to 30s for dashboard data)

---

## Conclusion

This documentation provides a comprehensive overview of the Newton UI project, covering:

- API endpoints and usage
- Key components and their purposes
- Session handling and management
- Dynamic forms system
- Cards system
- Admin dashboard features
- Zustand state management
- Architecture patterns

For more details on specific implementations, refer to the source code in the respective files mentioned in each section.

