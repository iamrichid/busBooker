# Church Bus Booker

A lightweight booking and approval system for a church with one shared bus, now structured to deploy on Vercel.

## What it does

- Allows both members and outside parties to request the bus
- Requires a membership number only when the requester is a church member
- Supports booking date ranges (`fromDate` to `toDate`)
- Stores requests durably in Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set
- Falls back to local storage in `data/bookings.json` during local development
- Lets admins assign an available bus before approving a request
- Gives admins a simple approval screen at `/admin`
- Uses signed `httpOnly` admin session cookies (no admin code stored in browser)
- Sends optional email notifications with Resend
- Sends optional SMS notifications with Twilio

## Run it

1. Copy `.env.example` to `.env`
2. Change `ADMIN_ACCESS_CODE` to something private
3. Set `ADMIN_SESSION_SECRET` to a long random value
4. Install dependencies:

```bash
npm install
```

5. Start the app:

```bash
npm start
```

6. Open [http://localhost:3000](http://localhost:3000)
7. Open [http://localhost:3000/admin](http://localhost:3000/admin) for approvals

## Deploy to Vercel

1. Create a Vercel Blob store for the project
2. Add the project environment variables in Vercel:

```bash
ADMIN_ACCESS_CODE=your-private-admin-code
ADMIN_SESSION_SECRET=your-long-random-session-secret
BLOB_READ_WRITE_TOKEN=your-vercel-blob-read-write-token
BUS_FLEET=Church Bus|PCG-001
NOTIFICATION_FROM_EMAIL=transport@yourchurch.org
RESEND_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=...
```

3. Deploy with Vercel

```bash
vercel
```

The project is already arranged for Vercel:

- Static pages are served from root-level HTML, CSS, JS, and SVG files
- API endpoints live under `api/`
- `vercel.json` enables clean URLs so `/admin` maps to `admin.html`

## Scripts

```bash
npm start
npm run dev
npm test
```

## Notification setup

Email:

- Set `NOTIFICATION_FROM_EMAIL`
- Set `RESEND_API_KEY`

SMS:

- Set `TWILIO_ACCOUNT_SID`
- Set `TWILIO_AUTH_TOKEN`
- Set `TWILIO_FROM_NUMBER`

If notification credentials are not configured, the app still works and logs skipped notification attempts to `data/notifications.log`.

## Notes

- Admin sign-in now creates a signed `httpOnly` session cookie that protects `/admin` APIs.
- Keep both `ADMIN_ACCESS_CODE` and `ADMIN_SESSION_SECRET` private in environment variables.
- The public booking form supports members and outside parties; membership number is required only for members.
- Ghana phone numbers are validated as 10 digits.
- A request can only be approved after an available bus has been assigned.
- Conflict checks use date ranges plus slot overlap rules.
- On Vercel, each booking is stored as a private JSON blob version so updates stay durable without depending on the function filesystem.
- For a low-volume church workflow, Blob storage is a practical lightweight option, but it is still object storage, not a relational database.
