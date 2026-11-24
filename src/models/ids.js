let counter = 0;

/** Stable-ish unique id. Kept in its own module so every layer can import it. */
export function createId(prefix = "id") {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${random}`;
}
