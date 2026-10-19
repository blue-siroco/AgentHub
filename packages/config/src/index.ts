import { z } from 'zod';

const appEnv = z.enum(['development', 'test', 'production']);

const booleanFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const logLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info');

const storageSchema = z.object({
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_PACKAGES: z.string().min(3),
  S3_FORCE_PATH_STYLE: booleanFlag,
});

const apiSchema = storageSchema
  .extend({
    APP_ENV: appEnv,
    LOG_LEVEL: logLevel,
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    MAIL_FROM: z.email(),
    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((value) => value.split(',').map((origin) => origin.trim())),
    AUTH_DEV_EMAIL_LOGIN: booleanFlag,
  })
  // El login de desarrollo por email no verifica identidad real: nunca en producción.
  .refine((config) => !(config.APP_ENV === 'production' && config.AUTH_DEV_EMAIL_LOGIN), {
    message: 'AUTH_DEV_EMAIL_LOGIN no puede habilitarse con APP_ENV=production',
    path: ['AUTH_DEV_EMAIL_LOGIN'],
  });

const workerSchema = storageSchema.extend({
  APP_ENV: appEnv,
  LOG_LEVEL: logLevel,
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(3002),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
});

export type ApiConfig = z.infer<typeof apiSchema>;
export type WorkerConfig = z.infer<typeof workerSchema>;

export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Configuración inválida:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

type Env = Record<string, string | undefined>;

function parse<T>(schema: z.ZodType<T>, env: Env): T {
  const result = schema.safeParse(env);
  if (!result.success) {
    // Solo se informa la variable y el motivo; nunca el valor, que puede ser un secreto.
    throw new ConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.message}`),
    );
  }
  return result.data;
}

export function loadApiConfig(env: Env = process.env): ApiConfig {
  return parse(apiSchema, env);
}

export function loadWorkerConfig(env: Env = process.env): WorkerConfig {
  return parse(workerSchema, env);
}
