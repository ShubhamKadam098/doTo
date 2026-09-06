let counter = 0

/** Stable, collision-resistant id that does not require crypto.randomUUID. */
export function createId(): string {
  counter = (counter + 1) % 0xffff
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}
