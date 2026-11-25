import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import { change, db, type State } from '../database'
import { merge, sameData, type Conflict } from '../sync/merge'
import type { Data } from '../types'
export function useSync(
  state: State | undefined,
  online: boolean,
  active: boolean,
) {
  const id = state?.id,
    sheet = state?.profile.sheet,
    auto = state?.profile.autoSync
  const [status, setStatus] = useState(''),
    [conflicts, setConflicts] = useState<Conflict[]>([]),
    [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const retry = useRef(0)
  const sync = useCallback(
    async (choices: Record<string, 'local' | 'remote'> = {}) => {
      if (
        !id ||
        !sheet ||
        id === 'demo' ||
        !navigator.onLine ||
        inFlight.current
      )
        return
      inFlight.current = true
      setBusy(true)
      setStatus('Menyinkronkan…')
      try {
        const current = await db.accounts.get(id)
        if (!current) throw Error('Akun tidak tersedia.')
        const remote = await api<{ data: Data; revision: string }>(
          'sheet/read',
          { sheet },
        )
        const result = merge(
          current.data,
          remote.data,
          current.baseline,
          choices,
        )
        setConflicts(result.conflicts)
        if (result.conflicts.length) {
          setStatus('Tinjau konflik untuk melanjutkan.')
          return
        }
        const clean = {
          ...result.data,
          receipts: result.data.receipts.map(({ image: _, ...r }) => r),
        }
        if (!sameData(clean, remote.data))
          await api('sheet/write', {
            sheet,
            revision: remote.revision,
            data: clean,
          })
        await change(id, (s) => {
          const latest = merge(s.data, result.data, current.data)
          if (!latest.conflicts.length) {
            s.data = latest.data
            s.baseline = clean
          } else {
            s.baseline = clean
            setConflicts(latest.conflicts)
          }
          s.profile.lastSync = new Date().toISOString()
        })
        retry.current = 0
        setStatus('Sinkronisasi selesai.')
      } catch (e) {
        retry.current = Math.min(retry.current + 1, 6)
        setStatus((e as Error).message)
      } finally {
        inFlight.current = false
        setBusy(false)
      }
    },
    [id, sheet],
  )
  const dirty = state && !sameData(state.data, state.baseline)
  useEffect(() => {
    if (
      !online ||
      !active ||
      !auto ||
      !sheet ||
      !id ||
      id === 'demo' ||
      conflicts.length
    )
      return
    const run = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    const timer = window.setInterval(run, 60_000)
    const initial = setTimeout(run, 1500)
    document.addEventListener('visibilitychange', run)
    return () => {
      clearInterval(timer)
      clearTimeout(initial)
      document.removeEventListener('visibilitychange', run)
    }
  }, [online, active, auto, sheet, id, sync, conflicts.length])
  useEffect(() => {
    if (
      !dirty ||
      !online ||
      !active ||
      !auto ||
      !sheet ||
      busy ||
      conflicts.length
    )
      return
    const task = setTimeout(
      () => void sync(),
      Math.min(60_000, 1500 * 2 ** retry.current),
    )
    return () => clearTimeout(task)
  }, [dirty, online, active, auto, sheet, busy, conflicts.length, sync])
  return { sync, status, conflicts, busy }
}
