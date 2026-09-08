# F008 — Admin Role Access Control

## US: 001

As a Super Admin, I want full access to all sections of the Admin Console, so that I can manage every aspect of the system.

**Acceptance Criteria:**
- Admin Console displays all sections: Overview, Tools and Servers (Tools, Tool Tags, Data Sources, Servers), Documents (Docs, Doc Tags), Access (Roles, Personas, Shared Memory, Users), Feedback, and Admin.
- All sections and their sub-items are visible and navigable.
- No sections are hidden or restricted.


## US: 002

As a User Admin, I want access to only the Access section of the Admin Console, so that I can manage users, roles, personas, and shared memory without accessing other system configurations.

**Acceptance Criteria:**
- Admin Console displays only the Access section with sub-items: Roles, Personas, Shared Memory, and Users.
- Sections outside Access — Tools and Servers, Documents, Feedback, and Admin tab — are not visible.
- User Admin cannot navigate to any restricted section.


## US: 003

As a System Admin, I want access to Overview, Tools and Servers, Documents, and Feedback sections of the Admin Console, so that I can manage tools, data sources, documents, and feedback without accessing user and role configurations.

**Acceptance Criteria:**
- Admin Console displays: Overview, Tools and Servers (Tools, Tool Tags, Data Sources, Servers), Documents (Docs, Doc Tags), and Feedback.
- Access section (Roles, Personas, Shared Memory, Users) and Admin tab are not visible.
- System Admin cannot navigate to any restricted section.


## US: 004

As a Super Admin, I want the Assign Admin Role dialog to show only users who do not already have an admin role, so that I cannot accidentally assign duplicate roles to existing admins.

**Acceptance Criteria:**
- Opening the Assign Admin Role dialog shows a user dropdown.
- Users already assigned any admin role (Super Admin, User Admin, System Admin) do not appear in the dropdown.
- Only eligible non-admin users are selectable for role assignment.


## US: 005

As a regular user with no admin role assigned, I should not be able to access the Admin Console, so that system administration features remain restricted to authorized admins only.

**Acceptance Criteria:**
- After login, a user with no admin role assigned does not see the Admin Console button.
- There is no way to navigate to the Admin Console directly.
- Access is silently restricted — no error is shown, the button is simply not present.



