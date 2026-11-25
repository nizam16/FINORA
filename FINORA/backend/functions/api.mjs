import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { EncryptJWT, jwtDecrypt } from 'jose'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { validateData } from '../../src/utils/validation.ts'
import { HttpError, spreadsheetID, tables } from '../sheets.mjs'
import { scriptCall } from '../apps-script.mjs'
import { pushConfig, registerPush, unregisterPush } from '../push.mjs'
const cryptoRandom = () => randomBytes(32).toString('base64url')
const keyHash = (s) => createHash('sha256').update(s).digest('base64url')
const names = {
  session: '__Host-finora',
  challenge: '__Host-finora-passkey',
}
const clear = (name) => cookie(name, '', 0)
const cookie = (name, value, age) =>
  name +
  '=' +
  value +
  '; Path=/; Max-Age=' +
  age +
  '; Secure; HttpOnly; SameSite=Lax'
const cookieValue = (req, name) =>
  req.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + '='))
    ?.slice(name.length + 1) || ''
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
}
const json = (body, status = 200, cookies = []) =>
  response(
    JSON.stringify(body),
    status,
    { 'Content-Type': 'application/json; charset=utf-8' },
    cookies,
  )
function response(body, status, extra = {}, cookies = []) {
  const h = new Headers({ ...headers, ...extra })
  for (const c of cookies) h.append('Set-Cookie', c)
  return new Response(body, { status, headers: h })
}
function redirect(location, cookies = []) {
  return response(null, 303, { Location: location }, cookies)
}
function config() {
  const { FINORA_ORIGIN: origin, FINORA_KEY: encoded, FINORA_ACCESS_CODE: code,
    FINORA_SCRIPT_URL: script, FINORA_SCRIPT_SECRET: secret } = process.env
  if (!origin || !encoded || !code || !script || !secret) return
  const key = Buffer.from(encoded, 'base64url')
  const url = new URL(origin)
  if (key.length !== 32 || url.protocol !== 'https:' || url.origin !== origin ||
      !/^[A-Za-z0-9_-]{43}$/.test(code) || !/^[A-Za-z0-9_-]{43}$/.test(secret) ||
      !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(script)) return
  const account = { id:'apps-script-'+keyHash(script).slice(0,22), name:'Pemilik FINORA',
    email:'finora-owner', grant:keyHash(code) }
  return { origin, key, code, script, secret, account, rpID:url.hostname }
}
async function seal(c, claims, age) {
  return new EncryptJWT(claims)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(age)
    .encrypt(c.key)
}
async function unseal(c, token, kind) {
  try {
    const { payload } = await jwtDecrypt(token, c.key, {
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
    })
    return payload.kind === kind ? payload : null
  } catch {
    return null
  }
}
async function readBody(req) {
  if (!req.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'Gunakan JSON.')
  if (Number(req.headers.get('content-length') || 0) > 5_000_000)
    throw new HttpError(413, 'Permintaan terlalu besar.')
  const body = await req.text()
  if (body.length > 5_000_000)
    throw new HttpError(413, 'Permintaan terlalu besar.')
  try {
    const data = JSON.parse(body)
    if (data && typeof data === 'object' && !Array.isArray(data)) return data
  } catch {}
  throw new HttpError(400, 'JSON tidak valid.')
}
const publicSession = ({ id, name, email }) => ({ id, name, email })
const store = () =>
  getStore({ name: 'finora-secure-v1', consistency: 'strong' })
const sessionDuration = 60 * 60 * 12
async function getSession(req, c) {
  const sid = cookieValue(req, names.session)
  if (!/^[\w-]{43}$/.test(sid)) return null
  const token = await store().get('session/' + keyHash(sid))
  const session = token ? await unseal(c, token, 'session') : null
  if (!session) return null
  const account = await getAccount(c, session.id)
  return account && account.grant === session.grant ? { ...session, sid } : null
}
async function createSession(c, user, old) {
  if (old) await store().delete('session/' + keyHash(old.sid))
  const sid = cryptoRandom()
  await store().set(
    'session/' + keyHash(sid),
    await seal(
      c,
      { kind: 'session', ...publicSession(user), grant: user.grant },
      sessionDuration + 's',
    ),
  )
  return cookie(names.session, sid, sessionDuration)
}
async function getAccount(c, id) {
  return c.account.id === id ? c.account : null
}
async function challengeCookie(c, challenge, purpose, session) {
  return cookie(
    names.challenge,
    await seal(
      c,
      { kind: 'challenge', challenge, purpose, id: session?.id || '' },
      '5m',
    ),
    300,
  )
}
async function useChallenge(req, c, purpose, id = '') {
  const value = await unseal(c, cookieValue(req, names.challenge), 'challenge')
  if (!value || value.purpose !== purpose || value.id !== id)
    throw new HttpError(400, 'Tantangan Passkey sudah kedaluwarsa.')
  const result = await store().set('used/' + keyHash(value.challenge), '1', {
    onlyIfNew: true,
  })
  if (!result.modified)
    throw new HttpError(409, 'Tantangan Passkey sudah dipakai.')
  return value.challenge
}
function loginPage(error = '', status = 200) {
  return response(`<!doctype html><html lang="id"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Masuk FINORA</title><style>body{background:#0d0d0d;color:#f5f5f7;font:16px system-ui;max-width:32rem;margin:15vh auto;padding:20px}label,input{display:block}input,button{padding:12px;margin:10px 0;font:inherit}button,a{color:#d4af37}button{background:#1c1c1e;border:1px solid #d4af37}</style><h1>Masuk FINORA</h1><p>Gunakan kode akses pribadi dari pengaturan hosting FINORA.</p><form method="post" action="/api/login"><label>Kode akses<input name="code" type="password" maxlength="43" required autocomplete="current-password"></label><button>Masuk</button></form><p role="alert">${error}</p><a href="/">Kembali ke FINORA</a></html>`,status,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"})
}
async function passkeys(path, req, c, session, body) {
  if (path === 'passkey/options') {
    const options = await generateAuthenticationOptions({
      rpID: c.rpID,
      userVerification: 'required',
    })
    return json(options, 200, [
      await challengeCookie(c, options.challenge, 'authenticate'),
    ])
  }
  if (path === 'passkey/verify') {
    const expectedChallenge = await useChallenge(req, c, 'authenticate')
    if (typeof body.id !== 'string' || !/^[-\w]{1,1300}$/.test(body.id))
      throw new HttpError(400, 'Passkey tidak valid.')
    const key = 'credential/' + keyHash(body.id)
    const stored = await store().getWithMetadata(key, { type: 'json' })
    const record = stored?.data
    if (!record) throw new HttpError(401, 'Passkey belum terdaftar.')
    const { id, publicKey, counter, transports } = record
    const result = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: c.origin,
      expectedRPID: c.rpID,
      credential: {
        id,
        publicKey: Buffer.from(publicKey, 'base64url'),
        counter,
        transports,
      },
      requireUserVerification: true,
    }).catch(() => null)
    if (!result?.verified)
      throw new HttpError(401, 'Passkey gagal diverifikasi.')
    const account = await getAccount(c, record.account)
    if (!account || record.grant !== account.grant) throw new HttpError(401, 'Masuk kembali dengan kode akses dan daftarkan Passkey baru.')
    const saved = await store().setJSON(
      key,
      { ...record, counter: result.authenticationInfo.newCounter },
      { onlyIfMatch: stored.etag },
    )
    if (!saved.modified)
      throw new HttpError(409, 'Passkey sedang dipakai. Coba lagi.')
    return json(publicSession(account), 200, [
      clear(names.challenge),
      await createSession(c, account, session),
    ])
  }
  if (!session)
    throw new HttpError(401, 'Masuk kembali untuk mendaftarkan Passkey.')
  if (path === 'passkey/register-options') {
    const options = await generateRegistrationOptions({
      rpName: 'FINORA',
      rpID: c.rpID,
      userID: Buffer.from(session.id),
      userName: session.email,
      userDisplayName: session.name,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
    })
    return json(options, 200, [
      await challengeCookie(c, options.challenge, 'register', session),
    ])
  }
  if (path === 'passkey/register-verify') {
    const expectedChallenge = await useChallenge(req, c, 'register', session.id)
    const result = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: c.origin,
      expectedRPID: c.rpID,
      requireUserVerification: true,
    }).catch(() => null)
    if (!result?.verified)
      throw new HttpError(400, 'Pendaftaran Passkey gagal.')
    const { id, publicKey, counter, transports } =
      result.registrationInfo.credential
    const saved = await store().setJSON(
      'credential/' + keyHash(id),
      {
        id,
        publicKey: Buffer.from(publicKey).toString('base64url'),
        counter,
        transports,
        account: session.id,
        grant: session.grant,
      },
      { onlyIfNew: true },
    )
    if (!saved.modified) throw new HttpError(409, 'Passkey sudah terdaftar.')
    return json({ ok: true }, 200, [clear(names.challenge)])
  }
  throw new HttpError(404, 'Rute tidak ditemukan.')
}
export default async function handler(req) {
  try {
    const url = new URL(req.url)
    const path = url.pathname.replace(
      /^\/(?:api|\.netlify\/functions\/api)\/?/,
      '',
    )
    const c = config()
    if (path === 'session' && req.method === 'GET') {
      if (!c) return json({ google: false })
      const session = await getSession(req, c)
      return json({
        google: true,
        session: session ? publicSession(session) : undefined,
        pushKey: pushConfig()?.publicKey,
      })
    }
    if (!c) return json({ error: 'Apps Script belum dikonfigurasi.' }, 503)
    if (path === 'login' && req.method === 'GET') return loginPage()
    if (req.method !== 'POST')
      throw new HttpError(405, 'Metode tidak diizinkan.')
    if (req.headers.get('origin') !== c.origin)
      throw new HttpError(403, 'Origin tidak diizinkan.')
    const session = await getSession(req, c)
    if (path === 'login') {
      if (!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))
        throw new HttpError(415,'Format login tidak valid.')
      const raw = await req.text()
      if (raw.length > 256) return loginPage('Kode akses tidak valid.',400)
      const code = new URLSearchParams(raw).get('code') || ''
      if (!timingSafeEqual(Buffer.from(keyHash(code)),Buffer.from(keyHash(c.code))))
        return loginPage('Kode akses tidak valid.',401)
      return redirect('/',[await createSession(c,c.account,session)])
    }
    const body = await readBody(req)
    if (path.startsWith('passkey/'))
      return await passkeys(path, req, c, session, body)
    if (!session) throw new HttpError(401, 'Sesi berakhir. Masuk kembali.')
    if (path === 'push/register') {
      const push = pushConfig()
      if (!push)
        throw new HttpError(503, 'Notifikasi perangkat belum dikonfigurasi.')
      await registerPush(push, session.id, body)
      return json({ ok: true })
    }
    if (path === 'push/unregister') {
      await unregisterPush(session.id, body.subscription)
      return json({ ok: true })
    }
    if (path === 'logout') {
      await store().delete('session/' + keyHash(session.sid))
      return json({ ok: true }, 200, [
        clear(names.session),
        clear(names.challenge),
      ])
    }
    if (path === 'sheet/list') {
      const { sheet, name } = await scriptCall(c,'info')
      return json({files:[{id:sheet,name}]})
    }
    if (path === 'sheet/export') {
      if (
        !Array.isArray(body.rows) ||
        !body.rows.length ||
        body.rows.length > 15_001 ||
        !body.rows.every(
          (row) =>
            Array.isArray(row) &&
            row.length === 11 &&
            row.every(
              (cell) =>
                (typeof cell === 'string' && cell.length <= 1000) ||
                (typeof cell === 'number' && Number.isSafeInteger(cell)),
            ),
        )
      )
        throw new HttpError(400, 'Data laporan tidak valid atau terlalu besar.')
      return json(await scriptCall(c,'export',{rows:body.rows}))
    }
    if (path === 'sheet/connect') {
      const { sheet } = await scriptCall(c,'info')
      if (body.sheet && spreadsheetID(body.sheet)!==sheet)
        throw new HttpError(403,'Pilih spreadsheet tempat Apps Script dipasang.')
      return json({sheet})
    }
    if (path === 'sheet/read')
      return json(await scriptCall(c,'read',{sheet:spreadsheetID(body.sheet)}))
    if (path === 'sheet/write') {
      let data
      try {data=validateData(body.data)} catch(e){throw new HttpError(400,e.message)}
      if (data.receipts.some(r=>r.image)) throw new HttpError(400,'Foto struk diunggah melalui arsip Drive.')
      return json(await scriptCall(c,'write',{sheet:spreadsheetID(body.sheet),revision:body.revision,data,tables:tables(data,session.id,body.revision)}))
    }
    if (path === 'drive/receipt') {
      if (typeof body.id!=='string'||! /^[\w-]{1,80}$/.test(body.id)||typeof body.image!=='string')
        throw new HttpError(400,'Data struk tidak valid.')
      return json(await scriptCall(c,'receipt',{id:body.id,image:body.image}))
    }
    throw new HttpError(404, 'Rute tidak ditemukan.')
  } catch (e) {
    return json(
      {
        error:
          e instanceof HttpError
            ? e.message
            : 'FINORA gagal memproses permintaan.',
      },
      e instanceof HttpError ? e.status : 500,
    )
  }
}
