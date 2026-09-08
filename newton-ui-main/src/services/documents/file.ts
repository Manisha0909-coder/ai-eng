import axios from "axios";
import { API_CONFIG } from "@/config/api";

// New: retry a failed file processing/upload

// import { API_CONFIG } from '../config/api';
// import axios from 'axios';

export const getSupportedFileTypes = (): string[] => {
  return ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
};

export const validateFileSize = (file: File): string | null => {
  const maxSize = file.type === 'application/pdf' 
    ? API_CONFIG.FILE_SIZE_LIMITS.PDF 
    : API_CONFIG.FILE_SIZE_LIMITS.IMAGE;

  if (file.size > maxSize) {
    return `File is too large. Maximum size is ${maxSize / (1024 * 1024)}MB for ${file.type === 'application/pdf' ? 'PDFs' : 'images'}.`;
  }

  return null;
};

export const validateImageDimensions = (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (img.width > API_CONFIG.IMAGE_DIMENSION_LIMIT || img.height > API_CONFIG.IMAGE_DIMENSION_LIMIT) {
        resolve(`Image dimensions are too large. Maximum dimension is ${API_CONFIG.IMAGE_DIMENSION_LIMIT}px.`);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve('Failed to load image for validation.');
    img.src = URL.createObjectURL(file);
  });
};

export const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}; 

export const downloadFile = async (url: string, filename: string): Promise<void> => {
  try {
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      withCredentials: true,
      responseType: 'blob',
    });

    // Create a blob URL from the response data
    const blob = new Blob([response.data]);
    const downloadUrl = URL.createObjectURL(blob);

    // Create a temporary link element and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the blob URL
    URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw new Error('Failed to download file');
  }
}; 