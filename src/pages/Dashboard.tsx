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

function PawIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="4" cy="8" r="2" />
      <path d="M12 22c-4 0-7-3-7-6 0-2 1-4 3-5l2-1 2-1 2 1 2 1c2 1 3 3 3 5 0 3-3 6-7 6z" />
    </svg>
  );
}

export default function Dashboard({ user }: Props) {
  const [tab, setTab] = useState<Tab>('sensors');
  const { data, loading, error } = useSensorData();
  const { scans }               = useRFIDHistory();

  const lastSeen = data?.timestamp
    ? new Date(data.timestamp).toLocaleTimeString()
    : null;

  const BLUE = '#1937E6';

  const navItems = [
    { id: 'sensors'  as Tab, Icon: Activity, label: '感測器' },
    { id: 'rfid'     as Tab, Icon: Radio,    label: 'RFID'   },
    { id: 'settings' as Tab, Icon: Settings, label: '設定'   },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">

      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100
                         px-5 py-4 flex items-center justify-between shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm"
              style={{ backgroundColor: BLUE }}
            >
              <PawIcon className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-base tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              <span style={{ color: BLUE }}>Smart</span>
              <span style={{ color: '#111827' }}>Pet</span>
            </h1>
          </div>
          <p className="text-xs flex items-center gap-1.5 ml-9">
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
              <span className="flex items-center gap-1.5" style={{ color: BLUE }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: BLUE }} />
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
          ? <Wifi    className="w-5 h-5" style={{ color: BLUE }} />
          : <WifiOff className="text-gray-300 w-5 h-5" />}
      </header>

      {/* ── Desktop Sidebar + Content ───────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar (desktop only) */}
        <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 pt-6 pb-8 shrink-0 shadow-sm">
          <nav className="flex flex-col gap-1 px-3">
            {navItems.map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                            ${tab === id ? 'text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                style={tab === id ? { backgroundColor: BLUE } : {}}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* User info at bottom of sidebar */}
          <div className="mt-auto px-3">
            <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: BLUE }}
              >
                {user.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <p className="text-gray-600 text-xs truncate">{user.email}</p>
            </div>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-5 md:p-8 pb-28 md:pb-8">
          <div className="max-w-2xl mx-auto md:max-w-none">

            {tab === 'sensors' && (
              <div className="space-y-5">
                {/* Page title */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">感測器數據</h2>
                  <p className="text-sm text-gray-400 mt-0.5">即時環境監測</p>
                </div>

                {/* Sensor cards grid — 3 cols on mobile, up to 4 on desktop */}
                <div className="grid grid-cols-3 md:grid-cols-3 xl:grid-cols-3 gap-3 md:gap-4">
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
              <div className="space-y-4 max-w-lg">
                <div className="mb-2">
                  <h2 className="text-xl font-bold text-gray-900">設定</h2>
                  <p className="text-sm text-gray-400 mt-0.5">帳戶與系統設定</p>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">已登入帳號</p>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: BLUE }}
                    >
                      {user.email?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <p className="text-gray-700 text-sm font-medium">{user.email}</p>
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Firebase 推送間隔</p>
                  <div className="flex items-center justify-between">
                    <p className="text-gray-700 text-sm">每 30 秒</p>
                    <span
                      className="text-white text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: BLUE }}
                    >
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

          </div>
        </main>
      </div>

      {/* ── Bottom Nav (mobile only) ────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white
                      border-t border-gray-100 flex safe-area-pb shadow-lg">
        {navItems.map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors`}
            style={tab === id ? { color: BLUE } : { color: '#9ca3af' }}
          >
            <Icon className={`w-5 h-5 ${tab === id ? 'stroke-2' : ''}`} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
