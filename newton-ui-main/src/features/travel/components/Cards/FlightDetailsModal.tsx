import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Clock } from 'lucide-react';
import type { ContentItem } from './ResourceCard';

interface FlightDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: ContentItem[];
  title?: string;
  key?: string;
}

const FlightDetailsModal: React.FC<FlightDetailsModalProps> = ({
  isOpen,
  onClose,
  content,
  title = 'Flight Details'
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  type FlightSegment = ContentItem & {
    isLayover: boolean;
    details: {
      departureTime: string;
      arrivalTime: string;
      departureCity: string;
      arrivalCity: string;
      duration: string;
    };
  };

  const flightData = useMemo(() => {
    if (!content || content.length === 0) return null;
    
    const firstItem = content[0];
    const isFlightCard = firstItem.title?.value?.includes('→') || firstItem.title?.value?.toLowerCase().includes('leg');
    if (!isFlightCard) return { isFlightCard: false, segments: content as FlightSegment[] };

    const segments: FlightSegment[] = content.map(item => {
      const isLayover = item.title?.value?.toLowerCase().includes('layover') || false;
      
      let details = {
        departureTime: '', arrivalTime: '', 
        departureCity: '', arrivalCity: '', duration: ''
      };

      if (item.description?.value) {
        const desc = item.description.value;
        const timeMatch = desc.match(/(\d{1,2}:\d{2})\s*→.*?\s*(\d{1,2}:\d{2})/);
        if (timeMatch) {
          details.departureTime = timeMatch[1];
          details.arrivalTime = timeMatch[2];
        }
      }

      const titleMatch = item.title?.value?.match(/([A-Z]{3})\s*→\s*([A-Z]{3})/);
      if (titleMatch) {
        details.departureCity = titleMatch[1];
        details.arrivalCity = titleMatch[2];
      }

      const durationMatch = item.title?.value?.match(/(\d+h\s*\d*m?)/);
      if (durationMatch) {
        details.duration = durationMatch[1];
      }

      return { ...item, isLayover, details };
    });

    return { isFlightCard: true, segments };
  }, [content]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed top-0 left-0 w-screen h-screen bg-black/80 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative z-50 w-full max-w-lg rounded-xl bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-main p-4 flex-shrink-0">
              <h3 className="text-lg font-bold text-text-main ">{title}</h3>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-text-main hover:bg-surface/80 dark:hover:bg-gray-700 transition-colors"
                aria-label="Close modal"
              >
                <X size={22} />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flow-root">
                <ul className="-mb-8">
                  {flightData?.segments.map((item, idx) => {
                    if (idx === 0 && flightData.segments.length > 1 && !item.title?.value?.toLowerCase().includes('segment')) {
                      return null; // Skip summary item
                    }
                    return (
                      <li key={idx}>
                        <div className="relative pb-8">
                          {idx < flightData.segments.length - 1 ? (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                          ) : null}
                          <div className="relative flex space-x-4">
                            <div>
                              <span className="h-8 w-8 rounded-full bg-surface flex items-center justify-center ring-2 ring-white">
                                {item.isLayover ? (
                                  <Clock className="h-5 w-5 text-text-main" />
                                ) : (
                                  item.image?.value && <img src={item.image.value} alt="" className="h-5 w-5 object-contain" />
                                )}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5">
                              {item.isLayover ? (
                                <div>
                                    <p className="font-semibold text-sm text-text-main">{item.title?.value || 'Layover'}</p>
                                    <p className="text-sm text-text-muted">{item.description?.value}</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-5 gap-4">
                                  <div className="col-span-2">
                                      <p className="text-sm font-semibold text-text-muted">{item.details.departureCity} - {item.details.arrivalCity}</p>
                                      <p className="text-xs text-gray-500 truncate">{item.description?.value?.split('\n')[0]}</p>
                                  </div>
                                  <div className="col-span-3 text-right">
                                      <p className="text-sm font-bold text-text-main">{item.details.departureTime} - {item.details.arrivalTime}</p>
                                      <p className="text-xs text-text-muted">{item.details.duration}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
            
            {/* Footer */}
            <div className="border-t border-border-main p-4 flex justify-between items-center flex-shrink-0 bg-surface">
              <p className='text-xl font-bold text-text-main'>
                {content[0]?.footer?.value?.split('·')[0].trim()}
              </p>
              <div className="flex gap-2">
                {/* {content[0]?.metadata?.linkUrl && (
                  <button
                    onClick={() => window.open(content[0].metadata!.linkUrl, '_blank', 'noopener,noreferrer')}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Book Now
                  </button>
                )} */}
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default FlightDetailsModal;
