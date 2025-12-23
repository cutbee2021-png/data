import React, { useState, useEffect, useMemo } from 'react';
import { Chart as ChartJS } from 'chart.js';
import { Order, Metrics, GlobalLookup, MemberInfo, MemberDataImport, GlobalMemberStats } from './types';
import { parseCSV, processData, calculateMetrics } from './utils/helpers';
import EmptyState from './components/EmptyState';
import Navigation from './components/Navigation';
import DashboardView from './components/views/DashboardView';
import StoreView from './components/views/StoreView';
import BarberListView from './components/views/BarberListView';
import BarberDetailView from './components/views/BarberDetailView';
import HairstyleView from './components/views/HairstyleView';
import HourlyView from './components/views/HourlyView';
import MemberListView from './components/views/MemberListView';
import LostAnalysisModal from './components/modals/LostAnalysisModal';
import HairstyleModal from './components/modals/HairstyleModal';
import MemberHistoryModal from './components/modals/MemberHistoryModal';
import { BarChart, Upload, Users, FileText } from 'lucide-react';

export default function App() {
  const [allData, setAllData] = useState<Order[]>([]);
  const [memberData, setMemberData] = useState<Record<string, MemberDataImport>>({});
  const [activeTab, setActiveTab] = useState('dashboard');
  const [year, setYear] = useState('all');
  const [selectedBarber, setSelectedBarber] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);

  // Modal States
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [lostModalType, setLostModalType] = useState<'onetime' | 'churn'>('onetime');
  const [hairstyleModalOpen, setHairstyleModalOpen] = useState(false);
  const [hairstyleModalData, setHairstyleModalData] = useState<{barberName: string, stats: any} | null>(null);
  
  // Member History Modal State
  const [memberHistoryModalOpen, setMemberHistoryModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 1. Global Data Enrichment (Compute isNewCustomer on full dataset)
  const enrichedAllData = useMemo(() => {
    if (allData.length === 0) return [];

    // Shallow clone to attach isNewCustomer flag without mutating original state refs immediately
    const data = allData.map(o => ({...o, isNewCustomer: false}));
    
    // Ensure chronological order for logic
    data.sort((a, b) => a.timestamp - b.timestamp);

    // Apply New Customer Logic if member data exists
    // Logic: If (System_Haircut_Count > 0) AND (Transaction_Unique_Visits == System_Haircut_Count) -> First Visit is True New
    if (Object.keys(memberData).length > 0) {
        const visitsMap: Record<string, Order[]> = {};
        
        data.forEach(o => {
            // Strong ID normalization: string, trim
            const cleanId = String(o.memberId || '').trim();
            if (cleanId && cleanId !== '訪客') {
                if (!visitsMap[cleanId]) visitsMap[cleanId] = [];
                visitsMap[cleanId].push(o);
            }
        });

        Object.keys(visitsMap).forEach(mid => {
            const orders = visitsMap[mid]; // already sorted by time
            const mImport = memberData[mid];
            
            if (mImport && mImport.totalCount > 0) {
                // Calculate unique visits (timestamps) in the transaction report
                // This corresponds to "訂單總數" in terms of Visits (ignoring split rows for same service)
                const uniqueVisitTimes = new Set(orders.map(o => o.timestamp));
                const transactionVisitCount = uniqueVisitTimes.size;

                if (transactionVisitCount === mImport.totalCount) {
                    // Mark orders belonging to the very first timestamp as New Customer
                    const firstVisitTime = orders[0].timestamp;
                    orders.forEach(o => {
                        if (o.timestamp === firstVisitTime) {
                            o.isNewCustomer = true;
                        }
                    });
                }
            }
        });
    }

    return data;
  }, [allData, memberData]);

  // 2. Global Member Info (Global Stats independent of Year Filter)
  const globalMemberInfo = useMemo(() => {
    const info: Record<string, MemberInfo> = {};
    const uniqueMembers = new Set<string>();
    
    // First Pass: Basic Info and Times
    enrichedAllData.forEach(o => {
        const cleanId = String(o.memberId || '').trim();
        if (cleanId && cleanId !== '訪客') {
            if (!uniqueMembers.has(cleanId)) {
                uniqueMembers.add(cleanId);
                info[cleanId] = { 
                    totalVisits: 0, // Will recount unique visits below
                    firstStore: o.store, 
                    lastStore: o.store, 
                    firstTime: o.timestamp, 
                    lastTime: o.timestamp, 
                    isTrueNew: false 
                };
            }
            const i = info[cleanId];
            
            if (o.timestamp > i.lastTime) { i.lastTime = o.timestamp; i.lastStore = o.store; }
            if (o.timestamp < i.firstTime) { i.firstTime = o.timestamp; i.firstStore = o.store; }
            
            // Sync isTrueNew with the enriched order flag
            if (o.isNewCustomer) i.isTrueNew = true;
        }
    });

    // Second Pass: Re-calculate Total Visits correctly (Unique Visits) for MemberInfo
    const visitsCounter: Record<string, Set<number>> = {};
    enrichedAllData.forEach(o => {
        const cleanId = String(o.memberId || '').trim();
        if (cleanId && cleanId !== '訪客') {
            if (!visitsCounter[cleanId]) visitsCounter[cleanId] = new Set();
            visitsCounter[cleanId].add(o.timestamp);
        }
    });
    
    Object.keys(info).forEach(mid => {
        if (visitsCounter[mid]) {
            info[mid].totalVisits = visitsCounter[mid].size;
        }
    });

    return info;
  }, [enrichedAllData]);

  // 3. Computed View Data (Filtered by Year)
  const { filteredData, metrics, lookup } = useMemo(() => {
    const data = year === 'all' ? enrichedAllData : enrichedAllData.filter(d => d.month.startsWith(year));
    
    // Build GLOBAL lookup for cross-month retention calculation
    const globalLookup: GlobalLookup = { monthlyOrders: {}, monthlyMembers: {} };
    
    enrichedAllData.forEach(o => {
        if (!globalLookup.monthlyOrders[o.month]) globalLookup.monthlyOrders[o.month] = [];
        globalLookup.monthlyOrders[o.month].push(o);
        
        const cleanId = String(o.memberId || '').trim();
        if (cleanId && cleanId !== '訪客') {
            if (!globalLookup.monthlyMembers[o.month]) globalLookup.monthlyMembers[o.month] = new Set();
            globalLookup.monthlyMembers[o.month].add(cleanId);
        }
    });

    const calcMetrics = calculateMetrics(data, globalLookup);
    return { filteredData: data, metrics: calcMetrics, lookup: globalLookup };
  }, [enrichedAllData, year]);

  const years = useMemo(() => [...new Set(allData.map(d => d.month.substring(0,4)))].sort().reverse(), [allData]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        const raw = parseCSV(text);
        const processed = processData(raw);
        if (processed.length === 0) { alert('CSV 解析失敗'); return; }
        setAllData(processed);
        setActiveTab('dashboard');
    };
    reader.readAsText(file);
  };

  const handleMemberUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        const rows = parseCSV(text);
        const newData: Record<string, MemberDataImport> = {};
        const currentYear = new Date().getFullYear();
        let matchCount = 0;
        let haircutCountFound = 0;
        
        rows.forEach(r => {
            // Trim keys and values to ensure matching
            const id = String(r['會員帳號'] || r['Member ID'] || r['手機'] || r['Phone'] || '').trim();
            const birthday = r['生日'] || r['Birthday'];
            
            // PRIORITIZE '剪髮次數' as per requirement
            const totalCountRaw = r['剪髮次數'] || r['消費次數'] || r['累積消費次數'] || r['Total Visits'] || r['Count'] || '0';
            const totalCount = parseInt(totalCountRaw) || 0;
            
            if (id) {
                let age = null;
                if (birthday) {
                    const d = new Date(birthday.replace(/\//g, '-'));
                    if (!isNaN(d.getTime())) {
                        age = currentYear - d.getFullYear();
                        matchCount++;
                    }
                }
                if (totalCount > 0) haircutCountFound++;
                newData[id] = { age, totalCount };
            }
        });
        setMemberData(newData);
        alert(`成功匯入會員資料！\n- 總會員數: ${Object.keys(newData).length}\n- 含剪髮次數: ${haircutCountFound} 筆\n- 含年齡資料: ${matchCount} 筆`);
    };
    reader.readAsText(file);
  };

  const handleSelectBarber = (name: string) => {
      setSelectedBarber(name);
      setActiveTab('barber-detail');
  };

  const openLostAnalysis = (type: 'onetime' | 'churn') => {
      setLostModalType(type);
      setLostModalOpen(true);
  };

  const openHairstyleModal = (barberName: string, type: 'iron' | 'easy' | 'lost', stats: any) => {
      setHairstyleModalData({ barberName, stats });
      setHairstyleModalOpen(true);
  };
  
  const handleSelectMember = (id: string, name: string) => {
      setSelectedMember({id, name});
      setMemberHistoryModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-700 font-sans">
        {/* Sticky Container for Header and Navigation */}
        <div className="sticky top-0 z-50">
            <header className="bg-white border-b border-slate-100 h-16 md:h-20">
                <div className="container mx-auto px-4 md:px-8 h-full flex items-center justify-between">
                    <div className="flex items-center space-x-2 md:space-x-4">
                        <div className="w-8 h-8 md:w-9 md:h-9 bg-[#244c5a] rounded-lg flex items-center justify-center text-white shadow-lg shrink-0">
                            <BarChart size={18} />
                        </div>
                        <div>
                            <h1 className="text-base md:text-lg font-bold tracking-tight text-slate-900 leading-none">CUTBEE</h1>
                            <span className="text-[8px] md:text-[9px] font-bold text-[#244c5a] uppercase tracking-widest hidden md:block">Management Core</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 md:space-x-6">
                        {allData.length > 0 && (
                            <div className="relative">
                                <select 
                                    value={year} 
                                    onChange={(e) => setYear(e.target.value)} 
                                    className="bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 md:pl-4 md:pr-10 md:py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer hover:border-[#244c5a] transition shadow-sm appearance-none focus:ring-2 focus:ring-[#244c5a]/20"
                                >
                                    <option value="all">全時段</option>
                                    {years.map(y => <option key={y} value={y}>{y} 年</option>)}
                                </select>
                            </div>
                        )}
                        
                        {/* Member Import Button: Visible as icon only on mobile, text on desktop */}
                        <div className="relative">
                            <label className={`bg-slate-200 text-slate-400 text-[10px] font-bold w-9 h-9 md:w-auto md:h-auto md:px-4 md:py-2 rounded-lg cursor-pointer hover:bg-slate-300 transition shadow-sm flex items-center justify-center ${Object.keys(memberData).length > 0 ? '!bg-[#244c5a] !text-white' : ''}`} title="匯入會員資料">
                                <Users size={16} className="md:mr-2 opacity-60" />
                                <span className="hidden md:inline">會員</span>
                                <input type="file" accept=".csv" onChange={handleMemberUpload} className="hidden" />
                            </label>
                        </div>

                        {/* Report Import Button: Visible as icon only on mobile, text on desktop */}
                        <div className="relative">
                            <label className={`bg-slate-200 text-slate-400 text-[10px] font-bold w-9 h-9 md:w-auto md:h-auto md:px-4 md:py-2 rounded-lg cursor-pointer hover:bg-slate-300 transition shadow-sm flex items-center justify-center ${allData.length > 0 ? '!bg-slate-900 !text-white' : ''}`} title="匯入報表">
                                <Upload size={16} className="md:mr-2 opacity-60" />
                                <span className="hidden md:inline">匯入報表</span>
                                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                            </label>
                        </div>
                    </div>
                </div>
            </header>

            <Navigation activeTab={activeTab} onSwitchTab={setActiveTab} visible={allData.length > 0} />
        </div>

        <main className="container mx-auto px-4 md:px-8 py-6 md:py-10">
            {allData.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="animate-fade">
                    {activeTab === 'dashboard' && (
                        <DashboardView 
                            data={filteredData} 
                            metrics={metrics} 
                            lookup={lookup}
                            memberInfo={globalMemberInfo}
                            onOpenLostAnalysis={openLostAnalysis} 
                            allData={enrichedAllData}
                            isMobile={isMobile}
                        />
                    )}
                    {activeTab === 'store' && <StoreView metrics={metrics} allData={filteredData} lookup={lookup} />}
                    {activeTab === 'barber' && <BarberListView metrics={metrics} onSelectBarber={handleSelectBarber} />}
                    {activeTab === 'barber-detail' && (
                        <BarberDetailView 
                            metrics={metrics} 
                            selectedBarber={selectedBarber || (Object.keys(metrics.barberStats)[0] || '')} 
                            lookup={lookup} 
                            allData={filteredData}
                            onOpenHairstyleModal={openHairstyleModal}
                        />
                    )}
                    {activeTab === 'hairstyle' && <HairstyleView allData={enrichedAllData} />}
                    {activeTab === 'hourly' && <HourlyView allData={enrichedAllData} />}
                    {activeTab === 'member-list' && (
                        <MemberListView 
                            allData={enrichedAllData} 
                            memberData={memberData} 
                            onSelectMember={handleSelectMember}
                            isMobile={isMobile}
                        />
                    )}
                </div>
            )}
        </main>

        <LostAnalysisModal 
            isOpen={lostModalOpen} 
            onClose={() => setLostModalOpen(false)} 
            type={lostModalType} 
            allData={enrichedAllData} 
            memberInfo={globalMemberInfo} 
        />

        <HairstyleModal
            isOpen={hairstyleModalOpen}
            onClose={() => setHairstyleModalOpen(false)}
            barberName={hairstyleModalData?.barberName || ''}
            stats={hairstyleModalData?.stats || null}
        />
        
        <MemberHistoryModal
            isOpen={memberHistoryModalOpen}
            onClose={() => setMemberHistoryModalOpen(false)}
            memberId={selectedMember?.id || null}
            memberName={selectedMember?.name || null}
            allData={enrichedAllData}
        />
    </div>
  );
}