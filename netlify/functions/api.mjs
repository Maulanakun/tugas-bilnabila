/* Netlify Function (v2) untuk semua rute /api/*. Database JSON disimpan di Netlify Blobs. */
import { createHandler } from "../../src/api.js";
import { createBlobStorage } from "../../src/storage-blobs.js";

let handler;
const getHandler = async () => (handler ||= createHandler({ storage: await createBlobStorage(), env: process.env }));

export default async (req) => {
  const url = new URL(req.url);
  const body = ["GET", "HEAD"].includes(req.method) ? "" : await req.text();
  const r = await (await getHandler())({
    method: req.method,
    path: url.pathname,
    query: url.searchParams,
    headers: Object.fromEntries(req.headers),
    body,
  });
  return new Response(r.body, { status: r.status, headers: r.headers });
};

export const config = { path: "/api/*" };
