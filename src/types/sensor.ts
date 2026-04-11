export interface SensorData {
  deviceId: string;
  distance: number | null;
  noEcho: boolean;
  temperature: number | null;
  humidity: number | null;
  weight: number | null;
  hasFood: boolean;
  fanSpeed?: number;
  fanManualOn?: boolean;
  fanManualPercent?: number;
  fanAutoEnabled?: boolean;
  fanAutoThresholdC?: number;
  fanAutoTriggered?: boolean;
  timestamp: number;
}

export interface FanSettings {
  manualOn: boolean;
  manualPercent: number;
  autoEnabled: boolean;
  autoThresholdC: number;
}

export type FeedingTriggerSource = 'manual' | 'schedule' | 'retry';

export type FeedingEventType = 'requested' | 'retrying' | 'success' | 'failed';

export interface FeedingSettings {
  timezone: string;
  scheduleEnabled: boolean;
  scheduleTimes: string[];
  motorRunMs: number;
  weightDeltaThresholdG: number;
  confirmationTimeoutMs: number;
  retryDelayMs: number;
  maxAttempts: number;
}

export interface FeedingRuntime {
  inProgress: boolean;
  requestGroupId: string | null;
  source: FeedingTriggerSource | null;
  attempt: number;
  maxAttempts: number;
  lastStatus: 'idle' | 'in_progress' | 'success' | 'failed';
  lastMessage: string;
  lastUpdatedAt: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastDeltaG: number | null;
  alert: boolean;
}

export interface FeedingEvent {
  id: string;
  requestGroupId: string;
  requestId: string;
  source: FeedingTriggerSource;
  attempt: number;
  type: FeedingEventType;
  message: string;
  scheduleTime?: string | null;
  scheduleKey?: string | null;
  weightBefore?: number | null;
  weightAfter?: number | null;
  delta?: number | null;
  createdAt: number;
}

export interface SensorTrendPoint {
  timestamp: number;
  temperature: number | null;
  humidity: number | null;
}

export interface RFIDScan {
  id: string;
  deviceId: string;
  uid: string;
  type: string;
  timestamp: number;
}

export interface RFIDBinding {
  uid: string;
  name: string;
  connectedAt: number;
  updatedAt: number;
}

export interface BoardConnection {
  boardId: string;
  connectedAt: number;
  updatedAt: number;
}
