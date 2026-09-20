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
