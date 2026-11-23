import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EquityCurvePoint } from '../../types/planner';
import { fmtMoney } from '../ui';

/** 30-year equity projection: property value vs standard vs accelerated debt. */
export function EquityProjectionChart({ curve }: { curve: EquityCurvePoint[] }) {
  const data = curve.map((p) => ({
    year: `Yr ${p.year}`,
    'Property Value': p.propertyValue,
    'Standard Equity': p.standardEquity,
    'Accelerated Equity': p.acceleratedEquity,
    'Offset Buffer': p.offsetBalance,
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="gProp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#71717a33" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={4} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmtMoney(v)} width={70} />
          <Tooltip formatter={(v) => fmtMoney(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="Property Value" stroke="#10b981" fill="url(#gProp)" strokeWidth={2} />
          <Area type="monotone" dataKey="Standard Equity" stroke="#a1a1aa" fill="none" strokeWidth={1.5} strokeDasharray="4 3" />
          <Area type="monotone" dataKey="Accelerated Equity" stroke="#38bdf8" fill="url(#gAcc)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
