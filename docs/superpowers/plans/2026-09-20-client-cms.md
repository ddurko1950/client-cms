# Client CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-tenant admin dashboard that lets each of 2–10 clients edit their own website (copy, images, buttons, SEO, simple pages) with draft/preview/publish and version rollback, plus a superadmin role that can manage every client from one place.

**Architecture:** One Next.js (App Router) app on one Vercel deployment. Request hostname decides behavior: a client's custom domain renders that tenant's published site; the app's own domain serves the auth-gated `/admin` dashboard. MongoDB Atlas stores tenants, users, pages (draft + published content), and immutable page-version snapshots. Content is a fixed set of Zod-validated block types — no raw code is ever exposed to an editor.

**Tech Stack:** Next.js 15 (App Router, TypeScript), MongoDB Atlas (native `mongodb` driver), Zod, Auth.js v5 (NextAuth, Credentials provider) + bcryptjs, Vercel Blob (image uploads), OpenRouter (AI SEO suggestions), Tailwind CSS, Vitest + Testing Library (unit/integration), `mongodb-memory-server` (integration tests), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-09-20-client-cms-design.md`

## Global Constraints

- Every `Page`/`PageVersion` read or write is scoped by `tenantId` taken from the authenticated session — never from client-supplied input.
- No raw HTML/JS/code field exists anywhere in the block schema.
- Server-side Zod validation is the source of truth; client-side validation is convenience only, never trusted alone.
- Publish is immediate for the editor's own tenant — no approval gate.
- Rollback always appends a new `PageVersion`; existing versions are never deleted or mutated.
- Secrets (`MONGODB_URI`, `NEXTAUTH_SECRET`, `OPENROUTER_API_KEY`, `BLOB_READ_WRITE_TOKEN`) live only in environment variables — never hardcoded or committed.
- AI SEO suggestions are never auto-applied — the editor must explicitly accept/edit and save them.
- `role: 'superadmin'` (with `tenantId: null`) may access any tenant's data; `role: 'editor'` is restricted to its own `tenantId`.

---

## File Structure

```
client-cms/
  package.json, tsconfig.json, next.config.ts, tailwind.config.ts, vitest.config.ts, playwright.config.ts
  .env.example
  middleware.ts                          # host -> tenant rewrite
  src/
    lib/
      mongodb.ts                         # cached MongoClient / getDb()
      models/
        tenant.ts                        # TenantDoc + CRUD
        user.ts                          # UserDoc + CRUD
        page.ts                          # PageDoc + CRUD, publish, rollback
        pageVersion.ts                   # PageVersionDoc + CRUD
      blocks/
        schema.ts                        # Zod block + page-content schemas
      auth-credentials.ts                # verifyCredentials()
      auth.ts                            # NextAuth config (auth/handlers/signIn/signOut)
      openrouter.ts                      # suggestSeo()
    types/
      session.ts                         # SessionUser type
      next-auth.d.ts                     # module augmentation
    app/
      layout.tsx
      page.tsx                           # redirects "/" -> "/admin" on app's own domain
      login/page.tsx
      admin/
        layout.tsx                       # auth guard + nav + tenant switcher
        page.tsx                         # page list
        pages/[pageId]/edit/page.tsx      # block editor
        pages/[pageId]/versions/page.tsx  # version history
      _sites/[tenantId]/[slug]/page.tsx   # public site renderer (rewritten target)
      api/
        auth/[...nextauth]/route.ts
        pages/route.ts                   # GET list, POST create
        pages/[pageId]/route.ts          # GET one
        pages/[pageId]/draft/route.ts    # POST save draft
        pages/[pageId]/publish/route.ts  # POST publish
        pages/[pageId]/versions/route.ts # GET list
        pages/[pageId]/rollback/route.ts # POST rollback
        upload/route.ts                  # POST image -> Vercel Blob URL
        seo-suggest/route.ts             # POST -> AI SEO suggestion
    components/
      admin/
        TenantSwitcher.tsx
        PageList.tsx
        BlockEditor.tsx
        blocks/HeroBlockForm.tsx
        blocks/TextBlockForm.tsx
        blocks/ImageTextBlockForm.tsx
        blocks/ButtonBlockForm.tsx
        blocks/GalleryBlockForm.tsx
        SeoPanel.tsx
        VersionHistory.tsx
      site/
        BlockRenderer.tsx
  tests/
    helpers/db.ts                        # mongodb-memory-server setup/teardown
    unit/blocks.schema.test.ts
    unit/auth-credentials.test.ts
    integration/page-api.test.ts
    integration/publish.test.ts
    integration/rollback.test.ts
    integration/tenant-isolation.test.ts
    integration/middleware.test.ts
    component/BlockEditor.test.tsx
    e2e/happy-path.spec.ts
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Produces: a buildable Next.js app; `npm run build`, `npm test`, `npm run test:e2e` all runnable (even with nothing to test yet).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "client-cms",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "mongodb": "^6.9.0",
    "zod": "^3.23.8",
    "next-auth": "5.0.0-beta.25",
    "bcryptjs": "^2.4.3",
    "@vercel/blob": "^0.27.0",
    "nanoid": "^5.0.7"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.7.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/bcryptjs": "^2.4.6",
    "tailwindcss": "^3.4.13",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20",
    "vitest": "^2.1.2",
    "@vitejs/plugin-react": "^4.3.2",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.5.0",
    "jsdom": "^25.0.1",
    "mongodb-memory-server": "^10.0.0",
    "@playwright/test": "^1.47.2"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

- [ ] **Step 4: Create `tailwind.config.ts` and `postcss.config.js`**

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
export default config
```

```javascript
// postcss.config.js
module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'node',
    globals: true,
    exclude: ['node_modules', 'tests/e2e/**'],
    testTimeout: 20000,
  },
})
```

- [ ] **Step 6: Create `playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run build && npm run start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  use: { baseURL: 'http://localhost:3000' },
})
```

- [ ] **Step 7: Create `.env.example` and `.gitignore`**

```
# .env.example
MONGODB_URI=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
OPENROUTER_API_KEY=
BLOB_READ_WRITE_TOKEN=
```

```
# .gitignore
node_modules/
.next/
.env*.local
.env
test-results/
playwright-report/
```

- [ ] **Step 8: Create minimal app shell**

```typescript
// src/app/layout.tsx
import './globals.css'
import type { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

```typescript
// src/app/page.tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/admin')
}
```

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Install and verify**

Run: `npm install && npm run typecheck && npm test`
Expected: install succeeds, typecheck passes with no errors, `vitest run` reports "No test files found" (not a failure at this point).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with TypeScript, Tailwind, Vitest, Playwright"
```

---

### Task 2: MongoDB connection and core data models

**Files:**
- Create: `src/lib/mongodb.ts`
- Create: `src/lib/models/tenant.ts`, `src/lib/models/user.ts`, `src/lib/models/page.ts`, `src/lib/models/pageVersion.ts`
- Create: `tests/helpers/db.ts`
- Test: `tests/integration/models.test.ts`

**Interfaces:**
- Produces:
  - `getDb(): Promise<Db>` (`src/lib/mongodb.ts`)
  - `TenantDoc = { _id: ObjectId; name: string; customDomain: string; createdAt: Date }`
  - `getTenantByDomain(domain: string): Promise<TenantDoc | null>`
  - `createTenant(input: { name: string; customDomain: string }): Promise<TenantDoc>`
  - `UserDoc = { _id: ObjectId; email: string; passwordHash: string; role: 'superadmin' | 'editor'; tenantId: ObjectId | null }`
  - `getUserByEmail(email: string): Promise<UserDoc | null>`
  - `createUser(input: { email: string; passwordHash: string; role: 'superadmin' | 'editor'; tenantId: ObjectId | null }): Promise<UserDoc>`
  - `PageDoc = { _id: ObjectId; tenantId: ObjectId; slug: string; title: string; draft: PageContent; published: PageContent | null; publishedVersion: number | null; updatedAt: Date }`
  - `listPages(tenantId: ObjectId): Promise<PageDoc[]>`
  - `createPage(input: { tenantId: ObjectId; slug: string; title: string }): Promise<PageDoc>`
  - `getPage(tenantId: ObjectId, pageId: ObjectId): Promise<PageDoc | null>`
  - `getPageBySlug(tenantId: ObjectId, slug: string): Promise<PageDoc | null>`
  - `saveDraft(tenantId: ObjectId, pageId: ObjectId, content: PageContent): Promise<PageDoc>`
  - `publishPage(tenantId: ObjectId, pageId: ObjectId, publishedBy: ObjectId): Promise<PageDoc>`
  - `rollbackPage(tenantId: ObjectId, pageId: ObjectId, versionNumber: number, publishedBy: ObjectId): Promise<PageDoc>`
  - `PageVersionDoc = { _id: ObjectId; pageId: ObjectId; tenantId: ObjectId; versionNumber: number; content: PageContent; publishedBy: ObjectId; publishedAt: Date }`
  - `listVersions(tenantId: ObjectId, pageId: ObjectId): Promise<PageVersionDoc[]>`
  - `getVersion(tenantId: ObjectId, pageId: ObjectId, versionNumber: number): Promise<PageVersionDoc | null>`
  - `setupTestDb(): Promise<void>` / `teardownTestDb(): Promise<void>` (`tests/helpers/db.ts`)
- Consumes: `PageContent` type from Task 3 (`src/lib/blocks/schema.ts`) — until Task 3 exists, define `PageContent` locally in `page.ts` as `{ blocks: unknown[]; seo: { title?: string; description?: string } }` and switch the import once Task 3 lands (note in Task 3 to update this import).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/helpers/db.ts
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer | undefined

export async function setupTestDb() {
  mongod = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongod.getUri()
}

export async function teardownTestDb() {
  await mongod?.stop()
}
```

```typescript
// tests/integration/models.test.ts
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import { setupTestDb, teardownTestDb } from '../helpers/db'

beforeAll(setupTestDb)
afterAll(teardownTestDb)

describe('tenant model', () => {
  it('creates and looks up a tenant by domain', async () => {
    const { createTenant, getTenantByDomain } = await import('@/lib/models/tenant')
    const created = await createTenant({ name: 'Acme', customDomain: 'acme.example.com' })
    const found = await getTenantByDomain('acme.example.com')
    expect(found?._id.toString()).toBe(created._id.toString())
  })

  it('returns null for an unknown domain', async () => {
    const { getTenantByDomain } = await import('@/lib/models/tenant')
    expect(await getTenantByDomain('nope.example.com')).toBeNull()
  })
})

describe('page model', () => {
  it('creates a page, saves a draft, publishes it, and creates a version', async () => {
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft, publishPage, getPage } = await import('@/lib/models/page')
    const { listVersions } = await import('@/lib/models/pageVersion')
    const { ObjectId } = await import('mongodb')

    const tenant = await createTenant({ name: 'Beta', customDomain: 'beta.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })

    const content = { blocks: [], seo: { title: 'Beta Home' } }
    await saveDraft(tenant._id, page._id, content)

    const publisherId = new ObjectId()
    const published = await publishPage(tenant._id, page._id, publisherId)
    expect(published.published).toEqual(content)
    expect(published.publishedVersion).toBe(1)

    const versions = await listVersions(tenant._id, page._id)
    expect(versions).toHaveLength(1)
    expect(versions[0].versionNumber).toBe(1)
  })

  it('rollback restores a prior version and appends a new version rather than deleting history', async () => {
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft, publishPage, rollbackPage } = await import('@/lib/models/page')
    const { listVersions } = await import('@/lib/models/pageVersion')
    const { ObjectId } = await import('mongodb')

    const tenant = await createTenant({ name: 'Gamma', customDomain: 'gamma.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })
    const publisherId = new ObjectId()

    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'v1' } })
    await publishPage(tenant._id, page._id, publisherId)

    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'v2' } })
    await publishPage(tenant._id, page._id, publisherId)

    const rolled = await rollbackPage(tenant._id, page._id, 1, publisherId)
    expect(rolled.published?.seo.title).toBe('v1')
    expect(rolled.publishedVersion).toBe(3)

    const versions = await listVersions(tenant._id, page._id)
    expect(versions).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/models.test.ts`
Expected: FAIL — cannot find module `@/lib/models/tenant` (and siblings).

- [ ] **Step 3: Write `src/lib/mongodb.ts`**

```typescript
import { MongoClient, Db } from 'mongodb'

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')

  if (process.env.NODE_ENV === 'production') {
    return new MongoClient(uri).connect()
  }

  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect()
  }
  return global._mongoClientPromise
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  return client.db()
}
```

- [ ] **Step 4: Write `src/lib/models/tenant.ts`**

```typescript
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'

export interface TenantDoc {
  _id: ObjectId
  name: string
  customDomain: string
  createdAt: Date
}

async function collection() {
  const db = await getDb()
  return db.collection<TenantDoc>('tenants')
}

export async function createTenant(input: { name: string; customDomain: string }): Promise<TenantDoc> {
  const doc: TenantDoc = { _id: new ObjectId(), ...input, createdAt: new Date() }
  await (await collection()).insertOne(doc)
  return doc
}

export async function getTenantByDomain(domain: string): Promise<TenantDoc | null> {
  return (await collection()).findOne({ customDomain: domain })
}

export async function listTenants(): Promise<TenantDoc[]> {
  return (await collection()).find({}).toArray()
}
```

- [ ] **Step 5: Write `src/lib/models/user.ts`**

```typescript
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'

export type Role = 'superadmin' | 'editor'

export interface UserDoc {
  _id: ObjectId
  email: string
  passwordHash: string
  role: Role
  tenantId: ObjectId | null
}

async function collection() {
  const db = await getDb()
  return db.collection<UserDoc>('users')
}

export async function createUser(input: {
  email: string
  passwordHash: string
  role: Role
  tenantId: ObjectId | null
}): Promise<UserDoc> {
  const doc: UserDoc = { _id: new ObjectId(), ...input }
  await (await collection()).insertOne(doc)
  return doc
}

export async function getUserByEmail(email: string): Promise<UserDoc | null> {
  return (await collection()).findOne({ email })
}
```

- [ ] **Step 6: Write `src/lib/models/pageVersion.ts`**

```typescript
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'

// Replaced by the real PageContent import from '@/lib/blocks/schema' in Task 3.
export interface PageContent {
  blocks: unknown[]
  seo: { title?: string; description?: string }
}

export interface PageVersionDoc {
  _id: ObjectId
  pageId: ObjectId
  tenantId: ObjectId
  versionNumber: number
  content: PageContent
  publishedBy: ObjectId
  publishedAt: Date
}

async function collection() {
  const db = await getDb()
  return db.collection<PageVersionDoc>('pageVersions')
}

export async function createVersion(input: {
  pageId: ObjectId
  tenantId: ObjectId
  versionNumber: number
  content: PageContent
  publishedBy: ObjectId
}): Promise<PageVersionDoc> {
  const doc: PageVersionDoc = { _id: new ObjectId(), ...input, publishedAt: new Date() }
  await (await collection()).insertOne(doc)
  return doc
}

export async function listVersions(tenantId: ObjectId, pageId: ObjectId): Promise<PageVersionDoc[]> {
  return (await collection())
    .find({ tenantId, pageId })
    .sort({ versionNumber: 1 })
    .toArray()
}

export async function getVersion(
  tenantId: ObjectId,
  pageId: ObjectId,
  versionNumber: number
): Promise<PageVersionDoc | null> {
  return (await collection()).findOne({ tenantId, pageId, versionNumber })
}
```

- [ ] **Step 7: Write `src/lib/models/page.ts`**

```typescript
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { createVersion, getVersion } from '@/lib/models/pageVersion'
import type { PageContent } from '@/lib/models/pageVersion'

export interface PageDoc {
  _id: ObjectId
  tenantId: ObjectId
  slug: string
  title: string
  draft: PageContent
  published: PageContent | null
  publishedVersion: number | null
  updatedAt: Date
}

const EMPTY_CONTENT: PageContent = { blocks: [], seo: {} }

async function collection() {
  const db = await getDb()
  return db.collection<PageDoc>('pages')
}

export async function createPage(input: { tenantId: ObjectId; slug: string; title: string }): Promise<PageDoc> {
  const doc: PageDoc = {
    _id: new ObjectId(),
    tenantId: input.tenantId,
    slug: input.slug,
    title: input.title,
    draft: EMPTY_CONTENT,
    published: null,
    publishedVersion: null,
    updatedAt: new Date(),
  }
  await (await collection()).insertOne(doc)
  return doc
}

export async function listPages(tenantId: ObjectId): Promise<PageDoc[]> {
  return (await collection()).find({ tenantId }).toArray()
}

export async function getPage(tenantId: ObjectId, pageId: ObjectId): Promise<PageDoc | null> {
  return (await collection()).findOne({ _id: pageId, tenantId })
}

export async function getPageBySlug(tenantId: ObjectId, slug: string): Promise<PageDoc | null> {
  return (await collection()).findOne({ tenantId, slug })
}

export async function saveDraft(tenantId: ObjectId, pageId: ObjectId, content: PageContent): Promise<PageDoc> {
  const col = await collection()
  await col.updateOne({ _id: pageId, tenantId }, { $set: { draft: content, updatedAt: new Date() } })
  const page = await col.findOne({ _id: pageId, tenantId })
  if (!page) throw new Error('Page not found')
  return page
}

export async function publishPage(tenantId: ObjectId, pageId: ObjectId, publishedBy: ObjectId): Promise<PageDoc> {
  const col = await collection()
  const page = await col.findOne({ _id: pageId, tenantId })
  if (!page) throw new Error('Page not found')

  const nextVersion = (page.publishedVersion ?? 0) + 1
  await createVersion({
    pageId,
    tenantId,
    versionNumber: nextVersion,
    content: page.draft,
    publishedBy,
  })
  await col.updateOne(
    { _id: pageId, tenantId },
    { $set: { published: page.draft, publishedVersion: nextVersion, updatedAt: new Date() } }
  )
  const updated = await col.findOne({ _id: pageId, tenantId })
  if (!updated) throw new Error('Page not found after publish')
  return updated
}

export async function rollbackPage(
  tenantId: ObjectId,
  pageId: ObjectId,
  versionNumber: number,
  publishedBy: ObjectId
): Promise<PageDoc> {
  const target = await getVersion(tenantId, pageId, versionNumber)
  if (!target) throw new Error('Version not found')

  const col = await collection()
  const page = await col.findOne({ _id: pageId, tenantId })
  if (!page) throw new Error('Page not found')

  const nextVersion = (page.publishedVersion ?? 0) + 1
  await createVersion({
    pageId,
    tenantId,
    versionNumber: nextVersion,
    content: target.content,
    publishedBy,
  })
  await col.updateOne(
    { _id: pageId, tenantId },
    { $set: { published: target.content, publishedVersion: nextVersion, updatedAt: new Date() } }
  )
  const updated = await col.findOne({ _id: pageId, tenantId })
  if (!updated) throw new Error('Page not found after rollback')
  return updated
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- tests/integration/models.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 9: Commit**

```bash
git add src/lib/mongodb.ts src/lib/models tests/helpers tests/integration/models.test.ts
git commit -m "feat: MongoDB connection and tenant/user/page/pageVersion data models"
```

---

### Task 3: Block and page-content Zod schemas

**Files:**
- Create: `src/lib/blocks/schema.ts`
- Modify: `src/lib/models/pageVersion.ts:1-15` (replace the local `PageContent` type with an import from this file)
- Test: `tests/unit/blocks.schema.test.ts`

**Interfaces:**
- Produces:
  - `blockSchema: ZodDiscriminatedUnion` and `type Block = z.infer<typeof blockSchema>`
  - `seoSchema: ZodObject` and `type Seo = z.infer<typeof seoSchema>`
  - `pageContentSchema: ZodObject` and `type PageContent = z.infer<typeof pageContentSchema>`
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/blocks.schema.test.ts
import { describe, it, expect } from 'vitest'
import { blockSchema, pageContentSchema } from '@/lib/blocks/schema'

describe('blockSchema', () => {
  it('accepts a valid hero block', () => {
    const result = blockSchema.safeParse({
      type: 'hero',
      id: 'b1',
      headline: 'Welcome',
      subhead: 'We do things',
      image: 'https://example.com/hero.jpg',
      ctaText: 'Learn more',
      ctaHref: '/about',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a hero block with no headline', () => {
    const result = blockSchema.safeParse({ type: 'hero', id: 'b1', headline: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown block type', () => {
    const result = blockSchema.safeParse({ type: 'script', id: 'b1', code: 'alert(1)' })
    expect(result.success).toBe(false)
  })

  it('accepts a valid gallery block and rejects an empty one', () => {
    expect(
      blockSchema.safeParse({ type: 'gallery', id: 'g1', images: ['https://example.com/1.jpg'] }).success
    ).toBe(true)
    expect(blockSchema.safeParse({ type: 'gallery', id: 'g1', images: [] }).success).toBe(false)
  })
})

describe('pageContentSchema', () => {
  it('enforces SEO field length limits', () => {
    const tooLong = { blocks: [], seo: { title: 'x'.repeat(61), description: 'ok' } }
    expect(pageContentSchema.safeParse(tooLong).success).toBe(false)

    const ok = { blocks: [], seo: { title: 'Short title', description: 'Short description' } }
    expect(pageContentSchema.safeParse(ok).success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/blocks.schema.test.ts`
Expected: FAIL — cannot find module `@/lib/blocks/schema`

- [ ] **Step 3: Write `src/lib/blocks/schema.ts`**

```typescript
import { z } from 'zod'

export const heroBlockSchema = z.object({
  type: z.literal('hero'),
  id: z.string(),
  headline: z.string().min(1).max(120),
  subhead: z.string().max(240).optional(),
  image: z.string().url().optional(),
  ctaText: z.string().max(40).optional(),
  ctaHref: z.string().max(300).optional(),
})

export const textBlockSchema = z.object({
  type: z.literal('text'),
  id: z.string(),
  body: z.string().min(1).max(5000),
})

export const imageTextBlockSchema = z.object({
  type: z.literal('imageText'),
  id: z.string(),
  image: z.string().url(),
  text: z.string().min(1).max(2000),
  imagePosition: z.enum(['left', 'right']),
})

export const buttonBlockSchema = z.object({
  type: z.literal('button'),
  id: z.string(),
  text: z.string().min(1).max(40),
  href: z.string().min(1).max(300),
  style: z.enum(['primary', 'secondary']),
})

export const galleryBlockSchema = z.object({
  type: z.literal('gallery'),
  id: z.string(),
  images: z.array(z.string().url()).min(1).max(20),
})

export const blockSchema = z.discriminatedUnion('type', [
  heroBlockSchema,
  textBlockSchema,
  imageTextBlockSchema,
  buttonBlockSchema,
  galleryBlockSchema,
])

export type Block = z.infer<typeof blockSchema>

export const seoSchema = z.object({
  title: z.string().max(60).optional(),
  description: z.string().max(160).optional(),
})

export type Seo = z.infer<typeof seoSchema>

export const pageContentSchema = z.object({
  blocks: z.array(blockSchema).max(50),
  seo: seoSchema,
})

export type PageContent = z.infer<typeof pageContentSchema>
```

- [ ] **Step 4: Point `pageVersion.ts` at the real `PageContent` type**

In `src/lib/models/pageVersion.ts`, replace:

```typescript
// Replaced by the real PageContent import from '@/lib/blocks/schema' in Task 3.
export interface PageContent {
  blocks: unknown[]
  seo: { title?: string; description?: string }
}
```

with:

```typescript
import type { PageContent } from '@/lib/blocks/schema'
export type { PageContent }
```

- [ ] **Step 5: Run both test files to verify everything still passes**

Run: `npm test -- tests/unit/blocks.schema.test.ts tests/integration/models.test.ts`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/blocks src/lib/models/pageVersion.ts tests/unit/blocks.schema.test.ts
git commit -m "feat: Zod schemas for page blocks and SEO content"
```

---

### Task 4: Authentication (credentials, NextAuth, login page)

**Files:**
- Create: `src/types/session.ts`, `src/types/next-auth.d.ts`
- Create: `src/lib/auth-credentials.ts`, `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/login/page.tsx`
- Test: `tests/unit/auth-credentials.test.ts`

**Interfaces:**
- Consumes: `getUserByEmail` from `src/lib/models/user.ts` (Task 2)
- Produces:
  - `SessionUser = { id: string; email: string; role: 'superadmin' | 'editor'; tenantId: string | null }` (`src/types/session.ts`)
  - `verifyCredentials(email: string, password: string): Promise<SessionUser | null>` (`src/lib/auth-credentials.ts`)
  - `auth(), handlers, signIn, signOut` from `src/lib/auth.ts` — `auth()` resolves to a session whose `session.user` matches `SessionUser`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/auth-credentials.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import { hash } from 'bcryptjs'

vi.mock('@/lib/models/user', () => ({ getUserByEmail: vi.fn() }))

import { getUserByEmail } from '@/lib/models/user'
import { verifyCredentials } from '@/lib/auth-credentials'

describe('verifyCredentials', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns a SessionUser when the password matches', async () => {
    const passwordHash = await hash('correct-horse', 10)
    const tenantId = new ObjectId()
    vi.mocked(getUserByEmail).mockResolvedValue({
      _id: new ObjectId(),
      email: 'editor@example.com',
      passwordHash,
      role: 'editor',
      tenantId,
    })

    const result = await verifyCredentials('editor@example.com', 'correct-horse')
    expect(result).toEqual({
      id: expect.any(String),
      email: 'editor@example.com',
      role: 'editor',
      tenantId: tenantId.toString(),
    })
  })

  it('returns null when the password does not match', async () => {
    const passwordHash = await hash('correct-horse', 10)
    vi.mocked(getUserByEmail).mockResolvedValue({
      _id: new ObjectId(),
      email: 'editor@example.com',
      passwordHash,
      role: 'editor',
      tenantId: null,
    })

    expect(await verifyCredentials('editor@example.com', 'wrong')).toBeNull()
  })

  it('returns null when the user does not exist', async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null)
    expect(await verifyCredentials('nobody@example.com', 'whatever')).toBeNull()
  })

  it('returns tenantId: null for a superadmin', async () => {
    const passwordHash = await hash('adminpass', 10)
    vi.mocked(getUserByEmail).mockResolvedValue({
      _id: new ObjectId(),
      email: 'admin@example.com',
      passwordHash,
      role: 'superadmin',
      tenantId: null,
    })

    const result = await verifyCredentials('admin@example.com', 'adminpass')
    expect(result?.tenantId).toBeNull()
    expect(result?.role).toBe('superadmin')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/auth-credentials.test.ts`
Expected: FAIL — cannot find module `@/lib/auth-credentials`

- [ ] **Step 3: Write `src/types/session.ts`**

```typescript
export interface SessionUser {
  id: string
  email: string
  role: 'superadmin' | 'editor'
  tenantId: string | null
}
```

- [ ] **Step 4: Write `src/lib/auth-credentials.ts`**

```typescript
import { compare } from 'bcryptjs'
import { getUserByEmail } from '@/lib/models/user'
import type { SessionUser } from '@/types/session'

export async function verifyCredentials(email: string, password: string): Promise<SessionUser | null> {
  const user = await getUserByEmail(email)
  if (!user) return null

  const valid = await compare(password, user.passwordHash)
  if (!valid) return null

  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    tenantId: user.tenantId ? user.tenantId.toString() : null,
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/unit/auth-credentials.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Write `src/types/next-auth.d.ts`**

```typescript
import type { SessionUser } from '@/types/session'

declare module 'next-auth' {
  interface Session {
    user: SessionUser
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: SessionUser['role']
    tenantId?: SessionUser['tenantId']
  }
}
```

- [ ] **Step 7: Write `src/lib/auth.ts`**

```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { verifyCredentials } from '@/lib/auth-credentials'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined
        if (!email || !password) return null
        return verifyCredentials(email, password)
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: 'superadmin' | 'editor' }).role
        token.tenantId = (user as { tenantId: string | null }).tenantId
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub as string
      session.user.role = token.role as 'superadmin' | 'editor'
      session.user.tenantId = (token.tenantId ?? null) as string | null
      return session
    },
  },
})
```

- [ ] **Step 8: Write the route handler and login page**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
export { GET, POST } from '@/lib/auth'
```

```typescript
// src/app/login/page.tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Invalid email or password')
      return
    }
    router.push('/admin')
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-24 flex max-w-sm flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="bg-black p-2 text-white">
        Sign in
      </button>
    </form>
  )
}
```

- [ ] **Step 9: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add src/types src/lib/auth-credentials.ts src/lib/auth.ts src/app/api/auth src/app/login tests/unit/auth-credentials.test.ts
git commit -m "feat: credentials auth with NextAuth, role/tenant session claims, login page"
```

---

### Task 5: Tenant resolution middleware

**Files:**
- Create: `middleware.ts` (project root)
- Test: `tests/integration/middleware.test.ts`

**Interfaces:**
- Consumes: `getTenantByDomain` (Task 2)
- Produces: request rewriting behavior — a request whose `Host` header matches a `Tenant.customDomain` is rewritten to `/_sites/{tenantId}/{path}`; any other host passes through unchanged (serves `/admin`, `/login`, etc. normally).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/integration/middleware.test.ts
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { setupTestDb, teardownTestDb } from '../helpers/db'

beforeAll(setupTestDb)
afterAll(teardownTestDb)

describe('middleware', () => {
  it('rewrites a known tenant domain to /_sites/{tenantId}/{path}', async () => {
    const { createTenant } = await import('@/lib/models/tenant')
    const tenant = await createTenant({ name: 'Acme', customDomain: 'acme.example.com' })

    const { middleware } = await import('../../middleware')
    const req = new NextRequest('https://acme.example.com/about', {
      headers: { host: 'acme.example.com' },
    })
    const res = await middleware(req)

    expect(res.headers.get('x-middleware-rewrite')).toBe(
      `https://acme.example.com/_sites/${tenant._id.toString()}/about`
    )
  })

  it('passes through unknown hosts (e.g. the app domain) unchanged', async () => {
    const { middleware } = await import('../../middleware')
    const req = new NextRequest('https://client-cms.vercel.app/admin', {
      headers: { host: 'client-cms.vercel.app' },
    })
    const res = await middleware(req)

    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('rewrites the root path "/" to /_sites/{tenantId}/index', async () => {
    const { createTenant } = await import('@/lib/models/tenant')
    const tenant = await createTenant({ name: 'Beta', customDomain: 'beta.example.com' })

    const { middleware } = await import('../../middleware')
    const req = new NextRequest('https://beta.example.com/', { headers: { host: 'beta.example.com' } })
    const res = await middleware(req)

    expect(res.headers.get('x-middleware-rewrite')).toBe(
      `https://beta.example.com/_sites/${tenant._id.toString()}/index`
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/middleware.test.ts`
Expected: FAIL — cannot find module `../../middleware`

- [ ] **Step 3: Write `middleware.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getTenantByDomain } from '@/lib/models/tenant'

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const tenant = await getTenantByDomain(host)

  if (!tenant) {
    return NextResponse.next()
  }

  const rawPath = req.nextUrl.pathname.replace(/^\/+/, '')
  const slug = rawPath === '' ? 'index' : rawPath

  const url = req.nextUrl.clone()
  url.pathname = `/_sites/${tenant._id.toString()}/${slug}`
  return NextResponse.rewrite(url)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/middleware.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add middleware.ts tests/integration/middleware.test.ts
git commit -m "feat: host-based tenant resolution middleware"
```

---

### Task 6: Page CRUD + draft API

**Files:**
- Create: `src/lib/api-auth.ts` (shared session/tenant-scoping helper for route handlers)
- Create: `src/app/api/pages/route.ts`, `src/app/api/pages/[pageId]/route.ts`, `src/app/api/pages/[pageId]/draft/route.ts`
- Test: `tests/integration/page-api.test.ts`

**Interfaces:**
- Consumes: `auth()` (Task 4), `listPages/createPage/getPage/saveDraft` (Task 2), `pageContentSchema` (Task 3)
- Produces:
  - `requireSession(): Promise<SessionUser>` — throws a `Response` (401) if unauthenticated (`src/lib/api-auth.ts`)
  - `resolveTenantId(session: SessionUser, requestedTenantId?: string): ObjectId` — returns the editor's own tenant, or (for superadmin) the requested tenant; throws (403) if an editor requests a tenant that isn't theirs
  - `GET /api/pages` → `{ pages: PageDoc[] }`
  - `POST /api/pages` body `{ slug: string; title: string }` → `{ page: PageDoc }`
  - `GET /api/pages/:pageId` → `{ page: PageDoc }` or 404
  - `POST /api/pages/:pageId/draft` body `{ content: PageContent }` → `{ page: PageDoc }` (400 on schema failure)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/integration/page-api.test.ts
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { setupTestDb, teardownTestDb } from '../helpers/db'

beforeAll(setupTestDb)
afterAll(teardownTestDb)

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

describe('page API', () => {
  it('creates and lists pages scoped to the caller tenant', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const tenant = await createTenant({ name: 'Acme', customDomain: 'acme.example.com' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', email: 'e@acme.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST: createHandler } = await import('@/app/api/pages/route')
    const createReq = new Request('http://localhost/api/pages', {
      method: 'POST',
      body: JSON.stringify({ slug: 'about', title: 'About' }),
    })
    const createRes = await createHandler(createReq)
    expect(createRes.status).toBe(201)

    const { GET: listHandler } = await import('@/app/api/pages/route')
    const listRes = await listHandler()
    const { pages } = await listRes.json()
    expect(pages).toHaveLength(1)
    expect(pages[0].slug).toBe('about')
  })

  it('rejects draft saves that fail schema validation', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'Beta', customDomain: 'beta.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u2', email: 'e@beta.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST: draftHandler } = await import('@/app/api/pages/[pageId]/draft/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ content: { blocks: [{ type: 'hero', id: 'b1', headline: '' }], seo: {} } }),
    })
    const res = await draftHandler(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(400)
  })

  it('returns 401 when there is no session', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(null as never)

    const { GET: listHandler } = await import('@/app/api/pages/route')
    const res = await listHandler()
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/page-api.test.ts`
Expected: FAIL — cannot find module `@/lib/api-auth` and route modules

- [ ] **Step 3: Write `src/lib/api-auth.ts`**

```typescript
import { ObjectId } from 'mongodb'
import { auth } from '@/lib/auth'
import type { SessionUser } from '@/types/session'

export async function requireSession(): Promise<SessionUser> {
  const session = await auth()
  if (!session?.user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  return session.user
}

export function resolveTenantId(session: SessionUser, requestedTenantId?: string): ObjectId {
  if (session.role === 'superadmin') {
    if (!requestedTenantId) {
      throw new Response(JSON.stringify({ error: 'tenantId is required for superadmin requests' }), {
        status: 400,
      })
    }
    return new ObjectId(requestedTenantId)
  }

  if (!session.tenantId) {
    throw new Response(JSON.stringify({ error: 'No tenant assigned to this user' }), { status: 403 })
  }
  if (requestedTenantId && requestedTenantId !== session.tenantId) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }
  return new ObjectId(session.tenantId)
}
```

- [ ] **Step 4: Write `src/app/api/pages/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { listPages, createPage } from '@/lib/models/page'

export async function GET() {
  try {
    const session = await requireSession()
    const tenantId = resolveTenantId(session)
    const pages = await listPages(tenantId)
    return NextResponse.json({ pages })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession()
    const tenantId = resolveTenantId(session)
    const { slug, title } = (await req.json()) as { slug: string; title: string }
    const page = await createPage({ tenantId, slug, title })
    return NextResponse.json({ page }, { status: 201 })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
```

> **Plan note (post-Task-6-review ruling):** `POST` here is typed as `Request`, not `NextRequest` — this handler never reads `req.nextUrl`, and a reviewer confirmed narrowing to the plain `Request` type (which the brief's own given test file calls it with) is a correct type-only fix with no behavior change. The `GET` above stays `NextRequest`-free too since it also never touches `nextUrl`.

- [ ] **Step 5: Write `src/app/api/pages/[pageId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { getPage } from '@/lib/models/page'

export async function GET(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const session = await requireSession()
    const requestedTenantId = req.nextUrl.searchParams.get('tenantId') ?? undefined
    const tenantId = resolveTenantId(session, requestedTenantId)
    const { pageId } = await params

    let objectId: ObjectId
    try {
      objectId = new ObjectId(pageId)
    } catch {
      return NextResponse.json({ error: 'Invalid page id' }, { status: 400 })
    }

    const page = await getPage(tenantId, objectId)
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ page })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
```

> **Plan note (post-Task-6-review ruling):** the routes below explicitly check `ObjectId` validity and page existence before calling into the model layer, instead of letting `saveDraft`'s thrown `Error('Page not found')` or a raw `BSONError` from an invalid id propagate as an unhandled 500. This was added as a fix after task review — see the plan's ledger for this run. Task 8's rollback route has the same underlying shape and should use the same explicit-check pattern.

- [ ] **Step 6: Write `src/app/api/pages/[pageId]/draft/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { getPage, saveDraft } from '@/lib/models/page'
import { pageContentSchema } from '@/lib/blocks/schema'

export async function POST(req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const session = await requireSession()
    const tenantId = resolveTenantId(session)
    const { pageId } = await params

    let objectId: ObjectId
    try {
      objectId = new ObjectId(pageId)
    } catch {
      return NextResponse.json({ error: 'Invalid page id' }, { status: 400 })
    }

    const existing = await getPage(tenantId, objectId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const parsed = pageContentSchema.safeParse(body.content)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const page = await saveDraft(tenantId, objectId, parsed.data)
    return NextResponse.json({ page })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- tests/integration/page-api.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Commit**

```bash
git add src/lib/api-auth.ts src/app/api/pages tests/integration/page-api.test.ts
git commit -m "feat: tenant-scoped page CRUD and draft-save API routes"
```

---

### Task 7: Publish API route

**Files:**
- Create: `src/app/api/pages/[pageId]/publish/route.ts`
- Test: `tests/integration/publish.test.ts`

**Interfaces:**
- Consumes: `requireSession/resolveTenantId` (Task 6), `getPage/publishPage` (Task 2), `pageContentSchema` (Task 3)
- Produces: `POST /api/pages/:pageId/publish` → validates the page's current draft; on success calls `publishPage` and returns `{ page: PageDoc }`; on validation failure returns 400 without publishing.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/integration/publish.test.ts
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { setupTestDb, teardownTestDb } from '../helpers/db'

beforeAll(setupTestDb)
afterAll(teardownTestDb)

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

describe('publish API', () => {
  it('publishes a valid draft and creates a version snapshot', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'Acme', customDomain: 'acme.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })
    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'Acme Home' } })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'e@acme.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST } = await import('@/app/api/pages/[pageId]/publish/route')
    const req = new Request('http://localhost', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(200)

    const { page: published } = await res.json()
    expect(published.published.seo.title).toBe('Acme Home')
    expect(published.publishedVersion).toBe(1)
  })

  it('rejects publishing when the current draft fails validation', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'Beta', customDomain: 'beta.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })
    // Force an invalid draft directly (bypassing the draft API's own validation)
    // to prove publish re-validates rather than trusting stored data.
    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'x'.repeat(61) } })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'e@beta.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST } = await import('@/app/api/pages/[pageId]/publish/route')
    const req = new Request('http://localhost', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/publish.test.ts`
Expected: FAIL — cannot find module `@/app/api/pages/[pageId]/publish/route`

- [ ] **Step 3: Write `src/app/api/pages/[pageId]/publish/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { getPage, publishPage } from '@/lib/models/page'
import { pageContentSchema } from '@/lib/blocks/schema'

export async function POST(_req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const session = await requireSession()
    const tenantId = resolveTenantId(session)
    const { pageId } = await params

    const page = await getPage(tenantId, new ObjectId(pageId))
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const parsed = pageContentSchema.safeParse(page.draft)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const published = await publishPage(tenantId, new ObjectId(pageId), new ObjectId(session.id))
    return NextResponse.json({ page: published })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
```

> **Plan note (post-Task-7-blocked ruling):** two fixes vs. the original draft of this task: (1) the route param is typed `Request`, not `NextRequest` — it never reads `req.nextUrl`, and the brief's own test calls it with a plain `Request`. (2) The test mocks now use `new ObjectId().toString()` for `session.user.id` instead of an arbitrary string like `'u1'` — this is the first route to convert `session.id` into an `ObjectId` (for `PageVersion.publishedBy`), and in real usage `session.user.id` genuinely is a Mongo ObjectId string, so the mock needed to become realistic rather than the route needing to change. Task 8's rollback route has the identical `new ObjectId(session.id)` call and needs the same test-mock fix.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/publish.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/pages/[pageId]/publish tests/integration/publish.test.ts
git commit -m "feat: publish API route with re-validation and version snapshotting"
```

---

### Task 8: Version history and rollback API

**Files:**
- Create: `src/app/api/pages/[pageId]/versions/route.ts`, `src/app/api/pages/[pageId]/rollback/route.ts`
- Test: `tests/integration/rollback.test.ts`

**Interfaces:**
- Consumes: `requireSession/resolveTenantId` (Task 6), `listVersions/getVersion` (Task 2), `getPage/rollbackPage` (Task 2)
- Produces:
  - `GET /api/pages/:pageId/versions` → `{ versions: PageVersionDoc[] }` (400 on malformed `pageId`)
  - `POST /api/pages/:pageId/rollback` body `{ versionNumber: number }` → `{ page: PageDoc }` (400 on malformed `pageId`, 404 if the page or the target version doesn't exist)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/integration/rollback.test.ts
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { setupTestDb, teardownTestDb } from '../helpers/db'

beforeAll(setupTestDb)
afterAll(teardownTestDb)

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

describe('versions and rollback API', () => {
  it('lists versions and rolls back to an earlier one', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'Acme', customDomain: 'acme.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'e@acme.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST: publish } = await import('@/app/api/pages/[pageId]/publish/route')
    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'v1' } })
    await publish(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ pageId: page._id.toString() }),
    })
    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'v2' } })
    await publish(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ pageId: page._id.toString() }),
    })

    const { GET: listVersionsHandler } = await import('@/app/api/pages/[pageId]/versions/route')
    const listRes = await listVersionsHandler(new Request('http://localhost'), {
      params: Promise.resolve({ pageId: page._id.toString() }),
    })
    const { versions } = await listRes.json()
    expect(versions).toHaveLength(2)

    const { POST: rollbackHandler } = await import('@/app/api/pages/[pageId]/rollback/route')
    const rollbackReq = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ versionNumber: 1 }),
    })
    const rollbackRes = await rollbackHandler(rollbackReq, {
      params: Promise.resolve({ pageId: page._id.toString() }),
    })
    const { page: rolledBack } = await rollbackRes.json()
    expect(rolledBack.published.seo.title).toBe('v1')
    expect(rolledBack.publishedVersion).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/rollback.test.ts`
Expected: FAIL — cannot find module `@/app/api/pages/[pageId]/versions/route`

- [ ] **Step 3: Write `src/app/api/pages/[pageId]/versions/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { listVersions } from '@/lib/models/pageVersion'

export async function GET(_req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const session = await requireSession()
    const tenantId = resolveTenantId(session)
    const { pageId } = await params

    let objectId: ObjectId
    try {
      objectId = new ObjectId(pageId)
    } catch {
      return NextResponse.json({ error: 'Invalid page id' }, { status: 400 })
    }

    const versions = await listVersions(tenantId, objectId)
    return NextResponse.json({ versions })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
```

> **Plan note (proactive hardening after Task 6/7 review):** both routes below explicitly validate the `pageId` and check existence before calling into the model layer, instead of letting an invalid `ObjectId` or a `rollbackPage`/`getVersion` "not found" `Error` propagate as an unhandled 500 — the same pattern Task 6's review required and Task 7's review flagged as still-missing elsewhere. Applying it here now rather than waiting for another review cycle to catch it.

- [ ] **Step 4: Write `src/app/api/pages/[pageId]/rollback/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { getPage, rollbackPage } from '@/lib/models/page'
import { getVersion } from '@/lib/models/pageVersion'

export async function POST(req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const session = await requireSession()
    const tenantId = resolveTenantId(session)
    const { pageId } = await params

    let objectId: ObjectId
    try {
      objectId = new ObjectId(pageId)
    } catch {
      return NextResponse.json({ error: 'Invalid page id' }, { status: 400 })
    }

    const existing = await getPage(tenantId, objectId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { versionNumber } = (await req.json()) as { versionNumber: number }

    const targetVersion = await getVersion(tenantId, objectId, versionNumber)
    if (!targetVersion) return NextResponse.json({ error: 'Version not found' }, { status: 404 })

    const page = await rollbackPage(tenantId, objectId, versionNumber, new ObjectId(session.id))
    return NextResponse.json({ page })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
```

- [ ] **Step 5: Add tests for the invalid-id and not-found paths**

Append two more `it(...)` blocks inside the existing `describe('versions and rollback API', ...)` in `tests/integration/rollback.test.ts`:

```typescript
  it('returns 400 for a malformed pageId on rollback', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const tenant = await createTenant({ name: 'Malformed', customDomain: 'malformed.example.com' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'e@malformed.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST: rollbackHandler } = await import('@/app/api/pages/[pageId]/rollback/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ versionNumber: 1 }),
    })
    const res = await rollbackHandler(req, { params: Promise.resolve({ pageId: 'not-a-valid-id' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when rolling back a nonexistent version number', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'NoVersion', customDomain: 'noversion.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'e@noversion.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST: rollbackHandler } = await import('@/app/api/pages/[pageId]/rollback/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ versionNumber: 99 }),
    })
    const res = await rollbackHandler(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(404)
  })
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/integration/rollback.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add src/app/api/pages/[pageId]/versions src/app/api/pages/[pageId]/rollback tests/integration/rollback.test.ts
git commit -m "feat: version history and rollback API routes"
```

---

### Task 9: Admin dashboard shell (layout, tenant switcher, page list)

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`
- Create: `src/components/admin/TenantSwitcher.tsx`, `src/components/admin/PageList.tsx`
- Test: `tests/component/PageList.test.tsx`

**Interfaces:**
- Consumes: `auth()` (Task 4), `GET /api/pages` (Task 6), `listTenants` (Task 2)
- Produces: `<PageList pages={PageDoc[]} tenantId={string} />`, `<TenantSwitcher tenants={{id: string; name: string}[]} currentTenantId={string} />` (superadmin only; renders nothing for editors)

> **Plan note (post-Task-10-review ruling):** `PageList` also takes an optional `tenantId` prop, threaded into its "Edit" link as `?tenantId=<id>` — without it, `AdminHomePage`'s auto-selected tenant is never carried to the edit page, and a superadmin's only click-through path (dashboard → Edit) hit the exact same uncaught-`Response` crash this file was already fixed for once. `AdminHomePage` passes its resolved `tenantId` through unconditionally (harmless for editors too, since it just echoes their own session tenant).

> **Plan note (post-Task-9-review ruling):** the original draft of `AdminHomePage` called `resolveTenantId(session.user, requestedTenantId)` directly, which throws an uncaught `Response` for a superadmin with no `?tenantId=` in the URL — and since login/the root redirect always land on bare `/admin`, that was the *only* path a superadmin ever hit, breaking the dashboard by default. Fixed below: for a superadmin with no `requestedTenantId`, auto-redirect to the first tenant (via Next.js's real `redirect()`, not the raw thrown `Response`), or render a "no tenants yet" message if none exist.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/component/PageList.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageList } from '@/components/admin/PageList'

describe('PageList', () => {
  it('renders each page title and slug with an edit link', () => {
    render(
      <PageList
        pages={[
          { _id: 'p1', slug: 'home', title: 'Home', publishedVersion: 2 },
          { _id: 'p2', slug: 'about', title: 'About', publishedVersion: null },
        ]}
      />
    )

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('/home')).toBeInTheDocument()
    expect(screen.getByText('Unpublished')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /edit/i })).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/component/PageList.test.tsx`
Expected: FAIL — cannot find module `@/components/admin/PageList`

- [ ] **Step 3: Write `src/components/admin/PageList.tsx`**

```typescript
import Link from 'next/link'

interface PageListItem {
  _id: string
  slug: string
  title: string
  publishedVersion: number | null
}

export function PageList({ pages, tenantId }: { pages: PageListItem[]; tenantId?: string }) {
  return (
    <ul className="divide-y">
      {pages.map((page) => (
        <li key={page._id} className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">{page.title}</p>
            <p className="text-sm text-gray-500">/{page.slug}</p>
            <p className="text-xs text-gray-400">
              {page.publishedVersion ? `Published v${page.publishedVersion}` : 'Unpublished'}
            </p>
          </div>
          <Link
            href={tenantId ? `/admin/pages/${page._id}/edit?tenantId=${tenantId}` : `/admin/pages/${page._id}/edit`}
            className="text-sm underline"
          >
            Edit
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/component/PageList.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Write `src/components/admin/TenantSwitcher.tsx`**

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface TenantOption {
  id: string
  name: string
}

export function TenantSwitcher({
  tenants,
  currentTenantId,
}: {
  tenants: TenantOption[]
  currentTenantId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onChange(tenantId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tenantId', tenantId)
    router.push(`/admin?${params.toString()}`)
  }

  return (
    <select
      value={currentTenantId}
      onChange={(e) => onChange(e.target.value)}
      className="border p-1 text-sm"
      aria-label="Switch tenant"
    >
      {tenants.map((tenant) => (
        <option key={tenant.id} value={tenant.id}>
          {tenant.name}
        </option>
      ))}
    </select>
  )
}
```

- [ ] **Step 6: Write `src/app/admin/layout.tsx` and `src/app/admin/page.tsx`**

```typescript
// src/app/admin/layout.tsx
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { auth } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Client CMS</h1>
        <span className="text-sm text-gray-500">{session.user.email}</span>
      </header>
      {children}
    </div>
  )
}
```

```typescript
// src/app/admin/page.tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveTenantId } from '@/lib/api-auth'
import { listPages } from '@/lib/models/page'
import { listTenants } from '@/lib/models/tenant'
import { PageList } from '@/components/admin/PageList'
import { TenantSwitcher } from '@/components/admin/TenantSwitcher'

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string }>
}) {
  const session = await auth()
  if (!session?.user) return null

  const { tenantId: requestedTenantId } = await searchParams

  const tenants = session.user.role === 'superadmin' ? await listTenants() : []

  if (session.user.role === 'superadmin' && !requestedTenantId) {
    if (tenants.length === 0) {
      return <p className="text-sm text-gray-500">No tenants yet.</p>
    }
    redirect(`/admin?tenantId=${tenants[0]._id.toString()}`)
  }

  const tenantId = resolveTenantId(session.user, requestedTenantId)
  const pages = await listPages(tenantId)

  return (
    <div className="flex flex-col gap-4">
      {session.user.role === 'superadmin' && (
        <TenantSwitcher
          tenants={tenants.map((t) => ({ id: t._id.toString(), name: t.name }))}
          currentTenantId={tenantId.toString()}
        />
      )}
      <PageList
        pages={pages.map((p) => ({
          _id: p._id.toString(),
          slug: p.slug,
          title: p.title,
          publishedVersion: p.publishedVersion,
        }))}
        tenantId={tenantId.toString()}
      />
    </div>
  )
}
```

- [ ] **Step 7: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/app/admin src/components/admin tests/component/PageList.test.tsx
git commit -m "feat: admin dashboard shell with page list and superadmin tenant switcher"
```

---

### Task 10: Block editor UI

**Files:**
- Create: `src/components/admin/blocks/HeroBlockForm.tsx`, `TextBlockForm.tsx`, `ImageTextBlockForm.tsx`, `ButtonBlockForm.tsx`, `GalleryBlockForm.tsx`
- Create: `src/components/admin/BlockEditor.tsx`
- Create: `src/app/admin/pages/[pageId]/edit/page.tsx`
- Test: `tests/component/BlockEditor.test.tsx`

**Interfaces:**
- Consumes: `Block` type (Task 3), `POST /api/pages/:pageId/draft` and `POST /api/pages/:pageId/publish` (Tasks 6–7), `getPage` and `resolveTenantId` (Tasks 2, 6)
- Produces: `<BlockEditor initialBlocks={Block[]} pageId={string} onSaved?={() => void} />` — manages block list state, renders one form per block by `type`, exposes add/remove/move-up/move-down, and a "Save draft" button that POSTs to the draft API.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/component/BlockEditor.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BlockEditor } from '@/components/admin/BlockEditor'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ page: {} }) })
  )
})

describe('BlockEditor', () => {
  it('adds a text block and edits its content', () => {
    render(<BlockEditor pageId="p1" initialBlocks={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /add text block/i }))
    const textarea = screen.getByLabelText(/body/i)
    fireEvent.change(textarea, { target: { value: 'Hello world' } })

    expect(textarea).toHaveValue('Hello world')
  })

  it('removes a block', () => {
    render(<BlockEditor pageId="p1" initialBlocks={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /add text block/i }))
    expect(screen.getByLabelText(/body/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /remove block/i }))
    expect(screen.queryByLabelText(/body/i)).not.toBeInTheDocument()
  })

  it('saves the draft via the API on "Save draft"', async () => {
    render(<BlockEditor pageId="p1" initialBlocks={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/pages/p1/draft',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/component/BlockEditor.test.tsx`
Expected: FAIL — cannot find module `@/components/admin/BlockEditor`

- [ ] **Step 3: Write the block form components**

```typescript
// src/components/admin/blocks/TextBlockForm.tsx
import type { Block } from '@/lib/blocks/schema'

type TextBlock = Extract<Block, { type: 'text' }>

export function TextBlockForm({ block, onChange }: { block: TextBlock; onChange: (b: TextBlock) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">Body</span>
      <textarea
        value={block.body}
        onChange={(e) => onChange({ ...block, body: e.target.value })}
        className="border p-2"
        rows={4}
      />
    </label>
  )
}
```

```typescript
// src/components/admin/blocks/HeroBlockForm.tsx
import type { Block } from '@/lib/blocks/schema'

type HeroBlock = Extract<Block, { type: 'hero' }>

export function HeroBlockForm({ block, onChange }: { block: HeroBlock; onChange: (b: HeroBlock) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Headline</span>
        <input
          value={block.headline}
          onChange={(e) => onChange({ ...block, headline: e.target.value })}
          className="border p-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Subhead</span>
        <input
          value={block.subhead ?? ''}
          onChange={(e) => onChange({ ...block, subhead: e.target.value })}
          className="border p-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">CTA text</span>
        <input
          value={block.ctaText ?? ''}
          onChange={(e) => onChange({ ...block, ctaText: e.target.value })}
          className="border p-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">CTA link</span>
        <input
          value={block.ctaHref ?? ''}
          onChange={(e) => onChange({ ...block, ctaHref: e.target.value })}
          className="border p-2"
        />
      </label>
    </div>
  )
}
```

```typescript
// src/components/admin/blocks/ImageTextBlockForm.tsx
import type { Block } from '@/lib/blocks/schema'

type ImageTextBlock = Extract<Block, { type: 'imageText' }>

export function ImageTextBlockForm({
  block,
  onChange,
}: {
  block: ImageTextBlock
  onChange: (b: ImageTextBlock) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Image</span>
        <input value={block.image} onChange={(e) => onChange({ ...block, image: e.target.value })} className="border p-2" />
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const form = new FormData()
            form.set('file', file)
            const res = await fetch('/api/upload', { method: 'POST', body: form })
            const { url } = await res.json()
            onChange({ ...block, image: url })
          }}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Text</span>
        <textarea
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          className="border p-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Image position</span>
        <select
          value={block.imagePosition}
          onChange={(e) => onChange({ ...block, imagePosition: e.target.value as 'left' | 'right' })}
          className="border p-2"
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </label>
    </div>
  )
}
```

```typescript
// src/components/admin/blocks/ButtonBlockForm.tsx
import type { Block } from '@/lib/blocks/schema'

type ButtonBlock = Extract<Block, { type: 'button' }>

export function ButtonBlockForm({ block, onChange }: { block: ButtonBlock; onChange: (b: ButtonBlock) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Text</span>
        <input value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} className="border p-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Link</span>
        <input value={block.href} onChange={(e) => onChange({ ...block, href: e.target.value })} className="border p-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Style</span>
        <select
          value={block.style}
          onChange={(e) => onChange({ ...block, style: e.target.value as 'primary' | 'secondary' })}
          className="border p-2"
        >
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
        </select>
      </label>
    </div>
  )
}
```

```typescript
// src/components/admin/blocks/GalleryBlockForm.tsx
import type { Block } from '@/lib/blocks/schema'

type GalleryBlock = Extract<Block, { type: 'gallery' }>

export function GalleryBlockForm({ block, onChange }: { block: GalleryBlock; onChange: (b: GalleryBlock) => void }) {
  async function updateImage(index: number, value: string) {
    const images = [...block.images]
    images[index] = value
    onChange({ ...block, images })
  }

  async function uploadImage(index: number, file: File) {
    const form = new FormData()
    form.set('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const { url } = await res.json()
    updateImage(index, url)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Images</span>
      {block.images.map((image, i) => (
        <div key={i} className="flex flex-col gap-1">
          <input value={image} onChange={(e) => updateImage(i, e.target.value)} className="border p-2" />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadImage(i, file)
            }}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...block, images: [...block.images, ''] })}
        className="self-start text-sm underline"
      >
        Add image
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Write `src/components/admin/BlockEditor.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { Block } from '@/lib/blocks/schema'
import { HeroBlockForm } from './blocks/HeroBlockForm'
import { TextBlockForm } from './blocks/TextBlockForm'
import { ImageTextBlockForm } from './blocks/ImageTextBlockForm'
import { ButtonBlockForm } from './blocks/ButtonBlockForm'
import { GalleryBlockForm } from './blocks/GalleryBlockForm'

const BLANK_BLOCKS: Record<Block['type'], () => Block> = {
  hero: () => ({ type: 'hero', id: nanoid(), headline: '' }),
  text: () => ({ type: 'text', id: nanoid(), body: '' }),
  imageText: () => ({ type: 'imageText', id: nanoid(), image: '', text: '', imagePosition: 'left' }),
  button: () => ({ type: 'button', id: nanoid(), text: '', href: '', style: 'primary' }),
  gallery: () => ({ type: 'gallery', id: nanoid(), images: [''] }),
}

function BlockForm({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  switch (block.type) {
    case 'hero':
      return <HeroBlockForm block={block} onChange={onChange} />
    case 'text':
      return <TextBlockForm block={block} onChange={onChange} />
    case 'imageText':
      return <ImageTextBlockForm block={block} onChange={onChange} />
    case 'button':
      return <ButtonBlockForm block={block} onChange={onChange} />
    case 'gallery':
      return <GalleryBlockForm block={block} onChange={onChange} />
  }
}

export function BlockEditor({
  pageId,
  initialBlocks,
  onSaved,
}: {
  pageId: string
  initialBlocks: Block[]
  onSaved?: () => void
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks)
  const [saving, setSaving] = useState(false)

  function addBlock(type: Block['type']) {
    setBlocks((prev) => [...prev, BLANK_BLOCKS[type]()])
  }

  function updateBlock(index: number, block: Block) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? block : b)))
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index))
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function saveDraft() {
    setSaving(true)
    try {
      await fetch(`/api/pages/${pageId}/draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: { blocks, seo: {} } }),
      })
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(BLANK_BLOCKS) as Block['type'][]).map((type) => (
          <button key={type} type="button" onClick={() => addBlock(type)} className="border px-2 py-1 text-sm">
            Add {type} block
          </button>
        ))}
      </div>

      {blocks.map((block, index) => (
        <div key={block.id} className="flex flex-col gap-2 border p-4">
          <BlockForm block={block} onChange={(b) => updateBlock(index, b)} />
          <div className="flex gap-2 text-sm">
            <button type="button" onClick={() => moveBlock(index, -1)}>
              Move up
            </button>
            <button type="button" onClick={() => moveBlock(index, 1)}>
              Move down
            </button>
            <button type="button" onClick={() => removeBlock(index)}>
              Remove block
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={saveDraft}
        disabled={saving}
        className="self-start bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save draft'}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/component/BlockEditor.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Write `src/components/admin/PublishButton.tsx`**

```typescript
'use client'

import { useState } from 'react'

export function PublishButton({ pageId }: { pageId: string }) {
  const [publishing, setPublishing] = useState(false)

  return (
    <button
      type="button"
      disabled={publishing}
      onClick={async () => {
        setPublishing(true)
        await fetch(`/api/pages/${pageId}/publish`, { method: 'POST' })
        setPublishing(false)
      }}
      className="border px-4 py-2 text-sm"
    >
      {publishing ? 'Publishing…' : 'Publish'}
    </button>
  )
}
```

- [ ] **Step 7: Write `src/app/admin/pages/[pageId]/edit/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ObjectId } from 'mongodb'
import { auth } from '@/lib/auth'
import { resolveTenantId } from '@/lib/api-auth'
import { getPage } from '@/lib/models/page'
import { BlockEditor } from '@/components/admin/BlockEditor'
import { PublishButton } from '@/components/admin/PublishButton'

export default async function EditPagePage({
  params,
  searchParams,
}: {
  params: Promise<{ pageId: string }>
  searchParams: Promise<{ tenantId?: string }>
}) {
  const session = await auth()
  if (!session?.user) return null

  const { pageId } = await params
  const { tenantId: requestedTenantId } = await searchParams
  const tenantId = resolveTenantId(session.user, requestedTenantId)
  const page = await getPage(tenantId, new ObjectId(pageId))
  if (!page) notFound()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{page.title}</h2>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/pages/${pageId}/versions?tenantId=${tenantId.toString()}`}
            className="text-sm underline"
          >
            Version history
          </Link>
          <PublishButton pageId={pageId} />
        </div>
      </div>
      <BlockEditor pageId={pageId} initialBlocks={page.draft.blocks} />
    </div>
  )
}
```

> **Plan note (post-Task-10-review ruling):** the original draft called `resolveTenantId(session.user)` with no `requestedTenantId` — since `PageList`'s Edit link (Task 9) never carried a `tenantId`, this was superadmin's *only* click-through path to this page, and it crashed 100% of the time, the same failure class Task 9 was already fixed for once. Now accepts `?tenantId=` via `searchParams` (mirroring `AdminHomePage`'s pattern) and forwards its resolved `tenantId` into the "Version history" link so Task 13's page doesn't hit the identical bug rolling forward.

- [ ] **Step 8: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/blocks src/components/admin/BlockEditor.tsx src/components/admin/PublishButton.tsx src/app/admin/pages tests/component/BlockEditor.test.tsx
git commit -m "feat: block editor UI with per-type forms, image upload, reorder, save draft, publish"
```

---

### Task 11: Image upload API (Vercel Blob)

**Files:**
- Create: `src/app/api/upload/route.ts`
- Test: `tests/integration/upload.test.ts`

**Interfaces:**
- Consumes: `requireSession` (Task 6)
- Produces: `POST /api/upload` (multipart form field `file`) → `{ url: string }`. Already wired into `ImageTextBlockForm` and `GalleryBlockForm` from Task 10 — this task adds the server route those calls hit.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/integration/upload.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))

describe('upload API', () => {
  beforeEach(() => vi.resetAllMocks())

  it('uploads a file to Vercel Blob and returns its URL', async () => {
    const { auth } = await import('@/lib/auth')
    const { put } = await import('@vercel/blob')
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'editor', tenantId: 't1', email: 'e@x.com' } } as never)
    vi.mocked(put).mockResolvedValue({ url: 'https://blob.example.com/image.png' } as never)

    const { POST } = await import('@/app/api/upload/route')
    const form = new FormData()
    form.set('file', new File(['abc'], 'image.png', { type: 'image/png' }))
    const req = new Request('http://localhost', { method: 'POST', body: form })

    const res = await POST(req)
    const body = await res.json()
    expect(body.url).toBe('https://blob.example.com/image.png')
  })

  it('returns 401 without a session', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(null as never)

    const { POST } = await import('@/app/api/upload/route')
    const form = new FormData()
    form.set('file', new File(['abc'], 'image.png', { type: 'image/png' }))
    const res = await POST(new Request('http://localhost', { method: 'POST', body: form }))
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/upload.test.ts`
Expected: FAIL — cannot find module `@/app/api/upload/route`

- [ ] **Step 3: Write `src/app/api/upload/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { requireSession } from '@/lib/api-auth'

const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function POST(req: Request) {
  try {
    await requireSession()
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const extension = ALLOWED_TYPES[file.type]
    if (!extension) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
    }

    const safeName = `${crypto.randomUUID()}.${extension}`
    const blob = await put(safeName, file, { access: 'public', addRandomSuffix: true, contentType: file.type })
    return NextResponse.json({ url: blob.url })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
```

> **Plan note (post-Task-11 security-scan fix):** the original draft passed `file.name` (client-controlled) directly as the Blob path and had no file-type or size validation — an automated security review flagged this as an unrestricted-file-upload/XSS risk (arbitrary files, including HTML/SVG-with-script, could be uploaded and served publicly), a missing size limit, and a user-controlled-path-in-sink. Fixed by restricting to a whitelist of image MIME types, capping size at 5MB, and generating the Blob filename server-side from a random UUID plus a validated extension — `file.name` is never used as the storage path.

- [ ] **Step 4: Add tests for the new validation**

Add two more `it(...)` blocks inside the existing `describe('upload API', ...)`:

```typescript
  it('rejects an unsupported file type', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'editor', tenantId: 't1', email: 'e@x.com' } } as never)

    const { POST } = await import('@/app/api/upload/route')
    const form = new FormData()
    form.set('file', new File(['<script>alert(1)</script>'], 'evil.svg', { type: 'image/svg+xml' }))
    const res = await POST(new Request('http://localhost', { method: 'POST', body: form }))
    expect(res.status).toBe(400)
  })

  it('rejects a file larger than the size limit', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'editor', tenantId: 't1', email: 'e@x.com' } } as never)

    const { POST } = await import('@/app/api/upload/route')
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1)
    const form = new FormData()
    form.set('file', new File([oversized], 'big.png', { type: 'image/png' }))
    const res = await POST(new Request('http://localhost', { method: 'POST', body: form }))
    expect(res.status).toBe(400)
  })
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/integration/upload.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/app/api/upload tests/integration/upload.test.ts
git commit -m "feat: image upload API route backed by Vercel Blob"
```

---

### Task 12: Public site renderer and preview (Draft Mode)

**Files:**
- Create: `src/components/site/BlockRenderer.tsx`
- Create: `src/app/_sites/[tenantId]/[slug]/page.tsx`
- Create: `src/app/api/preview/route.ts`
- Test: `tests/component/BlockRenderer.test.tsx`

**Interfaces:**
- Consumes: `Block` type (Task 3), `getPage/getPageBySlug` (Task 2), `requireSession/resolveTenantId` (Task 6)
- Produces: `<BlockRenderer blocks={Block[]} />` (read-only public rendering); `GET /api/preview?pageId=...` sets a Draft Mode cookie scoped to the requesting editor and redirects to the tenant's page.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/component/BlockRenderer.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlockRenderer } from '@/components/site/BlockRenderer'

describe('BlockRenderer', () => {
  it('renders a hero, text, and button block', () => {
    render(
      <BlockRenderer
        blocks={[
          { type: 'hero', id: 'b1', headline: 'Welcome' },
          { type: 'text', id: 'b2', body: 'Some copy' },
          { type: 'button', id: 'b3', text: 'Click me', href: '/x', style: 'primary' },
        ]}
      />
    )

    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByText('Some copy')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Click me' })).toHaveAttribute('href', '/x')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/component/BlockRenderer.test.tsx`
Expected: FAIL — cannot find module `@/components/site/BlockRenderer`

- [ ] **Step 3: Write `src/components/site/BlockRenderer.tsx`**

```typescript
import type { Block } from '@/lib/blocks/schema'

const SAFE_HREF = /^(https?:|mailto:|tel:|\/|#)/i

function safeHref(href?: string): string | undefined {
  return href && SAFE_HREF.test(href) ? href : undefined
}

export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block) => {
        switch (block.type) {
          case 'hero':
            return (
              <section key={block.id}>
                <h1>{block.headline}</h1>
                {block.subhead && <p>{block.subhead}</p>}
                {block.image && <img src={block.image} alt="" />}
                {block.ctaText && safeHref(block.ctaHref) && (
                  <a href={safeHref(block.ctaHref)} rel="noopener noreferrer">
                    {block.ctaText}
                  </a>
                )}
              </section>
            )
          case 'text':
            return <p key={block.id}>{block.body}</p>
          case 'imageText':
            return (
              <section
                key={block.id}
                style={{ display: 'flex', flexDirection: block.imagePosition === 'right' ? 'row-reverse' : 'row' }}
              >
                <img src={block.image} alt="" />
                <p>{block.text}</p>
              </section>
            )
          case 'button':
            return (
              <a key={block.id} href={safeHref(block.href)} data-style={block.style} rel="noopener noreferrer">
                {block.text}
              </a>
            )
          case 'gallery':
            return (
              <div key={block.id}>
                {block.images.map((src, i) => (
                  <img key={i} src={src} alt="" />
                ))}
              </div>
            )
        }
      })}
    </>
  )
}
```

> **Plan note (mid-Task-12 security-scan fix):** the original draft rendered `block.ctaHref`/`block.href` directly as `<a href={...}>` with no scheme validation — an automated security review flagged that a `javascript:` URI stored in either field (via a compromised or careless editor) would execute on click, bypassing the spec's "no raw HTML/JS field" intent. Fixed with a scheme allowlist (`http(s):`, `mailto:`, `tel:`, relative paths, and fragments) applied before rendering either link; a link with a disallowed scheme renders as no `href` at all rather than an executable one.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/component/BlockRenderer.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Write `src/app/_sites/[tenantId]/[slug]/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { draftMode } from 'next/headers'
import { ObjectId } from 'mongodb'
import { auth } from '@/lib/auth'
import { getPageBySlug } from '@/lib/models/page'
import { BlockRenderer } from '@/components/site/BlockRenderer'

export default async function TenantSitePage({
  params,
}: {
  params: Promise<{ tenantId: string; slug: string }>
}) {
  const { tenantId, slug } = await params
  const page = await getPageBySlug(new ObjectId(tenantId), slug)
  if (!page) notFound()

  const { isEnabled: isPreview } = await draftMode()

  let content = page.published
  if (isPreview) {
    const session = await auth()
    const authorizedForThisTenant =
      session?.user && (session.user.role === 'superadmin' || session.user.tenantId === tenantId)
    if (authorizedForThisTenant) {
      content = page.draft
    }
  }

  if (!content) notFound()

  return (
    <main>
      {content.seo.title && <title>{content.seo.title}</title>}
      <BlockRenderer blocks={content.blocks} />
    </main>
  )
}
```

> **Plan note (mid-Task-12 security-scan fix, Critical):** the original draft did `content = isPreview ? page.draft : page.published` with no check that the previewing session actually belongs to `tenantId`. Next.js Draft Mode is a single global on/off cookie, not scoped to any tenant — once one editor enables it for their own tenant via `/api/preview`, that cookie is set browser-wide, so navigating to `/_sites/{anyOtherTenantId}/{slug}` while it's still on would have leaked that OTHER tenant's unpublished draft content. This is exactly the cross-tenant leak the whole tenant-isolation architecture (Task 6) was built to prevent. Fixed: draft content is only served when Draft Mode is on AND the current session's `tenantId` matches the URL's `tenantId` (or the session is superadmin); otherwise it falls back to `published` (or `notFound()` if there's no published version).

- [ ] **Step 6: Write `src/app/api/preview/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { draftMode } from 'next/headers'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { getPage } from '@/lib/models/page'

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession()
    const tenantId = resolveTenantId(session)
    const pageId = req.nextUrl.searchParams.get('pageId')
    if (!pageId) return NextResponse.json({ error: 'pageId is required' }, { status: 400 })

    const page = await getPage(tenantId, new ObjectId(pageId))
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const dm = await draftMode()
    dm.enable()

    return NextResponse.redirect(new URL(`/_sites/${tenantId.toString()}/${page.slug}`, req.url))
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
```

- [ ] **Step 7: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/components/site src/app/_sites src/app/api/preview tests/component/BlockRenderer.test.tsx
git commit -m "feat: public site renderer with Draft Mode preview"
```

---

### Task 13: Version history UI

**Files:**
- Create: `src/components/admin/VersionHistory.tsx`
- Create: `src/app/admin/pages/[pageId]/versions/page.tsx`
- Test: `tests/component/VersionHistory.test.tsx`

**Interfaces:**
- Consumes: `GET /api/pages/:pageId/versions`, `POST /api/pages/:pageId/rollback` (Task 8), `listVersions` (Task 2), `resolveTenantId` (Task 6)
- Produces: `<VersionHistory pageId={string} versions={{versionNumber: number; publishedAt: string}[]} />`

> **Plan note (proactive fix carried from Task 10's review):** this page accepts `?tenantId=` via `searchParams` from the start, since Task 10's edit page now links here as `/admin/pages/{pageId}/versions?tenantId=<id>` — without this, a superadmin clicking "Version history" would hit the identical uncaught-`Response` bug that Tasks 9 and 10 both had to fix.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/component/VersionHistory.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VersionHistory } from '@/components/admin/VersionHistory'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ page: {} }) }))
})

describe('VersionHistory', () => {
  it('lists versions and rolls back on click', async () => {
    render(
      <VersionHistory
        pageId="p1"
        versions={[
          { versionNumber: 1, publishedAt: '2026-01-01T00:00:00.000Z' },
          { versionNumber: 2, publishedAt: '2026-02-01T00:00:00.000Z' },
        ]}
      />
    )

    expect(screen.getByText(/version 1/i)).toBeInTheDocument()
    expect(screen.getByText(/version 2/i)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /roll back/i })[0])

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/pages/p1/rollback',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ versionNumber: 1 }) })
      )
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/component/VersionHistory.test.tsx`
Expected: FAIL — cannot find module `@/components/admin/VersionHistory`

- [ ] **Step 3: Write `src/components/admin/VersionHistory.tsx`**

```typescript
'use client'

interface VersionItem {
  versionNumber: number
  publishedAt: string
}

export function VersionHistory({ pageId, versions }: { pageId: string; versions: VersionItem[] }) {
  async function rollback(versionNumber: number) {
    await fetch(`/api/pages/${pageId}/rollback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ versionNumber }),
    })
  }

  return (
    <ul className="flex flex-col gap-2">
      {versions.map((v) => (
        <li key={v.versionNumber} className="flex items-center justify-between border p-2">
          <span>
            Version {v.versionNumber} — {new Date(v.publishedAt).toLocaleString()}
          </span>
          <button type="button" onClick={() => rollback(v.versionNumber)} className="text-sm underline">
            Roll back
          </button>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/component/VersionHistory.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Write `src/app/admin/pages/[pageId]/versions/page.tsx`**

```typescript
import { ObjectId } from 'mongodb'
import { auth } from '@/lib/auth'
import { resolveTenantId } from '@/lib/api-auth'
import { listVersions } from '@/lib/models/pageVersion'
import { VersionHistory } from '@/components/admin/VersionHistory'

export default async function VersionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ pageId: string }>
  searchParams: Promise<{ tenantId?: string }>
}) {
  const session = await auth()
  if (!session?.user) return null

  const { pageId } = await params
  const { tenantId: requestedTenantId } = await searchParams
  const tenantId = resolveTenantId(session.user, requestedTenantId)
  const versions = await listVersions(tenantId, new ObjectId(pageId))

  return (
    <VersionHistory
      pageId={pageId}
      versions={versions.map((v) => ({ versionNumber: v.versionNumber, publishedAt: v.publishedAt.toISOString() }))}
    />
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/VersionHistory.tsx src/app/admin/pages/[pageId]/versions tests/component/VersionHistory.test.tsx
git commit -m "feat: version history UI with one-click rollback"
```

---

### Task 14: AI SEO assist (OpenRouter)

**Files:**
- Create: `src/lib/openrouter.ts`
- Create: `src/app/api/seo-suggest/route.ts`
- Create: `src/components/admin/SeoPanel.tsx`
- Modify: `src/components/admin/BlockEditor.tsx` (Task 10) — mount `SeoPanel`, lift `seo` into state, stop hardcoding `seo: {}` in the draft save
- Modify: `src/app/admin/pages/[pageId]/edit/page.tsx` (Task 10) — pass the page's current draft SEO through to `BlockEditor`
- Test: `tests/unit/openrouter.test.ts`, `tests/component/SeoPanel.test.tsx`

**Interfaces:**
- Consumes: `requireSession` (Task 6)
- Produces:
  - `suggestSeo(input: { title: string; bodyText: string }): Promise<{ title: string; description: string }>` (`src/lib/openrouter.ts`)
  - `POST /api/seo-suggest` body `{ title: string; bodyText: string }` → `{ title: string; description: string }`
  - `<SeoPanel pageId={string} initialSeo={Seo} bodyText={string} onChange?={(seo: Seo) => void} />` (imports `Seo` from `@/lib/blocks/schema` rather than redeclaring it)
  - `BlockEditor` gains an optional `initialSeo?: Seo` prop (defaults to `{}` so Task 10's existing tests, which don't pass it, keep working unchanged) and now saves `{ blocks, seo }` — not `{ blocks, seo: {} }` — in its draft POST body.

> **Plan note (pre-flight ruling):** Task 10 builds `BlockEditor` with a hardcoded `seo: {}` in its save-draft call, and this task's `SeoPanel` was never mounted anywhere in the original draft of this plan — SEO edits would have been silently discarded on every save. Steps 7–8 below fix this by having this task modify `BlockEditor` and the edit page directly, matching the same pattern Task 3 already uses to modify Task 2's `pageVersion.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/openrouter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: JSON.stringify({ title: 'Great SEO Title', description: 'A concise, compelling description.' }) } },
        ],
      }),
    })
  )
  process.env.OPENROUTER_API_KEY = 'test-key'
})

describe('suggestSeo', () => {
  it('parses the model response into title/description', async () => {
    const { suggestSeo } = await import('@/lib/openrouter')
    const result = await suggestSeo({ title: 'About us', bodyText: 'We build things.' })
    expect(result).toEqual({ title: 'Great SEO Title', description: 'A concise, compelling description.' })
  })
})
```

```typescript
// tests/component/SeoPanel.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SeoPanel } from '@/components/admin/SeoPanel'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ title: 'Suggested Title', description: 'Suggested description.' }) })
  )
})

describe('SeoPanel', () => {
  it('fetches a suggestion and only applies it once accepted', async () => {
    render(<SeoPanel pageId="p1" initialSeo={{}} bodyText="Some page copy" />)

    fireEvent.click(screen.getByRole('button', { name: /suggest with ai/i }))

    await waitFor(() => expect(screen.getByText('Suggested Title')).toBeInTheDocument())
    expect(screen.getByLabelText(/meta title/i)).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: /accept suggestion/i }))
    expect(screen.getByLabelText(/meta title/i)).toHaveValue('Suggested Title')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/openrouter.test.ts tests/component/SeoPanel.test.tsx`
Expected: FAIL — cannot find modules `@/lib/openrouter` and `@/components/admin/SeoPanel`

- [ ] **Step 3: Write `src/lib/openrouter.ts`**

```typescript
export async function suggestSeo(input: { title: string; bodyText: string }): Promise<{
  title: string
  description: string
}> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Write an SEO meta title (max 60 characters) and meta description (max 160 characters) for a page titled "${input.title}" with this content: ${input.bodyText}. Respond with ONLY JSON: {"title": "...", "description": "..."}`,
        },
      ],
    }),
  })

  if (!res.ok) throw new Error(`OpenRouter request failed: ${res.status}`)

  const data = await res.json()
  const content = data.choices[0].message.content as string
  return JSON.parse(content)
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npm test -- tests/unit/openrouter.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Write `src/app/api/seo-suggest/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { suggestSeo } from '@/lib/openrouter'

export async function POST(req: NextRequest) {
  try {
    await requireSession()
    const { title, bodyText } = (await req.json()) as { title: string; bodyText: string }
    const suggestion = await suggestSeo({ title, bodyText })
    return NextResponse.json(suggestion)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
```

- [ ] **Step 6: Write `src/components/admin/SeoPanel.tsx`**

```typescript
'use client'

import { useState } from 'react'
import type { Seo } from '@/lib/blocks/schema'

export function SeoPanel({
  bodyText,
  initialSeo,
  onChange,
}: {
  pageId: string
  initialSeo: Seo
  bodyText: string
  onChange?: (seo: Seo) => void
}) {
  const [seo, setSeo] = useState<Seo>(initialSeo)
  const [suggestion, setSuggestion] = useState<Seo | null>(null)

  function update(next: Seo) {
    setSeo(next)
    onChange?.(next)
  }

  async function requestSuggestion() {
    const res = await fetch('/api/seo-suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: seo.title ?? '', bodyText }),
    })
    setSuggestion(await res.json())
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Meta title</span>
        <input
          aria-label="Meta title"
          value={seo.title ?? ''}
          onChange={(e) => update({ ...seo, title: e.target.value })}
          className="border p-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Meta description</span>
        <textarea
          aria-label="Meta description"
          value={seo.description ?? ''}
          onChange={(e) => update({ ...seo, description: e.target.value })}
          className="border p-2"
        />
      </label>

      <button type="button" onClick={requestSuggestion} className="self-start text-sm underline">
        Suggest with AI
      </button>

      {suggestion && (
        <div className="border p-2 text-sm">
          <p>{suggestion.title}</p>
          <p>{suggestion.description}</p>
          <button
            type="button"
            onClick={() => {
              update(suggestion)
              setSuggestion(null)
            }}
            className="mt-1 underline"
          >
            Accept suggestion
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Run the component test to verify it passes**

Run: `npm test -- tests/component/SeoPanel.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 8: Wire `SeoPanel` into `BlockEditor` so SEO edits are actually saved**

In `src/components/admin/BlockEditor.tsx`:

1. Add the import:

```typescript
import type { Block, Seo } from '@/lib/blocks/schema'
import { SeoPanel } from './SeoPanel'
```

(replace the existing `import type { Block } from '@/lib/blocks/schema'` line with the combined import above)

2. Add an `initialSeo` prop and `seo` state, change the function signature to:

```typescript
export function BlockEditor({
  pageId,
  initialBlocks,
  initialSeo,
  onSaved,
}: {
  pageId: string
  initialBlocks: Block[]
  initialSeo?: Seo
  onSaved?: () => void
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks)
  const [seo, setSeo] = useState<Seo>(initialSeo ?? {})
  const [saving, setSaving] = useState(false)
```

3. Compute a plain-text summary of the blocks for the AI suggestion's context, and update `saveDraft` to send the real `seo` state instead of `{}`:

```typescript
  const bodyText = blocks
    .map((b) => ('body' in b ? b.body : 'headline' in b ? b.headline : ''))
    .filter(Boolean)
    .join(' ')

  async function saveDraft() {
    setSaving(true)
    try {
      await fetch(`/api/pages/${pageId}/draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: { blocks, seo } }),
      })
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }
```

4. Render `SeoPanel` in the JSX, just above the "Save draft" button:

```typescript
      <SeoPanel pageId={pageId} initialSeo={seo} bodyText={bodyText} onChange={setSeo} />

      <button
        type="button"
        onClick={saveDraft}
```

(the existing "Save draft" `<button>` stays exactly as it was — only the line immediately above it changes)

- [ ] **Step 9: Pass the page's draft SEO through from the edit page**

In `src/app/admin/pages/[pageId]/edit/page.tsx`, change:

```typescript
      <BlockEditor pageId={pageId} initialBlocks={page.draft.blocks} />
```

to:

```typescript
      <BlockEditor pageId={pageId} initialBlocks={page.draft.blocks} initialSeo={page.draft.seo} />
```

- [ ] **Step 10: Re-run the Task 10 and Task 14 component suites to confirm nothing broke**

Run: `npm test -- tests/component/BlockEditor.test.tsx tests/component/SeoPanel.test.tsx`
Expected: PASS (4 tests total) — Task 10's `BlockEditor.test.tsx` still passes unchanged because `initialSeo` is optional and defaults to `{}`.

- [ ] **Step 11: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 12: Commit**

```bash
git add src/lib/openrouter.ts src/app/api/seo-suggest src/components/admin/SeoPanel.tsx src/components/admin/BlockEditor.tsx src/app/admin/pages/[pageId]/edit/page.tsx tests/unit/openrouter.test.ts tests/component/SeoPanel.test.tsx
git commit -m "feat: AI-assisted SEO suggestions via OpenRouter, wired into the block editor"
```

---

### Task 15: Tenant isolation suite and E2E happy path

**Files:**
- Create: `tests/integration/tenant-isolation.test.ts`
- Create: `tests/e2e/seed.ts`, `tests/e2e/happy-path.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–14. This task adds no new production code beyond the query-param support noted in Step 2 below — it closes the loop on the two testing requirements from the spec (explicit cross-tenant rejection tests, and an E2E happy path).

- [ ] **Step 1: Write the cross-cutting tenant isolation test**

```typescript
// tests/integration/tenant-isolation.test.ts
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { setupTestDb, teardownTestDb } from '../helpers/db'

beforeAll(setupTestDb)
afterAll(teardownTestDb)

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

describe('tenant isolation', () => {
  it('an editor from tenant A cannot read a page belonging to tenant B', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage } = await import('@/lib/models/page')
    const tenantA = await createTenant({ name: 'A', customDomain: 'a.example.com' })
    const tenantB = await createTenant({ name: 'B', customDomain: 'b.example.com' })
    const pageB = await createPage({ tenantId: tenantB._id, slug: 'secret', title: 'Secret' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', email: 'a@a.com', role: 'editor', tenantId: tenantA._id.toString() },
    } as never)

    const { GET } = await import('@/app/api/pages/[pageId]/route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ pageId: pageB._id.toString() }) })
    expect(res.status).toBe(404)
  })

  it('an editor cannot read another tenant\'s page by passing its tenantId as a query param', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage } = await import('@/lib/models/page')
    const tenantA = await createTenant({ name: 'C', customDomain: 'c.example.com' })
    const tenantB = await createTenant({ name: 'D', customDomain: 'd.example.com' })
    const pageB = await createPage({ tenantId: tenantB._id, slug: 'home', title: 'Home' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u2', email: 'a@c.com', role: 'editor', tenantId: tenantA._id.toString() },
    } as never)

    const { GET } = await import('@/app/api/pages/[pageId]/route')
    const req = new Request(`http://localhost?tenantId=${tenantB._id.toString()}`)
    const res = await GET(req, { params: Promise.resolve({ pageId: pageB._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('a superadmin can read pages across tenants by specifying tenantId', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'E', customDomain: 'e.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin', email: 'admin@x.com', role: 'superadmin', tenantId: null },
    } as never)

    const { GET } = await import('@/app/api/pages/[pageId]/route')
    const req = new Request(`http://localhost?tenantId=${tenant._id.toString()}`)
    const res = await GET(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run the isolation suite to verify it passes**

Run: `npm test -- tests/integration/tenant-isolation.test.ts`
Expected: PASS (3 tests) — the `?tenantId=` query-param handling was already added to `GET /api/pages/:pageId` in Task 6 Step 5, so no production code changes are needed here.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS (all unit/integration/component tests across every task)

- [ ] **Step 4: Write the E2E seed helper**

```typescript
// tests/e2e/seed.ts
import { MongoClient, ObjectId } from 'mongodb'
import { hash } from 'bcryptjs'

export async function seedE2eTenant() {
  const client = new MongoClient(process.env.MONGODB_URI!)
  await client.connect()
  const db = client.db()

  const tenantId = new ObjectId()
  await db.collection('tenants').insertOne({
    _id: tenantId,
    name: 'E2E Tenant',
    customDomain: 'e2e.localhost',
    createdAt: new Date(),
  })

  const passwordHash = await hash('e2e-password', 10)
  await db.collection('users').insertOne({
    _id: new ObjectId(),
    email: 'e2e@example.com',
    passwordHash,
    role: 'editor',
    tenantId,
  })

  const pageId = new ObjectId()
  await db.collection('pages').insertOne({
    _id: pageId,
    tenantId,
    slug: 'home',
    title: 'Home',
    draft: { blocks: [], seo: {} },
    published: null,
    publishedVersion: null,
    updatedAt: new Date(),
  })

  await client.close()
  return { tenantId: tenantId.toString(), pageId: pageId.toString() }
}
```

- [ ] **Step 5: Write `tests/e2e/happy-path.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'
import { seedE2eTenant } from './seed'

test('login, edit a block, preview, publish, and roll back', async ({ page }) => {
  const { pageId } = await seedE2eTenant()

  await page.goto('/login')
  await page.getByPlaceholder('Email').fill('e2e@example.com')
  await page.getByPlaceholder('Password').fill('e2e-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin/)

  await page.goto(`/admin/pages/${pageId}/edit`)
  await page.getByRole('button', { name: /add text block/i }).click()
  await page.getByLabel(/body/i).fill('Hello from Playwright')
  await page.getByRole('button', { name: /save draft/i }).click()

  await page.goto(`/api/preview?pageId=${pageId}`)
  await expect(page.getByText('Hello from Playwright')).toBeVisible()

  await page.goto(`/admin/pages/${pageId}/edit`)
  await page.getByRole('button', { name: /^publish$/i }).click()

  await page.goto(`/admin/pages/${pageId}/versions`)
  await expect(page.getByText(/version 1/i)).toBeVisible()
  await page.getByRole('button', { name: /roll back/i }).first().click()
})
```

- [ ] **Step 6: Run the E2E spec**

Run: `npm run test:e2e`
Expected: PASS (requires `MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` set in the environment running the test)

- [ ] **Step 7: Commit**

```bash
git add tests/integration/tenant-isolation.test.ts tests/e2e
git commit -m "test: tenant isolation suite and E2E happy path"
```

---

### Task 16: Deployment

**Files:**
- None (infrastructure/config steps, run from the repo root)

**Interfaces:**
- Consumes: the full app built in Tasks 1–15.
- Produces: a live Vercel deployment reachable at the project's default domain, with each client's custom domain routed to it.

- [ ] **Step 1: Push the repo to GitHub**

```bash
gh repo create client-cms --private --source=. --remote=origin
git push -u origin master
```

Expected: repo visible at `https://github.com/<your-account>/client-cms`.

- [ ] **Step 2: Create the MongoDB Atlas database**

In Atlas: create a cluster (if one doesn't already exist), create a database user, and copy the connection string. This becomes `MONGODB_URI`.

- [ ] **Step 3: Create the Vercel project and connect the GitHub repo**

```bash
vercel link
```

Follow the prompts to create a new Vercel project linked to the `client-cms` GitHub repo.

- [ ] **Step 4: Set environment variables in Vercel**

```bash
vercel env add MONGODB_URI production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production
vercel env add OPENROUTER_API_KEY production
vercel env add BLOB_READ_WRITE_TOKEN production
```

Generate `NEXTAUTH_SECRET` with: `openssl rand -base64 32`
Get `BLOB_READ_WRITE_TOKEN` by creating a Blob store in the Vercel dashboard (Storage → Blob → Create).
Set `NEXTAUTH_URL` to the production URL Vercel assigns (or the app's default domain once known).

- [ ] **Step 5: Deploy**

```bash
vercel --prod
```

Expected: deployment succeeds; visiting the printed URL redirects to `/login`.

- [ ] **Step 6: Create the first superadmin user**

Run once against production, from a machine with `MONGODB_URI` set to the production connection string:

```bash
node -e "
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD, 10);
  await client.db().collection('users').insertOne({
    _id: new ObjectId(), email: process.env.SEED_EMAIL, passwordHash, role: 'superadmin', tenantId: null,
  });
  await client.close();
  console.log('Superadmin created');
})();
"
```

Run with `SEED_EMAIL` and `SEED_PASSWORD` set as environment variables for that command only (never commit them).

- [ ] **Step 7: Add a client's custom domain**

For each client site:
1. In the Vercel project settings → Domains, add the client's domain (e.g. `clienta.com`).
2. Point the client's DNS at Vercel per the instructions Vercel shows (A/CNAME record).
3. Once verified, create the matching `Tenant` document:

```bash
node -e "
const { MongoClient, ObjectId } = require('mongodb');
(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  await client.db().collection('tenants').insertOne({
    _id: new ObjectId(), name: process.env.TENANT_NAME, customDomain: process.env.TENANT_DOMAIN, createdAt: new Date(),
  });
  await client.close();
  console.log('Tenant created');
})();
"
```

- [ ] **Step 8: Verify end-to-end in production**

Visit the client's domain — it should render the tenant's site (empty/blank until pages are published). Visit the app's own domain — it should redirect to `/login`, and logging in as the superadmin should show the tenant switcher and page list.
