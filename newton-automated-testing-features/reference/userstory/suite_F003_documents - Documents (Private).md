## US001

As a Super Admin, I want to view my own private documents, so that I can access and manage the documents I have personally uploaded to the system.

**Acceptance Criteria:**
    - The Private Documents page displays only the documents uploaded by the logged-in Super Admin.
    - Each document card shows its name, file format, upload date, and any tags attached to it.
    - Private documents are not visible to any other user, including other Super Admins or System Admins.
    - Super Admin can search or scroll through the list to locate a specific document.


## US002

As a Super Admin, I want to upload a private document, so that I can store and reference personal files within the system.

**Acceptance Criteria:**
    - Super Admin can upload a document using an upload option on the Private Documents page.
    - Supported file formats are: PDF, DOCX, PPTX, XLSX, HTML, MD, ASCIIDOC, CSV, JPG, and PNG.
    - If an unsupported file format is uploaded, an error message is shown indicating the supported formats.
    - Once uploaded successfully, the document appears in the Super Admin's private document list immediately.
    - The uploaded document is not accessible to any other user.


## US003

As a Super Admin, I want to batch upload multiple private documents at once, so that I can save time when adding several files together.

**Acceptance Criteria:**
    - Super Admin can select and upload up to 5 documents in a single batch upload action.
    - Supported file formats for batch upload are: PDF, DOCX, PPTX, XLSX, HTML, MD, ASCIIDOC, CSV, JPG, and PNG.
    - If more than 5 files are selected, an error message is shown stating the maximum batch limit is 5 documents.
    - If any file in the batch has an unsupported format, that file is rejected and the Super Admin is notified, while valid files proceed with upload.
    - All successfully uploaded documents appear in the private document list immediately after the batch upload completes.


## US004

As a Super Admin, I want to manage personal document tags, so that I can organise and categorise my private documents for easy retrieval.

**Acceptance Criteria:**
    - Super Admin can create new personal tags to use across their private documents.
    - Super Admin can rename or delete existing personal tags.
    - Deleting a tag removes it from all documents it was attached to, but does not delete the documents themselves.
    - Personal tags are only visible and usable by the Super Admin who created them.


## US005

As a Super Admin, I want to attach or remove personal tags from my private documents, so that I can keep my documents organised and easy to find.

**Acceptance Criteria:**
    - Super Admin can attach one or more personal tags to any of their private documents.
    - Super Admin can remove a tag from a document without deleting the tag or the document.
    - Tag changes are reflected on the document card immediately.
    - Only tags created by the Super Admin are available for selection.


## US006

As a Super Admin, I want to delete my own private documents, so that I can remove files that are no longer needed.

**Acceptance Criteria:**
    - Super Admin can delete any document from their private document list using a delete option on the document card.
    - Before deletion, a confirmation message is shown: "Are you sure you want to delete this document? This action cannot be undone." along with the document name.
    - Once confirmed, the document is permanently removed and no longer appears in the list.
    - If Super Admin changes their mind, they can cancel and the document remains as it is.
    - Super Admin can only delete their own private documents and cannot delete documents belonging to other users.
