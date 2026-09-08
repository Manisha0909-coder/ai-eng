import React from "react";
import { motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";

interface DictateRecorderProps {
  isRecording: boolean;
  isProcessing: boolean;
  isConfirming: boolean;
  audioLevel: number;
  onConfirm: () => void;
  onCancel: () => void;
  isSmallScreen?: boolean;
}

// Waveform bar configuration
const WAVEFORM_BARS = [
  { baseHeight: 3, variance: 8, delay: 0 },
  { baseHeight: 6, variance: 12, delay: 0.1 },
  { baseHeight: 9, variance: 16, delay: 0.2 },
  { baseHeight: 6, variance: 12, delay: 0.1 },
  { baseHeight: 3, variance: 8, delay: 0 },
];

export const DictateRecorder: React.FC<DictateRecorderProps> = ({
  isRecording,
  isProcessing,
  isConfirming,
  audioLevel,
  onConfirm,
  onCancel,
}) => {
  const isActive = isRecording || isConfirming || isProcessing;

  if (!isActive) return null;

  return (
    <motion.div
      className="flex items-center gap-2 px-2 py-1.5 sm:px-3 sm:py-2 rounded-full bg-surface"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      style={{ contain: "layout" }}
    >
      {/* Waveform animation */}
      <motion.div
        className="flex items-center gap-0.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        style={{
          contain: "layout",
          height: "20px",
          alignItems: "center",
        }}
      >
        {WAVEFORM_BARS.map((bar, i) => (
          <motion.div
            key={i}
            className="w-1 rounded-full bg-primary"
            style={{
              contain: "layout",
              maxHeight: "20px",
              alignSelf: "center",
            }}
            animate={
              isProcessing
                ? {
                    height: [
                      bar.baseHeight + 4,
                      bar.baseHeight + 8,
                      bar.baseHeight + 4,
                    ],
                  }
                : {
                    height: [
                      bar.baseHeight + audioLevel * bar.variance * 0.4,
                      bar.baseHeight +
                        bar.variance +
                        audioLevel * bar.variance * 0.6,
                      bar.baseHeight + audioLevel * bar.variance * 0.4,
                    ],
                  }
            }
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: bar.delay,
              ease: [0.4, 0, 0.6, 1],
            }}
          />
        ))}
      </motion.div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {!isProcessing && (
          <motion.button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }}
            className="p-1 rounded-full bg-gray-400 hover:bg-gray-500 transition-all"
            whileTap={{ scale: 0.95 }}
          >
            <X size={12} className="w-3 h-3 text-white" />
          </motion.button>
        )}
        <motion.button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isProcessing) {
              onConfirm();
            }
          }}
          className="p-1 rounded-full bg-gray-600 hover:bg-gray-700 transition-all disabled:opacity-50"
          whileTap={{ scale: 0.95 }}
          disabled={isProcessing}
        >
          <Loader2
            size={12}
            className={`w-3 h-3 text-white ${
              isProcessing ? "animate-spin" : ""
            }`}
          />
        </motion.button>
      </div>
    </motion.div>
  );
};
