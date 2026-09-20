import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer | undefined

export async function setupTestDb() {
  mongod = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongod.getUri()
}

export async function teardownTestDb() {
  await mongod?.stop()
}
