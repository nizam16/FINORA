import type { Base, Collection, Data } from '../types'
import { empty, revise } from '../utils/ledger'
export const keys = [
  'wallets',
  'categories',
  'entries',
  'plans',
  'receipts',
] as const
export interface Conflict {
  key: Collection
  id: string
  local?: Base
  remote?: Base
}
const ordered = (k: string, v: unknown) => {
  if (k === 'image') return undefined
  if (v && typeof v === 'object' && !Array.isArray(v))
    return Object.fromEntries(
      Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
    )
  return v
}
const equal = (a?: Base, b?: Base) =>
  JSON.stringify(a, ordered) === JSON.stringify(b, ordered)
export const sameData = (a: Data, b?: Data) =>
  Boolean(b) &&
  keys.every((key) => {
    const remote = new Map<string, Base>(b![key].map((x) => [x.id, x]))
    return (
      a[key].length === remote.size &&
      a[key].every((x) => equal(x, remote.get(x.id)))
    )
  })
export function merge(
  local: Data,
  remote: Data,
  baseline: Data = empty(),
  choices: Record<string, 'local' | 'remote'> = {},
) {
  const data = empty(),
    conflicts: Conflict[] = []
  for (const key of keys) {
    const maps = [local, remote, baseline].map(
      (d) => new Map<string, Base>(d[key].map((x) => [x.id, x])),
    )
    const ids = new Set(maps.flatMap((m) => [...m.keys()]))
    for (const id of ids) {
      const [l, r, b] = maps.map((m) => m.get(id))
      const decision = choices[key + ':' + id]
      let value: Base | undefined
      if (equal(l, r)) value = l
      else if (equal(l, b)) value = r
      else if (equal(r, b)) value = l
      else if (decision) {
        const chosen = decision === 'local' ? l : r
        const other = decision === 'local' ? r : l
        value = chosen
          ? revise(
              {
                ...chosen,
                version: Math.max(chosen.version, other?.version ?? 0),
              },
              {},
            )
          : other
            ? revise(other, { deleted: new Date().toISOString() })
            : undefined
      } else {
        conflicts.push({ key, id, local: l, remote: r })
        value = l
      }
      if (value)
        (data[key] as Base[]).push(
          key === 'receipts' && l && 'image' in l
            ? ({ ...value, image: l.image } as Base)
            : value,
        )
    }
  }
  return { data, conflicts }
}
export function restoreVersioned(current: Data, backup: Data): Data {
  const restored = empty()
  const deleted = new Date().toISOString()
  for (const key of keys) {
    const prior = new Map<string, Base>(
      current[key].map((item) => [item.id, item]),
    )
    const items = restored[key] as Base[]
    for (const saved of backup[key]) {
      const before = prior.get(saved.id)
      prior.delete(saved.id)
      items.push(
        !before || equal(saved, before)
          ? saved
          : revise(
              { ...saved, version: Math.max(saved.version, before.version) },
              {},
            ),
      )
    }
    for (const item of prior.values())
      items.push(item.deleted ? item : revise(item, { deleted }))
  }
  return restored
}
