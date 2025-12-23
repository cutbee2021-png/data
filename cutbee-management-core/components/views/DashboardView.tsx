import React, { useMemo, useState } from 'react';
import { Metrics, MemberInfo, Order, GlobalLookup } from '../../types';
import { calculateMetrics } from '../../utils/helpers';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, BarController, LineController } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Hand, ArrowUp, ArrowDown, Minus } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, BarController, LineController, ChartDataLabels);

interface DashboardViewProps {
  data: Order[];
  metrics: Metrics;
  lookup: GlobalLookup;
  memberInfo: Record<string, MemberInfo>;
  onOpenLostAnalysis: (type: 'onetime' | 'churn') => void;
  allData: Order[];
}

export default function DashboardView({ data, metrics, lookup, memberInfo, onOpenLostAnalysis, allData }: DashboardViewProps) {
  const [chartStoreFilter, setChartStoreFilter] = useState('all');
  const [currentMetric, setCurrentMetric] = useState<'count' | 'newAnalysis' | 'retentionAnalysis' | 'trendAnalysis'>('count');

  const latestTimestamp = useMemo(() => Math.max(...allData.map(o => o.timestamp)), [allData]);
  const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;
  // Threshold: Customers whose first visit was before this date are "mature" enough to be counted in drop-off stats
  const thresholdTime = latestTimestamp - TWO_MONTHS_MS;
  const stores = useMemo(() => [...new Set(allData.map(o => o.store))].sort(), [allData]);

  // Global KPIs
  const globalMemberRate = useMemo(() => {
    const total = allData.length;
    const members = allData.filter(o => o.memberId !== '訪客').length;
    return total ? (members / total * 100) : 0;
  }, [allData]);

  const globalTrendSum = useMemo(() => {
    let sum = 0;
    const months = metrics.months;
    for (let i = 1; i < months.length - 1; i++) {
        const prev = metrics.stats[months[i-1]].retention;
        const curr = metrics.stats[months[i]].retention;
        if (prev !== null && curr !== null) sum += (curr - prev);
    }
    return sum;
  }, [metrics]);

  const { oneTimeRate, isOneTimeValid } = useMemo(() => {
      let num = 0, denom = 0;
      Object.values(memberInfo).forEach(info => {
          // Condition 1: Must be True New Customer (matches System Count)
          // Condition 2: Must be Mature (First visit > 2 months ago)
          if (info.isTrueNew && info.firstTime < thresholdTime) {
              denom++;
              // Condition 3: Total Visits (Haircut Count) == 1
              // Since isTrueNew is true, transaction total visits == system total count.
              if (info.totalVisits === 1) {
                  num++;
              }
          }
      });
      return { 
          oneTimeRate: denom ? (num / denom * 100) : 0,
          isOneTimeValid: denom > 0
      };
  }, [memberInfo, thresholdTime]);

  const avgLostVisits = useMemo(() => {
      let sum = 0, count = 0;
      Object.values(memberInfo).forEach(info => {
          // Logic: Last visit was > 2 months ago (Churned)
          if (info.lastTime < thresholdTime) {
              count++;
              sum += info.totalVisits;
          }
      });
      return count ? (sum / count) : 0;
  }, [memberInfo, thresholdTime]);

  // Store Sub-rows Calculations
  const storeStats = useMemo(() => {
      return stores.map(s => {
          // 1. Member Rate
          const sData = allData.filter(o => o.store === s);
          const sTotal = sData.length;
          const sMem = sData.filter(o => o.memberId !== '訪客').length;
          const sRate = sTotal ? (sMem / sTotal * 100) : 0;

          // 2. Trend (Cumulative)
          const sMetrics = calculateMetrics(sData, lookup);
          let sTrend = 0;
          const sMonths = sMetrics.months;
          for (let i = 1; i < sMonths.length - 1; i++) {
              const prev = sMetrics.stats[sMonths[i-1]].retention;
              const curr = sMetrics.stats[sMonths[i]].retention;
              if (prev !== null && curr !== null) {
                  sTrend += (curr - prev);
              }
          }
          
          // 3. One Time & Lost Visits
          let sOneTimeNum = 0, sOneTimeDenom = 0;
          let sLostVisitSum = 0, sLostCount = 0;

          Object.values(memberInfo).forEach(info => {
              // Apply same strict logic per store (based on First Store)
              if (info.firstStore === s && info.isTrueNew && info.firstTime < thresholdTime) {
                  sOneTimeDenom++;
                  if (info.totalVisits === 1) sOneTimeNum++;
              }
              if (info.lastStore === s && info.lastTime < thresholdTime) {
                  sLostCount++;
                  sLostVisitSum += info.totalVisits;
              }
          });

          return {
              name: s,
              memberRate: sRate,
              oneTimeRate: sOneTimeDenom ? (sOneTimeNum / sOneTimeDenom * 100) : 0,
              isOneTimeValid: sOneTimeDenom > 0,
              avgLostVisits: sLostCount ? (sLostVisitSum / sLostCount) : 0,
              trendSum: sTrend
          };
      });
  }, [allData, memberInfo, stores, thresholdTime, lookup]);

  // Chart Data
  const chartData = useMemo(() => {
      const months = metrics.months;
      const d = metrics.stats; 
      
      const datasets = [];
      if (currentMetric === 'count') {
          datasets.push({
              type: 'line' as const,
              label: '服務件數',
              data: months.map(m => d[m].total),
              borderColor: '#244c5a',
              backgroundColor: 'rgba(36, 76, 90, 0.1)',
              borderWidth: 2,
              tension: 0.3,
              fill: 'origin',
              pointRadius: 4,
              pointBackgroundColor: '#fff',
              pointBorderColor: '#244c5a',
              spanGaps: false
          });
      } else if (currentMetric === 'newAnalysis') {
          datasets.push({
              type: 'line' as const,
              label: '新客數',
              data: months.map(m => d[m].newCount),
              borderColor: '#f59e0b',
              backgroundColor: 'transparent',
              borderWidth: 2,
              tension: 0.3,
              pointRadius: 4,
              pointBackgroundColor: '#fff',
              pointBorderColor: '#f59e0b',
              spanGaps: false,
              datalabels: {
                  formatter: (value: any, context: any) => {
                      const m = months[context.dataIndex];
                      const rate = d[m].newRate;
                      return `${value}\n(${rate.toFixed(1)}%)`;
                  }
              }
          });
          datasets.push({
            type: 'line' as const,
            label: '一次客數 (只來一次)',
            data: months.map(m => d[m].oneTimeCount),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.3,
            fill: 'origin',
            pointRadius: 4,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#ef4444',
            spanGaps: false,
            datalabels: {
                formatter: (value: any, context: any) => {
                    const m = months[context.dataIndex];
                    if (d[m].oneTimeCount === null) return null;
                    const pct = d[m].newCount > 0 ? (d[m].oneTimeCount! / d[m].newCount * 100) : 0;
                    return typeof value === 'number' ? `${value}\n(${pct.toFixed(0)}%)` : value;
                }
            }
        });
      } else if (currentMetric === 'retentionAnalysis') {
          datasets.push({
              type: 'line' as const,
              label: '回訪率 (次月)',
              data: months.map(m => d[m].retention),
              borderColor: '#10b981',
              backgroundColor: 'transparent',
              borderWidth: 2,
              tension: 0.3,
              pointRadius: 4,
              pointBackgroundColor: '#fff',
              pointBorderColor: '#10b981',
              spanGaps: false
          });
          datasets.push({
              type: 'line' as const,
              label: '流失率 (2個月未回)',
              data: months.map(m => d[m].churnRate),
              borderColor: '#e11d48',
              backgroundColor: 'rgba(225, 29, 72, 0.05)',
              borderWidth: 2,
              borderDash: [5, 5],
              tension: 0.3,
              fill: 'origin',
              pointRadius: 4,
              pointBackgroundColor: '#fff',
              pointBorderColor: '#e11d48',
              spanGaps: false
          });
      } else if (currentMetric === 'trendAnalysis') {
          const changes: number[] = [];
          const cumulative: number[] = [];
          let runningTotal = 0;
          months.forEach((m, i) => {
              if (i === 0) { changes.push(0); cumulative.push(0); return; }
              const curr = d[m].retention;
              const prev = d[months[i-1]].retention;
              let diff = 0;
              if (curr !== null && prev !== null) { diff = curr - prev; }
              changes.push(diff);
              runningTotal += diff;
              cumulative.push(runningTotal);
          });
          datasets.push({
              type: 'bar' as const,
              label: '單月變化 (MoM)',
              data: changes,
              backgroundColor: changes.map(v => v >= 0 ? '#10b981' : '#f43f5e'),
              borderColor: changes.map(v => v >= 0 ? '#10b981' : '#f43f5e'),
              borderWidth: 1,
              barPercentage: 0.5,
              order: 2,
              datalabels: {
                  formatter: (value: any) => (value > 0 ? '+' : '') + Number(value).toFixed(1) + '%'
              }
          });
          datasets.push({
              type: 'line' as const,
              label: '累計趨勢',
              data: cumulative,
              borderColor: '#64748b',
              borderWidth: 2,
              borderDash: [5, 5],
              tension: 0.4,
              pointRadius: 0,
              fill: false,
              order: 1,
              datalabels: { display: false }
          });
      }

      return {
          labels: months,
          datasets: datasets
      };
  }, [metrics, currentMetric, chartStoreFilter, data]);

  return (
    <section className="space-y-8">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* KPI 1 */}
        <div className="clean-card p-8 bg-white border-l-4 border-l-[#244c5a] shadow-sm flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">數據有效率佔比 (會員佔比)</h3>
            <span className="text-[9px] font-bold bg-[#244c5a] text-white px-2 py-1 rounded">全品牌</span>
          </div>
          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-800">{globalMemberRate.toFixed(1)}%</span>
              <span className="text-xs text-slate-400">of Total Orders</span>
            </div>
          </div>
          <div className="mt-auto border-t border-slate-100 pt-4 space-y-1">
              {storeStats.map(s => (
                  <div key={s.name} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-none">
                      <span className="text-xs font-bold text-slate-600">{s.name}</span>
                      <span className="text-xs font-bold text-slate-800">{s.memberRate.toFixed(1)}%</span>
                  </div>
              ))}
          </div>
        </div>

        {/* KPI 2 - Trend Change (Updated) */}
        <div className="clean-card p-8 bg-white border-l-4 border-l-emerald-500 shadow-sm flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">變化趨勢 (累加)</h3>
            <span className="text-[9px] font-bold bg-emerald-500 text-white px-2 py-1 rounded">全品牌</span>
          </div>
          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${globalTrendSum >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {globalTrendSum > 0 ? '+' : ''}{globalTrendSum.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-400">Cumulative Retention Diff</span>
            </div>
          </div>
          <div className="mt-auto border-t border-slate-100 pt-4 space-y-1">
              {storeStats.map(s => (
                  <div key={s.name} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-none">
                      <span className="text-xs font-bold text-slate-600">{s.name}</span>
                      <span className={`text-xs font-bold flex items-center ${s.trendSum >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {s.trendSum >= 0 ? <ArrowUp size={10} className="mr-1"/> : <ArrowDown size={10} className="mr-1"/>}
                          {Math.abs(s.trendSum).toFixed(1)}%
                      </span>
                  </div>
              ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* KPI 3 */}
        <div onClick={() => onOpenLostAnalysis('onetime')} className="clean-card p-8 bg-white border-l-4 border-l-rose-500 shadow-sm flex flex-col h-full clickable-kpi group relative cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all">
          <div className="absolute top-4 right-4 text-slate-200 group-hover:text-rose-400 transition">
            <Hand className="animate-bounce w-5 h-5" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 group-hover:text-rose-600 transition uppercase tracking-widest">新客一次性流失率 (2個月未回)</h3>
            <span className="text-[9px] font-bold bg-rose-500 text-white px-2 py-1 rounded">全品牌</span>
          </div>
          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${isOneTimeValid ? 'text-slate-800 group-hover:text-rose-700' : 'text-slate-300'} transition`}>
                  {isOneTimeValid ? oneTimeRate.toFixed(1) + '%' : 'N/A'}
              </span>
              <span className="text-xs text-slate-400">One-Time Customer Rate</span>
            </div>
          </div>
          <div className="mt-auto border-t border-slate-100 pt-4 space-y-1">
              {storeStats.map(s => (
                  <div key={s.name} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-none">
                      <span className="text-xs font-bold text-slate-600">{s.name}</span>
                      <span className={`text-xs font-bold ${s.isOneTimeValid ? 'text-rose-600' : 'text-slate-300'}`}>
                          {s.isOneTimeValid ? s.oneTimeRate.toFixed(1) + '%' : 'N/A'}
                      </span>
                  </div>
              ))}
          </div>
        </div>

        {/* KPI 4 */}
        <div onClick={() => onOpenLostAnalysis('churn')} className="clean-card p-8 bg-white border-l-4 border-l-amber-500 shadow-sm flex flex-col h-full clickable-kpi group relative cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all">
          <div className="absolute top-4 right-4 text-slate-200 group-hover:text-amber-400 transition">
            <Hand className="animate-bounce w-5 h-5" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 group-hover:text-amber-600 transition uppercase tracking-widest">流失客平均消費次數 (2個月未回)</h3>
            <span className="text-[9px] font-bold bg-amber-500 text-white px-2 py-1 rounded">全品牌</span>
          </div>
          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-800 group-hover:text-amber-700 transition">{avgLostVisits.toFixed(1)}</span>
              <span className="text-xs text-slate-400">Avg Visits Before Churn</span>
            </div>
          </div>
          <div className="mt-auto border-t border-slate-100 pt-4 space-y-1">
              {storeStats.map(s => (
                  <div key={s.name} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-none">
                      <span className="text-xs font-bold text-slate-600">{s.name}</span>
                      <span className="text-xs font-bold text-amber-600">{s.avgLostVisits.toFixed(1)} 次</span>
                  </div>
              ))}
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="clean-card p-8 bg-white shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h3 className="font-bold text-slate-800 text-lg">月度客群結構報告</h3>
                <p className="text-xs text-slate-400 mt-1">Monthly Customer Structure Analysis</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                    <select 
                        value={chartStoreFilter}
                        onChange={(e) => setChartStoreFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer w-40"
                    >
                        <option value="all">全品牌</option>
                        {stores.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

                <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
                    <button onClick={() => setCurrentMetric('count')} className={`sub-tab-btn ${currentMetric === 'count' ? 'active' : ''}`}>服務件數</button>
                    <button onClick={() => setCurrentMetric('newAnalysis')} className={`sub-tab-btn ml-1 ${currentMetric === 'newAnalysis' ? 'active' : ''}`}>新客分析</button>
                    <button onClick={() => setCurrentMetric('retentionAnalysis')} className={`sub-tab-btn ml-1 ${currentMetric === 'retentionAnalysis' ? 'active' : ''}`}>留存分析</button>
                    <button onClick={() => setCurrentMetric('trendAnalysis')} className={`sub-tab-btn ml-1 ${currentMetric === 'trendAnalysis' ? 'active' : ''}`}>趨勢分析</button>
                </div>
            </div>
        </div>

        <div className="h-[350px] w-full relative">
            <Chart type={currentMetric === 'trendAnalysis' ? 'bar' : 'line'} data={chartData} options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: true, position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, font: { size: 10 } } },
                datalabels: {
                   align: 'top', offset: 4, 
                   color: (ctx) => ctx.dataset.borderColor as string,
                   font: { weight: 'bold', size: 10 }, textAlign: 'center',
                   display: (ctx) => ctx.dataIndex % 1 === 0,
                   formatter: (value, ctx) => {
                       if (value === null) return null;
                       if (currentMetric === 'count') return value;
                       if (currentMetric === 'trendAnalysis') return (value > 0 ? '+' : '') + Number(value).toFixed(1) + '%';
                       return typeof value === 'number' ? Number(value).toFixed(1) + '%' : value;
                   }
                },
                tooltip: { mode: 'index', intersect: false }
              },
              scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
              }
            }} />
        </div>
      </div>
    </section>
  );
}