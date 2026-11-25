import { describe, expect, it } from 'vitest'
import { initial } from '../database'
import {
  balance,
  base,
  duplicateReceipt,
  entry,
  live,
  occurrence,
  planProgress,
  recurringEntries,
  revise,
  totals,
  validateEntry,
} from '../utils/ledger'
import { validateData } from '../utils/validation'
import { merge } from '../sync/merge'
import { escapeCell } from '../features/export'
import { parseReceipt } from '../ocr/receipt'
const workspace = 'Personal'
describe('ledger FINORA', () => {
  it('matches the opening demo and isolates Business', () => {
    const d = initial(true)
    expect(
      d.wallets
        .filter((w) => w.type === 'Cash')
        .map((w) => balance(w, d.entries)),
    ).toEqual([2_500_000])
    expect(
      d.wallets
        .filter((w) => w.type === 'Online')
        .reduce((s, w) => s + balance(w, d.entries), 0),
    ).toBe(10_000_000)
    expect(totals(d.entries)).toEqual({
      income: 8_000_000,
      expense: 2_500_000,
      net: 5_500_000,
    })
    expect(d.entries.filter((e) => e.workspace === 'Business')).toEqual([])
    expect(initial(false).entries).toEqual([])
    expect(validateData(d).entries).toHaveLength(d.entries.length)
  })
  it('keeps transfer internal and tracks fees, edits and tombstones', () => {
    const d = initial(true),
      cash = d.wallets[0],
      bca = d.wallets[1]
    const t = entry(workspace, {
      kind: 'transfer',
      amount: 500_000,
      source: bca.id,
      destination: cash.id,
    })
    validateEntry(t, d)
    d.entries.push(t)
    expect(balance(cash, d.entries)).toBe(3_000_000)
    expect(d.wallets.reduce((s, w) => s + balance(w, d.entries), 0)).toBe(
      12_500_000,
    )
    const fee = entry(workspace, {
      kind: 'expense',
      amount: 2_500,
      source: bca.id,
      feeFor: t.id,
    })
    d.entries.push(fee)
    expect(totals(d.entries).expense).toBe(2_502_500)
    d.entries[d.entries.length - 1] = revise(fee, { amount: 5_000 })
    expect(totals(d.entries).expense).toBe(2_505_000)
    d.entries[d.entries.length - 1] = revise(fee, {
      deleted: new Date().toISOString(),
    })
    expect(totals(d.entries).expense).toBe(2_500_000)
    expect(() => validateEntry({ ...t, amount: 2.5 }, d)).toThrow()
    expect(() => validateEntry({ ...t, workspace: 'Business' }, d)).toThrow()
  })
  it('treats refund as a reversal and checks the original expense', () => {
    const d = initial(true),
      original = d.entries.find((e) => e.kind === 'expense')!
    const refund = entry(workspace, {
      kind: 'refund',
      amount: 10_000,
      destination: 'demo-bca',
      related: original.id,
      category: original.category,
    })
    validateEntry(refund, d)
    d.entries.push(refund)
    expect(totals(d.entries)).toEqual({
      income: 8_000_000,
      expense: 2_490_000,
      net: 5_510_000,
    })
    expect(() =>
      validateEntry({ ...refund, amount: original.amount + 1 }, d),
    ).toThrow()
    expect(() => validateEntry({ ...original, amount: 1000 }, d)).toThrow()
  })
  it('has virtual goals, budget calculations, and distinct financing', () => {
    const d = initial(true)
    expect(planProgress(d.plans[0], d)).toBe(680_000)
    expect(planProgress(d.plans[1], d)).toBe(3_500_000)
    d.entries.push(
      entry(workspace, {
        kind: 'financing',
        amount: 100_000,
        destination: 'demo-cash',
      }),
    )
    expect(balance(d.wallets[0], d.entries)).toBe(2_600_000)
    expect(totals(d.entries).income).toBe(8_000_000)
  })
  it('handles month-end and tombstoned recurrences idempotently', () => {
    const d = initial(true),
      p = {
        ...d.plans[0],
        ...base(workspace),
        type: 'recurring' as const,
        date: '2024-01-31',
        auto: true,
        template: {
          kind: 'expense' as const,
          amount: 123,
          source: 'demo-cash',
        },
      }
    expect(occurrence(p.date, 'monthly', 1, 1)).toBe('2024-02-29')
    expect(occurrence(p.date, 'monthly', 1, 2)).toBe('2024-03-31')
    const entries = recurringEntries(p, d, '2024-03-31')
    expect(entries).toHaveLength(3)
    d.entries.push(...entries.map((e) => revise(e, { deleted: e.created })))
    expect(recurringEntries(p, d, '2024-03-31')).toEqual([])
    expect(live(d.entries)).toHaveLength(7)
  })
})
describe('receipt, sync and export', () => {
  it('extracts IDR total, date and duplicate signals from OCR text', () => {
    const r = parseReceipt(
      'TOKO DEMO\nStruk: A-123\n19/11/2026 15:15\nSUBTOTAL Rp 52.000\nPPN 3.000\nTotal Rp 55.000\nTunai',
      workspace,
      'hash1',
      90,
    )
    expect(r).toMatchObject({
      merchant: 'TOKO DEMO',
      number: 'A-123',
      date: '2026-11-19',
      amount: 55000,
      subtotal: 52000,
      tax: 3000,
      method: 'Tunai',
    })
    expect(
      duplicateReceipt({ ...r, id: 'new', hash: 'different' }, [r])?.id,
    ).toBe(r.id)
    expect(
      duplicateReceipt({ ...r, id: 'new', workspace: 'Business' }, [r]),
    ).toBeUndefined()
  })
  it('merges independent edits and exposes divergent versions', () => {
    const baseline = initial(true),
      a = structuredClone(baseline),
      b = structuredClone(baseline)
    a.entries[0] = revise(a.entries[0], { merchant: 'lokal' })
    b.entries[1] = revise(b.entries[1], { merchant: 'remote' })
    expect(merge(a, b, baseline).conflicts).toHaveLength(0)
    b.entries[0] = revise(b.entries[0], { deleted: new Date().toISOString() })
    expect(merge(a, b, baseline).conflicts).toHaveLength(1)
    const after = merge(a, b, baseline, {
      ['entries:' + a.entries[0].id]: 'remote',
    })
    expect(after.data.entries[0].deleted).toBeDefined()
    expect(after.conflicts).toHaveLength(0)
    expect(merge(after.data, after.data, after.data).conflicts).toHaveLength(0)
  })
  it('quotes spreadsheet formulas in CSV cells', () => {
    expect(escapeCell(' =1+1')).toBe("' =1+1")
    expect(escapeCell('+62')).toBe("'+62")
    expect(escapeCell('FINORA')).toBe('FINORA')
  })
})

it('emits XLSX inline strings for text and numeric cells for Rupiah', async () => {
  const { workbook } = await import('../features/xlsx')
  const { strFromU8, unzipSync } = await import('fflate')
  const archive = unzipSync(
    new Uint8Array(
      workbook([['Transactions', [['=1+1', 'Toko & Kafe', 123]]]]),
    ),
  )
  const cells = strFromU8(archive['xl/worksheets/sheet1.xml'])
  expect(cells).toContain('t="inlineStr"><is><t xml:space="preserve">=1+1')
  expect(cells).toContain('Toko &amp; Kafe')
  expect(cells).toContain('t="n"><v>123')
  expect(cells).not.toContain('<f>')
})

it('restores based on current versions and emits deletion tombstones for sync', async () => {
  const { restoreVersioned } = await import('../sync/merge')
  const backup = initial(true),
    current = structuredClone(backup)
  current.entries[0] = revise(current.entries[0], { merchant: 'hasil edit' })
  current.entries.push(
    entry(workspace, { kind: 'expense', amount: 3100, source: 'demo-cash' }),
  )
  const restored = restoreVersioned(current, backup)
  expect(restored.entries[0].version).toBe(3)
  expect(restored.entries[0].merchant).toBe(backup.entries[0].merchant)
  expect(restored.entries.at(-1)?.deleted).toBeDefined()
  expect(totals(restored.entries)).toEqual(totals(backup.entries))
  expect(validateData(restored).entries).toHaveLength(current.entries.length)
})
