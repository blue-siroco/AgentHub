import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createHealthServer, type ReadinessProbe } from './health.js';

let close: (() => void) | undefined;

async function start(probe: ReadinessProbe): Promise<string> {
  const server = createHealthServer(probe);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  close = () => server.close();
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

afterEach(() => close?.());

describe('createHealthServer', () => {
  it('liveness no depende de la readiness', async () => {
    const base = await start(async () => false);
    const response = await fetch(`${base}/health/live`);
    expect(response.status).toBe(200);
  });

  it('readiness refleja el estado de las dependencias', async () => {
    const base = await start(async () => true);
    expect((await fetch(`${base}/health/ready`)).status).toBe(200);
  });

  it('readiness devuelve 503 si la sonda falla', async () => {
    const base = await start(async () => {
      throw new Error('redis caído');
    });
    const response = await fetch(`${base}/health/ready`);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('redis caído');
  });
});
