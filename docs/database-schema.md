# 🗄️ Database Schema

**National Land Acquisition & Management System - SIH 2026**

## Overview

This document defines the database schema for the land acquisition system. The database uses PostgreSQL with Prisma ORM.

---

## Tables

### 1. `users`

Stores all system users with role-based access.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique user ID |
| name | VARCHAR(255) | NOT NULL | User's full name |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login email |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| role_id | UUID | FOREIGN KEY → roles.id | User's role |
| state_id | UUID | FOREIGN KEY → states.id, NULLABLE | User's state (if applicable) |
| district_id | UUID | FOREIGN KEY → districts.id, NULLABLE | User's district (if applicable) |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation date |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update date |

**Relationships**:
- Many users → One role
- Many users → One state
- Many users → One district

---

### 2. `roles`

Defines user roles for RBAC (Role-Based Access Control).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique role ID |
| name | VARCHAR(50) | UNIQUE, NOT NULL | Role name (e.g., CENTRAL_MINISTRY, DISTRICT_COLLECTOR) |
| description | TEXT | NULLABLE | Role description |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation date |

**Role Types**:
1. CENTRAL_MINISTRY - Central ministry officials
2. STATE_NODAL - State nodal agency
3. DISTRICT_COLLECTOR - District collector
4. LAND_ACQUIRING_BODY - NHAI, Railways, etc.
5. LAND_REVENUE_OFFICER - Field verification officer
6. TEHSILDAR - Revenue officer
7. RR_OFFICER - Rehabilitation & Resettlement officer
8. FINANCE_OFFICER - Compensation approval
9. CITIZEN - Landowner/citizen
10. SYSTEM_ADMIN - System administrator

---

### 3. `states`

Indian states and union territories.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique state ID |
| name | VARCHAR(100) | NOT NULL | State name (e.g., Karnataka, Maharashtra) |
| code | VARCHAR(2) | UNIQUE, NOT NULL | State code (e.g., KA, MH, TN) |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation date |

**Example Data**:
- Karnataka, KA
- Maharashtra, MH
- Tamil Nadu, TN
- Gujarat, GJ
- Rajasthan, RJ

---

### 4. `districts`

Districts within each state.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique district ID |
| name | VARCHAR(100) | NOT NULL | District name |
| state_id | UUID | FOREIGN KEY → states.id, NOT NULL | Parent state |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation date |

**Relationships**:
- Many districts → One state

---

### 5. `projects`

Land acquisition projects (highways, railways, irrigation, etc.).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique project ID |
| name | VARCHAR(255) | NOT NULL | Project name |
| acquiring_body_id | UUID | FOREIGN KEY, NULLABLE | Acquiring body (NHAI, Railways, etc.) |
| project_type | ENUM | NOT NULL | Type: highway, railway, irrigation, industrial_corridor, urban_development, renewable_energy |
| state_id | UUID | FOREIGN KEY → states.id, NOT NULL | Project state |
| district_id | UUID | FOREIGN KEY → districts.id, NOT NULL | Project district |
| status | VARCHAR(50) | DEFAULT 'proposal' | Current status: proposal, sia, notification, award, possession |
| total_area_hectares | DECIMAL(10,4) | NULLABLE | Total land area required |
| estimated_cost | DECIMAL(15,2) | NULLABLE | Estimated project cost (₹) |
| created_by | UUID | FOREIGN KEY → users.id, NOT NULL | User who created the project |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation date |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update date |

**Relationships**:
- Many projects → One state
- Many projects → One district
- Many projects → One user (creator)

---

### 6. `workflow_instances`

Tracks the 7-stage RFCTLARR 2013 workflow for each project.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique workflow ID |
| project_id | UUID | FOREIGN KEY → projects.id, NOT NULL | Associated project |
| current_stage | INTEGER | NOT NULL | Current stage (1-7) |
| status | VARCHAR(50) | DEFAULT 'pending' | Status: pending, in_progress, approved, rejected, completed |
| sla_deadline | TIMESTAMP | NULLABLE | SLA deadline for current stage |
| started_at | TIMESTAMP | DEFAULT NOW() | Workflow start date |
| completed_at | TIMESTAMP | NULLABLE | Workflow completion date |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation date |

**Workflow Stages (RFCTLARR 2013)**:
1. Social Impact Assessment (SIA) - 60 days
2. Preliminary Notification - 30 days
3. Objections & Consent - 60 days
4. Declaration of Acquisition - 30 days
5. Award Declaration - 90 days
6. Compensation Payment - 30 days
7. Possession & Handover - 15 days

**Relationships**:
- One workflow → One project

---

### 7. `land_parcels`

Individual land parcels being acquired for a project.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique parcel ID |
| project_id | UUID | FOREIGN KEY → projects.id, NOT NULL | Associated project |
| ulpin | VARCHAR(14) | NULLABLE | Bhu-Aadhar (Unique Land Parcel Identification Number) |
| survey_number | VARCHAR(50) | NULLABLE | Survey number from land records |
| area_hectares | DECIMAL(10,4) | NULLABLE | Parcel area in hectares |
| land_type | VARCHAR(50) | NULLABLE | Type: agricultural, forest, wasteland, residential, commercial, government |
| owner_name | VARCHAR(255) | NULLABLE | Land owner name |
| compensation_amount | DECIMAL(15,2) | NULLABLE | Compensation amount (₹) |
| possession_status | VARCHAR(50) | DEFAULT 'not_acquired' | Status: not_acquired, acquired, possessed |
| latitude | DECIMAL(10,8) | NULLABLE | GPS latitude |
| longitude | DECIMAL(11,8) | NULLABLE | GPS longitude |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation date |

**Relationships**:
- Many land parcels → One project

---

### 8. `documents`

Stores all documents (SIA reports, notifications, awards, RTC, etc.).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique document ID |
| project_id | UUID | FOREIGN KEY → projects.id, NOT NULL | Associated project |
| document_type | VARCHAR(50) | NOT NULL | Type: sia_report, preliminary_notification, declaration_order, award_file, rtc, cadastral_map, compensation_sheet, possession_certificate, rr_plan |
| file_path | VARCHAR(500) | NOT NULL | MinIO/S3 storage path |
| file_size | INTEGER | NULLABLE | File size in bytes |
| mime_type | VARCHAR(50) | NULLABLE | MIME type (e.g., application/pdf) |
| uploaded_by | UUID | FOREIGN KEY → users.id, NOT NULL | User who uploaded |
| version | INTEGER | DEFAULT 1 | Version number |
| created_at | TIMESTAMP | DEFAULT NOW() | Upload date |

**Relationships**:
- Many documents → One project
- Many documents → One user (uploader)

---

### 9. `compensation_records`

Tracks compensation assessment and payment for each land parcel.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique record ID |
| land_parcel_id | UUID | FOREIGN KEY → land_parcels.id, NULLABLE | Associated land parcel |
| assessed_amount | DECIMAL(15,2) | NULLABLE | Assessed compensation (₹) |
| paid_amount | DECIMAL(15,2) | NULLABLE | Amount actually paid (₹) |
| payment_date | TIMESTAMP | NULLABLE | Payment date |
| payment_mode | VARCHAR(50) | NULLABLE | Mode: bank_transfer, cheque, cash, pending |
| bank_account_hash | VARCHAR(255) | NULLABLE | Hashed bank account number |
| status | VARCHAR(50) | DEFAULT 'assessed' | Status: assessed, approved, paid, rejected |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation date |

**Relationships**:
- One compensation record → One land parcel (optional)

---

### 10. `audit_logs`

Tracks all user actions for security and compliance.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique log ID |
| user_id | UUID | FOREIGN KEY → users.id, NOT NULL | User who performed action |
| action | VARCHAR(255) | NOT NULL | Action: user_login, proposal_submitted, award_approved, document_uploaded, compensation_paid, etc. |
| entity_type | VARCHAR(50) | NOT NULL | Entity type: project, land_parcel, document, user |
| entity_id | UUID | NULLABLE | ID of the affected entity |
| ip_address | VARCHAR(50) | NULLABLE | User's IP address |
| user_agent | VARCHAR(255) | NULLABLE | Browser/device info |
| created_at | TIMESTAMP | DEFAULT NOW() | Action timestamp |

**Relationships**:
- Many audit logs → One user

---

## Entity Relationship Diagram
users (N) ──→ (1) roles
users (N) ──→ (1) states
users (N) ──→ (1) districts
districts (N) ──→ (1) states
projects (N) ──→ (1) states
projects (N) ──→ (1) districts
projects (N) ──→ (1) users (creator)
workflow_instances (1) ──→ (1) projects
land_parcels (N) ──→ (1) projects
documents (N) ──→ (1) projects
documents (N) ──→ (1) users (uploader)
compensation_records (1) ──→ (1) land_parcels
audit_logs (N) ──→ (1) users

---

## Indexes (for Performance)

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);

-- Projects
CREATE INDEX idx_projects_state ON projects(state_id);
CREATE INDEX idx_projects_district ON projects(district_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_type ON projects(project_type);

-- Land Parcels
CREATE INDEX idx_land_parcels_project ON land_parcels(project_id);
CREATE INDEX idx_land_parcels_status ON land_parcels(possession_status);

-- Documents
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_type ON documents(document_type);

-- Workflow
CREATE INDEX idx_workflow_project ON workflow_instances(project_id);
CREATE INDEX idx_workflow_status ON workflow_instances(status);

-- Audit Logs
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
```

---

## Notes

- All UUIDs are generated using `gen_random_uuid()` PostgreSQL function
- Timestamps use UTC timezone
- Decimal precision: 10,4 for area; 15,2 for money
- Password hashing uses bcrypt with cost factor 10
- File storage uses MinIO (S3-compatible) with bucket: `land-documents`

---

**Last Updated**: August 29, 2026  
**Version**: 1.0  
**SIH 2026 - National Land Acquisition & Management System**