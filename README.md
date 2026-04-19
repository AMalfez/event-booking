# Event Booking System — Backend API

A role-based REST API for managing events and booking tickets, built with **Express**, **MongoDB**, and **BullMQ** (Redis).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Job Queue | BullMQ (backed by Redis) |
| Runtime | Node.js |

---

## Prerequisites

- Node.js v18+
- MongoDB (local or Atlas)
- Redis (required for BullMQ)

---

## Setup

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, Redis host, and JWT secret

# 3. Start the server (workers run in-process in development)
npm run dev

# 4. (Production) Run workers as a separate process
npm run worker
```

---

## Environment Variables

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/event-booking
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

---

## Project Structure

```
src/
├── config/
│   ├── db.js           # MongoDB connection
│   └── redis.js        # Redis connection config for BullMQ
├── controllers/
│   ├── authController.js
│   ├── eventController.js
│   └── ticketController.js
├── middleware/
│   ├── auth.js         # JWT protect + restrictTo(role)
│   └── errorHandler.js # Global error handler
├── models/
│   ├── User.js         # role: 'customer' | 'organizer'
│   ├── Event.js        # owned by organizer
│   └── Ticket.js       # owned by customer, linked to event
├── queues/
│   └── index.js        # BullMQ queue definitions
├── routes/
│   ├── authRoutes.js
│   ├── eventRoutes.js
│   └── ticketRoutes.js
├── workers/
│   └── index.js        # BullMQ workers (background jobs)
├── app.js              # Express app
└── server.js           # Entry point
```

---

## Data Models

### User
| Field | Type | Notes |
|---|---|---|
| name | String | required |
| email | String | unique |
| password | String | bcrypt hashed, never returned |
| role | String | `customer` or `organizer` |

### Event
| Field | Type | Notes |
|---|---|---|
| title | String | required |
| description | String | |
| date | Date | required |
| venue | String | required |
| totalTickets | Number | required |
| remainingTickets | Number | auto-set from totalTickets |
| ticketPrice | Number | required |
| organizer | ObjectId → User | required |
| status | String | `upcoming` / `ongoing` / `completed` / `cancelled` |

### Ticket
| Field | Type | Notes |
|---|---|---|
| event | ObjectId → Event | required |
| customer | ObjectId → User | required |
| quantity | Number | required |
| totalPrice | Number | ticketPrice × quantity |
| status | String | `pending` / `confirmed` / `cancelled` |
| bookedAt | Date | |

---

## API Reference

### Auth

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register as customer or organizer |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| GET | `/api/auth/me` | Authenticated | Get current user |

**Register body:**
```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "secret123",
  "role": "customer"
}
```

---

### Events

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/events` | Public | Browse all events (paginated) |
| GET | `/api/events/:id` | Public | Get single event |
| GET | `/api/events/organizer/my` | Organizer | Get organizer's own events |
| POST | `/api/events` | Organizer | Create event |
| PATCH | `/api/events/:id` | Organizer (owner) | Update event → triggers notification job |
| DELETE | `/api/events/:id` | Organizer (owner) | Delete event |

**Create event body:**
```json
{
  "title": "Jaipur Literature Festival",
  "description": "Annual literary festival",
  "date": "2025-01-24T09:00:00.000Z",
  "venue": "Diggi Palace, Jaipur",
  "totalTickets": 500,
  "ticketPrice": 299
}
```

**Query params for GET /api/events:**
- `status` — filter by status (`upcoming`, `ongoing`, etc.)
- `page` — page number (default: 1)
- `limit` — results per page (default: 10)

---

### Tickets

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/tickets/book` | Customer | Book tickets → triggers confirmation job |
| GET | `/api/tickets/my` | Customer | Get own bookings |
| GET | `/api/tickets/:id` | Customer (owner) | Get single ticket |
| PATCH | `/api/tickets/:id/cancel` | Customer (owner) | Cancel booking |
| GET | `/api/tickets/event/:eventId` | Organizer (owner) | Get all bookings for an event |

**Book tickets body:**
```json
{
  "eventId": "64abc123...",
  "quantity": 2
}
```

---

## Background Jobs (BullMQ)

### Job 1 — Booking Confirmation
- **Queue:** `booking-confirmation`
- **Triggered by:** `POST /api/tickets/book`
- **Worker concurrency:** 5
- **What it does:** Simulates sending a confirmation email (console log)

### Job 2 — Event Update Notification
- **Queue:** `event-update-notification`
- **Triggered by:** `PATCH /api/events/:id`
- **Worker concurrency:** 2
- **What it does:** Notifies all confirmed ticket holders for the event (console log per customer)

Both queues are configured with:
- **3 retry attempts** on failure
- **Exponential backoff** (3s base delay)
- Auto-cleanup of completed/failed jobs

---

## Concurrency & Race Conditions

Ticket booking uses a **MongoDB atomic operation** to prevent overselling:

```js
Event.findOneAndUpdate(
  { _id: eventId, remainingTickets: { $gte: quantity } },
  { $inc: { remainingTickets: -quantity } },
  { new: true, session }
)
```

If `remainingTickets` is insufficient, the update finds no document and the booking is rejected — even under concurrent requests. The entire booking flow runs inside a **Mongoose session/transaction**.

---

## Development Notes

- In `development`, workers run in the same process as the server (convenient for local dev).
- In `production`, run `npm run worker` as a **separate process** (or a separate container/dyno) so the API server and job processing scale independently.
- Passwords are **never returned** in any response (`select: false` on the schema).
- All protected routes expect: `Authorization: Bearer <token>`.
