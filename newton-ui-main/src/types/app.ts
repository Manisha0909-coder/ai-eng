export interface AppState {
  isOpen: boolean;
  screen: "chat" | "communication";
  isGenerating: boolean;
  isLoading: boolean;
  isLoadingMessages: boolean;
  showUploadCard: boolean;
  isLoadingChat: boolean;
  isProcessingQuery: boolean;
}

export const initialAppState: AppState = {
  isOpen: false,
  screen: "chat",
  isGenerating: false,
  isLoading: false,
  isLoadingMessages: false,
  showUploadCard: false,
  isLoadingChat: false,
  isProcessingQuery: false,
};
