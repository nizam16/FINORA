import { deliverReminders, pushConfig } from '../push.mjs'

export default async function run() {
  const push = pushConfig()
  if (push) await deliverReminders(push)
  return new Response(null, { status: 204 })
}
export const config = { schedule: '15,45 * * * *' }
