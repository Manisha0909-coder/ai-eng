# DynamicForm Component Documentation


## Field Types

The component supports the following field types:

### 1. `text`
Single-line text input field.

**Example:**
```typescript
{
  type: "text",
  name: "employeeName",
  label: "Employee Name",
  arabicLabel: "اسم الموظف",
  placeholder: "Enter name",
  arabicPlaceholder: "أدخل الاسم",
  required: true,
  defaultValue: "John Doe"
}
```

### 2. `email`
Email input field with autocomplete suggestions. Supports multiple emails (comma-separated).

**Example:**
```typescript
{
  type: "email",
  name: "toRecipients",
  label: "Recipients",
  arabicLabel: "المستلمون",
  required: true,
  isMultipleEmail: true, // Allows comma-separated emails
  defaultValue: "user@example.com"
}
```

### 3. `textarea`
Multi-line text input with auto-resize functionality.

**Example:**
```typescript
{
  type: "textarea",
  name: "comments",
  label: "Comments",
  arabicLabel: "تعليقات",
  placeholder: "Enter your comments",
  required: false,
  defaultValue: "<body>Default HTML content</body>"
}
```

### 4. `date`
Date picker input field.

**Example:**
```typescript
{
  type: "date",
  name: "startDate",
  label: "Start Date",
  arabicLabel: "تاريخ البدء",
  required: true,
  defaultValue: "2024-01-15"
}
```

### 5. `datetime`
Date and time picker input field.

**Example:**
```typescript
{
  type: "datetime",
  name: "meetingDateTime",
  label: "Meeting Date & Time",
  required: true,
  defaultValue: "2024-01-15T14:30"
}
```

### 6. `time`
Time picker input field.

**Example:**
```typescript
{
  type: "time",
  name: "startTime",
  label: "Start Time",
  required: true,
  defaultValue: "09:00"
}
```

### 7. `number`
Numeric input field with min/max validation.

**Example:**
```typescript
{
  type: "number",
  name: "age",
  label: "Age",
  required: true,
  min: 0,
  max: 120,
  step: 1,
  defaultValue: "25"
}
```

**Special Auto-Calculated Fields:**
- `numberOfDays`, `days_requested`, or `number_of_days` - Automatically calculated from `startDate`/`endDate` fields. Read-only.

### 8. `select`
Dropdown select field with static or dynamic options.

**Example with static options:**
```typescript
{
  type: "select",
  name: "department",
  label: "Department",
  required: true,
  options: [
    { value: "hr", label: "Human Resources", arabicLabel: "الموارد البشرية" },
    { value: "it", label: "IT", arabicLabel: "تقنية المعلومات" },
    { value: "finance", label: "Finance", arabicLabel: "المالية" }
  ],
  defaultValue: "hr"
}
```

**Example with dynamic options (from API):**
```typescript
{
  type: "select",
  name: "leaveType",
  label: "Leave Type",
  required: true,
  options_endpoint: "/api/Employee/GetLeaveTypes",
  defaultValue: "annual"
}
```

### 9. `radio`
Radio button group (Yes/No options).

**Example:**
```typescript
{
  type: "radio",
  name: "isOnlineMeeting",
  label: "Online Meeting?",
  required: true,
  defaultValue: true // true = "Yes" selected, false = "No" selected
}
```

### 10. `file`
File upload field with size validation.

**Example:**
```typescript
{
  type: "file",
  name: "supportingDocument",
  label: "Supporting Document",
  required: true
}
```

**File Upload Limits:**
- Maximum 5MB per file
- Maximum 120MB total for all files
- Supported formats: Images (JPG, JPEG, PNG, GIF, BMP, TIFF, TIF) and PDFs

### 11. `info`
Read-only information display field (not editable).

**Example:**
```typescript
{
  type: "info",
  name: "employeeId",
  label: "Employee ID",
  defaultValue: "EMP-12345",
  visibleToUser: true
}
```

### 12. `duration`
Duration selector with hours and minutes dropdowns.

**Example:**
```typescript
{
  type: "duration",
  name: "meetingDuration",
  label: "Duration",
  required: true,
  defaultValue: "1h 30m" // Format: "{hours}h {minutes}m"
}
```

---

## Field Properties

### Mandatory Field Properties

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | **REQUIRED** - Field type (see Field Types above). |
| `name` | `string` | **REQUIRED** - Unique field identifier. Used as the key in form submission data. |
| `label` | `string` | **REQUIRED** - English label displayed above the field. |

### Optional Field Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `arabicLabel` | `string` | `undefined` | Arabic label shown when language is Arabic. |
| `defaultValue` | `string \| boolean \| string[]` | `undefined` | Default value for the field. For email fields, can be array or comma-separated string. |
| `arabicDefaultValue` | `string` | `undefined` | Arabic default value (for text/textarea fields). |
| `required` | `boolean` | `false` | When `true`, field must be filled before submission. Shows red asterisk (*). |
| `placeholder` | `string` | `undefined` | English placeholder text. |
| `arabicPlaceholder` | `string` | `undefined` | Arabic placeholder text. |
| `visibleToUser` | `boolean` | `true` | When `false`, field is hidden from user. |
| `readOnly` | `boolean` | `false` | When `true`, field cannot be edited (even if form is editable). |
| `formatCategory` | `string` | `undefined` | Groups fields into categories. Fields with same category are displayed together. |
| `submission_endpoint` | `string` | `undefined` | API endpoint for form submission. Can be set on any field, but typically on submit field. |
| `options_endpoint` | `string` | `undefined` | API endpoint to fetch dynamic options (for `select` fields). |
| `options` | `Array<{value, label, arabicLabel?} \| string>` | `undefined` | Static options for `select` fields. Can be objects with value/label or simple strings. |
| `isMultipleEmail` | `boolean` | `false` | For `email` fields, allows comma-separated multiple emails. |
| `min` | `number` | `undefined` | Minimum value for `number` fields. |
| `max` | `number` | `undefined` | Maximum value for `number` fields. |
| `step` | `number` | `1` | Step increment for `number` fields. |
| `minValue` | `number` | `undefined` | Alternative to `min` (legacy support). |
| `maxValue` | `number` | `undefined` | Alternative to `max` (legacy support). |
| `contentType` | `string` | `undefined` | Content type for textarea fields (e.g., "HTML"). |


## Form Submission

### Submission Endpoint
Set `submission_endpoint` on any field (typically the submit button field):

```typescript
{
  type: "submit",
  name: "submit",
  submission_endpoint: "/api/Employee/SubmitLeaveRequest"
}
```

### Submission Payload Structure

The form data is submitted as JSON with the following structure:

```typescript
{
  // All form field values
  fieldName1: "value1",
  fieldName2: "value2",
  // ...
  
  // File attachments (if any)
  attachments: [
    {
      fileData: "base64EncodedString",
      fileType: "image/png",
      fieldName: "supportingDocument",
      fileName: "document.png"
    }
  ]
}

## Complete Example

```typescript
import DynamicForm from "@/components/DynamicForm/DynamicForm";

const MyForm = () => {
  const formFields = [
    {
      type: "text",
      name: "employeeName",
      label: "Employee Name",
      arabicLabel: "اسم الموظف",
      required: true,
      placeholder: "Enter your name"
    },
    {
      type: "email",
      name: "email",
      label: "Email Address",
      required: true,
      isMultipleEmail: false
    },
    {
      type: "date",
      name: "startDate",
      label: "Start Date",
      required: true,
      formatCategory: "Leave Details"
    },
    {
      type: "date",
      name: "endDate",
      label: "End Date",
      required: true,
      formatCategory: "Leave Details"
    },
    {
      type: "number",
      name: "numberOfDays",
      label: "Number of Days",
      formatCategory: "Leave Details",
      // Auto-calculated, read-only
    },
    {
      type: "select",
      name: "leaveType",
      label: "Leave Type",
      required: true,
      options_endpoint: "/api/Employee/GetLeaveTypes",
      formatCategory: "Leave Details"
    },
    {
      type: "file",
      name: "supportingDocument",
      label: "Supporting Document",
      required: false,
      formatCategory: "Attachments"
    },
    {
      type: "textarea",
      name: "comments",
      label: "Comments",
      placeholder: "Enter any additional comments"
    }
  ];



## Validation Rules

1. **Required Fields:** Must have a value before submission
2. **Email Fields:** Validates email format (supports multiple comma-separated emails)
3. **Number Fields:** Validates min/max constraints if specified
4. **File Fields:** 
   - Maximum 5MB per file
   - Maximum 120MB total
   - Duplicate file names are rejected
5. **Date Fields:** Validates date format
6. **Select Fields:** Value must match one of the available options

---

## Error Handling

- Validation errors are displayed below each field in red
- Form submission errors are shown at the top of the form
- File upload errors show specific messages (size limit, format, etc.)
- API errors from `options_endpoint` are logged to console

---

## Notes

- Form fields are automatically validated on change (`mode: 'onChange'`)
- Default values are set when form loads
- Fields with `visibleToUser: false` are hidden but still included in submission
- File fields are removed from payload and added to `attachments` array
- Email fields with multiple values are converted to arrays in payload
- Radio button values are converted to booleans (`"true"` → `true`, `"false"` → `false`)
- Select field values are normalized to match option values (handles string/boolean/number types)

