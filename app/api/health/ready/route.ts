import { checkReadiness } from '@/src/server/services/health.service';
import { jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { statusCode, data } = await checkReadiness();
  return jsonResponse(data, statusCode);
}
