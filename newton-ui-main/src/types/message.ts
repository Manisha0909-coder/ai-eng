export interface Message {
  id: string;
  content: string;
  type: "user" | "assistant";
  timestamp: Date;
  isError?: boolean;
  role?: "user" | "assistant";
  date?: string;
  // Edit functionality fields
  isEditing?: boolean;
  originalContent?: string;
  message_id?: string; // ID from backend response for editing
  json_data?: {
    html_data?: string; // generic HTML payload from backend
    // chart_data?: {
    //   type: "bar" | "line" | "radar" | "pie" | "scatter";
    //   data: any[];
    //   title: string;
    //   xAxis?: string;
    //   yAxis?: string;
    //   colors?: string[];
    // };
    // api_chart_data?: {
    //   chart_data: {
    //     data: any[];
    //     layout: any;
    //     template?: string;
    //   };
    //   detailedChartData?: {
    //     cards: Array<{
    //       header: string;
    //       value: string;
    //     }>;
    //   };
    // };
    cards?: any[];
    session_id?: string;
    doc_search_data?: {
      analysis?: string;
      document_search_data?: any[];
    };
    calendar_data?: Array<{
      date: string;
      title: string;
      status: "ongoing" | "upcoming" | "enrolled" | "completed";
      start_date: string;
      end_date: string;
      event_id: number;
      type: string;
    }>;
    forms?: any[];
  };
  // Optional raw HTML payload at root level (some endpoints may send this)
  html_data?: string;
  chat_title?: string;
  attachments?: Array<{
    type: string;
    content: string;
    name: string;
    preview?: string;
    // New fields for uploaded files
    file_id?: string;
    static_path?: string;
    original_filename?: string;
    mimetype?: string;
  }>;
  formFields?: any;
  showEmailForm?: boolean;
  showScheduleMeetingForm?: boolean;
  showSecurityReport?: boolean;
  mode?: string;
  emailContext?: {
    emailId: string;
    conversationId: string;
  };
  ambiguousRecipients?: Array<{
    username: string;
    options: Array<{
      display_name: string;
      email: string;
    }>;
  }>;
  // Chart data support
  // chartData?: {
  //   type?: "bar" | "line" | "radar" | "pie" | "scatter";
  //   data: any[];
  //   title?: string;
  //   xAxis?: string;
  //   yAxis?: string;
  //   colors?: string[];
  //   layout?: {
  //     title?: { text: string };
  //     xaxis?: { title?: { text: string } };
  //     yaxis?: { title?: { text: string } };
  //     template?: string;
  //   };
  //   detailedChartData?: { cards: Array<{ header: string; value: string }> };
  // };
  // API Chart data support (for Plotly charts)
  // apiChartData?: {
  //   chart_data: { data: any[]; layout: any; template?: string };
  //   detailedChartData?: { cards: Array<{ header: string; value: string }> };
  //   assistant_message_chunk?: string;
  //   reasoning_message_chunk?: string;
  // };
  // Calendar data support
  calendarData?: Array<{
    date: string;
    title: string;
    status: "ongoing" | "upcoming" | "enrolled" | "completed";
    start_date: string;
    end_date: string;
    event_id: number;
    type: string;
  }>;
  // Text direction support for Arabic/English rendering
  textDirection?: "rtl" | "ltr";
  // Streaming support
  isStreaming?: boolean;
  assistantMessage?: string;
  reasoningMessage?: string;
  personaId?: number;
  // Document search data
  documentSearchData?: {
    analysis: string;
    document_search_data: Array<{
      id: number;
      title: string;
      url: string;
      content: string;
    }>;
  };
  // Recent chats support
  isFromRecentChats?: boolean;
  showExpiredForm?: boolean;
  // Images support (e.g. from /create streaming API; file_url is optional full download URL)
  images?: Array<{
    image_id: string;
    tool_name: string;
    image_name: string;
    static_path: string;
    file_url?: string;
  }>;
  // Cards support for hotel/resource recommendations
  cards?: Array<{
    id: string;
    type: "card";
    orientation: "portrait" | "landscape";
    content: {
      image?: {
        type: "url";
        value: string;
      };
      title: {
        type: "text";
        value: string;
      };
      description?: {
        type: "text";
        value: string;
      };
      footer?: {
        type: "text";
        value: string;
      };
      metadata?: {
        linkUrl?: string;
        variant?: string;
        interactionType?: "link" | "button";
      };
    };
    metadata?: {
      linkUrl?: string;
      variant?: string;
      interactionType?: "link" | "button";
    };
  }>;
  // Highlight flag for feedback snapshot modal
  isHighlighted?: boolean;
  // Retry support
  isRetrying?: boolean;
  // Tool execution tracking
  toolExecutions?: Array<{
    tool_call_id?: string; // Unique ID from backend to match tool_call with tool_return events
    tool_name: string;
    tool_call_message: string;
    icon_name?: string; // Optional: Backend can specify which icon to use (e.g., "email", "calendar")
    timestamp: number;
    duration?: number; // tool_call_duration - time in seconds (float)
    status?: "running" | "completed" | "success" | "error"; // tool_call_status
  }>;
  // Travel package support
  package?: {
    packageId: string;
    packageName: string;
    currency: string;
    items: Array<{
      id: number;
      type: "visa" | "flight" | "hotel" | "itinerary";
      title: string;
      description: string;
      cost: number | null;
      details: Record<string, any>;
    }>;
    totalCost: number;
    cost_per_passenger?: number;
    discounts: Array<any>;
    taxes: number;
    description?: string;
  };
  packages?: Array<{
    packageId: string;
    packageName: string;
    currency: string;
    items: Array<{
      id: number;
      type: "visa" | "flight" | "hotel" | "itinerary";
      title: string;
      description: string;
      cost: number | null;
      details: Record<string, any>;
    }>;
    totalCost: number;
    cost_per_passenger?: number;
    discounts: Array<any>;
    taxes: number;
    description?: string;
  }>;
  // New interleaved timeline support
  message_timeline?: MessageTimelineEntry[];
}

export type MessageTimelineEntry =
  | ReasoningTimelineEntry
  | AssistantMessageTimelineEntry
  | ToolCallTimelineEntry
  | ToolReturnTimelineEntry;

export interface BaseTimelineEntry {
  type: "reasoning" | "assistant_message" | "tool_call" | "tool_return";
  timestamp: string; // ISO-8601 UTC
}

export interface ReasoningTimelineEntry extends BaseTimelineEntry {
  type: "reasoning";
  content: string;
}

export interface AssistantMessageTimelineEntry extends BaseTimelineEntry {
  type: "assistant_message";
  content: string;
}

export interface ToolCallTimelineEntry extends BaseTimelineEntry {
  type: "tool_call";
  tool_call_id: string;
  tool_name: string;
  tool_icon?: string;
  content: string; // Message to show user while tool runs
  status?: "running" | "completed" | "success" | "error";
  duration?: number;
}

export interface ToolReturnTimelineEntry extends BaseTimelineEntry {
  type: "tool_return";
  tool_call_id: string;
  status: "success" | "error";
  content?: string; // Optional: show status message or result snippet
  duration?: number;
}

// Interface for uploaded file metadata
export interface UploadedFileMetadata {
  file_id: string;
  file_name: string;
  mimetype: string;
  original_filename: string;
  static_path: string;
  processing_result?: any; // Result from file processing status endpoint
}

export interface Suggestion {
  id: string;
  text: string;
}
