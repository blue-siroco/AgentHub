import cors from '@fastify/cors';
import Fastify, { type FastifyServerOptions } from 'fastify';

export type DependencyCheck = () => Promise<void>;

export interface AppOptions {
  corsOrigins: string[];
  readinessChecks: Record<string, DependencyCheck>;
  logger?: FastifyServerOptions['logger'];
}

const READINESS_TIMEOUT_MS = 2_000;

function withTimeout(check: DependencyCheck): Promise<void> {
  return Promise.race([
    check(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), READINESS_TIMEOUT_MS).unref(),
    ),
  ]);
}

export async function buildApp(options: AppOptions) {
  const app = Fastify({
    logger: options.logger ?? false,
    // Límite conservador por defecto; las rutas de upload definirán el suyo propio.
    bodyLimit: 1_048_576,
  });

  await app.register(cors, { origin: options.corsOrigins });

  // Liveness: el proceso responde. No consulta dependencias para no provocar reinicios en cascada.
  app.get('/health/live', async () => ({ status: 'ok' }));

  // Readiness: el servicio puede atender tráfico porque sus dependencias responden.
  app.get('/health/ready', async (request, reply) => {
    const entries = await Promise.all(
      Object.entries(options.readinessChecks).map(async ([name, check]) => {
        try {
          await withTimeout(check);
          return [name, 'ok'] as const;
        } catch (error) {
          request.log.warn({ dependency: name, err: error }, 'dependencia no disponible');
          return [name, 'unavailable'] as const;
        }
      }),
    );
    const checks = Object.fromEntries(entries);
    const ready = entries.every(([, state]) => state === 'ok');
    return reply.code(ready ? 200 : 503).send({ status: ready ? 'ok' : 'unavailable', checks });
  });

  return app;
}
