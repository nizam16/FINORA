import { useState } from 'react'
import type { Data, Entry, Kind, Receipt, Wallet } from '../types'
import {
  entry,
  live,
  names,
  revise,
  today,
  currentTime,
  validateEntry,
  money,
} from '../utils/ledger'
import { Field, Form, num, str } from '../components/ui'
export function WalletSelect({
  name = 'wallet',
  wallets,
  selected,
  required = true,
  onChange,
  'aria-labelledby': label,
}: {
  name?: string
  wallets: Wallet[]
  selected?: string
  required?: boolean
  onChange?: (id: string) => void
  ['aria-labelledby']?: string
}) {
  return (
    <select
      aria-labelledby={label}
      name={name}
      onChange={(e) => onChange?.(e.target.value)}
      defaultValue={selected || ''}
      required={required}
    >
      <option value="">{required ? 'Pilih dompet' : 'Semua dompet'}</option>
      {(['Cash', 'Online'] as const).map((type) => (
        <optgroup key={type} label={type}>
          {wallets
            .filter((w) => w.type === type)
            .map((w) => (
              <option value={w.id} key={w.id}>
                {w.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  )
}
export function TransactionForm({
  data,
  workspace,
  existing,
  copy,
  defaultKind = 'expense',
  receipt,
  save,
}: {
  data: Data
  workspace: string
  existing?: Entry
  copy?: Entry
  defaultKind?: Kind
  receipt?: Receipt
  save: (e: Entry, fee: number, r?: Receipt) => Promise<void>
}) {
  const value = existing || copy
  const suggestion = (text: string) => {
    const hints: [RegExp, string][] = [
      [/resto|cafe|warung|kopi|makan|restaurant/i, 'Makanan & Minuman'],
      [/bensin|parkir|grabcar|gojek|transport/i, 'Transportasi'],
      [/market|mart|tokopedia|shopee/i, 'Belanja'],
      [/hosting|server/i, 'Hosting/VPS'],
      [/internet|pulsa|telkom/i, 'Internet/Pulsa'],
    ]
    const name = hints.find(([rule]) => rule.test(text))?.[1]
    return name
      ? data.categories.find(
          (c) => c.workspace === workspace && !c.archived && c.name === name,
        )?.id || ''
      : ''
  }
  const [kind, setKind] = useState<Kind>(value?.kind || defaultKind),
    [category, setCategory] = useState(
      value?.category ||
        (receipt && defaultKind === 'expense'
          ? suggestion(receipt.merchant + ' ' + receipt.text)
          : ''),
    )
  const wallets = live(data.wallets).filter(
    (w) =>
      w.workspace === workspace &&
      (!w.archived || [value?.source, value?.destination].includes(w.id)),
  )
  const categories = live(data.categories).filter(
    (c) =>
      c.workspace === workspace &&
      c.type === (kind === 'income' ? 'income' : 'expense') &&
      (!c.archived || c.id === value?.category),
  )
  const transfer = kind === 'transfer',
    directed = kind === 'financing' || kind === 'adjustment',
    outgoing = kind === 'expense' || transfer || (directed && !!value?.source)
  const fee =
    existing && live(data.entries).find((e) => e.feeFor === existing.id)
  return (
    <Form
      label={receipt ? 'Konfirmasi dan simpan' : 'Simpan transaksi'}
      save={async (f) => {
        const refund =
          kind === 'refund'
            ? data.entries.find((e) => e.id === str(f, 'related'))
            : undefined
        const fields: Partial<Entry> = {
          kind,
          amount: num(f, 'amount'),
          source: outgoing ? str(f, 'source') : '',
          destination: outgoing && !transfer ? '' : str(f, 'destination'),
          category: refund?.category || str(f, 'category'),
          subcategory: refund?.subcategory || str(f, 'subcategory'),
          merchant: str(f, 'merchant'),
          note: str(f, 'note'),
          date: str(f, 'date'),
          time: str(f, 'time'),
          tags: str(f, 'tags'),
          related: str(f, 'related'),
          receipt: receipt?.id || existing?.receipt || '',
          feeFor: existing?.feeFor,
        }
        const e = existing ? revise(existing, fields) : entry(workspace, fields)
        const admin = transfer ? num(f, 'fee') : 0
        if (admin !== 0 && !money(admin))
          throw Error('Biaya admin harus berupa Rupiah bulat.')
        validateEntry(e, data)
        await save(e, admin, receipt)
      }}
    >
      <Field label="Jenis">
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as Kind)
            setCategory('')
          }}
        >
          {(
            [
              'expense',
              'income',
              'transfer',
              'refund',
              ...(existing &&
              ['adjustment', 'financing'].includes(existing.kind)
                ? [existing.kind]
                : []),
            ] as Kind[]
          ).map((k) => (
            <option key={k} value={k}>
              {names[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Nominal (Rp)">
        <input
          name="amount"
          type="number"
          inputMode="numeric"
          min="1"
          max="1000000000000"
          step="1"
          required
          defaultValue={value?.amount || receipt?.amount || ''}
        />
      </Field>
      {outgoing && (
        <Field label="Dompet asal">
          <WalletSelect
            name="source"
            wallets={wallets}
            selected={value?.source}
          />
        </Field>
      )}
      {(!outgoing || transfer) && (
        <Field label="Dompet tujuan">
          <WalletSelect
            name="destination"
            wallets={wallets}
            selected={value?.destination}
          />
        </Field>
      )}
      {transfer ? (
        <Field label="Biaya admin (Rp)">
          <input
            name="fee"
            type="number"
            min="0"
            step="1"
            defaultValue={fee ? fee.amount : 0}
          />
        </Field>
      ) : kind === 'refund' ? (
        <Field label="Pengeluaran asal">
          <select name="related" required defaultValue={value?.related || ''}>
            <option value="">Pilih pengeluaran</option>
            {live(data.entries)
              .filter((e) => e.kind === 'expense' && e.workspace === workspace)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.date} · {e.merchant || e.note || e.amount}
                </option>
              ))}
          </select>
        </Field>
      ) : (
        <>
          <Field label="Kategori">
            <select
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Tanpa kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {categories.find((c) => c.id === category)?.subcategories && (
            <Field label="Subkategori">
              <select
                key={category}
                name="subcategory"
                defaultValue={value?.subcategory}
              >
                <option value="">Pilih opsional</option>
                {categories
                  .find((c) => c.id === category)
                  ?.subcategories.split(',')
                  .map((s) => (
                    <option key={s.trim()}>{s.trim()}</option>
                  ))}
              </select>
            </Field>
          )}
        </>
      )}
      <div className="form-grid">
        <Field label="Tanggal">
          <input
            name="date"
            type="date"
            required
            defaultValue={value?.date || receipt?.date || today()}
          />
        </Field>
        <Field label="Waktu">
          <input
            name="time"
            type="time"
            required
            defaultValue={value?.time || receipt?.time || currentTime()}
          />
        </Field>
      </div>
      <Field label="Merchant">
        <input
          name="merchant"
          maxLength={120}
          defaultValue={value?.merchant || receipt?.merchant}
        />
      </Field>
      <Field label="Catatan">
        <textarea name="note" maxLength={1000} defaultValue={value?.note} />
      </Field>
      <Field label="Tag">
        <input
          name="tags"
          maxLength={200}
          placeholder="Pisahkan dengan koma"
          defaultValue={value?.tags}
        />
      </Field>
      {receipt && (
        <Field label="Catatan struk">
          <input value={receipt.number || 'Disertakan dalam arsip'} readOnly />
        </Field>
      )}
    </Form>
  )
}
