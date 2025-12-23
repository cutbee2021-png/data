import React, { useMemo } from 'react';
import { Order } from '../../types';
import { X, Calendar, Scissors, User } from 'lucide-react';

interface MemberHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string | null;
  memberName: string | null;
  allData: Order[];
}

export default function MemberHistoryModal({ isOpen, onClose, memberId, memberName, allData }: MemberHistoryModalProps) {
  if (!isOpen || !memberId) return null;

  const history = useMemo(() => {
    return allData
        .filter(o => o.memberId === memberId)
        .sort((a, b) => b.timestamp - a.timestamp);
  }, [allData, memberId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden relative flex flex-col max-h-[85vh]">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition z-10">
                <X size={24} />
            </button>
            <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800">{memberName || '會員'} 歷史消費紀錄</h3>
                <p className="text-xs text-slate-500 mt-1">Member ID: {memberId}</p>
            </div>
            
            <div className="p-0 overflow-y-auto flex-1 bg-white">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="p-4 text-xs font-bold text-slate-400 uppercase border-b border-slate-100">日期</th>
                            <th className="p-4 text-xs font-bold text-slate-400 uppercase border-b border-slate-100">服務項目</th>
                            <th className="p-4 text-xs font-bold text-slate-400 uppercase border-b border-slate-100">理髮師</th>
                            <th className="p-4 text-xs font-bold text-slate-400 uppercase border-b border-slate-100 text-right">金額</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((order, idx) => (
                            <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-slate-300" />
                                        <span className="text-sm font-bold text-slate-700">{order.date}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 pl-6">{order.store}</div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <Scissors size={14} className="text-slate-300" />
                                        <span className="text-sm font-medium text-slate-600 truncate max-w-[120px] block" title={order.hairStyle}>{order.hairStyle || '-'}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <User size={14} className="text-slate-300" />
                                        <span className="text-sm font-medium text-slate-700">{order.barber}</span>
                                        {(order.designatedBarber && order.designatedBarber !== '') && (
                                            <span className="text-[9px] font-bold bg-[#244c5a] text-white px-1.5 py-0.5 rounded">指</span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <span className="text-sm font-bold text-slate-700">${order.totalPrice}</span>
                                </td>
                            </tr>
                        ))}
                        {history.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-400 text-sm">無歷史資料</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
}