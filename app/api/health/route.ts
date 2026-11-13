import { health } from '../../../src/server/auth'

export const dynamic = 'force-dynamic'

// Public on purpose: it reports configuration names and kinds only, never values or data.
export function GET() {
  return Response.json(health())
}
