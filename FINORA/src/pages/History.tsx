import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Entries, Field, Head, Panel } from '../components/ui'
import { WalletSelect } from '../features/transactions'
import { live, names } from '../utils/ledger'
import type { Data, Entry, Kind } from '../types'
export function History({
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
  select: (e: Entry) => void
}) {
  const [query, setQuery] = useState(''),
    [kind, setKind] = useState<Kind | ''>(''),
    [wallet, setWallet] = useState(''),
    [category, setCategory] = useState(''),
    [date, setDate] = useState('')
  const wallets = live(d.wallets).filter((w) => w.workspace === workspace)
  const items = live(d.entries)
    .filter(
      (e) =>
        e.workspace === workspace &&
        (!kind || e.kind === kind) &&
        (!wallet || [e.source, e.destination].includes(wallet)) &&
        (!category || e.category === category) &&
        (!date || e.date.startsWith(date)) &&
        [
          e.merchant,
          e.note,
          e.tags,
          e.subcategory,
          names[e.kind],
          d.categories.find((c) => c.id === e.category)?.name,
        ]
          .join(' ')
          .toLocaleLowerCase('id')
          .includes(query.toLocaleLowerCase('id').trim()),
    )
    .sort((a, b) =>
      (b.date + b.time + b.created).localeCompare(a.date + a.time + a.created),
    )
  return (
    <Panel>
      <Head title="Riwayat transaksi">
        <button className="primary" onClick={add}>
          <Plus size={17} /> Tambah
        </button>
      </Head>
      <label className="search">
        <Search size={19} />
        <input
          aria-label="Cari transaksi"
          placeholder="Cari merchant, catatan, atau tag"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="filters">
        {(
          [
            '',
            'income',
            'expense',
            'transfer',
            'refund',
            'financing',
            'adjustment',
          ] as const
        ).map((k) => (
          <button
            className={'chip ' + (kind === k ? 'selected' : '')}
            key={k}
            onClick={() => setKind(k)}
          >
            {k ? names[k] : 'Semua'}
          </button>
        ))}
      </div>
      <details className="filter-details">
        <summary>Filter tambahan</summary>
        <div className="form-grid">
          <Field label="Dompet">
            <WalletSelect
              onChange={setWallet}
              wallets={wallets}
              required={false}
            />
          </Field>
          <Field label="Kategori">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Semua kategori</option>
              {live(d.categories)
                .filter((c) => c.workspace === workspace)
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Bulan">
            <input
              type="month"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
      </details>
      <Entries
        data={d}
        entries={items}
        hide={hide}
        select={select}
        emptyText="Tidak ada transaksi yang sesuai."
      />
    </Panel>
  )
}
