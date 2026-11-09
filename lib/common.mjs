// Shared helpers for the Brightside Pools functions.
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

// One store holds everything: jobs/<id>, pending/<bookingId>, settings/main.
export function store() {
  if (globalThis.__TEST_STORE__) return globalThis.__TEST_STORE__;
  return getStore({ name: "brightside", consistency: "strong" });
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const env = (k) => (globalThis.__TEST_ENV__ && globalThis.__TEST_ENV__[k]) ?? (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k];
export { env };

// ---- admin sign-in: a token signed with TOKEN_SECRET, valid for 30 days ----
export function makeToken() {
  const exp = Date.now() + 30 * 24 * 3600 * 1000;
  const sig = crypto.createHmac("sha256", env("TOKEN_SECRET")).update(String(exp)).digest("hex");
  return exp + "." + sig;
}
export function checkToken(req) {
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [exp, sig] = tok.split(".");
  if (!exp || !sig || !env("TOKEN_SECRET") || Number(exp) < Date.now()) return false;
  const good = crypto.createHmac("sha256", env("TOKEN_SECRET")).update(String(exp)).digest("hex");
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
export function samePassword(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

// ---- turning a booking from the website into a job record ----
const clip = (v, n = 300) => String(v ?? "").slice(0, n).trim();
export const BOOKING_ID = /^BSP-\d{6}-[A-Z0-9]{4}$/;
export function cleanBooking(b) {
  const addons = Array.isArray(b.addons) ? b.addons.map((x) => clip(x, 40)).filter(Boolean).slice(0, 10) : [];
  return {
    bookingId: clip(b.bookingId, 20), job: clip(b.job, 60), shape: clip(b.shape, 10), size: clip(b.size, 12),
    deck: clip(b.deck, 40), deckNotes: clip(b.deckNotes, 600), addons,
    existingPool: clip(b.existingPool, 80), teardownShape: clip(b.teardownShape, 10), teardownSize: clip(b.teardownSize, 12),
    name: clip(b.name, 100), phone: clip(b.phone, 30), email: clip(b.email, 120),
    street: clip(b.street, 150), city: clip(b.city, 80), zip: clip(b.zip, 10), county: clip(b.county, 30),
    notes: clip(b.notes, 1000), estimate: clip(b.estimate, 120),
  };
}
export function bookingToJob(b, extra = {}) {
  const notes = [
    b.existingPool && b.existingPool !== "No existing pool" && !b.teardownShape ? "Existing pool: " + b.existingPool : null,
    b.deckNotes ? "Deck notes: " + b.deckNotes : null,
    b.county ? b.county + " County" : null,
    b.notes && b.notes !== "None" ? "Notes: " + b.notes : null,
    b.estimate ? "Website estimate: " + b.estimate : null,
  ].filter(Boolean).join(" · ");
  const job = {
    name: b.name || "Website customer", phone: b.phone, email: b.email,
    job: b.job || "Other", shape: b.shape, size: b.size, deck: b.deck || "No deck", addons: b.addons || [],
    address: [b.street, b.city].filter(Boolean).join(", "), zip: b.zip, bookingId: b.bookingId,
    notes, status: "waiting", created: Date.now(), source: "website", ...extra,
  };
  if (b.teardownShape && b.teardownSize) { job.teardownShape = b.teardownShape; job.teardownSize = b.teardownSize; }
  return job;
}
// Local date-time text for the "deposit received" column (America/Detroit).
export function localStamp(ms) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date(ms)).reduce((a, p) => (a[p.type] = p.value, a), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
}
export const newId = () => crypto.randomBytes(9).toString("base64url");
