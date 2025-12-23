import React from 'react';

interface NavigationProps {
  activeTab: string;
  onSwitchTab: (tab: string) => void;
  visible: boolean;
}

export default function Navigation({ activeTab, onSwitchTab, visible }: NavigationProps) {
  if (!visible) return null;

  const tabs = [
    { id: 'dashboard', label: '儀表板' },
    { id: 'store', label: '店家總覽' },
    { id: 'barber', label: '理髮師表現' },
    { id: 'barber-detail', label: '深度分析' },
    { id: 'hairstyle', label: '髮型趨勢' },
    { id: 'hourly', label: '熱點時段' },
    { id: 'member-list', label: '顧客資產' }
  ];

  return (
    <nav className="bg-white border-b border-slate-100 py-3 w-full">
        <div className="container mx-auto px-4 md:px-8 w-full">
            <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar whitespace-nowrap w-full">
                {tabs.map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => onSwitchTab(tab.id)} 
                    className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                  >
                    {tab.label}
                  </button>
                ))}
            </div>
        </div>
    </nav>
  );
}