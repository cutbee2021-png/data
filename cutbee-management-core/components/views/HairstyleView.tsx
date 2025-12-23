import React, { useState, useMemo } from 'react';
    import { Order } from '../../types';
    import { classifyHairstyle, hairstyleRules } from '../../utils/helpers';
    import { Doughnut, Line } from 'react-chartjs-2';
    import { Chart as ChartJS, ArcElement } from 'chart.js';
    import ChartDataLabels from 'chartjs-plugin-datalabels';
    import { PieChart, Activity } from 'lucide-react';

    ChartJS.register(ArcElement, ChartDataLabels);

    interface HairstyleViewProps {
      allData: Order[];
    }

    export default function HairstyleView({ allData }: HairstyleViewProps) {
      const [viewMode, setViewMode] = useState<'all' | 'new'>('all');
      const [chartType, setChartType] = useState<'line' | 'stacked'>('line');
      const [range, setRange] = useState<'all' | '3' | '6' | '12'>('all');

      const filteredData = useMemo(() => {
        let data = allData;
        if (range !== 'all') {
            const now = new Date();
            const past = new Date();
            past.setMonth(now.getMonth() - parseInt(range));
            data = data.filter(o => o.timestamp >= past.getTime());
        }
        if (viewMode === 'new') data = data.filter(o => o.isNewCustomer);
        return data;
      }, [allData, range, viewMode]);

      const { counts, trendData, monthlyTotals } = useMemo(() => {
          const counts = { top: {} as Record<string, number>, side: {} as Record<string, number> };
          const trendData: Record<string, Record<string, number>> = {};
          const monthlyTotals: Record<string, number> = {};

          filteredData.forEach(o => {
              const res = classifyHairstyle(o.hairStyle);
              counts.top[res.top] = (counts.top[res.top] || 0) + 1;
              counts.side[res.side] = (counts.side[res.side] || 0) + 1;

              if (!trendData[o.month]) trendData[o.month] = {};
              if (!monthlyTotals[o.month]) monthlyTotals[o.month] = 0;
              if (!trendData[o.month][res.top]) trendData[o.month][res.top] = 0;
              
              trendData[o.month][res.top]++;
              monthlyTotals[o.month]++;
          });
          return { counts, trendData, monthlyTotals };
      }, [filteredData]);

      const palette = ['#FFcd00', '#101820', '#244c5a', '#4a7c8d', '#7daebf', '#b1cad4'];

      const getPieData = (src: Record<string, number>) => {
          const total = Object.values(src).reduce((a, b) => a + b, 0);
          const labels = Object.keys(src).sort((a, b) => src[b] - src[a]);
          return {
              labels,
              datasets: [{
                  data: labels.map(l => src[l]),
                  backgroundColor: labels.map((l, i) => l === '其他' ? '#ffffff' : palette[i % palette.length])
              }]
          };
      };

      const lineData = useMemo(() => {
          const months = Object.keys(trendData).sort();
          const topCategories = hairstyleRules.top.map(r => r.category);
          const isStacked = chartType === 'stacked';

          return {
              labels: months,
              datasets: topCategories.map((cat, idx) => ({
                  label: cat,
                  data: months.map(m => {
                      const count = trendData[m]?.[cat] || 0;
                      const total = monthlyTotals[m] || 1;
                      return (count / total * 100).toFixed(1);
                  }),
                  borderColor: palette[idx % palette.length],
                  backgroundColor: palette[idx % palette.length],
                  fill: isStacked ? (idx === 0 ? 'origin' : '-1') : false,
                  tension: isStacked ? 0.1 : 0.3,
                  borderWidth: isStacked ? 1 : 2,
                  pointRadius: 0
              }))
          };
      }, [trendData, monthlyTotals, chartType]);

      return (
        <div className="space-y-10 animate-fade">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center">
                    <div className="flex bg-white p-1 rounded-lg border border-slate-100 shadow-sm">
                        <button onClick={() => setViewMode('all')} className={`sub-tab-btn ${viewMode === 'all' ? 'active' : ''}`}>全體客人</button>
                        <button onClick={() => setViewMode('new')} className={`sub-tab-btn ml-1 ${viewMode === 'new' ? 'active' : ''}`}>首次來店新客</button>
                    </div>
                    <div className="flex bg-white p-1 rounded-lg border border-slate-100 shadow-sm ml-4">
                        <button onClick={() => setChartType('line')} className={`sub-tab-btn ${chartType === 'line' ? 'active' : ''}`}><Activity size={12} className="inline mr-1"/>折線</button>
                        <button onClick={() => setChartType('stacked')} className={`sub-tab-btn ml-1 ${chartType === 'stacked' ? 'active' : ''}`}><PieChart size={12} className="inline mr-1"/>堆疊</button>
                    </div>
                </div>
                <div className="flex gap-2">
                    {['all', '3', '6', '12'].map((r) => (
                        <button 
                            key={r} 
                            onClick={() => setRange(r as any)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${range === r ? 'bg-[#244c5a] text-white' : 'bg-slate-200 text-slate-600 hover:bg-white hover:text-[#244c5a]'}`}
                        >
                            {r === 'all' ? '全部區間' : (r === '3' ? '近三個月' : (r === '6' ? '近半年' : '近一年'))}
                        </button>
                    ))}
                </div>
            </div>

            <div className="clean-card p-8 h-[400px]">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">髮型趨勢變化 (%)</h4>
                <div className="h-full w-full">
                    <Line data={lineData} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: '%' }, stacked: chartType === 'stacked', max: chartType === 'stacked' ? 100 : undefined }, x: { grid: { display: false } } }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, datalabels: { display: false } } }} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="clean-card p-10 h-[500px]">
                    <h4 className="text-center font-bold text-slate-700 mb-6">頂部分布</h4>
                    <Doughnut data={getPieData(counts.top)} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: 'auto', formatter: (v, ctx) => { let total=0; ctx.chart.data.datasets[0].data.forEach((val: any) => total+=val); let p = (v*100/total); if(p<1) return null; return ctx.chart.data.labels![ctx.dataIndex]+'\n'+p.toFixed(1)+'%'; }, color: '#ffffff' } } }} />
                </div>
                <div className="clean-card p-10 h-[500px]">
                    <h4 className="text-center font-bold text-slate-700 mb-6">側邊分布</h4>
                    <Doughnut data={getPieData(counts.side)} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: 'auto', formatter: (v, ctx) => { let total=0; ctx.chart.data.datasets[0].data.forEach((val: any) => total+=val); let p = (v*100/total); if(p<1) return null; return ctx.chart.data.labels![ctx.dataIndex]+'\n'+p.toFixed(1)+'%'; }, color: '#ffffff' } } }} />
                </div>
            </div>
        </div>
      );
    }