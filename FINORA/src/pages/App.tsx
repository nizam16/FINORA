import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowRight,
  ArrowLeftRight,
  Bell,
  CalendarDays,
  ChevronRight,
  Cloud,
  Download,
  Eye,
  FileImage,
  Fingerprint,
  Lock,
  LogOut,
  Plus,
  Settings,
  Shield,
  Sun,
  Tag,
  Trash2,
  Wallet as WalletIcon,
} from 'lucide-react'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { Brand, Shell } from '../layouts/Shell'
import {
  Entries,
  Field,
  Form,
  Head,
  Modal,
  Panel,
  Price,
  num,
  str,
} from '../components/ui'
import { Dashboard } from './Dashboard'
import { History } from './History'
import { Stats } from './Stats'
import {
  Categories,
  CategoryForm,
  WalletForm,
  Wallets,
} from '../features/wallets'
import { TransactionForm, WalletSelect } from '../features/transactions'
import {
  Calendar,
  nextDue,
  PlanForm,
  PlanList,
  planIcons,
  planLabels,
} from '../features/plans'
import { Scanner } from '../features/scanner'
import { download, report } from '../features/export'
import {
  disablePush,
  enablePush,
  getDeviceSubscription,
  savePushSchedule,
  supportedPush,
} from '../features/push'
import { PinForm, Welcome } from '../auth/Welcome'
import { change, db, ensure, initial } from '../database'
import { api, type Session } from '../services/api'
import { restoreVersioned } from '../sync/merge'
import { useSync } from '../hooks/useSync'
import {
  balance,
  base,
  currentTime,
  entry,
  live,
  money,
  names,
  planProgress,
  recurringEntries,
  revise,
  today,
  validateEntry,
} from '../utils/ledger'
import type {
  Category,
  Collection,
  Data,
  Entry,
  Kind,
  Plan,
  PlanKind,
  Profile,
  Receipt,
  Wallet,
} from '../types'
type Open =
  | {
      type: 'entryForm'
      kind: Kind
      edit?: Entry
      copy?: Entry
      receipt?: Receipt
      queue?: File[]
    }
  | { type: 'entry'; id: string }
  | { type: 'walletForm'; w?: Wallet }
  | { type: 'wallet'; id: string }
  | { type: 'reconcile'; id: string }
  | { type: 'category'; c?: Category }
  | { type: 'planForm'; kind: PlanKind; p?: Plan }
  | { type: 'plan'; id: string }
  | { type: 'planChange'; id: string }
  | { type: 'receipt'; id: string }
  | { type: 'sheetExport'; rows: (string | number)[][] }
  | { type: 'day'; day: string }
  | { type: 'scan'; queue?: File[] }
  | {
      type:
        | 'notify'
        | 'push'
        | 'pin'
        | 'profile'
        | 'sync'
        | 'backup'
        | 'delete'
        | 'help'
        | 'logout'
    }
const localKey = 'finora.account'
const pages: Record<string, string> = {
  transactions: 'Transaksi',
  stats: 'Statistik & laporan',
  wallets: 'Dompet',
  account: 'Akun',
  categories: 'Kategori',
  plans: 'Rencana keuangan',
  calendar: 'Kalender',
  receipts: 'Arsip struk',
}
const activeAccount = () => localStorage.getItem(localKey) || ''
function pushDates(data: Data) {
  const now = today()
  const dates = live(data.plans).flatMap((p) => {
    if (p.done) return []
    if (p.type === 'recurring') return [nextDue(p)]
    if (p.type === 'reminder') return [p.date]
    if (
      ['goal', 'debt', 'receivable'].includes(p.type) &&
      planProgress(p, data) < p.amount
    )
      return [p.due]
    return []
  })
  return [...new Set(dates)]
    .filter((day) => day >= now)
    .sort()
    .slice(0, 100)
}
function ButtonRow({
  Icon,
  label,
  note,
  action,
}: {
  Icon: typeof ChevronRight
  label: string
  note?: string
  action: () => void
}) {
  return (
    <button className="entry-row" onClick={action}>
      <span className="entry-icon gold">
        <Icon size={18} />
      </span>
      <span className="entry-copy">
        <strong>{label}</strong>
        {note && <small>{note}</small>}
      </span>
      <ChevronRight className="muted" size={17} />
    </button>
  )
}
export function App() {
  const [account, setAccount] = useState(activeAccount),
    [boot, setBoot] = useState(true),
    [google, setGoogle] = useState(false),
    [authError, setAuthError] = useState(''),
    [locked, setLocked] = useState(true),
    [online, setOnline] = useState(navigator.onLine),
    [workspace, setWorkspace] = useState('Personal'),
    [page, setPage] = useState('home'),
    [open, setOpen] = useState<Open>(),
    [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [stage, setStage] = useState(''),
    [choices, setChoices] = useState<Record<string, 'local' | 'remote'>>({})
  const [pushKey, setPushKey] = useState(''),
    [sheetFiles, setSheetFiles] = useState<{ id: string; name: string }[]>([]),
    [exported, setExported] = useState('')
  const state = useLiveQuery(
    () => (account ? db.accounts.get(account) : undefined),
    [account],
  )
  const profile = state?.profile
  const demo = account === 'demo'
  const sync = useSync(state, online, !locked)
  const patch = (p: Partial<Profile>) =>
    change(account, (s) => {
      Object.assign(s.profile, p)
    })
  const action = (fn: () => Promise<unknown>) => {
    setError('')
    void fn().catch((e) =>
      setError(e instanceof Error ? e.message : 'Operasi gagal.'),
    )
  }
  function modal(o: Open) {
    setError('')
    setExported('')
    setOpen(o)
  }
  function close() {
    setError('')
    setOpen(undefined)
  }
  function go(p: string) {
    setPage(p)
    close()
    window.scrollTo(0, 0)
  }
  async function enter(id: string, name: string) {
    await ensure(id, name)
    const s = await db.accounts.get(id)
    localStorage.setItem(localKey, id)
    setAccount(id)
    setLocked(!!s?.profile.pin)
    setPage('home')
    setWorkspace('Personal')
  }
  useEffect(() => {
    let cancelled = false
    async function init() {
      const params = new URLSearchParams(location.search)
      if (params.has('auth')) {
        setAuthError(
          params.get('auth') === 'error'
            ? 'Login FINORA gagal atau dibatalkan.'
            : '',
        )
        history.replaceState(null, '', location.pathname)
      }
      const id = activeAccount()
      const unavailable = {
        google: false,
        session: undefined,
        pushKey: undefined,
      }
      const config = navigator.onLine
        ? await api<{ google: boolean; session?: Session; pushKey?: string }>(
            'session',
          ).catch(() => unavailable)
        : unavailable
      if (cancelled) return
      setGoogle(config.google)
      setPushKey(config.pushKey || '')
      if (config.session) await enter(config.session.id, config.session.name)
      else if (id === 'demo') await enter('demo', 'Demo')
      else if (id && (await db.accounts.get(id))) {
        setAccount(id)
        setLocked(true)
      }
      if (!cancelled) setBoot(false)
    }
    void init().catch((e) => {
      setAuthError(e.message)
      setBoot(false)
    })
    const network = () => setOnline(navigator.onLine)
    window.addEventListener('online', network)
    window.addEventListener('offline', network)
    return () => {
      cancelled = true
      window.removeEventListener('online', network)
      window.removeEventListener('offline', network)
    }
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = profile?.theme || 'dark'
  }, [profile?.theme])
  useEffect(() => {
    if (locked || !profile?.pin || !profile.autoLock) return
    let t: number,
      last = Date.now()
    const lock = () => {
      setLocked(true)
      setOpen(undefined)
    }
    const reset = () => {
      last = Date.now()
      clearTimeout(t)
      t = window.setTimeout(lock, profile.autoLock * 1000)
    }
    const visible = () => {
      if (!document.hidden && Date.now() - last >= profile.autoLock * 1000)
        lock()
    }
    reset()
    window.addEventListener('pointerdown', reset)
    window.addEventListener('keydown', reset)
    document.addEventListener('visibilitychange', visible)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointerdown', reset)
      window.removeEventListener('keydown', reset)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [locked, profile?.pin, profile?.autoLock])
  useEffect(() => {
    if (!account || locked || !profile?.completed) return
    const run = () =>
      void change(account, (s) => {
        for (const p of s.data.plans)
          s.data.entries.push(...recurringEntries(p, s.data))
      }).catch((e) => setError(e.message))
    run()
    const onVisible = () => {
      if (!document.hidden) run()
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(run, 60_000)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [account, locked, profile?.completed])
  const dueDates = JSON.stringify(state ? pushDates(state.data) : [])
  useEffect(() => {
    if (!pushKey || !profile?.pushEnabled || locked || !online) return
    let live = true
    void getDeviceSubscription()
      .then((sub) => {
        if (live && sub) return savePushSchedule(sub, JSON.parse(dueDates))
        return undefined
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [dueDates, pushKey, profile?.pushEnabled, locked, online])
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(t)
  }, [notice])
  async function passkey() {
    const options = await api<
      Parameters<typeof startAuthentication>[0]['optionsJSON']
    >('passkey/options', {})
    const result = await startAuthentication({ optionsJSON: options })
    const session = await api<Session>('passkey/verify', result)
    await enter(session.id, session.name)
    setLocked(false)
  }
  async function register() {
    const options = await api<
      Parameters<typeof startRegistration>[0]['optionsJSON']
    >('passkey/register-options', {})
    await api(
      'passkey/register-verify',
      await startRegistration({ optionsJSON: options }),
    )
    setNotice('Passkey terdaftar.')
  }
  if (boot)
    return (
      <div className="splash">
        <Brand />
        <div className="skeleton" aria-label="Memuat FINORA" />
      </div>
    )
  if (!state || !profile)
    return (
      <Welcome
        demo={async () => {
          await enter('demo', 'Demo')
          await change('demo', (s) => {
            s.profile.completed = true
          })
        }}
        google={google}
        passkey={passkey}
        error={authError}
      />
    )
  const d = state.data,
    hide = profile.privacy
  const wallets = live(d.wallets).filter((w) => w.workspace === workspace)
  const workspacePlans = live(d.plans).filter((p) => p.workspace === workspace)
  const receipts = live(d.receipts).filter((r) => r.workspace === workspace)
  const n = today()
  const alerts = workspacePlans.flatMap((p) => {
    const value = planProgress(p, d)
    if (
      p.type === 'budget' &&
      p.date.startsWith(n.slice(0, 7)) &&
      value >= p.amount * 0.75
    ) {
      const level = value >= p.amount ? 100 : value >= p.amount * 0.9 ? 90 : 75
      return [{ p, text: `Anggaran mencapai ambang ${level}%` }]
    }
    if (p.type === 'goal' && value >= p.amount)
      return [{ p, text: 'Target tercapai' }]
    const due = p.type === 'recurring' ? nextDue(p) : p.due || p.date
    const soon = new Date(Date.parse(n) + 3 * 86_400_000)
      .toISOString()
      .slice(0, 10)
    if (
      !p.done &&
      due &&
      due <= soon &&
      (['reminder', 'recurring'].includes(p.type) ||
        (['debt', 'receivable', 'goal'].includes(p.type) && value < p.amount))
    )
      return [
        {
          p,
          text:
            due < n
              ? 'Lewat jatuh tempo'
              : due === n
                ? 'Jatuh tempo hari ini'
                : 'Jatuh tempo ' + due,
        },
      ]
    return []
  })
  const select = (e: Entry) => modal({ type: 'entry', id: e.id })
  const showPlan = (p: Plan) => modal({ type: 'plan', id: p.id })
  const addPlan = (kind: PlanKind) => modal({ type: 'planForm', kind })
  const quick = (a: 'add' | 'scan' | 'transfer') =>
    a === 'scan'
      ? modal({ type: 'scan' })
      : modal({
          type: 'entryForm',
          kind: a === 'transfer' ? 'transfer' : 'expense',
        })
  async function saveItem<K extends Collection>(
    key: K,
    item: Data[K][number],
    message = 'Perubahan tersimpan.',
  ) {
    await change(account, (s) => {
      const list = s.data[key] as Data[K][number][]
      const index = list.findIndex((x) => x.id === item.id)
      if (index >= 0) {
        if (list[index].version + 1 !== item.version)
          throw Error('Data sudah berubah. Buka ulang sebelum menyunting.')
        list[index] = item
      } else list.push(item)
    })
    close()
    setNotice(message)
  }
  async function saveEntry(e: Entry, fee: number, r?: Receipt) {
    await change(account, (s) => {
      validateEntry(e, s.data)
      const history = s.data.entries
      const i = history.findIndex((x) => x.id === e.id)
      if (i >= 0) {
        if (history[i].version + 1 !== e.version)
          throw Error('Transaksi sudah berubah. Buka ulang.')
        history[i] = e
      } else history.push(e)
      const j = history.findIndex((x) => x.feeFor === e.id && !x.deleted)
      if (fee) {
        const category =
          s.data.categories.find(
            (c) => c.workspace === e.workspace && c.name === 'Biaya Admin',
          )?.id || ''
        const fields: Partial<Entry> = {
          kind: 'expense',
          amount: fee,
          source: e.source,
          destination: '',
          category,
          merchant: 'Biaya transfer',
          date: e.date,
          time: e.time,
          feeFor: e.id,
        }
        if (j >= 0) history[j] = revise(history[j], fields)
        else history.push(entry(e.workspace, fields))
      } else if (j >= 0)
        history[j] = revise(history[j], { deleted: new Date().toISOString() })
      if (r && !s.data.receipts.some((x) => x.id === r.id))
        s.data.receipts.push(r)
    })
    close()
    setNotice(r ? 'Struk dan transaksi tersimpan.' : 'Transaksi tersimpan.')
  }
  async function removeEntry(item: Entry) {
    if (!window.confirm('Hapus transaksi ini?')) return
    await change(account, (s) => {
      if (s.data.plans.some((p) => p.changes.some((c) => c.entry === item.id)))
        throw Error(
          'Transaksi terkait pembayaran atau tabungan. Catat transaksi pembalik untuk mempertahankan jejak.',
        )
      if (
        live(s.data.entries).some(
          (x) => x.kind === 'refund' && x.related === item.id,
        )
      )
        throw Error('Hapus refund terkait terlebih dahulu.')
      s.data.entries = s.data.entries.map((e) =>
        !e.deleted && (e.id === item.id || e.feeFor === item.id)
          ? revise(e, { deleted: new Date().toISOString() })
          : e,
      )
    })
    close()
    setNotice('Transaksi dihapus.')
  }
  async function logout() {
    if (!demo) {
      if (profile?.pushEnabled) {
        await disablePush().catch(() => {})
        await patch({ pushEnabled: false })
      }
      await api('logout', {})
    }
    localStorage.removeItem(localKey)
    setAccount('')
    setLocked(true)
    close()
    setStage('')
  }
  async function connect(sheet?: string) {
    const result = await api<{ sheet: string }>('sheet/connect', { sheet })
    await change(account, (s) => {
      if (s.profile.sheet !== result.sheet) {
        s.baseline = undefined
        s.profile.lastSync = undefined
      }
      s.profile.sheet = result.sheet
    })
    setNotice('Spreadsheet privat terhubung.')
  }
  function sheetLink() {
    return profile?.sheet
      ? 'https://docs.google.com/spreadsheets/d/' + profile.sheet + '/edit'
      : ''
  }
  function sheetControls() {
    return (
      <>
        <p className="muted">
          {demo
            ? 'Data demo tersimpan di perangkat. Masuk dengan kode akses untuk sinkronisasi ke akun terpisah.'
            : 'FINORA menyimpan ledger di spreadsheet privat milik akun Google Anda.'}
        </p>
        {demo ? (
          google ? (
            <a className="outline" href="/api/login">
              Masuk dengan kode akses
            </a>
          ) : (
            <p className="empty">Apps Script belum dikonfigurasi.</p>
          )
        ) : (
          <>
            {profile?.sheet ? (
              <>
                <div className="data-line">
                  <span>Status</span>
                  <strong>{online ? 'Terhubung' : 'Offline'}</strong>
                </div>
                <div className="data-line">
                  <span>Sinkron terakhir</span>
                  <strong>
                    {profile.lastSync
                      ? new Date(profile.lastSync).toLocaleString('id-ID', {
                          timeZone: 'Asia/Jakarta',
                        })
                      : 'Belum pernah'}
                  </strong>
                </div>
                <div className="filters">
                  <button
                    className="primary"
                    disabled={!online || sync.busy}
                    onClick={() => void sync.sync()}
                  >
                    Sinkronkan sekarang
                  </button>
                  <a
                    className="outline"
                    href={sheetLink()}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buka Sheets
                  </a>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={profile.autoSync}
                    onChange={(e) =>
                      action(() => patch({ autoSync: e.target.checked }))
                    }
                  />{' '}
                  Sinkronisasi otomatis
                </label>
              </>
            ) : (
              <>
                <button
                  className="primary"
                  disabled={!online}
                  onClick={() => action(() => connect())}
                >
                  Hubungkan Apps Script
                </button>
                <button
                  className="outline"
                  disabled={!online}
                  onClick={() =>
                    action(async () => {
                      const r = await api<{
                        files: { id: string; name: string }[]
                      }>('sheet/list', {})
                      setSheetFiles(r.files)
                      if (!r.files.length)
                        setNotice(
                          'Belum ada spreadsheet FINORA yang bisa dipilih.',
                        )
                    })
                  }
                >
                  Cari spreadsheet FINORA
                </button>
                {sheetFiles
                  .filter((f) => f.name !== 'FINORA - Laporan Transaksi')
                  .map((f) => (
                    <button
                      key={f.id}
                      className="outline"
                      onClick={() => action(() => connect(f.id))}
                    >
                      {f.name} · {f.id.slice(-5)}
                    </button>
                  ))}
                <Form
                  label="Hubungkan spreadsheet FINORA"
                  save={(f) => connect(str(f, 'sheet'))}
                >
                  <Field label="ID atau tautan spreadsheet FINORA">
                    <input name="sheet" required />
                  </Field>
                </Form>
              </>
            )}
            {sync.status && (
              <p role="status" className="muted">
                {sync.status}
              </p>
            )}
            {!!sync.conflicts.length && (
              <Form
                label="Terapkan pilihan konflik"
                save={() => sync.sync(choices)}
              >
                {sync.conflicts.map((c) => {
                  const k = c.key + ':' + c.id
                  return (
                    <div key={k}>
                      <Field label={c.key + ' · ' + c.id.slice(0, 8)}>
                        <select
                          required
                          value={choices[k] || ''}
                          onChange={(e) =>
                            setChoices({
                              ...choices,
                              [k]: e.target.value as 'local' | 'remote',
                            })
                          }
                        >
                          <option value="">Pilih versi</option>
                          <option value="local">Versi perangkat</option>
                          <option value="remote">Versi Google Sheets</option>
                        </select>
                      </Field>
                      <details>
                        <summary>Bandingkan data</summary>
                        {hide ? (
                          <p>Nonaktifkan mode privasi untuk melihat data.</p>
                        ) : (
                          <>
                            <p>Perangkat</p>
                            <pre>
                              {JSON.stringify(
                                c.local,
                                (key, value) =>
                                  key === 'image' ? undefined : value,
                                2,
                              )}
                            </pre>
                            <p>Google Sheets</p>
                            <pre>{JSON.stringify(c.remote, null, 2)}</pre>
                          </>
                        )}
                      </details>
                    </div>
                  )
                })}
              </Form>
            )}
          </>
        )}
      </>
    )
  }
  if (locked && (!demo || profile.pin))
    return (
      <div className="center">
        <Panel className="gate">
          <Brand />
          <Lock size={24} className="gold" />
          <h1>FINORA terkunci</h1>
          {profile.pin && (
            <PinForm
              profile={profile}
              save={patch}
              unlock={() => setLocked(false)}
            />
          )}{' '}
          {!demo && google && (
            <div className="filters">
              <a href="/api/login" className="outline">
                Masuk dengan kode akses
              </a>
              <button className="outline" onClick={() => action(passkey)}>
                Passkey
              </button>
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </Panel>
      </div>
    )
  if (!profile.completed && !demo) {
    const setupStage =
      stage || (!profile.sheet ? 'sheet' : !profile.pin ? 'pin' : 'passkey')
    return (
      <div className="center">
        <Panel className="gate">
          <Brand />
          <h1>
            {setupStage === 'sheet'
              ? 'Hubungkan Google Sheets'
              : setupStage === 'pin'
                ? 'Buat PIN 6 digit'
                : setupStage === 'passkey'
                  ? 'Aktifkan Passkey'
                  : 'Atur saldo awal'}
          </h1>
          {setupStage === 'sheet' && sheetControls()}
          {setupStage === 'pin' && (
            <>
              <p className="success">Spreadsheet terhubung.</p>
              <PinForm profile={profile} save={patch} />
            </>
          )}
          {setupStage === 'passkey' && (
            <>
              <p className="muted">
                Gunakan autentikator perangkat Anda, termasuk Face ID jika
                tersedia.
              </p>
              <button
                className="primary"
                onClick={() =>
                  action(async () => {
                    await register()
                    setStage('opening')
                  })
                }
              >
                <Fingerprint size={17} /> Aktifkan Passkey
              </button>
              <button className="outline" onClick={() => setStage('opening')}>
                Lewati untuk sekarang
              </button>
            </>
          )}
          {setupStage === 'opening' && (
            <>
              <p className="muted">
                Saldo awal dipakai sebagai titik awal buku kas Anda.
              </p>
              <WalletForm
                workspace={workspace}
                save={(w) => saveItem('wallets', w)}
              />
              {wallets.length > 0 && (
                <p className="success">
                  {wallets.length} dompet siap digunakan.
                </p>
              )}
              <button
                className="outline"
                onClick={() => action(() => patch({ completed: true }))}
              >
                {wallets.length
                  ? 'Masuk dashboard'
                  : 'Mulai dengan saldo kosong'}
              </button>
            </>
          )}
          {error && <p className="error">{error}</p>}
        </Panel>
      </div>
    )
  }
  let title = '',
    body: ReactNode
  if (open?.type === 'entryForm') {
    title = open.edit
      ? 'Edit transaksi'
      : open.kind === 'transfer'
        ? 'Transfer dana'
        : open.receipt
          ? 'Konfirmasi transaksi struk'
          : 'Tambah transaksi'
    body = (
      <>
        {!wallets.some((w) => !w.archived) ? (
          <>
            <p className="muted">Tambahkan dompet untuk mencatat transaksi.</p>
            <button
              className="primary"
              onClick={() => modal({ type: 'walletForm' })}
            >
              Tambah dompet
            </button>
          </>
        ) : (
          <TransactionForm
            key={open.edit?.id || open.receipt?.id || open.kind}
            data={d}
            workspace={workspace}
            existing={open.edit}
            copy={open.copy}
            defaultKind={open.kind}
            receipt={open.receipt}
            save={async (e, fee, r) => {
              await saveEntry(e, fee, r)
              if (open.queue?.length) modal({ type: 'scan', queue: open.queue })
            }}
          />
        )}
      </>
    )
  }
  if (open?.type === 'entry') {
    const e = live(d.entries).find((x) => x.id === open.id)
    if (e) {
      title = 'Detail transaksi'
      const w = (id: string) => d.wallets.find((w) => w.id === id)?.name || '—'
      body = (
        <>
          <div className="detail-total">
            <small>{names[e.kind]}</small>
            <strong>
              <Price value={e.amount} hide={hide} />
            </strong>
          </div>
          {Object.entries({
            Merchant: e.merchant,
            Tanggal: e.date + ' · ' + e.time,
            'Dompet asal': w(e.source),
            'Dompet tujuan': w(e.destination),
            Kategori: d.categories.find((c) => c.id === e.category)?.name,
            Subkategori: e.subcategory,
            Catatan: e.note,
            Tag: e.tags,
            Workspace: e.workspace,
          })
            .filter(([, v]) => v && v !== '—')
            .map(([k, v]) => (
              <div className="data-line" key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          {e.receipt && (
            <button
              className="outline"
              onClick={() => modal({ type: 'receipt', id: e.receipt })}
            >
              Lihat struk
            </button>
          )}
          <div className="filters">
            {!e.feeFor && !['adjustment', 'financing'].includes(e.kind) && (
              <button
                className="primary"
                onClick={() =>
                  modal({ type: 'entryForm', kind: e.kind, edit: e })
                }
              >
                Edit
              </button>
            )}
            {!['adjustment', 'financing'].includes(e.kind) && (
              <button
                className="outline"
                onClick={() =>
                  modal({ type: 'entryForm', kind: e.kind, copy: e })
                }
              >
                Duplikasi
              </button>
            )}
            {!d.plans.some((p) => p.changes.some((c) => c.entry === e.id)) && (
              <button
                className="outline danger"
                onClick={() => action(() => removeEntry(e))}
              >
                <Trash2 size={16} /> Hapus
              </button>
            )}
          </div>
        </>
      )
    }
  }
  if (open?.type === 'walletForm') {
    title = open.w ? 'Edit dompet' : 'Tambah dompet'
    body = (
      <WalletForm
        key={open.w?.id || 'new'}
        wallet={open.w}
        workspace={workspace}
        save={(w) => saveItem('wallets', w)}
      />
    )
  }
  if (open?.type === 'wallet') {
    const w = wallets.find((w) => w.id === open.id)
    if (w) {
      title = w.name
      body = (
        <>
          <div className="detail-total">
            <small>
              {w.type} · {w.subtype}
            </small>
            <strong>
              <Price value={balance(w, d.entries)} hide={hide} />
            </strong>
          </div>
          <div className="data-line">
            <span>Saldo awal</span>
            <strong>
              <Price value={w.opening} hide={hide} />
            </strong>
          </div>
          <div className="filters">
            <button
              className="primary"
              onClick={() => modal({ type: 'walletForm', w })}
            >
              Edit
            </button>
            <button
              className="outline"
              onClick={() => modal({ type: 'reconcile', id: w.id })}
            >
              Rekonsiliasi
            </button>
            <button
              className="outline"
              onClick={() =>
                action(() =>
                  saveItem('wallets', revise(w, { archived: !w.archived })),
                )
              }
            >
              {w.archived ? 'Aktifkan kembali' : 'Arsipkan'}
            </button>
          </div>
          <Head title="Riwayat dompet" />
          <Entries
            entries={live(d.entries)
              .filter((e) => e.source === w.id || e.destination === w.id)
              .sort((a, b) => b.date.localeCompare(a.date))}
            data={d}
            hide={hide}
            select={select}
          />
        </>
      )
    }
  }
  if (open?.type === 'reconcile') {
    const w = wallets.find((w) => w.id === open.id)
    if (w) {
      title = 'Rekonsiliasi saldo'
      body = (
        <Form
          label="Catat penyesuaian"
          save={async (f) => {
            const actual = num(f, 'actual')
            if (!Number.isSafeInteger(actual) || Math.abs(actual) > 1e12)
              throw Error('Saldo aktual harus berupa Rupiah bulat.')
            await change(account, (s) => {
              const current = s.data.wallets.find((x) => x.id === w.id)
              if (!current) throw Error('Dompet tidak ditemukan.')
              const audited = balance(current, s.data.entries),
                diff = actual - audited
              if (!diff) throw Error('Saldo sudah sesuai.')
              const e = entry(workspace, {
                kind: 'adjustment',
                amount: Math.abs(diff),
                source: diff < 0 ? w.id : '',
                destination: diff > 0 ? w.id : '',
                note: `Rekonsiliasi ${audited} → ${actual}. ${str(f, 'note')}`,
              })
              validateEntry(e, s.data)
              s.data.entries.push(e)
            })
            close()
            setNotice('Penyesuaian saldo tersimpan.')
          }}
        >
          <p className="muted">
            Saldo buku · <Price value={balance(w, d.entries)} hide={hide} />
          </p>
          <Field label="Saldo aktual (Rp)">
            <input name="actual" type="number" step="1" required />
          </Field>
          <Field label="Alasan penyesuaian">
            <textarea name="note" required maxLength={500} />
          </Field>
        </Form>
      )
    }
  }
  if (open?.type === 'category') {
    const c = open.c
    title = c ? 'Edit kategori' : 'Tambah kategori'
    body = (
      <>
        <CategoryForm
          category={c}
          workspace={workspace}
          save={(v) => saveItem('categories', v)}
        />
        {c && (
          <button
            className="outline"
            onClick={() =>
              action(() =>
                saveItem('categories', revise(c, { archived: !c.archived })),
              )
            }
          >
            {c.archived ? 'Aktifkan kembali' : 'Arsipkan kategori'}
          </button>
        )}
      </>
    )
  }
  if (open?.type === 'scan') {
    title = 'Scan struk'
    body = (
      <Scanner
        workspace={workspace}
        data={d}
        queue={open.queue}
        next={(r, kind, queue) =>
          modal({ type: 'entryForm', kind, receipt: r, queue })
        }
      />
    )
  }
  if (open?.type === 'receipt') {
    const r = receipts.find((x) => x.id === open.id)
    if (r) {
      title = 'Detail struk'
      body = (
        <>
          <div className="detail-total">
            <small>
              {r.merchant || 'Struk'} · {r.date}
            </small>
            <strong>
              <Price value={r.amount} hide={hide} />
            </strong>
          </div>
          {!hide && r.image && (
            <div className="image-preview">
              <img src={r.image} alt="Foto struk" />
            </div>
          )}
          {Object.entries({
            Nomor: r.number,
            Alamat: r.address,
            Waktu: r.time,
            'Metode bayar': r.method,
            Item: hide ? '' : r.items,
          })
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div className="data-line" key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          {!hide && r.text && (
            <details>
              <summary>Teks OCR</summary>
              <pre>{r.text}</pre>
            </details>
          )}
          {r.driveId && (
            <a
              className="outline"
              target="_blank"
              rel="noreferrer"
              href={
                'https://drive.google.com/open?id=' +
                encodeURIComponent(r.driveId)
              }
            >
              Buka foto privat di Drive
            </a>
          )}
          {!demo && r.image && !r.driveId && (
            <button
              className="outline"
              onClick={() =>
                action(async () => {
                  const v = await api<{ id: string }>('drive/receipt', {
                    id: r.id,
                    image: r.image,
                  })
                  await saveItem(
                    'receipts',
                    revise(r, { driveId: v.id }),
                    'Foto tersimpan di Drive privat.',
                  )
                })
              }
            >
              Simpan foto ke Google Drive
            </button>
          )}
        </>
      )
    }
  }
  if (open?.type === 'planForm') {
    title = open.p
      ? 'Edit ' + planLabels[open.kind]
      : 'Tambah ' + planLabels[open.kind]
    body = (
      <PlanForm
        type={open.kind}
        p={open.p}
        workspace={workspace}
        d={d}
        save={(p) => {
          if (
            p.type === 'budget' &&
            workspacePlans.some(
              (x) =>
                x.id !== p.id &&
                x.type === 'budget' &&
                x.category === p.category &&
                x.date.slice(0, 7) === p.date.slice(0, 7),
            )
          )
            throw Error('Kategori ini sudah memiliki anggaran bulan tersebut.')
          return saveItem('plans', p)
        }}
      />
    )
  }
  if (open?.type === 'plan') {
    const p = workspacePlans.find((p) => p.id === open.id)
    if (p) {
      const value = planProgress(p, d)
      title = p.name
      body = (
        <>
          <div className="detail-total">
            <small>{planLabels[p.type]}</small>
            {p.amount > 0 && (
              <strong>
                <Price value={p.amount} hide={hide} />
              </strong>
            )}
          </div>
          {p.due && (
            <div className="data-line">
              <span>Jatuh tempo</span>
              <strong>{p.due}</strong>
            </div>
          )}
          {['budget', 'goal', 'debt', 'receivable'].includes(p.type) && (
            <>
              <div className="data-line">
                <span>
                  {p.type === 'budget'
                    ? 'Aktual'
                    : p.type === 'goal'
                      ? 'Teralokasi'
                      : 'Terbayar'}
                </span>
                <strong>
                  <Price value={value} hide={hide} />
                </strong>
              </div>
              <div className="data-line">
                <span>Sisa</span>
                <strong>
                  <Price value={p.amount - value} hide={hide} />
                </strong>
              </div>
              {!hide && <progress max={p.amount} value={Math.max(0, value)} />}
            </>
          )}
          {p.type === 'recurring' && (
            <div className="data-line">
              <span>Jadwal berikutnya</span>
              <strong>
                {nextDue(p) || 'Berakhir'} · {p.auto ? 'Otomatis' : 'Pengingat'}
              </strong>
            </div>
          )}
          {p.changes.map((c) => (
            <div className="data-line" key={c.id}>
              <span>
                {c.date} · {c.note}
              </span>
              <strong>
                <Price value={c.amount} hide={hide} />
              </strong>
            </div>
          ))}
          <div className="filters">
            <button
              className="primary"
              onClick={() => modal({ type: 'planForm', kind: p.type, p })}
            >
              Edit
            </button>
            {['goal', 'debt', 'receivable'].includes(p.type) && (
              <button
                className="outline"
                onClick={() => modal({ type: 'planChange', id: p.id })}
              >
                {p.type === 'goal' ? 'Ubah alokasi' : 'Catat cicilan / pokok'}
              </button>
            )}
            {p.type === 'reminder' && (
              <button
                className="outline"
                onClick={() =>
                  action(() => saveItem('plans', revise(p, { done: !p.done })))
                }
              >
                {p.done ? 'Aktifkan kembali' : 'Tandai selesai'}
              </button>
            )}
            <button
              className="outline danger"
              onClick={() => {
                if (
                  window.confirm(
                    'Arsipkan rencana ini? Transaksi terkait tetap tersimpan.',
                  )
                )
                  action(() =>
                    saveItem(
                      'plans',
                      revise(p, { deleted: new Date().toISOString() }),
                    ),
                  )
              }}
            >
              Arsipkan
            </button>
          </div>
        </>
      )
    }
  }
  if (open?.type === 'planChange') {
    const p = workspacePlans.find((p) => p.id === open.id)
    if (p) {
      title = p.type === 'goal' ? 'Perbarui target' : 'Catat pokok atau cicilan'
      body = (
        <Form
          save={async (f) => {
            const amount = num(f, 'amount'),
              mode = str(f, 'mode'),
              date = str(f, 'date')
            if (!money(amount)) throw Error('Nominal tidak valid.')
            await change(account, (s) => {
              const index = s.data.plans.findIndex(
                  (x) => x.id === p.id && !x.deleted,
                ),
                current = s.data.plans[index]
              if (!current) throw Error('Rencana tidak ditemukan.')
              const prior = planProgress(current, s.data),
                delta =
                  mode === 'subtract'
                    ? -amount
                    : mode === 'principal'
                      ? 0
                      : amount
              if (
                prior + delta < 0 ||
                (p.type !== 'goal' && prior + delta > current.amount)
              )
                throw Error('Nominal melebihi saldo yang diperbolehkan.')
              let ledger: Entry | undefined
              if (
                p.type === 'goal' &&
                Boolean(str(f, 'source')) !== Boolean(str(f, 'destination'))
              )
                throw Error(
                  'Pilih kedua dompet untuk transfer atau kosongkan keduanya.',
                )
              if (p.type === 'goal' && str(f, 'destination'))
                ledger = entry(workspace, {
                  kind: 'transfer',
                  source:
                    mode === 'subtract'
                      ? str(f, 'destination')
                      : str(f, 'source'),
                  destination:
                    mode === 'subtract'
                      ? str(f, 'source')
                      : str(f, 'destination'),
                  amount,
                  date,
                  note: p.name,
                })
              if (p.type !== 'goal' && str(f, 'source')) {
                const outgoing =
                  (p.type === 'debt' && mode !== 'principal') ||
                  (p.type === 'receivable' && mode === 'principal')
                ledger = entry(workspace, {
                  kind: 'financing',
                  source: outgoing ? str(f, 'source') : '',
                  destination: outgoing ? '' : str(f, 'source'),
                  amount,
                  date,
                  note:
                    p.name +
                    ' · ' +
                    (mode === 'principal' ? 'Pokok' : 'Cicilan'),
                })
              }
              if (
                mode === 'principal' &&
                (!ledger ||
                  current.changes.some((c) => c.amount === 0) ||
                  amount !== current.amount)
              )
                throw Error(
                  'Pokok dicatat sekali, sesuai nominal dan dengan dompet.',
                )
              if (ledger) {
                validateEntry(ledger, s.data)
                s.data.entries.push(ledger)
              }
              s.data.plans[index] = revise(current, {
                changes: [
                  ...current.changes,
                  {
                    id: crypto.randomUUID(),
                    date,
                    amount: delta,
                    note:
                      str(f, 'note') ||
                      (mode === 'principal'
                        ? 'Pokok dicatat'
                        : mode === 'subtract'
                          ? 'Tarik alokasi'
                          : 'Setoran / pembayaran'),
                    entry: ledger?.id,
                  },
                ],
              })
            })
            close()
            setNotice('Perubahan tersimpan.')
          }}
        >
          <Field label="Jenis">
            <select name="mode">
              {p.type === 'goal' ? (
                <>
                  <option value="add">Setoran</option>
                  <option value="subtract">Penarikan</option>
                </>
              ) : (
                <>
                  <option value="add">Cicilan / pembayaran</option>
                  <option value="principal">Catat pokok ke kas</option>
                </>
              )}
            </select>
          </Field>
          <Field label="Nominal (Rp)">
            <input name="amount" type="number" step="1" min="1" required />
          </Field>
          <Field label="Tanggal">
            <input name="date" type="date" required defaultValue={n} />
          </Field>
          <p className="muted">
            {p.type === 'goal'
              ? 'Untuk alokasi virtual, kosongkan pilihan dompet. Untuk transfer nyata, pilih dompet dana dan dompet simpanan.'
              : 'Pilih dompet untuk mencatat gerakan kas sebagai pembiayaan.'}
          </p>
          <Field
            label={
              p.type === 'goal' ? 'Dompet dana (opsional)' : 'Dompet (opsional)'
            }
          >
            <WalletSelect
              name="source"
              wallets={wallets.filter((w) => !w.archived)}
              required={false}
            />
          </Field>
          {p.type === 'goal' && (
            <Field label="Dompet simpanan (opsional)">
              <WalletSelect
                name="destination"
                wallets={wallets.filter((w) => !w.archived)}
                required={false}
              />
            </Field>
          )}
          <Field label="Catatan">
            <input name="note" maxLength={280} />
          </Field>
        </Form>
      )
    }
  }
  if (open?.type === 'day') {
    const day = open.day
    title = day
    body = (
      <>
        <Head title="Transaksi" />
        <Entries
          entries={live(d.entries).filter(
            (e) => e.workspace === workspace && e.date === day,
          )}
          data={d}
          hide={hide}
          select={select}
        />
        <Head title="Agenda" />
        {workspacePlans
          .filter((p) =>
            p.type === 'recurring'
              ? nextDue(p, day) === day
              : (p.due || p.date) === day,
          )
          .map((p) => (
            <ButtonRow
              key={p.id}
              Icon={planIcons[p.type]}
              label={p.name}
              action={() => showPlan(p)}
            />
          ))}
      </>
    )
  }
  if (open?.type === 'push') {
    title = 'Notifikasi perangkat'
    body = (
      <>
        <p className="muted">
          FINORA dapat mengirim satu pemberitahuan umum pada hari jatuh tempo.
          Pesan tidak memuat nama, nominal, atau saldo.
        </p>
        {demo || !pushKey ? (
          <p className="empty">
            Web Push tersedia setelah Apps Script dan konfigurasi VAPID siap.
          </p>
        ) : !supportedPush() ? (
          <p className="empty">
            Browser ini belum mendukung Web Push. Di iPhone, buka FINORA dari
            ikon Layar Utama pada iOS yang mendukung fitur tersebut.
          </p>
        ) : (
          <Form
            label={
              profile.pushEnabled ? 'Nonaktifkan Web Push' : 'Aktifkan Web Push'
            }
            save={async () => {
              if (profile.pushEnabled) {
                await disablePush()
                await patch({ pushEnabled: false })
                setNotice('Web Push dinonaktifkan.')
              } else {
                await enablePush(pushKey, JSON.parse(dueDates))
                await patch({ pushEnabled: true })
                setNotice('Web Push diaktifkan.')
              }
            }}
          />
        )}
      </>
    )
  }
  if (open?.type === 'notify') {
    title = 'Notifikasi'
    body = (
      <>
        {profile.notifications && alerts.length ? (
          alerts.map(({ p, text }) => (
            <ButtonRow
              key={p.id}
              Icon={Bell}
              label={p.name}
              note={text}
              action={() => showPlan(p)}
            />
          ))
        ) : (
          <p className="empty">
            {profile.notifications
              ? 'Belum ada pengingat aktif.'
              : 'Notifikasi dalam aplikasi dinonaktifkan.'}
          </p>
        )}
        {sync.status && <p className="muted">{sync.status}</p>}
      </>
    )
  }
  if (open?.type === 'profile') {
    title = 'Profil'
    body = (
      <Form
        save={async (f) => {
          const name = str(f, 'name')
          if (!name) throw Error('Isi nama.')
          await patch({ name })
          close()
          setNotice('Profil tersimpan.')
        }}
      >
        <Field label="Nama">
          <input
            name="name"
            defaultValue={profile.name}
            required
            maxLength={60}
          />
        </Field>
        <div className="data-line">
          <span>Mata uang</span>
          <strong>Rupiah (IDR)</strong>
        </div>
        <div className="data-line">
          <span>Bahasa</span>
          <strong>Indonesia</strong>
        </div>
      </Form>
    )
  }
  if (open?.type === 'pin') {
    title = 'Keamanan'
    body = (
      <>
        <PinForm
          profile={profile}
          save={async (p) => {
            await patch(p)
            setNotice('PIN tersimpan.')
          }}
        />
        <Field label="Kunci otomatis">
          <select
            value={profile.autoLock}
            onChange={(e) =>
              action(() => patch({ autoLock: Number(e.target.value) }))
            }
          >
            <option value={30}>30 detik</option>
            <option value={60}>1 menit</option>
            <option value={300}>5 menit</option>
          </select>
        </Field>
        {profile.pin && (
          <button
            className="outline"
            onClick={() => {
              setLocked(true)
              close()
            }}
          >
            <Lock size={17} /> Kunci sekarang
          </button>
        )}
        {!demo && (
          <>
            <button className="outline" onClick={() => action(register)}>
              <Fingerprint size={18} /> Daftarkan Passkey
            </button>
          </>
        )}
      </>
    )
  }
  if (open?.type === 'sheetExport') {
    const data = open.rows
    title = 'Ekspor ke Google Sheets'
    body = (
      <>
        <p className="muted">
          {demo
            ? 'Ekspor ke Google Sheets memerlukan koneksi Apps Script.'
            : `${data.length - 1} transaksi sesuai filter akan diekspor ke spreadsheet privat baru.`}
        </p>
        {demo ? (
          <button className="outline" onClick={() => modal({ type: 'sync' })}>
            Pengaturan Google Sheets
          </button>
        ) : exported ? (
          <a
            className="primary"
            href={
              'https://docs.google.com/spreadsheets/d/' +
              encodeURIComponent(exported) +
              '/edit'
            }
            target="_blank"
            rel="noreferrer"
          >
            Buka laporan di Sheets
          </a>
        ) : (
          <Form
            label="Ekspor ke spreadsheet privat"
            save={async () => {
              const r = await api<{ sheet: string }>('sheet/export', {
                rows: data,
              })
              setExported(r.sheet)
            }}
          />
        )}
      </>
    )
  }
  if (open?.type === 'sync') {
    title = 'Google Sheets & sinkronisasi'
    body = sheetControls()
  }
  if (open?.type === 'backup') {
    title = 'Backup & ekspor'
    body = (
      <>
        <p className="muted">
          Backup JSON memuat riwayat finansial akun ini. Simpan di lokasi
          privat.
        </p>
        <button
          className="primary"
          onClick={() =>
            download(
              'FINORA-backup.json',
              JSON.stringify({ version: 1, data: d }),
              'application/json',
            )
          }
        >
          <Download size={18} /> Unduh backup JSON
        </button>
        <div className="filters">
          {(['csv', 'xlsx', 'pdf'] as const).map((f) => (
            <button
              className="outline"
              key={f}
              onClick={() =>
                action(() =>
                  report(
                    f,
                    live(d.entries).filter((e) => e.workspace === workspace),
                    d,
                  ),
                )
              }
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <Form
          label="Pulihkan backup"
          save={async (f) => {
            const file = f.get('backup')
            if (!(file instanceof File) || !file.size || file.size > 32_000_000)
              throw Error('Pilih backup FINORA (maks. 32 MB).')
            const raw = JSON.parse(await file.text())
            const { validateData } = await import('../utils/validation')
            if (raw.version !== 1) throw Error('Versi backup tidak didukung.')
            const restored = validateData(raw.data)
            const message = profile.sheet
              ? 'Pulihkan backup ke perangkat ini? Perubahan akan masuk antrean Sheets dan perubahan lain dapat memerlukan tinjauan konflik.'
              : 'Ganti data lokal akun ini dengan isi backup?'
            if (!window.confirm(message)) return
            await change(account, (s) => {
              s.data = s.profile.sheet
                ? validateData(restoreVersioned(s.data, restored))
                : restored
            })
            close()
            setNotice('Backup dipulihkan.')
          }}
        >
          <Field label="Berkas backup FINORA">
            <input
              type="file"
              name="backup"
              accept=".json,application/json"
              required
            />
          </Field>
        </Form>
      </>
    )
  }
  if (open?.type === 'delete') {
    title = 'Hapus data lokal'
    body = (
      <Form
        label="Hapus data perangkat"
        save={async (f) => {
          if (str(f, 'confirm') !== 'HAPUS')
            throw Error('Ketik HAPUS untuk mengonfirmasi.')
          await change(account, (s) => {
            s.data = initial(false)
            s.baseline = undefined
            s.profile.autoSync = false
            s.profile.sheet = undefined
            s.profile.lastSync = undefined
          })
          close()
          setNotice('Data perangkat dihapus.')
        }}
      >
        <p className="muted">
          Data keuangan dalam profil ini akan dikosongkan dan tautan
          sinkronisasi perangkat diputus. Kelola salinan Google lewat akun Anda.
        </p>
        <Field label="Ketik HAPUS">
          <input name="confirm" required />
        </Field>
      </Form>
    )
  }
  if (open?.type === 'help') {
    title = 'Tentang FINORA'
    body = (
      <>
        <Brand />
        <p>
          Pengelola keuangan Personal dan Business. Rupiah dan zona waktu
          Asia/Jakarta.
        </p>
        <p className="muted">
          Di Safari iPhone, ketuk Bagikan → Tambahkan ke Layar Utama. Buka
          FINORA dari ikon setelah halaman pertama selesai dimuat.
        </p>
        <p className="muted">
          Sinkronisasi dan pengingat berulang berjalan saat FINORA dibuka. Saat
          offline, data tersimpan pada profil browser ini.
        </p>
      </>
    )
  }
  if (open?.type === 'logout') {
    title = 'Keluar dari FINORA?'
    body = (
      <>
        <p className="muted">
          Data lokal tersedia saat Anda masuk kembali pada profil browser ini.
        </p>
        <div className="filters">
          <button className="outline" onClick={close}>
            Batal
          </button>
          <button className="primary" onClick={() => action(logout)}>
            Keluar
          </button>
        </div>
      </>
    )
  }
  return (
    <Shell
      page={page}
      go={go}
      workspace={workspace}
      setWorkspace={(w) => {
        setWorkspace(w)
        close()
      }}
      demo={demo}
      online={online}
      sync={() => modal({ type: 'sync' })}
      bell={() => modal({ type: 'notify' })}
      count={profile.notifications ? alerts.length : 0}
      profile={profile.name}
    >
      {page !== 'home' && (
        <div className="page-title">
          <h1>{pages[page]}</h1>
          {!['transactions', 'stats', 'wallets', 'account'].includes(page) && (
            <button className="text-link" onClick={() => go('account')}>
              Kembali ke akun <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
      {page === 'home' && (
        <Dashboard
          d={d}
          workspace={workspace}
          hide={hide}
          name={profile.name}
          toggle={() => action(() => patch({ privacy: !hide }))}
          quick={quick}
          go={go}
          select={select}
          plan={showPlan}
          addPlan={addPlan}
        />
      )}
      {page === 'transactions' && (
        <History
          key={workspace}
          d={d}
          workspace={workspace}
          hide={hide}
          add={() => quick('add')}
          select={select}
        />
      )}
      {page === 'stats' && (
        <Stats
          key={workspace}
          d={d}
          workspace={workspace}
          hide={hide}
          sheets={(rows) => modal({ type: 'sheetExport', rows })}
        />
      )}
      {page === 'wallets' && (
        <Wallets
          key={workspace}
          d={d}
          workspace={workspace}
          hide={hide}
          add={() => modal({ type: 'walletForm' })}
          select={(w) => modal({ type: 'wallet', id: w.id })}
        />
      )}
      {page === 'categories' && (
        <Categories
          key={workspace}
          items={live(d.categories).filter((c) => c.workspace === workspace)}
          add={() => modal({ type: 'category' })}
          select={(c) => modal({ type: 'category', c })}
        />
      )}
      {page === 'plans' && (
        <div className="two">
          {(Object.keys(planLabels) as PlanKind[]).map((t) => (
            <PlanList
              key={t}
              type={t}
              plans={workspacePlans.filter((p) => p.type === t)}
              data={d}
              hide={hide}
              add={() => addPlan(t)}
              select={showPlan}
            />
          ))}
        </div>
      )}
      {page === 'calendar' && (
        <Calendar
          data={d}
          workspace={workspace}
          selectDay={(day) => modal({ type: 'day', day })}
        />
      )}
      {page === 'receipts' && (
        <Panel>
          <Head title="Struk tersimpan">
            <button className="primary" onClick={() => quick('scan')}>
              <Plus size={18} /> Scan
            </button>
          </Head>
          {receipts.length ? (
            receipts.map((r) => (
              <ButtonRow
                key={r.id}
                Icon={FileImage}
                label={r.merchant || 'Struk'}
                note={r.date}
                action={() => modal({ type: 'receipt', id: r.id })}
              />
            ))
          ) : (
            <p className="empty">Belum ada struk di workspace ini.</p>
          )}
        </Panel>
      )}
      {page === 'account' && (
        <div className="two">
          <Panel>
            <Head title="Pengelolaan" />
            <ButtonRow
              Icon={Tag}
              label="Kategori"
              action={() => go('categories')}
            />
            <ButtonRow
              Icon={WalletIcon}
              label="Anggaran, tabungan & kewajiban"
              note="Anggaran, utang, piutang, dan transaksi berulang"
              action={() => go('plans')}
            />
            <ButtonRow
              Icon={CalendarDays}
              label="Kalender & pengingat"
              action={() => go('calendar')}
            />
            <ButtonRow
              Icon={FileImage}
              label="Arsip struk"
              action={() => go('receipts')}
            />
            <ButtonRow
              Icon={ArrowLeftRight}
              label="Laporan & insights"
              action={() => go('stats')}
            />
          </Panel>
          <Panel>
            <Head title="Preferensi" />
            <ButtonRow
              Icon={Settings}
              label={profile.name}
              note={demo ? 'Profil demo' : 'Profil Apps Script'}
              action={() => modal({ type: 'profile' })}
            />
            <ButtonRow
              Icon={Cloud}
              label="Google Sheets & sinkronisasi"
              note={
                demo
                  ? 'Mode demo'
                  : profile.sheet
                    ? 'Terhubung'
                    : 'Belum terhubung'
              }
              action={() => modal({ type: 'sync' })}
            />
            <ButtonRow
              Icon={Shield}
              label="Keamanan, PIN & Passkey"
              action={() => modal({ type: 'pin' })}
            />
            <ButtonRow
              Icon={Download}
              label="Backup, pemulihan & ekspor"
              action={() => modal({ type: 'backup' })}
            />
            <ButtonRow
              Icon={Sun}
              label={
                profile.theme === 'dark'
                  ? 'Aktifkan mode terang'
                  : 'Aktifkan mode gelap'
              }
              action={() =>
                action(() =>
                  patch({ theme: profile.theme === 'dark' ? 'light' : 'dark' }),
                )
              }
            />
            <ButtonRow
              Icon={Eye}
              label={hide ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
              action={() => action(() => patch({ privacy: !hide }))}
            />
            <ButtonRow
              Icon={Bell}
              label={
                profile.notifications
                  ? 'Nonaktifkan notifikasi'
                  : 'Aktifkan notifikasi'
              }
              action={() =>
                action(() => patch({ notifications: !profile.notifications }))
              }
            />
            <ButtonRow
              Icon={Bell}
              label="Notifikasi perangkat"
              action={() => modal({ type: 'push' })}
            />
            <ButtonRow
              Icon={Settings}
              label="Bantuan & tentang FINORA"
              action={() => modal({ type: 'help' })}
            />
            <ButtonRow
              Icon={Trash2}
              label="Hapus data lokal"
              action={() => modal({ type: 'delete' })}
            />
            <ButtonRow
              Icon={LogOut}
              label="Keluar"
              action={() => modal({ type: 'logout' })}
            />
          </Panel>
        </div>
      )}
      {open && title && (
        <Modal key={open.type} title={title} close={close}>
          {body}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </Modal>
      )}
      {!open && error && (
        <p className="toast error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="toast" role="status">
          {notice}
        </p>
      )}
    </Shell>
  )
}
