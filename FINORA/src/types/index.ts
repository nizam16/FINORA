export type Kind =
  'income' | 'expense' | 'transfer' | 'adjustment' | 'financing' | 'refund'
export interface Base {
  id: string
  workspace: string
  created: string
  updated: string
  version: number
  deleted?: string
}
export interface Wallet extends Base {
  name: string
  type: 'Cash' | 'Online'
  subtype: string
  opening: number
  color: string
  icon: string
  archived: boolean
}
export interface Category extends Base {
  name: string
  type: 'income' | 'expense'
  subcategories: string
  color: string
  icon: string
  archived: boolean
}
export interface Entry extends Base {
  kind: Kind
  amount: number
  source: string
  destination: string
  category: string
  subcategory: string
  merchant: string
  note: string
  date: string
  time: string
  receipt: string
  tags: string
  related: string
  feeFor?: string
}
export interface Receipt extends Base {
  hash: string
  merchant: string
  date: string
  amount: number
  number: string
  text: string
  confidence: number
  address: string
  time: string
  items: string
  subtotal: number
  discount: number
  tax: number
  fee: number
  method: string
  image?: string
  driveId?: string
}
export type PlanKind =
  'budget' | 'goal' | 'debt' | 'receivable' | 'recurring' | 'reminder'
export interface Change {
  id: string
  date: string
  amount: number
  note: string
  entry?: string
}
export interface Plan extends Base {
  type: PlanKind
  name: string
  amount: number
  date: string
  due: string
  category: string
  icon: string
  changes: Change[]
  frequency: string
  interval: number
  auto: boolean
  template?: Partial<Entry>
  done?: boolean
}
export interface Data {
  wallets: Wallet[]
  categories: Category[]
  entries: Entry[]
  plans: Plan[]
  receipts: Receipt[]
}
export interface Profile {
  name: string
  theme: 'dark' | 'light'
  privacy: boolean
  autoLock: number
  autoSync: boolean
  notifications: boolean
  pushEnabled?: boolean
  completed: boolean
  pin?: string
  salt?: string
  attempts?: number
  blockedUntil?: number
  sheet?: string
  lastSync?: string
}
export type Collection = keyof Data
