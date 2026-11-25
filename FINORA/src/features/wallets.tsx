import { CreditCard, Wallet as WalletIcon, Plus, Tag } from 'lucide-react'
import { Field, Form, Head, Panel, Price, num, str } from '../components/ui'
import { base, balance, live, money, revise } from '../utils/ledger'
import type { Category, Data, Wallet } from '../types'
import { useState } from 'react'
const providers = [
  'BCA',
  'BRI',
  'BNI',
  'Mandiri',
  'Jago',
  'SeaBank',
  'DANA',
  'GoPay',
  'OVO',
  'ShopeePay',
  'LinkAja',
  'PayPal',
  'Lainnya',
]
export function Wallets({
  d,
  workspace,
  hide,
  add,
  select,
}: {
  d: Data
  workspace: string
  hide: boolean
  add: () => void
  select: (w: Wallet) => void
}) {
  const [filter, setFilter] = useState('all')
  const items = live(d.wallets).filter(
    (x) =>
      x.workspace === workspace &&
      (filter === 'archived'
        ? x.archived
        : !x.archived && (filter === 'all' || x.type === filter)),
  )
  return (
    <Panel>
      <Head title="Dompet & rekening">
        <button className="primary" onClick={add}>
          <Plus size={18} /> Tambah dompet
        </button>
      </Head>
      <div className="filters">
        {Object.entries({
          all: 'Semua',
          Cash: 'Cash',
          Online: 'Online',
          archived: 'Arsip',
        }).map(([k, v]) => (
          <button
            key={k}
            className={'chip ' + (k === filter ? 'selected' : '')}
            onClick={() => setFilter(k)}
          >
            {v}
          </button>
        ))}
      </div>
      {items.length ? (
        items.map((w) => {
          const Icon = w.icon === 'card' ? CreditCard : WalletIcon
          return (
            <button className="entry-row" key={w.id} onClick={() => select(w)}>
              <span className="entry-icon" style={{ color: w.color }}>
                <Icon size={20} />
              </span>
              <span className="entry-copy">
                <strong>{w.name}</strong>
                <small>
                  {w.type} · {w.subtype}
                </small>
              </span>
              <strong>
                <Price value={balance(w, d.entries)} hide={hide} />
              </strong>
            </button>
          )
        })
      ) : (
        <p className="empty">Belum ada dompet dalam daftar ini.</p>
      )}
    </Panel>
  )
}
export function WalletForm({
  wallet,
  workspace,
  save,
}: {
  wallet?: Wallet
  workspace: string
  save: (w: Wallet) => Promise<void>
}) {
  const [type, setType] = useState<Wallet['type']>(wallet?.type || 'Cash')
  return (
    <Form
      save={async (f) => {
        const opening = wallet?.opening ?? num(f, 'opening')
        if (opening !== 0 && !money(Math.abs(opening)))
          throw Error('Saldo awal harus berupa Rupiah bulat.')
        const fields = {
          name: str(f, 'name'),
          type,
          subtype: type === 'Cash' ? 'Tunai' : str(f, 'subtype'),
          opening,
          icon: str(f, 'icon'),
          color: str(f, 'color'),
        }
        if (!fields.name) throw Error('Masukkan nama dompet.')
        await save(
          wallet
            ? revise(wallet, fields)
            : { ...base(workspace), ...fields, archived: false },
        )
      }}
    >
      <Field label="Nama dompet">
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={wallet?.name}
        />
      </Field>
      <Field label="Sumber dana">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as Wallet['type'])}
        >
          <option>Cash</option>
          <option>Online</option>
        </select>
      </Field>
      {type === 'Online' && (
        <Field label="Bank / e-wallet">
          <select name="subtype" defaultValue={wallet?.subtype || 'BCA'}>
            {providers.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
      )}
      {!wallet && (
        <Field label="Saldo awal (Rp)">
          <input
            name="opening"
            type="number"
            inputMode="numeric"
            step="1"
            defaultValue={0}
          />
        </Field>
      )}
      <div className="form-grid">
        <Field label="Ikon">
          <select name="icon" defaultValue={wallet?.icon || 'wallet'}>
            <option value="wallet">Dompet</option>
            <option value="card">Kartu</option>
          </select>
        </Field>
        <Field label="Warna">
          <input
            name="color"
            type="color"
            defaultValue={wallet?.color || '#D4AF37'}
          />
        </Field>
      </div>
    </Form>
  )
}
export function Categories({
  items,
  add,
  select,
}: {
  items: Category[]
  add: () => void
  select: (c: Category) => void
}) {
  const [type, setType] = useState('expense')
  return (
    <Panel>
      <Head title="Kategori">
        <button className="primary" onClick={add}>
          <Plus size={17} /> Tambah
        </button>
      </Head>
      <div className="filters">
        {Object.entries({
          expense: 'Pengeluaran',
          income: 'Pemasukan',
          archived: 'Arsip',
        }).map(([k, v]) => (
          <button
            className={'chip ' + (type === k ? 'selected' : '')}
            key={k}
            onClick={() => setType(k)}
          >
            {v}
          </button>
        ))}
      </div>
      {items
        .filter((c) =>
          type === 'archived' ? c.archived : !c.archived && type === c.type,
        )
        .map((c) => (
          <button key={c.id} className="entry-row" onClick={() => select(c)}>
            <span className="entry-icon" style={{ color: c.color }}>
              {c.icon === 'wallet' ? (
                <WalletIcon size={18} />
              ) : c.icon === 'card' ? (
                <CreditCard size={18} />
              ) : (
                <Tag size={18} />
              )}
            </span>
            <span className="entry-copy">
              <strong>{c.name}</strong>
              <small>{c.subcategories}</small>
            </span>
          </button>
        ))}
    </Panel>
  )
}
export function CategoryForm({
  category,
  workspace,
  save,
}: {
  category?: Category
  workspace: string
  save: (c: Category) => Promise<void>
}) {
  return (
    <Form
      save={async (f) => {
        const fields = {
          name: str(f, 'name'),
          type: str(f, 'type') as Category['type'],
          subcategories: str(f, 'subs'),
          color: str(f, 'color'),
          icon: str(f, 'icon'),
        }
        if (!fields.name) throw Error('Masukkan nama kategori.')
        await save(
          category
            ? revise(category, fields)
            : { ...base(workspace), ...fields, archived: false },
        )
      }}
    >
      <Field label="Nama kategori">
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={category?.name}
        />
      </Field>
      <Field label="Jenis">
        <select
          name="type"
          defaultValue={category?.type || 'expense'}
          disabled={!!category}
        >
          <option value="expense">Pengeluaran</option>
          <option value="income">Pemasukan</option>
        </select>
        <input
          type="hidden"
          disabled={!category}
          name="type"
          value={category?.type || ''}
        />
      </Field>
      <Field label="Subkategori (pisahkan dengan koma)">
        <input
          name="subs"
          maxLength={300}
          defaultValue={category?.subcategories}
        />
      </Field>
      <div className="form-grid">
        <Field label="Ikon">
          <select name="icon" defaultValue={category?.icon || 'tag'}>
            <option value="tag">Tag</option>
            <option value="wallet">Dompet</option>
            <option value="card">Kartu</option>
          </select>
        </Field>
        <Field label="Warna">
          <input
            name="color"
            type="color"
            defaultValue={category?.color || '#D4AF37'}
          />
        </Field>
      </div>
    </Form>
  )
}
