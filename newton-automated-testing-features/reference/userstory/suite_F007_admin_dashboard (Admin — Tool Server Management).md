## US: 001

As a User / Super Admin, I want to view the list of tool servers, so that I can see all servers connected to the system.

**Acceptance Criteria:**
    - All tool servers are listed with relevant details (e.g. name, status, URL).
    - Admin can search or filter servers by name.
    - The list updates to reflect any newly added or removed servers.


## US: 002

As a User / Super Admin, I want to attach a tool server, so that I can connect a new server and make its tools available.

**Acceptance Criteria:**
    - Admin can attach a tool server by providing the required details.
    - The attached server appears in the tool servers list immediately.
    - Admin can cancel to discard without saving.


## US: 003

As a User / Super Admin, I want to detach a tool server, so that I can remove a server that is no longer needed.

**Acceptance Criteria:**
    - Each tool server has a Detach option.
    - A confirmation prompt is displayed before detaching.
    - Upon confirmation, the server is removed and its tools are no longer available.


## US: 004

As a User / Super Admin, I want to sync tool servers, so that I can ensure the latest tools from all servers are up to date.

**Acceptance Criteria:**
    - A "Sync" option is available on the tool servers page.
    - Syncing fetches the latest tools from all connected servers.
    - Admin is notified when the sync is complete.


## US: 005

As a User / Super Admin, I want to perform a health check on a tool server, so that I can verify if the server is reachable and functioning correctly.

**Acceptance Criteria:**
    - Each tool server has a "Health Check" option.
    - The health check indicates whether the server is healthy or unreachable.
    - The result is displayed immediately after the check is performed.
