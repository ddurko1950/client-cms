import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import type { PageContent } from '@/lib/blocks/schema'

export type { PageContent }

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
