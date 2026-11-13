import type { NextConfig } from 'next'

const config: NextConfig = {
  // The pipeline is plain Node ESM that imports './x.js' for './x.ts'.
  webpack: (c) => {
    c.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] }
    return c
  },
}
export default config
