---
# 4. MULTI-TENANT STRATEGY

Tenant Isolation Model: Shared Database, Shared Schema.

Each major table contains:
  - organization_id

Every request must include:
  - organization context (from JWT)

Backend middleware:
  - Extract organization_id
  - Auto-inject into queries

Future Option:
  - Row-level security (PostgreSQL RLS)
---

# 5. AUTHENTICATION & RBAC

## 5.1 Authentication

- JWT Access Token
- Refresh Token
- Password hashing (bcrypt)
- Email verification (future)

---

## 5.2 Roles

Roles stored in database:

- admin
- coach
- student
- parent
- player (casual player)

Users table contains:

- role_id (FK → roles)

---

## 5.3 Authorization

Use:

- RoleGuard
- PermissionGuard (future-ready)

Example:

- Admin → full access
- Coach → reports + sessions
- Student → own reports only
- Parent → linked student reports
- Player → court bookings only

---

# 6. CORE MODULE DESIGN

---

## 6.1 Auth Module

Responsibilities:

- Register
- Login
- Forgot password
- Token refresh
- Attach organization context

---

## 6.2 Users Module

Handles:

- CRUD users
- Profile management
- Role assignment
- Parent-student linking

---

## 6.3 Courts Module

Handles:

- Court CRUD
- Availability checking
- Maintenance status

Must support:

- Branch filtering
- Time slot availability

---

## 6.4 Bookings Module

Supports 3 Booking Types:

1. COURT_ONLY
2. COURT_COACH
3. TRAINING

Responsibilities:

- Create booking
- Prevent overlapping bookings
- Calculate total price
- Handle payment status
- Cancel booking
- Booking history

Important:

Use Redis distributed lock when booking to prevent race condition.

---

## 6.5 Coaches Module

Responsibilities:

- Coach profile
- Availability schedule
- Hourly rate
- Coach-student relations (N-N)

---

## 6.6 Sessions Module

Handles:

- Coach sessions
- Private or group session
- Session-student linking
- Session status

---

## 6.7 Reports Module (CRITICAL)

Responsibilities:

- Create daily report
- Update report
- Fetch student progress history
- Calculate average score
- Calculate attendance rate

Reports linked to:

- coach_id
- student_id
- session_id (optional)

Optimization:

Add index on:

- student_id + session_date

---

## 6.8 Payments Module

Future-ready module:

- Payment creation
- Payment confirmation
- Refund logic
- Integration with:
  - Stripe
  - VNPay
  - MoMo

---

## 6.9 Analytics Module

Responsibilities:

- Revenue aggregation
- Court utilization rate
- Coach performance summary
- Student growth tracking

Use:

- Pre-aggregated snapshot table
- Background cron jobs

---

# 7. BOOKING FLOW

### Court Only

1. User selects court
2. Check availability
3. Lock slot (Redis)
4. Create booking
5. Handle payment
6. Confirm booking

---

### Court + Coach

1. Select court
2. Select available coach
3. Validate coach availability
4. Lock slot
5. Create booking
6. Confirm

---

### Training Session

1. Coach creates session
2. Add students
3. Link to court (optional)
4. Generate reports after completion

---

# 8. PERFORMANCE OPTIMIZATION

- Redis caching:
  - Court availability
  - Dashboard stats
- DB Indexing:
  - booking_date
  - session_date
  - student_id
- Query optimization
- Avoid N+1 query
- Use pagination everywhere

---

# 9. AUDIT & LOGGING

Add:

- created_at
- updated_at
- Optional:
  - created_by
  - updated_by

Use centralized logger:

- Winston or Pino

Log:

- Booking creation
- Payment
- Report submission

---

# 10. SECURITY BEST PRACTICES

- Validate all inputs (DTO + class-validator)
- Rate limiting
- Helmet
- CORS restriction
- Secure password storage
- Role-based guards
- Prevent horizontal privilege escalation

---

# 11. SCALABILITY ROADMAP

Phase 1:

- Modular monolith
- Single DB

Phase 2:

- Extract modules:
  - Auth service
  - Booking service
  - Report service
- Use message queue (Kafka / RabbitMQ)

Phase 3:

- Separate analytics database
- Read replica DB
- DB partitioning by date

---

# 12. FUTURE EXTENSIONS

- Mobile App API
- AI skill improvement prediction
- Push notification system
- Attendance QR check-in
- Subscription packages
- Membership plans

---

END OF BACKEND ARCHITECTURE