import { useState } from 'react';
import notify from '@/utils/notify';
import { useStableCallback } from './usePerformance';
import { useLanguageState } from '../store/selectors';
import { API_CONFIG } from '../config/api';
import { getPublicOrigin, VITE_API_BASE_URL } from '@/env';
import { getUserIdValue, getSessionId } from '@/store/useStore';

interface SubmissionResponse {
  success: boolean;
  message?: string;
  data?: any;
  errors?: Record<string, string[]>;
}

interface FormSubmissionOptions {
  endpoint: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  onSuccess?: (response: SubmissionResponse) => void;
  onError?: (error: Error) => void;
}

export const useFormSubmission = () => {
  const { languageType } = useLanguageState();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const submitForm = useStableCallback(async (
    formData: any, 
    options: FormSubmissionOptions
  ): Promise<SubmissionResponse> => {

    setIsSubmitting(true);
    
    try {
      const { endpoint, method = 'POST', headers = {}, onSuccess, onError } = options;
      
      const requestHeaders = {
        'Content-Type': 'application/json',
        'Accept-Language': languageType,
        ...headers,
        credentials: "include",
      };

      const isDevelopment = import.meta.env.DEV;
      let fullUrl: string;
      
      if (endpoint.startsWith('http')) {
        try {
          const url = new URL(endpoint);
          const knownHosts = [API_CONFIG.LOCAL_API_BASE_URL, getPublicOrigin(), VITE_API_BASE_URL]
            .filter(Boolean)
            .map((value) => {
              try {
                return new URL(String(value)).host;
              } catch {
                return "";
              }
            })
            .filter(Boolean);

          if (knownHosts.includes(url.host)) {
            if (isDevelopment) {
              // In development, use relative path so the Vite proxy handles it
              fullUrl = url.pathname + (url.search || '');
            } else {
              // In production, rewrite the base to the configured middleware server
              const base = (API_CONFIG.LOCAL_API_BASE_URL || VITE_API_BASE_URL || '').replace(/\/$/, '');
              fullUrl = `${base}${url.pathname}${url.search || ''}`;
            }
          } else {
            fullUrl = endpoint;
          }
        } catch {
          fullUrl = endpoint;
        }
      } else {
        const baseUrl = API_CONFIG.LOCAL_API_BASE_URL || '';
        fullUrl = `${baseUrl}${endpoint}`;
      }

      // Add user context to form data
      const enrichedFormData = {
        ...formData,
        user_id: getUserIdValue() || 'default@user.com',
        session_id: getSessionId() || '',
        language: languageType,
        timestamp: new Date().toISOString(),
      };


      const response = await fetch(fullUrl, {
        method,
        headers: requestHeaders,
        body: JSON.stringify(enrichedFormData),
        credentials: 'include', // Include cookies in the request
      });

      let responseData: SubmissionResponse;

      try {
        responseData = await response.json();
      } catch (parseError) {
        // If response is not JSON, create a generic response
        responseData = {
          success: response.ok,
          message: response.ok 
            ? (languageType === 'AR' ? 'تم الإرسال بنجاح' : 'Submitted successfully')
            : (languageType === 'AR' ? 'حدث خطأ أثناء الإرسال' : 'Submission failed'),
        };
      }

      if (!response.ok) {
        const errorMessage = responseData.message || 
          (languageType === 'AR' ? 'حدث خطأ في الخادم' : 'Server error occurred');
        
        const error = new Error(errorMessage);
        if (onError) {
          onError(error);
        }
        throw error;
      }

      // Handle successful submission
      if (onSuccess) {
        onSuccess(responseData);
      }

      return responseData;
      
    } catch (error) {
      console.error('Form submission error:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : (languageType === 'AR' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred');

      throw new Error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  });

  // Specialized method for LMS course enrollment
  const submitCourseEnrollment = useStableCallback(async (formData: any) => {
    return submitForm(formData, {
      endpoint: '/erp/lms/enrollments',
      method: 'POST',
      onSuccess: () => {
        notify.success(
          languageType === 'AR'
            ? 'تم التسجيل في الدورة بنجاح!'
            : 'Successfully enrolled in course!'
        );
      },
      onError: () => {
        notify.error(
          languageType === 'AR'
            ? 'فشل التسجيل في الدورة'
            : 'Course enrollment failed'
        );
      },
    });
  });

  // Generic form submission with automatic endpoint detection
  const submitDynamicForm = useStableCallback(async (
    formData: any,
    formFields: any[]
  ) => {
    // Find submission endpoint from form fields
    const submitField = formFields.find(field => field.type === 'submit');
    const endpoint = submitField?.submission_endpoint || '/api/forms/submit';
    
    // Determine if this is a course enrollment form
    if (endpoint.includes('lms') && endpoint.includes('enrollment')) {
      return submitCourseEnrollment(formData);
    }
    
    // Generic form submission
    return submitForm(formData, {
      endpoint,
      onSuccess: (response) => {
        notify.success(
          response.message ||
          (languageType === 'AR' ? 'تم الإرسال بنجاح!' : 'Submitted successfully!')
        );
      },
      onError: (error) => {
        notify.error(
          error.message ||
          (languageType === 'AR' ? 'حدث خطأ أثناء الإرسال' : 'Submission failed')
        );
      },
    });
  });

  // Validation helper
  const validateFormData = useStableCallback((formData: any, requiredFields: string[] = []) => {
    const errors: Record<string, string> = {};
    
    requiredFields.forEach(field => {
      if (!formData[field] || String(formData[field]).trim() === '') {
        errors[field] = languageType === 'AR' 
          ? 'هذا الحقل مطلوب' 
          : 'This field is required';
      }
    });
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  });

  // Retry mechanism for failed submissions
  const retrySubmission = useStableCallback(async (
    formData: any, 
    options: FormSubmissionOptions, 
    maxRetries: number = 3
  ) => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await submitForm(formData, options);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
        }
      }
    }
    
    if (lastError) {
      throw lastError;
    }
  });

  return {
    submitForm,
    submitCourseEnrollment,
    submitDynamicForm,
    validateFormData,
    retrySubmission,
    isSubmitting,
  };
};

export default useFormSubmission; 