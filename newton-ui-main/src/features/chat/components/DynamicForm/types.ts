export type FormField = {
  type:
    | "email"
    | "textarea"
    | "submit"
    | "text"
    | "file"
    | "date"
    | "select"
    | "radio"
    | "info"
    | "number"
    | string;
  label: string;
  arabicLabel?: string; // Arabic label support
  name: string;
  defaultValue?: string | boolean | string[] | number | null;
  arabicDefaultValue?: string; // Arabic default value support
  required?: boolean;
  placeholder?: string;
  arabicPlaceholder?: string; // Arabic placeholder support
  visibleToUser?: boolean;
  isMultipleEmail?: boolean;
  submission_endpoint?: string;
  formatCategory?: string;
  readOnly?: boolean;
  options_endpoint?: string;
  options?: Array<
    { value: string; label: string; arabicLabel?: string } | string
  >;
  contentType?: string;
  minValue?: number;
  maxValue?: number;
  min?: number;
  max?: number;
  step?: number;
  attachment?: Array<{ file_name: string; file_size: number }>;
};

export type EmailFormProps = {
  formFields: FormField[];
  closeForm: () => void;
  onSubmit: (data: any) => void;
  formTitle?: string;
  arabicFormTitle?: string; // Added Arabic form title support
  apiFetch?: (endpoint: string) => Promise<any>;
  formStatus: (index: number, status: boolean) => void;
  formIndex?: number;
  formButtons?: Array<{
    label?: string;
    title?: string;
    onClick?: () => void;
    type?: string;
    value?: string;
    arabicTitle?: string;
  }>;
  isReadOnly?: boolean; // Disable form submission in read-only mode
  formId?: string; // form_id from the form object
  metadata?: {
    // _metadata from the form object
    message_id?: string;
    callback_url?: string;
  };
  submittedValues?: Record<string, any>; // Submitted form values to display when viewing submitted form
  submitted?: boolean; // Whether the form was submitted (from backend response)
};

export interface ResumptionDetails {
  leaveId: string;
  startDate: string;
  endDate: string;
  hospitalStartDate: string;
  hospitalEndDate: string;
}

export interface ChildFeeDetails {
  age: string;
  balance: string;
  dob: string;
  eligibleAmount: string;
}

export interface Meeting {
  date: string;
  start_time: string;
  duration: { hours: number; minutes: number };
  time_zone: string;
  subject: string;
  content: string;
  venue: string;
  emails: string;
  usernames: string;
  toRecipients: string;
  body: string;
}

export interface DynamicFormRef {
  updateEmail: (email: string) => void;
}
