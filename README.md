# Luma Server

This is the backend API for **Luma**, a salon appointment booking platform. It handles the core data and business logic for services, appointments, users, and payment confirmation, and it works alongside the Luma frontend.

It’s a straightforward Express + MongoDB server. Authentication is handled by verifying Better Auth session tokens from the database, so protected routes can trust the logged-in user and their role.

## What This Server Handles

- **Services** — create, list, view, update, and delete salon services.
- **Appointments** — create bookings, list appointments, update appointment status, and prevent double-booking the same active slot.
- **Users** — admin-only user listing and role updates.
- **Payments** — idempotent payment confirmation endpoint that records a transaction and marks the related appointment as paid.
- **Auth & access control** — bearer session token verification, admin/patron role checks, and banned-user blocking.

## Tech Stack

- **[Node.js](https://nodejs.org/)** + **[Express 5](https://expressjs.com/)**
- **[MongoDB](https://www.mongodb.com/)** (official Node driver)
- **[Stripe](https://stripe.com/)** package installed for payment-related workflow support
- **dotenv** for environment variables
- **CORS** enabled for cross-origin requests

## Project Structure

```text
Luma-server/
├── index.js          # Main server file (routes, auth middleware, DB connection)
├── package.json
├── vercel.json       # Vercel deployment config
└── .env              # Local environment variables (not committed)
```

## Getting Started

### What You’ll Need

- Node.js 20+ recommended
- npm
- A MongoDB database (the server connects to a MongoDB Atlas cluster using `DB_USER` and `DB_PASSWORD`)
- The Luma frontend, if you want to run the full app locally

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env` file in `Luma-server`:

```env
PORT=8000
DB_USER=your_mongodb_username
DB_PASSWORD=your_mongodb_password
```

> Keep your `.env` file private. Don’t commit real credentials.

### 3. Run the server

For development:

```bash
npm run dev
```

Or to start normally:

```bash
npm start
```

The server runs on `http://localhost:8000` by default (or whatever `PORT` you set).

## API Overview

Here’s a quick look at the main routes:

### Health
- `GET /` — simple server status message.

### Services
- `GET /services` — list services (supports query filters like status, category, adminId, search, sort).
- `GET /services/:id` — get a single service.
- `POST /services` — create a service *(admin, protected)*.
- `PATCH /services/:id` — update a service *(admin, protected)*.
- `DELETE /services/:id` — delete a service *(admin, protected)*.

### Appointments
- `POST /appointments` — create an appointment *(patron, protected)*.
- `GET /appointments` — list appointments *(protected; access depends on role/user)*.
- `PATCH /appointments/:id` — update appointment status/details *(protected)*.
- `DELETE /appointments/:id` — delete an appointment *(admin, protected)*.

### Users
- `GET /users` — list users *(admin, protected)*.
- `PATCH /users/:id/role` — update a user’s role *(admin, protected)*.

### Payments
- `POST /payments/confirm` — confirm a payment, store a transaction, and mark the appointment as paid. This endpoint is idempotent, so the same Stripe session won’t be processed twice.

## Authentication Notes

Protected routes expect:

```http
Authorization: Bearer <session_token>
```

The server checks the token against the Better Auth `session` collection, verifies expiry, finds the related user, and blocks banned users. Admin-only and patron-only routes are guarded by role checks.

## Deployment

This project includes a `vercel.json` for deploying to Vercel as a Node server.

Basic flow:
1. Push the backend to GitHub.
2. Import `Luma-server` in Vercel.
3. Add the required environment variables.
4. Deploy.

## Notes

- The database name used by the server is `luma`.
- There’s a unique index on active appointment slots to help prevent double bookings.
- CORS is currently enabled broadly with `cors()`, which is convenient for development; tighten it for stricter production setups if needed.

## Author

Built by **Akibullah Hasan** as part of the Luma salon booking platform.
