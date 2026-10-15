---
name: vantageflow-firebase
description: VantageFlow-specific Firebase/Firestore reference — project ID, custom-claims RBAC, collections, project visibility queries, memberUids maintenance, mock-data fallback trap, and admin scripts. Use for any Firestore rules, queries, Cloud Functions, or deploy work in VantageFlow.
---

# VantageFlow Firebase Reference

Pair with the global `firestore-security` skill for generic patterns.

## Project
| Item | Value |
| :--- | :--- |
| Project ID | `vantageflow` |
| Rules file | `firestore.rules` (repo root) |
| Client config | `services/firebaseConfig.ts` ← `.env.local` (`VITE_FIREBASE_*`) |
| Functions | `functions/src/index.ts` (callables: `listUsers`, `setUserRole`, `deleteUser`, `inviteUser`, `validateInviteToken`, `completeAccountSetup`, …) |
| Extension | `firestore-send-email` |

## RBAC — Custom Claims Only
- Role lives in `request.auth.token.role` ∈ `superadmin | admin | manager | member` (default `member`).
- `talgans@gmail.com` is the **main SuperAdmin**, hardcoded in:
  `firestore.rules` (`isMainSuperAdmin`), `contexts/AuthContext.tsx` (`extractUserRole`), `functions/src/index.ts` (`isSuperAdminUser`), `App.tsx`.
- Role changes go through the `setUserRole` callable → client must `getIdToken(true)` (AuthContext already force-refreshes).
- There is NO `users` profile lookup in rules — do not add `get()`-based RBAC.

## Collections
`projects`, `users`, `presence`, `invites` (Functions-only writes), `forceLogout`, `notifications`, `achievements`, `rolePermissions`.

## Project Visibility (rules ↔ client parity)
Rule (`match /projects/{projectId}` → `allow list`): SuperAdmin OR `isPublic == true` OR `uid in memberUids`.

Client — `subscribeToUserProjects` in `services/firestoreService.ts`:
- SuperAdmin → unbounded `query(collection('projects'), orderBy('createdAt','desc'))`.
- Others → two queries merged by ID: `where('memberUids','array-contains', uid)` + `where('isPublic','==', true)`.

Any change to the `allow list` rule MUST be mirrored in these queries.

## `memberUids`
Recomputed on every write in `convertProjectToFirestore`: owner + active `team.members[].uid` (excludes `isFormerMember`).
Backfill legacy docs with `firestore-admin/migrateMemberUids.ts`.

## Lifecycle Fields
`isArchived` / `archivedAt` / `archivedBy`, `isDeleted` / `deletedAt` / `deletedBy` / `deletedByName`.
Updates are blocked on archived/trashed projects except unarchive / restore / soft-delete transitions.
Deletion: main SuperAdmin any; other SuperAdmins any except projects owned by `talgans@gmail.com`; managers their own.

## ⚠️ Known Trap — Mock Fallback
`App.tsx` falls back to `MOCK_PROJECTS` (`constants.ts`) on any subscription error. `MOCK_PROJECTS` contains ONE project:
**"Digital Transformation Project Plan (StrategicRefresh 1.0)"**. If that's all a SuperAdmin sees, the live query is failing —
check console for `permission-denied` and verify the deployed rules on `vantageflow` (diff vs local `firestore.rules`).

## Data Notes
- `createdAt` is mixed type in prod (ISO strings and Timestamps) — `convertFirestoreDocToProject` handles both; an `orderBy('createdAt')` sorts strings and timestamps as separate type groups.

## Admin Scripts (`firestore-admin/`)
`npm run seed`, `npm run set-role <email> <role>`, `npm run list-users`, `migrateMemberUids.ts`.
Require `firestore-admin/serviceAccountKey.json` (gitignored; not currently present).

## Deploy
```powershell
firebase deploy --only firestore:rules --project vantageflow
# Or:
npm run deploy:rules
```
Then `firebase_get_security_rules` and confirm the live rules contain `match /projects/{projectId}`.
*Trap*: In the Firebase MCP server, if `firebase_update_environment` fails to set `active_project: vantageflow`, pass `active_project: default`. Always verify with `firebase_get_environment`.
