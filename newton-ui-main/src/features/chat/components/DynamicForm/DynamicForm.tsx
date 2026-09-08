"use client";

import { API_CONFIG } from "@/config/api";
import { unwrapEnvelope } from "@/services/api/envelope";
import {
  getSessionId,
  getUserSuggestions,
} from "@/store/useStore";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import {
  ChevronDown as ArrowDown,
  ChevronDown,
  Clock,
  Paperclip,
  X,
} from "lucide-react";
import type React from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import notify from "@/utils/notify";
import { Switch } from "@/components/ui/switch";
import { useLanguageStore } from "@/store/languageStore";
import { ARABIC_KEY_MAP } from "@/utils/arabicKeyMap";
import type {
  ChildFeeDetails,
  DynamicFormRef,
  EmailFormProps,
  FormField,
  ResumptionDetails,
} from "./types";
import {
  isHtmlContentField,
  isNumericFormField,
  parseDurationValue,
  stripHtmlForTextareaDisplay,
} from "./utils/formHelpers";
import {
  calculateNumberOfDays,
  getFormattedDate,
  getFormattedDateTime,
} from "./utils/dateHelpers";
import {
  generateMeetingPayload,
  generateSendEmailPayload,
  toBase64,
} from "./utils/payloadHelpers";

// Re-exported so existing consumers importing from this module keep working.
export type { DynamicFormRef } from "./types";

/** POST target for form submission handoff; uses middleware base (`API_CONFIG.LOCAL_API_BASE_URL`). */
const FORMS_CALLBACK_PATH = "/chat/forms/callback";

const DynamicForm = forwardRef<DynamicFormRef, EmailFormProps>(
  (
    {
      formFields,
      closeForm,
      onSubmit: propOnSubmit,
      formTitle,
      arabicFormTitle,
      formStatus,
      formIndex = 0,
      formButtons,
      isReadOnly = false,
      formId,
      metadata,
      submittedValues,
      submitted = false,
    },
    ref
  ): JSX.Element => {
    const {
      register,
      handleSubmit,
      control,
      formState: { errors },
      setValue,
      getValues,
      trigger,
    } = useForm({
      mode: 'onChange', // Validate on change to clear errors when values are set
    });
    const [quillContent, setQuillContent] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<Record<string, File[]>>(
      {}
    );
    const [totalFileSize, setTotalFileSize] = useState(0);
    const [selectOptions, setSelectOptions] = useState<Record<string, any[]>>(
      {}
    );
    const [loadingOptions] = useState<
      Record<string, boolean>
    >({});
    const [selectFieldValues, setSelectFieldValues] = useState<{
      [key: string]: any;
    }>({});
    const [childFeeDetails, setChildFeeDetails] = useState<ChildFeeDetails>({
      age: "",
      balance: "",
      dob: "",
      eligibleAmount: "",
    });
    const [resumptionDetails, setResumptionDetails] =
      useState<ResumptionDetails | null>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [, setLeaveStartDate] = useState<string>("");
    const [, setLeaveEndDate] = useState<string>("");
    const [, setLeaveType] = useState<string>("");
    const [submissionEndpoint, setSubmissionEndpoint] = useState<string>("");
    const [selectFieldOption, setSelectFieldOption] = useState<string>("");
    const sessionId = getSessionId() || "";
    const [leaveDuration] = useState("");
    const [calculatedDays, setCalculatedDays] = useState<number | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [, setFieldAnimations] = useState<
      Record<string, boolean>
    >({});
    const [isFormVisible, setIsFormVisible] = useState(true);
    const formRef = useRef<HTMLFormElement>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isEditable, setIsEditable] = useState(!isReadOnly);
    
    // Generate unique form instance ID to prevent conflicts between multiple form instances
    const formInstanceId = useRef(`form-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);

    // Arabic language toggle state
    const { languageType } = useLanguageStore();
    const isArabicMode = languageType === "AR";

    // Sync isEditable with isReadOnly prop
    useEffect(() => {
      if (isReadOnly) {
        setIsEditable(false);
      }
    }, [isReadOnly]);

    // Clear file state when form becomes invisible or is closed
    useEffect(() => {
      if (!isFormVisible) {
        // Reset file inputs when form is hidden
        formFields.forEach((field) => {
          if (field.type === "file") {
            const fileInput = document.getElementById(`${formInstanceId.current}-${field.name}`) as HTMLInputElement;
            if (fileInput) {
              fileInput.value = "";
            }
          }
        });
      }
    }, [isFormVisible, formFields]);

    // Clear file state when formFields change (new form loaded)
    // Use JSON.stringify to create a stable dependency array
    const formFieldsKey = JSON.stringify(formFields.map(f => ({ name: f.name, type: f.type })));
    useEffect(() => {
      setSelectedFiles({});
      setTotalFileSize(0);
    }, [formFieldsKey]);

    // Framer Motion animation controls
    const formControls = useAnimation();
    const fieldControls = useAnimation();

    // Animation variants
    const formVariants = {
      visible: {
        scale: 1,
        opacity: 1,
        y: 0,
        transition: {
          type: "spring",
          damping: 20,
          stiffness: 300,
          when: "beforeChildren",
          staggerChildren: 0.05,
        },
      },
      submitting: {
        scale: 0.99,
        opacity: 0.9,
        transition: {
          type: "spring",
          damping: 25,
          stiffness: 400,
        },
      },
      hidden: {
        scale: 0.9,
        opacity: 0,
        y: -20,
        transition: {
          type: "spring",
          damping: 25,
          stiffness: 400,
        },
      },
    };

    const fieldVariants = {
      visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
          type: "spring",
          damping: 20,
          stiffness: 300,
        },
      },
      hidden: {
        opacity: 0,
        y: -20,
        scale: 0.95,
        transition: {
          type: "spring",
          damping: 25,
          stiffness: 400,
        },
      },
      exit: {
        opacity: 0,
        y: -30,
        scale: 0.9,
        transition: {
          type: "spring",
          damping: 30,
          stiffness: 500,
          duration: 0.3,
        },
      },
    };

    const buttonVariants = {
      idle: {
        scale: 1,
        transition: {
          type: "spring",
          damping: 20,
          stiffness: 400,
        },
      },
      hover: {
        scale: 1.02,
        transition: {
          type: "spring",
          damping: 15,
          stiffness: 400,
        },
      },
      tap: {
        scale: 0.98,
        transition: {
          type: "spring",
          damping: 15,
          stiffness: 400,
          duration: 0.1,
        },
      },
      submitting: {
        scale: 1,
        transition: {
          type: "spring",
          damping: 20,
          stiffness: 400,
        },
      },
    };

    const userSuggestions = getUserSuggestions();
    const [showSuggestions, setShowSuggestions] = useState<{
      [key: string]: boolean;
    }>({});
    const [filteredSuggestions, setFilteredSuggestions] = useState<{
      [key: string]: any[];
    }>({});
    const suggestionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});

    // Auto-resize textarea function
    const autoResizeTextarea = (textarea: HTMLTextAreaElement | null) => {
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };

    // Watch for changes in start and end dates (handle multiple naming conventions).
    // NOTE: hooks must be called unconditionally — `useWatch(...) || useWatch(...)`
    // short-circuits and skips the second hook, violating the Rules of Hooks.
    const watchedStartDateCamel = useWatch({ control, name: "startDate" });
    const watchedStartDateSnake = useWatch({ control, name: "start_date" });
    const watchedStartDate = watchedStartDateCamel || watchedStartDateSnake;

    const watchedEndDateCamel = useWatch({ control, name: "endDate" });
    const watchedEndDateSnake = useWatch({ control, name: "end_date" });
    const watchedEndDate = watchedEndDateCamel || watchedEndDateSnake;

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      updateEmail: (email: string) => {
        const toRecipientsField = formFields.find(
          (field) => field.name === "toRecipients"
        );
        if (toRecipientsField) {
          setValue("toRecipients", email);
          // Trigger change event to update form state
          const event = new Event("change", { bubbles: true });
          const input = document.querySelector(
            'input[name="toRecipients"]'
          ) as HTMLInputElement;
          if (input) {
            input.dispatchEvent(event);
          }
        }
      },
    }));

    const handleEmailInputChange = (
      e: React.ChangeEvent<HTMLInputElement>,
      fieldName: string
    ) => {
      const value = e.target.value;
      const field = formFields.find((field) => field.name === fieldName);
      const isMultipleEmail = field?.isMultipleEmail;
      const isEmailField = field?.type === "email";

      // For email fields (both single and multiple), allow comma-separated values
      // This allows users to enter multiple emails separated by commas
      if (isEmailField) {
        setValue(fieldName, value);
      } else {
        // For non-email fields, just set the value
        setValue(fieldName, value.trim());
      }

      // If the field is empty, hide suggestions
      if (!value.trim()) {
        setShowSuggestions((prev) => ({ ...prev, [fieldName]: false }));
        return;
      }

      // Filter suggestions based on the last email in case of multiple emails
      // For email fields, always check the last comma-separated value
      const searchTerm = (isEmailField || isMultipleEmail)
        ? value.split(",").pop()?.trim() || ""
        : value.trim();

      const filtered = userSuggestions.filter((suggestion: any) => {
        const displayName = suggestion.display_name.toLowerCase();
        const email = suggestion.email.toLowerCase();
        const term = searchTerm.toLowerCase();

        return displayName.includes(term) || email.includes(term);
      });

      setFilteredSuggestions((prev) => ({ ...prev, [fieldName]: filtered }));
      setShowSuggestions((prev) => ({
        ...prev,
        [fieldName]: filtered.length > 0,
      }));
    };
    const handleSuggestionClick = (suggestion: any, fieldName: string) => {
      const field = formFields.find((field) => field.name === fieldName);
      const isEmailField = field?.type === "email";

      // For email fields (both single and multiple), append the selection
      if (isEmailField) {
        const currentValue = getValues(fieldName) || "";
        const emails = currentValue
          .split(",")
          .map((email: string) => email.trim())
          .filter((email: string) => email !== "");

        // Check if email is already in the list
        if (!emails.includes(suggestion.email)) {
          // Remove the last incomplete email if it exists
          emails.pop();
          const newValue = emails.length
            ? `${emails.join(", ")}, ${suggestion.email}`
            : suggestion.email;
          setValue(fieldName, newValue);
        }
      }

      // Hide suggestions after selection
      setShowSuggestions((prev) => ({ ...prev, [fieldName]: false }));
      setFilteredSuggestions((prev) => ({ ...prev, [fieldName]: [] }));
    };
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        for (const fieldName in suggestionRefs.current) {
          if (
            suggestionRefs.current[fieldName] &&
            !suggestionRefs.current[fieldName]?.contains(event.target as Node)
          ) {
            setShowSuggestions((prev) => ({ ...prev, [fieldName]: false }));
          }
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    useEffect(() => {


      const fetchOptions = async (endpoint: string, fieldName: string) => {
        try {
          const fullEndpoint = `${endpoint}`;
          const response = await fetch(fullEndpoint, {
            headers: {
              accept: "text/plain",              
            },
            credentials: "include",
          });
          const data = unwrapEnvelope<any>(await response.json());

          if (data.responseCode === 1) {
            setErrorMessage(data.responseMessage);
            return;
          }

          if (data.responseCode === 0 && Array.isArray(data.result)) {
            // Check if the result contains letterItems (new format)
            if (data.result[0]?.letterItems) {
              // Flatten the nested structure for the new format
              const flattenedOptions = data.result.flatMap((category: any) =>
                category.letterItems.map((item: any) => ({
                  value: item.code,
                  label: item.text,
                  icon: item.icon,
                  category: category.letterType,
                }))
              );
              setSelectOptions((prevOptions) => ({
                ...prevOptions,
                [fieldName]: flattenedOptions,
              }));
            } else {
              // Handle the original format (leaveId and type)
              setSelectOptions((prevOptions) => ({
                ...prevOptions,
                [fieldName]: data.result,
              }));
            }
          } else {
            console.error("Failed to fetch options:", data.responseMessage);
          }
        } catch (error) {
          console.error("Error fetching options:", error);
        }
      };

      formFields.forEach((field) => {
        if (field.type === "select" && field.options_endpoint) {
          const endpoint =
            field.options_endpoint ===
              "/api/EmployeeDependent/GetChildSchools" &&
            selectFieldOption !== ""
              ? getSchoolEndpointWithOption()
              : field.options_endpoint;

          if (endpoint) {
            fetchOptions(endpoint, field.name);
          } else {
            console.error(`Endpoint is undefined for field: ${field.name}`);
          }
        } else if (field.type === "text" && field.options_endpoint) {
          const isLeaveRequestForm = formFields.some(
            (item) => item.label === "Absence Type"
          );
          if (isLeaveRequestForm) {
            const startDateField = formFields.find(
              (item) => item.name === "startDate"
            );
            const endDateField = formFields.find(
              (item) => item.name === "endDate"
            );
            const leaveTypeField = formFields.find(
              (item) => item.name === "absenceType"
            );

            if (startDateField?.defaultValue) {
              setLeaveStartDate(startDateField.defaultValue.toString());
            }
            if (endDateField?.defaultValue) {
              setLeaveEndDate(endDateField.defaultValue.toString());
            }
            if (leaveTypeField?.defaultValue) {
              setLeaveType(leaveTypeField.defaultValue.toString());
            }
          }
        }

        if (field.type === "select" && field.options) {
          setSelectOptions((prevOptions) => ({
            ...prevOptions,
            [field.name]: field.options || [],
          }));
        }

        // Handle submission endpoint from submit field or any field with submission_endpoint
        if (field.submission_endpoint) {
          setSubmissionEndpoint(field.submission_endpoint);
        }
      });
    }, [formFields, selectFieldOption]);

    // Separate useEffect to initialize default values after options are loaded
    useEffect(() => {
      formFields.forEach((field) => {
        if (field.type === "select" && field.defaultValue !== undefined) {
          // Skip if already initialized
          if (selectFieldValues[field.name] !== undefined) {
            return;
          }
          
          const defaultValue = getFieldDefaultValue(field);
          if (defaultValue !== undefined && defaultValue !== null && defaultValue !== "") {
            // Find the matching option value
            const options = selectOptions[field.name] || field.options || [];
            
            // Skip if options are not loaded yet (for fields with options_endpoint)
            if (options.length === 0 && field.options_endpoint) {
              return;
            }
            
            let matchedValue = defaultValue;
            
            // Handle boolean values - check if defaultValue matches any option value
            const trimmedDefault = typeof defaultValue === "string" ? defaultValue.trim() : defaultValue;
            const isBooleanValue = typeof defaultValue === "boolean" || 
              (typeof defaultValue === "string" && (trimmedDefault === "true" || trimmedDefault === "false" || (typeof trimmedDefault === "string" && (trimmedDefault.toLowerCase() === "yes" || trimmedDefault.toLowerCase() === "no"))));
            
            if (isBooleanValue) {
              let boolValue: boolean;
              if (typeof defaultValue === "boolean") {
                boolValue = defaultValue;
              } else {
                const lowerTrimmed = typeof trimmedDefault === "string" ? trimmedDefault.toLowerCase() : String(trimmedDefault).toLowerCase();
                boolValue = lowerTrimmed === "true" || lowerTrimmed === "yes";
              }
              
              const matchingOption = options.find((opt: any) => {
                if (typeof opt === "string") return false;
                const optValue = opt.value;
                // Compare boolean values directly or as strings
                return optValue === boolValue || 
                       optValue === String(boolValue) || 
                       String(optValue).toLowerCase() === String(boolValue).toLowerCase();
              });
              if (matchingOption) {
                matchedValue = matchingOption.value;
              }
            } else {
              // For string values, find exact match or case-insensitive match
              const matchingOption = options.find((opt: any) => {
                if (typeof opt === "string") {
                  const defStr = typeof trimmedDefault === "string" ? trimmedDefault : String(trimmedDefault);
                  return opt === defStr || opt.toLowerCase() === defStr.toLowerCase();
                }
                const optValue = String(opt.value || opt.label);
                const defValue = typeof trimmedDefault === "string" ? trimmedDefault : String(trimmedDefault);
                return optValue === defValue || optValue.toLowerCase() === defValue.toLowerCase();
              });
              if (matchingOption) {
                matchedValue = typeof matchingOption === "string" ? matchingOption : (matchingOption.value || matchingOption.label);
              }
            }
            
            // Convert matched value to string for the select element
            const stringValue = String(matchedValue);
            
            // Set the value and trigger validation to clear errors
            // Use shouldValidate: true to immediately validate and clear errors
            setValue(field.name, stringValue, { shouldValidate: true, shouldDirty: false });
            setSelectFieldValues((prev) => ({ ...prev, [field.name]: stringValue }));
            
            // Trigger validation for this field immediately to clear any errors
            // Use setTimeout to ensure setValue has completed
            setTimeout(() => {
              trigger(field.name);
            }, 0);
          }
        }
      });
    }, [selectOptions, formFields, setValue, trigger]);

    // Auto-resize textareas on mount
    useEffect(() => {
      formFields.forEach((field) => {
        if (field.type === "textarea") {
          const textarea = textareaRefs.current[field.name];
          if (textarea) {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
              autoResizeTextarea(textarea);
            }, 0);
          }
        }
      });
    }, [formFields]);

    // Initialize duration fields in form state (moved out of renderField, where
    // calling useEffect per-field violated the Rules of Hooks).
    useEffect(() => {
      formFields.forEach((field) => {
        if (field.type === "duration") {
          setValue(field.name, parseDurationValue(field.defaultValue as string));
        }
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formFields]);

    const getSchoolEndpointWithOption = () => {
      const foundObject = formFields.find((item) => item.name === "schoolName");

      const schoolEndpoint = foundObject && foundObject.options_endpoint;
      if (schoolEndpoint === "/api/EmployeeDependent/GetChildSchools") {
        if (
          selectFieldOption === "Claim" ||
          selectFieldOption === "Reimbursement"
        ) {
          return `${schoolEndpoint}/N`;
        } else if (selectFieldOption === "Direct Payment") {
          return `${schoolEndpoint}/Y`;
        } else {
          return schoolEndpoint;
        }
      }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const fieldName = e.target.name;
      const files = Array.from(e.target.files || []);

      // Check file size limits
      for (const file of files) {
        const fileSizeInMB = file.size / (1024 * 1024);
        if (fileSizeInMB > 5) {
          setErrorMessage("File size exceeds the 5MB limit.");
          return;
        }

        const newTotalSize = totalFileSize + fileSizeInMB;
        if (newTotalSize > 120) {
          setErrorMessage("Total upload size exceeds the 120MB limit.");
          return;
        }

        setSelectedFiles((prev) => {
          const existingFiles = prev[fieldName] || [];
          if (existingFiles.some((f) => f.name === file.name)) {
            setErrorMessage("This file has already been uploaded.");
            return prev;
          }
          return {
            ...prev,
            [fieldName]: [...existingFiles, file],
          };
        });

        setTotalFileSize((prev) => prev + fileSizeInMB);
      }
    };

    const onDeleteFile = (fileName: string, fieldName: string) => {
      setSelectedFiles((prev) => {
        const updatedFiles = { ...prev };
        updatedFiles[fieldName] = updatedFiles[fieldName]?.filter(
          (file) => file.name !== fileName
        );
        return updatedFiles;
      });

      // Update total file size
      const deletedFile = selectedFiles[fieldName]?.find(
        (f) => f.name === fileName
      );
      if (deletedFile) {
        setTotalFileSize((prev) => prev - deletedFile.size / (1024 * 1024));
      }
    };

    useEffect(() => {
      formFields.forEach((field) => {
        const currentValue = getValues(field.name);
        
        // Priority: submitted values > field details > defaultValue
        let valueToSet: any = null;
        
        // If form is read-only and has submitted values, use those first
        if (isReadOnly && submittedValues && submittedValues[field.name] !== undefined) {
          valueToSet = submittedValues[field.name];
        } else {
          // Otherwise use field details or defaultValue
          valueToSet = getFieldDetails(field.name) || field.defaultValue;
          if (isNumericFormField(field) && valueToSet === null) {
            valueToSet = 0;
          }
        }

        // Only set value if we have one and no current value exists (user hasn't edited it).
        // Do not use `valueToSet &&` — 0 is a valid default for number fields.
        const hasDefaultToApply =
          valueToSet != null &&
          !(typeof valueToSet === "string" && valueToSet.trim() === "") &&
          !(typeof valueToSet === "number" && Number.isNaN(valueToSet));
        const currentUnset =
          currentValue === undefined ||
          currentValue === null ||
          currentValue === "";
        if (hasDefaultToApply && currentUnset) {
          let valueForForm = valueToSet;
          if (
            field.type === "textarea" &&
            isHtmlContentField(field) &&
            typeof valueToSet === "string"
          ) {
            valueForForm = stripHtmlForTextareaDisplay(valueToSet);
          }
          setValue(field.name, valueForForm, {
            shouldValidate: true,
            shouldDirty: false, // Mark as not dirty since it's initial value
          });
        }

        // Initialize quillContent for textarea fields
        const textareaValue = isReadOnly && submittedValues && submittedValues[field.name] !== undefined
          ? submittedValues[field.name]
          : field.defaultValue;
          
        if (field.type === "textarea" && textareaValue && !quillContent) {
          const rawHtml = textareaValue.toString();
          if (isHtmlContentField(field)) {
            setQuillContent(stripHtmlForTextareaDisplay(rawHtml));
          } else {
            // Extract content between body tags or use the whole content
            const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            const content = bodyMatch ? bodyMatch[1] : rawHtml;
            setQuillContent(content);
          }
        }
      });
    }, [
      formFields,
      selectFieldOption,
      childFeeDetails,
      resumptionDetails,
      setValue,
      getValues, // Add getValues to dependencies
      quillContent, // Add quillContent to dependencies
      isReadOnly, // Add isReadOnly to dependencies
      submittedValues, // Add submittedValues to dependencies
    ]);


    const handleCancel = () => {
      setIsCancelling(true);
      setIsSubmitting(true);

      // Clear file state when cancelling
      setSelectedFiles({});
      setTotalFileSize(0);
      
      // Reset file inputs
      formFields.forEach((field) => {
        if (field.type === "file") {
          const fileInput = document.getElementById(`${formInstanceId.current}-${field.name}`) as HTMLInputElement;
          if (fileInput) {
            fileInput.value = "";
          }
        }
      });

      // First phase - show loading spinner
      setTimeout(() => {
        setIsFormVisible(false);
        setIsSubmitting(false);
        setIsCancelling(false);
      }, 800);
    };

    useEffect(() => {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }, []);

    // Trigger form animation when it becomes visible
    useEffect(() => {
      if (isFormVisible) {
        formControls.start("visible");
        fieldControls.start("visible");
      }
    }, [isFormVisible, formControls, fieldControls]);

    const handleShowForm = () => {
      setIsFormVisible(true);
      setIsSubmitting(false);
      setSubmitSuccess(false);
      
      // Clear file state when showing form again
      setSelectedFiles({});
      setTotalFileSize(0);
      
      // Reset file inputs
      formFields.forEach((field) => {
        if (field.type === "file") {
          const fileInput = document.getElementById(`${formInstanceId.current}-${field.name}`) as HTMLInputElement;
          if (fileInput) {
            fileInput.value = "";
          }
        }
      });
      
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      setFieldAnimations({});
    };

    // Helper function to call the callback URL after successful form submission
    const callCallbackUrl = async (payload: Record<string, any>) => {
      if (!metadata?.callback_url || !formId || !metadata.message_id) return;

      try {
        // Create submitted_values from payload, including only form field values
        const submittedValues: Record<string, any> = {};
        
        // Get list of form field names to include only actual form fields
        const formFieldNames = new Set(
          formFields
            .filter((field) => field.type !== "submit" && field.type !== "info")
            .map((field) => field.name)
        );
        
        // Copy form field values from payload, excluding attachments and special fields
        Object.keys(payload).forEach((key) => {
          if (
            formFieldNames.has(key) &&
            key !== "attachments" &&
            key !== "files" &&
            key !== "data" &&
            key !== "Supporting_Document" &&
            key !== "supporting_document"
          ) {
            submittedValues[key] = payload[key];
          }
        });

        // Build attachments array with file_name and file_size and add to submitted_values
        if (Object.keys(selectedFiles).length > 0) {
          const attachments: Array<{ file_name: string; file_size: number }> = [];
          for (const key in selectedFiles) {
            if (selectedFiles.hasOwnProperty(key) && key) {
              const files = selectedFiles[key] || [];
              for (const file of files) {
                attachments.push({
                  file_name: file.name,
                  file_size: file.size,
                });
              }
            }
          }
          if (attachments.length > 0) {
            submittedValues.attachments = attachments;
          }
        }

        const callbackPayload = {
          form_id: formId,
          message_id: metadata.message_id,
          submitted_values: submittedValues,
        };

        const apiBase = String(API_CONFIG.LOCAL_API_BASE_URL)
          .trim()
          .replace(/\/$/, "");
        if (!apiBase) {
          console.error("Forms callback skipped: middleware API base is not set (VITE_API_BASE_URL)");
          return;
        }
        const callbackUrl = `${apiBase}${FORMS_CALLBACK_PATH}`;
        const callbackResponse = await fetch(callbackUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(callbackPayload),
          credentials: "include",
        });

        if (!callbackResponse.ok) {
          console.error(
            "Callback URL request failed:",
            callbackResponse.status,
            await callbackResponse.text().catch(() => "")
          );
        }
      } catch (callbackError) {
        console.error("Error calling callback URL:", callbackError);
      }
    };

    const handleFormSubmit = async (data: any) => {
      if (isReadOnly) return; // Prevent submission in read-only mode

      setErrorMessage("");
      try {
        // Start the submission animation sequence
        setIsSubmitting(true);
        await formControls.start("submitting");

        const submissionPromise = new Promise(async (resolve) => {
          try {
            // Process the form data and make API request first
            let finalSubmissionEndpoint;
            if (
              data.period &&
              submissionEndpoint === "/api/Employee/PayslipRequest"
            ) {
              finalSubmissionEndpoint =
                submissionEndpoint +
                `?empid=${encodeURIComponent(data.empid)}&period=${
                  data.period
                }`;
            } else if (data && submissionEndpoint === "/payslips/generate") {
              finalSubmissionEndpoint =
                submissionEndpoint + `?month=${data.month}&year=${data.year}`;
            } else {
              finalSubmissionEndpoint = submissionEndpoint;
            }
            let feeRequestData;
            if (
              submissionEndpoint ===
              "/api/EmployeeDependent/SubmitChildFeeRequest"
            ) {
              const {
                personNumber,
                comment,
                Supporting_Document,
                // childDetails,
                // schoolName,
                ...csfDetails
              } = data;
              feeRequestData = {
                personNumber: personNumber,
                comment: comment,
                csfList: [
                  {
                    ...csfDetails,
                  },
                ],
              };
            }
            const payloadData =
              submissionEndpoint ===
              "/api/EmployeeDependent/SubmitChildFeeRequest"
                ? feeRequestData
                : data;
            let payload = {
              ...payloadData,
              attachments: [],
            };

            // Remove temporary/supporting document fields from payload before submit
            // (these are only used on the client side for uploads)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (payload as any).Supporting_Document;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (payload as any).supporting_document;

            // Re-wrap html contentType textarea fields back to HTML for submission
            formFields.forEach((field) => {
              if (
                field.type === "textarea" &&
                isHtmlContentField(field) &&
                payload[field.name] !== undefined &&
                payload[field.name] !== null
              ) {
                const text = payload[field.name] as string;
                if (typeof text === "string") {
                  const trimmed = text.trim();
                  if (trimmed && !/^<html/i.test(trimmed)) {
                    payload[field.name] = `<html><body><p>${text
                      .replace(/\n\n/g, "</p><p>")
                      .replace(/\n/g, "<br>")}</p></body></html>`;
                  }
                }
              }
            });

            // Convert comma-separated email strings to arrays for all email type fields
            formFields.forEach((field) => {
              // Remove file type fields from payload - they will be added to attachments
              if (field.type === "file" && payload[field.name] !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                delete (payload as any)[field.name];
              }
              if (field.type === "email" && payload[field.name]) {
                const emailValue = payload[field.name];
                if (typeof emailValue === "string") {
                  // Split by comma, trim each email, and filter out empty strings
                  payload[field.name] = emailValue
                    .split(",")
                    .map((email: string) => email.trim())
                    .filter((email: string) => email.length > 0);
                }
              }
              // Convert radio button string values to boolean
              if (field.type === "radio" && payload[field.name] !== undefined) {
                const radioValue = payload[field.name];
                if (typeof radioValue === "string") {
                  payload[field.name] = radioValue === "true";
                }
              }
              if (field.type === "select" && payload[field.name] !== undefined) {
                const selectedValue = payload[field.name];
                const options = selectOptions[field.name] || field.options || [];
                
                if (options.length > 0) {
                  // Normalize the selected value for comparison (trim whitespace, handle case)
                  const selectedStr = typeof selectedValue === "string" ? selectedValue.trim() : String(selectedValue);
                  
                  const matchingOption = options.find((opt: any) => {
                    if (typeof opt === "string") {
                      const optStr = String(opt).trim();
                      return optStr === selectedStr || optStr.toLowerCase() === selectedStr.toLowerCase();
                    }
                    
                    // Compare with both value and label (trimmed and case-insensitive)
                    const optValue = opt.value !== undefined ? String(opt.value).trim() : "";
                    const optLabel = String(opt.label || "").trim();
                    const optValueLower = optValue.toLowerCase();
                    const optLabelLower = optLabel.toLowerCase();
                    const selectedLower = selectedStr.toLowerCase();
                    
                    return optValue === selectedStr || 
                           optLabel === selectedStr ||
                           optValueLower === selectedLower ||
                           optLabelLower === selectedLower;
                  });
                  
                  if (matchingOption) {
                    // Always use the value property if it exists, preserving the original type
                    if (typeof matchingOption === "object") {
                      if (matchingOption.value !== undefined) {
                        payload[field.name] = matchingOption.value;
                      } else if (matchingOption.label !== undefined) {
                        // If no value property, use label as fallback
                        payload[field.name] = matchingOption.label;
                      }
                    } else if (typeof matchingOption === "string") {
                      payload[field.name] = matchingOption;
                    }
                  }
                }
              }
            });
            if (Object.keys(selectedFiles).length > 0) {
              const seenFiles = new Set<string>(); // Track files to prevent duplicates
              for (const key in selectedFiles) {
                if (selectedFiles.hasOwnProperty(key) && key) { // Skip empty field names
                  const files = selectedFiles[key] || [];
                  // Process all files in this field, not just the first one
                  for (const file of files) {
                    const fileKey = `${key}:${file.name}`; // Unique identifier for deduplication
                    if (!seenFiles.has(fileKey)) {
                      seenFiles.add(fileKey);
                      const base64File = await toBase64(file);
                      payload.attachments.push({
                        fileData: base64File,
                        fileType: file.type,
                        fieldName: key,
                        fileName: file.name,
                      });
                    }
                  }
                }
              }
            }
            
            // Remove any file type fields from payload after processing attachments
            // This ensures fields like passport_document and passport_photo are not sent outside attachments
            formFields.forEach((field) => {
              if (field.type === "file" && payload[field.name] !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                delete (payload as any)[field.name];
              }
            });
            
            if (submissionEndpoint?.includes("/Sprint/")) {
              payload.data = "";
              payload.files = payload.attachments;
            }
            if (submissionEndpoint === "/submit_feedback") {
              payload = {
                session_id: sessionId,
                query: data.query,
                // ms_graph_key: token,
              };
            }
            if (
              submissionEndpoint === "/gmail/forward_email" ||
              submissionEndpoint === "/gmail/reply_email"
            ) {
              if (typeof payload.to === "string") {
                payload.to = payload.to
                  .split(",")
                  .map((email: string) => email.trim())
                  .filter((email: string) => email.length > 0);
              }
              if (typeof payload.toRecipients === "string") {
                payload.toRecipients = payload.toRecipients
                  .split(",")
                  .map((email: string) => email.trim())
                  .filter((email: string) => email.length > 0);
              }
              if (typeof payload.cc === "string") {
                payload.cc = payload.cc
                  .split(",")
                  .map((email: string) => email.trim())
                  .filter((email: string) => email.length > 0);
              }
              if (typeof payload.ccRecipients === "string") {
                payload.ccRecipients = payload.ccRecipients
                  .split(",")
                  .map((email: string) => email.trim())
                  .filter((email: string) => email.length > 0);
              }
            }
            if (
              submissionEndpoint ===
              "/api/Employee/SubmitLeaveDutyResumptionRequest"
            ) {
              const leaveIdToFind = payload.leaveID;
              const leaveType = selectOptions.leaveType.find(
                (leave) => leave.leaveId === leaveIdToFind
              )?.type;
              payload.leaveType = leaveType;
              payload.actualEndDate = getFormattedDate(payload.actualEndDate);
              payload.actualStartDate = getFormattedDate(
                payload.actualStartDate
              );
            }
            if (
              submissionEndpoint?.includes("/graph/") ||
              submissionEndpoint?.includes("/gmail/")
            ) {
              if (submissionEndpoint.trim() === "/graph/v1.0/me/events") {
                let emailModePayload;
                if (submissionEndpoint.trim() === "/graph/v1.0/me/events") {
                  emailModePayload = generateMeetingPayload(data);
                } else if (
                  submissionEndpoint.trim() === "/graph/v1.0/me/sendMail"
                ) {
                  emailModePayload = generateSendEmailPayload(data);
                }
                if (emailModePayload === undefined) {
                  setTimeout(() => {
                    setIsSubmitting(false);
                    setFieldAnimations({});
                  }, 1000);
                  return resolve({
                    success: false,
                    error: "Payload generation failed",
                  });
                }
                payload = emailModePayload;
              } else {
                const {
                  conversation_id,
                  email_id,
                  toRecipients,
                  to,
                  cc,
                  ccRecipients,
                  body,
                  subject,
                  email_sync_id,
                  user_id,
                } = data;
                const formatRecipients = (recipients: string | string[]) => {
                  if (Array.isArray(recipients)) {
                    return recipients.map((email) => ({
                      emailAddress: { address: email.trim() },
                    }));
                  } else if (typeof recipients === "string") {
                    return recipients.split(",").map((email) => ({
                      emailAddress: { address: email.trim() },
                    }));
                  }
                  return [];
                };
                payload = {
                  subject: subject,
                  body: body,
                  toRecipients: toRecipients || to,
                  ...(ccRecipients && ccRecipients.length > 0
                    ? { ccRecipients: formatRecipients(ccRecipients || cc) }
                    : {}),
                  user_id: user_id,
                  conversation_id: conversation_id,
                  email_id: email_id,
                  email_sync_id: email_sync_id,
                };
              }
            }
            if (typeof payload.toRecipients === "string") {
              payload.toRecipients = payload.toRecipients
                .split(",")
                .map((email: string) => email.trim())
                .filter((email: string) => email.length > 0);
            }
            if (typeof payload.ccRecipients === "string") {
              payload.ccRecipients = payload.ccRecipients
                .split(",")
                .map((email: string) => email.trim())
                .filter((email: string) => email.length > 0);
            }
            const finalEndpoint = finalSubmissionEndpoint.includes("{action}")
              ? finalSubmissionEndpoint.replace("{action}", data.action)
              : finalSubmissionEndpoint;
            const isAbsoluteUrl = /^https?:\/\//i.test(finalEndpoint);
            const requestUrl = isAbsoluteUrl
              ? finalEndpoint
              : `${(API_CONFIG.LOCAL_API_BASE_URL || "").replace(/\/$/, "")}${finalEndpoint}`;
            const isPostRequest = !finalSubmissionEndpoint.includes("{action}");
            const requestPayload = isPostRequest
              ? { ...payload, session_id: sessionId }
              : payload;
            const response = await fetch(requestUrl, {
              method: finalSubmissionEndpoint.includes("{action}")
                ? "PUT"
                : "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestPayload),
              credentials: "include",
            });
            if (
              response.status === 202 ||
              response.status === 201 ||
              response.status === 200
            ) {
              // API request successful, now call propOnSubmit if it exists
              if (propOnSubmit) {
                // Include attachment info in submitted data for local storage
                const submittedData = { ...data };
                if (Object.keys(selectedFiles).length > 0) {
                  submittedData._attachments = {};
                  for (const key in selectedFiles) {
                    if (selectedFiles.hasOwnProperty(key) && key) {
                      submittedData._attachments[key] = selectedFiles[key].map(f => ({
                        file_name: f.name,
                        file_size: f.size,
                      }));
                    }
                  }
                }
                await propOnSubmit(submittedData);
              }

              // Call callback URL if metadata exists
              await callCallbackUrl(payload);

              return resolve({ success: true });
            }
            const responseData = await response.json();
            if (!response.ok || responseData.responseCode !== 0) {
              const errorMessage =
                responseData.responseMessage?.split("(")[0].trim() ||
                "An error occurred";
              if (responseData.error?.code === "ErrorDuplicateTransactionId") {
                setErrorMessage(
                  "The selected time slot is unavailable. Kindly choose a different one."
                );
                notify.error(
                  "The selected time slot is unavailable. Kindly choose a different one.",
                );
              } else {
                setErrorMessage(errorMessage);
                notify.error("Error occurred!");
              }
              return resolve({ success: false, error: errorMessage });
            } else {
              // API request successful, now call propOnSubmit if it exists
              if (propOnSubmit) {
                // Include attachment info in submitted data for local storage
                const submittedData = { ...data };
                if (Object.keys(selectedFiles).length > 0) {
                  submittedData._attachments = {};
                  for (const key in selectedFiles) {
                    if (selectedFiles.hasOwnProperty(key) && key) {
                      submittedData._attachments[key] = selectedFiles[key].map(f => ({
                        file_name: f.name,
                        file_size: f.size,
                      }));
                    }
                  }
                }
                await propOnSubmit(submittedData);
              }

              // Call callback URL if metadata exists
              await callCallbackUrl(payload);

              return resolve({ success: true });
            }
          } catch (error) {
            console.error("Submission error:", error);
            const errorMessage =
              error instanceof Error ? error.message : "An error occurred";
            return resolve({ success: false, error: errorMessage });
          }
        });

        // Wait only for the API request to complete, no artificial timer
        const result = await submissionPromise;

        if ((result as any).success) {
          setSubmitSuccess(true);
          setIsSubmitting(false);
          formStatus(formIndex, true);
          
          // Clear file state on successful submission
          setSelectedFiles({});
          setTotalFileSize(0);
          
          // Reset file inputs
          formFields.forEach((field) => {
            if (field.type === "file") {
              const fileInput = document.getElementById(`${formInstanceId.current}-${field.name}`) as HTMLInputElement;
              if (fileInput) {
                fileInput.value = "";
              }
            }
          });
          
          setTimeout(() => {
            closeForm();
          }, 1000); // Brief delay to show success state
        } else {
          // Error handling from promise result
          setIsSubmitting(false);
          await formControls.start("visible");
        }

        setTotalFileSize(0);
      } catch (error) {
        console.error("Some error occurred:", error);
        notify.error("Some error occurred");

        // Reset form state on error
        setIsSubmitting(false);
        await formControls.start("visible");
      }
    };

    const renderSelectOptions = (
      options: any[],
      defaultValue?: string,
      isLoading?: boolean
    ) => {
      if (isLoading) {
        return (
          <option value="" disabled>
            {isArabicMode ? "جاري التحميل..." : "Loading..."}
          </option>
        );
      }

      if (!options || options.length === 0) {
        return (
          <option value="" disabled>
            {isArabicMode ? "لا توجد خيارات متاحة" : "No options available"}
          </option>
        );
      }

      const optionElements = options.map((option, index) => {
        if (typeof option === "string") {
          return (
            <option key={index} value={option}>
              {option}
            </option>
          );
        }

        const label = getOptionLabel(option);
        // Convert value to string for proper comparison (handles boolean values)
        const value = option.value !== undefined ? String(option.value) : String(option.label || "");

        return (
          <option key={index} value={value}>
            {label}
          </option>
        );
      });

      // Add a default "Please select" option if no default value
      if (!defaultValue) {
        optionElements.unshift(
          <option key="default" value="" disabled>
            {isArabicMode ? "يرجى الاختيار" : "Please select"}
          </option>
        );
      }

      return optionElements;
    };

    const onChangeSelectOption = (fieldName: any, value: any) => {
      setSelectFieldOption(value);
      setSelectFieldValues((prev) => ({ ...prev, [fieldName]: value }));

      // Handle isOnlineMeeting logic
      // if (fieldName === "isOnlineMeeting") {
      //   // Convert value to boolean if it's a string
      //   const isOnline = value === true || value === "true";

      //   dispatch(
      //     updateFieldRequirement({
      //       id: message.id,
      //       fieldName: "venue",
      //       required: !isOnline, // Set required to false if online, true otherwise
      //     })
      //   );
      //   dispatch(
      //     updateIsOnlineMeetFieldRequirement({
      //       id: message.id,
      //       fieldName: "isOnlineMeeting",
      //       defaultValue: isOnline, // Set required to false if online, true otherwise
      //     })
      //   );
      // }

      // Update select field values
      setSelectFieldValues((prevValues) => ({
        ...prevValues,
        [fieldName]: value,
      }));

      // Handle childDetails or leaveType
      if (selectOptions.childDetails) {
        const foundObject = selectOptions.childDetails.find(
          (item) => item.childName === value
        );
        setChildFeeDetails(foundObject || {});
      } else if (selectOptions.leaveType) {
        const foundObject = selectOptions.leaveType.find(
          (item) => item.leaveId === value
        );
        setResumptionDetails(foundObject || {});
      }
    };

    // Effect to watch for date changes and update calculated days
    // Compute the day count from the live watched dates, falling back to the
    // field defaults on the initial render (before react-hook-form has picked
    // up the uncontrolled date inputs). Writing the numberOfDays field is left
    // to the single writer effect below, keyed on `calculatedDays`.
    useEffect(() => {
      const startDateField = formFields.find(
        (field) => field.name === "startDate" || field.name === "start_date"
      );
      const endDateField = formFields.find(
        (field) => field.name === "endDate" || field.name === "end_date"
      );
      const start =
        watchedStartDate || startDateField?.defaultValue?.toString();
      const end = watchedEndDate || endDateField?.defaultValue?.toString();

      if (start && end) {
        setCalculatedDays(calculateNumberOfDays(start, end));
      }
    }, [watchedStartDate, watchedEndDate, formFields]);

    // Single writer: reflect the computed day count into the numberOfDays field.
    useEffect(() => {
      const numberOfDaysField = formFields.find(
        (field) =>
          field.name === "numberOfDays" ||
          field.name === "days_requested" ||
          field.name === "number_of_days"
      );

      if (numberOfDaysField && calculatedDays !== null) {
        // Force update the field value to reflect the new calculation
        setValue(numberOfDaysField.name, calculatedDays, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    }, [calculatedDays, formFields, setValue]);

    const getFieldDetails = (field: string) => {
      const details = [
        "startDate",
        "endDate",
        "start_date",
        "end_date",
        "hospitalStartDate",
        "hospitalEndDate",
        "hospital_start_date",
        "hospital_end_date",
        "returnDate",
        "return_date",
      ];
      if (details.includes(field)) {
        return field;
      }
      return null;
    };

    // Helper functions for Arabic language support
    const getFieldLabel = (field: FormField) => {
      return isArabicMode && field.arabicLabel
        ? field.arabicLabel
        : field.label;
    };

    const isLongFieldLabel = (field: FormField) => {
      const label = getFieldLabel(field) || "";
      return label.length > 35;
    };

    const getFieldPlaceholder = (field: FormField) => {
      return isArabicMode && field.arabicPlaceholder
        ? field.arabicPlaceholder
        : field.placeholder;
    };

    const getFieldDefaultValue = (field: FormField) => {
      if (!field) return "";

      // If form is read-only and has submitted values, use submitted value first
      if (isReadOnly && submittedValues && submittedValues[field.name] !== undefined) {
        const submittedValue = submittedValues[field.name];
        // Handle array values (e.g., email arrays)
        if (Array.isArray(submittedValue)) {
          return submittedValue.join(", ");
        }
        return submittedValue;
      }

      // For fields that have language-specific values
      if (isArabicMode && field.arabicDefaultValue) {
        return field.arabicDefaultValue;
      }

      // For fields that should maintain their value regardless of language
      if (
        field.name === "numberOfDays" ||
        field.name === "days_requested" ||
        field.name === "number_of_days"
      ) {
        return field.defaultValue;
      }

      // For email fields with array default values, convert to comma-separated string
      if (field.type === "email" && Array.isArray(field.defaultValue)) {
        return field.defaultValue.join(", ");
      }

      // Int-like fields cannot use null as default — coerce to 0
      if (isNumericFormField(field) && field.defaultValue === null) {
        return 0;
      }

      // Default handling — avoid `||` so numeric 0 and boolean false are preserved
      if (field.defaultValue === undefined || field.defaultValue === null) {
        return "";
      }
      return field.defaultValue;
    };

    // Helper function to validate required fields with default values
    const validateRequiredField = (value: any, field: FormField) => {
      // If field is not required, it's always valid
      if (!field.required) {
        return true;
      }

      // Helper to check if a value is truly empty
      const isEmpty = (val: any): boolean => {
        if (val === undefined || val === null) return true;
        if (typeof val === "string" && val.trim() === "") return true;
        if (Array.isArray(val) && val.length === 0) return true;
        return false;
      };

      // Check if field has a default value that's not empty
      // If there's a default value, the field is always valid (default will be used)
      const defaultValue = getFieldDefaultValue(field);
      if (!isEmpty(defaultValue)) {
        return true;
      }

      // Check current value from form state (in case default was set via setValue or user input)
      const currentValue = getValues(field.name);
      if (!isEmpty(currentValue)) {
        return true;
      }

      // Check the passed value (handle 0, false, and other valid falsy values)
      if (value !== undefined && value !== null) {
        if (typeof value === "number") return true; // 0 is a valid number
        if (typeof value === "boolean") return true; // false is a valid boolean
        if (typeof value === "string" && value.trim() !== "") return true;
        if (Array.isArray(value) && value.length > 0) return true;
      }

      // Value is empty and no default exists, show error
      return `${getFieldLabel(field)} ${isArabicMode ? "مطلوب" : "is required"}`;
    };

    const getOptionLabel = (option: any) => {
      if (typeof option === "string") return option;
      return isArabicMode && option.arabicLabel
        ? option.arabicLabel
        : option.label;
    };

    const getFormTitle = () => {
      return isArabicMode && arabicFormTitle ? arabicFormTitle : formTitle;
    };

    const renderField = (field: FormField, index: number) => {
      switch (field.type) {
        case "info":
          return (
            <div key={index} className="mb-4" hidden={!field.visibleToUser}>
              <label
                className="block text-sm font-medium  mb-1"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))",
                }}
              >
                {getFieldLabel(field)}
              </label>
              <div
                className="w-full p-2 rounded border border-border-main bg-surface-2 mb-0"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))",
                  borderColor: "rgb(var(--color-border))",
                }}
              >
                {getFieldDefaultValue(field)?.toString() || ""}
              </div>
            </div>
          );
        case "email":
          return (
            <div
              key={index}
              className={`${
                filteredSuggestions[field.name]?.length > 0 ? "mb-28" : "mb-4"
              } relative`}
              hidden={!field.visibleToUser}
            >
              <label
                className="block text-sm font-medium mb-1"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))",
                }}
              >
                {getFieldLabel(field)}
                {field.required && <span className="text-status-error ml-1">*</span>}
                {(field.isMultipleEmail || field.type === "email") && (
                    <span
                      className="text-xs block mb-1"
                      style={{
                        direction: isArabicMode ? "rtl" : "ltr",
                        textAlign: isArabicMode ? "right" : "left",
                        color: "rgb(var(--color-text))",
                        opacity: 0.7,
                      }}
                    >
                    {isArabicMode
                      ? "أدخل قيم مفصولة بفواصل"
                      : "Enter comma separated values"}
                  </span>
                )}
              </label>
              <div className="relative overflow-visible">
                {showSuggestions[field.name] && (
                  <div
                    ref={(el) => (suggestionRefs.current[field.name] = el)}
                    className="absolute w-full bg-surface border border-border-main rounded-md shadow-lift max-h-60 overflow-y-auto scrollbar-themed"
                    style={{
                      top: "calc(100% )",
                      left: 0,
                      minWidth: "250px",
                      position: "absolute",
                      zIndex: 9999,
                      direction: isArabicMode ? "rtl" : "ltr",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    {filteredSuggestions[field.name]?.map((suggestion, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 z-50 text-text-main hover:bg-surface-2 cursor-pointer flex flex-col transition-colors duration-150"
                        style={{
                          direction: isArabicMode ? "rtl" : "ltr",
                          textAlign: isArabicMode ? "right" : "left",
                        }}
                        onClick={() =>
                          handleSuggestionClick(suggestion, field.name)
                        }
                      >
                        <span className="font-medium">
                          {suggestion.display_name}
                        </span>
                        <span className="text-xs text-text-muted">
                          {suggestion.email}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  multiple={field.isMultipleEmail}
                  {...register(field.name, {
                    required: false,
                    validate: (value) => validateRequiredField(value, field),
                  })}
                  defaultValue={getFieldDefaultValue(field)?.toString() || ""}
                  placeholder={getFieldPlaceholder(field)}
                  readOnly={!isEditable || field.readOnly}
                  className={`w-full box-border text-xs ${
                    !isEditable ? "p-0" : "p-2"
                  } rounded outline-none transition-all mb-0 ${
                    !isEditable
                      ? "bg-transparent border-none"
                      : "border focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  } ${
                    field.readOnly && isEditable
                      ? "opacity-70 cursor-not-allowed"
                      : ""
                  }`}
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                    color: "rgb(var(--color-text))",
                    backgroundColor: !isEditable ? "transparent" : "rgb(var(--color-surface))",
                    borderColor: !isEditable ? "transparent" : "rgb(var(--color-border))",
                  }}
                  onChange={(e) => handleEmailInputChange(e, field.name)}
                />
              </div>
              {errors[field.name] && (
                <p
                  className="text-status-error text-sm mt-1"
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                  }}
                >
                  {errors[field.name]?.message?.toString()}
                </p>
              )}
            </div>
          );
        case "textarea":
          return (
            <div key={index} className="mb-2" hidden={!field.visibleToUser}>
              <label
                className="block text-sm font-medium mb-1"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))",
                }}
              >
                {getFieldLabel(field)}
                {field.required && <span className="text-status-error ml-1">*</span>}
              </label>

              <textarea
                {...(() => {
                  const { onChange: registerOnChange, ref: registerRef, ...registerProps } = register(field.name, {
                    required: false,
                    validate: (value) => validateRequiredField(value, field),
                  });
                  return {
                    ...registerProps,
                    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                      registerOnChange(e);
                      autoResizeTextarea(e.target);
                    },
                    ref: (el: HTMLTextAreaElement | null) => {
                      // Call react-hook-form's ref
                      if (registerRef) {
                        if (typeof registerRef === 'function') {
                          registerRef(el);
                        } else if (registerRef && 'current' in registerRef) {
                          (registerRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                        }
                      }
                      // Store in our refs object
                      textareaRefs.current[field.name] = el;
                      // Auto-resize on mount
                      if (el) {
                        setTimeout(() => {
                          autoResizeTextarea(el);
                        }, 0);
                      }
                    },
                  };
                })()}
                defaultValue={(() => {
                  const raw = getFieldDefaultValue(field)?.toString() || "";
                  if (isHtmlContentField(field)) {
                    return stripHtmlForTextareaDisplay(raw);
                  }
                  return raw;
                })()}
                placeholder={getFieldPlaceholder(field)}
                readOnly={!isEditable || field.readOnly}
                className={`w-full ${
                  !isEditable ? "p-0 resize-none" : "p-2 resize-none"
                } rounded outline-none transition-all mb-0 ${
                  !isEditable
                    ? "bg-transparent border-none"
                    : "border focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                } ${
                  field.readOnly && isEditable
                    ? "opacity-70 cursor-not-allowed"
                    : ""
                }`}
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))",
                  backgroundColor: !isEditable ? "transparent" : "rgb(var(--color-surface))",
                  borderColor: !isEditable ? "transparent" : "rgb(var(--color-border))",
                  minHeight: "20px",
                  overflow: "hidden",
                }}
              />

              {errors[field.name] && (
                <p
                  className="text-status-error text-sm mt-1"
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                  }}
                >
                  {errors[field.name]?.message?.toString()}
                </p>
              )}
            </div>
          );

        case "file":
          return (
            <div key={index} className="mb-4" hidden={!field.visibleToUser}>
              <label
                className="block text-sm font-medium mb-1"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))",
                }}
              >
                {getFieldLabel(field)}
                {field.required && <span className="text-status-error ml-1">*</span>}
                <span
                  className="text-xs text-text-muted block"
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                    color: "rgb(var(--color-text))",
                  }}
                >
                  {isArabicMode
                    ? "حد أقصى 5 ميجابايت لكل ملف، 120 ميجابايت إجمالي"
                    : "Max 5MB per file, 120MB total"}
                </span>
              </label>

              <Controller
                name={field.name}
                control={control}
                rules={{ required: field.required }}
                render={({ field: { onChange } }) => {
                  // Get attachments from backend response or from local submitted values
                  const existingAttachments = field.attachment && Array.isArray(field.attachment) && field.attachment.length > 0
                    ? field.attachment
                    : (submittedValues?._attachments?.[field.name] || []);
                  
                  return (
                  <>
                    {/* Display existing attachments from backend or local submission (for submitted forms in view mode) */}
                    {!isEditable && existingAttachments.length > 0 ? (
                      <div>
                        {existingAttachments.map((att: { file_name: string; file_size: number }, i: number) => (
                          <div
                            key={`existing-${i}`}
                            className="flex items-center mt-1 text-sm rounded px-2 py-1"
                            style={{
                              direction: isArabicMode ? "rtl" : "ltr",
                            }}
                          >
                            <Paperclip className="w-4 h-4 text-primary mr-2" />
                            <span style={{ color: "rgb(var(--color-text))" }}>{att.file_name}</span>
                            
                            <span className="ml-2 text-xs">
                              ({(att.file_size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <input
                          type="file"
                          id={`${formInstanceId.current}-${field.name}`}
                          name={field.name}
                          className="hidden"
                          onChange={(e) => {
                            handleFileChange(e);
                            onChange(e.target.files);
                          }}
                          multiple
                          disabled={!isEditable}
                        />
                        <label
                          htmlFor={`${formInstanceId.current}-${field.name}`}
                          className={`flex items-center gap-2 cursor-pointer ${
                            !isEditable ? "pointer-events-none opacity-50" : ""
                          }`}
                          style={{
                            direction: isArabicMode ? "rtl" : "ltr",
                            justifyContent: isArabicMode
                              ? "flex-end"
                              : "flex-start",
                            color: "rgb(var(--color-text))",
                          }}
                        >
                          <Paperclip className="text-primary" />
                          <span>
                            {isArabicMode ? "إضافة مرفق" : "Add Attachment"}
                          </span>
                        </label>
                      </>
                    )}

                    {/* Display newly selected files */}
                    {selectedFiles[field.name]?.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center mt-1 text-text-main text-sm"
                        style={{
                          direction: isArabicMode ? "rtl" : "ltr",
                          justifyContent: isArabicMode
                            ? "space-between"
                            : "flex-start",
                        }}
                      >
                        <span style={{ color: "rgb(var(--color-text))" }}>{file.name}</span>
                        {isEditable && (
                          <button
                            type="button"
                            onClick={() => onDeleteFile(file.name, field.name)}
                            className={`text-status-error ${
                              isArabicMode ? "mr-2" : "ml-2"
                            }`}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </>
                );
                }}
              />

              {errors[field.name] && (
                <p
                  className="text-status-error text-sm mt-1"
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                  }}
                >
                  {errors[field.name]?.message?.toString()}
                </p>
              )}
            </div>
          );

        case "text":
          return (
            <div key={index} className="mb-4" hidden={!field.visibleToUser}>
              <label
                className="block text-sm font-medium mb-1"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))",
                }}
              >
                {getFieldLabel(field)}
                {field.required && <span className="text-status-error ml-1">*</span>}
                {(field.name === "numberOfDays" ||
                  field.name === "days_requested" ||
                  field.name === "number_of_days") && (
                  <span className="text-xs text-primary ml-2">
                    ({isArabicMode ? "محسوب تلقائيا" : "Auto-calculated"})
                  </span>
                )}
              </label>
              <Controller
                name={field.name}
                control={control}
                defaultValue={
                  (getFieldDetails(field.name) ||
                    getFieldDefaultValue(field) ||
                    leaveDuration) as string
                }
                rules={{
                  required: false,
                  validate: (value) => validateRequiredField(value, field),
                }}
                render={({ field: controllerField }) => (
                  <input
                    type="text"
                    {...controllerField}
                    placeholder={getFieldPlaceholder(field)}
                    readOnly={
                      !isEditable ||
                      field.readOnly ||
                      field.name === "numberOfDays" ||
                      field.name === "days_requested" ||
                      field.name === "number_of_days"
                    }
                    className={`w-full ${
                      !isEditable ? "p-0" : "p-2"
                    } rounded outline-none transition-all mb-0 ${
                      !isEditable
                        ? "bg-transparent border-none"
                        : "border focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                    } ${
                      (field.readOnly ||
                        field.name === "numberOfDays" ||
                        field.name === "days_requested" ||
                        field.name === "number_of_days") &&
                      isEditable
                        ? "opacity-70 cursor-not-allowed"
                        : ""
                    }`}
                    style={{
                      direction: isArabicMode ? "rtl" : "ltr",
                      textAlign: isArabicMode ? "right" : "left",
                      color: "rgb(var(--color-text))",
                      backgroundColor: !isEditable ? "transparent" : "rgb(var(--color-surface))",
                      borderColor: !isEditable ? "transparent" : "rgb(var(--color-border))",
                    }}
                    onKeyDown={(e) => {
                      // Handle Arabic keyboard mapping
                      if (isArabicMode) {
                        const isCharacterKey =
                          e.key.length === 1 &&
                          !e.ctrlKey &&
                          !e.metaKey &&
                          !e.altKey;

                        if (isCharacterKey && ARABIC_KEY_MAP[e.key]) {
                          e.preventDefault();

                          const input = e.target as HTMLInputElement;
                          const start = input.selectionStart || 0;
                          const end = input.selectionEnd || 0;
                          const arabicChar = ARABIC_KEY_MAP[e.key];

                          // Get current value from controller field
                          const currentValue = controllerField.value || "";

                          // Create new value with Arabic character
                          const newValue =
                            currentValue.substring(0, start) +
                            arabicChar +
                            currentValue.substring(end);

                          // Update the field value
                          controllerField.onChange(newValue);

                          // Set cursor position after the inserted character
                          setTimeout(() => {
                            input.selectionStart = input.selectionEnd =
                              start + arabicChar.length;
                          }, 0);
                        }
                      }
                    }}
                  />
                )}
              />
              {errors[field.name] && (
                <p
                  className="text-status-error text-sm mt-1"
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                  }}
                >
                  {errors[field.name]?.message?.toString()}
                </p>
              )}
            </div>
          );

        case "date":
          return (
            <div key={index} className="mb-4" hidden={!field.visibleToUser}>
              <label
                className="block text-sm font-medium mb-1"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))",
                }}
              >
                {getFieldLabel(field)}
                {field.required && <span className="text-status-error ml-1">*</span>}
              </label>
              <div className="relative">
                <input
                  type="date"
                  {...register(field.name, {
                    required: false,
                    validate: (value) => validateRequiredField(value, field),
                    onChange: () => {
                      // Handle date change and recalculate days if this is a leave form
                      if (
                        field.name === "startDate" ||
                        field.name === "endDate" ||
                        field.name === "start_date" ||
                        field.name === "end_date"
                      ) {
                        const numberOfDaysField = formFields.find(
                          (f) =>
                            f.name === "numberOfDays" ||
                            f.name === "days_requested" ||
                            f.name === "number_of_days"
                        );
                        if (numberOfDaysField) {
                          // Trigger recalculation after a short delay to allow form state to update
                          setTimeout(() => {
                            const startDateValue =
                              getValues("startDate") || getValues("start_date");
                            const endDateValue =
                              getValues("endDate") || getValues("end_date");

                            if (startDateValue && endDateValue) {
                              const days = calculateNumberOfDays(
                                startDateValue,
                                endDateValue
                              );
                              setCalculatedDays(days);
                              setValue(
                                numberOfDaysField.name,
                                days.toString(),
                                {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                }
                              );
                            }
                          }, 100);
                        }
                      }
                    },
                  })}
                  defaultValue={field.defaultValue?.toString() || ""}
                  readOnly={!isEditable || field.readOnly}
                  className={`w-full ${
                    !isEditable ? "p-0" : "p-2"
                  } rounded outline-none transition-all mb-0 ${
                    !isEditable
                      ? "bg-transparent border-none"
                      : "border focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  } [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-200 ${
                    !isEditable || field.readOnly
                      ? "opacity-70 cursor-not-allowed"
                      : ""
                  }`}
                  style={{
                    color: "rgb(var(--color-text))",
                    backgroundColor: !isEditable ? "transparent" : "rgb(var(--color-surface))",
                    borderColor: !isEditable ? "transparent" : "rgb(var(--color-border))",
                  }}
                />
              </div>
              {errors[field.name] && (
                <p
                  className="text-status-error text-sm mt-1"
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                  }}
                >
                  {errors[field.name]?.message?.toString()}
                </p>
              )}
            </div>
          );
        case "duration": {
          // Default value parsed for rendering the hour/minute selects.
          // The form-state initialization happens in a top-level effect
          // (initDurationFields) — hooks cannot run inside renderField.
          const durationValue = parseDurationValue(
            field.defaultValue as string
          );

          return (
            <div key={index} className="mb-4" hidden={!field.visibleToUser}>
              <label
                className="block text-sm font-medium mb-1"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))",
                }}
              >
                {getFieldLabel(field)}
                {field.required && <span className="text-status-error ml-1">*</span>}
              </label>
              <div
                className="flex gap-x-2"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                }}
              >
                <select
                  {...register(field.name + ".hours", {
                    onChange: () => {
                      const hoursValue = getValues(field.name + ".hours");
                      const minutesValue = getValues(field.name + ".minutes");
                      setValue(field.name, {
                        hours: hoursValue,
                        minutes: minutesValue,
                      });
                    },
                  })}
                  defaultValue={durationValue.hours}
                  disabled={!isEditable || field.readOnly}
                  className={`w-full ${
                    !isEditable ? "p-0" : "p-2"
                  } rounded outline-none transition-all mb-0 ${
                    !isEditable
                      ? "bg-transparent border-none"
                      : "border focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  } ${
                    field.readOnly && isEditable
                      ? "opacity-70 cursor-not-allowed"
                      : ""
                  }`}
                  style={{
                    color: "rgb(var(--color-text))",
                    backgroundColor: !isEditable ? "transparent" : "rgb(var(--color-surface))",
                    borderColor: !isEditable ? "transparent" : "rgb(var(--color-border))",
                  }}
                >
                  {Array.from({ length: 13 }, (_, i) => (
                    <option key={i} value={i}>
                      {i} hr
                    </option>
                  ))}
                </select>
                <select
                  {...register(field.name + ".minutes", {
                    onChange: () => {
                      const hoursValue = getValues(field.name + ".hours");
                      const minutesValue = getValues(field.name + ".minutes");
                      setValue(field.name, {
                        hours: hoursValue,
                        minutes: minutesValue,
                      });
                    },
                  })}
                  defaultValue={durationValue.minutes}
                  disabled={!isEditable || field.readOnly}
                  className={`w-full ${
                    !isEditable ? "p-0" : "p-2"
                  } rounded outline-none transition-all mb-0 ${
                    !isEditable
                      ? "bg-transparent border-none"
                      : "border focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  } ${
                    field.readOnly && isEditable
                      ? "opacity-70 cursor-not-allowed"
                      : ""
                  }`}
                  style={{
                    color: "rgb(var(--color-text))",
                    backgroundColor: !isEditable ? "transparent" : "rgb(var(--color-surface))",
                    borderColor: !isEditable ? "transparent" : "rgb(var(--color-border))",
                  }}
                >
                  <option value={0}>0 mins</option>
                  <option value={15}>15 mins</option>
                  <option value={30}>30 mins</option>
                  <option value={45}>45 mins</option>
                </select>
              </div>
              {field.required && (
                <input
                  type="hidden"
                  {...register(field.name, {
                    required: "Duration is required",
                    validate: (value) => {
                      if (!value) return "Duration is required";
                      const { hours, minutes } = value;
                      return (
                        Number(hours) > 0 ||
                        Number(minutes) > 0 ||
                        "Duration is required"
                      );
                    },
                  })}
                />
              )}
              {errors[field.name] && (
                <p
                  className="text-status-error text-sm mt-1"
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                  }}
                >
                  {errors[field.name]?.message?.toString()}
                </p>
              )}
            </div>
          );
        }
        case "datetime":
          return (
            <div key={index} className="mb-4" hidden={!field.visibleToUser}>
              <label
                className="block text-sm font-medium text-text-main mb-1"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                }}
              >
                {getFieldLabel(field)}
                {field.required && <span className="text-status-error ml-1">*</span>}
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  {...register(field.name, {
                    required: false,
                    validate: (value) => validateRequiredField(value, field),
                  })}
                  defaultValue={getFormattedDateTime(field.defaultValue as string | undefined)}
                  readOnly={!isEditable || field.readOnly}
                  className={`w-full ${
                    !isEditable ? "p-0" : "p-2"
                  } rounded outline-none transition-all mb-0 ${
                    !isEditable
                      ? "bg-transparent border-none"
                      : "border focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  } [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-200 [&::-webkit-calendar-picker-indicator]:cursor-pointer ${
                    field.readOnly && isEditable
                      ? "opacity-70 cursor-not-allowed"
                      : ""
                  }`}
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                    color: "rgb(var(--color-text))",
                    backgroundColor: !isEditable ? "transparent" : "rgb(var(--color-surface))",
                    borderColor: !isEditable ? "transparent" : "rgb(var(--color-border))",
                  }}
                />
              </div>
              {errors[field.name] && (
                <p
                  className="text-status-error text-sm mt-1"
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                  }}
                >
                  {errors[field.name]?.message?.toString()}
                </p>
              )}
            </div>
          );

        case "time":
          return (
            <div
              key={index}
              className="mb-4 relative"
              hidden={!field.visibleToUser}
            >
              <label
                className="block text-sm font-medium mb-1"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))",
                }}
              >
                {getFieldLabel(field)}
                {field.required && <span className="text-status-error ml-1">*</span>}
              </label>
              <div className="relative">
                <input
                  type="time"
                  {...register(field.name, {
                    required: field.required
                      ? `${getFieldLabel(field)} ${
                          isArabicMode ? "مطلوب" : "is required"
                        }`
                      : false,
                  })}
                  defaultValue={field.defaultValue?.toString() || ""}
                  placeholder={getFieldPlaceholder(field)}
                  readOnly={!isEditable || field.readOnly}
                  className={`w-full p-2 rounded border focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all mb-0 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-200 ${
                    !isEditable || field.readOnly
                      ? "opacity-70 cursor-not-allowed"
                      : ""
                  }`}
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                    color: "rgb(var(--color-text))",
                    backgroundColor: "rgb(var(--color-surface))",
                    borderColor: "rgb(var(--color-border))",
                  }}
                />
                <Clock
                  className={`absolute top-1/2 transform -translate-y-1/2 text-text-muted pointer-events-none ${
                    isArabicMode ? "left-3" : "right-3"
                  }`}
                />
              </div>
              {errors[field.name] && (
                <p
                  className="text-status-error text-sm mt-1"
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                  }}
                >
                  {errors[field.name]?.message?.toString()}
                </p>
              )}
            </div>
          );

        case "select":
          return (
            <div key={index} className="mb-4" hidden={!field.visibleToUser}>
              <label
                className="block text-sm font-medium mb-1"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))",
                }}
              >
                {getFieldLabel(field)}
                {field.required && <span className="text-status-error ml-1">*</span>}
              </label>
              <div className="relative">
                <select
                  {...register(field.name, {
                    required: false,
                    validate: (value) => {
                      // Check if value is already set in selectFieldValues (set by useEffect)
                      const storedValue = selectFieldValues[field.name];
                      if (storedValue !== undefined && storedValue !== null && storedValue !== "") {
                        return true; // Value is set, so it's valid
                      }
                      
                      // Check if value matches any option value that corresponds to the default
                      const defaultValue = getFieldDefaultValue(field);
                      if (defaultValue !== undefined && defaultValue !== null && defaultValue !== "") {
                        const options = selectOptions[field.name] || field.options || [];
                        if (value && options.length > 0) {
                          const matchingOption = options.find((opt: any) => {
                            if (typeof opt === "string") {
                              return opt === String(value) || opt === String(defaultValue);
                            }
                            const optValue = String(opt.value || opt.label);
                            return optValue === String(value) || optValue === String(defaultValue);
                          });
                          if (matchingOption) {
                            return true;
                          }
                        }
                        // If value is empty but default exists, allow it (default will be used)
                        if (!value || value === "") {
                          return true;
                        }
                        // If value matches default (as string), it's valid
                        if (value && (String(value) === String(defaultValue) || String(value).trim() === String(defaultValue).trim())) {
                          return true;
                        }
                      }
                      
                      // Use the standard validation helper
                      return validateRequiredField(value, field);
                    },
                    onChange: (e) => {
                      const selectedStringValue = e.target.value;
                      // Find the actual option value (not label) from the options
                      const options = selectOptions[field.name] || field.options || [];
                      let actualValue = selectedStringValue;
                      
                      // Find matching option by comparing the string value with option.value (converted to string)
                      const matchingOption = options.find((opt: any) => {
                        if (typeof opt === "string") {
                          return String(opt) === selectedStringValue;
                        }
                        // Compare with the option's value (converted to string), not label
                        const optValueStr = opt.value !== undefined ? String(opt.value) : "";
                        return optValueStr === selectedStringValue;
                      });
                      
                      if (matchingOption) {
                        if (typeof matchingOption === "object" && matchingOption.value !== undefined) {
                          // Use the actual value property, preserving its type (boolean, number, etc.)
                          actualValue = matchingOption.value;
                        } else if (typeof matchingOption === "string") {
                          actualValue = matchingOption;
                        }
                      }
                      
                      onChangeSelectOption(field.name, actualValue);
                      setValue(field.name, actualValue, { shouldValidate: true });
                    },
                  })}
                  value={
                    selectFieldValues[field.name] !== undefined
                      ? String(selectFieldValues[field.name])
                      : getFieldDefaultValue(field) !== undefined && getFieldDefaultValue(field) !== null && getFieldDefaultValue(field) !== ""
                        ? String(getFieldDefaultValue(field))
                        : ""
                  }
                  disabled={
                    !isEditable || loadingOptions[field.name] || field.readOnly
                  }
                  className={`w-full ${
                    !isEditable ? "p-0" : "p-2"
                  } rounded outline-none transition-all appearance-none ${
                    !isEditable
                      ? "bg-transparent border-none"
                      : "border focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  } ${
                    (loadingOptions[field.name] || field.readOnly) && isEditable
                      ? "opacity-70 cursor-not-allowed"
                      : ""
                  }`}
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                    color: "rgb(var(--color-text))",
                    backgroundColor: !isEditable ? "transparent" : "rgb(var(--color-surface))",
                    borderColor: !isEditable ? "transparent" : "rgb(var(--color-border))",
                  }}
                >
                  {renderSelectOptions(
                    selectOptions[field.name] || field.options,
                    selectFieldValues[field.name] !== undefined
                      ? String(selectFieldValues[field.name])
                      : getFieldDefaultValue(field)?.toString()
                  )}
                </select>
                {isEditable && (
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted pointer-events-none ${
                      isArabicMode ? "left-3" : "right-3"
                    }`}
                  >
                    <ChevronDown size={20} />
                  </div>
                )}
              </div>
              {errors[field.name] && (
                <p
                  className="text-status-error text-sm mt-1"
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                  }}
                >
                  {errors[field.name]?.message?.toString()}
                </p>
              )}
            </div>
          );

        case "integer":
        case "int":
        case "number":
          return (
            <div key={index} className="mb-4" hidden={!field.visibleToUser}>
              <label
                className="block text-sm font-medium mb-1"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))",
                }}
              >
                {getFieldLabel(field)}
                {field.required && <span className="text-status-error ml-1">*</span>}
                {(field.name === "numberOfDays" ||
                  field.name === "days_requested" ||
                  field.name === "number_of_days") && (
                  <span className="text-xs text-primary ml-2">
                    ({isArabicMode ? "محسوب تلقائيا" : "Auto-calculated"})
                  </span>
                )}
              </label>
              <input
                type="number"
                {...register(field.name, {
                  required: false,
                  validate: (value) => validateRequiredField(value, field),
                  min: field.min,
                  max: field.max,
                  valueAsNumber: true,
                })}
                defaultValue={(() => {
                  const fromDetails = getFieldDetails(field.name);
                  if (fromDetails) return fromDetails;
                  const def = getFieldDefaultValue(field);
                  if (def === undefined || def === null || def === "") return "";
                  if (typeof def === "number") return def;
                  return String(def);
                })()}
                placeholder={getFieldPlaceholder(field)}
                readOnly={
                  !isEditable ||
                  field.readOnly ||
                  field.name === "numberOfDays" ||
                  field.name === "days_requested" ||
                  field.name === "number_of_days"
                }
                min={field.min}
                max={field.max}
                step={field.step || 1}
                className={`w-full ${
                  !isEditable ? "p-0" : "p-2"
                } rounded outline-none transition-all mb-0 ${
                  !isEditable
                    ? "bg-transparent border-none"
                    : "border focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                } ${
                  (field.readOnly ||
                    field.name === "numberOfDays" ||
                    field.name === "days_requested" ||
                    field.name === "number_of_days") &&
                  isEditable
                    ? "opacity-70 cursor-not-allowed"
                    : ""
                }`}
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))",
                  backgroundColor: !isEditable ? "transparent" : "rgb(var(--color-surface))",
                  borderColor: !isEditable ? "transparent" : "rgb(var(--color-border))",
                }}
              />
              {errors[field.name] && (
                <p
                  className="text-status-error text-sm mt-1"
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                  }}
                >
                  {errors[field.name]?.message?.toString()}
                </p>
              )}
            </div>
          );

        case "radio":
          return (
            <div
              key={index}
              className="mb-4"
              hidden={!field.visibleToUser}
            >
              <label 
                className="block text-sm font-medium text-text-main mb-2"
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                  textAlign: isArabicMode ? "right" : "left",
                  color: "rgb(var(--color-text))"
                }}
              >
                {getFieldLabel(field)}
                {field.required && <span className="text-status-error ml-1">*</span>}
              </label>
              <div
                className={`flex items-center ${isArabicMode ? "space-x-reverse mr-2" : "space-x-4 ml-2"}`}
                style={{
                  direction: isArabicMode ? "rtl" : "ltr",
                }}
              >
                {field.defaultValue === true ? (
                  <>
                    <label className={`flex items-center ${isArabicMode ? "space-x-reverse" : "space-x-2"}`}>
                      <input
                        type="radio"
                        {...register(field.name, {
                          required: false,
                          validate: (value) => validateRequiredField(value, field),
                        })}
                        value="true"
                        defaultChecked
                        disabled={!isEditable || field.readOnly}
                        className="text-primary"
                      />
                      <span className="text-sm" style={{ color: "rgb(var(--color-text))" }}>{isArabicMode ? "نعم" : "Yes"}</span>
                    </label>
                    <label className={`flex items-center ${isArabicMode ? "space-x-reverse" : "space-x-2"}`}>
                      <input
                        type="radio"
                        {...register(field.name, {
                          required: false,
                          validate: (value) => validateRequiredField(value, field),
                        })}
                        value="false"
                        disabled={!isEditable || field.readOnly}
                        className="text-primary"
                      />
                      <span className="text-sm" style={{ color: "rgb(var(--color-text))" }}>{isArabicMode ? "لا" : "No"}</span>
                    </label>
                  </>
                ) : (
                  <>
                    <label className={`flex items-center ${isArabicMode ? "space-x-reverse" : "space-x-2"}`}>
                      <input
                        type="radio"
                        {...register(field.name, {
                          required: false,
                          validate: (value) => validateRequiredField(value, field),
                        })}
                        value="true"
                        disabled={!isEditable || field.readOnly}
                        className="text-primary"
                      />
                      <span className="text-sm" style={{ color: "rgb(var(--color-text))" }}>{isArabicMode ? "نعم" : "Yes"}</span>
                    </label>
                    <label className={`flex items-center ${isArabicMode ? "space-x-reverse" : "space-x-2"}`}>
                      <input
                        type="radio"
                        {...register(field.name, {
                          required: false,
                          validate: (value) => validateRequiredField(value, field),
                        })}
                        value="false"
                        defaultChecked
                        disabled={!isEditable || field.readOnly}
                        className="text-primary"
                      />
                      <span className="text-sm" style={{ color: "rgb(var(--color-text))" }}>{isArabicMode ? "لا" : "No"}</span>
                    </label>
                  </>
                )}
              </div>
              {errors[field.name] && (
                <p 
                  className="text-status-error text-sm mt-1"
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                  }}
                >
                  {errors[field.name]?.message?.toString()}
                </p>
              )}
            </div>
          );

        default:
          return null;
      }
    };

    // Group fields by category if they have formatCategory
    const categories = Array.from(
      new Set(formFields.map((field) => field.formatCategory).filter(Boolean))
    );

    // Add this near your other useEffect hooks
    useEffect(() => {
      formFields.forEach((field) => {
        if (field.arabicDefaultValue || field.defaultValue) {
          const value = getFieldDefaultValue(field);
    
          if (field.type === "textarea") {
            const rawHtml = value?.toString() || "";
            if (isHtmlContentField(field)) {
              const stripped = stripHtmlForTextareaDisplay(rawHtml);
              setValue(field.name, stripped);
              setQuillContent(stripped);
            } else {
              const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
              const content = bodyMatch ? bodyMatch[1] : rawHtml;
              setValue(field.name, content);
              setQuillContent(content);
            }
          } else {
            setValue(field.name, value);
          }
        }
      });
    }, [isArabicMode, formFields]); // Dependency on language mode

    return (
      <div className="max-w-2xl mx-auto mb-2 relative dynamic-form">
        <style>{`
          .dynamic-form input::placeholder,
          .dynamic-form textarea::placeholder {
            color: rgb(var(--color-text));
            opacity: 0.5;
          }
          .dynamic-form input:focus::placeholder,
          .dynamic-form textarea:focus::placeholder {
            opacity: 0.3;
          }
          .dynamic-form select option {
            color: rgb(var(--color-text));
            background-color: rgb(var(--color-surface));
          }
        `}</style>
        <AnimatePresence mode="wait"></AnimatePresence>

        {(() => {
          const shouldShowButton = !isFormVisible && !isSubmitting;
          const shouldShowForm = isFormVisible;
          
          if (shouldShowButton) {
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  damping: 20,
                  stiffness: 300,
                }}
              >
                <motion.button
                  onClick={handleShowForm}
                  variants={buttonVariants}
                  initial="idle"
                  whileHover="hover"
                  whileTap="tap"
                  className="w-full py-3 px-4 bg-primary hover:bg-primary/90 rounded-lg text-white transition-colors duration-300 flex items-center justify-center gap-2"
                >
                  <motion.div
                    animate={{ rotate: [0, 180, 0] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <ArrowDown size={20} />
                  </motion.div>
                  {isArabicMode ? "إظهار النموذج" : "Show Form"}
                </motion.button>
              </motion.div>
            );
          }
          
          if (shouldShowForm) {
            return (
          <motion.form
            ref={formRef}
            onSubmit={handleSubmit(handleFormSubmit)}
            animate={formControls}
            variants={formVariants}
            initial="hidden"
            className="p-4 bg-surface border border-border-main rounded-2xl relative overflow-visible"
            style={{ color: "rgb(var(--color-text))" }}
          >
            {/* Form Title and Language Toggle Button - Outside fieldset so close button works in read-only */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex-1 flex items-center gap-2">
                {(formTitle || arabicFormTitle) && (
                  <h2
                    className="text-lg font-semibold mb-0"
                    style={{
                      direction: isArabicMode ? "rtl" : "ltr",
                      textAlign: isArabicMode ? "right" : "left",
                      color: "rgb(var(--color-text))",
                    }}
                  >
                    {getFormTitle()}
                  </h2>
                )}
                {submitted && !isEditable && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-status-success/10 text-status-success border border-status-success/20"
                    style={{
                      direction: isArabicMode ? "rtl" : "ltr",
                    }}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {isArabicMode ? "تم الإرسال" : "Submitted"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm" style={{ color: "rgb(var(--color-text))" }}>
                  {isEditable ? "Editing" : "View Only"}
                </label>
                <Switch
                  checked={isEditable}
                  onCheckedChange={(checked) => {
                    if (!isReadOnly) {
                      setIsEditable(checked);
                    }
                  }}
                  disabled={isReadOnly}
                  className="data-[state=checked]:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
                />
                  <button
                    onClick={closeForm}
                    className="transition-colors"
                    style={{
                      color: "rgb(var(--color-text))",
                      opacity: 0.7,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "0.7";
                    }}
                    type="button"
                  >
                  <X size={24} />
                </button>
              </div>
            </div>
            <fieldset disabled={isReadOnly} className="border-0 p-0 m-0">
              <div className="max-h-[min(70vh,720px)] min-h-0 overflow-y-auto scrollbar-themed pr-1">
              {errorMessage && (
                <p
                  className="text-status-error text-sm mb-2"
                  style={{
                    direction: isArabicMode ? "rtl" : "ltr",
                    textAlign: isArabicMode ? "right" : "left",
                  }}
                >
                  &#42;{errorMessage}
                </p>
              )}
              <div
                className={`overflow-x-visible overflow-y-hidden will-change-[max-height,opacity,transform] transition-all duration-700 ease-in-out ${
                  isSubmitting || submitSuccess
                    ? "max-h-0 opacity-0 -translate-y-4"
                    : "max-h-[2000px] opacity-100 translate-y-0"
                }`}
                style={{ color: "rgb(var(--color-text))" }}
              >
                {/* Categorized fields */}
                {categories.map((category) => (
                  <div key={category} className="mb-6">
                    <h3
                      className="text-sm font-medium mb-2 uppercase tracking-wider"
                      style={{
                        direction: isArabicMode ? "rtl" : "ltr",
                        textAlign: isArabicMode ? "right" : "left",
                        color: "rgb(var(--color-text))",
                        opacity: 0.7,
                      }}
                    >
                      {category}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 px-1.5">
                      {formFields
                        .filter(
                          (field) =>
                            field.formatCategory === category &&
                            field.visibleToUser !== false
                        )
                        .map((field, index) => {
                          const isFullWidth = 
                            field.type?.toLowerCase() === "textarea" ||
                            field.type?.toLowerCase() === "file" ||
                            isLongFieldLabel(field);
                          const colSpanClass = isFullWidth ? "col-span-2" : "";
                          
                          return (
                            <motion.div
                              key={index}
                              custom={index}
                              animate={fieldControls}
                              variants={fieldVariants}
                              initial="visible"
                              className={`overflow-visible ${colSpanClass}`}
                            >
                              {renderField(field, index)}
                            </motion.div>
                          );
                        })}
                    </div>
                  </div>
                ))}

                {/* Uncategorized fields */}

                {/* <div>
              {formFields
                .filter((field) => !field.formatCategory)
                .map((field, index) => {
                  const delay = `${index * 50}ms`;
                  return (
                    <div
                      key={index}
                      className={`overflow-hidden will-change-[max-height,opacity,margin,transform] transition-all duration-500 ease-in-out ${
                        isSubmitting
                          ? "opacity-0 max-h-0 mb-0 -translate-y-4"
                          : "opacity-100 max-h-[200px] mb-0 translate-y-0"
                      }`}
                      style={{
                        transitionDelay: delay,
                      }}
                    >
                      {renderField(field, index)}
                    </div>
                  );
                })}
            </div> */}
                <div className="grid grid-cols-2 gap-2 px-0.5">
                  {formFields
                    .filter(
                      (field) =>
                        !field.formatCategory && field.visibleToUser !== false
                    )
                    .map((field, index) => {
                      const isFullWidth =
                        field.type?.toLowerCase() === "textarea" ||
                        field.type?.toLowerCase() === "file" ||
                        isLongFieldLabel(field);
                      const colSpanClass = isFullWidth ? "col-span-2" : "";
                      
                      return (
                        <motion.div
                          key={index}
                          custom={index}
                          animate={fieldControls}
                          variants={fieldVariants}
                          initial="visible"
                          className={`overflow-visible ${colSpanClass}`}
                        >
                          {renderField(field, index)}
                        </motion.div>
                      );
                    })}
                </div>
              </div>
              </div>

              {/* Submit and Cancel buttons - Only show when not in readonly mode and form is editable */}
              {!isReadOnly && isEditable && (
                <div className="mt-4 relative flex flex-row justify-evenly w-full gap-x-2">
                  {!isSubmitting && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={isSubmitting || submitSuccess}
                      className={`py-3 w-full flex items-center justify-center rounded transition-all duration-700 ease-in-out relative overflow-hidden border border-border-main hover:bg-surface-2 ${
                        isCancelling
                          ? "bg-surface-2"
                          : "bg-transparent hover:bg-surface-2"
                      } hover:scale-[1.02] active:scale-[0.98]`}
                      style={{
                        color: "rgb(var(--color-text))",
                      }}
                    >
                      <span
                        className={`block transition-opacity duration-700 ease-in-out text-text-muted ${
                          isSubmitting ? "" : ""
                        }`}
                        style={{
                          // color: "rgb(var(--color-text))",
                        }}
                      >
                        {isArabicMode ? "إلغاء" : "Cancel"}
                      </span>
                    </button>
                  )}

                  <motion.button
                    type="submit"
                    disabled={isSubmitting || submitSuccess}
                    variants={buttonVariants}
                    initial="idle"
                    animate={
                      submitSuccess
                        ? "submitting"
                        : isSubmitting
                        ? "submitting"
                        : "idle"
                    }
                    whileHover={
                      !isSubmitting && !submitSuccess
                        ? "hover"
                        : undefined
                    }
                    whileTap={
                      !isSubmitting && !submitSuccess
                        ? "tap"
                        : undefined
                    }
                    className={`py-3 w-full flex items-center justify-center rounded transition-colors duration-300 relative overflow-hidden border-2 border-transparent ${
                      isArabicMode ? "text-center" : "text-center"
                    } ${
                      submitSuccess
                        ? "bg-status-success"
                        : isSubmitting
                        ? "bg-primary"
                        : "bg-primary hover:bg-primary/90"
                    }`}
                    style={{
                      color: "rgb(var(--color-text))",
                    }}
                    onClick={(e) => {
                      if (!isSubmitting && !submitSuccess) {
                        // Add Framer Motion ripple effect
                        const button = e.currentTarget;
                        const ripple = document.createElement("div");
                        ripple.style.position = "absolute";
                        ripple.style.borderRadius = "50%";
                        ripple.style.background = "rgb(var(--color-primary-foreground) / 0.3)";
                        ripple.style.transform = "scale(0)";
                        ripple.style.animation = "ripple 0.6s linear";
                        ripple.style.left = "50%";
                        ripple.style.top = "50%";
                        ripple.style.width = "100px";
                        ripple.style.height = "100px";
                        ripple.style.marginLeft = "-50px";
                        ripple.style.marginTop = "-50px";
                        button.appendChild(ripple);
                        setTimeout(() => ripple.remove(), 600);
                      }
                    }}
                  >
                    {isSubmitting && !submitSuccess && !isCancelling && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 flex items-center justify-center gap-2"
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="rounded-full h-5 w-5 border-2 border-white/30 border-t-white"
                        />
                        <span className="font-medium" style={{ color: "rgb(var(--color-text))" }}>
                          {isArabicMode ? "جاري المعالجة..." : "Processing..."}
                        </span>
                      </motion.div>
                    )}

                    <span
                      className={`block transition-opacity duration-700 ease-in-out text-white ${
                        isCancelling || isSubmitting ? "opacity-0" : "opacity-100"
                      }`}
                      style={{
                        // color: "rgb(var(--color-text))",
                      }}
                    >
                      {formButtons && formButtons[0]
                        ? formButtons[0].label ||
                          (isArabicMode
                            ? (formButtons[0].arabicTitle as string)
                            : formButtons[0].title) ||
                          (isArabicMode ? "إرسال" : "Submit")
                        : isArabicMode
                        ? "إرسال"
                        : "Submit"}
                    </span>

                    {submitSuccess && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            type: "spring",
                            damping: 15,
                            stiffness: 300,
                          }}
                          className="absolute inset-0 flex items-center justify-center"
                          style={{
                            color: "rgb(var(--color-text))",
                          }}
                        >
                        <motion.svg
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.5 }}
                          className="w-5 h-5 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <motion.path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </motion.svg>
                        {isArabicMode ? "تم الإرسال" : "Submitted"}
                      </motion.span>
                    )}
                  </motion.button>
                </div>
              )}
            </fieldset>
          </motion.form>
            );
          }
          
          return null;
        })()}
      </div>
    );
  }
);

export default DynamicForm;
