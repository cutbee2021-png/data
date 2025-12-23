import React, { useMemo } from 'react';
    import { Metrics, Order, GlobalLookup } from '../../types';
    import { calculateMetrics } from '../../utils/helpers';
    import { ArrowUp, ArrowDown } from 'lucide-react';

    interface StoreViewProps {
      metrics: Metrics;
      allData: Order[];
      lookup: GlobalLookup;
    }

    export default function StoreView({ metrics, allData, lookup }: StoreViewProps) {
      const storeList = useMemo(() => ['品牌核心總部 (ALL)', ...new Set(allData.map(o => o.store))].sort(), [allData]);

      const storeRows = useMemo(() => {
        return storeList.map(s => {
          let displayName = s;
          let isTotal = false;
          if (s === '品牌核心總部 (ALL)') { displayName = '全品牌'; isTotal = true; }
          
          const subData = isTotal ? allData : allData.filter(o => o.store === s);
          const sMetrics = calculateMetrics(subData, lookup);
          
          const totalOrders = subData.length;
          const memberOrders = subData.filter(o => o.memberId !== '訪客').length;
          const memberRate = totalOrders ? (memberOrders / totalOrders * 100) : 0;
          
          const validMonthlyRates = Object.values(sMetrics.stats).map(m => m.retention).filter(r => r !== null) as number[];
          const avgRet = validMonthlyRates.length ? (validMonthlyRates.reduce((a, b) => a + b, 0) / validMonthlyRates.length) : 0;
          
          let changeRate = 0;
          const sortedMonths = sMetrics.months;
          for (let i = 1; i < sortedMonths.length - 1; i++) {
              const prev = sMetrics.stats[sortedMonths[i-1]].retention;
              const curr = sMetrics.stats[sortedMonths[i]].retention;
              if (prev !== null && curr !== null) changeRate += (curr - prev);
          }
          
          return { name: displayName, totalOrders, memberRate, avgRet, changeRate, isTotal };
        });
      }, [storeList, allData, lookup]);

      const monthsReversed = useMemo(() => [...metrics.months].reverse(), [metrics]);

      return (
        <div className="space-y-10 animate-fade">
          <div className="clean-card overflow-hidden shadow-sm">
              <div className="px-8 py-5 border-b border-slate-50 bg-slate-50/30">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">各分店經營數據彙報</h3>
              </div>
              <div className="overflow-x-auto">
                  <table className="clean-table">
                      <thead>
                          <tr>
                              <th>據點名稱</th>
                              <th>總客數</th>
                              <th>會員佔比</th>
                              <th>平均回訪率 (次月)</th>
                              <th>變化趨勢 (累加)</th>
                          </tr>
                      </thead>
                      <tbody>
                        {storeRows.map((r, i) => (
                          <tr key={i} className={r.isTotal ? 'bg-slate-50 border-b-2 border-slate-100' : ''}>
                            <td className={r.isTotal ? "brand-badge inline-block mt-2 ml-2" : "font-medium"}>{r.name}</td>
                            <td className="font-bold">{r.totalOrders.toLocaleString()}</td>
                            <td className="font-bold text-slate-600">{r.memberRate.toFixed(1)}%</td>
                            <td>
                              {r.isTotal ? (
                                <span className="font-bold text-slate-800">{r.avgRet.toFixed(1)}%</span>
                              ) : (
                                <span className={`px-2 py-1 rounded-md font-bold text-xs ${r.avgRet >= 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>{r.avgRet.toFixed(1)}%</span>
                              )}
                            </td>
                            <td className={`font-bold text-xs ${r.changeRate >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              <div className="flex items-center">
                                {r.changeRate >= 0 ? <ArrowUp size={12} className="mr-1"/> : <ArrowDown size={12} className="mr-1"/>}
                                {Math.abs(r.changeRate).toFixed(1)}%
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                  </table>
              </div>
          </div>

          <div className="clean-card overflow-hidden shadow-sm">
              <div className="px-8 py-5 border-b border-slate-50 bg-slate-50/30">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">月度客群結構報告 (全品牌)</h3>
              </div>
              <div className="overflow-x-auto">
                  <table className="clean-table compact min-w-[1000px]">
                      <thead>
                          <tr>
                              <th className="w-24">數據月份</th>
                              <th className="w-20">服務件數</th>
                              <th className="w-20">會員數</th>
                              <th className="w-20">新客數</th>
                              <th className="w-32">新客率 (MoM)</th>
                              <th className="w-20 text-rose-600">一次客</th>
                              <th className="w-20">舊客數</th>
                              <th className="w-32">回訪率 (次月)</th>
                              <th className="w-32 text-rose-600">流失率 (2個月)</th>
                          </tr>
                      </thead>
                      <tbody>
                        {monthsReversed.map((m, idx) => {
                          const s = metrics.stats[m];
                          if ((s.retention === 0 || s.retention === null) && idx !== 0) return null;
                          const prevM = metrics.months[metrics.months.indexOf(m) - 1];
                          const prevS = prevM ? metrics.stats[prevM] : null;

                          const getTrend = (curr: number, prev: number | undefined | null) => {
                            if (prev === undefined || prev === null) return null;
                            const diff = curr - prev;
                            if (Math.abs(diff) < 0.1) return null;
                            const isUp = diff > 0;
                            return (
                              <span className={`trend-label ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                 {isUp ? <ArrowUp size={10} className="mr-1" /> : <ArrowDown size={10} className="mr-1" />}
                                 {Math.abs(diff).toFixed(1)}%
                              </span>
                            );
                          };

                          return (
                            <tr key={m}>
                              <td className="font-bold text-slate-800">{m}</td>
                              <td className="font-medium">{s.total}</td>
                              <td className="font-bold text-slate-700">{s.unique}</td>
                              <td className="text-[#244c5a] font-medium">{s.newCount}</td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <span>{s.newRate.toFixed(1)}%</span>
                                  {prevS && getTrend(s.newRate, prevS.newRate)}
                                </div>
                              </td>
                              <td>
                                {s.oneTimeCount !== null ? (
                                  <div className="flex flex-col">
                                    <span className="font-bold text-rose-600">{s.oneTimeCount}</span>
                                    <span className="text-[10px] text-rose-400">({s.newCount > 0 ? (s.oneTimeCount / s.newCount * 100).toFixed(0) : 0}%)</span>
                                  </div>
                                ) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="text-slate-400 font-medium">{s.oldCount}</td>
                              <td className="font-bold text-slate-900">
                                 <div className="flex items-center gap-2">
                                   <span>{s.retention !== null ? s.retention.toFixed(1) + '%' : <span className="text-slate-300">N/A</span>}</span>
                                   {s.retention !== null && prevS && getTrend(s.retention, prevS.retention)}
                                 </div>
                              </td>
                              <td className="font-bold text-rose-600">
                                <span>{s.churnRate !== null ? s.churnRate.toFixed(1) + '%' : <span className="text-slate-300">N/A</span>}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                  </table>
              </div>
          </div>
        </div>
      );
    }