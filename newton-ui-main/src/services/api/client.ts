import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from "axios";
import { API_CONFIG } from "@/config/api";
import { isEnvelope } from "./envelope";
import notify from "@/utils/notify";
import {
  handleSessionExpired,
  shouldSkipAuthHandling,
} from "./sessionExpiry";

/**
 * Creates an Axios instance with base configuration.
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.LOCAL_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true, // This ensures cookies are sent with requests
});

/**
 * Request interceptor - no longer needed for authentication
 * as cookies are automatically sent with withCredentials: true
 */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // No need to manually handle authentication tokens
    // Cookies are automatically included with withCredentials: true
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor to handle global errors (like 401 Unauthorized).
 */
const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);

const envelopeResponseInterceptor = <T extends { data: unknown; config: InternalAxiosRequestConfig }>(
  response: T
): T | Promise<T> => {
  if (!isEnvelope(response.data)) return response;

  const envelope = response.data;
  const silent = (response.config as InternalAxiosRequestConfig & { silent?: boolean }).silent === true;

  if (!envelope.success) {
    const message = envelope.message || "Request failed";
    if (!silent) notify.error(message);
    const err = new Error(message) as Error & {
      config?: InternalAxiosRequestConfig;
      response?: T;
      isEnvelopeError?: boolean;
      envelopeToasted?: boolean;
    };
    err.config = response.config;
    err.response = response;
    err.isEnvelopeError = true;
    err.envelopeToasted = true;
    return Promise.reject(err);
  }

  const method = (response.config.method || "").toLowerCase();
  if (MUTATION_METHODS.has(method) && envelope.message && !silent) {
    notify.success(envelope.message);
  }

  response.data = envelope.data;
  return response;
};

const toastEnvelopeError = (error: AxiosError): void => {
  const errBody = error.response?.data;
  const silentErr =
    (error.config as InternalAxiosRequestConfig & { silent?: boolean } | undefined)?.silent === true;
  if (
    isEnvelope(errBody) &&
    !errBody.success &&
    !(error as { envelopeToasted?: boolean }).envelopeToasted
  ) {
    const message = errBody.message || "Request failed";
    if (!silentErr) notify.error(message);
    (error as unknown as { envelopeToasted: boolean }).envelopeToasted = true;
    error.message = message;
  }
};

// The backend owns session expiry; a 401 means the session is gone — clear all
// data and redirect to /login (skipped on the login page / mid-logout).
const errorInterceptor = async (error: AxiosError): Promise<never> => {
  toastEnvelopeError(error);
  if (error.response?.status === 401 && !shouldSkipAuthHandling()) {
    handleSessionExpired();
  }
  return Promise.reject(error);
};

axios.interceptors.response.use(envelopeResponseInterceptor, errorInterceptor);
apiClient.interceptors.response.use(envelopeResponseInterceptor, errorInterceptor);

export default apiClient;
