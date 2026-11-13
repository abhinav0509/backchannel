import { list } from '../src/server/api.js'
export const dynamic = 'force-dynamic'
export default function Page() {
  return <pre>{JSON.stringify(list().body).slice(0, 200)}</pre>
}
