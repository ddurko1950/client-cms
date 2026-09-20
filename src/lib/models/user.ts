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
