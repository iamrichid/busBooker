# Church Bus Booker

A Next.js booking and workflow app for church transport requests, with separate public, admin, and finance desks and Vercel-ready deployment.

## What it does

- Accepts bus requests from members and outside parties
- Requires a membership number only for church members
- Supports date-range bookings with half-day or full-day scheduling
- Tracks each request with a public tracking code
- Lets admin review requests, move them to payment, and release buses
- Lets finance confirm payments before final release
- Stores data in Vercel Blob on deployment and `data/bookings.json` locally
- Sends optional email notifications with Resend
- Sends optional SMS notifications with cSMS
- Lets admin update notification contacts and desk sign-in settings from the app

## App routes

- `/` home page
- `/request` booking form
- `/availability` availability checker
- `/track` booking tracker
- `/admin` admin desk
- `/finance` finance desk
- `/api/*` route handlers for the workflow

## Local development

1. Copy `.env.example` to `.env`.
2. Set private values for:

```bash
ADMIN_ACCESS_CODE=your-private-admin-code
ADMIN_LOGIN_NAME=Transport Secretary
ADMIN_SESSION_SECRET=your-long-random-session-secret
FINANCE_ACCESS_CODE=your-private-finance-code
FINANCE_LOGIN_NAME=Finance Officer
FINANCE_SESSION_SECRET=your-long-random-finance-session-secret
```

3. Install dependencies:

```bash
npm install
```

4. Start the Next dev server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

For a production-style local run:

```bash
npm run build
npm start
```

## Environment variables

Storage and fleet:

```bash
BLOB_READ_WRITE_TOKEN=your-vercel-blob-read-write-token
BUS_FLEET=Church Bus|PCG-001
APP_BASE_URL=https://your-project.vercel.app
```

Notifications:

```bash
NOTIFICATION_FROM_EMAIL=transport@yourchurch.org
RESEND_API_KEY=...
CSMS_API_KEY=...
CSMS_SENDER_ID=YOUR_APPROVED_SENDER_ID
ADMIN_NOTIFICATION_PHONES=0241234567,0207654321
FINANCE_NOTIFICATION_PHONES=0551234567
```

## Deploy to Vercel

1. Create a Vercel Blob store for the project.
2. Add the required environment variables in Vercel Project Settings.
3. Deploy the Next app:

```bash
vercel
```

This repo now deploys as a standard Next.js App Router project on Vercel.

## Scripts

```bash
npm run dev
npm run build
npm start
npm test
```

## Notes

- Admin and finance APIs are protected by separate signed `httpOnly` session cookies.
- Desk names and access codes start from env defaults and can be changed later in the desk settings UI.
- If notification credentials are missing, the booking workflow still works and skipped attempts are logged to `data/notifications.log`.
- SMS delivery prefers cSMS and converts local Ghana numbers like `0241234567` to `233241234567` before sending.
- A request can only be released after finance confirms payment and admin assigns an available bus.
- On Vercel, booking data and settings are stored in Blob, which is practical for low-volume workflows but still not a relational database.
