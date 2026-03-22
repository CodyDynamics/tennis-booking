# Booking Service – OOP Design

## Model: Booking as parent

```
Booking (parent)
├── Court  → CourtBookingHandler → court_bookings
└── Coach  → CoachSessionHandler → coach_sessions
```

## Features

### 1. Court booking
- Choose **court** (multiple courts), **date**, **start and end time**.
- Optionally **book with coach** (send `coachId` in body) → type `COURT_COACH`.
- Omit coach → type `COURT_ONLY`.

**API:**
- `POST /bookings/court` – create court booking (body: courtId, bookingDate, startTime, endTime, coachId?, locationBookingWindowId?)
- `GET /bookings/court/availability?courtId=&date=&slotMinutes=` – get available slots by court and date (legacy single-court grid).
- `GET /bookings/court/wizard/windows?locationId=&sport=&courtType=` (JWT) – list `location_booking_windows` for the wizard.
- `GET /bookings/court/wizard/availability?locationId=&sport=&courtType=&bookingDate=&windowId=&durationMinutes=` (JWT) – slots on the window grid + courts that still have a free slot.

See `docs/BOOKING_CONCURRENCY_AND_QUEUE.md` for overlap logic, Postgres exclusion, and RabbitMQ notes.

### 2. Coach booking
- Book **coach only** (no court) or **coach + court** (send `courtId`).
- Body: coachId, sessionDate, startTime, durationMinutes, courtId?, sessionType?.

**API:**
- `POST /bookings/coach` – create coach session.

### 3. Unified (parent)
- `GET /bookings/my?from=&to=` – list all user bookings (court + coach).
- `GET /bookings/:kind/:id` – get booking details (kind = `court` | `coach`).
- `DELETE /bookings/:kind/:id` – cancel booking.

## OOP in code

| Component | Role |
|-----------|------|
| `IBookingHandler` | Common interface for all booking types (create, cancel, findOne, findByUser). |
| `CourtBookingHandler` | Court handler: check slot availability, compute price (court + coach if any), create/cancel court_bookings. |
| `CoachSessionHandler` | Coach handler: check coach availability, create/cancel coach_sessions (optional courtId). |
| `BookingsService` | **Parent / Facade**: delegates to the right handler (court or coach), exposes unified API (my bookings, cancel, availability). |

## Entities (per ERD)

- **court_bookings**: courtId, userId, coachId (nullable), bookingDate, startTime, endTime, durationMinutes, totalPrice, bookingType (COURT_ONLY | COURT_COACH), paymentStatus, bookingStatus.
- **coach_sessions**: coachId, courtId (nullable), bookedById (user who booked), sessionDate, startTime, durationMinutes, sessionType, status.

## Related modules

- **BranchesModule**: Branch (location).
- **CourtsModule**: Court CRUD, filter by branch/status.
- **CoachesModule**: Coach CRUD (extended user).
- **BookingsModule**: CourtBookingHandler, CoachSessionHandler, BookingsService, BookingsController.
