## US: 001 

As a System Administrator, I want to configure and test connection to a PostgreSQL database, so that it can be used as a valid data provider.

**Acceptance Criteria:**
    - Admin Console provides fields for: Host, Port, Database Name, Username, and Password.
    - System must include a "Test Connection" button to validate credentials before saving.
    - On success, the data source is saved with a unique identifier.
    - The source can be successfully linked to a specific Persona.


## US: 002 

As a System Administrator, I want to upload and configure a CSV file as a data source, so that I can provide static datasets to Personas.

**Acceptance Criteria:**    
    - Admin Console allows for local file selection or drag-and-drop.
    - Validation: System must reject files exceeding 50MB.
    - System must parse headers to ensure the file is a valid CSV format.
    - The file is stored securely and associated with the Admin's workspace.


## US: 003 
As a System Administrator, I want to edit an existing PostgreSQL data source configuration, so that I can update connection details or credentials without recreating the data source.

**Acceptance Criteria:**   
    - Admin Console allows to edit an existing PostgreSQL data source configuration, .
    - Each row with Kind = "postgresql" has an inline Edit action (e.g., row action menu or edit icon).
    - Clicking Edit opens a pre-populated form with fields: Host, Port, Database Name, Username, and Password.
    - A "Test Connection" button is available in the edit form to validate credentials before saving.
    - On successful save:
        - The updated configuration is persisted.
        - The data source's unique identifier remains unchanged.
        - The row in the table reflects any updated Name or Description immediately.
    - Existing linkages to Personas remain intact unless the updated source becomes unreachable.
    - Appropriate error messages are shown if:
        - Required fields are missing.
        - The connection test fails.
        - Save fails due to a server error.


## US: 004 

As a System Administrator, I want to delete an existing PostgreSQL data source, so that I can remove obsolete or incorrect configurations from the system.

**Acceptance Criteria:**    
    - Admin Console lists saved data sources with a Delete option for each PostgreSQL source.
    - Before deletion, system prompts for confirmation (e.g., "Are you sure? This action cannot be undone.").
    - If the data source is currently linked to one or more Personas, system displays a warning listing affected Personas and requires explicit confirmation before deletion.
    - After deletion:
        - The data source is removed from the list of available sources.
        - Any Persona previously linked to this source no longer has it as an active data provider (or shows a "missing source" indicator).
        - Deletion is logged in admin audit logs.


## US: 005 

As a System Administrator, I want to replace the CSV file for an existing CSV data source, so that I can refresh static datasets while keeping the same unique identifier and Persona linkages.

**Acceptance Criteria:**   
    - Admin Console provides an Edit option for existing CSV sources.
    - Edit screen shows current file name and metadata (size, upload date).
    - User can upload a new CSV file via file selection or drag-and-drop.
    - Validation:
        - Reject new file if it exceeds 50MB.
        - Validate headers match the original CSV's header structure (or allow override with warning).
    - On success, the new file replaces the old file securely in the Admin's workspace.
    - The unique identifier of the data source remains unchanged.
    - Personas linked to this source automatically use the updated data.
    - Old file is permanently deleted from storage.


## US: 006 

As a System Administrator,I want to delete an uploaded CSV data source,so that I can remove unused or outdated static datasets.

**Acceptance Criteria:**    
    - Admin Console includes a Delete option for each CSV source.
    - Confirmation prompt appears before deletion ("Delete this CSV data source? This will remove the file and break any Persona links.").
    - If linked to one or more Personas, system shows a warning with the list of affected Personas and requires acknowledgment.
    - Upon confirmation:
        - The CSV file is permanently deleted from secure storage.
        - The data source record is removed from the database.
        - Any linked Personas lose access to this data source (UI indicates missing source).
        - Deletion is recorded in admin audit logs.


## US: 007 

As a System Administrator, I want to view all my configured data sources (PostgreSQL and CSV) in a single list, so that I can understand what data providers exist and which Personas they are linked to.

**Acceptance Criteria:**    
    - Admin Console has a "Data Sources" page listing all saved sources with: Name/Identifier,Type (PostgreSQL or CSV),Date created,Number of linked Personas
    - Clicking on a data source shows detailed view:
        - For PostgreSQL: host, port, database name (password masked)
        - For CSV: file name, file size, upload date
    - From the detail view, user can navigate to Edit, Delete, or Test Connection (PostgreSQL).
    - Search/filter by source type and Persona linkage.
