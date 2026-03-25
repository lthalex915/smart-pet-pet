import type { RFIDBinding, RFIDScan } from '../types/sensor';
import { Shield } from 'lucide-react';
import { isSameRFIDUid } from '../utils/rfid';

interface Props {
  scans: RFIDScan[];
  binding: RFIDBinding | null;
}

export default function RFIDLog({ scans, binding }: Props) {
  if (scans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-300">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
          <Shield className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-400 text-sm font-medium">尚無掃描紀錄</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-4">
        最近 {scans.length} 筆紀錄
      </p>
      {scans.map((scan) => {
        const isBoundCard = binding ? isSameRFIDUid(scan.uid, binding.uid) : false;

        return (
          <div
            key={scan.id}
            className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-900 font-bold text-sm tracking-widest">
                {scan.uid}
              </span>
              <span
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: isBoundCard ? '#16a34a' : '#1937E6' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ backgroundColor: isBoundCard ? '#16a34a' : '#1937E6' }}
                />
                {isBoundCard ? '綁定卡片' : '已記錄'}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span className="bg-gray-100 px-2 py-0.5 rounded-full">{scan.type}</span>
              <span>{new Date(scan.timestamp).toLocaleString()}</span>
            </div>
            <div className="text-xs text-gray-400">裝置：{scan.deviceId}</div>
            {isBoundCard && binding?.name && (
              <div className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-2 py-1 inline-block">
                名稱：{binding.name}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
