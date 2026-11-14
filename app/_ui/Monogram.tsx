/** A company's initials on a tile whose hue comes from its name: stable, and easy to find again in a list. */
export function Monogram({ name, size = 36 }: { name: string | null; size?: number }) {
  const text = (name ?? '?').trim()
  const initials =
    text
      .split(/\s+/)
      .filter((w) => /^[\p{L}\p{N}]/u.test(w))
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase()) // non-null: filtered to words with a first letter
      .join('') || '?'
  let h = 0
  for (const ch of text.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center font-bold tracking-[-0.04em] select-none"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        fontSize: size * (initials.length > 1 ? 0.36 : 0.44),
        background: `light-dark(oklch(0.93 0.045 ${h}), oklch(0.3 0.06 ${h}))`,
        color: `light-dark(oklch(0.38 0.11 ${h}), oklch(0.86 0.08 ${h}))`,
      }}
    >
      {initials}
    </span>
  )
}
