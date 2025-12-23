import React, { useState, useMemo } from 'react';
    import { Order } from '../../types';
    import { Line } from 'react-chartjs-2';
    import { Clock, Hourglass, Users } from 'lucide-react';

    interface HourlyViewProps {
      allData: Order[];
    }

    export default function HourlyView({ allData }: HourlyViewProps) {
      const [mode, setMode] = useState<'store' | 'barber'>('store');
      const [range, setRange] = useState<'all' | '3' | '6' | '12'>('all');
      const [scope, setScope] = useState<'all' | 'weekday' | 'weekend'>('all');
      
      const [filter1, setFilter1] = useState('全部門市');
      const [filter2, setFilter2] = useState('');

      const options = useMemo(() => {
          const list = mode === 'store' ? [...new Set(allData.map(o => o.store))] : [...new Set(allData.map(o => o.barber))];
          return ['全部' + (mode === 'store' ? '門市' : '人員'), ...list.sort()];
      }, [allData, mode]);

      // Reset filter when mode changes
      useMemo(() => {
         setFilter1('全部' + (mode === 'store' ? '門市' : '人員'));
         setFilter2('');
      }, [mode]);

      const getMetricsForFilter = (val: string) => {
          let d = allData;
          
          if (val !== '全部門市' && val !== '全部人員') {
              if (mode === 'store') d = d.filter(o => o.store === val);
              else d = d.filter(o => o.barber === val);
          }

          if (range !== 'all') {
              const now = new Date(); 
              const past = new Date();
              past.setMonth(now.getMonth() - parseInt(range));
              d = d.filter(o => o.timestamp >= past.getTime());
          }

          if (scope !== 'all') {
              d = d.filter(o => {
                  const day = o.createTimeObj ? o.createTimeObj.getDay() : -1;
                  if (day === -1) return false;
                  if (scope === 'weekday') return (day >= 1 && day <= 5);
                  if (scope === 'weekend') return (day === 0 || day === 6);
                  return true;
              });
          }

          const uniqueDays = new Set(d.map(o => o.date)).size || 1;
          const entryCounts = Array(12).fill(0);
          const completeCounts = Array(12).fill(0);

          d.forEach(o => { 
              if (o.createTimeObj) {
                   const h1 = o.createTimeObj.getHours(); 
                   if (h1 >= 10 && h1 <= 21) entryCounts[h1-10]++; 
              }
              if (o.completeTimeObj) {
                  const h2 = o.completeTimeObj.getHours();
                  if (h2 >= 10 && h2 <= 21) completeCounts[h2-10]++;
              }
          });

          const entryAvg = entryCounts.map(c => parseFloat((c / uniqueDays).toFixed(1)));
          const completeAvg = completeCounts.map(c => parseFloat((c / uniqueDays).toFixed(1)));
          
          return { entryAvg, completeAvg, data: d, uniqueDays };
      };

      const metrics1 = getMetricsForFilter(filter1);
      const metrics2 = filter2 ? getMetricsForFilter(filter2) : null;

      const calcKPI = (data: Order[], uniqueDays: number) => {
        let tDur = 0, cDur = 0, tLast = 0, cDays = 0, ordersByDay: Record<string, Order[]> = {}; 
        data.forEach(o => { 
            if(o.duration>0&&o.duration<600) { tDur+=o.duration; cDur++; } 
            if(!ordersByDay[o.date]) ordersByDay[o.date]=[]; 
            ordersByDay[o.date].push(o); 
        }); 
        Object.values(ordersByDay).forEach(dayOrders => { 
            const valid = dayOrders.filter(o=>o.completeTimeObj&&o.duration>0); 
            if(valid.length) { 
                valid.sort((a,b) => (b.completeTimeObj?.getTime()||0) - (a.completeTimeObj?.getTime()||0)); 
                tLast+=valid[0].duration; cDays++; 
            } 
        }); 
        return { 
            avg: cDur?(tDur/cDur).toFixed(1):0, 
            last: cDays?(tLast/cDays).toFixed(1):0, 
            daily: (data.length / uniqueDays).toFixed(1) 
        }; 
      };

      const k1 = calcKPI(metrics1.data, metrics1.uniqueDays);
      const k2 = metrics2 ? calcKPI(metrics2.data, metrics2.uniqueDays) : null;

      const hours = Array.from({length: 12}, (_, i) => i + 10);
      const chartData = {
          labels: hours.map(h => `${h}:00`),
          datasets: [
              { label: `${filter1} (進店)`, data: metrics1.entryAvg, borderColor: '#244c5a', backgroundColor: '#244c5a', tension: 0.4, borderWidth: 3, pointRadius: 0 },
              { label: `${filter1} (完成)`, data: metrics1.completeAvg, borderColor: '#244c5a', backgroundColor: '#244c5a', borderDash: [5, 5], tension: 0.4, borderWidth: 2, pointRadius: 0 }
          ]
      };

      if (metrics2) {
          chartData.datasets.push({ label: `${filter2} (進店)`, data: metrics2.entryAvg, borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.4, borderWidth: 3, pointRadius: 0 } as any);
          chartData.datasets.push({ label: `${filter2} (完成)`, data: metrics2.completeAvg, borderColor: '#f59e0b', backgroundColor: '#f59e0b', borderDash: [5, 5], tension: 0.4, borderWidth: 2, pointRadius: 0 } as any);
      }

      return (
        <div className="clean-card p-10 shadow-sm animate-fade">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="clean-card p-6 flex items-center justify-between border-l-4 border-l-[#244c5a]">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">平均服務時長</p>
                        <div className="flex items-baseline gap-2">
                             <span className="text-3xl font-bold text-slate-800">{k1.avg} {k2 && <span className="text-sm text-slate-400 ml-2">vs {k2.avg}</span>}</span>
                             <span className="text-xs font-bold text-slate-400">min / order</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[#244c5a]"><Clock size={20}/></div>
                </div>
                <div className="clean-card p-6 flex items-center justify-between border-l-4 border-l-amber-500">
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">末單平均工時</p>
                        <div className="flex items-baseline gap-2">
                             <span className="text-3xl font-bold text-slate-800">{k1.last} {k2 && <span className="text-sm text-slate-400 ml-2">vs {k2.last}</span>}</span>
                             <span className="text-xs font-bold text-slate-400">min</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500"><Hourglass size={20}/></div>
                </div>
                 <div className="clean-card p-6 flex items-center justify-between border-l-4 border-l-emerald-500">
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">一日平均客數</p>
                       <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-slate-800">{k1.daily} {k2 && <span className="text-sm text-slate-400 ml-2">vs {k2.daily}</span>}</span>
                            <span className="text-xs font-bold text-slate-400">人 / 日</span>
                       </div>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500"><Users size={20}/></div>
               </div>
            </div>

            <div className="flex flex-col xl:flex-row justify-between items-start mb-10 gap-6">
                <div className="space-y-4 w-full xl:w-auto">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                            <button onClick={() => setMode('store')} className={`sub-tab-btn ${mode === 'store' ? 'active' : ''}`}>分店視角</button>
                            <button onClick={() => setMode('barber')} className={`sub-tab-btn ml-1 ${mode === 'barber' ? 'active' : ''}`}>理髮師視角</button>
                        </div>
                        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                            <button onClick={() => setScope('all')} className={`sub-tab-btn ${scope === 'all' ? 'active' : ''}`}>全部</button>
                            <button onClick={() => setScope('weekday')} className={`sub-tab-btn ml-1 ${scope === 'weekday' ? 'active' : ''}`}>平日</button>
                            <button onClick={() => setScope('weekend')} className={`sub-tab-btn ml-1 ${scope === 'weekend' ? 'active' : ''}`}>假日</button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                         {['all', '3', '6', '12'].map((r) => (
                            <button key={r} onClick={() => setRange(r as any)} className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${range === r ? 'bg-[#244c5a] text-white' : 'bg-slate-200 text-slate-600 hover:bg-white hover:text-[#244c5a]'}`}>
                                {r === 'all' ? '全部區間' : (r === '3' ? '近3個月' : (r === '6' ? '近半年' : '近一年'))}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2 items-center w-full xl:w-auto">
                    <select value={filter1} onChange={(e) => setFilter1(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-lg px-4 py-2 text-xs font-bold text-slate-700 outline-none w-full md:w-auto">
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <span className="text-xs font-bold text-slate-400">VS</span>
                    <select value={filter2} onChange={(e) => setFilter2(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-lg px-4 py-2 text-xs font-bold text-slate-500 outline-none w-full md:w-auto">
                        <option value="">- 對比對象 -</option>
                        {options.filter(o => o !== filter1 && !o.startsWith('全部')).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
            </div>

            <div className="h-[500px] w-full">
                <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { datalabels: { display: false }, tooltip: { mode: 'index', intersect: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: '平均數量 (人/日)' } }, x: { grid: { display: false } } } }} />
            </div>
        </div>
      );
    }