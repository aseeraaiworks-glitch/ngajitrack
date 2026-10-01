import { bootstrapContext } from '@/application/bootstrap-context';

export const dynamic = 'force-dynamic';

// Session cookie only. No caller-supplied identity, role, tenant or service key.
export async function GET() {
  const result = await bootstrapContext();
  return Response.json({ userId: result.userId, contexts: result.contexts }, {
    status: result.status === 'error' ? 503 : 200,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
  });
}
