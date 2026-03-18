interface Props {
  label:   string;
  value:   string;
  unit:    string;
  warn?:   boolean;
  loading?: boolean;
}

export default function SensorCard({ label, value, unit, warn, loading }: Props) {
  const colour = loading
    ? 'text-gray-500'
    : warn
    ? 'text-yellow-400'
    : 'text-cyan-300';

  return (
    <div className="bg-gray-900 border border-cyan-500/20 rounded-xl p-3 flex flex-col gap-1">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`font-bold text-lg leading-none ${colour} ${loading ? 'animate-pulse' : ''}`}>
        {value}
      </span>
      <span className="text-gray-600 text-xs">{unit}</span>
    </div>
  );
}