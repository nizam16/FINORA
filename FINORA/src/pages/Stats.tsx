import { useState } from 'react'
import { Download, TrendingUp } from 'lucide-react'
import { Donut, Flow, series } from '../features/charts'
import { Field, Head, Panel, Price } from '../components/ui'
import { balance, live, planProgress, today, totals } from '../utils/ledger'
import { report, rows } from '../features/export'
import { WalletSelect } from '../features/transactions'
import { nextDue } from '../features/plans'
import type { Data } from '../types'
export function Stats({
  d,
  workspace,
  hide,
  sheets,
}: {
  d: Data
  workspace: string
  hide: boolean
  sheets: (values: (string | number)[][]) => void
}) {
  const now = today()
  const [period, setPeriod] = useState('month'),
    [from, setFrom] = useState(now.slice(0, 8) + '01'),
    [to, setTo] = useState(now),
    [wallet, setWallet] = useState(''),
    [type, setType] = useState(''),
    [category, setCategory] = useState(''),
    [all, setAll] = useState(false),
    [error, setError] = useState('')
  const work = (v: { workspace: string }) => all || v.workspace === workspace
  const wallets = live(d.wallets).filter(
    (w) =>
      work(w) && (!type || w.type === type) && (!wallet || wallet === w.id),
  )
  const ids = new Set(wallets.map((w) => w.id))
  const scope = live(d.entries).filter(
    (e) =>
      work(e) &&
      ((!wallet && !type) || ids.has(e.source) || ids.has(e.destination)) &&
      (!category || e.category === category),
  )
  const monday = new Date(now + 'T00:00:00Z')
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  const start =
    period === 'day'
      ? now
      : period === 'week'
        ? monday.toISOString().slice(0, 10)
        : period === 'month'
          ? now.slice(0, 8) + '01'
          : period === 'year'
            ? now.slice(0, 4) + '-01-01'
            : from
  const end = period === 'custom' ? to : now
  const entries = scope
    .filter((e) => e.date >= start && e.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date))
  const t = totals(entries)
  const group = (key: (e: (typeof entries)[number]) => string) => {
    const values = new Map<string, number>()
    for (const e of entries) {
      const amount =
        e.kind === 'expense' ? e.amount : e.kind === 'refund' ? -e.amount : 0
      if (amount) {
        const name = key(e)
        values.set(name, (values.get(name) || 0) + amount)
      }
    }
    return [...values]
      .map(([name, value]) => ({ name, value }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
  }
  const byCategory = group(
    (e) =>
      d.categories.find((c) => c.id === e.category)?.name || 'Tanpa kategori',
  )
  const merchants = group((e) => e.merchant || 'Tanpa merchant')
  const previous = new Date(now.slice(0, 8) + '01T00:00:00Z')
  previous.setUTCMonth(previous.getUTCMonth() - 1)
  const prior = totals(
    scope.filter((e) => e.date.startsWith(previous.toISOString().slice(0, 7))),
  )
  const month = totals(scope.filter((e) => e.date.startsWith(now.slice(0, 7))))
  const points = series(entries, start, end, {
    ...d,
    wallets,
    entries: d.entries,
  })
  return (
    <div className="stack">
      <Panel>
        <Head title="Periode dan filter" />
        <div className="filters">
          {Object.entries({
            day: 'Hari',
            week: 'Minggu',
            month: 'Bulan',
            year: 'Tahun',
            custom: 'Kustom',
          }).map(([id, label]) => (
            <button
              key={id}
              className={'chip ' + (id === period ? 'selected' : '')}
              onClick={() => setPeriod(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="form-grid">
            <Field label="Dari">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="Sampai">
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
        )}
        <div className="form-grid">
          <Field label="Sumber dana">
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                setWallet('')
              }}
            >
              <option value="">Cash & Online</option>
              <option>Cash</option>
              <option>Online</option>
            </select>
          </Field>
          <Field label="Dompet">
            <WalletSelect
              onChange={setWallet}
              key={type + String(all) + workspace}
              wallets={live(d.wallets).filter(
                (w) => work(w) && (!type || w.type === type),
              )}
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
                .filter(work)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {all ? ' · ' + c.workspace : ''}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Workspace">
            <select
              value={all ? 'all' : workspace}
              onChange={(e) => {
                setAll(e.target.value === 'all')
                setWallet('')
                setCategory('')
              }}
            >
              <option value={workspace}>{workspace}</option>
              <option value="all">Gabungan</option>
            </select>
          </Field>
        </div>
      </Panel>
      <div className="metrics">
        <Panel>
          <small>Pemasukan</small>
          <strong className="income">
            <Price value={t.income} hide={hide} />
          </strong>
        </Panel>
        <Panel>
          <small>Pengeluaran</small>
          <strong className="expense">
            <Price value={t.expense} hide={hide} />
          </strong>
        </Panel>
        <Panel>
          <small>Arus kas bersih</small>
          <strong className="gold">
            <Price value={t.net} hide={hide} />
          </strong>
        </Panel>
      </div>
      <div className="two">
        <Panel>
          <Head title="Pemasukan & pengeluaran" />
          <Flow points={points} mode="bar" hide={hide} />
        </Panel>
        <Panel>
          <Head title="Pengeluaran per kategori" />
          <Donut items={byCategory} hide={hide} />
        </Panel>
        <Panel>
          <Head title="Perubahan saldo" />
          <Flow points={points} mode="line" hide={hide} />
        </Panel>
        <Panel>
          <Head title="Arus kas" />
          <Flow points={points} hide={hide} />
        </Panel>
        <Panel>
          <Head title="Distribusi saldo" />
          <Donut
            items={wallets.map((w) => ({
              name: w.name,
              value: balance(
                w,
                d.entries.filter((e) => e.date <= end),
              ),
            }))}
            hide={hide}
          />
        </Panel>
        <Panel>
          <Head title="Merchant terbesar" />
          {merchants.length ? (
            merchants.slice(0, 6).map((x) => (
              <div className="data-line" key={x.name}>
                <span>{x.name}</span>
                <strong>
                  <Price value={x.value} hide={hide} />
                </strong>
              </div>
            ))
          ) : (
            <p className="empty">Belum ada pengeluaran.</p>
          )}
        </Panel>
      </div>
      <Panel>
        <Head title="Insights bulan ini">
          <TrendingUp size={19} />
        </Head>
        <div className="data-line">
          <span>Arus kas bulan ini</span>
          <strong>
            <Price value={month.net} hide={hide} />
          </strong>
        </div>
        {work({ workspace: 'Business' }) && (
          <div className="data-line">
            <span>Pengeluaran bisnis bulan ini</span>
            <strong>
              <Price
                value={
                  totals(
                    scope.filter(
                      (e) =>
                        e.workspace === 'Business' &&
                        e.date.startsWith(now.slice(0, 7)),
                    ),
                  ).expense
                }
                hide={hide}
              />
            </strong>
          </div>
        )}
        {live(d.plans)
          .filter(
            (p) =>
              work(p) &&
              p.type === 'budget' &&
              p.date.startsWith(now.slice(0, 7)) &&
              planProgress(p, d) >= p.amount * 0.75,
          )
          .map((p) => (
            <div className="data-line" key={p.id}>
              <span>Anggaran · {p.name}</span>
              <strong>
                {hide
                  ? 'Mendekati batas'
                  : Math.round((planProgress(p, d) / p.amount) * 100) +
                    '% terpakai'}
              </strong>
            </div>
          ))}
        {live(d.plans)
          .filter((p) => work(p) && p.type === 'recurring')
          .map((p) => ({ p, due: nextDue(p) }))
          .filter((x) => x.due)
          .sort((a, b) => a.due.localeCompare(b.due))
          .slice(0, 3)
          .map(({ p, due }) => (
            <div className="data-line" key={p.id}>
              <span>Tagihan berulang · {p.name}</span>
              <strong>{due}</strong>
            </div>
          ))}
        <p className="muted">
          Selisih pengeluaran terhadap bulan lalu ·{' '}
          <strong>
            <Price value={month.expense - prior.expense} hide={hide} />
          </strong>
        </p>
        {byCategory[0] && (
          <p className="muted">
            Kategori terbesar dalam periode terpilih · {byCategory[0].name}
          </p>
        )}
        {entries
          .filter((e) => e.kind === 'expense')
          .sort((a, b) => b.amount - a.amount)[0] && (
          <p className="muted">
            Pengeluaran terbesar ·{' '}
            <Price
              value={Math.max(
                ...entries
                  .filter((e) => e.kind === 'expense')
                  .map((e) => e.amount),
              )}
              hide={hide}
            />
          </p>
        )}
      </Panel>
      <Panel>
        <Head title="Ekspor laporan">
          <Download size={19} />
        </Head>
        <div className="filters">
          {(['csv', 'xlsx', 'pdf'] as const).map((f) => (
            <button
              key={f}
              className="outline"
              onClick={() =>
                void report(f, entries, d).catch((e) => setError(e.message))
              }
            >
              {f.toUpperCase()}
            </button>
          ))}
          <button className="outline" onClick={() => sheets(rows(entries, d))}>
            Google Sheets
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </Panel>
    </div>
  )
}
