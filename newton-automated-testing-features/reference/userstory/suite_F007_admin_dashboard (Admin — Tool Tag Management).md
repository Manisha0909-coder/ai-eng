## US: 001

As a Super Admin, I want to search for a tag by name, so that I can quickly find the tag I need.

**Acceptance Criteria:**
    - A "Search tags..." input is available on the Tool Tag Management page.
    - The tags list filters in real time as the admin types.
    - If no tags match, an appropriate empty state message is displayed.


## US: 002

As a Super Admin, I want to filter tags by Tool Name, so that I can view only the tags associated with a specific tool.

**Acceptance Criteria:**
    - A "Filters" button is available on the Tool Tag Management page.
    - Clicking it opens a filter panel with a "Tool Names" section.
    - Admin can search and select tool names from the "Search and select tool names to add..." dropdown.
    - The tags list updates to show only tags associated with the selected tool.
    - Admin can click "Clear" to reset the filter and restore the full list.


## US: 003

As a Super Admin, I want to create a new tool tag, so that I can organize and group tools under a common category.

**Acceptance Criteria:**
    - A "Create New Tag" modal is accessible from the Tool Tag Management page.
    - The modal is titled "Create New Tag" with the subtitle "Fill in the details to create a new tag."
    - Tag Name is a required field with a placeholder (e.g. EmailManagement).
    - Description is an optional textarea field.
    - Associated Tools is a required field; admin can search and select multiple tools from the "Search and select tools to add..." dropdown.
    - Admin clicks "Create Tag" to save; the new tag appears in the list immediately.
    - Admin can click "Cancel" to close the modal without saving.


## US: 004

As a Super Admin, I want to edit an existing tool tag, so that I can update its name, description, or associated tools.

**Acceptance Criteria:**
    - Each tag has an Edit icon; clicking it opens the "Edit Tag" modal with subtitle "Update the tag information below."
    - Tag Name is a required editable field.
    - Description is an optional editable textarea.
    - Associated Tools shows already linked tools as removable chips (e.g. get_doc_content ×, list_documents ×).
    - Admin can add more tools using the "Search and select tools to add..." dropdown.
    - Admin clicks "Update Tag" to save changes; changes reflect immediately in the tag list.
    - Admin can click "Cancel" to discard changes.


## US: 005

As a Super Admin, I want to delete a tool tag, so that I can remove tags that are no longer relevant.

**Acceptance Criteria:**
    - Each tag has a Delete icon.
    - Clicking it opens a "Delete Tag" confirmation modal with the message "Are you sure you want to delete this tag?" and the tag name displayed.
    - Admin clicks "Delete" to permanently remove the tag; clicks "Cancel" to dismiss.
    - Upon deletion, the tag is removed from all associated tools and no longer appears in the list.
