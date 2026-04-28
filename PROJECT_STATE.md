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
  - Feature list and feature foundation page
  - Artefacts
  - Artefact versions
  - Design vote creation
  - Public design vote link
  - Vote results view
- Knowledge Vault
- Ideas

### Current Main Routes
- `/`
- `/login`
- `/share/[token]`
- `/vote/[token]`
- `/vote/[token]/results`
- `/review/[token]`
- `/review/[token]/results`
- `/projects/[projectId]/features/[featureId]`
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
- `users/{uid}/projects/{projectId}/artefacts`
- `users/{uid}/projects/{projectId}/artefacts/{artefactId}/versions`
- `featureReviews/{reviewId}`
- `featureReviewSubmissions/{reviewId}/submissions/{submissionId}`
- `designVotes/{voteId}`
- `designVoteResponses/{voteId}/responses/{responseId}`
- `shareLinks/{token}`

### Current Feature Foundation State
- Projects now expose a `Features` section.
- Users can create a feature with:
  - title
  - summary
  - status
- Users can open a feature detail page and edit:
  - title
  - summary
  - description
  - status
- Users can add feature attachments:
  - inline markdown content
  - uploaded markdown files stored as inline content
  - links
  - PDFs and other files uploaded to Firebase Storage
- Users can add screens under a feature with:
  - title
  - description
  - 1 to 3 versions
  - version label
  - version notes
  - version image upload
- Users can generate a public feature review link from the current feature snapshot.
- Feature workspaces now keep a review history with links back to the public review and owner results pages.
- Public review pages can currently show:
  - feature summary
  - attachments
  - screens and versions
- Public reviewers can now:
  - enter name and optional email
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

### Important Current Gaps
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

## Route Plan

Proposed new routes:
- `/projects/[projectId]/features/[featureId]`
- `/review/[token]`
- `/review/[token]/results`

Possible dashboard integration:
- Add `Features` inside the existing `Projects` section first
- Later decide whether `Features` needs its own tab or remains nested within projects

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
