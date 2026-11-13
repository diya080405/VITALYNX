import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine
} from 'recharts';
import { VitalObservation, TimeRangeOption } from '../types/observation';
import { SpO2ScaleType } from '../types/patient';

interface VitalChartProps {
  title: string;
  data: VitalObservation[];
  dataKey: 'heartRate' | 'spo2' | 'respiratoryRate' | 'temperature';
  unit: string;
  strokeColor: string;
  baselineValue: number;
  spo2Scale?: SpO2ScaleType;
  normalRange?: [number, number];
  height?: number;
}

export const VitalChart: React.FC<VitalChartProps> = ({
  title,
  data,
  dataKey,
  unit,
  strokeColor,
  baselineValue,
  spo2Scale = 'SCALE_1',
  normalRange,
  height = 180
}) => {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('24h');

  // Filter data points based on selected range
  const filteredData = React.useMemo(() => {
    if (timeRange === '1h') return data.slice(-4);
    if (timeRange === '6h') return data.slice(-8);
    if (timeRange === '24h') return data;
    // 7d simulated points
    return data;
  }, [data, timeRange]);

  const latestVal = filteredData.length > 0 ? filteredData[filteredData.length - 1][dataKey] : baselineValue;
  const delta = Number((latestVal - baselineValue).toFixed(1));
  const deltaSign = delta > 0 ? `+${delta}` : `${delta}`;

  // Y-axis domains
  const getYDomain = () => {
    switch (dataKey) {
      case 'heartRate':
        return [40, 150];
      case 'spo2':
        return [80, 100];
      case 'respiratoryRate':
        return [10, 36];
      case 'temperature':
        return [35.5, 40.0];
      default:
        return ['auto', 'auto'];
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {title}
            </h3>
            {dataKey === 'spo2' && spo2Scale === 'SCALE_2' && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                Scale 2 (Target 88–92%)
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold font-mono text-slate-900">
              {latestVal} <span className="text-xs font-normal text-slate-700">{unit}</span>
            </span>
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                Math.abs(delta) === 0
                  ? 'bg-slate-100 text-slate-600'
                  : delta > 0 && (dataKey === 'heartRate' || dataKey === 'respiratoryRate' || dataKey === 'temperature')
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : delta < 0 && dataKey === 'spo2'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              Δ Baseline: {deltaSign} {unit}
            </span>
          </div>
        </div>

        {/* Time Filter Tabs */}
        <div className="flex rounded-md bg-slate-100 p-0.5 border border-slate-200">
          {(['1h', '6h', '24h', '7d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                timeRange === r
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filteredData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="timeLabel"
              tick={{ fontSize: 10, fill: '#64748b' }}
              stroke="#e2e8f0"
              tickLine={false}
            />
            <YAxis
              domain={getYDomain()}
              tick={{ fontSize: 10, fill: '#64748b' }}
              stroke="#e2e8f0"
              tickLine={false}
              unit={dataKey === 'temperature' ? '°' : ''}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const val = payload[0].value;
                  const dev = Number((Number(val) - baselineValue).toFixed(1));
                  return (
                    <div className="bg-slate-900 text-white rounded-lg p-2.5 shadow-lg border border-slate-800 text-xs">
                      <div className="font-semibold text-slate-300 mb-1">{label}</div>
                      <div className="text-sm font-bold text-teal-300">
                        {val} {unit}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex justify-between gap-3">
                        <span>Baseline: {baselineValue} {unit}</span>
                        <span className={dev > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                          ({dev > 0 ? `+${dev}` : dev})
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Target Area for Scale 2 or Standard */}
            {dataKey === 'spo2' && spo2Scale === 'SCALE_2' && (
              <ReferenceArea
                y1={88}
                y2={92}
                fill="#f59e0b"
                fillOpacity={0.12}
                stroke="#f59e0b"
                strokeDasharray="2 2"
                strokeOpacity={0.5}
              />
            )}

            {/* Baseline Reference Line */}
            <ReferenceLine
              y={baselineValue}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              strokeWidth={1.2}
              label={{
                value: `Base ${baselineValue}`,
                position: 'right',
                fill: '#94a3b8',
                fontSize: 9
              }}
            />

            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={strokeColor}
              strokeWidth={2.4}
              dot={{ r: 2.5, fill: strokeColor }}
              activeDot={{ r: 5, fill: '#0d9488', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
