# Mockup / UI TODO

## Admin Console Tables

### Custom selection columns — DONE
Migrated `DocumentsSection.tsx` and `FeedbackSection.tsx` to use DataTable's built-in
`enableRowSelection` + `renderBulkActions` props. Custom `isSelectionMode` state,
`selectedDocuments`/`selectedFeedbacks` arrays, manual checkbox columns, and standalone
bulk-action bars have all been removed. Selection state is now managed internally by
DataTable; bulk action buttons are rendered via `renderBulkActions` using a
`clearSelectionRef` pattern to clear the table after a confirmed action.
