export function userSensorsLatestPath(uid: string): string {
  return `users/${uid}/sensors/latest`;
}

export function userSensorsHistoryPath(uid: string): string {
  return `users/${uid}/sensors/history`;
}

export function userRFIDScansPath(uid: string): string {
  return `users/${uid}/rfidScans`;
}

// Legacy/global paths for Arduino firmware that writes without user namespace.
export function legacySensorsLatestPath(): string {
  return 'sensors/latest';
}

export function legacySensorsHistoryPath(): string {
  return 'sensors/history';
}

export function legacyRFIDScansPath(): string {
  return 'rfidScans';
}

export function userFanSettingsPath(uid: string): string {
  return `users/${uid}/fan/settings`;
}

// Shared path for firmware/frontend interop (typically allowed under legacy sensors rules).
export function legacyFanSettingsPath(): string {
  return 'sensors/fanSettings';
}

// Backward compatibility with older firmware/frontend versions.
export function legacyFanSettingsDeprecatedPath(): string {
  return 'fan/settings';
}

export function userFeedingSettingsPath(uid: string): string {
  return `users/${uid}/feeding/settings`;
}

// Shared path for firmware/frontend interop.
export function legacyFeedingSettingsPath(): string {
  return 'sensors/feeding/settings';
}

export function userFeedingCommandPath(uid: string): string {
  return `users/${uid}/feeding/command`;
}

// Shared path for firmware/frontend interop.
export function legacyFeedingCommandPath(): string {
  return 'sensors/feeding/command';
}

export function userFeedingEventsPath(uid: string): string {
  return `users/${uid}/feeding/events`;
}

export function userFeedingRuntimePath(uid: string): string {
  return `users/${uid}/feeding/runtime`;
}

export function userFeedingScheduleTriggerPath(uid: string): string {
  return `users/${uid}/feeding/runtime/scheduleTriggers`;
}

export function userFeedingConsumptionPath(uid: string): string {
  return `users/${uid}/feeding/consumption`;
}

export function legacyFeedingConsumptionPath(): string {
  return 'sensors/feeding/consumption';
}
