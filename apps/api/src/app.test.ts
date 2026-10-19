import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const ok = async () => {};
const failing = async () => {
  throw new Error('connection refused');
};

describe('health', () => {
  it('liveness responde sin consultar dependencias', async () => {
    const app = await buildApp({ corsOrigins: [], readinessChecks: { postgres: failing } });
    const response = await app.inject({ method: 'GET', url: '/health/live' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('readiness devuelve 200 cuando todas las dependencias responden', async () => {
    const app = await buildApp({
      corsOrigins: [],
      readinessChecks: { postgres: ok, redis: ok, storage: ok },
    });
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      checks: { postgres: 'ok', redis: 'ok', storage: 'ok' },
    });
  });

  it('readiness devuelve 503 sin filtrar el detalle del error', async () => {
    const app = await buildApp({
      corsOrigins: [],
      readinessChecks: { postgres: ok, redis: failing },
    });
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'unavailable',
      checks: { postgres: 'ok', redis: 'unavailable' },
    });
    expect(response.body).not.toContain('connection refused');
  });
});
