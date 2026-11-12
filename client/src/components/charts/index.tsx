import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RevenuePoint } from '../../types';
import { currency } from '../../utils/format';

const axis = { stroke: '#94A3B8', fontSize: 11, tickLine: false } as const;

const tooltipStyle = {
  contentStyle: {
    background: '#10192E',
    border: '1px solid #1E293B',
    borderRadius: 12,
    fontSize: 12,
    color: '#F1F5F9',
  },
  labelStyle: { color: '#94A3B8', marginBottom: 4 },
} as const;

export const CHART_COLORS = ['#2DD4BF', '#8B5CF6', '#38BDF8', '#FBBF24', '#F472B6', '#34D399', '#94A3B8'];

export function RevenueAreaChart({ data, height = 260 }: { data: RevenuePoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          {...axis}
          tickFormatter={(v: string) => v.slice(5)}
          minTickGap={22}
          axisLine={false}
        />
        <YAxis {...axis} axisLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number) => [currency(value), 'Revenue']}
          labelFormatter={(label: string) => `Date ${label}`}
        />
        <Area type="monotone" dataKey="revenue" stroke="#2DD4BF" strokeWidth={2} fill="url(#revGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function OrdersBarChart({ data, height = 240 }: { data: RevenuePoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" {...axis} tickFormatter={(v: string) => v.slice(5)} minTickGap={22} axisLine={false} />
        <YAxis {...axis} axisLine={false} allowDecimals={false} />
        <Tooltip {...tooltipStyle} formatter={(value: number) => [value, 'Orders']} />
        <Bar dataKey="orders" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusPieChart({
  data,
  height = 240,
}: {
  data: { name: string; value: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => [value, name]} />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          formatter={(value: string) => <span style={{ color: '#94A3B8', fontSize: 11 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryBarChart({
  data,
  height = 260,
}: {
  data: { category: string; revenue: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axis} axisLine={false} tickFormatter={(v: number) => `$${v}`} />
        <YAxis type="category" dataKey="category" {...axis} width={96} axisLine={false} />
        <Tooltip {...tooltipStyle} formatter={(value: number) => [currency(value), 'Revenue']} />
        <Bar dataKey="revenue" fill="#2DD4BF" radius={[0, 4, 4, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MiniLineChart({ data, color = '#8B5CF6' }: { data: RevenuePoint[]; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={70}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="revenue" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
