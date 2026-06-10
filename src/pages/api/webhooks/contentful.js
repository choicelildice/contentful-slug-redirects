// Contentful webhook receiver.
//
// Handles two cases:
//   1. Redirect entries — editor-managed explicit redirects (content type: "redirect")
//   2. Slug-change detection — auto-redirects when a slug field changes on any
//      content type listed in SLUG_CHANGE_CONTENT_TYPES
//
// Both write to the same redirect store, so all redirects are applied uniformly
// by the Next.js middleware.
//
// Contentful provides this sample code solely to demonstrate a technical scenario.
// Any and all sample code provided by Contentful is not intended for production use.
// Contentful is not responsible for maintaining or supporting this sample code.

import { addRedirect, removeRedirect } from "@/lib/redirectStore";
import { getPreviousSlug } from "@/lib/contentfulSnapshots";

// Content types that have a slug field and should trigger auto-redirect on slug change.
// Adjust to match your content model.
const SLUG_CHANGE_CONTENT_TYPES = ["blogPost", "page", "article"];

// The slug field ID and locale to inspect for auto-detection.
const SLUG_FIELD_ID = process.env.CONTENTFUL_SLUG_FIELD_ID ?? "slug";
const SLUG_LOCALE = process.env.CONTENTFUL_SLUG_LOCALE ?? "en-US";

// URL path prefix for auto-detected slug redirects, e.g. "/blog" → "/blog/old-slug"
// Set to "" if slugs are used at the root.
const SLUG_PATH_PREFIX = process.env.CONTENTFUL_SLUG_PATH_PREFIX ?? "";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const incomingSecret = req.headers["x-contentful-webhook-secret"];
  if (incomingSecret !== process.env.CONTENTFUL_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const topic = req.headers["x-contentful-topic"] ?? "";
  const entry = req.body;
  const entryId = entry?.sys?.id;
  const contentTypeId = entry?.sys?.contentType?.sys?.id;

  if (!entryId || !contentTypeId) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  // Extract a field value, falling back to the first locale present
  function getField(fieldObj) {
    if (!fieldObj) return null;
    return fieldObj[SLUG_LOCALE] ?? Object.values(fieldObj)[0] ?? null;
  }

  // --- Case 1: Editor-managed Redirect entry ---
  if (contentTypeId === "redirect") {
    const from = getField(entry?.fields?.from);
    const to = getField(entry?.fields?.to);
    const isPermanent = getField(entry?.fields?.isPermanent) ?? true;

    if (!from) return res.status(400).json({ error: "Missing 'from' field" });

    if (topic.endsWith("Entry.unpublish")) {
      await removeRedirect(from);
      return res.status(200).json({ action: "removed", from });
    }

    if (!to) return res.status(400).json({ error: "Missing 'to' field" });

    await addRedirect({ from, to, isPermanent });
    return res.status(200).json({ action: "added", from, to, isPermanent });
  }

  // --- Case 2: Auto-detect slug changes on watched content types ---
  if (topic.endsWith("Entry.publish") && SLUG_CHANGE_CONTENT_TYPES.includes(contentTypeId)) {
    const newSlug = getField(entry?.fields?.[SLUG_FIELD_ID]);
    if (!newSlug) return res.status(200).json({ skipped: "no slug field" });

    const previousSlug = await getPreviousSlug(entryId, SLUG_FIELD_ID, SLUG_LOCALE);

    if (previousSlug && previousSlug !== newSlug) {
      const from = `${SLUG_PATH_PREFIX}/${previousSlug}`;
      const to = `${SLUG_PATH_PREFIX}/${newSlug}`;
      await addRedirect({ from, to, isPermanent: true });
      return res.status(200).json({ action: "auto-redirect", from, to });
    }

    return res.status(200).json({ skipped: "slug unchanged or no prior snapshot" });
  }

  return res.status(200).json({ skipped: true });
}
