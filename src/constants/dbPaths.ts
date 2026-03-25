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
