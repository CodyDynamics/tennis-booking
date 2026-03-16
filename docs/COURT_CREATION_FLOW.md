# Court Creation Flow

This document describes what is required to create a court in the system and the steps involved.

---

## Overview

A **court** belongs to a **branch**. To create a court, you must have at least one branch. The flow is:

1. **Prerequisite:** Create or have an existing **Branch**.
2. **Create court:** Call the Create Court API with the branch ID and court details (authenticated).

---

## Prerequisites

### 1. Branch must exist

A court is linked to a branch via `branchId`. The branch must exist before creating a court.

| Requirement | Description |
|-------------|-------------|
| **Branch** | Create a branch first using `POST /branches` (see [Branch API](../apps/api/src/branches/branches.controller.ts)). You will need the returned branch `id` (UUID) for the court payload. |

**Optional:** If you use organizations, create or select an organization; branches can be scoped by `organizationId` when listing (`GET /branches?organizationId=...`).

### 2. Authentication

Creating a court requires an authenticated user (JWT).

| Requirement | Description |
|-------------|-------------|
| **Auth** | User must be logged in. Send `Authorization: Bearer <access_token>` (or use cookie-based auth if configured). |

---

## Flow Summary

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ 1. Create       │     │ 2. Get branch   │     │ 3. Create       │
│    Branch       │ ──► │    id (UUID)    │ ──► │    Court        │
│ POST /branches  │     │ (from response)  │     │ POST /courts    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **Create branch** (if needed): `POST /branches` with `name`, and optionally `organizationId`, `address`, `phone`. Response includes `id`.
2. **Use branch id** when creating the court.
3. **Create court**: `POST /courts` with `branchId`, `name`, and optional fields.

---

## What You Need to Create a Court

### Required data

| Field      | Type   | Description                    |
|-----------|--------|--------------------------------|
| `branchId`| string | UUID of an existing branch     |
| `name`    | string | Court name (e.g. "Court 1")    |

### Optional data

| Field         | Type   | Default    | Description                          |
|---------------|--------|------------|--------------------------------------|
| `type`        | string | `"outdoor"`| `"indoor"` or `"outdoor"`            |
| `pricePerHour`| number | `0`        | Price per hour (min 0)               |
| `description` | string | —          | Court description                    |
| `status`      | string | `"active"` | `"active"` or `"maintenance"`       |

---

## API Reference

### Create Branch (prerequisite)

**Request**

```http
POST /branches
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Downtown Branch",
  "organizationId": "optional-org-uuid",
  "address": "123 Main St",
  "phone": "+84123456789"
}
```

**Response (201)**  
Returns the created branch object including `id`. Use this `id` as `branchId` when creating a court.

---

### Create Court

**Request**

```http
POST /courts
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "branchId": "<branch-uuid-from-step-1>",
  "name": "Court 1",
  "type": "outdoor",
  "pricePerHour": 200000,
  "description": "Clay court with lighting",
  "status": "active"
}
```

**Response (201)**  
Returns the created court (id, branchId, name, type, pricePerHour, description, status, createdAt, updatedAt).

**Errors**

- `400` – Invalid payload (e.g. missing `branchId` or `name`, invalid `type`/`status`).
- `401` – Unauthorized (missing or invalid token).

---

## Minimal Example

To create a court with only required fields:

```json
POST /courts
{
  "branchId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Court 1"
}
```

Defaults applied: `type: "outdoor"`, `pricePerHour: 0`, `status: "active"`, `description: null`.

---

## Related APIs

| Method | Path              | Description                          |
|--------|-------------------|--------------------------------------|
| GET    | /branches         | List branches (optional ?organizationId) |
| GET    | /branches/:id     | Get branch by id                     |
| GET    | /courts           | List courts (?branchId, ?status)     |
| GET    | /courts/:id       | Get court by id                      |
| PATCH  | /courts/:id       | Update court                         |
| DELETE | /courts/:id       | Delete court                         |

---

## Summary Checklist

- [ ] At least one **Branch** exists (create via `POST /branches` if not).
- [ ] You have the branch **UUID** (`branchId`).
- [ ] User is **authenticated** (JWT or cookie).
- [ ] Send **POST /courts** with `branchId` and `name` (and any optional fields).

Once the court is created, it can be used for bookings (e.g. `GET /bookings/court/availability`, `POST /bookings/court`).
