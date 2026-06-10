# contentful-slug-redirects

A Next.js example showing how to handle URL redirects when Contentful slugs change — using a combination of a **Redirect content type** (editor-managed) and **automatic slug-change detection** via Contentful Entry Snapshots.

> **Disclaimer:** Contentful provides this sample code solely to demonstrate a technical scenario. Any and all sample code provided by Contentful is not intended for production use. Contentful is not responsible for maintaining or supporting this sample code after it has been provided to you.

---

## Two-layer approach

Relying on editors to always create a Redirect entry when they change a slug is a process dependency — authors will forget. This example uses both layers:

| Layer | What it does | Who controls it |
|---|---|---|
| **Redirect content type** | Explicit `from → to` entries editors create intentionally | Content authors |
| **Auto slug-change detection** | Detects slug changes on publish by comparing against the previous Entry Snapshot; auto-writes the redirect | Automatic (no author action needed) |

Both layers write to the same redirect store. Next.js middleware applies all rules at the edge.

---

## How it works

```
Any entry published in Contentful
        ↓
Contentful fires webhook → /api/webhooks/contentful
        ↓
  ┌─────────────────────────────────────────────────┐
  │ Is it a "redirect" content type?                │
  │   → Yes: write editor's explicit from/to rule   │
  │   → No:  is it a watched content type?          │
  │          → Fetch previous snapshot via CMA      │
  │          → Compare old slug vs new slug         │
  │          → If changed: auto-write redirect      │
  └─────────────────────────────────────────────────┘
        ↓
Next.js middleware reads store, issues 308/307 at the edge
```

---

## Content model

Create a **Redirect** content type in Contentful with these fields:

| Field | Type | Notes |
|---|---|---|
| `from` | Short text | e.g. `/old-slug` — must start with `/` |
| `to` | Short text | e.g. `/new-slug` or `https://external.com/path` |
| `isPermanent` | Boolean | 308 if true, 307 if false |

See `migration/redirect-content-type.js` for a ready-to-run migration.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `CONTENTFUL_WEBHOOK_SECRET` | Yes | Shared secret set on the Contentful webhook |
| `NEXT_PUBLIC_BASE_URL` | Yes | Your app's base URL (e.g. `https://your-app.vercel.app`) |
| `CONTENTFUL_SPACE_ID` | For auto-detection | Your Contentful space ID |
| `CONTENTFUL_CMA_TOKEN` | For auto-detection | CMA token with read access to snapshots |
| `CONTENTFUL_ENVIRONMENT_ID` | For auto-detection | Defaults to `master` |
| `CONTENTFUL_SLUG_FIELD_ID` | Optional | Field ID containing the slug. Defaults to `slug` |
| `CONTENTFUL_SLUG_LOCALE` | Optional | Locale code. Defaults to `en-US` |
| `CONTENTFUL_SLUG_PATH_PREFIX` | Optional | Path prefix, e.g. `/blog`. Defaults to `""` |

### 3. Run the content model migration

```bash
npx contentful-migration --space-id YOUR_SPACE_ID \
  --access-token YOUR_CMA_TOKEN \
  migration/redirect-content-type.js
```

### 4. Configure the Contentful webhook

In Contentful: **Settings → Webhooks → Add Webhook**

- **URL:** `https://your-app.vercel.app/api/webhooks/contentful`
- **Triggers:** Entry → Publish **and** Entry → Unpublish
- **Filters:** None (the handler filters internally) — or narrow to specific content types
- **Headers:** Add `x-contentful-webhook-secret: <your-secret>`

### 5. Configure watched content types

In `src/pages/api/webhooks/contentful.js`, update `SLUG_CHANGE_CONTENT_TYPES` to match the content type IDs in your space that have a slug field:

```js
const SLUG_CHANGE_CONTENT_TYPES = ["blogPost", "page", "article"];
```

### 6. Run locally

```bash
npm run dev
```

---

## Production considerations

| Concern | Recommendation |
|---|---|
| **Redirect store** | Replace the JSON file store in `src/lib/redirectStore.js` with Vercel KV, Redis, or a database — file-based storage does not work across serverless instances |
| **Middleware fetch** | For high-traffic sites, read from a KV store directly in middleware rather than making an internal API call on every request |
| **Redirect chains** | The store automatically collapses chains: if `a→b` exists and `b→c` is added, `a` is updated to point to `c` |
| **CMA token scope** | The CMA token only needs read access to entries and snapshots — use a scoped Personal Access Token |
| **Cache invalidation** | Consider also calling `revalidatePath` for the old slug so any cached page is purged alongside the redirect |
| **Status codes** | 308 (permanent) for slug renames; 307 (temporary) for seasonal or A/B redirects |

---

## File overview

```
src/
  lib/
    redirectStore.js          # Read/write redirect rules (swap for KV in production)
    contentfulSnapshots.js    # Fetches previous published snapshot to detect slug changes
  pages/
    api/
      webhooks/
        contentful.js         # Webhook receiver — handles both redirect entries and auto-detection
      redirects.js            # Redirect lookup endpoint called by middleware
middleware.js                 # Next.js middleware — applies redirects at the edge
migration/
  redirect-content-type.js   # Contentful migration: creates the Redirect content type
.env.example
```
