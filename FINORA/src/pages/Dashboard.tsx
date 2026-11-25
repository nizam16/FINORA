import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowRight,
  Plus,
  ScanLine,
  Wallet as WalletIcon,
  CreditCard,
  Eye,
  EyeOff,
  ChartNoAxesColumnIncreasing,
  Target,
  ChevronRight,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { Entries, Head, Panel, Price } from '../components/ui'
import { Flow, series } from '../features/charts'
import { balance, live, planProgress, today, totals } from '../utils/ledger'
import type { Data, Entry, Plan, PlanKind } from '../types'
interface Props {
  d: Data
  workspace: string
  hide: boolean
  name: string
  toggle: () => void
  quick: (action: 'add' | 'scan' | 'transfer') => void
  go: (page: string) => void
  select: (e: Entry) => void
  plan: (p: Plan) => void
  addPlan: (t: PlanKind) => void
}
export function Dashboard({
  d,
  workspace,
  hide,
  name,
  toggle,
  quick,
  go,
  select,
  plan,
  addPlan,
}: Props) {
  const now = today(),
    start = now.slice(0, 8) + '01'
  const entries = live(d.entries)
    .filter((e) => e.workspace === workspace)
    .sort((a, b) =>
      (b.date + b.time + b.created).localeCompare(a.date + a.time + a.created),
    )
  const wallet = live(d.wallets).filter((w) => w.workspace === workspace)
  const cash = wallet
    .filter((w) => w.type === 'Cash')
    .reduce((s, w) => s + balance(w, d.entries), 0)
  const online = wallet
    .filter((w) => w.type === 'Online')
    .reduce((s, w) => s + balance(w, d.entries), 0)
  const active = entries.filter((e) => e.date >= start && e.date <= now),
    t = totals(active)
  const reduced = useReducedMotion()
  return (
    <motion.div
      className="dashboard"
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="welcome">
        <div>
          <h1>Halo, {name.split(' ')[0]}</h1>
          <p>
            Ringkasan keuangan {workspace === 'Personal' ? 'pribadi' : 'bisnis'}{' '}
            Anda.
          </p>
        </div>
        <span className="date-label">
          {new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'Asia/Jakarta',
          }).format(new Date())}
        </span>
      </div>
      <div className="overview">
        <section className="balance-card">
          <div className="balance-pattern" />
          <div className="balance-top">
            <span>
              <WalletIcon size={17} /> TOTAL SALDO
            </span>
            <button
              className="icon"
              aria-label={hide ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
              onClick={toggle}
            >
              {hide ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
          <div className="balance-number">
            <Price value={cash + online} hide={hide} />
          </div>
          <div className="balance-split">
            <button onClick={() => go('wallets')}>
              <span>
                <WalletIcon size={15} /> Cash
              </span>
              <strong>
                <Price value={cash} hide={hide} />
              </strong>
            </button>
            <button onClick={() => go('wallets')}>
              <span>
                <CreditCard size={15} /> Online
              </span>
              <strong>
                <Price value={online} hide={hide} />
              </strong>
            </button>
          </div>
        </section>
        <Panel className="summary">
          <Head title="Ringkasan bulan ini">
            <ChartNoAxesColumnIncreasing size={18} />
          </Head>
          <div className="summary-list">
            <div>
              <span className="entry-icon income">
                <ArrowDownLeft size={16} />
              </span>
              <span>Pemasukan</span>
              <strong className="income">
                <Price value={t.income} hide={hide} />
              </strong>
            </div>
            <div>
              <span className="entry-icon expense">
                <ArrowUpRight size={16} />
              </span>
              <span>Pengeluaran</span>
              <strong className="expense">
                <Price value={t.expense} hide={hide} />
              </strong>
            </div>
            <div>
              <span className="entry-icon gold">
                <ArrowLeftRight size={16} />
              </span>
              <span>Arus kas bersih</span>
              <strong className="gold">
                <Price value={t.net} hide={hide} />
              </strong>
            </div>
          </div>
        </Panel>
      </div>
      <div className="quick-grid">
        <button className="quick primary" onClick={() => quick('add')}>
          <Plus size={20} />
          Tambah Transaksi
        </button>
        <button className="quick outline" onClick={() => quick('scan')}>
          <ScanLine size={20} />
          Scan Struk
        </button>
        <button className="quick outline" onClick={() => quick('transfer')}>
          <ArrowLeftRight size={20} />
          Transfer Dana
        </button>
      </div>
      <div className="overview content-grid">
        <Panel>
          <Head title="Arus kas">
            <button className="text-link" onClick={() => go('stats')}>
              Statistik <ArrowRight size={15} />
            </button>
          </Head>
          <p className="chart-caption">
            Pemasukan dikurangi pengeluaran · bulan ini
          </p>
          <Flow points={series(active, start, now)} hide={hide} />
        </Panel>
        <Panel>
          <Head title="Transaksi terbaru">
            <button className="text-link" onClick={() => go('transactions')}>
              Lihat semua <ArrowRight size={15} />
            </button>
          </Head>
          <Entries
            data={d}
            entries={entries.slice(0, 4)}
            hide={hide}
            select={select}
          />
        </Panel>
      </div>
      <div className="two">
        {(['budget', 'goal'] as const).map((type) => {
          const p = live(d.plans).find(
            (p) =>
              p.workspace === workspace &&
              p.type === type &&
              (type !== 'budget' || p.date.startsWith(now.slice(0, 7))),
          )
          const actual = p ? planProgress(p, d) : 0
          return (
            <Panel key={type}>
              <Head
                title={
                  type === 'budget' ? 'Anggaran bulan ini' : 'Target tabungan'
                }
              >
                <button
                  className="icon gold"
                  aria-label={p ? 'Lihat ' + p.name : 'Tambah ' + type}
                  onClick={() => (p ? plan(p) : addPlan(type))}
                >
                  {p ? <ChevronRight size={19} /> : <Plus size={19} />}
                </button>
              </Head>
              {p ? (
                <>
                  <div className="data-line">
                    <span>
                      <Target size={16} />
                      {p.name}
                    </span>
                    <strong>
                      <Price value={actual} hide={hide} />{' '}
                      <small>
                        / <Price value={p.amount} hide={hide} />
                      </small>
                    </strong>
                  </div>
                  {!hide && (
                    <progress
                      aria-label={p.name}
                      max={p.amount}
                      value={Math.max(0, actual)}
                    />
                  )}
                </>
              ) : (
                <p className="empty">Belum ada data di workspace ini.</p>
              )}
            </Panel>
          )
        })}
      </div>
    </motion.div>
  )
}
