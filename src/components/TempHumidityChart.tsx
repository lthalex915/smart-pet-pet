import type { SensorTrendPoint } from '../types/sensor';

interface SparklineProps {
  label: string;
  unit: string;
  color: string;
  points: Array<number | null>;
  loading?: boolean;
}

function Sparkline({ label, unit, color, points, loading = false }: SparklineProps) {
  const width = 360;
  const height = 110;
  const padding = 14;

  const validEntries = points
    .map((value, index) => ({ value, index }))
    .filter((entry): entry is { value: number; index: number } => typeof entry.value === 'number');

  const currentValue = validEntries.length > 0 ? validEntries[validEntries.length - 1].value : null;

  if (points.length === 0 || validEntries.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
          <span className={`text-xs ${loading ? 'animate-pulse text-gray-400' : 'text-gray-400'}`}>
            -- {unit}
          </span>
        </div>
        <div className="h-24 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">
          尚無足夠資料繪圖
        </div>
      </div>
    );
  }

  const minValue = Math.min(...validEntries.map((entry) => entry.value));
  const maxValue = Math.max(...validEntries.map((entry) => entry.value));
  const range = Math.max(1, maxValue - minValue);

  const valueToY = (value: number) => {
    const normalized = (value - minValue) / range;
    return height - padding - normalized * (height - padding * 2);
  };

  const indexToX = (index: number) => {
    if (points.length <= 1) {
      return width / 2;
    }

    return padding + (index / (points.length - 1)) * (width - padding * 2);
  };

  const linePath = validEntries
    .map((entry, idx) => `${idx === 0 ? 'M' : 'L'} ${indexToX(entry.index)} ${valueToY(entry.value)}`)
    .join(' ');

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
        <span className={`text-xs font-medium ${loading ? 'animate-pulse text-gray-400' : 'text-gray-500'}`}>
          {currentValue == null ? '--' : currentValue.toFixed(1)} {unit}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" aria-label={`${label} chart`}>
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#e5e7eb"
          strokeWidth="1"
        />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
        <span>min {minValue.toFixed(1)}</span>
        <span>max {maxValue.toFixed(1)}</span>
      </div>
    </div>
  );
}

interface Props {
  trend: SensorTrendPoint[];
  loading?: boolean;
}

export default function TempHumidityChart({ trend, loading = false }: Props) {
  const tempPoints = trend.map((point) => point.temperature);
  const humidityPoints = trend.map((point) => point.humidity);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
      <Sparkline
        label="溫度趨勢"
        unit="°C"
        color="#1937E6"
        points={tempPoints}
        loading={loading}
      />
      <Sparkline
        label="濕度趨勢"
        unit="%"
        color="#0EA5E9"
        points={humidityPoints}
        loading={loading}
      />
    </div>
  );
}
