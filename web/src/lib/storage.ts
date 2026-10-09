import { get, put } from "@vercel/blob";

const PREFIX = "searches/";
const ID_PATTERN = /^[0-9a-f-]{36}$/i;

export function isValidSearchId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export async function saveSearch(record: Record<string, unknown>): Promise<string> {
  const id = crypto.randomUUID();
  const body = JSON.stringify({ id, ...record, created_at: new Date().toISOString() });
  await put(`${PREFIX}${id}.json`, body, {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
  });
  return id;
}

export async function loadSearch(id: string): Promise<Record<string, unknown> | null> {
  if (!isValidSearchId(id)) return null;
  const blob = await get(`${PREFIX}${id}.json`, { access: "private" });
  if (!blob || blob.statusCode !== 200) return null;
  return JSON.parse(await new Response(blob.stream).text());
}
