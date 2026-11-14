import Link from 'next/link'

/** The mark is the product's signal: six bars of uneven height, the way a report reads at a glance. */
export function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 rounded-md text-[17px] font-bold tracking-[-0.035em]">
      <svg width="20" height="18" viewBox="0 0 20 18" aria-hidden>
        {[9, 14, 6, 18, 11, 15].map((h, i) => (
          <rect key={i} x={i * 3.4} y={18 - h} width="2.2" height={h} rx="1.1" fill={i === 3 ? 'var(--accent)' : 'currentColor'} />
        ))}
      </svg>
      Backchannel
    </Link>
  )
}
