import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { EncryptJWT, jwtDecrypt } from 'jose'
import { HttpError } from './sheets.mjs'

const store = () =>
  getStore({ name: 'finora-device-notifications', consistency: 'strong' })
const hash = (s) => createHash('sha256').update(s).digest('hex')
export function pushConfig() {
  const {
    FINORA_VAPID_PUBLIC: publicKey,
    FINORA_VAPID_PRIVATE: privateKey,
    FINORA_VAPID_SUBJECT: subject,
    FINORA_KEY: encoded,
  } = process.env
  const key = Buffer.from(encoded || '', 'base64url')
  if (!publicKey || !privateKey || !subject || key.length !== 32) return
  try {
    const url = new URL(subject)
    if (!['mailto:', 'https:'].includes(url.protocol)) return
    // Validate the VAPID key lengths before exposing the feature to clients.
    if (
      Buffer.from(publicKey, 'base64url').length !== 65 ||
      Buffer.from(privateKey, 'base64url').length !== 32
    )
      return
    return { publicKey, privateKey, subject, key }
  } catch {
    return undefined
  }
}
export function normalizeSubscription(input) {
  try {
    const url = new URL(input.endpoint)
    const host = url.hostname
    const provider =
      [
        'fcm.googleapis.com',
        'updates.push.services.mozilla.com',
        'web.push.apple.com',
      ].includes(host) || host.endsWith('.web.push.apple.com')
    if (
      !provider ||
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password ||
      url.hash ||
      !url.pathname ||
      url.href.length > 1600
    )
      throw Error('URL')
    const keys = input.keys
    if (!/^[\w-]{87}$/.test(keys.p256dh) || !/^[\w-]{22}$/.test(keys.auth))
      throw Error('Keys')
    return {
      endpoint: url.href,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
    }
  } catch {
    throw new HttpError(
      400,
      'Layanan push perangkat ini tidak didukung atau langganannya tidak valid.',
    )
  }
}
const date = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(
    new Date(),
  )
const keyFor = (account, endpoint) =>
  'device/' + hash(account + '\n' + endpoint)
async function seal(config, body) {
  return new EncryptJWT(body)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('45d')
    .encrypt(config.key)
}
async function open(config, token) {
  try {
    return (
      await jwtDecrypt(token, config.key, {
        keyManagementAlgorithms: ['dir'],
        contentEncryptionAlgorithms: ['A256GCM'],
      })
    ).payload
  } catch {
    return null
  }
}
export async function registerPush(config, account, body) {
  const subscription = normalizeSubscription(body.subscription)
  if (
    !Array.isArray(body.dates) ||
    body.dates.length > 100 ||
    !body.dates.every(
      (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d),
    )
  )
    throw new HttpError(400, 'Jadwal notifikasi tidak valid.')
  const id = keyFor(account, subscription.endpoint),
    blobs = store(),
    previous = await blobs.getWithMetadata(id)
  const existing = previous?.data ? await open(config, previous.data) : null
  const dates = [...new Set(body.dates)].filter((d) => d >= date()).sort()
  const payload = { account, subscription, dates, last: existing?.last || '' }
  const result = await blobs.set(
    id,
    await seal(config, payload),
    previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true },
  )
  if (!result.modified)
    throw new HttpError(
      409,
      'Pengaturan notifikasi sedang diperbarui. Coba lagi.',
    )
}
export async function unregisterPush(account, input) {
  const subscription = normalizeSubscription(input)
  await store().delete(keyFor(account, subscription.endpoint))
}
export async function deliverReminders(config) {
  const blobs = store(),
    today = date()
  const { blobs: records } = await blobs.list({ prefix: 'device/' })
  for (let i = 0; i < records.length; i += 8) {
    await Promise.allSettled(
      records.slice(i, i + 8).map(async ({ key }) => {
        const item = await blobs.getWithMetadata(key)
        const payload = item?.data ? await open(config, item.data) : null
        if (!payload) {
          if (item) await blobs.delete(key)
          return
        }
        if (payload.last === today || !payload.dates.includes(today)) return
        const saved = await blobs.set(
          key,
          await seal(config, { ...payload, last: today }),
          { onlyIfMatch: item.etag },
        )
        if (!saved.modified) return
        try {
        const pushModule = await import('web-push')
        await (pushModule.default ?? pushModule).sendNotification(
            payload.subscription,
            JSON.stringify({ type: 'reminder' }),
            {
              vapidDetails: {
                subject: config.subject,
                publicKey: config.publicKey,
                privateKey: config.privateKey,
              },
              TTL: 86400,
              timeout: 7000,
            },
          )
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            await blobs.delete(key)
            return
          }
          await blobs.set(key, await seal(config, payload), {
            onlyIfMatch: saved.etag,
          })
        }
      }),
    )
  }
}
