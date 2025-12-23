import React, { useMemo } from 'react';
import { Order, MemberInfo } from '../../types';
import { classifyHairstyle } from '../../utils/helpers';
import { X, Scissors, UserX } from 'lucide-react';

interface LostAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'onetime' | 'churn';
  allData: Order[];
  memberInfo: Record<string, MemberInfo>;
}

export default function LostAnalysisModal({ isOpen, onClose, type, allData, memberInfo }: LostAnalysisModalProps) {
  if (!isOpen) return null;

  const analysis = useMemo(() => {
    if (!allData.length) return null;

    const latestTimestamp = Math.max(...allData.map(o => o.timestamp));
    const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;
    const thresholdTime = latestTimestamp - TWO_MONTHS_MS;

    const targetMemberIds = new Set<string>();
    
    Object.keys(memberInfo).forEach(mId => {
        const info = memberInfo[mId];
        if (type === 'onetime') {
            // Logic: First Time < Threshold AND Is True New AND Total Visits == 1
            if (info.firstTime < thresholdTime && info.isTrueNew && info.totalVisits === 1) {
                targetMemberIds.add(mId);
            }
        } else {
            // Logic: Last Time < Threshold (General Lost)
            if (info.lastTime < thresholdTime) {
                targetMemberIds.add(mId);
            }
        }
    });

    if (targetMemberIds.size === 0) return null;

    // Aggregate based on LAST VISIT
    const relevantOrders = allData.filter(o => targetMemberIds.has(o.memberId));
    const lastOrdersMap: Record<string, Order> = {};
    
    relevantOrders.forEach(o => {
        if (!lastOrdersMap[o.memberId] || o.timestamp > lastOrdersMap[o.memberId].timestamp) {
            lastOrdersMap[o.memberId] = o;
        }
    });
    
    const lastOrders = Object.values(lastOrdersMap);
    const totalCount = lastOrders.length;

    const hairstyleCounts = { top: {} as Record<string, number>, side: {} as Record<string, number> };
    const barberCounts: Record<string, Record<string, number>> = {}; // { Store: { Barber: count } }

    lastOrders.forEach(o => {
        const style = classifyHairstyle(o.hairStyle);
        hairstyleCounts.top[style.top] = (hairstyleCounts.top[style.top] || 0) + 1;
        hairstyleCounts.side[style.side] = (hairstyleCounts.side[style.side] || 0) + 1;

        const store = o.store || '未標註';
        const barber = o.barber || '未標註';
        if (!barberCounts[store]) barberCounts[store] = {};
        barberCounts[store][barber] = (barberCounts[store][barber] || 0) + 1;
    });

    return { totalCount, hairstyleCounts, barberCounts };
  }, [allData, memberInfo, type]);

  const renderTop3 = (countsObj: Record<string, number>, total: number, colorClass: string) => {
      const sorted = Object.keys(countsObj).sort((a,b) => countsObj[b] - countsObj[a]).slice(0, 3);
      if (sorted.length === 0) return <span className="text-xs text-slate-400">無數據</span>;

      return sorted.map((k, idx) => {
          const val = countsObj[k];
          const pct = (val / total * 100).toFixed(1);
          const rankClass = idx === 0 ? `font-bold ${colorClass}` : (idx === 1 ? 'text-slate-700' : 'text-slate-500');
          const barColor = idx === 0 ? (colorClass.includes('rose') ? 'bg-rose-500' : 'bg-amber-500') : 'bg-slate-300';
          
          return (
            <div key={k} className="mb-2">
                <div className="flex justify-between items-center text-xs mb-1">
                    <span className={rankClass}>{idx+1}. {k}</span>
                    <span className="font-bold text-slate-600">{pct}% ({val}人)</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div className={`${barColor} h-1.5 rounded-full`} style={{ width: `${pct}%` }}></div>
                </div>
            </div>
          );
      });
  };

  const title = type === 'onetime' ? '新客一次性流失分析 (One-Time Drop-off)' : '流失客群分析 (General Churn)';
  const subtitle = type === 'onetime' ? '針對「第一次來店後，超過2個月未回訪」的客戶進行最後消費分析' : '針對「超過2個月未回訪」的所有客戶進行最後消費分析';
  const themeColor = type === 'onetime' ? 'rose' : 'amber';
  const themeText = type === 'onetime' ? 'text-rose-800' : 'text-amber-800';
  const themeSub = type === 'onetime' ? 'text-rose-500' : 'text-amber-500';
  const themeBg = type === 'onetime' ? 'bg-rose-50/50' : 'bg-amber-50/50';
  const highlightText = type === 'onetime' ? 'text-rose-600' : 'text-amber-600';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden relative transition-all duration-300 flex flex-col max-h-[90vh]">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition z-10">
                <X size={24} />
            </button>
            <div className={`p-6 border-b border-slate-50 ${themeBg}`}>
                <h3 className={`text-lg font-bold ${themeText}`}>{title}</h3>
                <p className={`text-xs ${themeSub} mt-1`}>{subtitle}</p>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 bg-white">
                {!analysis ? (
                    <div className="text-center text-slate-400 py-10">目前沒有符合此條件的流失數據可供分析。</div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Hairstyle Analysis */}
                        <div className="space-y-6">
                            <div className="flex items-center space-x-2 border-b-2 border-slate-100 pb-3 mb-4">
                                <Scissors className="text-slate-400" size={18} />
                                <h4 className="font-bold text-slate-700">流失前最後髮型偏好 (TOP 3)</h4>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">頂部造型 (Top)</p>
                                    <div className="space-y-3">
                                        {renderTop3(analysis.hairstyleCounts.top, analysis.totalCount, highlightText)}
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">側邊造型 (Side)</p>
                                    <div className="space-y-3">
                                        {renderTop3(analysis.hairstyleCounts.side, analysis.totalCount, highlightText)}
                                    </div>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">* 統計流失客「最後一次」消費時的髮型選擇。</p>
                        </div>

                        {/* Barber Analysis */}
                        <div className="space-y-6">
                             <div className="flex items-center space-x-2 border-b-2 border-slate-100 pb-3 mb-4">
                                <UserX className="text-slate-400" size={18} />
                                <h4 className="font-bold text-slate-700">各店流失經手排行 (TOP 3)</h4>
                            </div>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                {Object.keys(analysis.barberCounts).sort().map(store => {
                                    const bCounts = analysis.barberCounts[store];
                                    const sortedBarbers = Object.keys(bCounts).sort((a,b) => bCounts[b] - bCounts[a]).slice(0, 3);
                                    
                                    return (
                                        <div key={store} className="border border-slate-100 rounded-xl p-4 hover:shadow-sm transition">
                                            <h5 className="text-xs font-bold text-[#244c5a] uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">{store}</h5>
                                            <div className="space-y-1">
                                                {sortedBarbers.length > 0 ? sortedBarbers.map((b, idx) => {
                                                    const count = bCounts[b];
                                                    const rankColor = idx === 0 ? (type === 'onetime' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700') : 'bg-slate-100 text-slate-600';
                                                    return (
                                                        <div key={b} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-5 h-5 rounded-full ${rankColor} flex items-center justify-center text-[10px] font-bold`}>{idx+1}</span>
                                                                <span className="text-slate-700 font-medium">{b}</span>
                                                            </div>
                                                            <span className="font-bold text-slate-500">{count} 人</span>
                                                        </div>
                                                    );
                                                }) : <span className="text-xs text-slate-400">無數據</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">* 統計流失客「最後一次」服務的理髮師 (經手人)。</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}