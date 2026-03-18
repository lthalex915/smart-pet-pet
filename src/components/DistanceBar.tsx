interface Props {
  distance: number | null;
  noEcho:   boolean;
}

const ZONES = [
  { max: 15,  label: '!! CRITICAL',  colour: 'bg-red-500'    },
  { max: 50,  label: 'NEAR',         colour: 'bg-orange-400'  },
  { max: 120, label: 'MID-RANGE',    colour: 'bg-yellow-400'  },
  { max: 300, label: 'FAR',          colour: 'bg-cyan-400'    },
];

export default function DistanceBar({ distance, noEcho }: Props) {
  const pct = (!noEcho && distance != null && distance > 0)
    ? Math.max(0, Math.min(100, 100 - (distance / 300) * 100))
    : 0;

  const zone = (!noEcho && distance != null)
    ? ZONES.find((z) => distance < z.max) ?? ZONES[ZONES.length - 1]
    : null;

  return (
    <div className="bg-gray-900 border border-cyan-500/20 rounded-xl p-4 space-y-3">
      <div className="flex justify-between text-xs text-gray-500">
        <span>PROXIMITY</span>
        <span>{noEcho ? 'NO SIGNAL' : zone?.label ?? '--'}</span>
      </div>

      <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${zone?.colour ?? 'bg-gray-700'}`}
          style={{ width: `${pct}%` }}
        />
        {/* tick marks */}
        {[25, 50, 75].map((t) => (
          <div
            key={t}
            className="absolute top-0 h-full w-px bg-gray-600"
            style={{ left: `${t}%` }}
          />
        ))}
      </div>

      <div className="flex justify-between text-xs text-gray-600">
        <span>300 CM</span>
        <span>0 CM</span>
      </div>
    </div>
  );
}