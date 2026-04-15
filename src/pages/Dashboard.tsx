import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { signOut, linkWithPopup, type User } from 'firebase/auth';
import {
  Home,
  LogOut,
  Settings,
  UtensilsCrossed,
  Wifi,
  WifiOff,
  Wind,
} from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import SensorCard from '../components/SensorCard';
import TempHumidityChart from '../components/TempHumidityChart';
import RFIDLog from '../components/RFIDLog';
import DistanceBar from '../components/DistanceBar';
import {
  POLL_INTERVAL_OPTIONS_MS,
  formatPollIntervalLabel,
} from '../constants/pollInterval';
import { useBoardConnection } from '../hooks/useBoardConnection';
import { useDailyFoodConsumption } from '../hooks/useDailyFoodConsumption';
import { useFanSettings } from '../hooks/useFanSettings';
import { useFeedingControl } from '../hooks/useFeedingControl';
import { useRFIDBinding } from '../hooks/useRFIDBinding';
import { useRFIDHistory } from '../hooks/useRFIDHistory';
import { useSensorData } from '../hooks/useSensorData';
import { useUserPollInterval } from '../hooks/useUserPollInterval';
import { useWeightControl } from '../hooks/useWeightControl';
import { buildDefaultRFIDName, isSameRFIDUid, normalizeRFIDUid } from '../utils/rfid';

type Tab = 'main' | 'feeding' | 'fan' | 'settings';

interface Props { user: User }

const DEV_MODE_KEY_PREFIX = 'smartpet:dev-mode:';

function buildDevModeKey(uid: string): string {
  return `${DEV_MODE_KEY_PREFIX}${uid}`;
}

function normalizeScheduleTime(value: string): string | null {
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeScheduleTimesInput(value: string[]): string[] {
  const normalized = value
    .map((item) => normalizeScheduleTime(item))
    .filter((item): item is string => item != null);

  return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b));
}

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
  const [tab, setTab] = useState<Tab>('main');
  const [devMode, setDevMode] = useState(false);

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
  const [fanFormDirty, setFanFormDirty] = useState(false);

  const [manualFeedingMsg, setManualFeedingMsg] = useState('');
  const [feedingSettingsMsg, setFeedingSettingsMsg] = useState('');
  const [feedingTimezoneInput, setFeedingTimezoneInput] = useState('Asia/Hong_Kong');
  const [feedingScheduleEnabledInput, setFeedingScheduleEnabledInput] = useState(true);
  const [feedingScheduleTimesInput, setFeedingScheduleTimesInput] = useState<string[]>(['08:00', '20:00']);
  const [feedingMotorRunMsInput, setFeedingMotorRunMsInput] = useState(1000);
  const [feedingThresholdInput, setFeedingThresholdInput] = useState(2);
  const [waterPumpIntervalMinInput, setWaterPumpIntervalMinInput] = useState(20);
  const [feedingConfirmationInput, setFeedingConfirmationInput] = useState(4500);
  const [feedingRetryDelayInput, setFeedingRetryDelayInput] = useState(1200);
  const [feedingMaxAttemptsInput, setFeedingMaxAttemptsInput] = useState(3);
  const [feedingFormDirty, setFeedingFormDirty] = useState(false);
  const [weightMsg, setWeightMsg] = useState('');

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
  const {
    settings: feedingSettings,
    runtime: feedingRuntime,
    events: feedingEvents,
    settingsLoading: feedingSettingsLoading,
    runtimeLoading: feedingRuntimeLoading,
    eventsLoading: feedingEventsLoading,
    settingsSaving: feedingSettingsSaving,
    triggering: feedingTriggering,
    error: feedingError,
    saveSettings: saveFeedingSettings,
    triggerManualFeed,
    clearAlert: clearFeedingAlert,
  } = useFeedingControl(user.uid, data?.weight ?? null, pollIntervalMs);
  const {
    triggeringTare,
    error: weightError,
    tare: triggerWeightTare,
  } = useWeightControl(user.uid);
  const {
    todayConsumedG,
    loading: dailyConsumedLoading,
    error: dailyConsumedError,
  } = useDailyFoodConsumption(
    user.uid,
    data?.foodConsumedTotalG ?? null,
    feedingSettings.timezone,
    pollIntervalMs,
  );

  const latestScan = scans[0] ?? null;

  useEffect(() => {
    const key = buildDevModeKey(user.uid);

    try {
      setDevMode(window.localStorage.getItem(key) === '1');
    } catch {
      setDevMode(false);
    }
  }, [user.uid]);

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
    if (fanFormDirty) {
      return;
    }

    setFanManualOnInput(fanSettings.manualOn);
    setFanManualPercentInput(fanSettings.manualPercent);
    setFanAutoEnabledInput(fanSettings.autoEnabled);
    setFanAutoThresholdInput(fanSettings.autoThresholdC);
  }, [fanFormDirty, fanSettings]);

  useEffect(() => {
    if (feedingFormDirty) {
      return;
    }

    setFeedingTimezoneInput(feedingSettings.timezone);
    setFeedingScheduleEnabledInput(feedingSettings.scheduleEnabled);
    setFeedingScheduleTimesInput(feedingSettings.scheduleTimes.length > 0 ? feedingSettings.scheduleTimes : ['08:00']);
    setFeedingMotorRunMsInput(feedingSettings.motorRunMs);
    setFeedingThresholdInput(feedingSettings.weightDeltaThresholdG);
    setWaterPumpIntervalMinInput(feedingSettings.waterPumpIntervalMin);
    setFeedingConfirmationInput(feedingSettings.confirmationTimeoutMs);
    setFeedingRetryDelayInput(feedingSettings.retryDelayMs);
    setFeedingMaxAttemptsInput(feedingSettings.maxAttempts);
  }, [feedingFormDirty, feedingSettings]);

  const hasGoogleLinked = user.providerData.some((provider) => provider.providerId === 'google.com');
  const hasPasswordProvider = user.providerData.some((provider) => provider.providerId === 'password');

  const handleToggleDevMode = (enabled: boolean) => {
    setDevMode(enabled);

    try {
      const key = buildDevModeKey(user.uid);
      window.localStorage.setItem(key, enabled ? '1' : '0');
    } catch {
      // Ignore localStorage errors.
    }
  };

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
      setFanFormDirty(false);
      setFanMsg('✓ 風扇設定已儲存');
    } catch (err: unknown) {
      setFanMsg(err instanceof Error ? err.message : '風扇設定儲存失敗');
    }
  };

  const handleManualFeed = async () => {
    setManualFeedingMsg('');

    const ok = await triggerManualFeed();
    setManualFeedingMsg(ok ? '✓ 已完成投餵並確認重量變化' : '⚠ 投餵失敗，請檢查容器與馬達');
  };

  const updateScheduleTimeAtIndex = (index: number, value: string) => {
    setFeedingScheduleTimesInput((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)));
    setFeedingFormDirty(true);
  };

  const addScheduleTime = () => {
    setFeedingScheduleTimesInput((prev) => [...prev, '12:00']);
    setFeedingFormDirty(true);
  };

  const removeScheduleTimeAtIndex = (index: number) => {
    setFeedingScheduleTimesInput((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
    setFeedingFormDirty(true);
  };

  const handleSaveFeedingSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedingSettingsMsg('');

    try {
      const scheduleTimes = normalizeScheduleTimesInput(feedingScheduleTimesInput);
      if (scheduleTimes.length === 0) {
        throw new Error('請至少選擇一個排程時間');
      }

      await saveFeedingSettings({
        timezone: feedingTimezoneInput.trim() || 'Asia/Hong_Kong',
        scheduleEnabled: feedingScheduleEnabledInput,
        scheduleTimes,
        motorRunMs: feedingMotorRunMsInput,
        weightDeltaThresholdG: feedingThresholdInput,
        waterPumpIntervalMin: waterPumpIntervalMinInput,
        confirmationTimeoutMs: feedingConfirmationInput,
        retryDelayMs: feedingRetryDelayInput,
        maxAttempts: feedingMaxAttemptsInput,
      });

      setFeedingScheduleTimesInput(scheduleTimes);
      setFeedingFormDirty(false);
      setFeedingSettingsMsg('✓ 自動投餵設定已儲存');
    } catch (err: unknown) {
      setFeedingSettingsMsg(err instanceof Error ? err.message : '投餵設定儲存失敗');
    }
  };

  const handleClearFeedingAlert = async () => {
    await clearFeedingAlert();
    setFeedingSettingsMsg('✓ 已清除提醒');
  };

  const handleWeightTare = async () => {
    setWeightMsg('');

    const ok = await triggerWeightTare();
    setWeightMsg(ok ? '✓ 已送出歸零命令，請保持碗穩定 1-2 秒' : '⚠ 歸零命令送出失敗，請檢查連線');
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

  const feedingStatusTone = feedingRuntime.lastStatus === 'failed'
    ? 'red'
    : feedingRuntime.lastStatus === 'success'
      ? 'green'
      : 'blue';

  const timezoneOptions = useMemo(() => {
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return Array.from(new Set([
      'Asia/Hong_Kong',
      localZone,
      'Asia/Taipei',
      'Asia/Tokyo',
      'UTC',
      'America/Los_Angeles',
      'Europe/London',
    ].filter(Boolean)));
  }, []);

  const latestTapStatus = useMemo(() => {
    if (!latestScan) {
      return null;
    }

    if (!binding) {
      return {
        tone: 'amber' as const,
        text: `偵測到 UID ${latestScan.uid}，尚未完成綁定`,
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
      text: `偵測到 UID ${latestScan.uid}，與已綁定 UID ${binding.uid} 不符`,
    };
  }, [binding, latestScan]);

  const BLUE = '#1937E6';

  const navItems = [
    { id: 'main' as Tab, Icon: Home, label: '主頁' },
    { id: 'feeding' as Tab, Icon: UtensilsCrossed, label: '投餵' },
    { id: 'fan' as Tab, Icon: Wind, label: '風扇' },
    { id: 'settings' as Tab, Icon: Settings, label: '設定' },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between shadow-sm">
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

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 pt-6 pb-8 shrink-0 shadow-sm">
          <nav className="flex flex-col gap-1 px-3">
            {navItems.map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${tab === id ? 'text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                style={tab === id ? { backgroundColor: BLUE } : {}}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

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

        <main className="flex-1 overflow-y-auto p-5 md:p-8 pb-28 md:pb-8">
          <div className="max-w-5xl mx-auto">
            {tab === 'main' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">主頁總覽</h2>
                  <p className="text-sm text-gray-400 mt-0.5">溫濕度、食量、風扇與飼料狀態一頁查看</p>
                </div>

                {!loading && !data && (
                  <div className="rounded-2xl px-4 py-3 text-sm border shadow-sm bg-amber-50 border-amber-100 text-amber-700">
                    尚未收到感測器資料，請確認裝置是否已開始推送資料。
                  </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
                  <SensorCard
                    label="溫度"
                    value={data?.temperature != null ? data.temperature.toFixed(1) : '--'}
                    unit="°C"
                    loading={loading}
                  />
                  <SensorCard
                    label="濕度"
                    value={data?.humidity != null ? String(Math.round(data.humidity)) : '--'}
                    unit="%"
                    loading={loading}
                  />
                  <SensorCard
                    label="飼料重量"
                    value={data?.weight != null ? data.weight.toFixed(1) : '--'}
                    unit="g"
                    loading={loading}
                  />
                  <SensorCard
                    label="本日食用量"
                    value={typeof todayConsumedG === 'number' && !dailyConsumedLoading ? todayConsumedG.toFixed(1) : '--'}
                    unit="g"
                    loading={loading || dailyConsumedLoading}
                  />
                  <SensorCard
                    label="飼料狀態"
                    value={data ? (data.hasFood ? '有' : '無') : '--'}
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

                {dailyConsumedError && (
                  <div className="rounded-2xl px-4 py-3 text-sm border shadow-sm bg-amber-50 border-amber-100 text-amber-700">
                    本日食用量同步異常：{dailyConsumedError}
                  </div>
                )}

                {!loading && typeof data?.foodConsumedTotalG === 'number' && (
                  <div className="rounded-2xl px-4 py-3 text-sm border shadow-sm bg-emerald-50 border-emerald-100 text-emerald-700">
                    累積食用量：{data.foodConsumedTotalG.toFixed(1)}g
                  </div>
                )}

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

                <DistanceBar distance={data?.distance ?? null} noEcho={Boolean(data?.noEcho)} />
                <TempHumidityChart trend={trend} loading={loading} />

                {data?.deviceId && (
                  <p className="text-gray-400 text-xs text-right">
                    目前來源 Board ID：{data.deviceId}
                  </p>
                )}
              </div>
            )}

            {tab === 'feeding' && (
              <div className="space-y-4 max-w-2xl">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">投餵</h2>
                  <p className="text-sm text-gray-400 mt-0.5">手動投餵、重量歸零與自動投餵時程設定</p>
                </div>

                <div
                  className={`rounded-2xl px-3 py-2 text-sm border ${
                    feedingStatusTone === 'red'
                      ? 'bg-red-50 border-red-100 text-red-700'
                      : feedingStatusTone === 'green'
                        ? 'bg-green-50 border-green-100 text-green-700'
                        : 'bg-blue-50 border-blue-100 text-blue-700'
                  }`}
                >
                  {feedingRuntime.lastMessage}
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">投餵功能</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleManualFeed}
                      disabled={feedingTriggering || feedingRuntime.inProgress}
                      className="text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: BLUE }}
                    >
                      {feedingTriggering || feedingRuntime.inProgress ? '投餵中…' : '投餵一次'}
                    </button>

                    <button
                      type="button"
                      onClick={handleWeightTare}
                      disabled={triggeringTare}
                      className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {triggeringTare ? '歸零中…' : '重量感測器歸零'}
                    </button>
                  </div>

                  {(manualFeedingMsg || feedingError || weightMsg || weightError) && (
                    <p
                      className="text-sm"
                      style={{
                        color:
                          (manualFeedingMsg && manualFeedingMsg.startsWith('✓')) || (weightMsg && weightMsg.startsWith('✓'))
                            ? '#16a34a'
                            : '#dc2626',
                      }}
                    >
                      {manualFeedingMsg || feedingError || weightMsg || weightError}
                    </p>
                  )}

                  {feedingRuntime.alert && (
                    <div className="rounded-2xl px-3 py-2 text-sm border bg-red-50 border-red-100 text-red-700 flex items-center justify-between gap-2">
                      <span>已連續 3 次無重量變化，請檢查容器是否堵塞或空桶。</span>
                      <button
                        type="button"
                        onClick={handleClearFeedingAlert}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-100"
                      >
                        清除提醒
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-1">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">食用量</p>
                  <p className="text-sm text-gray-700">
                    本日食用量：
                    <span className="font-semibold ml-1">
                      {dailyConsumedLoading || typeof todayConsumedG !== 'number' ? '--' : `${todayConsumedG.toFixed(1)} g`}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500">
                    累積食用量：{typeof data?.foodConsumedTotalG === 'number' ? `${data.foodConsumedTotalG.toFixed(1)} g` : '--'}
                  </p>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">投餵設定</p>
                  <p className="text-xs text-gray-500">
                    {feedingSettingsLoading || feedingRuntimeLoading
                      ? '讀取中…'
                      : `${feedingSettings.scheduleEnabled ? '排程啟用' : '排程停用'} · 時區 ${feedingSettings.timezone}`}
                  </p>

                  <form className="space-y-3" onSubmit={handleSaveFeedingSettings}>
                    <div>
                      <label htmlFor="feeding-timezone" className="text-gray-500 text-xs mb-1 block">
                        時區
                      </label>
                      <select
                        id="feeding-timezone"
                        value={feedingTimezoneInput}
                        onChange={(event) => {
                          setFeedingTimezoneInput(event.target.value);
                          setFeedingFormDirty(true);
                        }}
                        disabled={feedingSettingsSaving}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        {timezoneOptions.map((timezoneOption) => (
                          <option key={timezoneOption} value={timezoneOption}>
                            {timezoneOption}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={feedingScheduleEnabledInput}
                        onChange={(event) => {
                          setFeedingScheduleEnabledInput(event.target.checked);
                          setFeedingFormDirty(true);
                        }}
                        disabled={feedingSettingsSaving}
                      />
                      啟用自動排程投餵
                    </label>

                    <div className="space-y-2">
                      <label className="text-gray-500 text-xs block">
                        排程時間
                      </label>
                      {feedingScheduleTimesInput.map((timeValue, index) => (
                        <div key={`${index}-${timeValue}`} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={timeValue}
                            onChange={(event) => updateScheduleTimeAtIndex(index, event.target.value)}
                            disabled={feedingSettingsSaving}
                            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />
                          <button
                            type="button"
                            onClick={() => removeScheduleTimeAtIndex(index)}
                            disabled={feedingScheduleTimesInput.length <= 1 || feedingSettingsSaving}
                            className="text-xs font-medium px-2.5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            刪除
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addScheduleTime}
                        disabled={feedingSettingsSaving}
                        className="text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        新增時間
                      </button>
                    </div>

                    <div>
                      <label htmlFor="water-pump-interval" className="text-gray-500 text-xs mb-1 block">
                        水泵補水頻率（分鐘）
                      </label>
                      <select
                        id="water-pump-interval"
                        value={waterPumpIntervalMinInput}
                        onChange={(event) => {
                          setWaterPumpIntervalMinInput(Number(event.target.value));
                          setFeedingFormDirty(true);
                        }}
                        disabled={feedingSettingsSaving}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        {[15, 20, 25, 30].map((minutes) => (
                          <option key={minutes} value={minutes}>
                            每 {minutes} 分鐘
                          </option>
                        ))}
                      </select>
                    </div>

                    {devMode && (
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-3">
                        <p className="text-xs text-gray-500 font-medium">進階設定（Dev Mode）</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="feeding-motor-ms" className="text-gray-500 text-xs mb-1 block">
                              單次馬達轉動時間（ms）
                            </label>
                            <input
                              id="feeding-motor-ms"
                              type="number"
                              min={300}
                              max={5000}
                              step={100}
                              value={feedingMotorRunMsInput}
                              onChange={(event) => {
                                setFeedingMotorRunMsInput(Number(event.target.value));
                                setFeedingFormDirty(true);
                              }}
                              disabled={feedingSettingsSaving}
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                          </div>

                          <div>
                            <label htmlFor="feeding-delta-threshold" className="text-gray-500 text-xs mb-1 block">
                              重量差門檻（g）
                            </label>
                            <input
                              id="feeding-delta-threshold"
                              type="number"
                              min={0.5}
                              max={50}
                              step={0.1}
                              value={feedingThresholdInput}
                              onChange={(event) => {
                                setFeedingThresholdInput(Number(event.target.value));
                                setFeedingFormDirty(true);
                              }}
                              disabled={feedingSettingsSaving}
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                          </div>

                          <div>
                            <label htmlFor="feeding-confirm-ms" className="text-gray-500 text-xs mb-1 block">
                              等待重量回傳（ms）
                            </label>
                            <input
                              id="feeding-confirm-ms"
                              type="number"
                              min={1000}
                              max={20000}
                              step={100}
                              value={feedingConfirmationInput}
                              onChange={(event) => {
                                setFeedingConfirmationInput(Number(event.target.value));
                                setFeedingFormDirty(true);
                              }}
                              disabled={feedingSettingsSaving}
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                          </div>

                          <div>
                            <label htmlFor="feeding-retry-delay" className="text-gray-500 text-xs mb-1 block">
                              重試間隔（ms）
                            </label>
                            <input
                              id="feeding-retry-delay"
                              type="number"
                              min={400}
                              max={10000}
                              step={100}
                              value={feedingRetryDelayInput}
                              onChange={(event) => {
                                setFeedingRetryDelayInput(Number(event.target.value));
                                setFeedingFormDirty(true);
                              }}
                              disabled={feedingSettingsSaving}
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                          </div>

                          <div>
                            <label htmlFor="feeding-max-attempts" className="text-gray-500 text-xs mb-1 block">
                              最多重試次數
                            </label>
                            <input
                              id="feeding-max-attempts"
                              type="number"
                              min={1}
                              max={5}
                              step={1}
                              value={feedingMaxAttemptsInput}
                              onChange={(event) => {
                                setFeedingMaxAttemptsInput(Number(event.target.value));
                                setFeedingFormDirty(true);
                              }}
                              disabled={feedingSettingsSaving}
                              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={feedingSettingsSaving || feedingSettingsLoading}
                      className="text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: BLUE }}
                    >
                      {feedingSettingsSaving ? '儲存中…' : '儲存投餵設定'}
                    </button>
                  </form>

                  {(feedingSettingsMsg || feedingError) && (
                    <p
                      className="text-sm"
                      style={{
                        color:
                          (feedingSettingsMsg && feedingSettingsMsg.startsWith('✓'))
                            ? '#16a34a'
                            : '#dc2626',
                      }}
                    >
                      {feedingSettingsMsg || feedingError}
                    </p>
                  )}

                  {devMode && (
                    <div className="space-y-1">
                      <p className="text-gray-500 text-xs">最近投餵紀錄：</p>
                      {feedingEventsLoading ? (
                        <p className="text-xs text-gray-400">讀取中…</p>
                      ) : feedingEvents.length === 0 ? (
                        <p className="text-xs text-gray-400">尚無投餵紀錄</p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {feedingEvents.slice(0, 6).map((eventItem) => (
                            <div
                              key={eventItem.id}
                              className="text-xs bg-gray-50 border border-gray-100 rounded-xl px-2.5 py-2 text-gray-600"
                            >
                              <p className="font-medium text-gray-700">
                                {new Date(eventItem.createdAt).toLocaleString()} · {eventItem.source} · #{eventItem.attempt} · {eventItem.type}
                              </p>
                              <p>{eventItem.message}</p>
                              {typeof eventItem.delta === 'number' && (
                                <p className="text-gray-500">重量變化：{eventItem.delta.toFixed(1)}g</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'fan' && (
              <div className="space-y-4 max-w-lg">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">風扇控制</h2>
                  <p className="text-sm text-gray-400 mt-0.5">手動風速與溫度自動開啟設定</p>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
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
                        onChange={(event) => {
                          setFanManualOnInput(event.target.checked);
                          setFanFormDirty(true);
                        }}
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
                          setFanFormDirty(true);
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
                        onChange={(event) => {
                          setFanAutoEnabledInput(event.target.checked);
                          setFanFormDirty(true);
                        }}
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
                          setFanFormDirty(true);
                        }}
                        disabled={fanSaving || !fanAutoEnabledInput}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    {devMode && (
                      <p className="text-xs text-gray-400">
                        Runtime：manualOn={String(fanSettings.manualOn)} / autoTriggered={String(fanAutoTriggeredCurrent)} / threshold={fanThresholdCurrent.toFixed(1)}°C
                      </p>
                    )}

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
              </div>
            )}

            {tab === 'settings' && (
              <div className="space-y-4 max-w-lg">
                <div className="mb-2">
                  <h2 className="text-xl font-bold text-gray-900">設定</h2>
                  <p className="text-sm text-gray-400 mt-0.5">帳號與系統偏好設定</p>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">顯示模式</p>
                  <label className="flex items-center justify-between gap-2 text-sm text-gray-700">
                    <span>啟用 Dev Mode（顯示進階設定）</span>
                    <input
                      type="checkbox"
                      checked={devMode}
                      onChange={(event) => handleToggleDevMode(event.target.checked)}
                    />
                  </label>
                  <p className="text-xs text-gray-500">關閉時會隱藏 Board、RFID、投餵/風扇進階參數。</p>
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
                        <p className="text-gray-500 text-sm mb-3">將您的帳號與 Google 連結，之後可使用 Google 直接登入。</p>
                        <button
                          onClick={handleLinkGoogle}
                          disabled={linkLoading}
                          className="flex items-center gap-2 font-semibold text-sm px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: '#111827', color: '#ffffff', border: 'none' }}
                          onMouseEnter={(event) => {
                            if (!linkLoading) {
                              event.currentTarget.style.backgroundColor = '#1f2937';
                            }
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.backgroundColor = '#111827';
                          }}
                        >
                          <GoogleIcon />
                          {linkLoading ? '連結中…' : '連結 Google 帳號'}
                        </button>
                        {linkMsg && (
                          <p className="text-sm mt-2" style={{ color: linkMsg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>
                            {linkMsg}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {devMode ? (
                  <>
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

                      {latestTapStatus && (
                        <div
                          className={`rounded-2xl px-3 py-2 text-xs border ${
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

                      {scansLoading && <p className="text-xs text-gray-400">讀取 RFID 紀錄中…</p>}
                      {scansError && <p className="text-xs text-red-500">{scansError}</p>}
                      <RFIDLog scans={scans} binding={binding} />
                    </div>
                  </>
                ) : (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-700">
                    進階設定已隱藏。可在上方啟用 Dev Mode 查看 Board / RFID / 推送間隔設定。
                  </div>
                )}

                <button
                  onClick={() => signOut(auth)}
                  className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 py-3.5 rounded-2xl text-sm font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  登出
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex safe-area-pb shadow-lg">
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
