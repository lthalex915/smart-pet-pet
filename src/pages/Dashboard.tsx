import { useState } from 'react';
import { signOut, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { useSensorData }   from '../hooks/useSensorData';
import { useRFIDHistory }  from '../hooks/useRFIDHistory';
import SensorCard   from '../components/SensorCard';
import DistanceBar  from '../components/DistanceBar';
import RFIDLog      from '../components/RFIDLog';
import { Activity, Radio, Settings, Wifi, WifiOff, LogOut } from 'lucide-react';

type Tab = 'sensors' | 'rfid' | 'settings';

interface Props { user: User }

export default function Dashboard({ user }: Props) {
  const [tab, setTab] = useState<Tab>('sensors');
  const { data, loading, error } = useSensorData();
  const { scans }               = useRFIDHistory();

  const lastSeen = data?.timestamp
    ? new Date(data.timestamp).toLocaleTimeString()
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white font-mono flex flex-col">

      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-gray-900 border-b border-cyan-500/30
                         px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-cyan-400 font-bold text-sm tracking-wider">
            &#187; CYBERPUNK HUD
          </h1>
          <p className="text-xs mt-0.5 flex items-center gap-1.5">
            {loading ? (
              <span className="text-yellow-400 animate-pulse">● CONNECTING…</span>
            ) : error ? (
              <span className="text-red-400">● ERROR</span>
            ) : data ? (
              <>
                <span className="text-green-400">● LIVE</span>
                <span className="text-gray-500">· {lastSeen}</span>
              </>
            ) : (
              <span className="text-gray-500">● WAITING FOR DEVICE</span>
            )}
          </p>
        </div>
        {data
          ? <Wifi    className="text-green-400 w-4 h-4" />
          : <WifiOff className="text-gray-600  w-4 h-4" />}
      </header>

      {/* ── Content ────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 pb-24 max-w-lg w-full mx-auto">

        {tab === 'sensors' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <SensorCard
                label="DIST"
                value={data?.noEcho || data?.distance == null
                  ? '--'
                  : data.distance.toFixed(1)}
                unit="CM"
                warn={data?.noEcho ?? false}
                loading={loading}
              />
              <SensorCard
                label="TEMP"
                value={data?.temperature != null
                  ? data.temperature.toFixed(1)
                  : '--'}
                unit="°C"
                loading={loading}
              />
              <SensorCard
                label="HUM"
                value={data?.humidity != null
                  ? String(Math.round(data.humidity))
                  : '--'}
                unit="%"
                loading={loading}
              />
            </div>
            <DistanceBar
              distance={data?.distance ?? null}
              noEcho={data?.noEcho ?? true}
            />
            {data?.deviceId && (
              <p className="text-gray-600 text-xs text-right">
                NODE: {data.deviceId}
              </p>
            )}
          </div>
        )}

        {tab === 'rfid' && <RFIDLog scans={scans} />}

        {tab === 'settings' && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-cyan-500/20 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1">LOGGED IN AS</p>
              <p className="text-cyan-300 text-sm">{user.email}</p>
            </div>
            <div className="bg-gray-900 border border-cyan-500/20 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1">FIREBASE PUSH INTERVAL</p>
              <p className="text-cyan-300 text-sm">Every 30 seconds</p>
            </div>
            <button
              onClick={() => signOut(auth)}
              className="w-full flex items-center justify-center gap-2
                         bg-red-500/10 hover:bg-red-500/20 border border-red-500/40
                         text-red-400 py-3 rounded-xl text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              SIGN OUT
            </button>
          </div>
        )}
      </main>

      {/* ── Bottom Nav ─────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900
                      border-t border-cyan-500/30 flex safe-area-pb">
        {([
          { id: 'sensors'  as Tab, Icon: Activity, label: 'SENSORS' },
          { id: 'rfid'     as Tab, Icon: Radio,    label: 'RFID'    },
          { id: 'settings' as Tab, Icon: Settings,  label: 'CONFIG'  },
        ] as const).map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs
                        transition-colors ${
                          tab === id
                            ? 'text-cyan-400'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}