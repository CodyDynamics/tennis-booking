# Tennis Booking & Coaching Management System

Database ERD (Scalable SaaS Architecture)

---

# DESIGN GOALS

- Multi-tenant ready (SaaS architecture)
- Multi-branch support
- Role-based access control (RBAC)
- Support Casual Player & Training Student
- Support Court Only & Court + Coach booking
- Full N-N relationships
- Audit-friendly
- Analytics-ready
- Horizontal scaling compatible

Database: PostgreSQL (Recommended)

Primary Key Type: UUID (v4)

---

# 1. CORE CONCEPTS

- Organization = Tennis Academy (Tenant)
- Branch = Physical location
- Users = All system users
- Roles = RBAC control
- Coach = Extended user
- Student = Extended user (training)
- Casual Player = User role
- Booking = Court reservation (with optional coach)
- Coach Session = Structured training session
- Report = Skill performance tracking

---

# 2. HIGH LEVEL RELATIONSHIP OVERVIEW

Organization (1) → (N) Branch  
Organization (1) → (N) Users  
Roles (1) → (N) Users  
Branch (1) → (N) Courts  
Users (1) → (N) Court Bookings  
Users (N) ↔ (N) Coaches (via coach_student_relations)  
Coach (1) → (N) Coach Sessions  
Coach Session (N) ↔ (N) Students  
Coach (1) → (N) Reports  
Student (1) → (N) Reports

---

# 3. TABLE DEFINITIONS

---

## 3.1 organizations

- id (uuid, pk)
- name
- slug (unique)
- plan_type (basic/pro/enterprise)
- status (active/suspended)
- created_at
- updated_at

Index:

- slug (unique)

---

## 3.2 branches

- id (uuid, pk)
- organization_id (fk → organizations.id)
- name
- address
- phone
- created_at
- updated_at

Index:

- organization_id

---

## 3.3 roles

- id (uuid, pk)
- name (admin/coach/student/parent/player)
- description
- created_at
- updated_at

Index:

- name (unique)

Purpose:
RBAC management. Users only store role_id.

---

## 3.4 users

- id (uuid, pk)
- organization_id (fk)
- branch_id (nullable)
- role_id (fk → roles.id)
- email
- password_hash
- full_name
- phone
- avatar_url
- status (active/inactive)
- created_at
- updated_at

Indexes:

- (organization_id, email) unique
- role_id
- status

Notes:

- Casual Player = role = player
- Training Student = role = student
- Coach = role = coach
- Parent = role = parent

---

## 3.5 parent_student_relations (Optional)

- id (uuid, pk)
- parent_id (fk → users.id)
- student_id (fk → users.id)
- created_at

Supports:
One parent → multiple students

---

## 3.6 courts

- id (uuid, pk)
- branch_id (fk)
- name
- type (indoor/outdoor)
- price_per_hour
- description
- status (active/maintenance)
- created_at
- updated_at

Indexes:

- branch_id
- status

---

## 3.7 court_bookings

Supports:

- Court Only
- Court + Coach
- Training usage

- id (uuid, pk)
- organization_id (fk)
- branch_id (fk)
- court_id (fk)
- user_id (fk → users.id)
- coach_id (nullable fk → coaches.id)
- booking_type (COURT_ONLY / COURT_COACH / TRAINING)
- booking_date
- start_time
- end_time
- duration_minutes
- total_price
- payment_status (unpaid/paid/refunded)
- booking_status (pending/confirmed/cancelled/completed)
- created_at
- updated_at

Indexes:

- court_id + booking_date
- user_id
- booking_status
- booking_type

Constraint:
Prevent overlapping booking per court.

---

## 3.8 coaches

(Extension table for users with role = coach)

- id (uuid, pk)
- user_id (fk → users.id)
- experience_years
- bio
- hourly_rate
- created_at
- updated_at

Index:

- user_id unique

---

## 3.9 coach_student_relations (N-N)

- id (uuid, pk)
- coach_id (fk → coaches.id)
- student_id (fk → users.id)
- start_date
- end_date (nullable)
- status (active/inactive)
- created_at

Indexes:

- coach_id
- student_id
- status

Supports:

- 1 coach → many students
- many coaches → many students

---

## 3.10 coach_sessions

- id (uuid, pk)
- organization_id (fk)
- branch_id (fk)
- coach_id (fk)
- court_id (nullable fk)
- session_date
- start_time
- duration_minutes
- session_type (private/group)
- status (scheduled/completed/cancelled)
- created_at
- updated_at

Index:

- coach_id
- session_date

---

## 3.11 coach_session_students (N-N)

- id (uuid, pk)
- session_id (fk)
- student_id (fk)

Index:

- session_id
- student_id

---

## 3.12 reports (CRITICAL)

- id (uuid, pk)
- organization_id (fk)
- branch_id (fk)
- coach_id (fk)
- student_id (fk)
- session_id (fk nullable)
- session_date

Skill Metrics:

- forehand_score (int 1-10)
- backhand_score (int 1-10)
- serve_score (int 1-10)
- footwork_score (int 1-10)
- stamina_score (int 1-10)

Performance:

- attendance (present/absent)
- overall_comment (text)
- improvement_plan (text)
- next_goal (text)

Audit:

- created_at
- updated_at

Indexes:

- student_id + session_date
- coach_id
- organization_id

Optimized for:

- Skill history query
- Monthly performance summary
- Attendance analytics

---

## 3.13 payments (Future Ready)

- id (uuid, pk)
- organization_id (fk)
- user_id (fk)
- booking_id (fk)
- amount
- method (cash/card/transfer)
- status (pending/success/failed/refunded)
- created_at
- updated_at

Index:

- user_id
- booking_id
- status

---

# 4. SCALABILITY STRATEGY

1. All core tables include organization_id for tenant isolation.
2. UUID primary keys for distributed scaling.
3. Index heavily on:
   - session_date
   - booking_date
   - student_id
   - coach_id
4. Avoid heavy joins in analytics (use snapshot table).
5. Partition future large tables (reports, bookings) by date.

---

# 5. OPTIONAL ANALYTICS TABLE

## student_skill_snapshots

Pre-aggregated monthly data:

- id
- student_id
- month
- year
- avg_forehand
- avg_backhand
- avg_serve
- avg_footwork
- avg_stamina
- attendance_rate
- growth_rate
- created_at

Purpose:
Fast dashboard analytics without heavy real-time calculation.

---

END OF ERD DOCUMENT