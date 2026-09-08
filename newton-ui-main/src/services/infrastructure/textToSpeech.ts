// This service handles text-to-speech conversion using the local endpoint

import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope } from "@/services/api/envelope";
export const textToSpeech = async (text: string): Promise<{ audioData: string, contentType: string }> => {
  try {
 

    const response = await fetch(`${API_CONFIG.LOCAL_API_BASE_URL}/audio/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: "include",
      body: JSON.stringify({
        input: text,
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = unwrapEnvelope<{ audio_data?: string; content_type?: string }>(
      await response.json()
    );

    if (!data.audio_data) {
      throw new Error('Failed to get audio data from the server');
    }

    return {
      audioData: data.audio_data,
      contentType: data.content_type || 'audio/mpeg'
    };
  } catch (error) {
    throw error;
  }
};

// Helper function to play audio from base64 data
export const playAudioFromBase64 = (base64Audio: string, contentType: string): Promise<HTMLAudioElement> => {
  return new Promise((resolve, reject) => {
    try {
      // Convert base64 to blob
      const byteCharacters = atob(base64Audio);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: contentType });

      // Create audio element
      const audio = new Audio(URL.createObjectURL(blob));
      
      // Clean up object URL after playback
      audio.onended = () => {
        URL.revokeObjectURL(audio.src);
        resolve(audio);
      };
      
      audio.onerror = (error) => {
        URL.revokeObjectURL(audio.src);
        reject(error);
      };

      // Play the audio
      audio.play().then(() => {
        resolve(audio);
      }).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}; 