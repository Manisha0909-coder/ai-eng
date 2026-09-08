import { Message } from '../../types/message';
// import { sendMessageToAPI, handleApiError } from './api';
// import { validateFileSize, validateImageDimensions, readFileAsBase64 } from './file';

export interface ChatState {
  messages: Message[];
  isTyping: boolean;
  error: string | null;
  ambiguousRecipients?: Array<{
    username: string;
    options: Array<{
      display_name: string;
      email: string;
    }>;
  }>;
}

export const initialState: ChatState = {
  messages: [],
  isTyping: false,
  error: null,
  ambiguousRecipients: [],
};

export const addMessage = (state: ChatState, message: Message): ChatState => {
  return {
    ...state,
    messages: [...state.messages, message],
    isTyping: false,
  };
};

export const setTyping = (state: ChatState, isTyping: boolean): ChatState => {
  return {
    ...state,
    isTyping,
  };
};

export const setError = (state: ChatState, error: string): ChatState => {
  return {
    ...state,
    error,
    isTyping: false,
  };
};

// export const processMessage = async (
//   language: "EN" | "AR",
//   state: ChatState,
//   content: string,
//   file: File | undefined,
//   model: string,
//   token: string,
//   targetedModel?: string,
//   mode?: string,
//   signal?: AbortSignal,
//   setIsGenerating?: (isGenerating: boolean) => void,
//   emailContext?: {
//     emailId: string;
//     conversationId: string;
//   },
//   messageId?: string // Add message_id for edit functionality
// ): Promise<ChatState> => {
//   try {
//     let message: Message = {
//       id: Date.now().toString(),
//       content,
//       type: "user",
//       timestamp: new Date(),
//       mode,
//       emailContext
//     };

//     if (file) {
//       const sizeError = validateFileSize(file);
//       if (sizeError) {
//         setIsGenerating?.(false);
//         return setError(state, sizeError);
//       }

//       const dimensionError = await validateImageDimensions(file);
//       if (dimensionError) {
//         setIsGenerating?.(false);
//         return setError(state, dimensionError);
//       }

//       const base64Content = await readFileAsBase64(file);
//       message.attachments = [{
//         type: file.type,
//         content: base64Content,
//         name: file.name,
//       }];
//     }

//     const newState = addMessage(state, message);
//     const typingState = setTyping(newState, true);

//     const response = await sendMessageToAPI(message, model, token, messageId, undefined, mode, signal, language);
    
//     // Extract ambiguous recipients from the response if present
//     if (response.ambiguousRecipients) {
//       return {
//         ...addMessage(typingState, response),
//         ambiguousRecipients: response.ambiguousRecipients
//       };
//     }
    
//     return addMessage(typingState, response);
//   } catch (error) {
//     setIsGenerating?.(false);
//     if (error instanceof Error && error.name === 'AbortError') {
//       const stopMessage = {
//         id: (Date.now() + 1).toString(),
//         content: "Generation Stopped",
//         type: "assistant" as const,
//         timestamp: new Date(),  
//         mode: mode,
//       } as Message;
//       return addMessage(setTyping(state, true), stopMessage);
//     }
//     const stopMessage = {
//       id: (Date.now() + 1).toString(),
//       content: "Sorry, there was an error processing your request. Please try again.",
//       type: "assistant" as const,
//       timestamp: new Date(),  
//       mode: mode,
//     } as Message;
    
//     return addMessage(setError(state, handleApiError(error)), stopMessage);
//   }
// };

export const clearChat = (): ChatState => {
  return initialState;
}; 