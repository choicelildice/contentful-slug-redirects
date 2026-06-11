// Redirect lookup endpoint called by Next.js middleware.
// Returns the destination and status code for a given path, or null.
//
// Contentful provides this sample code solely to demonstrate a technical scenario.
// Any and all sample code provided by Contentful is not intended for production use.
// Contentful is not responsible for maintaining or supporting this sample code.

import { getRedirect } from "@/lib/redirectStore";

export default async function handler(req, res) {
  const { path } = req.query;

  if (!path) return res.status(400).json({ error: "Missing path param" });

  const rule = await getRedirect(path);
  return res.status(200).json(rule ?? null);
}
