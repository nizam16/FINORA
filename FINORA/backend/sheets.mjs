import { validateData } from '../src/utils/validation.ts'
import { balance, live, totals } from '../src/utils/ledger.ts'
export const TABS = [
  'Dashboard',
  'Transactions',
  'Wallets',
  'Categories',
  'Cash',
  'Online',
  'Transfers',
  'Budgets',
  'Savings_Goals',
  'Debts',
  'Receivables',
  'Receipts',
  'Recurring_Transactions',
  'Reminders',
  'Monthly_Reports',
  'Settings',
  'Sync_Log',
  'Workspaces',
]
const marker = 'FINORA_SCHEMA_1'
const common = {
  workspace_id: 'workspace',
  created_at: 'created',
  updated_at: 'updated',
  version: 'version',
  deleted_at: 'deleted',
}
const transaction = {
  transaction_id: 'id',
  user_id: 'user',
  workspace_id: 'workspace',
  transaction_type: 'kind',
  amount: 'amount',
  source_wallet_id: 'source',
  destination_wallet_id: 'destination',
  category_id: 'category',
  subcategory: 'subcategory',
  merchant: 'merchant',
  note: 'note',
  transaction_date: 'date',
  transaction_time: 'time',
  receipt_id: 'receipt',
  tags: 'tags',
  created_at: 'created',
  updated_at: 'updated',
  version: 'version',
  deleted_at: 'deleted',
  related_transaction_id: 'related',
  fee_for: 'feeFor',
}
const wallet = {
  wallet_id: 'id',
  workspace_id: 'workspace',
  wallet_name: 'name',
  wallet_type: 'type',
  wallet_subtype: 'subtype',
  opening_balance: 'opening',
  calculated_balance: 'calculated',
  icon: 'icon',
  color: 'color',
  status: 'archived',
  created_at: 'created',
  updated_at: 'updated',
  version: 'version',
  deleted_at: 'deleted',
}
const category = {
  category_id: 'id',
  ...common,
  category_name: 'name',
  category_type: 'type',
  subcategories: 'subcategories',
  color: 'color',
  icon: 'icon',
  status: 'archived',
}
const receipt = {
  receipt_id: 'id',
  ...common,
  sha256: 'hash',
  merchant: 'merchant',
  receipt_date: 'date',
  amount: 'amount',
  receipt_number: 'number',
  ocr_text: 'text',
  confidence: 'confidence',
  address: 'address',
  receipt_time: 'time',
  items: 'items',
  subtotal: 'subtotal',
  discount: 'discount',
  tax: 'tax',
  fee: 'fee',
  payment_method: 'method',
  drive_id: 'driveId',
}
const plan = {
  record_id: 'id',
  ...common,
  type: 'type',
  name: 'name',
  amount: 'amount',
  start_date: 'date',
  due_date: 'due',
  category_id: 'category',
  icon: 'icon',
  history_json: 'changes',
  frequency: 'frequency',
  interval: 'interval',
  auto_record: 'auto',
  template_json: 'template',
  done: 'done',
}
const planTabs = {
  Budgets: 'budget',
  Savings_Goals: 'goal',
  Debts: 'debt',
  Receivables: 'receivable',
  Recurring_Transactions: 'recurring',
  Reminders: 'reminder',
}
const fields = {
  Transactions: transaction,
  Wallets: wallet,
  Categories: category,
  Receipts: receipt,
  ...Object.fromEntries(Object.keys(planTabs).map((k) => [k, plan])),
}
const booleans = new Set(['archived', 'auto', 'done'])
const numeric = new Set([
  'version',
  'amount',
  'opening',
  'confidence',
  'subtotal',
  'discount',
  'tax',
  'fee',
  'interval',
])
const optional = new Set(['deleted', 'driveId', 'feeFor', 'done', 'template'])
export function col(n) {
  let result = ''
  for (let i = n; i > 0; i = Math.floor((i - 1) / 26))
    result = String.fromCharCode(65 + ((i - 1) % 26)) + result
  return result
}
function encode(map, items) {
  return [
    Object.keys(map),
    ...items.map((row) =>
      Object.values(map).map((key) => {
        const value = row[key]
        if (booleans.has(key))
          return key === 'archived'
            ? value
              ? 'archived'
              : 'active'
            : (value ?? '')
        if (value && typeof value === 'object') return JSON.stringify(value)
        return value ?? ''
      }),
    ),
  ]
}
function decode(map, values = []) {
  if (JSON.stringify(values[0]) !== JSON.stringify(Object.keys(map)))
    throw Error('Header spreadsheet berubah. Pulihkan header FINORA.')
  return values
    .slice(1)
    .filter((row) => row.some((v) => v !== ''))
    .map((row) => {
      const obj = {}
      Object.values(map).forEach((key, i) => {
        const v = row[i] ?? ''
        if (
          key === 'calculated' ||
          key === 'user' ||
          (v === '' && optional.has(key))
        )
          return
        if (key === 'changes' || key === 'template') {
          obj[key] = v === '' ? [] : JSON.parse(String(v))
        } else if (booleans.has(key)) {
          obj[key] =
            key === 'archived'
              ? v === 'archived'
              : String(v).toLowerCase() === 'true'
        } else if (numeric.has(key)) obj[key] = v === '' ? undefined : Number(v)
        else obj[key] = String(v)
      })
      return obj
    })
}
export function readTables(input, user) {
  if (input.Settings?.[1]?.[1] !== marker || input.Settings?.[2]?.[1] !== user)
    throw Error('Spreadsheet tidak terdaftar pada akun FINORA ini.')
  for (const row of input.Transactions?.slice(1) || [])
    if (row.some((v) => v !== '') && row[1] !== user)
      throw Error('Baris ledger berasal dari akun lain.')
  return validateData({
    entries: decode(transaction, input.Transactions),
    wallets: decode(wallet, input.Wallets),
    categories: decode(category, input.Categories),
    receipts: decode(receipt, input.Receipts),
    plans: Object.entries(planTabs).flatMap(([name, type]) =>
      decode(plan, input[name]).map((row) => {
        if (row.type !== type) throw Error('Jenis rencana tidak sesuai tab.')
        return row
      }),
    ),
  })
}
export function tables(data, user, revision = '') {
  const t = Object.fromEntries(TABS.map((t) => [t, []]))
  t.Transactions = encode(
    transaction,
    data.entries.map((e) => ({ ...e, user })),
  )
  t.Wallets = encode(
    wallet,
    data.wallets.map((w) => ({ ...w, calculated: balance(w, data.entries) })),
  )
  t.Categories = encode(category, data.categories)
  t.Receipts = encode(receipt, data.receipts)
  for (const [name, type] of Object.entries(planTabs))
    t[name] = encode(
      fields[name],
      data.plans.filter((p) => p.type === type),
    )
  const tx = live(data.entries),
    wallets = live(data.wallets)
  const summary = (scope) => {
    const w = wallets.filter((w) => w.workspace === scope),
      e = tx.filter((e) => e.workspace === scope)
    return [
      scope,
      w.reduce((s, a) => s + balance(a, e), 0),
      w.filter((w) => w.type === 'Cash').reduce((s, a) => s + balance(a, e), 0),
      w
        .filter((w) => w.type === 'Online')
        .reduce((s, a) => s + balance(a, e), 0),
    ]
  }
  t.Dashboard = [
    ['workspace', 'total_balance', 'cash_balance', 'online_balance'],
    summary('Personal'),
    summary('Business'),
  ]
  for (const type of ['Cash', 'Online']) {
    const ids = new Set(wallets.filter((w) => w.type === type).map((w) => w.id))
    t[type] = encode(
      transaction,
      tx
        .filter((e) => ids.has(e.source) || ids.has(e.destination))
        .map((e) => ({ ...e, user })),
    )
  }
  t.Transfers = encode(
    transaction,
    tx.filter((e) => e.kind === 'transfer').map((e) => ({ ...e, user })),
  )
  const months = [...new Set(tx.map((e) => e.date.slice(0, 7)))].sort()
  t.Monthly_Reports = [
    ['workspace', 'month', 'income', 'expense', 'net'],
    ...['Personal', 'Business'].flatMap((w) =>
      months.map((m) => {
        const v = totals(
          tx.filter((e) => e.workspace === w && e.date.startsWith(m)),
        )
        return [w, m, v.income, v.expense, v.net]
      }),
    ),
  ]
  t.Settings = [
    ['key', 'value'],
    ['schema', marker],
    ['owner_id', user],
    ['currency', 'IDR'],
    ['timezone', 'Asia/Jakarta'],
  ]
  t.Workspaces = [
    ['workspace_id', 'name'],
    ['Personal', 'Personal'],
    ['Business', 'Business'],
  ]
  t.Sync_Log = [
    ['timestamp', 'status', 'previous_revision'],
    [new Date().toISOString(), 'OK', revision],
  ]
  return t
}
export function spreadsheetID(value) {
  const id = String(value || '')
    .trim()
    .match(
      /^(?:https:\/\/docs\.google\.com\/spreadsheets\/d\/)?([\w-]{20,100})(?:\/[^\s]*)?$/,
    )?.[1]
  if (!id) throw new HttpError(400, 'ID spreadsheet tidak valid.')
  return id
}
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
