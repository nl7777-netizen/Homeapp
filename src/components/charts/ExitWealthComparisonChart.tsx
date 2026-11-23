import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ExitPlannerResult } from '../../types/planner';
import { fmtMoney } from '../ui';

const COLORS: Record<string, string> = {
  A: '#f59e0b',
  B: '#8b5cf6',
  C: '#10b981',
  D: '#38bdf8',
};

/** Apples-to-apples consolidated wealth paths for Scenarios A/B/C/D. */
export function ExitWealthComparisonChart({ result }: { result: ExitPlannerResult }) {
  const maxMonth = Math.max(...Object.values(result.scenarios).map((s) => s.wealthPath.length)) - 1;
  const data: Record<string, number | string>[] = [];
  for (let i = 0; i <= maxMonth; i++) {
    const row: Record<string, number | string> = { month: `M${i}` };
    for (const id of ['A', 'B', 'C', 'D'] as const) {
      const pt = result.scenarios[id].wealthPath[i];
      if (pt) row[`Scenario ${id}`] = pt.wealth;
    }
    data.push(row);
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#71717a33" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(maxMonth / 10))} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmtMoney(v)} width={70} />
          <Tooltip formatter={(v) => fmtMoney(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {(['A', 'B', 'C', 'D'] as const).map((id) => (
            <Line
              key={id}
              type="monotone"
              dataKey={`Scenario ${id}`}
              stroke={COLORS[id]}
              strokeWidth={id === result.winnerId ? 3 : 1.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
