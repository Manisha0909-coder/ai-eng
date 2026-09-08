## US: 001

As a User, I want to ask the HR Assistant how many leave types I have, so that I can understand my leave entitlements before applying.

**Acceptance Criteria:**
- User can type a natural language query about leave types.
- AI must respond with a structured breakdown of all leave types available to the user.
- Response must include leave type name, total days, days used, and days remaining.
- Information must be presented in a clear, readable table or list format.

---

## US: 002

As a User, I want to apply for leave by telling the HR Assistant in natural language, so that the system automatically prepares my leave application without manual data entry.

**Acceptance Criteria:**
- User can request leave by typing (e.g., "apply sick leave for tomorrow").
- AI must understand the request and generate a leave application summary.
- Summary must include leave type, date(s), duration, reason, and status.
- A form widget labelled "Apply Leave" must appear after the summary.

---

## US: 003

As a User, I want to review and edit the pre-filled leave form before submitting, so that I can correct any details the AI may have misunderstood.

**Acceptance Criteria:**
- Form must open with values pre-filled by the AI (leave type, start date, end date, reason).
- User must be able to change the leave type via a dropdown.
- User must be able to change start and end dates.
- Number of days must be auto-calculated when dates change.
- Reason field must be editable.

---

## US: 004

As a User, I want to submit the leave application form from the chat, so that my leave request is recorded in the system and I receive a clear confirmation.

**Acceptance Criteria:**
- A Submit button must be visible in the form widget.
- Clicking Submit must send the form data to the system.
- Chat must display "All forms have been submitted successfully." as a confirmation message.
- AI must respond acknowledging the submission with a summary (e.g., leave type, date, pending approval status).
- Submitted leave must reflect the correct details entered in the form.

---

## US: 005

As a User, I want to cancel the leave form without submitting, so that I can abort an accidental or incorrect leave request and re-open the form if needed.

**Acceptance Criteria:**
- A Cancel button must be visible alongside Submit.
- Clicking Cancel must collapse the form without submitting any data.
- After cancellation, a "Show Form" button must appear in place of the form.
- Clicking "Show Form" must re-expand the form with the previously pre-filled values.
- No leave application must be created after cancellation.

---
