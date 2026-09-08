### **US001 – View all public documents**

**User Story**
As an admin, I want to view all public documents so that I can manage and monitor available content.

**Acceptance Criteria**

- Displays a list of all public documents
- Shows document name, tags, upload date, and status
- Supports pagination or infinite scroll
- Allows sorting (e.g., by date, name)

---

### **US002 – Upload public document (single)**

**User Story**
As an admin, I want to upload a single public document so that it can be accessed by users.

**Acceptance Criteria**

- Allows upload of one file at a time
- Accepts only supported formats: PDF, DOCX, PPTX, XLSX, HTML, MD, ASCIIDOC, CSV, JPG, PNG
- Shows validation error for unsupported formats
- Displays upload success/failure message

---

### **US003 – Batch upload public documents (max 5)**

**User Story**
As an admin, I want to upload multiple public documents at once so that I can save time.

**Acceptance Criteria**

- Allows upload of up to 5 files per batch
- Validates all file formats (same supported list)
- Rejects files exceeding limit or unsupported formats
- Shows individual file upload status

---

### **US004 – Update document metadata (name / tags)**

**User Story**
As an admin, I want to update document metadata so that documents remain organized and searchable.

**Acceptance Criteria**

- Allows editing document name
- Allows adding/removing tags
- Saves changes successfully
- Reflects updates immediately in document list

---

### **US005 – Attach document tag to document**

**User Story**
As an admin, I want to attach tags to documents so that they can be categorized properly.

**Acceptance Criteria**

- Displays available tags
- Allows selection of one or more tags
- Updates document with selected tags

---

### **US006 – Remove document tag from document**

**User Story**
As an admin, I want to remove tags from documents so that outdated or incorrect classifications are corrected.

**Acceptance Criteria**

- Shows assigned tags on a document
- Allows removal of selected tags
- Updates document immediately

---

### **US007 – Delete public document**

**User Story**
As an admin, I want to delete a public document so that obsolete or incorrect files are removed.

**Acceptance Criteria**

- Provides delete option for each document
- Shows confirmation prompt before deletion
- Removes document from list after deletion

---

### **US008 – Create / edit / delete document tags**

**User Story**
As an admin, I want to manage document tags so that categorization stays relevant.

**Acceptance Criteria**

- Can create new tags
- Can edit existing tag names
- Can delete tags
- Prevents duplicate tag names

---

### **US009 – Document processing status visible (pending / ready / failed)**

**User Story**
As an admin, I want to see document processing status so that I know whether documents are usable.

**Acceptance Criteria**

- Displays status: Pending, Ready, Failed
- Updates status dynamically
- Failed status includes error indication

---

### **US010 – Retry failed document upload**

**User Story**
As an admin, I want to retry failed uploads so that I don’t have to re-upload manually.

**Acceptance Criteria**

- Retry option available for failed uploads
- Re-attempts upload with same file
- Updates status after retry

---

### **US011 – Search across documents**

**User Story**
As an admin, I want to search documents so that I can quickly find specific files.

**Acceptance Criteria**

- Supports keyword search (name, tags)
- Displays relevant results
- Handles no-result scenarios gracefully

---

### **US012 – Download document**

**User Story**
As an admin, I want to download documents so that I can review or share them offline.

**Acceptance Criteria**

- Provides download option for each document
- Downloads correct file version
- Handles download errors gracefully

---
