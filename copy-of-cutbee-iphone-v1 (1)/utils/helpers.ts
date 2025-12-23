
import { Order, Metrics, GlobalLookup, MemberInfo, BarberStats, GlobalAvg, HairstyleStats, GlobalMemberStats } from '../types';

export const hairstyleRules = {
  top: [
    { category: '油頭', keywords: ['油頭', 'pompadour', 'all back', '後梳', '側分', '七三', '二八', '紳士', '西裝', 'undercut'] },
    { category: '寸頭', keywords: ['寸頭', 'buzz', '光頭', '平頭', '圓頭'] },
    { category: '凱薩頭', keywords: ['凱薩', 'caesar', '栗子'] },
    { category: '飛機頭', keywords: ['飛機', 'quiff', '短飛機', '上抓'] },
    { category: '韓系中分', keywords: ['中分', '韓式', '逗號'] },
    { category: '瀏海造型', keywords: ['瀏海', 'fringe', '丹迪', '前拉', '馬桶蓋', '厚重'] }
  ],
  side: [
    { category: '自然順推', keywords: ['推', '順推', '自然', '修邊'] },
    { category: '區域漸層', keywords: ['區域', 'drop', 'low', 'taper'] },
    { category: '中漸層', keywords: ['中漸層', 'mid'] },
    { category: '高漸層', keywords: ['高漸層', 'high', '漸層', 'fade'] } 
  ]
};

export function classifyHairstyle(rawStr: string): HairstyleStats {
  if (!rawStr) return { top: '其他', side: '其他' };
  const lowerStr = rawStr.toLowerCase();
  let top = '其他', side = '其他';
  for (const r of hairstyleRules.top) if (r.keywords.some(k => lowerStr.includes(k))) { top = r.category; break; }
  for (const r of hairstyleRules.side) if (r.keywords.some(k => lowerStr.includes(k))) { side = r.category; break; }
  return { top, side };
}

export function parseCSV(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const regex = /(?:,|\n|^)("(?:(?:"")|[^"])*"|[^",\n]*|(?:\n|$))/g;
  const lines = text.split(/\r\n|\n/);
  if (lines.length < 2) return [];
  
  const headers: string[] = [];
  let headerMatches;
  // Parse headers from first line
  while ((headerMatches = regex.exec(lines[0])) !== null) {
      let h = headerMatches[1].replace(/^"|"$/g, '').trim();
      // FIX: Remove Byte Order Mark (BOM) strictly
      h = h.replace(/^[\ufeff\uFEFF]/, '');
      if (h) headers.push(h);
      if (headerMatches.index === regex.lastIndex) regex.lastIndex++;
  }

  const keyMap: Record<string, string> = { 
      '店家名稱': 'store', '訂單狀態': 'status', '完成剪髮時間': 'completeTime', '建立時間': 'createTime', 
      '會員帳號': 'memberId', '客戶姓名': 'memberName', '上次剪髮時間': 'lastCutDate', '服務理髮師': 'barber', 
      '指定理髮師': 'designatedBarber', '剪髮內容': 'hairStyle', '總價': 'totalPrice', '剪髮時長': 'durationCol',
      '生日': '生日', 'Birthday': 'Birthday', '消費次數': '消費次數', '累積消費次數': '累積消費次數', '剪髮次數': '剪髮次數',
      'Member ID': 'Member ID', '手機': '手機', 'Phone': 'Phone', 'Total Visits': 'Total Visits', 'Count': 'Count'
  };

  for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const entry: Record<string, string> = {};
      let j = 0; 
      let matches;
      regex.lastIndex = 0;
      while ((matches = regex.exec(lines[i])) !== null) {
          if (j < headers.length) {
            const h = headers[j];
            const mappedKey = keyMap[h] || h; 
            // Fix: remove quotes, <br>, and trim
            entry[mappedKey] = matches[1].replace(/^"|"$/g, '').replace(/<br>/g, ' ').trim();
          }
          j++;
          if (matches.index === regex.lastIndex) regex.lastIndex++;
      }
      if (Object.keys(entry).length > 0) rows.push(entry);
  }
  return rows;
}

export function processData(raw: Record<string, any>[]): Order[] {
  return raw.filter(d => d.status === '完成').map(d => {
      const dateRaw = d.completeTime || d.createTime;
      if (!dateRaw) return null;
      const dateStr = dateRaw.split(' ')[0].replace(/\//g, '-');
      const dateObj = new Date(dateStr);
      let duration = 0;
      if (d.durationCol && !isNaN(parseFloat(d.durationCol))) duration = parseFloat(d.durationCol);
      else if (d.completeTime && d.createTime) {
          const t1 = new Date(d.createTime.replace(/-/g, '/'));
          const t2 = new Date(d.completeTime.replace(/-/g, '/'));
          const diffMs = t2.getTime() - t1.getTime();
          if (diffMs > 0) duration = Math.round(diffMs / 60000);
      }
      return { 
          ...d, date: dateStr, month: dateStr.substring(0, 7), timestamp: dateObj.getTime(), 
          createTimeObj: d.createTime ? new Date(d.createTime.replace(/-/g, '/')) : null,
          completeTimeObj: d.completeTime ? new Date(d.completeTime.replace(/-/g, '/')) : null, 
          barber: d.barber || '未標註', store: d.store || '未標註', memberId: d.memberId || '訪客', 
          totalPrice: parseFloat(d.totalPrice) || 0, duration: duration, lastCutDate: d.lastCutDate,
          isNewCustomer: false
      } as Order;
  }).filter(d => d !== null) as Order[];
}

export function getNextMonth(mStr: string) { 
  let [y, m] = mStr.split('-').map(Number); 
  m++; 
  if (m > 12) { m = 1; y++; } 
  return `${y}-${String(m).padStart(2, '0')}`; 
}

export function calculateMetrics(data: Order[], globalLookup: GlobalLookup): Metrics {
  if (!data || data.length === 0) return { months: [], stats: {}, barberStats: {}, totalServed: 0, avgRetention: 0, uniqueTotalMembers: 0, globalAvg: {} as GlobalAvg };
  
  const months = [...new Set(data.map(o => o.month))].sort();
  const latestMonth = months[months.length - 1]; 
  const stats: any = {}; let rSum = 0; let rCount = 0;
  const cumulativeUnique = new Set(data.filter(o => o.memberId !== '訪客').map(o => o.memberId));

  const allGlobalMonths = Object.keys(globalLookup.monthlyOrders).sort();
  const globalLastMonth = allGlobalMonths[allGlobalMonths.length - 1];

  let gTotalServed = 0, gTotalDur = 0, gTotalDurCount = 0, gTotalDes = 0, gTotalOrders = 0;
  let gTotalAvgDailyProd = 0, gCountForAvgDailyProd = 0;

  months.forEach(m => {
      const sub = data.filter(o => o.month === m);
      const uM = new Set(sub.filter(o => o.memberId !== '訪客').map(o => o.memberId));
      let ret = 0;
      
      const nextM = getNextMonth(m);
      const nextNextM = getNextMonth(nextM);
      const nMems = globalLookup.monthlyMembers[nextM];
      if (nMems) { uM.forEach(id => { if (nMems.has(id)) ret++; }); }

      const newC = new Set(sub.filter(o => o.isNewCustomer).map(o => o.memberId)).size;
      const retentionRate = (nMems && uM.size > 0) ? (ret / uM.size * 100) : null;

      let oneTimeCount = null;
      const isDataIncomplete = (nextNextM > globalLastMonth);

      if (!isDataIncomplete) {
          oneTimeCount = 0;
          const currentMonthVisits: Record<string, number> = {};
          sub.forEach(order => {
              if (order.memberId !== '訪客') {
                  currentMonthVisits[order.memberId] = (currentMonthVisits[order.memberId] || 0) + 1;
              }
          });

          const processedMembers = new Set();
          sub.forEach(o => {
              if (o.isNewCustomer && o.memberId !== '訪客' && !processedMembers.has(o.memberId)) {
                  const hasReturnM1 = globalLookup.monthlyMembers[nextM] && globalLookup.monthlyMembers[nextM].has(o.memberId);
                  const hasReturnM2 = globalLookup.monthlyMembers[nextNextM] && globalLookup.monthlyMembers[nextNextM].has(o.memberId);
                  const hasReturnSameMonth = currentMonthVisits[o.memberId] > 1;

                  if (!hasReturnM1 && !hasReturnM2 && !hasReturnSameMonth) {
                    if (oneTimeCount !== null) oneTimeCount++;
                  }
                  processedMembers.add(o.memberId);
              }
          });
      }

      let churnRate = null;
      if (!isDataIncomplete && uM.size > 0) {
          let churnCount = 0;
          uM.forEach(uId => {
              const hasReturnM1 = globalLookup.monthlyMembers[nextM] && globalLookup.monthlyMembers[nextM].has(uId);
              const hasReturnM2 = globalLookup.monthlyMembers[nextNextM] && globalLookup.monthlyMembers[nextNextM].has(uId);
              if (!hasReturnM1 && !hasReturnM2) {
                  churnCount++;
              }
          });
          churnRate = (churnCount / uM.size * 100);
      }

      stats[m] = { 
          total: sub.length, unique: uM.size, newCount: newC,
          oldCount: uM.size - newC, newRate: uM.size ? (newC/uM.size*100) : 0, 
          retention: retentionRate,
          oneTimeCount: oneTimeCount,
          churnRate: churnRate
      };
      if (stats[m].retention !== null) { rSum += stats[m].retention; rCount++; }
  });

  const bStats: Record<string, BarberStats> = {};
  const uniqueBarbers = [...new Set(data.map(o => o.barber))];
  
  uniqueBarbers.forEach(b => {
      const sub = data.filter(o => o.barber === b);
      const uniqueIds = new Set(sub.filter(o => o.memberId !== '訪客').map(o => o.memberId));
      let totalDur = 0, durCount = 0, designatedCount = 0;
      sub.forEach(o => {
          if (o.duration > 0 && o.duration < 300) { totalDur += o.duration; durCount++; }
          if (o.designatedBarber && o.designatedBarber !== '') designatedCount++;
      });

      let totalPeopleDenominator = 0; 
      let totalPeopleNumerator = 0; 
      let kpiBaseTotalServed = 0; 
      let cntDesSame = 0;       
      let cntDesOther = 0;      
      let cntLost2Month = 0;    
      let retentionChangeSum = 0;
      let prevMonthRet: number | null = null;
      const buckets: any = { iron: [], easy: [], lost: [] }; 
      let sumMonthlyProd = 0;
      let monthsWithProdData = 0;

      const activeMonths = [...new Set(sub.map(o => o.month))].sort();

      activeMonths.forEach(m => {
          const monthOrders = sub.filter(o => o.month === m);
          const distinctDays = new Set(monthOrders.map(o => o.date)).size;
          if (distinctDays > 0) {
              sumMonthlyProd += (monthOrders.length / distinctDays);
              monthsWithProdData++;
          }

          if (m === latestMonth) return;

          const usersInMonth = new Set(monthOrders.filter(o => o.memberId !== '訪客').map(o => o.memberId));
          const memberOrdersInMonth = monthOrders.filter(o => o.memberId !== '訪客');

          if (usersInMonth.size === 0) return;

          totalPeopleDenominator += usersInMonth.size;
          kpiBaseTotalServed += memberOrdersInMonth.length;
          
          let currentMonthPeopleNumerator = 0; 
          const nextM = getNextMonth(m);
          const nextNextM = getNextMonth(nextM);
          const ordersNext1 = globalLookup.monthlyOrders[nextM] || [];
          const ordersNext2 = globalLookup.monthlyOrders[nextNextM] || [];
          
          usersInMonth.forEach(uId => {
              const currentOrders = memberOrdersInMonth.filter(o => o.memberId === uId);
              const futureOrders1 = ordersNext1.filter(o => o.memberId === uId);
              
              if (futureOrders1.length > 0) {
                  totalPeopleNumerator++;
                  currentMonthPeopleNumerator++;
                  let hasDesignatedSame = false;
                  futureOrders1.forEach(nextOrder => { if (nextOrder.designatedBarber === b) hasDesignatedSame = true; });

                  if (hasDesignatedSame) {
                      cntDesSame++;
                      currentOrders.forEach(co => buckets.iron.push(co.hairStyle));
                  } else {
                      cntDesOther++;
                      currentOrders.forEach(co => buckets.easy.push(co.hairStyle));
                  }
              }

              const futureOrders2 = ordersNext2.filter(o => o.memberId === uId);
              const isRetained2Month = (futureOrders1.length > 0 || futureOrders2.length > 0);
              if (!isRetained2Month) {
                  cntLost2Month++;
                  currentOrders.forEach(co => buckets.lost.push(co.hairStyle));
              }
          });

          const currentRet = (currentMonthPeopleNumerator / usersInMonth.size * 100);
          if (prevMonthRet !== null) { retentionChangeSum += (currentRet - prevMonthRet); }
          prevMonthRet = currentRet;
      });

      const adjustedRetention = totalPeopleDenominator > 0 ? (totalPeopleNumerator / totalPeopleDenominator * 100) : 0;
      const avgDailyProd = monthsWithProdData ? (sumMonthlyProd / monthsWithProdData) : 0;
      const visitBase = kpiBaseTotalServed || 1;
      
      bStats[b] = { 
          name: b, 
          store: sub[sub.length - 1]?.store || '未標註',
          totalServed: sub.filter(o => o.memberId !== '訪客').length,
          totalOrders: sub.length,
          retention: adjustedRetention,
          retentionChangeSum: retentionChangeSum,
          avgDuration: durCount ? Math.round(totalDur / durCount) : 0,
          totalDesignationRate: sub.length ? (designatedCount / sub.length * 100) : 0,
          avgDailyProd: avgDailyProd,
          kpiDesSameTotalPct: (cntDesSame / visitBase * 100),
          kpiRetainedOtherTotalPct: (cntDesOther / visitBase * 100),
          kpiLostTotalPct: (cntLost2Month / visitBase * 100),
          data: sub, 
          months: activeMonths,
          buckets: buckets 
      };

      gTotalServed += uniqueIds.size; 
      gTotalDur += totalDur; gTotalDurCount += durCount;
      gTotalDes += designatedCount; gTotalOrders += sub.length;
      if(avgDailyProd > 0) { gTotalAvgDailyProd += avgDailyProd; gCountForAvgDailyProd++; }
  });

  const avgRetention = rCount ? (rSum/rCount) : 0;
  const globalAvg = {
      retention: avgRetention,
      combat: gCountForAvgDailyProd ? (gTotalAvgDailyProd / gCountForAvgDailyProd) : 10,
      efficiency: gTotalDurCount ? Math.round(gTotalDur / gTotalDurCount) : 45,
      totalDes: gTotalOrders ? (gTotalDes / gTotalOrders * 100) : 0,
      retDes: 0
  };

  return { months, stats, barberStats: bStats, totalServed: data.length, avgRetention, uniqueTotalMembers: cumulativeUnique.size, globalAvg };
}

export function calculateMemberStats(data: Order[]): GlobalMemberStats[] {
  const map: Record<string, { id: string; name: string; count: number; lastVisit: number; lastStr: string; lastStore: string }> = {};
  let latest = 0;
  if (data.length > 0) latest = Math.max(...data.map(o => o.timestamp));
  
  data.forEach(o => {
      if (o.memberId === '訪客') return;
      if (!map[o.memberId]) map[o.memberId] = { id: o.memberId, name: o.memberName || '匿名', count: 0, lastVisit: 0, lastStr: '', lastStore: '' };
      map[o.memberId].count++;
      if (o.timestamp >= map[o.memberId].lastVisit) { 
        map[o.memberId].lastVisit = o.timestamp; 
        map[o.memberId].lastStr = o.date; 
        map[o.memberId].lastStore = o.store; 
      }
  });

  const ONE_DAY = 86400000;
  return Object.values(map).map(m => {
      const diff = (latest - m.lastVisit) / ONE_DAY;
      let status: '活躍' | '沉睡' | '流失風險' | '已流失' = '已流失';
      if (diff < 60) status = '活躍';
      else if (diff < 120) status = '沉睡';
      else if (diff < 180) status = '流失風險';
      
      return { ...m, status, diff };
  });
}
