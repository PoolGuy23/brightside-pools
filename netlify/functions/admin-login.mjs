// POST /api/admin/login — trade the owner's password (ADMIN_PASSWORD) for a 30-day sign-in token.
import { json, env, makeToken, samePassword } from "../../lib/common.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!env("ADMIN_PASSWORD") || !env("TOKEN_SECRET")) return json({ error: "The job list password hasn't been set up in Netlify yet." }, 500);
  let body = {}; try { body = await req.json(); } catch {}
  await new Promise((r) => setTimeout(r, 400));                       // slow down password guessing
  if (!samePassword(body.password || "", env("ADMIN_PASSWORD"))) return json({ error: "That password isn't right." }, 401);
  return json({ token: makeToken() });
};

export const config = { path: "/api/admin/login" };
