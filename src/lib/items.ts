export type QueueItem = { id: string; name: string; url: string };
export function validateItem(value: { name: string; url: string }) {
  const name = value.name.trim();
  const url = value.url.trim();
  if (!name || name.length > 160)
    throw new Error("Give the item a name of 1–160 characters.");
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Use a complete https:// or http:// link.");
    }
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      url.length > 1000
    )
      throw new Error(
        "Use a web link without embedded credentials, up to 1,000 characters.",
      );
  }
  return { name, url };
}
