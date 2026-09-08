import { API_CONFIG } from "../../config/api";
import { unwrapEnvelope } from "../api/envelope";

export interface TravelerInfo {
  traveler_first_name: string;
  traveler_last_name: string;
  traveler_email: string;
  traveler_phone: string;
  traveler_date_of_birth: string;
  traveler_gender: string;
  passport_number: string;
  passport_expiry_date: string;
  passport_issuing_country: string;
  nationality: string;
}

export interface PackageBookingPayload {
  session_id: string;
  package_name: string;
  total_price: string;
  currency: string;
  flight_details?: string;
  origin?: string;
  destination?: string;
  departure_date?: string;
  return_date?: string;
  hotel_name?: string;
  check_in_date?: string;
  check_out_date?: string;
  passengers: number;
  visa_type?: string;
  visa_start_date?: string;
  visa_end_date?: string;
  travelers: TravelerInfo[];
  card_number: string;
  card_holder_name: string;
  card_vendor: string;
  card_expiry_date: string;
  card_cvv: string;
  attachments?: Array<{
    fieldName: string;
    fileData: string;
    fileName: string;
  }>;
}

export interface PackageBookingResponse {
  success: boolean;
  status?: string;
  responseCode?: number;
  booking_id?: string;
  booking_reference?: string;
  message?: string;
  error?: string;
}

/**
 * Submit a package booking to the backend
 */
export const submitPackageBooking = async (
  payload: PackageBookingPayload
): Promise<PackageBookingResponse> => {
  try {
    const response = await fetch(
      `${API_CONFIG.LOCAL_API_BASE_URL}/qatar/packages/submit_package_booking`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for authentication
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = unwrapEnvelope<any>(await response.json());

    // Check responseCode in payload even if HTTP status is 200
    if (data.responseCode && data.responseCode !== 200) {
      return {
        success: false,
        status: data.status || "failure",
        responseCode: data.responseCode,
        message: data.message,
        error: data.message || `Request failed with response code: ${data.responseCode}`,
      };
    }
    
    // Also check status field for failure
    if (data.status === "failure") {
      return {
        success: false,
        status: data.status,
        responseCode: data.responseCode || 400,
        message: data.message,
        error: data.message || "Request failed",
      };
    }
    
    return {
      success: true,
      ...data,
    };
  } catch (error) {
    console.error("Error submitting package booking:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

/**
 * Detect card vendor from card number
 */
export const detectCardVendor = (cardNumber: string): string => {
  const cleanNumber = cardNumber.replace(/\s/g, "");
  
  if (/^4/.test(cleanNumber)) {
    return "Visa";
  } else if (/^5[1-5]/.test(cleanNumber)) {
    return "Mastercard";
  } else if (/^3[47]/.test(cleanNumber)) {
    return "American Express";
  } else if (/^6(?:011|5)/.test(cleanNumber)) {
    return "Discover";
  }
  
  return "Unknown";
};
