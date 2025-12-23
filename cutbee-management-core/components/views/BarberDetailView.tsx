import React, { useState, useMemo } from 'react';
    import { Metrics, GlobalLookup, Order } from '../../types';
    import { classifyHairstyle, getNextMonth } from '../../utils/helpers';
    import { Radar, Line } from 'react-chartjs-2';
    import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
    import { ArrowLeft, RefreshCw, ArrowDown } from 'lucide-react';

    ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

    interface BarberDetailViewProps {
      metrics: Metrics;
      selectedBarber: string;
      onBack?: () => void;
      lookup: GlobalLookup;
      allData: Order[];
      onOpenHairstyleModal: (barberName: string, type: 'iron' | 'easy' | 'lost', stats: any) => void;
    }

    export default function BarberDetailView({ metrics, selectedBarber, onBack, lookup, allData, onOpenHairstyleModal }: BarberDetailViewProps) {
      const [currentBarberName, setCurrentBarberName] = useState(selectedBarber);
      const [compareName, setCompareName] = useState("");

      const barberStats = metrics.barberStats[currentBarberName];
      const compareStats = compareName ? metrics.barberStats[compareName] : null;
      const globalAvg = metrics.globalAvg;

      const barbers = useMemo(() => Object.keys(metrics.barberStats).sort(), [metrics]);

      if (!barberStats) return <div className="p-10 text-center">請選擇一位理髮師</div>;

      // Radar Data
      const radarData = useMemo(() => {
          const s = barberStats;
          const g = globalAvg;
          const getRadarData = (stats: any) => {
             const sCombat = (stats.avgDailyProd / (g.combat || 1)) * 50; 
             const sEff = (g.efficiency / (stats.avgDuration || 1)) * 50; 
             return [stats.retention, sCombat, sEff, stats.totalDesignationRate, stats.kpiDesSameTotalPct];
          };
          
          const data1 = getRadarData(s);
          let data2, label2, color2, dash2, fill2;

          if (compareStats) {
              data2 = getRadarData(compareStats);
              label2 = compareStats.name;
              color2 = '#f59e0b';
              dash2 = [];
              fill2 = true;
          } else {
              data2 = [g.retention, 50, 50, g.totalDes, 20];
              label2 = '全店平均';
              color2 = '#94a3b8';
              dash2 = [5, 5];
              fill2 = false;
          }

          return {
            labels: ['回訪率', '戰力 (日產能)', '效率 (速度)', '總指定率', '回訪指定 (鐵粉)'],
            datasets: [
                {
                    label: s.name,
                    data: data1,
                    borderColor: '#244c5a',
                    backgroundColor: 'rgba(36, 76, 90, 0.1)',
                    borderWidth: 3,
                    pointRadius: 0,
                    pointBackgroundColor: '#244c5a'
                },
                {
                    label: label2,
                    data: data2,
                    borderColor: color2,
                    backgroundColor: compareStats ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                    borderWidth: 2,
                    borderDash: dash2,
                    fill: fill2,
                    pointRadius: 0
                }
            ]
          };
      }, [barberStats, compareStats, globalAvg]);

      // Trend Chart Data
      const trendData = useMemo(() => {
        const sortedM = barberStats.months;
        const trendRet: number[] = [];
        const trendDes: number[] = [];
        const trendLost: (number|null)[] = [];
        const trendTotalDes: number[] = [];
        
        const allAvailableMonths = Object.keys(lookup.monthlyOrders).sort();
        const lastGlobalMonth = allAvailableMonths[allAvailableMonths.length - 1];

        sortedM.forEach(m => {
            if (m === metrics.months[metrics.months.length-1]) return;
            const monthlyOrders = barberStats.data.filter(o => o.month === m);
            const usersInMonth = new Set(monthlyOrders.filter(o => o.memberId !== '訪客').map(o => o.memberId));
            
            let retCount = 0, desCount = 0, lostCount = 0;
            let monthDesCount = 0;
            monthlyOrders.forEach(o => {
                if (o.designatedBarber && o.designatedBarber !== '') monthDesCount++;
            });
            trendTotalDes.push(monthDesCount);

            const nextM = getNextMonth(m);
            const nextNextM = getNextMonth(nextM);
            const usersInNextM1 = lookup.monthlyMembers[nextM];
            const usersInNextM2 = lookup.monthlyMembers[nextNextM];
            const ordersInNextM1 = lookup.monthlyOrders[nextM] || [];

            const hasDataForM2 = (nextNextM <= lastGlobalMonth);

            if (usersInMonth.size > 0) {
                usersInMonth.forEach(uId => {
                    if (usersInNextM1 && usersInNextM1.has(uId)) {
                        retCount++;
                        if (ordersInNextM1.filter(o=>o.memberId===uId).some(o => o.designatedBarber === currentBarberName)) desCount++;
                    }
                    if ((!usersInNextM1 || !usersInNextM1.has(uId)) && (!usersInNextM2 || !usersInNextM2.has(uId))) {
                        lostCount++;
                    }
                });
                trendRet.push(retCount/usersInMonth.size*100);
                trendDes.push(desCount/usersInMonth.size*100);
                
                if (hasDataForM2) {
                    trendLost.push(lostCount/usersInMonth.size*100);
                } else {
                    trendLost.push(null);
                }
            } else {
                trendRet.push(0); trendDes.push(0);
                if (hasDataForM2) trendLost.push(0); else trendLost.push(null);
            }
        });

        return {
            labels: sortedM.slice(0, trendRet.length),
            datasets: [
                { label: '總指定數 (含訪客)', data: trendTotalDes, borderColor: '#FFcd00', tension: 0.4, borderWidth: 3, pointRadius: 0, yAxisID: 'y1' },
                { label: '總回訪率', data: trendRet, borderColor: '#101820', tension: 0.4, borderWidth: 2, pointRadius: 0, yAxisID: 'y' },
                { label: '指定回訪率 (鐵粉)', data: trendDes, borderColor: '#d97706', tension: 0.4, borderWidth: 2, borderDash: [5, 5], pointRadius: 0, yAxisID: 'y' },
                { label: '流失率 (2個月沒回)', data: trendLost, borderColor: '#7daebf', tension: 0.4, borderWidth: 2, pointRadius: 0, borderDash: [5, 5], spanGaps: false, yAxisID: 'y' }
            ]
        };
      }, [barberStats, lookup, metrics.months, currentBarberName]);

      const analyzeBucket = (hairStyles: string[]) => {
          const topC: Record<string, number> = {}, sideC: Record<string, number> = {}; 
          hairStyles.forEach(h => { 
              const r = classifyHairstyle(h); 
              topC[r.top] = (topC[r.top] || 0) + 1; 
              sideC[r.side] = (sideC[r.side] || 0) + 1; 
          });
          const findMax = (obj: Record<string, number>) => { 
              let maxK = '無數據', maxV = 0; 
              for (let k in obj) { if (obj[k] > maxV) { maxV = obj[k]; maxK = k; } } 
              return { key: maxK, pct: hairStyles.length ? (maxV / hairStyles.length * 100) : 0 }; 
          };
          return { topStats: topC, sideStats: sideC, topMax: findMax(topC), sideMax: findMax(sideC), total: hairStyles.length };
      };

      const ironStats = analyzeBucket(barberStats.buckets.iron);
      const easyStats = analyzeBucket(barberStats.buckets.easy);
      const lostStats = analyzeBucket(barberStats.buckets.lost);

      const kpis = [
          { typeKey: 'iron', label: '回訪後指定 (鐵粉)', pct: barberStats.kpiDesSameTotalPct, desc: '指定回訪人次 / 總服務客數', type: 'good', color: 'text-emerald-600', border: 'border-emerald-500', stats: ironStats },
          { typeKey: 'easy', label: '回訪後不指定 (隨和)', pct: barberStats.kpiRetainedOtherTotalPct, desc: '隨和回訪人次 / 總服務客數', type: 'neutral', color: 'text-amber-500', border: 'border-amber-400', stats: easyStats },
          { typeKey: 'lost', label: '沒有回訪 (流失)', pct: barberStats.kpiLostTotalPct, desc: '未回訪人次 / 總服務客數', type: 'bad', color: 'text-rose-500', border: 'border-rose-400', stats: lostStats }
      ];
      const maxPct = Math.max(...kpis.map(k => k.pct));

      // Productivity Logic
      const productivityRows = useMemo(() => {
         const rows: any[] = [];
         barberStats.months.forEach(m => {
            const monthlyOrders = barberStats.data.filter(o => o.month === m);
            const distinctDays = new Set(monthlyOrders.map(o => o.date)).size;
            const served = monthlyOrders.filter(o => o.memberId !== '訪客').length; 
            if (distinctDays > 0) {
                rows.push({ month: m, days: distinctDays, total: monthlyOrders.length, prod: (monthlyOrders.length / distinctDays).toFixed(1) });
            }
         });
         return rows.reverse();
      }, [barberStats]);

      return (
        <div className="space-y-10 animate-fade">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                 <div className="lg:col-span-1 space-y-6">
                    <div className="clean-card p-10 bg-slate-50 border-none shadow-inner">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">深度剖析對象</p>
                        <select 
                            value={currentBarberName} 
                            onChange={(e) => setCurrentBarberName(e.target.value)} 
                            className="w-full text-lg font-bold bg-white border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-slate-800 focus:ring-2 focus:ring-[#244c5a] outline-none cursor-pointer shadow-sm transition hover:border-[#244c5a]/50 mb-2"
                        >
                            {barbers.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <span className="inline-block px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded uppercase">{barberStats.store}</span>
                        <div className="mt-6 mb-8 p-4 bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                            <div>
                                <span className="text-[9px] font-bold uppercase text-slate-500 tracking-widest block mb-1">有效會員訂單佔比</span>
                                <span className="text-xs text-slate-400 font-medium">Core Member Rate</span>
                            </div>
                            <span className="text-2xl font-bold text-[#244c5a]">
                                {(barberStats.totalOrders > 0 ? (barberStats.totalServed / barberStats.totalOrders * 100) : 0).toFixed(1)}%
                            </span>
                        </div>
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                                 <div>
                                     <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">戰力 (日產能)</p>
                                     <p className={`text-2xl font-bold tracking-tighter ${barberStats.avgDailyProd > globalAvg.combat ? 'text-emerald-600' : 'text-slate-800'}`}>{barberStats.avgDailyProd.toFixed(1)}</p>
                                 </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">平均回訪率 (1M)</p>
                                    <p className={`text-2xl font-bold tracking-tighter ${barberStats.retention > globalAvg.retention ? 'text-emerald-600' : 'text-slate-800'}`}>{barberStats.retention.toFixed(1)}%</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">效率 (分/單)</p>
                                    <p className={`text-2xl font-bold tracking-tighter ${barberStats.avgDuration < globalAvg.efficiency ? 'text-emerald-600' : 'text-slate-800'}`}>{barberStats.avgDuration}</p>
                                </div>
                                 <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">總指定率</p>
                                    <p className={`text-2xl font-bold tracking-tighter ${barberStats.totalDesignationRate > globalAvg.totalDes ? 'text-emerald-600' : 'text-slate-800'}`}>{barberStats.totalDesignationRate.toFixed(1)}%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
                 <div className="lg:col-span-2 space-y-6">
                    <div className="clean-card p-4 bg-white h-[500px] flex flex-col">
                        <div className="flex justify-between items-start mb-4 px-4 pt-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">綜合戰力雷達 (PK 模式)</h4>
                            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
                                <span className="text-[9px] font-bold text-slate-400 uppercase px-2">Compare:</span>
                                <select 
                                    value={compareName}
                                    onChange={(e) => setCompareName(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-slate-700 outline-none w-32 cursor-pointer"
                                >
                                    <option value="">- 無 (比較平均) -</option>
                                    {barbers.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                                <button onClick={() => setCompareName("")} className="text-[9px] font-bold text-slate-400 hover:text-[#244c5a] px-2 py-1 rounded hover:bg-white transition">
                                    <RefreshCw size={12}/>
                                </button>
                            </div>
                        </div>
                        <div className="flex-grow flex items-center justify-center relative w-full h-full">
                            <Radar data={radarData} options={{ responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100, ticks: { display: false, stepSize: 20 }, pointLabels: { font: { size: 11, weight: 'bold' } } } }, plugins: { legend: { position: 'bottom' }, datalabels: { display: false } } }} />
                        </div>
                    </div>
                 </div>
             </div>

             <div>
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">客群結構深度分析 (點擊卡片查看偏好)</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {kpis.map((k, i) => (
                        <div 
                            key={i} 
                            onClick={() => onOpenHairstyleModal(currentBarberName, k.typeKey as any, k.stats)}
                            className={`clean-card px-6 py-4 border-t-4 ${k.border} border-l border-r border-b transition duration-300 hover:shadow-lg cursor-pointer ${k.pct === maxPct ? 'opacity-100 bg-white shadow-md -translate-y-[2px]' : 'opacity-60 bg-slate-50 grayscale-[80%] hover:grayscale-0 hover:opacity-100 hover:bg-white'} flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4`}
                        >
                            <div className="flex-1 w-full">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{k.label}</p>
                                <div className="flex items-baseline gap-3">
                                    <span className={`text-3xl font-bold ${k.color}`}>{k.pct.toFixed(1)}%</span>
                                    <span className="text-[10px] font-medium text-slate-400 hidden lg:inline-block">{k.desc}</span>
                                </div>
                            </div>
                            <div className="w-full xl:w-auto xl:border-l xl:border-slate-100 xl:pl-4 xl:ml-2">
                                <div className="mt-0 pl-6 border-l border-slate-100 ml-4 flex flex-col justify-center gap-1 w-40">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase w-8">TOP</span>
                                        <div className="flex-1 text-right">
                                            <span className="text-xs font-bold text-slate-700 truncate block">{k.stats.topMax.key}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase w-8">SIDE</span>
                                        <div className="flex-1 text-right">
                                            <span className="text-xs font-bold text-slate-700 truncate block">{k.stats.sideMax.key}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
             </div>

             <div className="clean-card p-8 bg-white h-[400px]">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">個人回訪與指定趨勢 (次月) 與 流失趨勢 (2個月)</h4>
                <div className="h-[320px] w-full">
                    <Line data={trendData} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 }, y1: { type: 'linear', display: false, position: 'right', beginAtZero: true }, x: { grid: { display: false } } }, plugins: { legend: { position: 'top', align: 'end' }, datalabels: { display: false } } }} />
                </div>
            </div>

            <div className="clean-card overflow-hidden">
                <details className="group">
                    <summary className="flex justify-between items-center font-bold cursor-pointer list-none px-8 py-5 bg-slate-50/50 hover:bg-slate-50 transition">
                        <span className="text-sm text-slate-700">每月平均每日產能報告</span>
                        <ArrowDown size={16} className="text-slate-400 transition group-open:rotate-180" />
                    </summary>
                    <div className="text-slate-500 group-open:animate-fade px-8 pb-8 pt-4">
                        <div className="overflow-x-auto">
                            <table className="clean-table">
                                <thead><tr><th>月份</th><th className="text-center">出勤天數</th><th className="text-center">總服務人數</th><th className="text-center">平均每日產能</th></tr></thead>
                                <tbody>
                                    {productivityRows.map((r: any) => (
                                        <tr key={r.month}>
                                            <td>{r.month}</td>
                                            <td className="text-center">{r.days}</td>
                                            <td className="text-center">{r.total}</td>
                                            <td className="text-center font-bold text-slate-700">{r.prod}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </details>
            </div>
        </div>
      );
    }