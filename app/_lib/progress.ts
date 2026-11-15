/**
 * Progress for work whose length is known only roughly, such as one long model call. The bar eases
 * toward 95% of the way over the expected time and never claims to be finished; the steps advance
 * on the same clock but the last waits for the real result. Past 125% of the usual time it says so.
 */
export function estimate(elapsedS: number, expectedS: number, steps: number, done = false): { fraction: number; step: number; slow: boolean } {
  if (done) return { fraction: 1, step: steps, slow: false }
  const fraction = 0.96 * (1 - Math.exp((-2.2 * elapsedS) / expectedS))
  const step = Math.min(steps - 1, Math.floor((elapsedS / expectedS) * steps))
  return { fraction, step, slow: elapsedS > expectedS * 1.25 }
}
