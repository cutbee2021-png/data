import React from 'react';
import { CloudUpload } from 'lucide-react';

export default function EmptyState() {
  return (
    <div id="empty-state" className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 animate-fade">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-2">
        <CloudUpload className="text-2xl text-slate-300 w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-700">尚未匯入數據</h2>
      <p className="text-sm text-slate-400">請點擊右上角「匯入報表」上傳交易 CSV 檔案以開始分析</p>
    </div>
  );
}