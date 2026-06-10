# contentful-slug-redirects

A Next.js example showing how to manage URL redirects when Contentful slugs change, using a dedicated **Redirect content type** and a webhook-driven handler.

> **Disclaimer:** Contentful provides this sample code solely to demonstrate a technical scenario. Any and all sample code provided by Contentful is not intended for production use. Contentful is not responsible for maintaining or supporting this sample code after it has been provided to you.

---

## How it works

The most robust approach is to treat redirects as **content** — not just an implementation detail. Editors create Redirect entries in Contentful whenever a slug changes. A webhook fires on publish and writes the redirect rule to your app's store. Next.js middleware applies it at the edge before any page renders.

```
Editor publishes Redirect entry in Contentful
        ↓
Contentful fires webhook → /api/webhooks/contentful
        ↓
Handler validates secret, writes { from → to } to redirect store
        ↓
Next.js middleware reads store, issues 308 redirect at the edge
```

This approach gives editors full control, keeps redirect history auditable in Contentful, and supports both slug-change and arbitrary path redirects.

---

## Content model

Create a **Redirect** content type in Contentful with these fields:

| Field      | Type         | Notes                          |
|------------|--------------|--------------------------------|
| `from`     | Short text   | e.g. `/old-slug`               |
| `to`       | Short text   | e.g. `/new-slug`               |
| `isPermanent` | Boolean   | 308 if true, 307 if false      |

See `migration/redirect-content-type.js` for a ready-to-run migration.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `CONTENTFUL_WEBHOOK_SECRET` | Shared secret set on the Contentful webhook |
| `NEXT_PUBLIC_BASE_URL` | Your app's base URL (e.g. `https://your-app.vercel.app`) |

### 3. Run the content model migration

```bash
npx contentful-migration --space-id YOUR_SPACE_ID \
  --access-token YOUR_CMA_TOKEN \
  migration/redirect-content-type.js
```

### 4. Configure the Contentful webhook

In Contentful: **Settings → Webhooks → Add Webhook**

- **URL:** `https://your-app.vercel.app/api/webhooks/contentful`
- **Triggers:** Entry → Publish
- **Filters:** Content type = `redirect`
- **Headers:** Add `x-contentful-webhook-secret: <your-secret>`

### 5. Run locally

```bash
npm run dev
```

---

## Production considerations

| Concern | Recommendation |
|---|---|
| **Redirect store** | Replace the JSON file store in `src/lib/redirectStore.js` with Vercel KV, Redis, or a database — file-based storage does not work across serverless instances |
| **Middleware fetch** | The middleware-to-API lookup adds latency. For high-traffic sites, load redirects into middleware directly from a KV store at the edge |
| **Redirect chains** | If `a→b` exists and an editor later publishes `b→c`, collapse to `a→c` on write to avoid double redirects |
| **Locales** | If your content uses multiple locales, iterate over all locale keys in `entry.fields.from` |
| **Cache invalidation** | Also fire `revalidatePath` for the old slug so cached pages are purged |
| **Status codes** | Use 308 (permanent) for slug renames, 307 (temporary) for seasonal or A/B redirects |

---

## File overview

```
src/
  lib/
    redirectStore.js       # Read/write redirect rules (swap for KV in production)
  pages/
    api/
      webhooks/
        contentful.js      # Webhook receiver — validates secret, writes redirect
      redirects.js         # Edge lookup endpoint used by middleware
middleware.js              # Next.js middleware — applies redirects at the edge
migration/
  redirect-content-type.js # Contentful migration to create the Redirect content type
.env.example
```
