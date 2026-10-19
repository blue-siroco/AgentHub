import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { type ApiConfig, ConfigError, loadApiConfig } from '@baziar/config';
import { Redis } from 'ioredis';
import postgres from 'postgres';
import { buildApp } from './app.js';

function loadConfigOrExit(): ApiConfig {
  try {
    return loadApiConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const config = loadConfigOrExit();

const sql = postgres(config.DATABASE_URL, { max: 5, connect_timeout: 5 });
const redis = new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: config.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
  },
});
const bucket = config.S3_BUCKET_PACKAGES;

const app = await buildApp({
  corsOrigins: config.CORS_ORIGINS,
  logger: { level: config.LOG_LEVEL },
  readinessChecks: {
    postgres: async () => {
      await sql`select 1`;
    },
    redis: async () => {
      await redis.ping();
    },
    storage: async () => {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    },
  },
});

async function shutdown(signal: string) {
  app.log.info({ signal }, 'apagando API');
  await app.close();
  await Promise.allSettled([sql.end({ timeout: 5 }), redis.quit()]);
  s3.destroy();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

await redis.connect().catch((error: unknown) => {
  // Redis puede no estar listo aún; readiness lo reflejará y ioredis reintentará.
  app.log.warn({ err: error }, 'conexión inicial a Redis fallida');
});
await app.listen({ host: config.API_HOST, port: config.API_PORT });
