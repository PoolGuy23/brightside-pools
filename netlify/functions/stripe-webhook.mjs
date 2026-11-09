// POST /api/stripe-webhook — Stripe calls this when a deposit is paid.
// The payment's client_reference_id is the booking number, which links it to the booking held earlier.
import crypto from "node:crypto";
import { store, json, env, bookingToJob, localStamp } from "../../lib/common.mjs";

function verify(raw, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=")).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const sigs = header.split(",").filter((p) => p.trim().startsWith("v1=")).map((p) => p.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 600) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const raw = await req.text();
  if (!verify(raw, req.headers.get("stripe-signature"), env("STRIPE_WEBHOOK_SECRET"))) return json({ error: "Signature check failed." }, 400);
  const event = JSON.parse(raw);
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return json({ ignored: event.type });
  const s = event.data?.object || {};
  if (s.payment_status !== "paid") return json({ ignored: "not paid yet" });

  const db = store();
  const bookingId = String(s.client_reference_id || "").slice(0, 20);
  const jobKey = "jobs/web-" + (bookingId || s.id);
  if (await db.get(jobKey, { type: "json" })) return json({ ok: true, duplicate: true });   // Stripe can send an event twice

  const paidAt = (s.created || event.created || Date.now() / 1000) * 1000;
  const extra = { received: localStamp(Date.now()), stripeSession: s.id, depositCents: s.amount_total ?? null, paidAt: new Date(paidAt).toISOString() };
  const held = bookingId ? await db.get("pending/" + bookingId, { type: "json" }) : null;
  let job;
  if (held) {
    job = bookingToJob(held, extra);
    await db.delete("pending/" + bookingId);
  } else {
    // Paid, but the booking details never arrived (closed tab, ad blocker, etc.). Keep what Stripe knows.
    const c = s.customer_details || {};
    job = { name: c.name || "Website customer", email: c.email || "", phone: c.phone || "", job: "Other", shape: "", size: "", deck: "No deck", addons: [],
      address: [c.address?.line1, c.address?.city].filter(Boolean).join(", "), zip: (c.address?.postal_code || "").slice(0, 5), bookingId,
      notes: "Paid deposit, but the booking details didn't come through. Contact the customer to get their pool details.",
      status: "waiting", created: Date.now(), source: "website", detailsMissing: true, ...extra };
  }
  await db.setJSON(jobKey, job);
  return json({ ok: true });
};

export const config = { path: "/api/stripe-webhook" };
