import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Users, Building2, FileText, CheckCircle, TrendingUp, BarChart3,
  UserCheck, Send, Clock, AlertTriangle
} from "lucide-react";
import { useState, useMemo } from "react";
import { REPORT_STAGES, MONTH_NAMES_AR } from "@shared/types";
import FilterBar, { type FilterValues } from "@/components/FilterBar";

const now = new Date();

export default function OperationsPage() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [filters, setFilters] = useState<FilterValues>({});

  const { data: stats, isLoading } = trpc.reports.stats.useQuery(
    { month: selectedMonth },
    { enabled: !!user && (user.role === "operation_manager" || user.role === "admin") }
  );

  // Generate month options
  const monthOptions = useMemo(() => {
    const options = [];
    for (let y = 2025; y <= 2027; y++) {
      for (let m = 1; m <= 12; m++) {
        const val = `${y}-${String(m).padStart(2, "0")}`;
        const label = `${MONTH_NAMES_AR[m]} ${y}`;
        options.push({ value: val, label });
      }
    }
    return options;
  }, []);

  if (!user || (user.role !== "operation_manager" && user.role !== "admin")) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">ليس لديك صلاحية الوصول لهذه الصفحة</p>
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">إحصائيات العمليات</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6"><div className="h-16 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const overallCompletion = stats.totalReports > 0
    ? Math.round((stats.completedReports / stats.totalReports) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            إحصائيات العمليات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">نظرة شاملة على أداء الفرق والعمليات</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filters for accountant/team breakdown */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        show={{ accountant: true, teamLeader: true, cs: true }}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">إجمالي العملاء</p>
                <p className="text-3xl font-bold mt-1">{stats.totalClients}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">إجمالي التقارير</p>
                <p className="text-3xl font-bold mt-1">{stats.totalReports}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">مكتملة</p>
                <p className="text-3xl font-bold mt-1 text-green-600">{stats.completedReports}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">نسبة الإنجاز</p>
                <p className="text-3xl font-bold mt-1">{overallCompletion}%</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-amber-500" />
              </div>
            </div>
            <Progress value={overallCompletion} className="mt-3 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Stage Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            توزيع المراحل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(REPORT_STAGES).map(([key, stage]) => {
              const count = stats.stageDistribution[key] || 0;
              const pct = stats.totalReports > 0 ? Math.round((count / stats.totalReports) * 100) : 0;
              const colors: Record<string, string> = {
                data_entry: "bg-slate-100 text-slate-700 border-slate-200",
                justification: "bg-amber-50 text-amber-700 border-amber-200",
                audit_review: "bg-blue-50 text-blue-700 border-blue-200",
                quality_check: "bg-purple-50 text-purple-700 border-purple-200",
                report_sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
                sent_to_client: "bg-green-50 text-green-700 border-green-200",
              };
              return (
                <div key={key} className={`rounded-xl border p-4 ${colors[key] || "bg-muted"}`}>
                  <p className="text-xs font-medium opacity-80">{stage.ar}</p>
                  <p className="text-2xl font-bold mt-1">{count}</p>
                  <p className="text-xs opacity-60 mt-0.5">{pct}%</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Team Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            أداء الفرق
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.teamStats.map((team, idx) => (
              <div key={team.teamLeaderId} className="border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold ${
                      idx === 0 ? "bg-blue-500" : idx === 1 ? "bg-purple-500" : "bg-emerald-500"
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold">{team.teamLeaderName || `فريق ${idx + 1}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {team.accountantCount} محاسبين · {team.clientCount} عميل
                      </p>
                    </div>
                  </div>
                  <Badge variant={team.completionRate >= 80 ? "default" : team.completionRate >= 50 ? "secondary" : "destructive"}>
                    {team.completionRate}% إنجاز
                  </Badge>
                </div>
                <Progress value={team.completionRate} className="h-2 mb-2" />
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold">{team.totalReports}</p>
                    <p className="text-[10px] text-muted-foreground">إجمالي</p>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded-lg">
                    <p className="text-lg font-bold text-blue-600">{team.inReview}</p>
                    <p className="text-[10px] text-muted-foreground">قيد المراجعة</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-600">{team.completed}</p>
                    <p className="text-[10px] text-muted-foreground">مكتملة</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accountant Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            أداء المحاسبين
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-right p-3 font-medium">المحاسب</th>
                  <th className="text-right p-3 font-medium">قائد الفريق</th>
                  <th className="text-center p-3 font-medium">العملاء</th>
                  <th className="text-center p-3 font-medium">التقارير</th>
                  <th className="text-center p-3 font-medium">مكتملة</th>
                  <th className="text-center p-3 font-medium">نسبة الإنجاز</th>
                </tr>
              </thead>
              <tbody>
                {stats.accountantStats.map((acc) => (
                  <tr key={acc.accountantId} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium">{acc.accountantName || `محاسب #${acc.accountantId}`}</td>
                    <td className="p-3 text-muted-foreground text-xs">{acc.teamLeaderName}</td>
                    <td className="p-3 text-center">{acc.clientCount}</td>
                    <td className="p-3 text-center">{acc.totalReports}</td>
                    <td className="p-3 text-center">
                      <span className="text-green-600 font-medium">{acc.completed}</span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <Progress value={acc.completionRate} className="h-1.5 w-16" />
                        <span className="text-xs font-medium w-8">{acc.completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* CS Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5 text-muted-foreground" />
            أداء فريق نجاح العملاء
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.csStats.map((cs) => (
              <div key={cs.csId} className="border rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">
                      {(cs.csName || "CS").charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{cs.csName || `CS #${cs.csId}`}</p>
                    <p className="text-xs text-muted-foreground">{cs.clientCount}/25 عميل</p>
                  </div>
                </div>
                <Progress value={(cs.clientCount / 25) * 100} className="h-1.5 mb-3" />
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-sm font-bold">{cs.totalReports}</p>
                    <p className="text-[10px] text-muted-foreground">إجمالي</p>
                  </div>
                  <div className="text-center p-2 bg-amber-50 rounded-lg">
                    <p className="text-sm font-bold text-amber-600">{cs.readyToSend}</p>
                    <p className="text-[10px] text-muted-foreground">جاهزة</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <p className="text-sm font-bold text-green-600">{cs.sent}</p>
                    <p className="text-[10px] text-muted-foreground">مرسلة</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Staff Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            ملخص الكادر
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-3xl font-bold text-blue-600">{stats.totalAccountants}</p>
              <p className="text-sm text-muted-foreground mt-1">محاسب</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-100">
              <p className="text-3xl font-bold text-purple-600">{stats.totalTeamLeaders}</p>
              <p className="text-sm text-muted-foreground mt-1">قائد فريق</p>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-3xl font-bold text-emerald-600">{stats.totalCs}</p>
              <p className="text-sm text-muted-foreground mt-1">نجاح العملاء</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-3xl font-bold text-amber-600">{stats.totalUsers}</p>
              <p className="text-sm text-muted-foreground mt-1">إجمالي المستخدمين</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
