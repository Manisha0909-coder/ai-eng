## US: 001

As a Super Admin, I want to search for a tool by name, so that I can quickly find the tool I need without scrolling through the entire list.

**Acceptance Criteria:** - A "Search tools..." input is available on the Available Tools page. - The tools list filters in real time as the admin types. - If no tools match, an appropriate empty state message is displayed.

## US: 002

As a Super Admin, I want to filter tools by Tool Server, so that I can view only the tools belonging to a specific server.

**Acceptance Criteria:** - A "Filters" button is available on the Available Tools page. - Admin can search and select a tool server from the dropdown. - The tools list updates to show only tools from the selected server. - Admin can clear the filter to restore the full list.

## US: 003

As a Super Admin, I want to edit a tool's configuration, so that I can keep its details accurate and up to date.

**Acceptance Criteria:** - Each tool card has an Edit icon. - Clicking it opens an Edit Tool modal with editable fields: Display Name, Tool Icon, Tool Call Message, and Description. - Tool ID and Tool Type are read-only. - Admin clicks "Update Tool" to save; clicks "Cancel" to discard changes.

## US: 004

As a Super Admin, I want to delete a tool, so that I can remove tools that are no longer needed.

**Acceptance Criteria:** - Each tool card has a Delete icon. - Clicking it shows a confirmation prompt before deletion. - Upon confirmation, the tool is permanently removed from the list. - Deleted tools no longer appear in search or filter results.

## US: 005

As a Super Admin, I want to refresh the tools list, so that I can see the most up-to-date information from the server.

**Acceptance Criteria:** - A "Refresh" button is available on the Available Tools page. - Clicking the Refresh button updates the tools list with the latest data from the server. - The list refreshes without losing current search or filter settings. - A loading indicator appears during the refresh process.
