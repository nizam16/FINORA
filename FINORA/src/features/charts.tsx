import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { balance, rupiah, totals } from '../utils/ledger'
import type { Data, Entry } from '../types'
export const tones = [
  '#D4AF37',
  '#86a890',
  '#8a91af',
  '#cc835f',
  '#b6909e',
  '#799cb2',
]
const compact = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
const axis = { fill: '#949396', fontSize: 11 }
const tooltip = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  color: 'var(--text)',
}
type Point = {
  label: string
  Pemasukan: number
  Pengeluaran: number
  'Arus kas': number
  Saldo?: number
}
export function series(entries: Entry[], start: string, end: string, d?: Data) {
  if (!start || !end || end < start) return []
  const count =
    Math.floor((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1
  const size = Math.max(1, Math.ceil(count / 8))
  const points: Point[] = []
  for (let offset = 0; offset < count; offset += size) {
    const from = new Date(Date.parse(start) + offset * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const to = new Date(
      Date.parse(start) + Math.min(count - 1, offset + size - 1) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10)
    const t = totals(entries.filter((e) => e.date >= from && e.date <= to))
    points.push({
      label: from.slice(8) + '/' + from.slice(5, 7),
      Pemasukan: t.income,
      Pengeluaran: t.expense,
      'Arus kas': t.net,
      Saldo: d?.wallets.reduce(
        (s, w) =>
          s +
          balance(
            w,
            d.entries.filter((e) => e.date <= to),
          ),
        0,
      ),
    })
  }
  return points
}
const format = (n: unknown) => rupiah(Number(n))
export function Flow({
  points,
  hide = false,
  mode = 'area',
}: {
  points: Point[]
  hide?: boolean
  mode?: 'area' | 'bar' | 'line'
}) {
  if (hide)
    return <p className="empty">Grafik disembunyikan oleh mode privasi.</p>
  const x = (
    <XAxis
      dataKey="label"
      tick={axis}
      tickLine={false}
      axisLine={false}
      minTickGap={18}
    />
  )
  const y = (
    <YAxis
      width={44}
      tickFormatter={compact}
      tick={axis}
      tickLine={false}
      axisLine={false}
    />
  )
  const grid = (
    <CartesianGrid
      stroke="var(--line)"
      vertical={false}
      strokeDasharray="3 5"
    />
  )
  const tip = <Tooltip formatter={format} contentStyle={tooltip} />
  return (
    <div className="chart" aria-label="Grafik keuangan">
      <ResponsiveContainer width="100%" height={210}>
        {mode === 'bar' ? (
          <BarChart data={points}>
            {grid}
            {x}
            {y}
            {tip}
            <Bar
              isAnimationActive={false}
              dataKey="Pemasukan"
              fill="#6ca985"
              radius={[5, 5, 0, 0]}
            />
            <Bar
              isAnimationActive={false}
              dataKey="Pengeluaran"
              fill="#be7b76"
              radius={[5, 5, 0, 0]}
            />
          </BarChart>
        ) : mode === 'line' ? (
          <LineChart data={points}>
            {grid}
            {x}
            {y}
            {tip}
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="Saldo"
              stroke="#D4AF37"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        ) : (
          <AreaChart data={points}>
            <defs>
              <linearGradient id="gold-chart" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#D4AF37" stopOpacity=".25" />
                <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
              </linearGradient>
            </defs>
            {grid}
            {x}
            {y}
            {tip}
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="Arus kas"
              stroke="#D4AF37"
              strokeWidth={2}
              fill="url(#gold-chart)"
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
export function Donut({
  items,
  hide,
}: {
  items: { name: string; value: number }[]
  hide: boolean
}) {
  if (hide || !items.some((x) => x.value > 0))
    return (
      <p className="empty">
        {hide ? 'Nominal disembunyikan.' : 'Belum ada data periode ini.'}
      </p>
    )
  return (
    <div className="donut">
      <ResponsiveContainer width="100%" height={185}>
        <PieChart>
          <Tooltip formatter={format} contentStyle={tooltip} />
          <Pie
            isAnimationActive={false}
            data={items.filter((x) => x.value > 0)}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={77}
            paddingAngle={3}
            stroke="none"
          >
            {items.map((v, i) => (
              <Cell key={v.name} fill={tones[i % tones.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <ul>
        {items.slice(0, 7).map((x, i) => (
          <li key={x.name}>
            <i style={{ background: tones[i % tones.length] }} />
            {x.name}
            <strong>{rupiah(x.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
