import { beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-paypilot-ai-unit-tests';
process.env.PAYPAL_CLIENT_ID = '';
process.env.PAYPAL_CLIENT_SECRET = '';
process.env.AI_API_KEY = '';
process.env.MONGODB_URI = '';

let mem: MongoMemoryServer | undefined;

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('paypilot_test'));
}, 180_000);

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoose.disconnect();
  if (mem) await mem.stop();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});
