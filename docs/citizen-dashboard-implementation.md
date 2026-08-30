# Citizen Dashboard Implementation Report

## Overview
This document describes the implementation of the secure, read-only **Citizen Dashboard** (`/dashboard/citizen`) designed to give affected landowners real-time statutory transparency into their land parcels.

When an authorized Central Ministry or System Admin advances a Project's statutory workflow, the logged-in citizen immediately sees the updated stage in real time because both views query the same underlying PostgreSQL database models (`LandParcel`, `Project`, and `WorkflowInstance.currentStage`).

---

## 1. Files Created & Modified

### Modified Files
1. **[`apps/web/prisma/schema.prisma`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/prisma/schema.prisma)**
   - Added secure parcel ownership relation:
     - In `User`: `ownedLandParcels LandParcel[] @relation("ParcelOwner")`
     - In `LandParcel`: `ownerId String?`, `owner User? @relation("ParcelOwner", fields: [ownerId], references: [id])`, and `@@index([ownerId])`.
     - Preserved `ownerName` for backward-compatible naming/display.
2. **[`apps/web/prisma/seed.ts`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/prisma/seed.ts)**
   - Mapped demo parcels to their actual seeded Citizen accounts:
     - `Ramesh Kumar` (`citizen1@example.com`) ➔ `KH-45/2, KH-45/3` on *National Highway Expansion - NH-48*
     - `Sunita Devi` (`citizen2@example.com`) ➔ `KH-78/1, KH-78/2, KH-79/1` on *Industrial Corridor - Phase 2*
     - `Mohan Lal` (`citizen3@example.com`) ➔ `KH-92/1, KH-92/2` on *Railway Station Modernization*
3. **[`apps/web/src/app/dashboard/citizen/page.tsx`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/src/app/dashboard/citizen/page.tsx)**
   - Transformed stub into a production-grade, read-only Citizen Portal.
   - Restricts access using `RoleGuard` (`CITIZEN` or `SYSTEM_ADMIN`).
   - Renders a **Visual 7-Stage Statutory Stepper** showing which stage is Completed, Active, or Pending:
     `1. SIA` ➔ `2. Preliminary Notification` ➔ `3. Objections & Consent` ➔ `4. Declaration` ➔ `5. Award` ➔ `6. Compensation` ➔ `7. Possession`.
   - Displays parcel details: Notified Area (Hectares and Acres), Land Classification, Compensation Assessment, and Possession Status.
   - Includes manual status refresh button.

### Created Files
1. **[`apps/web/src/app/api/citizen/parcels/route.ts`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/src/app/api/citizen/parcels/route.ts)**
   - Secure read-only `GET` endpoint.
   - Authenticates caller via NextAuth (`getServerSession(authOptions)`). Returns `401` if unauthenticated.
   - Enforces role: only `CITIZEN` and `SYSTEM_ADMIN` can access (returns `403` otherwise).
   - Queries strictly where `ownerId === session.user.id` so a citizen can never view other citizens' parcels.
   - Eager-loads `project`, `state`, `district`, and `workflowInstances` (ordered by `createdAt: desc`).
2. **[`apps/web/scripts/verify-citizen.ts`](file:///c:/Users/VISHANTH%20R/SIH/national-land-aquisitation-system/apps/web/scripts/verify-citizen.ts)**
   - Automated end-to-end verification script testing parcel ownership filtering, privacy boundary validation, stage advancement from admin side, and live citizen reflection.

---

## 2. Privacy & Data Isolation
- **Strict User Scoping**: The API resolves `session.user.id` and queries `prisma.landParcel.findMany({ where: { ownerId: userId } })`.
- **Zero Mock State**: The visual stepper reads directly from `parcel.project.workflowInstances[0].currentStage`.
- **Cross-User Protection**: Automated test verified that `citizen1@example.com` receives only their own parcel (`KH-45/2, KH-45/3`), and cannot inspect `citizen2` or `citizen3` records.

---

## 3. How to Demonstrate in the Hackathon

1. **Open two browser sessions (or two tabs / incognito)**:
   - **Tab 1 (Central Ministry)**: Log in with `admin@example.com` / `admin123`.
     - Go to `/dashboard/central`.
     - Observe *National Highway Expansion - NH-48* at `2. Preliminary Notification`.
   - **Tab 2 (Citizen Ramesh Kumar)**: Log in with `citizen1@example.com` / `citizen123`.
     - Automatically redirected to `/dashboard/citizen`.
     - Ramesh sees his land parcel (`KH-45/2, KH-45/3`, 18.5 Ha / 45.71 acres) on *National Highway Expansion - NH-48*.
     - The 7-stage statutory stepper highlights `Stage 2: Preliminary Notification` as **Active**, `Stage 1: SIA` as **Completed (✓)**, and stages 3–7 as **Pending**.
2. **Advance Stage**:
   - In Tab 1, click **"Advance Stage →"** on the project. Stage updates to `3. Objections & Consent`.
3. **Verify Citizen View**:
   - In Tab 2, click **"🔄 Refresh Status"** (or refresh the page).
   - Stage 2 now shows **Completed (✓)** and Stage 3 (`3. Objections & Consent`) is now **Active**.
