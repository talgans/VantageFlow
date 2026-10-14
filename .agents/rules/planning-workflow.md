# Flexible Implementation Planning & Walkthrough Workflow

## Flexible Implementation Planning Workflow

### Trigger Conditions
Generate an `implementation_plan.md` artifact **before writing or modifying any code** when either of the following conditions is met:

1. **Explicit Planning Request**:
   - The user mentions keywords such as `brainstorm`, `plan`, `implementation plan`, `roadmap`, `proposal`, `architect`, `draft a solution`, or uses the `/plan` command.

2. **Task Complexity**:
   - The task spans multiple files or components.
   - The task introduces new architectural patterns, core services, or state management.
   - The task alters schemas, database collections/rules, security policies, or access controls.
   - The task touches financial, billing, or critical business workflows.
   - The requirements involve significant trade-offs or ambiguity.

*For straightforward, localized edits, minor bug fixes, or quick style tweaks without planning keywords, execute directly without blocking on a plan artifact.*

### Artifact Standards
When generating the plan:
- Target file: `implementation_plan.md` in the conversation artifact directory.
- Always set `RequestFeedback: true` in `ArtifactMetadata` so the interactive plan review panel and "Proceed" button appear in the IDE.
- Include:
  - User Review / Architectural decisions required
  - Proposed changes by file with links and code snippets
  - Step-by-step verification plan
- Wait for user feedback or approval before modifying project code.

---

## Post-Implementation Walkthrough Workflow

### Trigger Condition
Generate a `walkthrough.md` artifact **after completing and verifying any code implementation, bug fix, refactor, or non-trivial task**.

### Artifact Standards
When generating the walkthrough:
- **Target File**: `walkthrough.md` in the conversation artifact directory (`<appDataDir>\brain\<conversation-id>\walkthrough.md`).
- **Metadata**:
  - `UserFacing: true`
  - `RequestFeedback: false` (or `true` if explicitly soliciting final sign-off)
  - `Summary`: Concise multi-line summary of what was changed and verified.
- **Content Structure**:
  1. **Overview**: Executive summary of what was accomplished and problems resolved.
  2. **Changes Made**: File-by-file breakdown with clickable file links (e.g. `[Component.tsx](file:///path/to/Component.tsx)`) detailing all additions, modifications, and removals.
  3. **Verification Results**: Automated test/build execution results (`npm run build`, unit tests, lint checks) and browser verification (with embedded recordings or screenshots).
  4. **User Verification Steps**: Concise, actionable steps for the user to review and verify the changes locally.
