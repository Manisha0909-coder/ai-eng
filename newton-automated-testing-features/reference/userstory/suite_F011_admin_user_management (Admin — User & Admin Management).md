## US001

As a Super Admin, I want to view all users in the system, so that I can manage and monitor who has access to the application.

**Acceptance Criteria:**
    - Super Admin can see a list of all users with their name, email, role, and status.
    - Super Admin can search for a user by name or email.
    - Super Admin can filter users by role or status.
    - The list shows the most recently added users first by default.


## US002

As a Super Admin, I want to create a user manually, so that I can add new members to the system without requiring them to self-register.

**Acceptance Criteria:**
    - Super Admin can open a form to create a new user.
    - The form requires a name, email, and role to be filled in before saving.
    - The system does not allow creation if the email already exists.
    - Once saved, the new user appears in the users list immediately.


## US003

As a Super Admin, I want to edit a user's details, so that I can keep user information accurate and up to date.

**Acceptance Criteria:**
    - Super Admin can open an edit form for any existing user.
    - The edit form shows the existing details already filled in, ready to be updated.
    - Super Admin can update the user's name, email, and role.
    - Changes are reflected immediately in the users list after saving.
    - Super Admin can cancel and go back without making any changes.


## US004

As a Super Admin, I want to delete a user, so that I can remove access for users who are no longer part of the system.

**Acceptance Criteria:**
    - Super Admin can delete any user from the list.
    - Before deletion, a confirmation message is shown informing that the action cannot be undone.
    - Once confirmed, the user is permanently removed and no longer appears in the list.
    - If Super Admin changes their mind, they can cancel and the user remains as is.


## US005

As a Super Admin, I want to delete multiple users at once, so that I can efficiently remove a large number of users without deleting them one by one.

**Acceptance Criteria:**
    - Super Admin can select multiple users from the list.
    - A bulk delete option is available once one or more users are selected.
    - Before deletion, a confirmation message is shown informing that the action cannot be undone.
    - All selected users are permanently removed from the list upon confirmation.


## US006

As a Super Admin, I want to view all admin users, so that I can monitor who has administrative access to the system.

**Acceptance Criteria:**
    - Super Admin can see the Admin Users Management page with the subtitle "Manage admin users and their permissions".
    - Each admin user card displays the email, admin role tag, username, and the dates they were added and last updated.
    - Super Admin can search for an admin user by name using the search bar.
    - Super Admin can filter admin users by role using the Filters dropdown (All roles, super_admin, user_admin, system_admin).
    - A refresh button is available to reload the list.


## US007

As a Super Admin, I want to assign an admin role to a user, so that I can grant administrative access to trusted members.

**Acceptance Criteria:**
    - The "+ Add Admin" button opens the "Assign Admin Role" form.
    - Super Admin must search and select a user from the Users field (required).
    - Super Admin must select one of the following admin roles before saving:
        - Super Admin — Full access to all features.
        - User Admin — Access to users, roles, persona, and shared memory.
        - System Admin — Access to tools, tool tags, tool servers, doc tags, logs, feedback, overview, and data sources.
    - Once saved, the newly assigned admin user appears in the admin users list immediately.
    - Super Admin can cancel and go back without making any changes.


## US008

As a Super Admin, I want to update an admin user's role, so that I can adjust their level of access when their responsibilities change.

**Acceptance Criteria:**
    - Super Admin can open the "Update Admin Role" form using the edit icon on the admin user card.
    - The form shows the user's username, email, and current role already filled in.
    - Super Admin must select a new admin role from the available options:
        - Super Admin — Full access to all features.
        - User Admin — Access to users, roles, persona, and shared memory.
        - System Admin — Access to tools, tool tags, tool servers, doc tags, logs, feedback, overview, and data sources.
    - The updated role is reflected immediately on the admin user card after saving.
    - Super Admin can cancel and go back without making any changes.


## US009

As a Super Admin, I want to remove admin privileges from a user, so that I can revoke administrative access when it is no longer required.

**Acceptance Criteria:**
    - Super Admin can remove admin privileges using the delete icon on the admin user card.
    - A confirmation message is shown: "Are you sure you want to remove all admin roles from this user? This action cannot be undone." with the user's email displayed in bold.
    - Once confirmed, all admin roles are removed and the user no longer appears in the admin users list.
    - If Super Admin changes their mind, they can cancel and the admin user remains as is.
