import React, { useState, useMemo } from 'react';
import { Order, GlobalMemberStats, MemberDataImport } from '../../types';
import { calculateMemberStats } from '../../utils/helpers';
import { Search, ArrowUpDown } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

interface MemberListViewProps {
  allData: Order[];
  memberData: Record<string, MemberDataImport>;
  onSelectMember: (id: string, name: string) => void;
  isMobile: boolean;
}

export default function MemberListView({ allData, memberData, onSelectMember, isMobile }: MemberListViewProps) {
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortCol, setSortCol] = useState<'count' | 'lastVisit'>('lastVisit');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [ageChartMode, setAgeChartMode] = useState<'value' | 'percent'>('percent');
  
  const memberStats = useMemo(() => calculateMemberStats(allData), [allData]);

  const counts = useMemo(() => {
      const c = { '活躍': 0, '沉睡': 0, '流失風險': 0, '已流失': 0 };
      memberStats.forEach(m => {
          if (c[m.status] !== undefined) c[m.status]++;
      });
      return c;
  }, [memberStats]);

  const filteredMembers = useMemo(() => {
      let list = memberStats.filter(m => 
          (m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.id.toLowerCase().includes(searchQuery.toLowerCase())) &&
          (!filterStatus || m.status === filterStatus)
      );
      
      return list.sort((a, b) => {
         const valA = sortCol === 'count' ? a.count : a.lastVisit;
         const valB = sortCol === 'count' ? b.count : b.lastVisit;
         return sortDir === 'asc' ? valA - valB : valB - valA;
      });
  }, [memberStats, searchQuery, filterStatus, sortCol, sortDir]);

  const itemsPerPage = 12;
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage) || 1;
  const currentItems = filteredMembers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Age Chart Data Calculation
  const ageChartData = useMemo(() => {
    if (Object.keys(memberData).length === 0) return null;

    const storeBuckets: Record<string, any> = {};
    const ageRanges = ['<18', '18-24', '25-34', '35-44', '45-54', '55+'];
    
    filteredMembers.forEach(m => {
        const mImport = memberData[m.id];
        if (mImport && mImport.age) {
            const store = m.lastStore || '未標註';
            if (!storeBuckets[store]) storeBuckets[store] = { '<18': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, total: 0 };
            
            const age = mImport.age;
            let range = '55+';
            if (age < 18) range = '<18';
            else if (age >= 18 && age <= 24) range = '18-24';
            else if (age >= 25 && age <= 34) range = '25-34';
            else if (age >= 35 && age <= 44) range = '35-44';
            else if (age >= 45 && age <= 54) range = '45-54';
            
            storeBuckets[store][range]++;
            storeBuckets[store].total++;
        }
    });

    const stores = Object.keys(storeBuckets).sort();
    const colors = ['#101820', '#244c5a', '#4a7c8d', '#7daebf', '#b1cad4'];

    const datasets = stores.map((store, index) => {
        const data = ageRanges.map(r => {
            const count = storeBuckets[store][r];
            if (ageChartMode === 'percent') return storeBuckets[store].total > 0 ? parseFloat((count / storeBuckets[store].total * 100).toFixed(1)) : 0;
            return count;
        });
        
        return {
            label: store,
            data: data,
            rawCounts: ageRanges.map(r => storeBuckets[store][r]),
            backgroundColor: colors[index % colors.length],
            borderRadius: 4,
            customTotal: storeBuckets[store].total
        };
    });

    return {
        labels: ageRanges,
        datasets: datasets
    };
  }, [memberData, filteredMembers, ageChartMode]);

  const handleSort = (col: 'count' | 'lastVisit') => {
      if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      else { setSortCol(col); setSortDir('desc'); }
  };

  const toggleFilter = (s: string) => {
      if (filterStatus === s) setFilterStatus(null);
      else setFilterStatus(s);
      setCurrentPage(1);
  };

  return (
    <div className="space-y-8 animate-fade">
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
                { id: '活躍', label: '活躍', count: counts['活躍'], sub: '< 2個月', color: 'emerald' },
                { id: '沉睡', label: '沉睡', count: counts['沉睡'], sub: '2-4個月', color: 'amber' },
                { id: '流失風險', label: '流失風險', count: counts['流失風險'], sub: '4-6個月', color: 'orange' },
                { id: '已流失', label: '已流失', count: counts['已流失'], sub: '> 半年', color: 'rose' }
            ].map(card => {
                const isActive = filterStatus === card.id;
                const isDimmed = filterStatus && !isActive;
                let borderClass = '', bgClass = '', textClass = '';
                if (card.color === 'emerald') { borderClass = 'border-emerald-500'; bgClass = 'hover:bg-emerald-50'; textClass = 'text-emerald-500'; }
                if (card.color === 'amber') { borderClass = 'border-amber-400'; bgClass = 'hover:bg-amber-50'; textClass = 'text-amber-500'; }
                if (card.color === 'orange') { borderClass = 'border-orange-500'; bgClass = 'hover:bg-orange-50'; textClass = 'text-orange-500'; }
                if (card.color === 'rose') { borderClass = 'border-rose-600'; bgClass = 'hover:bg-rose-50'; textClass = 'text-rose-600'; }

                return (
                    <div 
                        key={card.id} 
                        onClick={() => toggleFilter(card.id)}
                        className={`clean-card p-4 md:p-8 text-center cursor-pointer transition border-b-4 ${borderClass} ${bgClass} transform duration-300 ${isDimmed ? 'opacity-40 grayscale' : ''} ${isActive || !filterStatus ? 'scale-100' : ''} ${isActive ? 'scale-105 shadow-lg' : ''}`}
                    >
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">{card.label}</p>
                        <div className="text-2xl md:text-4xl font-bold text-slate-900 mb-1">
                            {card.count.toLocaleString()}
                        </div>
                        <p className="text-xs text-slate-400 font-medium">{card.sub}</p>
                    </div>
                );
            })}
        </div>

        {ageChartData && (
            <div className="clean-card p-6 md:p-8 bg-white h-[400px]">
                <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest md:mb-0">會員年齡層分布 (依最後消費店家區分)</h4>
                    <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
                        <button onClick={() => setAgeChartMode('value')} className={`sub-tab-btn ${ageChartMode === 'value' ? 'active' : ''}`}>數值</button>
                        <button onClick={() => setAgeChartMode('percent')} className={`sub-tab-btn ml-1 ${ageChartMode === 'percent' ? 'active' : ''}`}>百分比</button>
                    </div>
                </div>
                <div className="h-[300px] md:h-[320px] w-full">
                    <Bar 
                        data={ageChartData} 
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            layout: { padding: { top: 20 } },
                            plugins: {
                                legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, font: { size: 10 } } },
                                datalabels: {
                                    // Hide labels on mobile, show on desktop
                                    display: (ctx) => {
                                        if (isMobile) return false;
                                        return (ctx.dataset.data[ctx.dataIndex] as number > 0);
                                    },
                                    color: '#1e293b',
                                    align: 'end', anchor: 'end', offset: -4, font: { weight: 'bold', size: 9 },
                                    formatter: (value, ctx: any) => {
                                        const raw = ctx.dataset.rawCounts[ctx.dataIndex];
                                        if (raw === 0) return '';
                                        if (ageChartMode === 'percent') return `${value.toFixed(1)}%`;
                                        else { 
                                            const total = ctx.dataset.customTotal; 
                                            const pct = total > 0 ? (value / total * 100).toFixed(1) : 0; 
                                            return `${value}\n(${pct}%)`; 
                                        }
                                    },
                                    textAlign: 'center'
                                },
                                tooltip: {
                                    mode: 'index',
                                    intersect: false,
                                    callbacks: {
                                        label: (context: any) => {
                                            const label = context.dataset.label || '';
                                            const raw = context.dataset.rawCounts[context.dataIndex];
                                            if (ageChartMode === 'percent') return `${label}: ${context.parsed.y}% (${raw}人)`;
                                            return `${label}: ${raw}人`;
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: { beginAtZero: true, title: { display: ageChartMode === 'percent', text: '%' } },
                                x: { grid: { display: false } }
                            }
                        }}
                    />
                </div>
            </div>
        )}

        <div className="clean-card p-6 md:p-10">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 md:gap-6">
                <div className="relative w-full md:w-[450px]">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                    <input 
                        type="text" 
                        placeholder="搜尋姓名、電話或帳號..." 
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-6 py-4 text-sm font-medium focus:ring-2 focus:ring-[#244c5a] outline-none transition"
                    />
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="text-[9px] font-bold text-slate-400 bg-slate-50 px-4 py-2 rounded-full border border-slate-100 uppercase tracking-widest text-center w-full md:w-auto">Matched: {filteredMembers.length}</div>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="clean-table min-w-[800px]">
                    <thead>
                        <tr>
                            <th className="w-[200px]">客戶</th>
                            <th className="w-[150px]">帳號</th>
                            <th className="text-center w-[100px] cursor-pointer" onClick={() => handleSort('count')}>次數 <ArrowUpDown size={12} className="inline ml-1 text-slate-300"/></th>
                            <th className="text-center w-[150px] cursor-pointer" onClick={() => handleSort('lastVisit')}>最後消費 <ArrowUpDown size={12} className="inline ml-1 text-slate-300"/></th>
                            <th className="text-center w-[120px]">標籤</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentItems.map(m => {
                            let badge = 'bg-slate-100 text-slate-500';
                            if (m.status === '活躍') badge = 'bg-emerald-50 text-emerald-600';
                            else if (m.status === '沉睡') badge = 'bg-amber-50 text-amber-600';
                            else if (m.status === '流失風險') badge = 'bg-orange-50 text-orange-600';
                            else if (m.status === '已流失') badge = 'bg-rose-50 text-rose-600';
                            return (
                                <tr key={m.id} onClick={() => onSelectMember(m.id, m.name)} className="cursor-pointer hover:bg-indigo-50/50 transition">
                                    <td className="font-bold text-slate-800">{m.name}</td>
                                    <td className="font-mono text-slate-400 text-xs">{m.id}</td>
                                    <td className="text-center font-bold">
                                        {m.count}
                                    </td>
                                    <td className="text-center font-mono text-slate-400 text-xs">{m.lastStr}</td>
                                    <td className="text-center"><span className={`px-2 py-0.5 rounded ${badge} text-[10px] font-bold uppercase`}>{m.status}</span></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-between items-center mt-10">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-xs disabled:opacity-50">Previous</button>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Page {currentPage} / {totalPages}</span>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-xs disabled:opacity-50">Next</button>
            </div>
        </div>
    </div>
  );
}