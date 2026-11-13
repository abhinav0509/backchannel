import type { NextConfig } from 'next'
import { withWorkflow } from 'workflow/next'

const config: NextConfig = {
  // Database drivers stay as Node modules rather than being bundled (PGlite ships WASM).
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
}
export default withWorkflow(config)
