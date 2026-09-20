# Client CMS — Design Spec

**Date:** 2026-09-20
**Status:** Approved for implementation planning

## Overview

A single admin dashboard for managing multiple client websites: editable pages, SEO
settings, preview, save-draft, publish, and version history/rollback. One Next.js
app renders both the admin dashboard and every client's public site, keyed by
domain.

## Goals

- One dashboard to manage 2–10 client websites, each on its own custom domain.
- Clients can edit copy, images, buttons, SEO fields, and add simple pages —
  without touching code or breaking the site's design.
- Every change is validated before it can go live.
- Every publish creates an immutable version snapshot; any prior version can be
  restored.
- Strict per-client data isolation: a client can only ever see/edit their own
  site.
- A superadmin role can manage any client's site from the same dashboard.

## Non-goals (v1)

- Self-serve custom domain onboarding/automation (domains are added by the
  superadmin via Vercel's dashboard).
- Multiple editor users per client / per-tenant roles beyond a single editor
  role.
- Drag-and-drop block reordering UI polish (blocks can be added/removed/edited;
  reordering can use simple up/down controls).
- Full AI page generation — the AI feature in v1 is limited to SEO meta
  title/description suggestions.
- Password reset / email flows.

These are reasonable follow-ups once v1 is live, not required for the core
workflow described above.

## Architecture

One Next.js app, one Vercel deployment, one GitHub repo (`client-cms`). Every
request is routed by hostname:

- Hostname matches a `Tenant.customDomain` → render that tenant's **published**
  site content.
- Hostname is the app's own default domain (e.g. `client-cms.vercel.app`, or an
  admin domain pointed at it later) → serve the `/admin` dashboard (auth-gated).

```
request -> match Host header
  -> known tenant domain -> load tenant by domain -> render published Page
  -> app's own domain     -> /admin/* routes (login required)
```

## Data model (MongoDB Atlas)

- **Tenant** — `{ _id, name, customDomain, createdAt }`
- **User** — `{ _id, email, passwordHash, role: 'superadmin' | 'editor', tenantId }`
  (`tenantId` is `null` for superadmin)
- **Page** — `{ _id, tenantId, slug, title, draft: { blocks, seo }, published: { blocks, seo }, publishedVersion, updatedAt }`
- **PageVersion** — immutable snapshot:
  `{ _id, pageId, tenantId, versionNumber, blocks, seo, publishedBy, publishedAt }`

Every read/write is scoped by `tenantId` derived from the authenticated
session (never from client-supplied input). This is the mechanism that
guarantees a client can't see or modify another client's data.

## Content block model

Pages are composed of a small, fixed set of block types, each with its own
schema (validated with Zod):

- `hero` — headline, subhead, image, CTA text, CTA link
- `text` — rich text body
- `imageText` — image + text, configurable image position
- `button` — text, link, style
- `gallery` — list of images

Editing a page means adding/removing/editing blocks from this fixed palette —
there is no raw HTML/JS/code field exposed anywhere in the editor. This makes
"clients can't break the design" a structural guarantee, not just a permission
check. Adding a "simple page" means choosing a slug and starting from an empty
block list or a starter template.

## Image uploads

Not explicitly discussed during design — resolving here rather than leaving a
gap: images are uploaded via **Vercel Blob** storage (no new third-party
service needed beyond Vercel, which is already in the stack). A block's image
field stores the resulting Blob URL. Upload is available directly from the
block editor UI.

## Edit → Preview → Publish → Rollback flow

- **Save draft** writes to `Page.draft`.
- **Preview** uses Next.js Draft Mode: a signed cookie set only for the
  logged-in editor causes their own requests to render `Page.draft` instead of
  `Page.published`, on the real page URL. No separate preview app/route
  needed.
- **Publish**:
  1. Validate `draft` against the block/page schemas.
  2. If valid, copy `draft` → `published`.
  3. Append a new immutable `PageVersion` snapshot of the newly published
     content.
  4. Change is live immediately — no admin approval step (per decision below).
- **Rollback**: superadmin or the tenant's editor selects a prior
  `PageVersion`; its snapshot is copied into `Page.published`, and this itself
  creates a new `PageVersion` entry. History is append-only — rollback never
  rewrites or deletes past versions.

## Publish approval

Publish is immediate for the editor's own tenant; there is no superadmin
approval gate in v1. Validation (see below) is the only gate before content
goes live.

## Auth & access control

Auth.js (NextAuth) with a Credentials provider. Passwords are hashed (bcrypt)
and stored in the `User` collection in the same MongoDB Atlas cluster — no
additional third-party auth service. The session carries `role` and
`tenantId`. Superadmin can switch between tenants inside the dashboard;
editors only ever see routes/data scoped to their own `tenantId`.

## AI SEO assist (OpenRouter)

A server-side route sends a page's title and block text to OpenRouter and
returns a suggested SEO meta title (≤ 60 chars) and meta description
(≤ 160 chars). The suggestion is shown in the SEO panel as editable text; it is
only written into `draft.seo` if the editor explicitly accepts/edits and saves
it — never auto-applied.

## Validation

Zod schemas define every block type and the page-level SEO fields (required
fields, length limits). Validation runs:
- Client-side, for immediate editor feedback.
- Server-side, in the API route handling save/publish — this is the source of
  truth; the client-side check is a convenience, not a security boundary.

Publish is blocked until server-side validation passes.

## Testing strategy

- **Unit tests** — Zod schemas and validation logic for each block type and
  the page/SEO schema.
- **Integration tests** — API routes, with explicit tests asserting tenant
  isolation (a test that attempts to read/write another tenant's `Page`/
  `PageVersion` documents from a different tenant's session and asserts it is
  rejected).
- **E2E tests** (Playwright) — the core happy path: login → edit a block →
  preview → publish → rollback.

## Deployment

- New GitHub repo (`client-cms`) connected to a new Vercel project.
- Secrets (`MONGODB_URI`, `NEXTAUTH_SECRET`, `OPENROUTER_API_KEY`) are set as
  Vercel environment variables — never committed to the repo.
- Each client's custom domain is added in Vercel's domain settings and mapped
  to that client's `Tenant.customDomain` value.
