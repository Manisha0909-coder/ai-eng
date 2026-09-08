## US001

As a Super Admin or System Admin, I want to view all feedback submitted by users, so that I can monitor how users are responding to the system and identify areas that need attention.

**Acceptance Criteria:**
    - Super Admin can see a list of all feedback submitted across all personas.
    - Each feedback item shows the user's response (thumbs up or thumbs down), the related persona, and the date it was submitted.
    - Super Admin can filter feedback by type (thumbs up or thumbs down), persona, or status.
    - Super Admin can search feedback by keyword.
    - The list shows the most recent feedback first by default.


## US002

As a Super Admin or System Admin, I want to view the full conversation context of a feedback item, so that I can understand what led the user to give that feedback.

**Acceptance Criteria:**
    - Super Admin can open a feedback item to view its full conversation snapshot.
    - The snapshot shows the complete conversation between the user and the persona at the time of feedback.
    - The feedback response (thumbs up or thumbs down) is clearly visible alongside the conversation.
    - The snapshot is read-only and cannot be modified.


## US003

As a Super Admin or System Admin, I want to mark a feedback item as resolved, so that I can track which feedback has been reviewed and acted upon.

**Acceptance Criteria:**
    - Super Admin can mark any pending feedback item as resolved.
    - Once marked as resolved, the feedback status updates immediately in the list.
    - Resolved feedback items are visually distinct from pending ones.
    - Super Admin can filter the list to view only resolved or only pending feedback.


## US004

As a Super Admin or System Admin, I want to resolve multiple feedback items at once, so that I can efficiently manage large volumes of feedback without reviewing each one individually.

**Acceptance Criteria:**
    - Super Admin can select multiple feedback items from the list.
    - A "Bulk Resolve" option is available once one or more items are selected.
    - All selected feedback items are marked as resolved upon confirmation.
    - The list updates immediately to reflect the resolved status of all selected items.


## US005

As a Super Admin or System Admin, I want to delete multiple feedback items at once, so that I can clean up irrelevant or outdated feedback from the system.

**Acceptance Criteria:**
    - Super Admin can select multiple feedback items from the list.
    - A "Bulk Delete" option is available once one or more items are selected.
    - A confirmation message is shown before deletion: the action cannot be undone.
    - All selected feedback items are permanently removed from the list upon confirmation.


## US006

As a Super Admin or System Admin, I want to view a summary of feedback metrics, so that I can get a quick overview of user satisfaction and the current state of feedback across the system.

**Acceptance Criteria:**
    - Super Admin can see a feedback metrics summary section on the Feedback page.
    - The summary displays the total count of thumbs up and thumbs down feedback.
    - The summary displays the number of resolved and pending feedback items.
    - The resolution rate is shown as a percentage (resolved out of total).
    - Super Admin can filter the metrics by time period (e.g. Last 7 days, Last 30 days, Last 90 days).
    - All metrics update automatically when the time period filter is changed.
