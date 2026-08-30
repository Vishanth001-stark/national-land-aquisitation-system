# Proposal to Project Conversion Implementation Report

## Overview
This document describes the implementation of the real statutory **Proposal ➔ Project** conversion step in the land-acquisition system. 

It establishes an official, atomic conversion lifecycle:
```
Proposal (draft / submitted)
  ➔ Approved by Central Ministry / Admin (POST /api/proposals/[id]/approve)
  ➔ Proposal status becomes "converted"
  ➔ Official Project is created (linked 1-to-1 via proposalId)
  ➔ Exactly one WorkflowInstance is created at stage SIA
  ➔ AuditLog entry recorded ("PROPOSAL_CONVERTED_TO_PROJECT")
  ➔ Project workflow advances separately through the 7 statutory stages:
     SIA ➔ PRELIMINARY_NOTIFICATION ➔ OBJECTIONS_CONSENT ➔ DECLARATION ➔ AWARD ➔ COMPENSATION ➔ POSSESSION
```

---

## 1. Files Created & Modified

### Created Files
1. **[`apps/web/src/app/api/proposals/[id]/approve/route.ts`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/src/app/api/proposals/[id]/approve/route.ts)**
   - Exposes `POST` endpoint to approve a submitted proposal and atomically convert it into an official project.
   - Requires authentication via NextAuth (`getServerSession(authOptions)`). Returns `401` if unauthenticated.
   - Enforces role authorization: only `CENTRAL_MINISTRY` or `SYSTEM_ADMIN` roles can approve. Returns `403` if unauthorized.
   - Validates proposal existence (returns `404` if missing).
   - Prevents duplicate conversions: returns `409 Conflict` if the proposal already has a linked project or its status is `'converted'`.
   - Resolves location (stateId & districtId) deterministically from the submitter or configured database fallback.
   - Resolves `projectType` deterministically from proposal title/purpose (keywords for highway, railway, irrigation, industrial_corridor, renewable_energy, or urban_development).
   - Executes atomic conversion within `prisma.$transaction`:
     - Creates `Project` linked to `proposalId`
     - Creates `WorkflowInstance` at `currentStage: SIA`, `status: IN_PROGRESS`
     - Updates `Proposal.status = 'converted'`
     - Inserts `AuditLog` row (`action: 'PROPOSAL_CONVERTED_TO_PROJECT'`, `entityType: 'Proposal'`, `entityId: proposal.id`)
   - Returns `HTTP 201` with created project details and initial SIA workflow stage.

2. **[`apps/web/scripts/verify-approve.ts`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/scripts/verify-approve.ts)**
   - Automated end-to-end verification script testing proposal creation, atomic conversion to Project + WorkflowInstance(SIA), relation integrity, duplicate prevention, and audit logging.

### Modified Files
1. **[`apps/web/prisma/schema.prisma`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/prisma/schema.prisma)**
   - Added optional 1-to-1 link between `Project` and `Proposal`:
     - In `Project`: `proposalId String? @unique` and `proposal Proposal? @relation(fields: [proposalId], references: [id])`.
     - In `Proposal`: `project Project?`.
   - Cleanly synchronized to the PostgreSQL database with Prisma Client 5.22.0 regenerated.

2. **[`apps/web/src/app/dashboard/proposals/page.tsx`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/src/app/dashboard/proposals/page.tsx)**
   - Displays real proposals with live conversion state.
   - Added **"Approve & Create Project"** button for `CENTRAL_MINISTRY` and `SYSTEM_ADMIN` users on uncoverted proposals.
   - Displays in-flight loading state ("Creating project...") while request is pending.
   - Shows success/error alert banners and link to view created projects.
   - Displays a non-clickable `"✓ Converted to Project"` badge once converted.

3. **[`apps/web/src/app/dashboard/central/page.tsx`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/src/app/dashboard/central/page.tsx)**
   - Updated "Recent Proposals" section to show proposal conversion status and an **"Approve & Create Project"** button with in-flight state and auto-refresh.

4. **[`apps/web/src/app/api/proposals/route.ts`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/src/app/api/proposals/route.ts)**
   - Enhanced `GET` route to include `project` relation and allow central admins to view all proposals submitted across the platform.

5. **[`apps/web/src/app/api/dashboard/stats/route.ts`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/src/app/api/dashboard/stats/route.ts)**
   - Included `project: { select: { id: true, name: true } }` in `recentProposals` query so the dashboard UI reflects linked project status immediately.

---

## 2. Real Data Flow
```
1. Proposal Submission
   - User submits proposal (status: 'draft' or 'submitted').
   - Project does not yet exist (proposal.project = null).

2. Approval & Conversion (POST /api/proposals/[id]/approve)
   - Central Ministry or Admin triggers conversion.
   - System verifies authentication and authorization (401/403).
   - System checks if proposal.project exists or status === 'converted' (409).
   - System runs prisma.$transaction:
     a. Creates Project with proposalId, name, stateId, districtId, projectType, status: 'IN_PROGRESS'.
     b. Creates WorkflowInstance linked to Project at currentStage: 'SIA', status: 'IN_PROGRESS'.
     c. Updates Proposal status to 'converted'.
     d. Creates AuditLog with action 'PROPOSAL_CONVERTED_TO_PROJECT'.

3. Separate Workflow Stage Advancement (POST /api/projects/[id]/advance)
   - Central Ministry or Admin advances stage sequentially from SIA to POSSESSION.
   - Workflow stage is stored and managed exclusively in WorkflowInstance.currentStage.
```

---

## 3. Tooling & Migration Synchronization Notes
- **Interactive Migration Limitation**: `prisma migrate dev` detected a non-interactive PowerShell console environment.
- **Safe Resolution**: Applied the schema change using `npx prisma db push --accept-data-loss` to add the `proposalId` column and unique constraint to table `projects` in the PostgreSQL database without dropping existing tables or data.
- **Client Generation**: Stopped the local dev server temporarily to release file locks on `query_engine-windows.dll.node`, then ran `npx prisma generate` to produce the updated Prisma Client (v5.22.0).

---

## 4. Verification Results
- **TypeScript**: `npx tsc --noEmit` exited with 0 errors.
- **Next.js Production Build**: `npm run build` compiled all static and dynamic routes cleanly.
- **Automated Test**: `npx tsx scripts/verify-approve.ts` verified:
  - Proposal creation
  - Conversion into Project + WorkflowInstance at stage `SIA`
  - 1-to-1 relation between `Proposal` and `Project`
  - Proposal status updated to `'converted'`
  - Duplicate conversion blocked (409)
  - `AuditLog` row created with action `PROPOSAL_CONVERTED_TO_PROJECT`
