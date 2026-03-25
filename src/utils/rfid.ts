export function normalizeRFIDUid(uid: string): string {
  return uid.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function buildDefaultRFIDName(uid: string): string {
  const compact = normalizeRFIDUid(uid).replace(/\s+/g, '');
  const suffix = compact.slice(-4);

  return suffix ? `RFID-${suffix}` : 'RFID-CARD';
}

export function isSameRFIDUid(left: string, right: string): boolean {
  return normalizeRFIDUid(left) === normalizeRFIDUid(right);
}
