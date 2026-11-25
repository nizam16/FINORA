import Dexie, { type EntityTable } from 'dexie'
import { base, empty, entry, today } from '../utils/ledger'
import type { Data, Profile } from '../types'
export const defaults: Profile = {
  name: 'Pengguna',
  theme: 'dark',
  privacy: false,
  autoLock: 60,
  autoSync: true,
  notifications: true,
  completed: false,
}
export interface State {
  id: string
  data: Data
  profile: Profile
  baseline?: Data
}
const db = new Dexie('finora-v1') as Dexie & {
  accounts: EntityTable<State, 'id'>
}
db.version(1).stores({ accounts: 'id' })
export { db }
const categories = {
  income:
    'Gaji,CPA,Bisnis,Freelance,Komisi,Bonus/THR,Investasi,Hadiah,Refund,Pendapatan digital,Lainnya',
  expense:
    'Makanan & Minuman,Transportasi,Belanja,Internet/Pulsa,Rumah Tangga,Operasional Bisnis,Langganan Digital,Hosting/VPS,Domain,Software/AI Tools,Hiburan,Kesehatan,Keluarga,Pendidikan,Cicilan,Donasi/Sosial,Biaya Admin,Perawatan Perangkat,Lainnya',
}
export function initial(demo: boolean): Data {
  const d = empty()
  for (const workspace of ['Personal', 'Business']) {
    for (const type of ['income', 'expense'] as const)
      categories[type]
        .split(',')
        .forEach((name, i) =>
          d.categories.push({
            ...base(workspace, `${workspace}-${type}-${i}`),
            created: '2025-01-01T00:00:00.000Z',
            updated: '2025-01-01T00:00:00.000Z',
            name,
            type,
            subcategories: '',
            color: '#D4AF37',
            icon: 'tag',
            archived: false,
          }),
        )
    if (workspace === 'Business') continue
    const wallet = (
      name: string,
      type: 'Cash' | 'Online',
      opening: number,
      id: string,
      subtype: string,
    ) => ({
      ...base(workspace, id),
      name,
      type,
      opening,
      subtype,
      color: type === 'Cash' ? '#D4AF37' : '#0A84FF',
      icon: type === 'Cash' ? 'wallet' : 'card',
      archived: false,
    })
    if (!demo) continue
    d.wallets.push(
      wallet('Cash', 'Cash', 1_800_000, 'demo-cash', 'Tunai'),
      wallet('BCA', 'Online', 4_500_000, 'demo-bca', 'BCA'),
      wallet('GoPay', 'Online', 700_000, 'demo-gopay', 'GoPay'),
    )
    const dated = (day: number) =>
      today().slice(0, 8) +
      String(Math.min(day, Number(today().slice(-2)))).padStart(2, '0')
    d.entries.push(
      entry(workspace, {
        kind: 'income',
        amount: 6_500_000,
        destination: 'demo-bca',
        category: 'Personal-income-0',
        merchant: 'Gaji Bulanan',
        date: dated(1),
      }),
      entry(workspace, {
        kind: 'income',
        amount: 1_500_000,
        destination: 'demo-bca',
        category: 'Personal-income-3',
        merchant: 'Proyek Freelance',
        date: dated(15),
      }),
      entry(workspace, {
        kind: 'expense',
        amount: 1_100_000,
        source: 'demo-bca',
        category: 'Personal-expense-2',
        merchant: 'Belanja bulanan',
        date: dated(8),
      }),
      entry(workspace, {
        kind: 'expense',
        amount: 480_000,
        source: 'demo-gopay',
        category: 'Personal-expense-1',
        merchant: 'Transportasi',
        date: dated(15),
      }),
      entry(workspace, {
        kind: 'expense',
        amount: 680_000,
        source: 'demo-cash',
        category: 'Personal-expense-0',
        merchant: 'Belanja bahan makanan',
        date: dated(18),
      }),
      entry(workspace, {
        kind: 'expense',
        amount: 240_000,
        source: 'demo-bca',
        category: 'Personal-expense-6',
        merchant: 'Langganan digital',
        date: dated(21),
      }),
      entry(workspace, {
        kind: 'transfer',
        amount: 1_380_000,
        source: 'demo-bca',
        destination: 'demo-cash',
        merchant: 'Tarik tunai',
        date: dated(23),
      }),
    )
    const plan = {
      ...base(workspace),
      date: today(),
      due: '',
      category: 'Personal-expense-0',
      icon: 'target',
      changes: [],
      frequency: 'monthly',
      interval: 1,
      auto: false,
    }
    d.plans.push(
      { ...plan, type: 'budget', name: 'Makanan & Minuman', amount: 1_000_000 },
      {
        ...plan,
        ...base(workspace),
        type: 'goal',
        name: 'Dana Darurat',
        amount: 10_000_000,
        changes: [
          {
            id: crypto.randomUUID(),
            date: today(),
            amount: 3_500_000,
            note: 'Alokasi awal',
          },
        ],
      },
    )
  }
  return d
}
export async function ensure(id: string, name: string) {
  await db.transaction('rw', db.accounts, async () => {
    if (!(await db.accounts.get(id)))
      await db.accounts.add({
        id,
        data: initial(id === 'demo'),
        profile: { ...defaults, name },
      })
  })
}
export async function change(id: string, update: (s: State) => void) {
  await db.transaction('rw', db.accounts, async () => {
    const s = await db.accounts.get(id)
    if (!s) throw Error('Akun tidak tersedia.')
    update(s)
    await db.accounts.put(s)
  })
}
