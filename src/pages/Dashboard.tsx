import { useState, type ChangeEvent } from 'react';
import { signOut, linkWithPopup, type User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { useSensorData } from '../hooks/useSensorData';
import { useRFIDHistory } from '../hooks/useRFIDHistory';
import { useUserPollInterval } from '../hooks/useUserPollInterval';
import SensorCard from '../components/SensorCard';
import DistanceBar from '../components/DistanceBar';
import RFIDLog from '../components/RFIDLog';
import { Activity, Radio, Settings, Wifi, WifiOff, LogOut } from 'lucide-react';
import {
  POLL_INTERVAL_OPTIONS_MS,
  formatPollIntervalLabel,
} from '../constants/pollInterval';

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

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

export default function Dashboard({ user }: Props) {
  const [tab, setTab] = useState<Tab>('sensors');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');
  const { pollIntervalMs, setPollIntervalMs } = useUserPollInterval(user.uid);
  const { data, loading, error } = useSensorData(pollIntervalMs);
  const { scans } = useRFIDHistory(30, pollIntervalMs);

  // Check if user already has Google linked
  const hasGoogleLinked = user.providerData.some(p => p.providerId === 'google.com');
  // Check if user has email/password provider
  const hasPasswordProvider = user.providerData.some(p => p.providerId === 'password');

  const handleLinkGoogle = async () => {
    setLinkLoading(true);
    setLinkMsg('');
    try {
      await linkWithPopup(user, googleProvider);
      setLinkMsg('✓ Google 帳號已成功連結！');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/credential-already-in-use') {
        setLinkMsg('此 Google 帳號已與其他帳戶關聯');
      } else if (code === 'auth/popup-closed-by-user') {
        setLinkMsg('視窗已關閉，請再試一次');
      } else {
        setLinkMsg(err instanceof Error ? err.message : '連結失敗，請稍後再試');
      }
    } finally {
      setLinkLoading(false);
    }
  };

  const lastSeen = data?.timestamp
    ? new Date(data.timestamp).toLocaleTimeString()
    : null;

  const handlePollIntervalChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setPollIntervalMs(Number(event.target.value));
  };

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
                即時更新（每 {formatPollIntervalLabel(pollIntervalMs)}）
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <label htmlFor="poll-interval" className="text-gray-500 text-xs mb-1 block">
                        更新頻率
                      </label>
                      <select
                        id="poll-interval"
                        value={pollIntervalMs}
                        onChange={handlePollIntervalChange}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        {POLL_INTERVAL_OPTIONS_MS.map((ms) => (
                          <option key={ms} value={ms}>
                            {formatPollIntervalLabel(ms)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <span
                      className="text-white text-xs font-medium px-2.5 py-1 rounded-full self-start sm:self-auto"
                      style={{ backgroundColor: BLUE }}
                    >
                      目前每 {formatPollIntervalLabel(pollIntervalMs)}
                    </span>
                  </div>
                </div>

                {/* Link Google Account — only shown for email/password users */}
                {hasPasswordProvider && (
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">連結 Google 帳號</p>
                    {hasGoogleLinked ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="text-white text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: '#16a34a' }}
                        >
                          ✓ 已連結
                        </span>
                        <p className="text-gray-500 text-sm">您的帳號已與 Google 連結</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-500 text-sm mb-3">
                          將您的帳號與 Google 連結，之後可使用 Google 直接登入。
                        </p>
                        <button
                          onClick={handleLinkGoogle}
                          disabled={linkLoading}
                          className="flex items-center gap-2 font-semibold text-sm px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: '#111827', color: '#ffffff', border: 'none' }}
                          onMouseEnter={e => { if (!linkLoading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1f2937'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#111827'; }}
                        >
                          <GoogleIcon />
                          {linkLoading ? '連結中…' : '連結 Google 帳號'}
                        </button>
                        {linkMsg && (
                          <p
                            className="text-sm mt-2"
                            style={{ color: linkMsg.startsWith('✓') ? '#16a34a' : '#dc2626' }}
                          >
                            {linkMsg}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

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
