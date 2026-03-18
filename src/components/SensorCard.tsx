interface Props {
  label:   string;
  value:   string;
  unit:    string;
  warn?:   boolean;
  loading?: boolean;
}

export default function SensorCard({ label, value, unit, warn, loading }: Props) {
  const colour = loading
    ? 'text-gray-400'
    : warn
    ? 'text-amber-500'
    : 'text-green-600';

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
      <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">{label}</span>
      <span className={`font-bold text-2xl leading-none ${colour} ${loading ? 'animate-pulse' : ''}`}>
        {value}
      </span>
      <span className="text-gray-400 text-xs">{unit}</span>
    </div>
  );
}
