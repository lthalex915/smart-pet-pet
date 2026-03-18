interface Props {
  distance: number | null;
  noEcho:   boolean;
}

const ZONES = [
  { max: 15,  label: '危險',     colour: 'bg-red-500'    },
  { max: 50,  label: '近距離',   colour: 'bg-orange-400'  },
  { max: 120, label: '中距離',   colour: 'bg-amber-400'   },
  { max: 300, label: '遠距離',   colour: 'bg-green-500'   },
];

export default function DistanceBar({ distance, noEcho }: Props) {
  const pct = (!noEcho && distance != null && distance > 0)
    ? Math.max(0, Math.min(100, 100 - (distance / 300) * 100))
    : 0;

  const zone = (!noEcho && distance != null)
    ? ZONES.find((z) => distance < z.max) ?? ZONES[ZONES.length - 1]
    : null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm">
      <div className="flex justify-between text-xs font-medium">
        <span className="text-gray-400 uppercase tracking-wider">近距感測</span>
        <span className={`font-semibold ${noEcho ? 'text-gray-400' : 'text-gray-700'}`}>
          {noEcho ? '無訊號' : zone?.label ?? '--'}
        </span>
      </div>

      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${zone?.colour ?? 'bg-gray-300'}`}
          style={{ width: `${pct}%` }}
        />
        {/* tick marks */}
        {[25, 50, 75].map((t) => (
          <div
            key={t}
            className="absolute top-0 h-full w-px bg-gray-200"
            style={{ left: `${t}%` }}
          />
        ))}
      </div>

      <div className="flex justify-between text-xs text-gray-400">
        <span>300 cm</span>
        <span>0 cm</span>
      </div>
    </div>
  );
}
