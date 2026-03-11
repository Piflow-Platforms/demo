import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { BarChart3, Target, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { MONTH_NAMES_AR } from "@shared/types";

const currentYear = new Date().getFullYear();
const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: `${currentYear}-${String(i + 1).padStart(2, "0")}`,
  label: `${MONTH_NAMES_AR[i + 1]} ${currentYear}`,
}));

const COLORS = ["hsl(var(--primary))", "hsl(142 76% 36%)", "hsl(38 92% 50%)", "hsl(0 84% 60%)"];

export default function KPIDashboardPage() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const { data: kpi, isLoading } = trpc.analytics.kpi.useQuery({
    month: selectedMonth || undefined,
  });

  const { data: delayedReports = [] } = trpc.analytics.delayedReports.useQuery({ days: 5 });

  const isManager = user?.role === "admin" || user?.role === "operation_manager" || user?.role === "team_leader";

  if (!isManager) {
    return (
      <div className="p-8 text-center text-muted-foreground" dir="rtl">
        ليس لديك صلاحية الوصول لهذه الصفحة
      </div>
    );
  }

  // Build pie data from stage counts in kpi
  const pieData = kpi ? [
    { name: "إدخال البيانات", value: kpi.notStarted },
    { name: "قيد التنفيذ", value: kpi.inProgress },
    { name: "انتظار المراجعة", value: kpi.pendingReview },
    { name: "مكتمل", value: kpi.completed },
  ].filter(d => d.value > 0) : [];

  const kpiCards = [
    {
      title: "نسبة الإنجاز الإجمالية",
      value: `${kpi?.completionRate ?? 0}%`,
      icon: Target,
      color: "text-primary",
      bg: "bg-primary/10",
      trend: (kpi?.completionRate ?? 0) >= 80 ? "up" : "down",
      sub: `${kpi?.completed ?? 0} من ${kpi?.total ?? 0} تقرير`,
    },
    {
      title: "تقارير تمت موافقتها",
      value: String(kpi?.approvals ?? 0),
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      trend: (kpi?.approvals ?? 0) > 0 ? "up" : "down",
      sub: "موافقة من قائد الفريق",
    },
    {
      title: "معدل القبول من أول مرة",
      value: `${kpi?.firstPassRate ?? 0}%`,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      trend: (kpi?.firstPassRate ?? 0) >= 85 ? "up" : "down",
      sub: "تقارير قُبلت دون رفض",
    },
    {
      title: "التقارير المتأخرة",
      value: String(delayedReports.length),
      icon: AlertTriangle,
      color: "text-rose-600",
      bg: "bg-rose-50",
      trend: delayedReports.length === 0 ? "up" : "down",
      sub: "متأخرة أكثر من 5 أيام",
    },
  ];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">لوحة مؤشرات الأداء (KPI)</h1>
            <p className="text-muted-foreground text-sm">مؤشرات الأداء الرئيسية للشركة</p>
          </div>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="كل الأشهر" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأشهر</SelectItem>
            {monthOptions.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جاري تحميل البيانات...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {kpiCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <Card key={i}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className={`p-2 rounded-lg ${card.bg}`}>
                        <Icon className={`h-5 w-5 ${card.color}`} />
                      </div>
                      {card.trend === "up" ? (
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-rose-600" />
                      )}
                    </div>
                    <div className="mt-3">
                      <p className="text-2xl font-bold">{card.value}</p>
                      <p className="text-sm font-medium mt-0.5">{card.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stage Distribution Pie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">توزيع التقارير حسب المرحلة</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                    لا توجد بيانات
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_: any, index: number) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          direction: "rtl",
                        }}
                      />
                      <Legend
                        formatter={(value) => <span style={{ fontSize: "12px", direction: "rtl" }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Team Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ملخص أداء الفرق</CardTitle>
              </CardHeader>
              <CardContent>
                {kpi ? (
                  <div className="space-y-4">
                    {[{ teamName: "الفريق الأول", accountantCount: 7, completionRate: kpi.completionRate, completed: kpi.completed, inProgress: kpi.inProgress, rejections: kpi.rejections }].map((team: any, i: number) => (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{team.teamName}</span>
                            <Badge variant="outline" className="text-xs">{team.accountantCount} محاسب</Badge>
                          </div>
                          <span className="text-sm font-bold">{team.completionRate}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              team.completionRate >= 80 ? "bg-emerald-500" :
                              team.completionRate >= 60 ? "bg-amber-500" : "bg-rose-500"
                            }`}
                            style={{ width: `${team.completionRate}%` }}
                          />
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>مكتمل: {team.completed}</span>
                          <span>قيد التنفيذ: {team.inProgress}</span>
                          <span>مرفوض: {team.rejections}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Delayed Reports Table */}
          {delayedReports.length > 0 && (
            <Card className="border-rose-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-rose-700">
                  <AlertTriangle className="h-4 w-4" />
                  التقارير المتأخرة ({delayedReports.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-rose-50/50">
                        <th className="text-right p-3 font-medium">العميل</th>
                        <th className="text-right p-3 font-medium">الشهر</th>
                        <th className="text-right p-3 font-medium">المرحلة الحالية</th>
                        <th className="text-center p-3 font-medium">أيام التأخير</th>
                        <th className="text-right p-3 font-medium">المحاسب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {delayedReports.slice(0, 10).map((r: any) => (
                        <tr key={r.id} className="border-b hover:bg-muted/20">
                          <td className="p-3 font-medium">{r.clientName}</td>
                          <td className="p-3 text-muted-foreground">{r.month}</td>
                          <td className="p-3">
                            <Badge variant="secondary" className="text-xs">{r.stageAr}</Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="destructive" className="text-xs">{r.daysStuck} يوم</Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{r.accountantName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
