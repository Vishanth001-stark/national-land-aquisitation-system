# Land Acquisition System: Golden Path Workflow Implementation Report

## Overview
This document summarizes the changes made to implement the end-to-end "golden path" workflow progression for land acquisition projects, adhering to statutory land acquisition stages, database schema constraints, and NextAuth role-based access control.

---

## 1. Files Created & Modified

### Created Files
1. **[`apps/web/src/app/api/projects/[id]/advance/route.ts`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/src/app/api/projects/[id]/advance/route.ts)**
   - Exposes `POST` to advance a project’s workflow stage by exactly one step.
   - Restricts access to `CENTRAL_MINISTRY` and `SYSTEM_ADMIN` roles (returns 401 if unauthenticated, 403 if unauthorized).
   - Validates project and workflow instance existence (returns 404 / 400).
   - Enforces the 7 statutory stages:
     `SIA` ➔ `PRELIMINARY_NOTIFICATION` ➔ `OBJECTIONS_CONSENT` ➔ `DECLARATION` ➔ `AWARD` ➔ `COMPENSATION` ➔ `POSSESSION`.
   - Prevents advancement past `POSSESSION` (returns 400: *"Project is already at the final possession stage."*).
   - Uses `prisma.$transaction` to atomically update:
     - `WorkflowInstance.currentStage` and `WorkflowInstance.status` (`COMPLETED` at possession, `IN_PROGRESS` prior).
     - `Project.status` (`completed` at possession, `IN_PROGRESS` prior).
     - Creates an `AuditLog` row with `action: "STAGE_ADVANCED:<oldStage>-><newStage>"`.

2. **[`apps/web/src/app/api/projects/route.ts`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/src/app/api/projects/route.ts)**
   - Exposes `GET` to fetch projects including:
     - `workflowInstances` (ordered by `createdAt: desc`)
     - `landParcels`
     - `state` (name and code)
     - `district` (name)

3. **[`apps/web/src/types/next-auth.d.ts`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/src/types/next-auth.d.ts)**
   - Augments NextAuth typings (`Session`, `User`, `AdapterUser`, and `JWT`) with `id`, `role`, `stateId`, and `districtId` to prevent TypeScript compilation errors.

4. **[`apps/web/scripts/verify-advance.ts`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/scripts/verify-advance.ts)**
   - Standalone automated test script verifying the full 7-stage progression, terminal checks, atomic transaction execution, and audit log generation against the database.

---

### Modified Files
1. **[`apps/web/src/lib/auth.ts`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/src/lib/auth.ts)**
   - Updated `jwt` callback to capture `user.id` into `token.id`.
   - Updated `session` callback to populate `session.user.id = (token.id as string) || (token.sub as string)`.

2. **[`apps/web/src/app/dashboard/central/page.tsx`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/src/app/dashboard/central/page.tsx)**
   - Integrated a "Land Acquisition Projects" table showing real project and workflow status.
   - Shows live workflow stage using `project.workflowInstances[0].currentStage`.
   - Added an **"Advance Stage →"** action button for eligible admin users.
   - Includes pending state indicator ("Advancing...") while requests are in flight.
   - Shows success/error alert banners and refreshes project list data without hardcoded values.
   - Disables button and marks status `✓ Completed` when stage is `POSSESSION`.

3. **[`apps/web/prisma/seed.ts`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/prisma/seed.ts)**
   - Fixed project creation to nest `workflowInstances` properly instead of targeting a non-existent `currentStage` field on `Project`.
   - Updated audit logs to use schema-supported fields (`userId`, `action: "STAGE_ADVANCED:..."`, `entityType`, `entityId`).

4. **[`apps/web/prisma/schema.prisma`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/prisma/schema.prisma)**
   - Cleaned up unmigrated fields (`currentStage` on `Project`, `fromStage`/`toStage` on `AuditLog`) to ensure 100% compatibility with the active PostgreSQL database and Prisma Client 5.22.0.

---

## 2. Authorization Mechanics
- **Route**: `POST /api/projects/[id]/advance`
- **Authentication**: `getServerSession(authOptions)` validates the cookie/JWT. Unauthenticated requests receive `401 Unauthorized`.
- **Role Control**: Evaluates `session.user.role`. Allowed roles:
  - `CENTRAL_MINISTRY`
  - `SYSTEM_ADMIN`
  Other roles (e.g. `DISTRICT_COLLECTOR`, `CITIZEN`) receive `403 Forbidden`.
- **Audit Attribution**: `userId` is set directly to `session.user.id` (with a fallback lookup by user email if needed) so audit logs accurately identify the actor.

---

## 3. How to Run and Test

### Run Command (from `apps/web`)
```bash
cd apps/web
npm run dev
```
Open `http://localhost:3000`.

### Manual Test Steps
1. **Log in as Admin**: Go to `/auth/login` and log in with `admin@example.com` / `admin123`.
2. **View Projects**: Visit `/dashboard/central` to see the seeded projects under "Land Acquisition Projects".
3. **Advance Stage**: Click "Advance Stage →" on a project. Verify that the stage updates (e.g. `PRELIMINARY_NOTIFICATION` ➔ `OBJECTIONS_CONSENT`) and a success banner appears.
4. **Verify AuditLog**: Check that an `AuditLog` row was created with action `STAGE_ADVANCED:<oldStage>-><newStage>`.
5. **Terminal Stage**: When the project reaches `POSSESSION`, verify that the button changes to `✓ Completed` and is disabled.
