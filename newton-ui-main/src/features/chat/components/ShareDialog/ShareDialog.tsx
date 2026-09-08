import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Loader2, Share2, ExternalLink } from 'lucide-react';
import notify from '@/utils/notify';
import { API_CONFIG } from '@/config/api';
import { unwrapEnvelope } from '@/services/api/envelope';
import { getSessionId } from '@/store/useStore';

interface ShareResponse {
  id: string;
  shareable_url: string;
}

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messageId?: string;
  messageContent?: string;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  messageId,
  messageContent
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [shareData, setShareData] = useState<ShareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate share link when dialog opens
  useEffect(() => {
    if (isOpen && !shareData && !error) {
      generateShareLink();
    }
  }, [isOpen, shareData, error]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setShareData(null);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  const generateShareLink = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const sessionId = getSessionId() || '';

      const headers = {
        ...API_CONFIG.API_HEADERS,
      };

      const requestBody = {
        session_id: sessionId,
        ...(messageId && { message_id: messageId }),
        ...(messageContent && { message_content: messageContent }),
      };

      const response = await fetch(`${API_CONFIG.LOCAL_API_BASE_URL}/api/share`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: { message: `HTTP error ${response.status}` },
        }));
        throw new Error(
          `API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`
        );
      }

      const data = unwrapEnvelope<ShareResponse>(await response.json());
      setShareData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate share link';
      setError(errorMessage);
      notify.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    generateShareLink();
  };

  const getFullShareableUrl = () => {
    if (!shareData?.shareable_url) return '';
    return `${window.location.origin}${shareData.shareable_url}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Message
          </DialogTitle>
          <DialogDescription>
            Generate a shareable link for this message
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-text-muted">Generating link...</p>
              </div>
            </div>
          )}

          {error && !isLoading && (
            <div className="text-center py-8 space-y-4">
              <div className="text-destructive">
                <p className="font-medium">Failed to generate link</p>
                <p className="text-sm text-text-muted mt-1">{error}</p>
              </div>
              <Button onClick={handleRetry} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          )}

          {shareData && !isLoading && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Shareable Link:</label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate" title={getFullShareableUrl()}>
                      {getFullShareableUrl()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <CopyButton
                      text={getFullShareableUrl()}
                      showToast={true}
                      tooltipText="Copy link"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(getFullShareableUrl(), '_blank')}
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-text-muted">
                Anyone with this link can view the shared message
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

