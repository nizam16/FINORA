import { useState } from 'react'
import {
  CalendarDays,
  Flag,
  Repeat2,
  Bell,
  HandCoins,
  ChartPie,
  Plus,
  Target,
  Wallet,
} from 'lucide-react'
import { Field, Form, Head, Panel, Price, num, str } from '../components/ui'
import { WalletSelect } from './transactions'
import {
  base,
  entry,
  live,
  money,
  occurrence,
  planProgress,
  revise,
  today,
  validateEntry,
} from '../utils/ledger'
import type { Data, Plan, PlanKind } from '../types'
export const planLabels: Record<PlanKind, string> = {
  budget: 'Anggaran',
  goal: 'Target tabungan',
  debt: 'Utang',
  receivable: 'Piutang',
  recurring: 'Transaksi berulang',
  reminder: 'Pengingat',
}
export const planIcons = {
  budget: ChartPie,
  goal: Flag,
  debt: HandCoins,
  receivable: HandCoins,
  recurring: Repeat2,
  reminder: Bell,
}
const financial = ['budget', 'goal', 'debt', 'receivable', 'recurring']
export function PlanList({
  type,
  plans,
  data,
  hide,
  add,
  select,
}: {
  type: PlanKind
  plans: Plan[]
  data: Data
  hide: boolean
  add: () => void
  select: (p: Plan) => void
}) {
  return (
    <Panel>
      <Head title={planLabels[type]}>
        <button
          className="icon gold"
          aria-label={'Tambah ' + planLabels[type]}
          onClick={add}
        >
          <Plus size={21} />
        </button>
      </Head>
      {plans.length ? (
        plans.map((p) => {
          const actual = planProgress(p, data),
            percent =
              p.amount > 0
                ? Math.max(0, Math.round((actual / p.amount) * 100))
                : 0
          const Icon =
            type === 'goal'
              ? p.icon === 'wallet'
                ? Wallet
                : p.icon === 'flag'
                  ? Flag
                  : Target
              : planIcons[type]
          return (
            <button className="plan-row" key={p.id} onClick={() => select(p)}>
              <span className="entry-icon gold">
                <Icon size={19} />
              </span>
              <span className="grow">
                <strong>{p.name}</strong>
                <small>
                  {type === 'budget'
                    ? p.date.slice(0, 7)
                    : p.done
                      ? 'Selesai'
                      : p.due || p.date}
                </small>
                {['budget', 'goal', 'debt', 'receivable'].includes(type) &&
                  !hide && (
                    <progress
                      aria-label={'Progres ' + p.name}
                      max={100}
                      value={percent}
                    />
                  )}
              </span>
              <span className="plan-value">
                {type === 'reminder' ? (
                  p.done ? (
                    'Selesai'
                  ) : (
                    'Terjadwal'
                  )
                ) : (
                  <Price
                    value={
                      type === 'debt' || type === 'receivable'
                        ? p.amount - actual
                        : actual || p.amount
                    }
                    hide={hide}
                  />
                )}
              </span>
            </button>
          )
        })
      ) : (
        <p className="empty">Belum ada {planLabels[type].toLowerCase()}.</p>
      )}
    </Panel>
  )
}
export function PlanForm({
  type,
  p,
  d,
  workspace,
  save,
}: {
  type: PlanKind
  p?: Plan
  d: Data
  workspace: string
  save: (p: Plan) => Promise<void>
}) {
  const [kind, setKind] = useState(p?.template?.kind || 'expense')
  return (
    <Form
      save={async (f) => {
        const amount = num(f, 'amount')
        if (financial.includes(type) && !money(amount))
          throw Error('Nominal tidak valid.')
        if (
          p &&
          amount < planProgress(p, d) &&
          ['goal', 'debt', 'receivable'].includes(type) &&
          type !== 'goal'
        )
          throw Error('Nominal di bawah pembayaran yang tercatat.')
        const date = type === 'budget' ? str(f, 'date') + '-01' : str(f, 'date')
        const due = str(f, 'due')
        if (due && date && due < date)
          throw Error('Jatuh tempo mendahului tanggal mulai.')
        const wallet = str(f, 'wallet'),
          auto = f.has('auto'),
          interval = num(f, 'interval') || 1
        if (!Number.isInteger(interval) || interval < 1 || interval > 3650)
          throw Error('Interval tidak valid.')
        const template =
          type === 'recurring'
            ? {
                kind,
                amount,
                source: kind === 'expense' ? wallet : '',
                destination:
                  kind === 'income'
                    ? wallet
                    : kind === 'transfer'
                      ? str(f, 'destination')
                      : '',
                category: str(f, 'category'),
              }
            : undefined
        if (template && auto)
          validateEntry(entry(workspace, { ...template, date }), d)
        const fields = {
          type,
          name: str(f, 'name'),
          amount,
          date,
          due,
          category: str(f, 'category'),
          icon: str(f, 'icon') || 'target',
          frequency: str(f, 'frequency') || 'monthly',
          interval,
          auto,
          template,
          changes: p?.changes || [],
          done: p?.done,
        }
        if (!fields.name) throw Error('Masukkan nama.')
        await save(p ? revise(p, fields) : { ...base(workspace), ...fields })
      }}
    >
      <Field
        label={
          ['debt', 'receivable'].includes(type)
            ? 'Nama pihak / kewajiban'
            : 'Nama'
        }
      >
        <input name="name" required maxLength={120} defaultValue={p?.name} />
      </Field>
      {financial.includes(type) && (
        <Field label="Nominal (Rp)">
          <input
            name="amount"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            required
            defaultValue={p?.amount}
          />
        </Field>
      )}
      <Field
        label={
          type === 'budget'
            ? 'Bulan'
            : type === 'reminder'
              ? 'Tanggal pengingat'
              : 'Tanggal mulai'
        }
      >
        <input
          type={type === 'budget' ? 'month' : 'date'}
          name="date"
          required
          defaultValue={
            type === 'budget'
              ? (p?.date || today()).slice(0, 7)
              : p?.date || today()
          }
        />
      </Field>
      {['goal', 'debt', 'receivable', 'recurring'].includes(type) && (
        <Field label="Jatuh tempo / batas akhir">
          <input type="date" name="due" defaultValue={p?.due} />
        </Field>
      )}
      {type === 'goal' && (
        <Field label="Ikon">
          <select name="icon" defaultValue={p?.icon}>
            <option value="target">Target</option>
            <option value="wallet">Dompet</option>
            <option value="flag">Bendera</option>
          </select>
        </Field>
      )}
      {type === 'recurring' && (
        <>
          <Field label="Frekuensi">
            <select name="frequency" defaultValue={p?.frequency || 'monthly'}>
              {Object.entries({
                daily: 'Harian',
                weekly: 'Mingguan',
                monthly: 'Bulanan',
                yearly: 'Tahunan',
                custom: 'Khusus (hari)',
              }).map(([value, text]) => (
                <option value={value} key={value}>
                  {text}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Interval khusus (hari)">
            <input
              name="interval"
              type="number"
              step="1"
              min="1"
              max="3650"
              defaultValue={p?.interval || 1}
            />
          </Field>
          <Field label="Jenis">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
              <option value="transfer">Transfer</option>
            </select>
          </Field>
          <Field label={kind === 'income' ? 'Dompet tujuan' : 'Dompet asal'}>
            <WalletSelect
              wallets={live(d.wallets).filter(
                (w) => w.workspace === workspace && !w.archived,
              )}
              selected={p?.template?.source || p?.template?.destination}
            />
          </Field>
          {kind === 'transfer' && (
            <Field label="Dompet tujuan">
              <WalletSelect
                name="destination"
                wallets={live(d.wallets).filter(
                  (w) => w.workspace === workspace && !w.archived,
                )}
                selected={p?.template?.destination}
              />
            </Field>
          )}
          <label className="check">
            <input name="auto" type="checkbox" defaultChecked={p?.auto} /> Catat
            otomatis saat FINORA dibuka
          </label>
        </>
      )}
      {(type === 'budget' || (type === 'recurring' && kind !== 'transfer')) && (
        <Field label="Kategori">
          <select
            name="category"
            required={type === 'budget'}
            defaultValue={p?.category}
          >
            <option value="">Pilih kategori</option>
            {live(d.categories)
              .filter(
                (c) =>
                  c.workspace === workspace &&
                  !c.archived &&
                  c.type ===
                    (type === 'recurring' && kind === 'income'
                      ? 'income'
                      : 'expense'),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
      )}
    </Form>
  )
}
export function nextDue(p: Plan, day = today()) {
  if (p.type !== 'recurring') return p.due || p.date
  for (let i = 0; i < 10000; i++) {
    const date = occurrence(p.date, p.frequency, p.interval, i)
    if (p.due && date > p.due) return ''
    if (date >= day) return date
  }
  return ''
}
export function Calendar({
  data,
  workspace,
  selectDay,
}: {
  data: Data
  workspace: string
  selectDay: (day: string) => void
}) {
  const [month, setMonth] = useState(today().slice(0, 7))
  const root = month + '-01',
    d = new Date(root + 'T00:00:00Z'),
    offset = (d.getUTCDay() + 6) % 7
  const days = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate()
  const events = [
    ...live(data.entries)
      .filter((e) => e.workspace === workspace)
      .map((x) => x.date),
    ...live(data.plans)
      .filter((p) => p.workspace === workspace && !p.done)
      .flatMap((p) =>
        p.type === 'recurring'
          ? Array.from(
              { length: days },
              (_, i) => root.slice(0, 8) + String(i + 1).padStart(2, '0'),
            ).filter((day) => nextDue(p, day) === day)
          : [p.due || p.date],
      ),
  ]
  function step(n: number) {
    d.setUTCMonth(d.getUTCMonth() + n)
    setMonth(d.toISOString().slice(0, 7))
  }
  return (
    <Panel>
      <Head title="Kalender">
        <CalendarDays size={20} />
      </Head>
      <div className="calendar-heading">
        <button
          className="icon"
          aria-label="Bulan sebelumnya"
          onClick={() => step(-1)}
        >
          ‹
        </button>
        <strong>
          {d.toLocaleDateString('id-ID', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
        </strong>
        <button
          className="icon"
          aria-label="Bulan berikutnya"
          onClick={() => step(1)}
        >
          ›
        </button>
      </div>
      <div className="calendar">
        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((x) => (
          <span key={x}>{x}</span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={'space' + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = root.slice(0, 8) + String(i + 1).padStart(2, '0'),
            count = events.filter((date) => date === day).length
          return (
            <button
              className={day === today() ? 'selected' : ''}
              key={day}
              aria-label={day + ' · ' + count + ' agenda'}
              onClick={() => selectDay(day)}
            >
              {i + 1}
              {count > 0 && <i />}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}
