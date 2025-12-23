import React, { useState, useMemo } from 'react';
    import { Metrics } from '../../types';
    import { ArrowUpDown, ArrowUp, ArrowDown, Minus } from 'lucide-react';

    interface BarberListViewProps {
      metrics: Metrics;
      onSelectBarber: (name: string) => void;
    }

    type SortCol = 'name' | 'store' | 'totalServed' | 'retention' | 'retentionChangeSum';

    export default function BarberListView({ metrics, onSelectBarber }: BarberListViewProps) {
      const [sortCol, setSortCol] = useState<SortCol>('store');
      const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
      const [filterStore, setFilterStore] = useState('all');

      const stores = useMemo(() => {
        const s = new Set<string>();
        Object.values(metrics.barberStats).forEach(b => s.add(b.store));
        return ['all', ...Array.from(s).sort()];
      }, [metrics]);

      const sortedBarbers = useMemo(() => {
        let list = Object.values(metrics.barberStats);
        if (filterStore !== 'all') {
            list = list.filter(b => b.store === filterStore);
        }
        return list.sort((a, b) => {
            let valA = a[sortCol];
            let valB = b[sortCol];
            if (typeof valA === 'string') {
                return sortDir === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
            }
            return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
        });
      }, [metrics, filterStore, sortCol, sortDir]);

      const handleSort = (col: SortCol) => {
          if (sortCol === col) {
              setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
          } else {
              setSortCol(col);
              setSortDir('desc');
          }
      };

      return (
        <div className="clean-card p-6 md:p-8 shadow-sm animate-fade">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h3 className="font-bold text-slate-800">理髮師績效表現</h3>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Filter:</span>
                    <select 
                        value={filterStore} 
                        onChange={(e) => setFilterStore(e.target.value)}
                        className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 outline-none cursor-pointer hover:bg-slate-100 transition w-full md:w-auto"
                    >
                        {stores.map(s => <option key={s} value={s}>{s === 'all' ? '全品牌顯示' : s}</option>)}
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="clean-table min-w-[900px]">
                    <thead>
                        <tr>
                            <th className="cursor-pointer" onClick={() => handleSort('name')}>人員 <ArrowUpDown size={12} className="inline ml-1 text-slate-300"/></th>
                            <th className="cursor-pointer" onClick={() => handleSort('store')}>分店 <ArrowUpDown size={12} className="inline ml-1 text-slate-300"/></th>
                            <th className="text-center cursor-pointer" onClick={() => handleSort('totalServed')}>服務會員數 <ArrowUpDown size={12} className="inline ml-1 text-slate-300"/></th>
                            <th className="text-center cursor-pointer" onClick={() => handleSort('retention')}>個人回訪率 <ArrowUpDown size={12} className="inline ml-1 text-slate-300"/></th>
                            <th className="text-center cursor-pointer" onClick={() => handleSort('retentionChangeSum')}>趨勢總和 <ArrowUpDown size={12} className="inline ml-1 text-slate-300"/></th>
                            <th className="text-center">鐵粉率 (指定)</th>
                            <th className="text-center">隨和率 (不指定)</th>
                            <th className="text-center">流失率 (2個月)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedBarbers.map(s => {
                             const changeColor = s.retentionChangeSum > 0 ? 'text-emerald-500' : (s.retentionChangeSum < 0 ? 'text-rose-500' : 'text-slate-400');
                             return (
                                <tr key={s.name} className="cursor-pointer group hover:bg-slate-50 transition" onClick={() => onSelectBarber(s.name)}>
                                    <td className="font-bold text-[#244c5a] group-hover:underline">{s.name}</td>
                                    <td className="text-[10px] font-bold text-slate-400 uppercase">{s.store}</td>
                                    <td className="text-center font-bold">{s.totalServed.toLocaleString()}</td>
                                    <td className="text-center font-bold text-slate-800 bg-slate-50 group-hover:bg-slate-100 transition">{s.retention.toFixed(1)}%</td>
                                    <td className={`text-center text-xs font-bold ${changeColor}`}>
                                        <div className="flex items-center justify-center">
                                            {s.retentionChangeSum > 0 ? <ArrowUp size={12} className="mr-1"/> : (s.retentionChangeSum < 0 ? <ArrowDown size={12} className="mr-1"/> : <Minus size={12} className="mr-1"/>)}
                                            {s.retentionChangeSum.toFixed(1)}
                                        </div>
                                    </td>
                                    <td className="text-center text-xs text-slate-500 font-bold">{s.kpiDesSameTotalPct.toFixed(1)}%</td>
                                    <td className="text-center text-xs text-slate-400 font-medium">{s.kpiRetainedOtherTotalPct.toFixed(1)}%</td>
                                    <td className="text-center text-xs text-rose-500 font-medium">{s.kpiLostTotalPct.toFixed(1)}%</td>
                                </tr>
                             );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 text-[10px] text-slate-400 text-right leading-relaxed md:leading-normal">
                * 流失率：採用「2個月寬容期」計算，顧客於 M+1 或 M+2 均未回流才計為流失。<br/>
                * 鐵粉/隨和率/個人回訪：維持次月 (M+1) 判定標準。<br/>
                * 因流失率寬容度較高，三者百分比相加可能小於 100% (差額為 M+2 才回流的顧客)。
            </div>
        </div>
      );
    }