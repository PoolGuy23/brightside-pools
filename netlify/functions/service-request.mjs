// POST /api/service-request — pool openings and closings (no deposit) go straight onto the job list.
import { store, json, cleanBooking, bookingToJob, localStamp, BOOKING_ID, notifyPhone } from "../../lib/common.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const text = await req.text();
  if (text.length > 20000) return json({ error: "Request is too large." }, 413);
  let body; try { body = JSON.parse(text); } catch { return json({ error: "Request wasn't valid JSON." }, 400); }
  if (body.website) return json({ ok: true });                       // spam trap field
  const b = cleanBooking(body);
  if (!BOOKING_ID.test(b.bookingId) || !b.name) return json({ error: "Missing booking number or name." }, 400);
  if (b.job !== "Pool opening" && b.job !== "Pool closing") return json({ error: "Only openings and closings can be requested without a deposit." }, 400);
  const db = store(), key = "jobs/web-" + b.bookingId;
  if (await db.get(key, { type: "json" })) return json({ ok: true, duplicate: true });
  const job = bookingToJob(b, { received: localStamp(Date.now()), noDeposit: true });
  await db.setJSON(key, job);
  await notifyPhone(job, "New " + (b.job === "Pool opening" ? "opening" : "closing") + " request");
  return json({ ok: true });
};

export const config = { path: "/api/service-request" };
