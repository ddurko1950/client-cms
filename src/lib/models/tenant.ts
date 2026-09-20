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
