// /api/admin/jobs — the private job list's data. Every request needs the sign-in token.
//   GET               all jobs and settings
//   POST              add a job (body = job)
//   PATCH  ?id=...    change fields on a job (null removes a field)
//   PUT    ?id=...    replace a job
//   DELETE ?id=...    delete a job
//   PUT    ?settings  save settings
import { store, json, checkToken, newId } from "../../lib/common.mjs";

const ID = /^[A-Za-z0-9_\-.~:@+]{1,80}$/;

export default async (req) => {
  if (!checkToken(req)) return json({ error: "Please sign in." }, 401);
  const db = store(), url = new URL(req.url), id = url.searchParams.get("id");
  if (req.method === "GET") {
    const { blobs } = await db.list({ prefix: "jobs/" });
    const jobs = (await Promise.all(blobs.map(async (b) => ({ id: b.key.slice(5), data: await db.get(b.key, { type: "json" }) }))))
      .filter((j) => j.data);
    const settings = (await db.get("settings/main", { type: "json" })) || null;
    return json({ jobs, settings });
  }
  let body = {};
  if (req.method !== "DELETE") { try { body = await req.json(); } catch { return json({ error: "Body wasn't valid JSON." }, 400); } }
  if (JSON.stringify(body).length > 50000) return json({ error: "Too large." }, 413);
  if (url.searchParams.has("settings") && req.method === "PUT") { await db.setJSON("settings/main", body); return json({ ok: true }); }
  if (req.method === "POST") { const nid = newId(); await db.setJSON("jobs/" + nid, body); return json({ ok: true, id: nid }); }
  if (!id || !ID.test(id)) return json({ error: "Missing job id." }, 400);
  const key = "jobs/" + id;
  if (req.method === "PUT") { await db.setJSON(key, body); return json({ ok: true }); }
  if (req.method === "PATCH") {
    const cur = await db.get(key, { type: "json" }); if (!cur) return json({ error: "Job not found." }, 404);
    for (const [k, v] of Object.entries(body)) { if (v === null) delete cur[k]; else cur[k] = v; }
    await db.setJSON(key, cur); return json({ ok: true });
  }
  if (req.method === "DELETE") { await db.delete(key); return json({ ok: true }); }
  return json({ error: "Not supported." }, 405);
};

export const config = { path: "/api/admin/jobs" };
