import type { Data, Entry } from '../types'
import { names, totals } from '../utils/ledger'
export function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const escapeCell = (s: string) =>
  /^[\s]*[=+\-@\t\r\n]/.test(s) ? "'" + s : s
export function rows(entries: Entry[], d: Data) {
  const w = (id: string) => d.wallets.find((w) => w.id === id)?.name || ''
  return [
    [
      'Tanggal',
      'Waktu',
      'Jenis',
      'Nominal (Rp)',
      'Dompet asal',
      'Dompet tujuan',
      'Kategori',
      'Merchant',
      'Catatan',
      'Workspace',
      'ID',
    ],
    ...entries.map((e) => [
      e.date,
      e.time,
      names[e.kind],
      e.amount,
      w(e.source),
      w(e.destination),
      d.categories.find((c) => c.id === e.category)?.name || '',
      e.merchant,
      e.note,
      e.workspace,
      e.id,
    ]),
  ]
}
export async function report(
  format: 'csv' | 'xlsx' | 'pdf',
  entries: Entry[],
  d: Data,
) {
  const values = rows(entries, d)
  if (format === 'csv') {
    download(
      'FINORA-transaksi.csv',
      '\ufeff' +
        values
          .map((r) =>
            r
              .map(
                (x) =>
                  '"' +
                  String(typeof x === 'string' ? escapeCell(x) : x).replaceAll(
                    '"',
                    '""',
                  ) +
                  '"',
              )
              .join(','),
          )
          .join('\r\n'),
      'text/csv;charset=utf-8',
    )
  } else if (format === 'xlsx') {
    const { workbook } = await import('./xlsx')
    const t = totals(entries)
    const file = workbook([
      ['Transactions', values],
      [
        'Ringkasan',
        [
          ['Pemasukan', t.income],
          ['Pengeluaran', t.expense],
          ['Arus kas', t.net],
        ],
      ],
    ])
    download(
      'FINORA-transaksi.xlsx',
      file,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
  } else {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    doc.setFontSize(19)
    doc.text('FINORA | Laporan transaksi', 14, 19)
    const t = totals(entries)
    doc.setFontSize(11)
    doc.text(
      `Pemasukan Rp ${t.income}   Pengeluaran Rp ${t.expense}   Arus kas Rp ${t.net}`,
      14,
      28,
    )
    let y = 40
    for (const e of entries) {
      const lines: string[] = doc.splitTextToSize(
        `${e.date}   ${names[e.kind]}   Rp ${e.amount}   ${e.merchant || e.note || ''}`,
        180,
      )
      if (y + lines.length * 5 > 282) {
        doc.addPage()
        y = 18
      }
      doc.text(lines, 14, y)
      y += lines.length * 5 + 3
    }
    doc.save('FINORA-laporan.pdf')
  }
}
