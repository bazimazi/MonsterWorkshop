export async function loadJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Content could not load (${response.status}): ${url}`);
  return response.json() as Promise<unknown>;
}
