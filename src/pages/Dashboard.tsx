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
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">

      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100
                         px-5 py-4 flex items-center justify-between shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-6 h-6 bg-green-500 rounded-md flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12z"/>
                <circle cx="10" cy="10" r="3" />
              </svg>
            </div>
            <h1 className="text-gray-900 font-bold text-base tracking-tight">SmartPet</h1>
          </div>
          <p className="text-xs flex items-center gap-1.5 ml-8">
            {loading ? (
              <span className="text-amber-500 animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full inline-block animate-pulse" />
                連線中…
              </span>
            ) : error ? (
              <span className="text-red-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />
                連線錯誤
              </span>
            ) : data ? (
              <span className="text-green-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                即時更新
                <span className="text-gray-400">· {lastSeen}</span>
              </span>
            ) : (
              <span className="text-gray-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full inline-block" />
                等待裝置連線
              </span>
            )}
          </p>
        </div>
        {data
          ? <Wifi    className="text-green-500 w-5 h-5" />
          : <WifiOff className="text-gray-300  w-5 h-5" />}
      </header>

      {/* ── Content ────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-5 pb-28 max-w-lg w-full mx-auto">

        {tab === 'sensors' && (
          <div className="space-y-4">
            {/* Page title */}
            <div className="mb-2">
              <h2 className="text-xl font-bold text-gray-900">感測器數據</h2>
              <p className="text-sm text-gray-400 mt-0.5">即時環境監測</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <SensorCard
                label="距離"
                value={data?.noEcho || data?.distance == null
                  ? '--'
                  : data.distance.toFixed(1)}
                unit="CM"
                warn={data?.noEcho ?? false}
                loading={loading}
              />
              <SensorCard
                label="溫度"
                value={data?.temperature != null
                  ? data.temperature.toFixed(1)
                  : '--'}
                unit="°C"
                loading={loading}
              />
              <SensorCard
                label="濕度"
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
              <p className="text-gray-400 text-xs text-right">
                裝置 ID：{data.deviceId}
              </p>
            )}
          </div>
        )}

        {tab === 'rfid' && (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">RFID 紀錄</h2>
              <p className="text-sm text-gray-400 mt-0.5">掃描歷史記錄</p>
            </div>
            <RFIDLog scans={scans} />
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-4">
            <div className="mb-2">
              <h2 className="text-xl font-bold text-gray-900">設定</h2>
              <p className="text-sm text-gray-400 mt-0.5">帳戶與系統設定</p>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">已登入帳號</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-bold text-sm">
                    {user.email?.[0]?.toUpperCase() ?? 'U'}
                  </span>
                </div>
                <p className="text-gray-700 text-sm font-medium">{user.email}</p>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">Firebase 推送間隔</p>
              <div className="flex items-center justify-between">
                <p className="text-gray-700 text-sm">每 30 秒</p>
                <span className="bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  正常
                </span>
              </div>
            </div>

            <button
              onClick={() => signOut(auth)}
              className="w-full flex items-center justify-center gap-2
                         bg-red-50 hover:bg-red-100 border border-red-200
                         text-red-600 py-3.5 rounded-2xl text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              登出
            </button>
          </div>
        )}
      </main>

      {/* ── Bottom Nav ─────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white
                      border-t border-gray-100 flex safe-area-pb shadow-lg">
        {([
          { id: 'sensors'  as Tab, Icon: Activity, label: '感測器' },
          { id: 'rfid'     as Tab, Icon: Radio,    label: 'RFID'   },
          { id: 'settings' as Tab, Icon: Settings,  label: '設定'   },
        ] as const).map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium
                        transition-colors ${
                          tab === id
                            ? 'text-green-600'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
          >
            <Icon className={`w-5 h-5 ${tab === id ? 'stroke-2' : ''}`} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
