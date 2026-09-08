## US001

As a Super Admin and System Admin, I want to view all shared memory blocks and filter them by persona, so that I can oversee what contextual information is available across all personas in the system.

**Acceptance Criteria:**
    - The Shared Memory page shows a list of all memory blocks with the subtitle "Manage memory blocks shared across personas".
    - Each memory block card shows its name, the persona it belongs to as a tag, a description, its current value content, and the dates it was created and last updated.
    - If the current value content is too long, only a portion is shown with a "Show more" option to view the full content.
    - Super Admin and System Admin can search for a memory block by its name or description using the search bar "Search by label or description".
    - Super Admin and System Admin can narrow down the list by selecting a specific persona from the Filters dropdown or choosing "All Personas" to view all.
    - Super Admin and System Admin can refresh the list to see the most up-to-date information.


## US002

As a Super Admin and System Admin, I want to add a new shared memory block, so that I can equip any persona with specific contextual knowledge or data hints.

**Acceptance Criteria:**
    - The "+ Add Shared Memory Block" button opens a form to create a new memory block.
    - The form requires a Persona and a Label to be filled in before saving.
    - Super Admin and System Admin can optionally add a Description and the memory content.
    - The memory content cannot exceed 10,000 characters.
    - Once saved, the new memory block is visible in the list right away.


## US003

As a Super Admin and System Admin, I want to edit an existing memory block's details and content, so that I can keep any persona's shared knowledge accurate and up to date.

**Acceptance Criteria:**
    - Super Admin and System Admin can open an edit form for any existing memory block using the edit icon on the card.
    - The edit form shows the existing Persona, Label, Description, and Current Value already filled in, ready to be updated.
    - Persona and Label are required and cannot be left empty.
    - The memory content cannot exceed 10,000 characters.
    - The Block ID is visible on the form but cannot be changed.
    - Super Admin and System Admin can save the updates or go back without making any changes.
    - The memory block card reflects the updated information immediately after saving.


## US004

As a Super Admin and System Admin, I want to delete a shared memory block that is no longer needed, so that I can keep personas' memory clean and relevant across the system.

**Acceptance Criteria:**
    - Super Admin and System Admin can delete any memory block using the delete icon on the card.
    - Before deletion, a confirmation message is shown: "Are you sure you want to delete this persona memory block? This action cannot be undone." along with the name of the memory block.
    - Once confirmed, the memory block is permanently removed and no longer appears in the list.
    - If Super Admin and System Admin changes their mind, they can cancel and the memory block remains as it is.


## US005

As a Super Admin and System Admin, I want a shared memory block added for a persona to be automatically available to all other roles that are assigned the same persona, so that contextual knowledge is consistently shared across roles without duplication.

**Acceptance Criteria:**
    - When a shared memory block is created for a persona, it is automatically accessible to every role that has that persona assigned.
    - If the same persona is later assigned to a new role, that role immediately has access to all existing shared memory blocks of that persona.
    - No additional configuration is required by the Super Admin or System Admin to extend the memory to the new role.
    - The memory block is displayed consistently for all roles sharing the same persona, showing the same name, description, and content.
    - If the memory block is updated, the updated content is reflected for all roles sharing that persona.
    - If the memory block is deleted, it is removed for all roles that were using it through the shared persona.
