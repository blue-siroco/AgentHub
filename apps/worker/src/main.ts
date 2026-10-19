import { ConfigError, loadWorkerConfig, type WorkerConfig } from '@baziar/config';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { pino } from 'pino';
import { createHealthServer } from './health.js';

// Nombre provisional: el contrato de colas y jobs se definirá en packages/queue (fase 6).
const PUBLISH_QUEUE = 'artifact-publish';

function loadConfigOrExit(): WorkerConfig {
  try {
    return loadWorkerConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const config = loadConfigOrExit();
const logger = pino({ level: config.LOG_LEVEL });

// BullMQ exige maxRetriesPerRequest = null en las conexiones de workers bloqueantes.
const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker(
  PUBLISH_QUEUE,
  async (job) => {
    // Falla de forma explícita en lugar de marcar como publicada una versión no validada.
    throw new Error(`Procesamiento de ${job.name} aún no implementado`);
  },
  { connection, concurrency: config.WORKER_CONCURRENCY },
);

worker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, queue: PUBLISH_QUEUE, reason: error.message }, 'job fallido');
});
worker.on('error', (error) => logger.error({ err: error }, 'error del worker'));

const healthServer = createHealthServer(async () => {
  if (!worker.isRunning()) return false;
  return (await connection.ping()) === 'PONG';
});
healthServer.listen(config.WORKER_HEALTH_PORT, () => {
  logger.info({ queue: PUBLISH_QUEUE, port: config.WORKER_HEALTH_PORT }, 'worker iniciado');
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'apagando worker');
  healthServer.close();
  // close() espera a que terminen los jobs en curso antes de soltar la conexión.
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
