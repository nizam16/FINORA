// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../backend/functions/api.mjs'
import {
  readTables,
  tables,
  spreadsheetID,
  TABS,
} from '../../backend/sheets.mjs'
import { initial } from '../database'
const origin = 'https://finora.example'
const user = 'google-test'
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
describe('server routes and Sheets serialization', () => {
  it('offers demo without credentials', async () => {
    vi.stubEnv('FINORA_KEY', '')
    const r = await handler(new Request(origin + '/api/session'))
    expect(await r.json()).toEqual({ google: false })
    expect(r.headers.get('cache-control')).toBe('no-store')
  })
  it('rejects unauthorized and cross-origin writes', async () => {
    vi.stubEnv('FINORA_ORIGIN', origin)
    vi.stubEnv('FINORA_KEY', Buffer.alloc(32, 3).toString('base64url'))
    vi.stubEnv('FINORA_SCRIPT_URL', 'https://script.google.com/macros/s/example/exec')
    vi.stubEnv('FINORA_SCRIPT_SECRET', 'a'.repeat(43))
    vi.stubEnv('FINORA_ACCESS_CODE', 'b'.repeat(43))
    const call = (from: string) =>
      handler(
        new Request(origin + '/api/sheet/write', {
          method: 'POST',
          headers: { origin: from, 'content-type': 'application/json' },
          body: '{}',
        }),
      )
    expect((await call('https://third.example')).status).toBe(403)
    expect((await call(origin)).status).toBe(401)
  })
  it('round-trips the user ledger and rejects foreign accounts', () => {
    const d = initial(true)
    const t = tables(d, user)
    expect(Object.keys(t)).toEqual(TABS)
    expect(readTables(t, user)).toEqual(d)
    expect(() => readTables(t, 'google-other')).toThrow()
    expect(() => spreadsheetID('https://other.example/x')).toThrow()
    expect(
      spreadsheetID(
        'https://docs.google.com/spreadsheets/d/1234567890123456789012/edit',
      ),
    ).toBe('1234567890123456789012')
  })
  it('rejects expired or missing sessions without calling Apps Script', async () => {
    const fetcher=vi.fn()
    vi.stubGlobal('fetch',fetcher)
    const r=await handler(new Request(origin+'/api/sheet/read',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'}))
    expect([401,503]).toContain(r.status)
    expect(fetcher).not.toHaveBeenCalled()
  })
})

it('limits Web Push endpoints to supported HTTPS providers', async () => {
  const { normalizeSubscription } = await import('../../backend/push.mjs')
  const keys = { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) }
  expect(
    normalizeSubscription({
      endpoint: 'https://web.push.apple.com/device',
      keys,
    }),
  ).toMatchObject({ keys })
  expect(() =>
    normalizeSubscription({
      endpoint: 'https://fcm.googleapis.com.evil.example/x',
      keys,
    }),
  ).toThrow()
  expect(() =>
    normalizeSubscription({
      endpoint: 'https://fcm.googleapis.com:8080/x',
      keys,
    }),
  ).toThrow()
})
