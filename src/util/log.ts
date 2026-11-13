// Structured JSON to stderr; stdout is kept for the human-readable summary.
export function log(event: string, data: Record<string, unknown> = {}): void {
  process.stderr.write(JSON.stringify({ t: new Date().toISOString(), event, ...data }) + '\n')
}
