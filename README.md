# Brightside Pools website

- `site/index.html`: the public website (brightsidepools.netlify.app)
- `site/jobs/index.html`: the private job list (brightsidepools.netlify.app/jobs), password protected
- `netlify/functions/`: server functions
  - `booking-hold`: saves a booking when the customer heads to Stripe
  - `stripe-webhook`: Stripe calls this when a deposit is paid; the booking becomes a job
  - `service-request`: pool openings and closings (no deposit) go straight onto the list
  - `admin-login`, `admin-jobs`: sign-in and data for the job list
- Data is kept in Netlify Blobs (store name `brightside`).

## Settings to add in Netlify (Site configuration → Environment variables)

| Name | Value |
| --- | --- |
| `ADMIN_PASSWORD` | The password you'll use to open the job list |
| `TOKEN_SECRET` | Any long random text (keeps sign-ins secure) |
| `STRIPE_WEBHOOK_SECRET` | The signing secret Stripe shows for the webhook (starts with `whsec_`) |

## Stripe webhook

Stripe Dashboard → Developers → Webhooks → Add endpoint
- URL: `https://brightsidepools.netlify.app/api/stripe-webhook`
- Event: `checkout.session.completed`
