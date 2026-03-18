import type { RFIDScan } from '../types/sensor';
import { Shield } from 'lucide-react';

interface Props { scans: RFIDScan[] }

export default function RFIDLog({ scans }: Props) {
  if (scans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-600">
        <Shield className="w-10 h-10" />
        <p className="font-mono text-sm">NO SCANS LOGGED</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-gray-500 text-xs mb-3">
        SHOWING LAST {scans.length} SCAN{scans.length !== 1 ? 'S' : ''}
      </p>
      {scans.map((scan) => (
        <div
          key={scan.id}
          className="bg-gray-900 border border-cyan-500/20 rounded-xl p-3 space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-cyan-300 font-bold text-sm tracking-widest">
              {scan.uid}
            </span>
            <span className="text-green-400 text-xs">● LOGGED</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{scan.type}</span>
            <span>{new Date(scan.timestamp).toLocaleString()}</span>
          </div>
          <div className="text-xs text-gray-600">NODE: {scan.deviceId}</div>
        </div>
      ))}
    </div>
  );
}