import { checkLiveness } from '@/src/server/services/health.service';
import { jsonResponse } from '@/src/server/http/respond';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = checkLiveness();
  return jsonResponse(result, 200);
}
