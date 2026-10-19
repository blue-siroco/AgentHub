// Página provisional de la fase de fundación: confirma que web → API funciona dentro de Compose.
// La landing y el marketplace se construyen en la fase 7 del roadmap.
export const dynamic = 'force-dynamic';

async function getApiStatus(): Promise<string> {
  const apiUrl = process.env.API_INTERNAL_URL;
  if (!apiUrl) return 'API_INTERNAL_URL no configurada';
  try {
    const response = await fetch(`${apiUrl}/health/ready`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok ? 'disponible' : `no disponible (${response.status})`;
  } catch {
    return 'no alcanzable';
  }
}

export default async function HomePage() {
  const apiStatus = await getApiStatus();
  return (
    <main>
      <h1>Baziar</h1>
      <p>Marketplace de skills, agents, commands y hooks para Claude Code, Copilot CLI y OpenCode.</p>
      <p role="status">Estado de la API: {apiStatus}</p>
    </main>
  );
}
