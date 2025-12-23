import React from 'react';
import { X } from 'lucide-react';

interface HairstyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  barberName: string;
  stats: {
      topStats: Record<string, number>;
      sideStats: Record<string, number>;
      total: number;
  } | null;
}

export default function HairstyleModal({ isOpen, onClose, barberName, stats }: HairstyleModalProps) {
  if (!isOpen || !stats) return null;

  const renderList = (obj: Record<string, number>) => {
      const sorted = Object.entries(obj).sort((a, b) => b[1] - a[1]);
      return sorted.map(([k, v]) => {
          const pct = (v / stats.total * 100).toFixed(1);
          return (
              <div key={k} className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700">{k}</span>
                      <span className="text-slate-500">{v} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full">
                      <div className="bg-slate-400 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
              </div>
          );
      });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden relative transition-all duration-300">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition z-10">
                <X size={24} />
            </button>
            <div className="p-6 border-b border-slate-50">
                <h3 className="text-lg font-bold text-slate-800">客群髮型偏好分析</h3>
                <p className="text-xs text-slate-500 mt-1">分析對象: {barberName}</p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">偏好頂部造型 (Top)</h4>
                        <div className="space-y-3">
                            {renderList(stats.topStats)}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">偏好側邊造型 (Side)</h4>
                        <div className="space-y-3">
                            {renderList(stats.sideStats)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}