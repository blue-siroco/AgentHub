// Liveness del servidor web. No consulta la API para que una caída de la API no reinicie la web.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok' });
}
