# API Guide

This document lists all endpoints of the Tennis Booking API: method, path, description, auth, input (body/query/param), and output.

**Base URL (local):** `http://localhost:3000`  
**Swagger UI:** `http://localhost:3000/api`

Legend:

- **Auth**: 🔓 Public (no token) | 🔒 Requires **Bearer JWT**
- **Body**: JSON request body
- **Query**: query string
- **Param**: path parameter

---

## 1. Health

| Method | Path | Description | Auth | Input | Output |
|--------|------|-------------|------|--------|--------|
| GET | `/health` | Health check (API and DB connection) | 🔓 | — | `{ status, timestamp, service }` or `{ status: "error", error }` |

---

## 2. RSA

| Method | Path | Description | Auth | Input | Output |
|--------|------|-------------|------|--------|--------|
| GET | `/rsa/public-key` | Get RSA public key (for client encryption) | 🔓 | — | `{ publicKey: string }` |

---

## 3. Auth

| Method | Path | Description | Auth | Input | Output |
|--------|------|-------------|------|--------|--------|
| POST | `/auth/register` | Register account | 🔓 | **Body:** `RegisterDto` (email, password, fullName, phone?, organizationId?, branchId?, roleId) | `{ accessToken, refreshToken?, user: { id, email, fullName, role, ... } }` |
| POST | `/auth/login` | Login | 🔓 | **Body:** `{ email, password }` | Same structure as register |
| GET | `/auth/google` | Start Google login | 🔓 | — | Redirect to Google OAuth |
| GET | `/auth/google/callback` | Callback after Google login | 🔓 | — | `{ accessToken, refreshToken?, user }` |
| POST | `/auth/forgot-password` | Send forgot password email | 🔓 | **Body:** `{ email }` | 200 OK (message depends on backend) |
| POST | `/auth/reset-password` | Reset password with token | 🔓 | **Body:** `{ token, newPassword }` | 200 OK |
| POST | `/auth/refresh` | Refresh access token | 🔓 | **Body:** `{ refreshToken }` | `{ accessToken, refreshToken?, user }` |

---

## 4. Users

| Method | Path | Description | Auth | Input | Output |
|--------|------|-------------|------|--------|--------|
| GET | `/users/profile` | Get current user profile | 🔒 | — | User object (id, email, fullName, role, ...) |

---

## 5. Courts

| Method | Path | Description | Auth | Input | Output |
|--------|------|-------------|------|--------|--------|
| POST | `/courts` | Create court | 🔒 | **Body:** branchId, name, type?, pricePerHour?, description?, status? | Court object |
| GET | `/courts` | List courts | 🔓 | **Query:** branchId?, status? | Array of Court |
| GET | `/courts/:id` | Get court by id | 🔓 | **Param:** id (UUID) | Court object |
| PATCH | `/courts/:id` | Update court | 🔒 | **Param:** id; **Body:** partial CreateCourtDto | Court object |
| DELETE | `/courts/:id` | Delete court | 🔒 | **Param:** id | `{ deleted: true }` |

---

## 6. Coaches

| Method | Path | Description | Auth | Input | Output |
|--------|------|-------------|------|--------|--------|
| POST | `/coaches` | Create coach | 🔒 | **Body:** userId, experienceYears?, bio?, hourlyRate? | Coach object |
| GET | `/coaches` | List coaches | 🔓 | — | Array of Coach |
| GET | `/coaches/:id` | Get coach by id | 🔓 | **Param:** id (UUID) | Coach object |
| PATCH | `/coaches/:id` | Update coach | 🔒 | **Param:** id; **Body:** partial CreateCoachDto | Coach object |
| DELETE | `/coaches/:id` | Delete coach | 🔒 | **Param:** id | `{ deleted: true }` |

---

## 7. Bookings

| Method | Path | Description | Auth | Input | Output |
|--------|------|-------------|------|--------|--------|
| POST | `/bookings/court` | Book court (optional with coach) | 🔒 | **Body:** courtId, bookingDate, startTime, endTime, coachId?, durationMinutes? | `{ id, kind: "court", summary }` |
| GET | `/bookings/court/availability` | Get available court slots by date | 🔓 | **Query:** courtId, date, slotMinutes? | `[{ start, end }, ...]` |
| POST | `/bookings/coach` | Book coach (with or without court) | 🔒 | **Body:** coachId, sessionDate, startTime, durationMinutes, courtId?, sessionType? | `{ id, kind: "coach", summary }` |
| GET | `/bookings/my` | List current user bookings | 🔒 | **Query:** from?, to? (YYYY-MM-DD) | `{ courtBookings: [], coachSessions: [] }` |
| GET | `/bookings/:kind/:id` | Get booking by id | 🔒 | **Param:** kind (court \| coach), id | `{ kind, data }` |
| DELETE | `/bookings/:kind/:id` | Cancel booking | 🔒 | **Param:** kind, id | 200 OK |

---

## 8. DTO reference

### Auth

- **RegisterDto**: email, password (min 8), fullName, phone?, organizationId?, branchId?, roleId
- **LoginDto**: email, password
- **ForgotPasswordDto**: email
- **ResetPasswordDto**: token, newPassword (min 8)
- **RefreshTokenDto**: refreshToken

### Courts

- **CreateCourtDto**: branchId, name, type?, pricePerHour?, description?, status?
- **UpdateCourtDto**: partial of CreateCourtDto

### Coaches

- **CreateCoachDto**: userId, experienceYears?, bio?, hourlyRate?
- **UpdateCoachDto**: partial of CreateCoachDto

### Bookings

- **CreateCourtBookingDto**: courtId, bookingDate (YYYY-MM-DD), startTime (HH:mm), endTime (HH:mm), coachId?, durationMinutes?
- **CreateCoachSessionDto**: coachId, sessionDate, startTime, durationMinutes, courtId?, sessionType?

---

## 9. Common error codes

| Status | Meaning |
|--------|---------|
| 400 | Invalid data (validation) or business error (e.g. court not available) |
| 401 | Not authenticated or token expired / invalid |
| 403 | Forbidden (e.g. cancelling another user's booking) |
| 404 | Resource not found (user, court, booking, ...) |

---

## 10. Why does register have organizationId and branchId?

The system is designed for **multi-tenant** (multiple organizations) and **multi-branch** (multiple locations), per the ERD:

- **Organization** = one tenant (e.g. a tennis academy). Each organization has its own data (courts, users, bookings).
- **Branch** = a physical location belonging to an organization (e.g. site 1, site 2). Courts are linked to a branch.

When **registering a user**:

- **organizationId** (optional): Which organization the user belongs to. Used when an org admin invites members (registration link with organizationId) or when the user chooses to "join club X".
- **branchId** (optional): The user's default branch (e.g. staff/coach assigned to site 2).

In the current **RegisterDto**, both are **optional** (`@ApiPropertyOptional`). If you are not using multi-tenant / multi-branch (single center, single organization), you can:

- Omit `organizationId` and `branchId` when registering (they stay `null` in the DB), or
- Hide these fields on the registration form in the frontend.

When you later need multiple centers or organizations, you can start sending these fields in the register API.

---

## 11. Notes

- Protected endpoints (🔒) require header: `Authorization: Bearer <accessToken>`.
- Token is obtained from **POST /auth/login**, **POST /auth/register**, or **POST /auth/refresh**.
- Dates/times: **bookingDate**, **sessionDate** as `YYYY-MM-DD`; **startTime**, **endTime** as `HH:mm`.
