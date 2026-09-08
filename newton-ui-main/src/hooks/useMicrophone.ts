import { useState, useRef, useCallback, useEffect } from 'react';

import { transcribeAudio } from '../services/infrastructure/transcription';
import { useStore } from '@/store/useStore';

const SILENCE_THRESHOLD = -45; // dB
const SILENCE_DURATION = 3000; // 3 seconds
const MIN_RECORDING_DURATION = 500; // 500ms minimum (for dictate feature)

export interface TranscriptionResult {
    text: string;
    timestamp: string;
  }
  
  export type RecordingState = 'idle' | 'recording' | 'processing' | 'confirming';

export const useMicrophone = (language: 'EN' | 'AR' = 'EN', autoSilenceDetection: boolean = true) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [transcription, setTranscription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [pendingAudioBlob, setPendingAudioBlob] = useState<Blob | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [autoStopTimer, setAutoStopTimer] = useState<number | null>(null);
  const [isCanceling, setIsCanceling] = useState<boolean>(false);
  
  const recordingStateRef = useRef<RecordingState>('idle');
  
  // Keep ref in sync with state
  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Helper function to check if transcription is valid
  const isValidTranscription = (text: string): boolean => {
    if (!text) return false;
    
    // Remove whitespace and check if there's actual content
    const trimmed = text.trim();
    if (trimmed.length === 0) return false;
    
    // Check for common noise patterns that might be transcribed
    const noisePatterns = [
      /^\.+$/, // Only dots
      /^,+$/, // Only commas
      /^\s+$/, // Only whitespace
      /^[.,\s]+$/, // Only punctuation and whitespace
    ];
    
    for (const pattern of noisePatterns) {
      if (pattern.test(trimmed)) return false;
    }
    
    // Must have at least one alphanumeric character
    const hasContent = /[a-zA-Z0-9\u0600-\u06FF]/.test(trimmed);
    return hasContent;
  };
  
  // Initialize audio worklet
  const initializeAudioWorklet = async () => {
    if (!audioContextRef.current) return;
    
    try {
      await audioContextRef.current.audioWorklet.addModule(
        URL.createObjectURL(new Blob([`
          class SilenceDetectorProcessor extends AudioWorkletProcessor {
            constructor() {
              super();
              this._lastSound = currentTime;
            }
            
            process(inputs) {
              const input = inputs[0];
              if (!input || !input.length) return true;
              
              const channel = input[0];
              let sum = 0;
              
              // Calculate RMS
              for (let i = 0; i < channel.length; i++) {
                sum += channel[i] * channel[i];
              }
              
              const rms = Math.sqrt(sum / channel.length);
              const db = 20 * Math.log10(rms);
              
              // Check if above threshold
              if (db > ${SILENCE_THRESHOLD}) {
                this._lastSound = currentTime;
              }
              
              // Send silence duration to main thread
              this.port.postMessage({
                silenceDuration: (currentTime - this._lastSound) * 1000
              });
              
              return true;
            }
          }
          
          registerProcessor('silence-detector', SilenceDetectorProcessor);
        `], { type: 'application/javascript' }))
      );
    } catch (err) {
      console.error('Failed to load audio worklet:', err);
      throw err;
    }
  };
  
  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      await initializeAudioWorklet();
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = new AudioWorkletNode(audioContext, 'silence-detector');
      
      processor.port.onmessage = (event) => {
        const { silenceDuration } = event.data;
        
        // Only auto-stop on silence if enabled
        if (autoSilenceDetection && silenceDuration >= SILENCE_DURATION) {
          if (silenceTimerRef.current === null) {
            silenceTimerRef.current = window.setTimeout(() => {
              stopRecording();
            }, 100); // Small delay to ensure we capture the last bit of audio
          }
        } else if (silenceTimerRef.current !== null) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      };
      
      // Create analyser for visual feedback
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      source.connect(processor);
      source.connect(analyser);
      processor.connect(audioContext.destination);
      processorRef.current = processor;
      
      // Update audio level for visualizer
      const updateAudioLevel = () => {
        if (analyserRef.current && recordingState === 'recording') {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255); // Normalize to 0-1
          requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();
      
      const mediaRecorder = new MediaRecorder(stream,{
        mimeType: 'audio/webm'
      });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        try {
          // If we're canceling, don't process the audio
          if (isCanceling) {
            setIsCanceling(false);
            return;
          }
          
          // If we're already processing (from confirmAndProcess), don't override the state
          if (recordingStateRef.current === 'processing') {
            return;
          }
          
          // If we're in idle state (cancel was clicked), don't override the state
          if (recordingStateRef.current === 'idle') {
            return;
          }
          
          // Calculate recording duration
          const recordingDuration = recordingStartTimeRef.current 
            ? Date.now() - recordingStartTimeRef.current 
            : 0;
          
          
          // Check if recording is too short (ignore accidental taps)
          if (recordingDuration < MIN_RECORDING_DURATION) {
            setRecordingState('idle');
            setAudioLevel(0);
            return;
          }
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Check if audio blob is too small (likely no real audio)
          if (audioBlob.size < 1000) { // Less than 1KB
            setRecordingState('idle');
            setAudioLevel(0);
            return;
          }
          
          // Set confirming state and store the audio blob for confirmation
          setRecordingState('confirming');
          setPendingAudioBlob(audioBlob);
        } catch (err) {
          setError('Failed to transcribe audio. Please try again.');
          setRecordingState('idle');
          setAudioLevel(0);
          console.error('Transcription error:', err);
        }
      };
      
      mediaRecorder.start();
      setRecordingState('recording');
      
      // Auto-stop after 3 seconds to show confirmation UI
      const timer = window.setTimeout(() => {
        if (recordingState === 'recording') {
          stopRecording();
        }
      }, 3000);
      setAutoStopTimer(timer);
      
    } catch (err) {
      setError('Failed to access microphone. Please check permissions and try again.');
      console.error('Microphone access error:', err);
    }
  }, [language, recordingState]);
  
  // Stop recording
  const stopRecording = useCallback(() => {
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
      setAutoStopTimer(null);
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    
    setAudioLevel(0);
  }, []);
  
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);
  
  // Clear transcription
  const clearTranscription = useCallback(() => {
    setTranscription('');
  }, []);

  // Confirm and process audio
  const confirmAndProcess = useCallback(async () => {
    
    // Immediately set processing state to show loader
    setRecordingState('processing');
    
    try {
      // Stop recording first if still recording - use ref to get current state
      if (recordingStateRef.current === 'recording') {
        stopRecording();
        
        // Wait a moment for the recording to stop and blob to be ready
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Get the current audio blob from the recorder
      let audioBlob = pendingAudioBlob;
      
      if (!audioBlob && mediaRecorderRef.current && audioChunksRef.current.length > 0) {
        audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      }
      
      if (!audioBlob) {
        setRecordingState('idle');
        setAudioLevel(0);
        setPendingAudioBlob(null);
        return;
      }
      
      // Ensure UI updates before making API call
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const { sessionId, userId } = useStore.getState();
      const result = await transcribeAudio(audioBlob, language, {
        sessionId: sessionId || undefined,
        userId: userId || undefined,
      });
      
      // Validate transcription result
      if (isValidTranscription(result)) {
        setTranscription(result);
      } else {
      }
      
      setRecordingState('idle');
      setAudioLevel(0);
      setPendingAudioBlob(null);
    } catch (err) {
      setError('Failed to transcribe audio. Please try again.');
      setRecordingState('idle');
      setAudioLevel(0);
      setPendingAudioBlob(null);
      console.error('Transcription error:', err);
    }
  }, [pendingAudioBlob, language, recordingState, stopRecording]);

  // Cancel transcription
  const cancelTranscription = useCallback(() => {
    
    // Set canceling flag to prevent onstop handler from processing
    if (recordingStateRef.current === 'recording') {
      setIsCanceling(true);
      stopRecording();
    }
    
    // Immediately set to idle to provide instant feedback
    setRecordingState('idle');
    setAudioLevel(0);
    setPendingAudioBlob(null);
    
    // Force a small delay to ensure state is updated before any async operations
    setTimeout(() => {
    }, 0);
    
    // Clean up any timers
    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
      setAutoStopTimer(null);
    }
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, [stopRecording, autoStopTimer]);

  return {
    recordingState,
    transcription,
    error,
    audioLevel,
    startRecording,
    stopRecording,
    clearTranscription,
    confirmAndProcess,
    cancelTranscription,
  };
};