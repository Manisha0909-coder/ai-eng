import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { X } from 'lucide-react';
import { fileUrl } from '@/utils/fileStaticPath';

interface FullScreenViewerProps {
  src: string;
  onClose: () => void;
}

const FullScreenViewer = ({ src, onClose }: FullScreenViewerProps) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchImage = async () => {
      if (src.startsWith('blob:') || src.startsWith('data:')) {
        setImageSrc(src);
        setIsLoading(false);
        return;
      }

      try {
        const response = await axios.get(fileUrl(src), {
          withCredentials: true,
          responseType: 'blob',
          timeout: 15000,
        });
        const objectUrl = URL.createObjectURL(response.data);
        setImageSrc(objectUrl);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to fetch full-screen image:', err);
        setError(true);
        setIsLoading(false);
      }
    };

    fetchImage();

    return () => {
      if (imageSrc && typeof imageSrc === 'string' && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [src]);

  return createPortal(
    <div 
      className="fixed top-0 left-0 w-screen h-screen bg-black/90 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[10000] bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
        aria-label="Close"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-white text-sm">Loading image...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="text-white text-center">
          <p className="text-lg mb-2">Failed to load image</p>
          <p className="text-sm text-white/70">Please try again</p>
        </div>
      )}

      {!isLoading && !error && imageSrc && (
        <img
          src={imageSrc}
          alt="Full screen view"
          className="max-w-[95vw] max-h-[95vh] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>,
    document.body
  );
};

export default FullScreenViewer;