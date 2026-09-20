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

let indexesEnsured = false

export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  const db = client.db()
  if (!indexesEnsured) {
    indexesEnsured = true
    await Promise.all([
      db.collection('tenants').createIndex({ customDomain: 1 }, { unique: true }),
      db.collection('pages').createIndex({ tenantId: 1, slug: 1 }, { unique: true }),
      db.collection('pageVersions').createIndex({ pageId: 1, versionNumber: 1 }, { unique: true }),
      db.collection('users').createIndex({ email: 1 }, { unique: true }),
    ])
  }
  return db
}
