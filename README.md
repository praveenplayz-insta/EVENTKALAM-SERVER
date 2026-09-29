# EventKalam API

Express REST server for EventKalam. Uses Supabase as the database (via the service role
key, server-side only), Razorpay for payments, and SMTP for email notifications.

## Setup
```
npm install
cp .env.example .env   # fill in all values
npm start
```

## Endpoints
| Method | Endpoint | Access |
|---|---|---|
| GET | /api/events | public |
| GET | /api/events/:id | public |
| POST/PUT/DELETE | /api/events(/:id) | admin |
| POST | /api/registrations `{eventId}` | logged-in user |
| POST | /api/payments/verify | logged-in user |
| GET | /api/admin/registrations/export | admin |

## Required Supabase migration
Run this once in the Supabase SQL Editor before using this server:
```sql
alter table registrations add column if not exists order_id text;
alter table registrations add column if not exists payment_id text;
drop function if exists mock_pay(uuid); -- payments are now verified here, not by a client-callable function
```
