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
