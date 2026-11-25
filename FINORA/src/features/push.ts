import { api } from '../services/api'
export const supportedPush = () =>
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window
export async function getDeviceSubscription() {
  if (!supportedPush()) return null
  return (
    (
      await navigator.serviceWorker.getRegistration()
    )?.pushManager.getSubscription() || null
  )
}
export async function enablePush(publicKey: string, dates: string[]) {
  if (!supportedPush()) throw Error('Perangkat ini tidak mendukung Web Push.')
  const permission =
    Notification.permission === 'default'
      ? Notification.requestPermission()
      : Promise.resolve(Notification.permission)
  const [allowed, registration] = await Promise.all([
    permission,
    navigator.serviceWorker.getRegistration(),
  ])
  if (allowed !== 'granted')
    throw Error('Izin notifikasi belum diberikan pada browser.')
  if (!registration?.active)
    throw Error('Muat ulang build PWA saat online untuk mengaktifkan Web Push.')
  const bytes = Uint8Array.from(
    atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  )
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    }))
  try {
    await savePushSchedule(subscription, dates)
  } catch (e) {
    if (!existing) await subscription.unsubscribe()
    throw e
  }
}
export async function savePushSchedule(
  subscription: PushSubscription,
  dates: string[],
) {
  await api('push/register', { subscription: subscription.toJSON(), dates })
}
export async function disablePush() {
  const subscription = await getDeviceSubscription()
  if (!subscription) return
  try {
    await api('push/unregister', { subscription: subscription.toJSON() })
  } finally {
    await subscription.unsubscribe()
  }
}
