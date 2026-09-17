/** PRNG determinístico (mulberry32) para tornar cada execução reproduzível pela seed. */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: string, salt = "") {
  let a = hashSeed(`${seed}::${salt}`);
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length) % items.length];
  if (item === undefined) throw new Error("Não é possível sortear em uma lista vazia.");
  return item;
}

export function randomSeed(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += alfabeto[crypto.getRandomValues(new Uint8Array(1))[0]! % alfabeto.length];
  }
  return out;
}
