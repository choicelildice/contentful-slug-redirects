// Fetches the most recently published snapshot of a Contentful entry using the CMA.
// Used to detect slug changes: compare the incoming slug against the last published slug.
//
// Requires CONTENTFUL_SPACE_ID and CONTENTFUL_CMA_TOKEN environment variables.
//
// Contentful provides this sample code solely to demonstrate a technical scenario.
// Any and all sample code provided by Contentful is not intended for production use.
// Contentful is not responsible for maintaining or supporting this sample code.

const CMA_BASE = "https://api.contentful.com";

/**
 * Returns the slug from the most recently published snapshot of an entry,
 * or null if no prior snapshot exists.
 *
 * @param {string} entryId
 * @param {string} slugFieldId - the field ID that holds the slug (e.g. "slug")
 * @param {string} locale - e.g. "en-US"
 */
export async function getPreviousSlug(entryId, slugFieldId = "slug", locale = "en-US") {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const environmentId = process.env.CONTENTFUL_ENVIRONMENT_ID ?? "master";
  const cmaToken = process.env.CONTENTFUL_CMA_TOKEN;

  if (!spaceId || !cmaToken) {
    console.warn("CONTENTFUL_SPACE_ID or CONTENTFUL_CMA_TOKEN not set — skipping snapshot check");
    return null;
  }

  const url = `${CMA_BASE}/spaces/${spaceId}/environments/${environmentId}/entries/${entryId}/snapshots?limit=2`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cmaToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    console.error(`Snapshot fetch failed: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();

  // Snapshots are ordered newest-first. Index 0 is the snapshot just created by
  // this publish. Index 1 is the previous published state — that's what we want.
  const previousSnapshot = data?.items?.[1];
  if (!previousSnapshot) return null;

  const fieldObj = previousSnapshot?.snapshot?.fields?.[slugFieldId];
  if (!fieldObj) return null;

  return fieldObj[locale] ?? Object.values(fieldObj)[0] ?? null;
}
