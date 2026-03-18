export interface SensorData {
  deviceId:    string;
  distance:    number | null;
  noEcho:      boolean;
  temperature: number | null;
  humidity:    number | null;
  timestamp:   number;
}

export interface RFIDScan {
  id:        string;
  deviceId:  string;
  uid:       string;
  type:      string;
  timestamp: number;
}