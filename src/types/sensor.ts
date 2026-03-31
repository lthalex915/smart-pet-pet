export interface SensorData {
  deviceId: string;
  distance: number | null;
  noEcho: boolean;
  temperature: number | null;
  humidity: number | null;
  weight: number | null;
  hasFood: boolean;
  timestamp: number;
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
