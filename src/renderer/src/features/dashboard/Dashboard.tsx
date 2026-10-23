import { useState } from 'react'
import {
  ArrowRight,
  FileText,
  Package,
  PackagePlus,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { Button, Skeleton } from '../../components/ui'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useMoney } from '../../hooks/useMoney'
import { useNav } from '../../stores/nav'
import { useUi } from '../../stores/ui'
import { cn } from '../../lib/cn'
import { relativeTime } from '../../../../shared/util'

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899']

function compact(cents: number): string {
  const v = cents / 100
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return `${Math.round(v)}`
}

function ChartTooltip({
  active,
  payload,
  label,
  fmt
}: {
  active?: boolean
  payload?: { name?: string; value?: number; payload?: Record<string, unknown> }[]
  label?: string | number
  fmt: (c: number) => string
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const value = typeof item?.value === 'number' ? item.value : 0
  const payloadName = item?.payload?.name
  const name = payloadName != null ? String(payloadName) : label != null ? String(label) : null
  return (
    <div className="rounded-xl border border-app-border bg-app-surface px-3 py-2 text-xs shadow-pop">
      {name != null && <p className="mb-0.5 text-app-muted">{name}</p>}
      <p className="font-semibold text-brand">{fmt(value)}</p>
    </div>
  )
}

export function Dashboard() {
  const fmt = useMoney()
  const setTab = useNav((s) => s.setTab)
  const requestAddProduct = useUi((s) => s.requestAddProduct)
  const requestLowStock = useUi((s) => s.requestLowStock)
  const requestReport = useUi((s) => s.requestReport)
  const [range, setRange] = useState<7 | 30>(7)

  const stats = useAsyncData(() => window.api.dashboard.stats(), [])

  const revenue = stats.data?.revenue_series.slice(-range) ?? []
  const topProducts = stats.data?.top_products ?? []
  const categorySales = stats.data?.category_sales ?? []

  const cards = stats.data
    ? [
        {
          label: 'Total Revenue',
          value: fmt(stats.data.total_revenue_cents),
          sub: `Today ${fmt(stats.data.today_revenue_cents)}`,
          icon: Wallet,
          tone: 'text-brand bg-brand/10'
        },
        {
          label: 'Total Sales',
          value: String(stats.data.sales_count),
          sub: `Today ${stats.data.today_sales_count}`,
          icon: TrendingUp,
          tone: 'text-ok bg-ok/10'
        },
        {
          label: 'Products',
          value: String(stats.data.product_count),
          sub: 'In catalog',
          icon: Package,
          tone: 'text-warn bg-warn/10'
        },
        {
          label: 'Low Stock',
          value: String(stats.data.low_stock_count),
          sub: 'Needs restock',
          icon: PackagePlus,
          tone: 'text-danger bg-danger/10'
        },
        {
          label: 'Customers',
          value: String(stats.data.customer_count),
          sub: 'Active',
          icon: Users,
          tone: 'text-sky-500 bg-sky-500/10'
        }
      ]
    : []

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-7xl space-y-5 p-6">
        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="mr-auto text-lg font-bold text-app-text">Overview</h2>
          <Button
            variant="secondary"
            onClick={() => {
              setTab('products')
              requestAddProduct()
            }}
          >
            <PackagePlus style={{ width: 16, height: 16 }} />
            Add product
          </Button>
          <Button variant="secondary" onClick={() => setTab('sale')}>
            <ShoppingCart style={{ width: 16, height: 16 }} />
            New sale
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setTab('history')
              requestReport()
            }}
          >
            <FileText style={{ width: 16, height: 16 }} />
            Report
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              requestLowStock()
              setTab('products')
            }}
          >
            <Package style={{ width: 16, height: 16 }} />
            Low stock
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {stats.loading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)
            : cards.map((c) => {
                const Icon = c.icon
                return (
                  <div
                    key={c.label}
                    className="rounded-2xl border border-app-border bg-app-surface p-4 transition-shadow hover:shadow-soft"
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', c.tone)}>
                        <Icon style={{ width: 18, height: 18 }} />
                      </span>
                    </div>
                    <p className="mt-3 truncate text-xl font-bold text-app-text">{c.value}</p>
                    <p className="text-xs font-medium text-app-muted">{c.label}</p>
                    <p className="mt-0.5 text-[11px] text-app-faint">{c.sub}</p>
                  </div>
                )
              })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-app-border bg-app-surface p-5 xl:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-app-text">Revenue</h3>
                <p className="text-xs text-app-faint">Daily sales over time</p>
              </div>
              <div className="flex rounded-lg border border-app-border p-0.5">
                {([7, 30] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                      range === r ? 'bg-brand text-brand-fg' : 'text-app-muted hover:text-app-text'
                    )}
                  >
                    {r}d
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="rgb(var(--brand))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(v: number) => compact(v)} />
                  <Tooltip content={<ChartTooltip fmt={fmt} />} />
                  <Area
                    type="monotone"
                    dataKey="cents"
                    stroke="rgb(var(--brand))"
                    strokeWidth={2}
                    fill="url(#rev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-app-border bg-app-surface p-5">
            <h3 className="font-semibold text-app-text">Sales by category</h3>
            <p className="text-xs text-app-faint">Revenue share</p>
            {categorySales.length ? (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categorySales}
                        dataKey="cents"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {categorySales.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip fmt={fmt} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5">
                  {categorySales.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="flex-1 truncate text-app-muted">{c.name}</span>
                      <span className="font-medium text-app-text">{fmt(c.cents)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-10 text-center text-sm text-app-faint">No sales yet</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-app-border bg-app-surface p-5 xl:col-span-2">
            <h3 className="font-semibold text-app-text">Top-selling products</h3>
            <p className="text-xs text-app-faint">By quantity sold</p>
            {topProducts.length ? (
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                    />
                    <Tooltip content={<ChartTooltip fmt={(c) => String(c)} />} />
                    <Bar dataKey="qty" fill="rgb(var(--brand))" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-10 text-center text-sm text-app-faint">No sales yet</p>
            )}
          </div>

          {/* Activity feed */}
          <div className="rounded-2xl border border-app-border bg-app-surface p-5">
            <h3 className="font-semibold text-app-text">Recent activity</h3>
            <p className="text-xs text-app-faint">Latest actions</p>
            <div className="mt-3 space-y-1">
              {stats.data?.activity.length ? (
                stats.data.activity.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-app-surface2/50">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-app-text">{a.details ?? a.action}</p>
                      <p className="text-[11px] text-app-faint">{relativeTime(a.created_at)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-app-faint">No activity yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pb-2 text-app-faint">
          <ArrowRight style={{ width: 14, height: 14 }} />
          <span className="text-xs">Tip: press F1 to jump to New Sale</span>
        </div>
      </div>
    </div>
  )
}
