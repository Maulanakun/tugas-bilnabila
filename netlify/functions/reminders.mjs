/* Netlify Scheduled Function: tiap 5 menit memeriksa pengingat yang jatuh tempo lalu mengirim email.
   Hanya berjalan pada deploy produksi (published deploy). */
import { runReminders } from "../../src/reminders.js";
import { createBlobStorage } from "../../src/storage-blobs.js";

export default async () => {
  const r = await runReminders({ storage: await createBlobStorage(), env: process.env });
  console.log("[reminders]", JSON.stringify(r));
};

export const config = { schedule: "*/5 * * * *" };
