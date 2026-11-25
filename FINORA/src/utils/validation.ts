import { z } from 'zod'
import type { Base, Data } from '../types'
import { validateEntry, live } from './ledger'
const positive = z.number().int().min(1).max(1e12)
const nilMoney = z.number().int().min(0).max(1e12)
const signed = z.number().int().min(-1e12).max(1e12)
const key = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[\w:-]+$/)
const link = z.union([key, z.literal('')])
const date = z.iso.date()
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const stamp = z.iso.datetime()
const optionalDate = z.union([date, z.literal('')])
const text = (max: number) => z.string().max(max)
const base = z.object({
  id: key,
  workspace: z.enum(['Personal', 'Business']),
  created: stamp,
  updated: stamp,
  version: z.number().int().positive(),
  deleted: stamp.optional(),
})
const color = z.string().regex(/^#[\da-f]{6}$/i)
const wallet = base.extend({
  name: text(80).min(1),
  type: z.enum(['Cash', 'Online']),
  subtype: text(60),
  opening: signed,
  color,
  icon: text(30),
  archived: z.boolean(),
})
const category = base.extend({
  name: text(80).min(1),
  type: z.enum(['income', 'expense']),
  subcategories: text(300),
  color,
  icon: text(30),
  archived: z.boolean(),
})
const entry = base.extend({
  kind: z.enum([
    'income',
    'expense',
    'transfer',
    'adjustment',
    'financing',
    'refund',
  ]),
  amount: positive,
  source: link,
  destination: link,
  category: link,
  subcategory: text(300),
  merchant: text(120),
  note: text(1000),
  date,
  time,
  receipt: link,
  tags: text(200),
  related: link,
  feeFor: key.optional(),
})
const plan = base.extend({
  type: z.enum([
    'budget',
    'goal',
    'debt',
    'receivable',
    'recurring',
    'reminder',
  ]),
  name: text(120).min(1),
  amount: nilMoney,
  date,
  due: optionalDate,
  category: link,
  icon: text(40),
  changes: z
    .array(
      z.object({
        id: key,
        date,
        amount: signed,
        note: text(280),
        entry: key.optional(),
      }),
    )
    .max(5000),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'custom']),
  interval: z.number().int().min(1).max(3650),
  auto: z.boolean(),
  template: entry
    .pick({
      kind: true,
      amount: true,
      source: true,
      destination: true,
      category: true,
    })
    .partial()
    .optional(),
  done: z.boolean().optional(),
})
const receipt = base.extend({
  hash: key,
  merchant: text(120),
  date,
  amount: positive,
  number: text(160),
  text: text(40000),
  confidence: z.number().min(0).max(100),
  address: text(500),
  time: z.union([time, z.literal('')]),
  items: text(18000),
  subtotal: nilMoney,
  discount: nilMoney,
  tax: nilMoney,
  fee: nilMoney,
  method: text(100),
  image: z
    .string()
    .max(5_500_000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
    .optional(),
  driveId: key.optional(),
})
const schema = z.object({
  wallets: z.array(wallet).max(2000),
  categories: z.array(category).max(2000),
  entries: z.array(entry).max(30000),
  plans: z.array(plan).max(1000),
  receipts: z.array(receipt).max(3000),
})
export function validateData(input: unknown): Data {
  const parsed = schema.safeParse(input)
  if (!parsed.success)
    throw Error(
      'Format data FINORA tidak valid: ' +
        parsed.error.issues[0]?.path.join('.'),
    )
  const d: Data = parsed.data
  for (const collection of Object.values(d) as Base[][])
    if (new Set(collection.map((x) => x.id)).size !== collection.length)
      throw Error('Ada ID data ganda.')
  const wallets = new Map(d.wallets.map((w) => [w.id, w]))
  const entries = new Map(d.entries.map((e) => [e.id, e]))
  const categories = new Map(d.categories.map((c) => [c.id, c]))
  const receipts = new Map(d.receipts.map((r) => [r.id, r]))
  const refunds = new Map<string, number>()
  for (const e of live(d.entries)) {
    const w = [e.source, e.destination]
      .filter(Boolean)
      .map((k) => wallets.get(k))
    if (w.some((x) => !x || x.deleted || x.workspace !== e.workspace))
      throw Error('Transaksi merujuk dompet yang tidak valid.')
    if (e.category && categories.get(e.category)?.workspace !== e.workspace)
      throw Error('Kategori transaksi tidak valid.')
    if (e.receipt && receipts.get(e.receipt)?.workspace !== e.workspace)
      throw Error('Struk transaksi tidak valid.')
    const original = entries.get(e.related)
    validateEntry(e, {
      ...d,
      wallets: w.flatMap((x) => (x ? [x] : [])),
      entries: original ? [original] : [],
    })
    if (e.kind === 'refund') {
      const value = (refunds.get(e.related) || 0) + e.amount
      if (!original || value > original.amount)
        throw Error('Nominal refund melebihi transaksi asal.')
      refunds.set(e.related, value)
    }
  }
  return d
}
