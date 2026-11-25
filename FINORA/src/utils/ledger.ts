import { v5 as uuidv5 } from 'uuid'
import type { Base, Data, Entry, Kind, Plan, Receipt, Wallet } from '../types'
export const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
export const today = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(
    new Date(),
  )
export const currentTime = () =>
  new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date())
    .replace('.', ':')
export const money = (n: number) =>
  Number.isSafeInteger(n) && n > 0 && n <= 1_000_000_000_000
export const live = <T extends Base>(items: T[]) =>
  items.filter((x) => !x.deleted)
export const base = (
  workspace: string,
  id = crypto.randomUUID() as string,
): Base => ({
  workspace,
  id,
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
  version: 1,
})
export const revise = <T extends Base>(old: T, fields: Partial<T>): T => ({
  ...old,
  ...fields,
  updated: new Date().toISOString(),
  version: old.version + 1,
})
export const names: Record<Kind, string> = {
  income: 'Pemasukan',
  expense: 'Pengeluaran',
  transfer: 'Transfer',
  adjustment: 'Penyesuaian',
  financing: 'Pembiayaan',
  refund: 'Refund',
}
export const empty = (): Data => ({
  wallets: [],
  categories: [],
  entries: [],
  plans: [],
  receipts: [],
})
export function balance(wallet: Wallet, entries: Entry[]) {
  return live(entries).reduce(
    (sum, e) =>
      sum +
      (e.destination === wallet.id ? e.amount : 0) -
      (e.source === wallet.id ? e.amount : 0),
    wallet.opening,
  )
}
export function totals(entries: Entry[]) {
  const income = live(entries)
    .filter((x) => x.kind === 'income')
    .reduce((s, x) => s + x.amount, 0)
  const expense = live(entries).reduce(
    (s, x) =>
      s +
      (x.kind === 'expense' ? x.amount : x.kind === 'refund' ? -x.amount : 0),
    0,
  )
  return { income, expense, net: income - expense }
}
export function entry(workspace: string, fields: Partial<Entry>): Entry {
  return {
    ...base(workspace),
    kind: 'expense',
    amount: 0,
    source: '',
    destination: '',
    category: '',
    subcategory: '',
    merchant: '',
    note: '',
    date: today(),
    time: currentTime(),
    receipt: '',
    tags: '',
    related: '',
    ...fields,
  }
}
export function validateEntry(e: Entry, d: Data) {
  if (
    !money(e.amount) ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(e.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)
  )
    throw Error('Periksa nominal, tanggal dan waktu.')
  const valid = (id: string) =>
    live(d.wallets).some((w) => w.id === id && w.workspace === e.workspace)
  if (
    e.source === e.destination ||
    (e.source && !valid(e.source)) ||
    (e.destination && !valid(e.destination))
  )
    throw Error('Pilih dompet yang sesuai.')
  if (
    (['income', 'refund'].includes(e.kind) && (!e.destination || e.source)) ||
    (e.kind === 'expense' && (!e.source || e.destination)) ||
    (e.kind === 'transfer' && (!e.source || !e.destination)) ||
    (['adjustment', 'financing'].includes(e.kind) &&
      Boolean(e.source) === Boolean(e.destination))
  )
    throw Error('Alur dana tidak valid.')
  if (e.kind === 'refund') {
    const source = live(d.entries).find(
      (x) =>
        x.id === e.related &&
        x.kind === 'expense' &&
        x.workspace === e.workspace,
    )
    const used = live(d.entries)
      .filter(
        (x) => x.kind === 'refund' && x.related === e.related && x.id !== e.id,
      )
      .reduce((s, x) => s + x.amount, 0)
    if (!source || used + e.amount > source.amount)
      throw Error(
        'Refund harus terkait pengeluaran dan tidak boleh melebihi nominal awal.',
      )
  }
  const refunds = live(d.entries)
    .filter((x) => x.kind === 'refund' && x.related === e.id)
    .reduce((s, x) => s + x.amount, 0)
  if (refunds && (e.kind !== 'expense' || e.amount < refunds))
    throw Error('Perubahan bertentangan dengan refund yang sudah tercatat.')
}
export function duplicateReceipt(r: Receipt, receipts: Receipt[]) {
  const norm = (s: string) =>
    s.toLocaleLowerCase('id').replace(/[^\p{L}\p{N}]+/gu, '')
  return live(receipts).find(
    (x) =>
      x.workspace === r.workspace &&
      x.id !== r.id &&
      (x.hash === r.hash ||
        Boolean(
          norm(r.merchant) &&
          norm(x.merchant) === norm(r.merchant) &&
          ((r.number && r.number === x.number) ||
            (r.date === x.date && r.amount > 0 && r.amount === x.amount)),
        )),
  )
}
export function occurrence(
  date: string,
  frequency: string,
  interval: number,
  step: number,
) {
  const d = new Date(date + 'T00:00:00Z')
  if (frequency === 'monthly' || frequency === 'yearly') {
    const day = d.getUTCDate()
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() + step * (frequency === 'yearly' ? 12 : 1))
    const end = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate()
    d.setUTCDate(Math.min(day, end))
  } else
    d.setUTCDate(
      d.getUTCDate() +
        step *
          (frequency === 'weekly' ? 7 : frequency === 'custom' ? interval : 1),
    )
  return d.toISOString().slice(0, 10)
}
export function recurringEntries(plan: Plan, d: Data, until = today()) {
  if (
    !plan.auto ||
    !plan.template ||
    plan.deleted ||
    plan.type !== 'recurring' ||
    !plan.date
  )
    return []
  const result: Entry[] = []
  for (let i = 0; i < 10_000; i++) {
    const date = occurrence(plan.date, plan.frequency, plan.interval, i)
    if (date > until || (plan.due && date > plan.due)) break
    const id = uuidv5(
      plan.id + ':' + date,
      '6c712946-6af8-4127-99f9-74103db7cfa5',
    )
    if (d.entries.some((e) => e.id === id)) continue
    const timestamp = date + 'T00:00:00.000Z'
    const item = entry(plan.workspace, {
      ...plan.template,
      id,
      date,
      time: '00:00',
      created: timestamp,
      updated: timestamp,
      note: plan.name,
    })
    try {
      validateEntry(item, d)
      result.push(item)
    } catch {
      break
    }
  }
  return result
}
export function planProgress(p: Plan, d: Data) {
  if (p.type === 'budget')
    return totals(
      live(d.entries).filter(
        (e) =>
          e.workspace === p.workspace &&
          e.category === p.category &&
          e.date.startsWith(p.date.slice(0, 7)),
      ),
    ).expense
  return p.changes.reduce((s, x) => s + x.amount, 0)
}
