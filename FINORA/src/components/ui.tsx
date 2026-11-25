import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  CircleDollarSign,
} from 'lucide-react'
import { names, rupiah } from '../utils/ledger'
import type { Data, Entry } from '../types'
export function Panel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={'panel ' + className}>{children}</section>
}
export function Head({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {children}
    </div>
  )
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string
  close: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    d?.showModal()
    return () => d?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === ref.current) close()
      }}
    >
      <div className="sheet">
        <Head title={title}>
          <button className="icon" aria-label="Tutup" onClick={close}>
            <X size={20} />
          </button>
        </Head>
        {children}
      </div>
    </dialog>
  )
}
export function Form({
  children,
  save,
  label = 'Simpan',
}: {
  children?: ReactNode
  save: (f: FormData) => unknown | Promise<unknown>
  label?: string
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    const data = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    try {
      await save(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="form">
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button disabled={busy} className="primary" type="submit">
        {busy ? 'Memproses…' : label}
      </button>
    </form>
  )
}
export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const id = useId()
  const control = isValidElement<{ ['aria-labelledby']?: string }>(children)
    ? cloneElement(children, { 'aria-labelledby': id })
    : children
  return (
    <label className="field">
      <span id={id}>{label}</span>
      {control}
    </label>
  )
}
export const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
export const num = (f: FormData, k: string) => Number(str(f, k))
export function Price({
  value,
  hide = false,
}: {
  value: number
  hide?: boolean
}) {
  return <>{hide ? 'Rp ••••••' : rupiah(value)}</>
}
export function Entries({
  entries,
  data,
  hide,
  select,
  emptyText = 'Belum ada transaksi.',
}: {
  entries: Entry[]
  data: Data
  hide: boolean
  select: (e: Entry) => void
  emptyText?: string
}) {
  if (!entries.length) return <p className="empty">{emptyText}</p>
  return (
    <div className="entries">
      {entries.map((e) => {
        const kind = e.kind === 'refund' ? 'income' : e.kind
        const Icon =
          kind === 'income'
            ? ArrowDownLeft
            : kind === 'expense'
              ? ArrowUpRight
              : kind === 'transfer'
                ? ArrowLeftRight
                : CircleDollarSign
        const category = data.categories.find((c) => c.id === e.category)?.name
        const wallet = (id: string) =>
          data.wallets.find((w) => w.id === id)?.name
        return (
          <button key={e.id} className="entry-row" onClick={() => select(e)}>
            <span className={'entry-icon ' + kind}>
              <Icon size={18} />
            </span>
            <span className="entry-copy">
              <strong>
                {e.merchant || e.note || category || names[e.kind]}
              </strong>
              <small>
                {category || names[e.kind]} ·{' '}
                {wallet(e.source) || wallet(e.destination)}
                {e.source && e.destination ? ' → ' + wallet(e.destination) : ''}
              </small>
            </span>
            <span className="entry-amount">
              <strong className={kind}>
                {!hide && e.kind === 'expense'
                  ? '−'
                  : !hide && kind === 'income'
                    ? '+'
                    : ''}
                <Price value={e.amount} hide={hide} />
              </strong>
              <small>
                {new Date(e.date + 'T00:00:00Z').toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                })}
              </small>
            </span>
          </button>
        )
      })}
    </div>
  )
}
