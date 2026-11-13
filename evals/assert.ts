/**
 * Reads a dotted path. A segment ending in [] maps the rest of the path over an array:
 * 'flags[].kind' -> ['layoff_history', ...]. '.length' works on arrays and strings.
 */
export function get(v: unknown, path: string): unknown {
  if (path === '') return v
  const [head = '', ...rest] = path.split('.')
  if (head.endsWith('[]')) {
    const arr = get(v, head.slice(0, -2))
    return Array.isArray(arr) ? arr.map((x) => get(x, rest.join('.'))) : undefined
  }
  if (v === null || v === undefined) return undefined
  return get((v as Record<string, unknown>)[head], rest.join('.'))
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof RegExp)
const show = (v: unknown) => (v instanceof RegExp ? String(v) : JSON.stringify(v))

/**
 * Expectation forms: a plain value (strict equality), { min, max } on a number,
 * { contains: [...] } on an array, { contains_match: /re/ } on an array of strings.
 * Returns null on pass, or a failure message.
 */
export function check(actual: unknown, exp: unknown): string | null {
  if (isObj(exp) && ('min' in exp || 'max' in exp)) {
    if (typeof actual !== 'number') return `expected a number, got ${show(actual)}`
    if (typeof exp.min === 'number' && actual < exp.min) return `expected >= ${exp.min}, got ${actual}`
    if (typeof exp.max === 'number' && actual > exp.max) return `expected <= ${exp.max}, got ${actual}`
    return null
  }
  if (isObj(exp) && Array.isArray(exp.contains)) {
    if (!Array.isArray(actual)) return `expected an array, got ${show(actual)}`
    const missing = exp.contains.filter((x) => !actual.includes(x))
    return missing.length ? `missing ${show(missing)} in ${show(actual)}` : null
  }
  if (isObj(exp) && exp.contains_match instanceof RegExp) {
    const re = exp.contains_match
    if (!Array.isArray(actual)) return `expected an array, got ${show(actual)}`
    return actual.some((x) => typeof x === 'string' && re.test(x)) ? null : `no entry matches ${re}`
  }
  return Object.is(actual, exp) ? null : `expected ${show(exp)}, got ${show(actual)}`
}
