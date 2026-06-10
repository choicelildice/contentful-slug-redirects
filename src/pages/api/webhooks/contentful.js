// Contentful webhook receiver.
// Fires when a Redirect entry is published or unpublished.
// Validates the shared secret, then writes or removes the redirect rule.
//
// Contentful provides this sample code solely to demonstrate a technical scenario.
// Any and all sample code provided by Contentful is not intended for production use.
// Contentful is not responsible for maintaining or supporting this sample code.

import { addRedirect, removeRedirect } from "@/lib/redirectStore";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const incomingSecret = req.headers["x-contentful-webhook-secret"];
  if (incomingSecret !== process.env.CONTENTFUL_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const topic = req.headers["x-contentful-topic"] ?? "";
  const entry = req.body;
  const contentTypeId = entry?.sys?.contentType?.sys?.id;

  // Only process Redirect entries
  if (contentTypeId !== "redirect") {
    return res.status(200).json({ skipped: true });
  }

  // Locale-aware field extraction: use the first locale key present if en-US is absent
  function getField(fieldObj) {
    if (!fieldObj) return null;
    return fieldObj["en-US"] ?? Object.values(fieldObj)[0] ?? null;
  }

  const from = getField(entry?.fields?.from);
  const to = getField(entry?.fields?.to);
  const isPermanent = getField(entry?.fields?.isPermanent) ?? true;

  if (!from) {
    return res.status(400).json({ error: "Missing 'from' field" });
  }

  if (topic.endsWith("Entry.unpublish")) {
    await removeRedirect(from);
    return res.status(200).json({ removed: from });
  }

  if (!to) {
    return res.status(400).json({ error: "Missing 'to' field" });
  }

  await addRedirect({ from, to, isPermanent });
  return res.status(200).json({ added: { from, to, isPermanent } });
}
