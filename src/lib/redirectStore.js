// Redirect store — reads and writes redirect rules to a local JSON file.
//
// THIS IS FOR DEMONSTRATION ONLY. File-based storage does not work across
// serverless function instances or deployments. Replace with Vercel KV,
// Redis, or a database before using in any real environment.
//
// Contentful provides this sample code solely to demonstrate a technical scenario.
// Any and all sample code provided by Contentful is not intended for production use.
// Contentful is not responsible for maintaining or supporting this sample code.

import fs from "fs/promises";
import path from "path";

const REDIRECTS_FILE = path.resolve("data/redirects.json");

async function readRedirects() {
  try {
    return JSON.parse(await fs.readFile(REDIRECTS_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function writeRedirects(data) {
  await fs.mkdir(path.dirname(REDIRECTS_FILE), { recursive: true });
  await fs.writeFile(REDIRECTS_FILE, JSON.stringify(data, null, 2));
}

export async function addRedirect({ from, to, isPermanent = true }) {
  const redirects = await readRedirects();

  // Collapse chains: if anything currently points to `from`, update it to point to `to`
  for (const [existingFrom, rule] of Object.entries(redirects)) {
    if (rule.to === from) {
      redirects[existingFrom] = { to, isPermanent: rule.isPermanent };
    }
  }

  redirects[from] = { to, isPermanent };
  await writeRedirects(redirects);
}

export async function removeRedirect(from) {
  const redirects = await readRedirects();
  delete redirects[from];
  await writeRedirects(redirects);
}

export async function getRedirect(path) {
  const redirects = await readRedirects();
  return redirects[path] ?? null;
}

export async function getAllRedirects() {
  return readRedirects();
}
