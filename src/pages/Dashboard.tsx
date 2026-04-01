import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { signOut, linkWithPopup, type User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { useSensorData } from '../hooks/useSensorData';
import { useRFIDHistory } from '../hooks/useRFIDHistory';
import { useUserPollInterval } from '../hooks/useUserPollInterval';
import { useRFIDBinding } from '../hooks/useRFIDBinding';
import { useBoardConnection } from '../hooks/useBoardConnection';
import { useFanSettings } from '../hooks/useFanSettings';
import SensorCard from '../components/SensorCard';
import TempHumidityChart from '../components/TempHumidityChart';
import RFIDLog from '../components/RFIDLog';
import { Activity, Radio, Settings, Wifi, WifiOff, LogOut } from 'lucide-react';
import {
  POLL_INTERVAL_OPTIONS_MS,
  formatPollIntervalLabel,
} from '../constants/pollInterval';
import { buildDefaultRFIDName, isSameRFIDUid, normalizeRFIDUid } from '../utils/rfid';

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

  const [boardIdInput, setBoardIdInput] = useState('');
  const [boardSaving, setBoardSaving] = useState(false);
  const [boardMsg, setBoardMsg] = useState('');

  const [rfidUidInput, setRfidUidInput] = useState('');
  const [rfidNameInput, setRfidNameInput] = useState('');
  const [rfidSaving, setRfidSaving] = useState(false);
  const [rfidMsg, setRfidMsg] = useState('');

  const [fanMsg, setFanMsg] = useState('');
  const [fanManualOnInput, setFanManualOnInput] = useState(false);
  const [fanManualPercentInput, setFanManualPercentInput] = useState(100);
  const [fanAutoEnabledInput, setFanAutoEnabledInput] = useState(true);
  const [fanAutoThresholdInput, setFanAutoThresholdInput] = useState(27);

  const {
    connection: boardConnection,
    loading: boardLoading,
    error: boardError,
    connectBoard,
    disconnectBoard,
  } = useBoardConnection(user.uid);

  const connectedBoardId = boardConnection?.boardId ?? null;

  const { pollIntervalMs, setPollIntervalMs } = useUserPollInterval(user.uid);
  const {
    data,
    trend,
    loading,
    error,
  } = useSensorData(user.uid, pollIntervalMs, 24);
  const {
    scans,
    loading: scansLoading,
    error: scansError,
  } = useRFIDHistory(user.uid, 30, pollIntervalMs);
  const {
    binding,
    loading: bindingLoading,
    error: bindingError,
    upsertBinding,
    disconnectBinding,
  } = useRFIDBinding(user.uid);
  const {
    settings: fanSettings,
    loading: fanLoading,
    saving: fanSaving,
    error: fanError,
    saveSettings: saveFanSettings,
  } = useFanSettings(user.uid, pollIntervalMs);

  const latestScan = scans[0] ?? null;

  useEffect(() => {
    if (!binding) {
      return;
    }

    setRfidUidInput(binding.uid);
    setRfidNameInput(binding.name);
  }, [binding]);

  useEffect(() => {
    if (!boardConnection) {
      return;
    }

    setBoardIdInput(boardConnection.boardId);
  }, [boardConnection]);

  useEffect(() => {
    setFanManualOnInput(fanSettings.manualOn);
    setFanManualPercentInput(fanSettings.manualPercent);
    setFanAutoEnabledInput(fanSettings.autoEnabled);
    setFanAutoThresholdInput(fanSettings.autoThresholdC);
  }, [fanSettings]);

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

  const handleConnectBoard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBoardMsg('');
    setBoardSaving(true);

    try {
      const nextBoardId = boardIdInput.trim();
      if (!nextBoardId) {
        throw new Error('請輸入 Board ID');
      }

      await connectBoard(nextBoardId);
      setBoardIdInput(nextBoardId);
      setBoardMsg(`✓ Board 連線成功：${nextBoardId}`);
    } catch (err: unknown) {
      setBoardMsg(err instanceof Error ? err.message : 'Board 連線失敗');
    } finally {
      setBoardSaving(false);
    }
  };

  const handleDisconnectBoard = async () => {
    setBoardMsg('');
    setBoardSaving(true);

    try {
      await disconnectBoard();
      setBoardIdInput('');
      setBoardMsg('✓ Board 已中斷連線');
    } catch (err: unknown) {
      setBoardMsg(err instanceof Error ? err.message : 'Board 中斷連線失敗');
    } finally {
      setBoardSaving(false);
    }
  };

  const handleSaveRFIDBinding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRfidMsg('');
    setRfidSaving(true);

    try {
      const normalizedUid = normalizeRFIDUid(rfidUidInput);
      if (!normalizedUid) {
        throw new Error('請輸入 RFID UID');
      }

      const nextName = (rfidNameInput.trim() || buildDefaultRFIDName(normalizedUid)).slice(0, 32);

      await upsertBinding({
        uid: normalizedUid,
        name: nextName,
      });

      setRfidUidInput(normalizedUid);
      setRfidNameInput(nextName);
      setRfidMsg('✓ RFID UID 與名稱已儲存');
    } catch (err: unknown) {
      setRfidMsg(err instanceof Error ? err.message : 'RFID 設定儲存失敗');
    } finally {
      setRfidSaving(false);
    }
  };

  const handleDisconnectRFID = async () => {
    setRfidMsg('');
    setRfidSaving(true);

    try {
      await disconnectBinding();
      setRfidUidInput('');
      setRfidNameInput('');
      setRfidMsg('✓ RFID 已中斷連線');
    } catch (err: unknown) {
      setRfidMsg(err instanceof Error ? err.message : 'RFID 中斷連線失敗');
    } finally {
      setRfidSaving(false);
    }
  };

  const handleUseLatestScannedUid = () => {
    if (!latestScan) {
      setRfidMsg('目前沒有可用的 RFID 掃描紀錄');
      return;
    }

    const normalizedUid = normalizeRFIDUid(latestScan.uid);
    setRfidUidInput(normalizedUid);
    setRfidNameInput((prev) => prev.trim() || buildDefaultRFIDName(normalizedUid));
    setRfidMsg(`已帶入最新 UID：${normalizedUid}`);
  };

  const lastSeen = data?.timestamp
    ? new Date(data.timestamp).toLocaleTimeString()
    : null;

  const handlePollIntervalChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setPollIntervalMs(Number(event.target.value));
  };

  const handleSaveFanSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFanMsg('');

    try {
      await saveFanSettings({
        manualOn: fanManualOnInput,
        manualPercent: fanManualPercentInput,
        autoEnabled: fanAutoEnabledInput,
        autoThresholdC: fanAutoThresholdInput,
      });
      setFanMsg('✓ 風扇設定已儲存');
    } catch (err: unknown) {
      setFanMsg(err instanceof Error ? err.message : '風扇設定儲存失敗');
    }
  };

  const fanSpeedDisplay =
    typeof data?.fanSpeed === 'number'
      ? Math.round(data.fanSpeed)
      : fanSettings.manualOn
        ? fanSettings.manualPercent
        : 0;

  const fanAutoEnabledCurrent =
    typeof data?.fanAutoEnabled === 'boolean'
      ? data.fanAutoEnabled
      : fanSettings.autoEnabled;

  const fanAutoTriggeredCurrent = Boolean(data?.fanAutoTriggered);

  const fanThresholdCurrent =
    typeof data?.fanAutoThresholdC === 'number'
      ? data.fanAutoThresholdC
      : fanSettings.autoThresholdC;

  const latestTapStatus = useMemo(() => {
    if (!latestScan) {
      return null;
    }

    if (!binding) {
      return {
        tone: 'amber' as const,
        text: `偵測到 UID ${latestScan.uid}，請先在設定頁完成綁定`,
      };
    }

    if (isSameRFIDUid(latestScan.uid, binding.uid)) {
      return {
        tone: 'green' as const,
        text: `Tap successful：${binding.name}（${binding.uid}）`,
      };
    }

    return {
      tone: 'red' as const,
      text: `偵測到 UID ${latestScan.uid}，與已綁定 UID ${binding.uid} 不符，不觸發功能`,
    };
  }, [binding, latestScan]);

  const BLUE = '#1937E6';

  const navItems = [
    { id: 'sensors' as Tab, Icon: Activity, label: '感測器' },
    { id: 'rfid' as Tab, Icon: Radio, label: 'RFID' },
    { id: 'settings' as Tab, Icon: Settings, label: '設定' },
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
                等待感測器資料
              </span>
            )}
          </p>
        </div>
        {data
          ? <Wifi className="w-5 h-5" style={{ color: BLUE }} />
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
                  <p className="text-sm text-gray-400 mt-0.5">即時環境監測（溫度、濕度與飼料重量）</p>
                </div>

                {!loading && !data && (
                  <div className="rounded-2xl px-4 py-3 text-sm border shadow-sm bg-amber-50 border-amber-100 text-amber-700">
                    尚未收到感測器資料，請確認裝置是否已開始推送資料。
                  </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
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
                  <SensorCard
                    label="飼料重量"
                    value={data?.weight != null
                      ? data.weight.toFixed(1)
                      : '--'}
                    unit="g"
                    loading={loading}
                  />
                  <SensorCard
                    label="飼料狀態"
                    value={data
                      ? data.hasFood
                        ? '有'
                        : '無'
                      : '--'}
                    unit="容器內"
                    loading={loading}
                    warn={!loading && !!data && !data.hasFood}
                  />
                  <SensorCard
                    label="風扇速度"
                    value={String(fanSpeedDisplay)}
                    unit="%"
                    loading={loading && fanLoading}
                  />
                </div>

                {!loading && data && !data.hasFood && (
                  <div className="rounded-2xl px-4 py-3 text-sm border shadow-sm bg-red-50 border-red-100 text-red-700">
                    偵測到飼料不足，請補充飼料。
                  </div>
                )}

                {!loading && (
                  <div className="rounded-2xl px-4 py-3 text-sm border shadow-sm bg-blue-50 border-blue-100 text-blue-700">
                    風扇狀態：{fanSpeedDisplay}%
                    {' · '}
                    {fanAutoTriggeredCurrent
                      ? `已觸發自動降溫（門檻 ${fanThresholdCurrent.toFixed(1)}°C）`
                      : fanAutoEnabledCurrent
                        ? `自動模式待命（門檻 ${fanThresholdCurrent.toFixed(1)}°C）`
                        : '自動模式關閉'}
                  </div>
                )}

                <TempHumidityChart trend={trend} loading={loading} />

                {data?.deviceId && (
                  <p className="text-gray-400 text-xs text-right">
                    目前來源 Board ID：{data.deviceId}
                  </p>
                )}
              </div>
            )}

            {tab === 'rfid' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">RFID 紀錄</h2>
                  <p className="text-sm text-gray-400 mt-0.5">僅已綁定 UID 可觸發功能（目前僅顯示 tap 成功訊息）</p>
                </div>

                {binding && (
                  <div className="bg-white border border-blue-100 rounded-2xl px-4 py-3 text-sm text-blue-700 shadow-sm">
                    已綁定：<span className="font-semibold">{binding.name}</span>（UID: {binding.uid}）
                  </div>
                )}

                {latestTapStatus && (
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm border shadow-sm ${
                      latestTapStatus.tone === 'green'
                        ? 'bg-green-50 border-green-100 text-green-700'
                        : latestTapStatus.tone === 'amber'
                          ? 'bg-amber-50 border-amber-100 text-amber-700'
                          : 'bg-red-50 border-red-100 text-red-700'
                    }`}
                  >
                    {latestTapStatus.text}
                  </div>
                )}

                {scansLoading && (
                  <p className="text-xs text-gray-400 animate-pulse">讀取 RFID 紀錄中…</p>
                )}

                {scansError && (
                  <p className="text-xs text-red-500">{scansError}</p>
                )}

                <RFIDLog scans={scans} binding={binding} />
              </div>
            )}

            {tab === 'settings' && (
              <div className="space-y-4 max-w-lg">
                <div className="mb-2">
                  <h2 className="text-xl font-bold text-gray-900">設定</h2>
                  <p className="text-sm text-gray-400 mt-0.5">帳戶、Board、風扇控制、同步頻率與 RFID 綁定</p>
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

                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Board 連線</p>

                  <p className="text-xs text-gray-500">
                    目前狀態：{
                      boardLoading
                        ? '讀取中…'
                        : connectedBoardId
                          ? `已連線 ${connectedBoardId}`
                          : '尚未連線'
                    }
                  </p>

                  <form className="space-y-3" onSubmit={handleConnectBoard}>
                    <div>
                      <label htmlFor="board-id" className="text-gray-500 text-xs mb-1 block">Board ID</label>
                      <input
                        id="board-id"
                        value={boardIdInput}
                        onChange={(event) => setBoardIdInput(event.target.value)}
                        placeholder="例如：arduino-mega-01"
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        autoComplete="off"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={boardSaving}
                        className="text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: BLUE }}
                      >
                        {boardSaving ? '連線中…' : '連線 Board'}
                      </button>

                      <button
                        type="button"
                        onClick={handleDisconnectBoard}
                        disabled={!connectedBoardId || boardSaving}
                        className="text-sm font-medium px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        中斷 Board
                      </button>
                    </div>
                  </form>

                  {(boardMsg || boardError) && (
                    <p
                      className="text-sm"
                      style={{
                        color:
                          (boardMsg && boardMsg.startsWith('✓'))
                            ? '#16a34a'
                            : '#dc2626',
                      }}
                    >
                      {boardMsg || boardError}
                    </p>
                  )}
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

                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">風扇控制設定</p>

                  <p className="text-xs text-gray-500">
                    即時狀態：
                    {fanLoading
                      ? ' 讀取中…'
                      : ` 速度 ${fanSpeedDisplay}% · ${fanAutoTriggeredCurrent ? '自動觸發中' : fanAutoEnabledCurrent ? '自動模式待命' : '自動模式關閉'}`}
                  </p>

                  <form className="space-y-3" onSubmit={handleSaveFanSettings}>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={fanManualOnInput}
                        onChange={(event) => setFanManualOnInput(event.target.checked)}
                        disabled={fanSaving}
                      />
                      手動開啟風扇
                    </label>

                    <div>
                      <label htmlFor="fan-manual-percent" className="text-gray-500 text-xs mb-1 block">
                        手動風速（%）
                      </label>
                      <input
                        id="fan-manual-percent"
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={fanManualPercentInput}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          setFanManualPercentInput(
                            Number.isFinite(next)
                              ? Math.max(0, Math.min(100, Math.round(next)))
                              : 0,
                          );
                        }}
                        disabled={fanSaving || !fanManualOnInput}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">目前設定：{fanManualPercentInput}%</p>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={fanAutoEnabledInput}
                        onChange={(event) => setFanAutoEnabledInput(event.target.checked)}
                        disabled={fanSaving}
                      />
                      啟用溫度自動開風扇
                    </label>

                    <div>
                      <label htmlFor="fan-auto-threshold" className="text-gray-500 text-xs mb-1 block">
                        自動啟動溫度（°C）
                      </label>
                      <input
                        id="fan-auto-threshold"
                        type="number"
                        min={15}
                        max={45}
                        step={0.5}
                        value={fanAutoThresholdInput}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          setFanAutoThresholdInput(
                            Number.isFinite(next)
                              ? Math.max(15, Math.min(45, Number(next.toFixed(1))))
                              : 27,
                          );
                        }}
                        disabled={fanSaving || !fanAutoEnabledInput}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        當 DHT11 偵測溫度 ≥ 此值時，自動開啟風扇。預設 27°C。
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={fanSaving || fanLoading}
                      className="text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: BLUE }}
                    >
                      {fanSaving ? '儲存中…' : '儲存風扇設定'}
                    </button>
                  </form>

                  {(fanMsg || fanError) && (
                    <p
                      className="text-sm"
                      style={{
                        color:
                          (fanMsg && fanMsg.startsWith('✓'))
                            ? '#16a34a'
                            : '#dc2626',
                      }}
                    >
                      {fanMsg || fanError}
                    </p>
                  )}
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">RFID 綁定設定</p>

                  <p className="text-xs text-gray-500">
                    目前狀態：{bindingLoading ? '讀取中…' : binding ? `已連結 ${binding.name}（${binding.uid}）` : '尚未連結'}
                  </p>

                  <form className="space-y-3" onSubmit={handleSaveRFIDBinding}>
                    <div>
                      <label htmlFor="rfid-uid" className="text-gray-500 text-xs mb-1 block">RFID UID</label>
                      <input
                        id="rfid-uid"
                        value={rfidUidInput}
                        onChange={(event) => setRfidUidInput(event.target.value)}
                        placeholder="例如：DE AD BE EF"
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        autoComplete="off"
                      />
                    </div>

                    <div>
                      <label htmlFor="rfid-name" className="text-gray-500 text-xs mb-1 block">卡片名稱（可重新命名）</label>
                      <input
                        id="rfid-name"
                        value={rfidNameInput}
                        onChange={(event) => setRfidNameInput(event.target.value)}
                        maxLength={32}
                        placeholder="例如：主卡 / 飼主卡"
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        autoComplete="off"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={rfidSaving}
                        className="text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: BLUE }}
                      >
                        {rfidSaving ? '儲存中…' : '儲存 UID / 名稱'}
                      </button>

                      <button
                        type="button"
                        onClick={handleUseLatestScannedUid}
                        className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        使用最新掃描 UID
                      </button>

                      <button
                        type="button"
                        onClick={handleDisconnectRFID}
                        disabled={!binding || rfidSaving}
                        className="text-sm font-medium px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        中斷連線
                      </button>
                    </div>
                  </form>

                  {(rfidMsg || bindingError) && (
                    <p
                      className="text-sm"
                      style={{
                        color:
                          (rfidMsg && rfidMsg.startsWith('✓'))
                            ? '#16a34a'
                            : '#dc2626',
                      }}
                    >
                      {rfidMsg || bindingError}
                    </p>
                  )}
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
            className="flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors"
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
