export function salt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('')
}
export async function pinHash(pin: string, salt: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 210_000,
      hash: 'SHA-256',
    },
    key,
    256,
  )
  return Array.from(new Uint8Array(bits), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('')
}
