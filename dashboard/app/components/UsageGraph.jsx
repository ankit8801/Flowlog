'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fmtDuration, fmtHour } from '../lib/engine';
import useFocusStore from '../lib/store';

const TooltipContent = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="tooltip-name">{typeof label === 'number' ? fmtHour(label) : label}</div>
      {payload.map((p, i) => (
        <div key={i} className="tooltip-row">
          <span style={{ color: p.color || p.fill }}>{p.name}</span>
          <span className="tooltip-val">{p.name === 'CFS Score' ? Math.round(p.value) : fmtDuration(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function UsageGraph({ data, range }) {
  const { cfsTimeline } = useFocusStore();
  const isToday = range === 'today';
  const rawData = isToday ? data?.hourlyBreakdown : data?.dailyBreakdown;
  const hasData = rawData?.some(d => (
    (d.productive + d.distracting + d.neutral) > 0
  ));

  // For hourly: only show active hours + 1 before/after for context
  let chartData = rawData ?? [];
  if (isToday && hasData) {
    const active = chartData
      .map((d, i) => ({ i, total: d.productive + d.distracting + d.neutral }))
      .filter(d => d.total > 0);
    const minH = Math.max(0, Math.min(...active.map(d => d.i)) - 1);
    const maxH = Math.min(23, Math.max(...active.map(d => d.i)) + 1);
    chartData = chartData.slice(minH, maxH + 1);
  }

  // Inject CFS average into chart data if timeline exists
  if (cfsTimeline && cfsTimeline.length > 0) {
    chartData = chartData.map(d => {
      let bucketSnapshots = [];
      if (isToday) {
        bucketSnapshots = cfsTimeline.filter(s => new Date(s.timestamp).getHours() === d.hour);
      } else {
        bucketSnapshots = cfsTimeline.filter(s => {
          const t = new Date(s.timestamp);
          const m = t.getMonth() + 1;
          const dt = t.getDate();
          return `${m}/${dt}` === d.label;
        });
      }
      
      const avgCfs = bucketSnapshots.length > 0 
        ? bucketSnapshots.reduce((acc, s) => acc + s.cfs, 0) / bucketSnapshots.length 
        : null;
      
      return { ...d, avgCfs };
    });
  }

  return (
    <div className="card">
      <div className="card-label">{isToday ? 'Activity by Hour' : 'Daily Overview'}</div>
      <p className="card-sub">{isToday ? 'Productive vs Distracting time per hour' : 'Day-by-day activity breakdown'}</p>

      {hasData ? (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: -24, bottom: 0 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-chart)" vertical={false} />
            <XAxis
              dataKey={isToday ? 'hour' : 'label'}
              tickFormatter={isToday ? fmtHour : v => v}
              tick={{ fill: 'var(--text-3)', fontSize: 11 }}
              axisLine={false} tickLine={false}
              interval={isToday ? 1 : 0}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={v => `${Math.round(v / 60)}m`}
              tick={{ fill: 'var(--text-3)', fontSize: 10 }}
              axisLine={false} tickLine={false}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              domain={[0, 100]} 
              tick={{ fill: 'var(--accent)', fontSize: 10 }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar yAxisId="left" dataKey="productive"  name="Productive"  stackId="a" fill="var(--productive)"  fillOpacity={0.85} />
            <Bar yAxisId="left" dataKey="neutral"     name="Neutral"     stackId="a" fill="var(--neutral)"      fillOpacity={0.5}  />
            <Bar yAxisId="left" dataKey="distracting" name="Distracting" stackId="a" fill="var(--distracting)"  fillOpacity={0.85} radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="avgCfs" name="CFS Score" stroke="var(--accent)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="empty-state">No activity data for this period</div>
      )}
    </div>
  );
}
