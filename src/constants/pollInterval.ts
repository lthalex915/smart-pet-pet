export const POLL_INTERVAL_OPTIONS_MS = [3000, 5000, 10000, 15000, 30000, 45000, 60000] as const;

export type PollIntervalMs = (typeof POLL_INTERVAL_OPTIONS_MS)[number];

export const DEFAULT_POLL_INTERVAL_MS: PollIntervalMs = 15000;

export function formatPollIntervalLabel(ms: number): string {
  if (ms === 60000) {
    return '1 分鐘';
  }

  return `${ms / 1000} 秒`;
}

export function sanitizePollInterval(value: unknown): PollIntervalMs {
  if (typeof value !== 'number') {
    return DEFAULT_POLL_INTERVAL_MS;
  }

  if (POLL_INTERVAL_OPTIONS_MS.includes(value as PollIntervalMs)) {
    return value as PollIntervalMs;
  }

  return DEFAULT_POLL_INTERVAL_MS;
}
