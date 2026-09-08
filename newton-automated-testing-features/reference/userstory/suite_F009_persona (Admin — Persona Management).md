## US: 001

As a User / Super Admin, I want to view all personas, so that I can get a complete overview of all personas configured in the system.

**Acceptance Criteria:**
    - The page is titled "Persona Management" with the subtitle "Manage AI personas for different use cases."
    - All personas are listed with relevant details (e.g. name, type, version, model, tool tags, created/updated timestamps).
    - Admin can search personas using the "Search personas..." input.
    - Admin can filter personas by Type: All types, chat, api, or dashboard.
    - The list updates dynamically when search or filter is applied.


## US: 002

As a User / Super Admin, I want to create a new persona, so that I can configure a tailored assistant experience for specific use cases.

**Acceptance Criteria:**
    - A "Create New Persona" modal is accessible from the Personas page with the subtitle "Fill in the details to create a new persona, or select an existing one to create a new version."
    - Persona Name is a required field.
    - Greeting Message is an optional field.
    - Persona Type can be selected as "Chat" or "Dashboard"; choosing Dashboard shows the hint "Choose dashboard for personas that primarily build and update dashboards."
    - Persona Text is a required field with a 10,000 character limit.
    - Model is a required field; admin selects from available client models.
    - Supports Documents is an optional checkbox to auto-attach document tools (list, search, analyse) for the persona.
    - Admin can search and select Tool Tags and Document Tags.
    - Admin clicks "Create Persona" to save; clicks "Cancel" to discard.


## US: 003

As a User / Super Admin, I want to edit a persona's name, model, system prompt, and greeting, so that I can keep persona details accurate and up to date.

**Acceptance Criteria:**
    - Each persona has an Edit option.
    - Admin can update the name, model, system prompt, and greeting message.
    - Changes are saved only upon explicit confirmation.
    - Updated details are reflected immediately in the personas list.
    - Admin can cancel to discard changes.


## US: 004

As a User / Super Admin, I want to delete a persona, so that I can remove personas that are no longer needed.

**Acceptance Criteria:**
    - Each persona has a Delete option.
    - A "Delete Persona" confirmation modal is displayed with the message: "This will permanently delete '<Persona Name>' persona and all of its versions. This cannot be undone."
    - Admin clicks "Delete" to confirm; clicks "Cancel" to dismiss.
    - Upon deletion, the persona and all its versions are permanently removed from the list.


## US: 005

As a User / Super Admin, I want to bulk delete personas, so that I can efficiently remove multiple personas at once.

**Acceptance Criteria:**
    - Admin can select multiple personas using checkboxes.
    - A "Bulk Delete" action is available when one or more personas are selected.
    - A confirmation prompt is shown listing the number of personas to be deleted.
    - Upon confirmation, all selected personas are permanently removed.


## US: 006

As a User / Super Admin, I want to create a new version of a persona, so that I can iterate on its configuration while preserving the previous version.

**Acceptance Criteria:**
    - A "Create new version" modal is accessible from the Personas page with the subtitle "Create a new version of an existing persona. Select the base persona below and edit the fields."
    - Admin selects a Base Persona (required); Persona Name auto-fills with a version label (e.g. v2).
    - Admin can update: Greeting Message, Persona Text (required), Model (required), Supports Documents, Tool Tags, and Document Tags.
    - Selected Tool Tags are shown as removable chips.
    - Auto-attached Capabilities are displayed based on selected options (e.g. Document Tools (auto)).
    - Admin can check "Set as current version" to immediately promote the new version.
    - Admin clicks "Create version" to save; clicks "Cancel" to discard.


## US: 007

As a User / Super Admin, I want to set a specific version as the current version, so that I can promote or roll back a persona to any saved version.

**Acceptance Criteria:**
    - Each version in the version history has a "Set as Current" option.
    - Upon confirmation, the selected version becomes the active version of the persona.
    - The previously active version is retained in history.
    - The change is reflected immediately for all users of that persona.


## US: 008

As a User / Super Admin, I want to view the version history of a persona, so that I can track changes made over time.

**Acceptance Criteria:**
    - Each persona has a "Version History" option that opens a modal.
    - The modal displays the persona name, total version count, and the current active version tag.
    - Each version shows: version label, "Current" badge (if active), edit and delete icons, tool tags, model, and created/updated timestamps.
    - Admin can expand "View prompt" to see the persona text for any version.


## US: 009

As a User / Super Admin, I want to delete a specific version of a persona, so that I can remove outdated or incorrect versions.

**Acceptance Criteria:**
    - Each version in the version history has a Delete option.
    - The current active version cannot be deleted.
    - A confirmation prompt is displayed before deletion.
    - Upon confirmation, the version is permanently removed from the history.


## US: 010

As a User / Super Admin, I want to manage tool execution rules for a persona, so that I can control how tools are used by that persona.

**Acceptance Criteria:**
    - Each persona has a "Tool Rules" option that opens a panel titled "Manage tool execution rules for <Persona Name>."
    - The panel displays the total number of attached tools and configured rules.
    - Admin can add a new rule using the "Add Rule" or "Add First Rule" button.
    - A refresh button is available to reload the rules list.
    - If no rules are configured, an empty state "No tool rules configured" is displayed.


## US: 011

As a User / Super Admin, I want to view and edit data sources attached to a persona, so that I can manage what information the persona has access to.

**Acceptance Criteria:**
    - Each persona has a "Data Sources" section listing all attached data sources.
    - Admin can view details of each attached data source.
    - Admin can edit or remove an attached data source.
    - Changes are saved upon explicit confirmation and reflected immediately.


## US: 012

As a User / Super Admin, I want to view available LLM models for a persona, so that I can choose the most suitable model for the persona's purpose.

**Acceptance Criteria:**
    - A list of available LLM models is accessible when creating or editing a persona.
    - Each model is displayed with relevant details (e.g. model name, provider).
    - Admin can select any available model for the persona.


## US: 013

As a User / Super Admin, I want to attach a data source to a persona, so that the persona can retrieve and use relevant information when responding to users.

**Acceptance Criteria:**
    - Admin can attach one or more data sources to a persona.
    - A searchable list of available data sources is provided for selection.
    - Attached data sources appear in the persona's Data Sources section.
    - The persona uses the attached data sources immediately after saving.
