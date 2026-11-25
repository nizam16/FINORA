export async function api<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    body === undefined ? 8_000 : 50_000,
  )
  try {
    const response = await fetch('/api/' + path, {
      ...(body === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.headers.get('Content-Type')?.includes('application/json'))
      throw Error('Fitur Google tersedia setelah backend dikonfigurasi.')
    const result = await response.json()
    if (!response.ok) throw Error(result.error || 'Permintaan gagal.')
    return result as T
  } catch (e) {
    if (controller.signal.aborted)
      throw Error('Waktu permintaan habis. Coba kembali saat terhubung.')
    throw e
  } finally {
    clearTimeout(timeout)
  }
}
export interface Session {
  id: string
  name: string
  email: string
}
