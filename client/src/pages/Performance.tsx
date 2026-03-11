import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend } from "recharts";
import { TrendingUp, Award, AlertTriangle, CheckCircle2, User } from "lucide-react";
import { MONTH_NAMES_AR } from "@shared/types";

const currentYear = new Date().getFullYear();
const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: `${currentYear}-${String(i + 1).padStart(2, "0")}`,
  label: `${MONTH_NAMES_AR[i + 1]} ${currentYear}`,
}));

export default function PerformancePage() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const { data: stats = [], isLoading } = trpc.analytics.performance.useQuery({
    month: selectedMonth || undefined,
  });

  const isManager = user?.role === "admin" || user?.role === "operation_manager" || user?.role === "team_leader";

  const chartData = stats.map(s => ({
    name: (s.accountantName ?? "").split(" ").slice(0, 2).join(" "),
    "نسبة الإنجاز": s.completionRate,
    "جودة العمل": s.qualityScore,
    "التقارير المكتملة": s.completed,
    "المرفوضة": s.rejections,
  }));

  const topPerformer = stats.reduce((best, curr) =>
    curr.completionRate > (best?.completionRate ?? -1) ? curr : best, stats[0]);

  const mostRejections = stats.reduce((worst, curr) =>
    curr.rejections > (worst?.rejections ?? -1) ? curr : worst, stats[0]);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">تقرير الأداء</h1>
            <p className="text-muted-foreground text-sm">مقارنة أداء المحاسبين</p>
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

      {/* Top Cards */}
      {isManager && stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-100">
                <Award className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">الأفضل أداءً</p>
                <p className="font-bold text-emerald-700">{topPerformer?.accountantName ?? "-"}</p>
                <p className="text-xs text-emerald-600">{topPerformer?.completionRate ?? 0}% نسبة إنجاز</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">أعلى نسبة رفض</p>
                <p className="font-bold text-amber-700">{mostRejections?.accountantName ?? "-"}</p>
                <p className="text-xs text-amber-600">{mostRejections?.rejections ?? 0} تقارير مرفوضة</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bar Chart */}
      {isManager && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">نسبة الإنجاز والجودة</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    direction: "rtl",
                  }}
                />
                <Bar dataKey="نسبة الإنجاز" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="جودة العمل" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">تفاصيل الأداء</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : stats.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">لا توجد بيانات</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-right p-3 font-medium">المحاسب</th>
                    <th className="text-center p-3 font-medium">إجمالي</th>
                    <th className="text-center p-3 font-medium">مكتمل</th>
                    <th className="text-center p-3 font-medium">قيد المراجعة</th>
                    <th className="text-center p-3 font-medium">مرفوض</th>
                    <th className="text-center p-3 font-medium">نسبة الإنجاز</th>
                    <th className="text-center p-3 font-medium">جودة العمل</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, idx) => (
                    <tr key={s.accountantId} className={`border-b hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {(s.accountantName ?? "م")[0]}
                          </div>
                          <span className="font-medium">{s.accountantName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">{s.total}</td>
                      <td className="p-3 text-center">
                        <span className="text-emerald-600 font-medium">{s.completed}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-amber-600 font-medium">{s.inReview}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-rose-600 font-medium">{s.rejections}</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-primary"
                              style={{ width: `${s.completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium w-8">{s.completionRate}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={s.qualityScore >= 90 ? "default" : s.qualityScore >= 70 ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {s.qualityScore}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
