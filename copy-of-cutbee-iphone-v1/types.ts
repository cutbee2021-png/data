export interface Order {
  store: string;
  status: string;
  completeTime: string;
  createTime: string;
  memberId: string;
  memberName: string;
  lastCutDate: string;
  barber: string;
  designatedBarber: string;
  hairStyle: string;
  totalPrice: number;
  durationCol: string;
  
  // Computed
  date: string;
  month: string;
  timestamp: number;
  createTimeObj: Date | null;
  completeTimeObj: Date | null;
  duration: number;
  isNewCustomer: boolean;
}

export interface MemberInfo {
  totalVisits: number;
  firstStore: string;
  lastStore: string;
  firstTime: number;
  lastTime: number;
  isTrueNew: boolean;
}

export interface MemberDataImport {
  age: number | null;
  totalCount: number;
}

export interface GlobalMemberStats {
  id: string;
  name: string;
  count: number;
  lastVisit: number;
  lastStr: string;
  lastStore: string;
  status: '活躍' | '沉睡' | '流失風險' | '已流失';
  diff: number;
}

export interface MonthlyStats {
  total: number;
  unique: number;
  newCount: number;
  oldCount: number;
  newRate: number;
  retention: number | null;
  oneTimeCount: number | null;
  churnRate: number | null;
}

export interface BarberStats {
  name: string;
  store: string;
  totalServed: number;
  totalOrders: number;
  retention: number;
  retentionChangeSum: number;
  avgDuration: number;
  totalDesignationRate: number;
  avgDailyProd: number;
  kpiDesSameTotalPct: number;
  kpiRetainedOtherTotalPct: number;
  kpiLostTotalPct: number;
  data: Order[];
  months: string[];
  buckets: {
    iron: string[];
    easy: string[];
    lost: string[];
  };
}

export interface GlobalAvg {
  retention: number;
  combat: number;
  efficiency: number;
  totalDes: number;
  retDes: number;
}

export interface Metrics {
  months: string[];
  stats: Record<string, MonthlyStats>;
  barberStats: Record<string, BarberStats>;
  totalServed: number;
  avgRetention: number;
  uniqueTotalMembers: number;
  globalAvg: GlobalAvg;
}

export interface GlobalLookup {
  monthlyOrders: Record<string, Order[]>;
  monthlyMembers: Record<string, Set<string>>;
}

export interface HairstyleStats {
  top: string;
  side: string;
}
