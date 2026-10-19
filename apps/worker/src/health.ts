import { createServer, type Server } from 'node:http';

export type ReadinessProbe = () => Promise<boolean>;

/**
 * Servidor HTTP mínimo solo para healthchecks del contenedor: el worker no expone API
 * y este puerto no se publica al host.
 */
export function createHealthServer(isReady: ReadinessProbe): Server {
  return createServer((request, response) => {
    const send = (status: number, body: object) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };

    if (request.method !== 'GET') return send(405, { status: 'method_not_allowed' });
    if (request.url === '/health/live') return send(200, { status: 'ok' });
    if (request.url === '/health/ready') {
      isReady()
        .catch(() => false)
        .then((ready) => send(ready ? 200 : 503, { status: ready ? 'ok' : 'unavailable' }));
      return;
    }
    return send(404, { status: 'not_found' });
  });
}
