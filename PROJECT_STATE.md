# Project State

This file is the source of truth for the current product state and agreed future work.

Rule of thumb:
- Before any implementation, review this file first.
- If the product direction changes, update this file before or alongside code changes.
- If implementation differs from this file, either the code is wrong, the file is stale, or the decision was never recorded.

## Current App State

### Stack
- Next.js 16
- React 19
- TypeScript
- Firebase Auth
- Firestore
- ImgBB for image uploads through `/api/upload-image`

### Current Top-Level Product Areas
- Dashboard
  - Daily learning log only
- Projects
  - Project list
  - Project workspace
  - Project-scoped features, tickets, artefacts, and design votes
- Features
  - Cross-project feature list
  - Filter by project and status
- Tickets
  - Cross-project ticket list
  - Filter by project and status
- Knowledge Vault
- Ideas

### Current Main Routes
- `/`
- `/projects`
- `/features`
- `/tickets`
- `/vault`
- `/ideas`
- `/login`
- `/share/[token]`
- `/vote/[token]`
- `/vote/[token]/results`
- `/review/[token]`
- `/review/[token]/results`
- `/projects/[projectId]/features/[featureId]`
- `/projects/[projectId]/tickets/[ticketId]`
- `/projects/[projectId]/artefacts/[artefactId]`

### Current Firestore Shape
- `users/{uid}/dailyLogs`
- `users/{uid}/vaultEntries`
- `users/{uid}/ideas`
- `users/{uid}/projects`
- `users/{uid}/projects/{projectId}/features`
- `users/{uid}/projects/{projectId}/features/{featureId}/attachments`
- `users/{uid}/projects/{projectId}/features/{featureId}/screens`
- `users/{uid}/projects/{projectId}/features/{featureId}/screens/{screenId}/versions`
- `users/{uid}/projects/{projectId}/tickets`
- `users/{uid}/projects/{projectId}/artefacts`
- `users/{uid}/projects/{projectId}/artefacts/{artefactId}/versions`
- `featureReviews/{reviewId}`
- `featureReviewSubmissions/{reviewId}/submissions/{submissionId}`
- `designVotes/{voteId}`
- `designVoteResponses/{voteId}/responses/{responseId}`
- `shareLinks/{token}`

### Current Feature Foundation State
- The primary app navigation now uses a left sidebar instead of top tabs.
- The left nav currently exposes:
  - `Dashboard`
  - `Projects`
  - `Features`
  - `Tickets`
  - `Knowledge Vault`
  - `Ideas`
- `Projects` is now a lighter project directory and workspace entry point.
- The `Projects` page now prioritizes:
  - project selection
  - project creation
  - project-level summary cards
  - quick-create for features and tickets
  - recent project items instead of full cross-project browsing
- `Features` is now a cross-project view.
- `Tickets` is now a cross-project view.
- Project summary shortcuts now deep-link into filtered `/features` and `/tickets` views for the selected project.
- Cross-project `Features` and `Tickets` pages now group results by project and expose more project context at a glance.
- The left-nav shell and cross-project overview pages now use shared workspace surface styles for more consistent visual hierarchy.
- Projects now expose a `Features` section.
- Projects now expose a `Tickets` section.
- Users can create a feature with:
  - title
  - summary
  - status
- Users can open a feature detail page and edit:
  - title
  - summary
  - description
  - status
  - a simplified top-of-page workflow focused on:
    - prepare
    - send
    - review results
- Users can add feature attachments:
  - inline markdown content
  - uploaded markdown files stored as inline content
  - links
  - images
  - PDFs and other files uploaded to Firebase Storage
- Users can add screens under a feature with:
  - title
  - description
  - a single image by default
  - optional 1 to 3 versions only when comparison is needed
  - version label
  - version notes
  - version image upload
  - edit, delete, and reorder controls for existing screens
- Users can generate a public feature review link from the current feature snapshot.
- Feature workspaces now keep a review history with links back to the public review and owner results pages.
- Users can create tickets under a project with:
  - title
  - description
  - optional feature linkage
  - status
  - severity
  - assignee name
  - source
  - optional screenshot evidence
- Tickets can be opened on a dedicated detail page and updated through:
  - `open`
  - `in_progress`
  - `done`
  - `verified`
- Ticket detail pages can store a dev update note and verification timestamp.
- The project ticket list now supports quick status actions:
  - `open` -> `in_progress`
  - `in_progress` -> `done`
  - `done` -> `verified`
- `done` and `verified` are visually distinct in the list so it is easier to see what still needs confirmation.
- Public review pages can currently show:
  - feature summary
  - attachments
  - screens and versions
- Public reviewers can now:
  - enter name and optional email
  - move through the review one screen at a time
  - view a single UI image at a time in a large guided layout
  - follow explicit step-by-step review instructions on the page
  - choose a favorite version per multi-version screen
  - explain why
  - add general comments per screen
  - add visual annotations on each UI version using pins, boxes, arrows, and text
  - submit a review
  - keep draft state in the browser until submission
- Annotation data is stored inside each screen review with normalized coordinates and version targeting.
- Owners can now:
  - open `/review/[token]/results`
  - see all submissions for a review
  - see favorite counts per screen version
  - replay annotations on the reviewed UI versions
  - close or reopen a review
  - generate a teammate-ready invite message or email draft from the feature workspace
  - use a simpler send-review dialog and a hidden-by-default review history
  - add a single review image first, with alternative versions hidden unless explicitly enabled

### Important Current Gaps
- Missing Firebase public env vars no longer need to crash build time, but runtime Firebase features still require valid config.
- Rich text rendering is unsafe and should be treated as a security risk until sanitized.
- Vote links allow public submissions but do not enforce strong duplicate-vote protection.
- Share links do not match the older dashboard model still referenced in some components.
- Some older modules still exist in the repo but are not part of the live main flow:
  - Strategic Focus
  - Progress Tracking
  - Sprint Tracker

## Agreed Direction: Feature Review System

The next major product area is a new `Features` workflow inside `Projects`.

This is not the same as the current `Design Vote` flow.

Design vote is for:
- comparing variations
- selecting a favorite
- rating and commenting

Feature review is for:
- describing a feature
- attaching supporting docs such as PRD or markdown
- uploading multiple UI screens
- optionally uploading 1 to 3 versions of the same screen
- sending a public review link to external team members without sign-in
- collecting per-screen comments
- collecting per-screen favorite version selection and rationale
- collecting per-screen visual annotations on the UI itself

## Target Product Model

Hierarchy:
- Project
- Feature
- Feature Attachment
- Feature Screen
- Screen Version
- Feature Review Request
- Feature Review Submission

## Proposed Data Model

### User-Owned Project Data
- `users/{uid}/projects/{projectId}/features/{featureId}`
- `users/{uid}/projects/{projectId}/features/{featureId}/attachments/{attachmentId}`
- `users/{uid}/projects/{projectId}/features/{featureId}/screens/{screenId}`
- `users/{uid}/projects/{projectId}/features/{featureId}/screens/{screenId}/versions/{versionId}`

### Public Review Data
- `featureReviews/{reviewId}`
- `featureReviewSubmissions/{reviewId}/submissions/{submissionId}`

### Feature
- `title`
- `summary`
- `description`
- `status`
- `createdAt`
- `updatedAt`

### Attachment
- `title`
- `type`
  - `markdown`
  - `pdf`
  - `link`
  - `image`
  - `other`
- `fileUrl`
- `content`
- `mimeType`
- `sourceName`
- `uploadedAt`

### Screen
- `title`
- `description`
- `order`

### Version
- `label`
  - expected values for MVP: `A`, `B`, `C`
- `imageUrl`
- `notes`
- `order`

### Feature Review Request
- `userId`
- `projectId`
- `featureId`
- `title`
- `status`
- `deadline`
- `includeAttachments`
- `createdAt`
- `updatedAt`

### Feature Review Submission
- `reviewerName`
- `reviewerEmail`
- `submittedAt`
- `screenReviews`

### Per-Screen Review
- `screenId`
- `selectedVersionId`
- `selectionReason`
- `generalComment`
- `annotations`

### Annotation
- `type`
  - `point`
  - `box`
  - `arrow`
  - `text`
  - `freehand` later, not MVP
- `x`
- `y`
- `width`
- `height`
- `text`
- `color`
- `strokePoints`

## MVP Scope

The first release should include:
- Feature CRUD
- Feature detail page
- Feature description
- Feature attachments
  - markdown
  - image
  - PDF
  - links
- Feature screens
- 1 to 3 versions per screen
- Public review link with no sign-in required
- Reviewer name capture
- Per-screen version choice when multiple versions exist
- Per-screen “why” feedback
- Per-screen general comment
- Per-screen visual annotation on UI images
- Final submission flow
- Internal owner results view

The first release should not include:
- full paint-style freehand editing as the main annotation mode
- PDF annotation
- live multi-user collaboration
- threaded discussion
- cross-device anonymous draft resume

## Annotation MVP Recommendation

For the first version, annotations should be structured objects instead of a full paint tool.

Supported annotation tools:
- point pin
- rectangle highlight
- arrow
- text label

Freehand drawing can be added later if needed.

Why:
- simpler storage model
- easier replay in results
- lower implementation risk
- more reliable on mobile and different screen sizes

## Storage Strategy

### Current Reality
- The repo currently uses ImgBB for image upload.
- This is fine for UI screenshots.
- It is not a good fit for PRDs, PDFs, or general document attachments.

### Recommended Direction
- Keep ImgBB temporarily for image versions if needed.
- Use Firebase Storage for feature attachments such as:
  - PDF
  - markdown files
  - other documents

Longer term, moving all feature assets to Firebase Storage would simplify the system.

## Navigation Structure

Primary left-nav routes:
- `/`
- `/projects`
- `/features`
- `/tickets`
- `/vault`
- `/ideas`

Detail routes remain nested where the work belongs:
- `/projects/[projectId]/features/[featureId]`
- `/projects/[projectId]/tickets/[ticketId]`
- `/projects/[projectId]/artefacts/[artefactId]`
- `/review/[token]`
- `/review/[token]/results`

## UX Requirements

### Feature Owner
- Create a feature
- Add summary and description
- Upload PRD and supporting docs
- Add screens
- Add up to 3 versions per screen
- Generate public review link
- View all submissions and per-screen results

### External Reviewer
- Open review link without sign-in
- Read feature summary
- Open supporting docs
- Review each screen
- Choose favorite version if applicable
- Explain why
- Add comments directly on the UI through annotations
- Save work per screen in the browser session
- Submit one complete review at the end

## Implementation Plan

### Chunk 1: Feature Foundation
- Add feature collection under projects
- Feature list UI inside Projects
- Create feature form
- Feature detail page

Acceptance criteria:
- A user can create, open, and edit a feature under a project.

### Chunk 2: Attachments
- Add attachment model and UI
- Support markdown input and markdown file upload
- Support PDF upload
- Render markdown in-app
- Download or open PDFs

Acceptance criteria:
- A feature can store and display supporting PRD material.

### Chunk 3: Screens and Versions
- Add screens under a feature
- Add 1 to 3 versions per screen
- Upload version images
- Reorder screens

Acceptance criteria:
- A feature can represent a review set of screens and variants.

### Chunk 4: Public Review Request
- Create tokenized review request
- Add Firestore rules for public read and anonymous submissions
- Create `/review/[token]`

Acceptance criteria:
- External users can open a review link without authentication.

### Chunk 5: Reviewer Submission Flow
- Reviewer identity capture
- Per-screen review forms
- Favorite version selection
- “Why” rationale
- General comments
- Save per-screen state in client session
- Final submit

Acceptance criteria:
- A reviewer can complete and submit a structured review across all screens.

### Chunk 6: Annotation Layer
- Add overlay editor on top of version images
- Support pin, box, arrow, and text
- Save normalized coordinates

Acceptance criteria:
- Reviewers can leave direct visual feedback on UI screens.

### Chunk 7: Internal Results Console
- Add owner-only results page
- Show submissions by reviewer
- Show aggregate favorite choices
- Replay annotations per screen and version

Acceptance criteria:
- The owner can review all feedback clearly and by screen/version.

### Chunk 8: Hardening
- Validation
- better permissions
- mobile support
- status and deadline handling
- close/reopen review
- export or summary tools

Acceptance criteria:
- The system is stable enough for real external review use.

## Non-Negotiable Working Rule

Before implementing any new feature or making architecture changes:
- read `PROJECT_STATE.md`
- verify the intended work still matches the agreed scope
- update this file if requirements, structure, or sequencing changed

If future implementation starts without checking this file first, the workflow is off track.

## Next MVP: Ticket Tracking

### Goal

Track product issues and bugs per project and optionally per feature in a simple way.

This should replace the current manual process where:
- users report bugs in WhatsApp
- screenshots and notes are scattered in chat
- tasks are forwarded manually to a developer
- fixes come back in chat
- there is no reliable checklist of what was broken and what was actually fixed

### MVP Principle

Keep this lean.

Do not start with Slack, WhatsApp, Gemini, ChatGPT, or automatic parsing integrations.

The first version should work even if all ticket data is entered manually.

### MVP Product Model

Hierarchy:
- Project
- optional Feature
- Ticket

### Ticket MVP Fields

- `title`
- `description`
- `projectId`
- `featureId`
  - optional
- `status`
  - `open`
  - `in_progress`
  - `done`
  - `verified`
- `assigneeName`
  - optional
- `severity`
  - `low`
  - `medium`
  - `high`
- `screenshots`
  - optional image attachments
- `source`
  - optional, e.g. `WhatsApp`, `user test`, `internal QA`
- `devUpdateNote`
  - optional
- `createdAt`
- `updatedAt`
- `verifiedAt`
  - optional

### MVP Ownership Model

Start with owner-controlled updates only.

That means:
- the owner creates tickets
- the owner assigns tickets by name
- the developer or teammate can still report progress in Slack or WhatsApp
- the owner updates ticket status in the app

This is the simplest version and avoids permissions/auth complexity.

### MVP User Flow

1. Open a project
2. Create a ticket
3. Optionally link the ticket to a feature
4. Add title, description, severity, screenshots, and assignee name
5. Track status from `open` to `in_progress` to `done`
6. After confirming the fix, mark the ticket `verified`

### MVP Scope

The first release should include:
- tickets inside a project
- optional feature linkage
- manual ticket creation
- screenshot upload
- assignee name field
- status tracking
- simple filtering by status
- simple checklist-like ticket list
- ticket detail/edit flow

The first release should not include:
- Slack integration
- WhatsApp integration
- AI extraction from chat exports
- public assignee update links
- comments or threaded discussion
- automatic notifications

### MVP Routes And Placement

Recommended placement:
- add `Tickets` inside the existing `Projects` area
- allow tickets to be filtered by feature when relevant

Possible route:
- `/projects/[projectId]/tickets/[ticketId]`

### MVP Firestore Shape

- `users/{uid}/projects/{projectId}/tickets/{ticketId}`

### MVP Acceptance Criteria

- A ticket can be created under a project
- A ticket can optionally be linked to a feature
- A ticket can include screenshot evidence
- A ticket can be assigned by name
- A ticket status can be updated through `open`, `in_progress`, `done`, and `verified`
- The owner can clearly see what is still broken, what is claimed fixed, and what is fully verified

### Deferred Follow-Up

After the manual MVP is working, the next sensible enhancement is:
- paste exported WhatsApp text into a box
- let AI suggest tickets
- review and confirm before saving

That should come before direct integrations.
