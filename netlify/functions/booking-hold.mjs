// POST /api/booking-hold — the website saves a booking here right before the customer goes to Stripe.
// It only becomes a job once Stripe confirms the $250 deposit (see stripe-webhook.mjs).
import { store, json, cleanBooking, BOOKING_ID } from "../../lib/common.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const text = await req.text();
  if (text.length > 20000) return json({ error: "Booking is too large." }, 413);
  let body; try { body = JSON.parse(text); } catch { return json({ error: "Booking wasn't valid JSON." }, 400); }
  if (body.website) return json({ ok: true });                       // spam trap field
  const b = cleanBooking(body);
  if (!BOOKING_ID.test(b.bookingId)) return json({ error: "Missing booking number." }, 400);
  if (!b.name || !b.job) return json({ error: "Missing name or job." }, 400);
  await store().setJSON("pending/" + b.bookingId, { ...b, heldAt: Date.now() });
  return json({ ok: true });
};

export const config = { path: "/api/booking-hold" };
