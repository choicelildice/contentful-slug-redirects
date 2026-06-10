#!/usr/bin/env node
// Manual webhook test script.
// Sends example payloads to the local webhook endpoint and reports pass/fail.
//
// Usage:
//   1. Start the dev server:  npm run dev
//   2. In another terminal:   node scripts/test-webhook.js
//
// All three scenarios run without real Contentful credentials.
// Case 3 uses MOCK_PREVIOUS_SLUG to simulate a prior published slug —
// with real credentials, remove that env var and the handler will call the CMA.
//
// Contentful provides this sample code solely to demonstrate a technical scenario.
// Any and all sample code provided by Contentful is not intended for production use.
// Contentful is not responsible for maintaining or supporting this sample code.

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const WEBHOOK_SECRET = process.env.CONTENTFUL_WEBHOOK_SECRET ?? "test-secret";
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/contentful`;
const REDIRECTS_URL = `${BASE_URL}/api/redirects`;

let passed = 0;
let failed = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function sendWebhook(topic, body) {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-contentful-webhook-secret": WEBHOOK_SECRET,
      "x-contentful-topic": topic,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function checkRedirect(path) {
  const res = await fetch(`${REDIRECTS_URL}?path=${encodeURIComponent(path)}`);
  return res.json();
}

// --- Scenario 1: Redirect entry publish ---
async function testRedirectEntryPublish() {
  console.log("\nScenario 1: Redirect entry publish");

  const payload = {
    sys: {
      id: "entry-redirect-1",
      contentType: { sys: { id: "redirect" } },
    },
    fields: {
      from: { "en-US": "/old-page" },
      to: { "en-US": "/new-page" },
      isPermanent: { "en-US": true },
    },
  };

  const { status, body } = await sendWebhook("ContentManagement.Entry.publish", payload);
  assert("webhook returns 200", status === 200, `got ${status}`);
  assert("action is 'added'", body.action === "added", JSON.stringify(body));

  const rule = await checkRedirect("/old-page");
  assert("redirect rule written to store", rule?.to === "/new-page", JSON.stringify(rule));
  assert("isPermanent is true", rule?.isPermanent === true);
}

// --- Scenario 2: Redirect entry unpublish ---
async function testRedirectEntryUnpublish() {
  console.log("\nScenario 2: Redirect entry unpublish");

  const payload = {
    sys: {
      id: "entry-redirect-1",
      contentType: { sys: { id: "redirect" } },
    },
    fields: {
      from: { "en-US": "/old-page" },
      to: { "en-US": "/new-page" },
      isPermanent: { "en-US": true },
    },
  };

  const { status, body } = await sendWebhook("ContentManagement.Entry.unpublish", payload);
  assert("webhook returns 200", status === 200, `got ${status}`);
  assert("action is 'removed'", body.action === "removed", JSON.stringify(body));

  const rule = await checkRedirect("/old-page");
  assert("redirect rule removed from store", rule === null || rule?.to == null);
}

// --- Scenario 3: Auto slug-change detection (mock mode) ---
async function testSlugChangeDetection() {
  console.log("\nScenario 3: Auto slug-change detection (mock CMA — no credentials needed)");
  console.log("  Note: set MOCK_PREVIOUS_SLUG in .env.local to control the simulated old slug.");
  console.log("  Remove MOCK_PREVIOUS_SLUG to use real CMA credentials instead.\n");

  // The handler will call getPreviousSlug, which reads MOCK_PREVIOUS_SLUG from env.
  // The dev server must have MOCK_PREVIOUS_SLUG=old-blog-post set in .env.local.
  const mockPreviousSlug = process.env.MOCK_PREVIOUS_SLUG ?? "old-blog-post";
  const newSlug = "new-blog-post";

  const payload = {
    sys: {
      id: "entry-blog-1",
      contentType: { sys: { id: "blogPost" } },
    },
    fields: {
      slug: { "en-US": newSlug },
      title: { "en-US": "My Updated Blog Post" },
    },
  };

  const { status, body } = await sendWebhook("ContentManagement.Entry.publish", payload);
  assert("webhook returns 200", status === 200, `got ${status}`);

  if (body.skipped) {
    console.log(
      `  ⚠ Handler skipped (${body.skipped}). Make sure MOCK_PREVIOUS_SLUG=${mockPreviousSlug} is set in the dev server's .env.local`
    );
    failed++;
    return;
  }

  assert("action is 'auto-redirect'", body.action === "auto-redirect", JSON.stringify(body));

  const expectedFrom = `/${mockPreviousSlug}`;
  const rule = await checkRedirect(expectedFrom);
  assert(`redirect from ${expectedFrom} written`, rule?.to === `/${newSlug}`, JSON.stringify(rule));
  assert("isPermanent is true", rule?.isPermanent === true);
}

// --- Scenario 4: Wrong secret is rejected ---
async function testBadSecret() {
  console.log("\nScenario 4: Bad webhook secret is rejected");

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-contentful-webhook-secret": "wrong-secret",
      "x-contentful-topic": "ContentManagement.Entry.publish",
    },
    body: JSON.stringify({ sys: { id: "x", contentType: { sys: { id: "redirect" } } } }),
  });
  assert("returns 401", res.status === 401, `got ${res.status}`);
}

// --- Run all ---
(async () => {
  console.log(`Sending test payloads to ${WEBHOOK_URL}`);
  console.log("Make sure the dev server is running: npm run dev\n");

  try {
    await testRedirectEntryPublish();
    await testRedirectEntryUnpublish();
    await testSlugChangeDetection();
    await testBadSecret();
  } catch (err) {
    console.error("\nUnexpected error — is the dev server running?");
    console.error(err.message);
    process.exit(1);
  }

  console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
