import { describe, expect, it } from 'vitest';
import { ConfigError, loadApiConfig, loadWorkerConfig } from './index.js';

const storageEnv = {
  S3_ENDPOINT: 'http://localstack:4566',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'test',
  S3_SECRET_ACCESS_KEY: 'test',
  S3_BUCKET_PACKAGES: 'baziar-packages',
  S3_FORCE_PATH_STYLE: 'true',
};

const apiEnv = {
  ...storageEnv,
  APP_ENV: 'development',
  DATABASE_URL: 'postgres://baziar:baziar@postgres:5432/baziar',
  REDIS_URL: 'redis://redis:6379',
  SMTP_HOST: 'mailpit',
  SMTP_PORT: '1025',
  MAIL_FROM: 'no-reply@baziar.local',
  CORS_ORIGINS: 'http://localhost:3000, http://127.0.0.1:3000',
  AUTH_DEV_EMAIL_LOGIN: 'true',
};

const workerEnv = {
  ...storageEnv,
  APP_ENV: 'development',
  DATABASE_URL: apiEnv.DATABASE_URL,
  REDIS_URL: apiEnv.REDIS_URL,
};

describe('loadApiConfig', () => {
  it('parsea una configuración local válida', () => {
    const config = loadApiConfig(apiEnv);
    expect(config.API_PORT).toBe(3001);
    expect(config.SMTP_PORT).toBe(1025);
    expect(config.S3_FORCE_PATH_STYLE).toBe(true);
    expect(config.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
  });

  it('falla si falta una variable requerida', () => {
    const { DATABASE_URL: _omitted, ...env } = apiEnv;
    expect(() => loadApiConfig(env)).toThrow(ConfigError);
  });

  it('impide el login de desarrollo en producción', () => {
    expect(() => loadApiConfig({ ...apiEnv, APP_ENV: 'production' })).toThrow(
      /AUTH_DEV_EMAIL_LOGIN/,
    );
    const config = loadApiConfig({
      ...apiEnv,
      APP_ENV: 'production',
      AUTH_DEV_EMAIL_LOGIN: 'false',
    });
    expect(config.AUTH_DEV_EMAIL_LOGIN).toBe(false);
  });

  it('no incluye el valor recibido en el mensaje de error', () => {
    const leaked = 'valor-que-no-debe-aparecer';
    try {
      loadApiConfig({ ...apiEnv, S3_FORCE_PATH_STYLE: leaked });
      expect.fail('debería haber lanzado ConfigError');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).message).not.toContain(leaked);
    }
  });
});

describe('loadWorkerConfig', () => {
  it('aplica valores por defecto', () => {
    const config = loadWorkerConfig(workerEnv);
    expect(config.WORKER_HEALTH_PORT).toBe(3002);
    expect(config.WORKER_CONCURRENCY).toBe(2);
  });

  it('rechaza una concurrencia fuera de rango', () => {
    expect(() => loadWorkerConfig({ ...workerEnv, WORKER_CONCURRENCY: '0' })).toThrow(ConfigError);
  });
});
