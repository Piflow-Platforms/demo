import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Building2,
  FileText,
  CheckCircle,
  TrendingUp,
  BarChart3,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Send,
  Clock,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { REPORT_STAGES, MONTH_NAMES_AR } from "@shared/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const stageColors: Record<string, string> = {
  data_entry: "bg-blue-100 text-blue-700",
  justification: "bg-yellow-100 text-yellow-700",
  audit_review: "bg-orange-100 text-orange-700",
  quality_check: "bg-purple-100 text-purple-700",
  report_sent: "bg-green-100 text-green-700",
  sent_to_client: "bg-emerald-100 text-emerald-700",
};

export default function OMDashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });

  const currentMonth = useMemo(() => {
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  }, [currentDate]);

  const monthNum = currentDate.getMonth() + 1;
  const yearNum = currentDate.getFullYear();
  const monthLabel = MONTH_NAMES_AR[monthNum] ?? "";

  const { data: stats, isLoading } = trpc.reports.stats.useQuery({ month: currentMonth });

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const overallCompletion = stats.totalReports > 0
    ? Math.round((stats.completedReports / stats.totalReports) * 100)
    : 0;

  const inReview = stats.stageDistribution["audit_review"] || 0;
  const readyToSend = stats.stageDistribution["report_sent"] || 0;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            لوحة مدير العمليات
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.name} · نظرة شاملة على جميع الفرق والعمليات
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation("/operations")}>
          <BarChart3 className="w-4 h-4" />
          إحصائيات مفصلة
        </Button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => setLocation("/clients")}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">إجمالي العملاء</p>
                <p className="text-3xl font-bold mt-1">{stats.totalClients}</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.totalAccountants} محاسب</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => setLocation("/monthly")}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">تقارير الشهر</p>
                <p className="text-3xl font-bold mt-1">{stats.totalReports}</p>
                <p className="text-xs text-muted-foreground mt-1">{overallCompletion}% منجز</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition-all ${inReview > 0 ? "border-orange-200" : ""}`}
          onClick={() => setLocation("/review")}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">بانتظار المراجعة</p>
                <p className={`text-3xl font-bold mt-1 ${inReview > 0 ? "text-orange-600" : ""}`}>{inReview}</p>
                <p className="text-xs text-muted-foreground mt-1">تقرير</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${inReview > 0 ? "bg-orange-100" : "bg-muted"}`}>
                <CheckCircle className={`w-4 h-4 ${inReview > 0 ? "text-orange-600" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">نسبة الإنجاز</p>
                <p className="text-3xl font-bold mt-1 text-green-600">{overallCompletion}%</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.completedReports} مكتمل</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month Navigator + Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-semibold">{monthLabel} {yearNum}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLocation("/monthly")}>
              عرض التقارير
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Progress value={overallCompletion} className="h-2.5" />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{stats.completedReports} مكتمل</span>
            <span>{stats.totalReports} إجمالي</span>
          </div>
        </CardContent>
      </Card>

      {/* Stage Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">توزيع المراحل — {monthLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Object.entries(REPORT_STAGES).map(([key, val]) => {
              const count = stats.stageDistribution[key] || 0;
              const colorClass = stageColors[key] ?? "bg-gray-100 text-gray-700";
              return (
                <div
                  key={key}
                  className={`p-3 rounded-lg text-center cursor-pointer transition-all hover:scale-105 ${count > 0 ? colorClass : "bg-muted/50"}`}
                  onClick={() => setLocation("/monthly")}
                >
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-[10px] mt-1 font-medium">{val.ar}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Team Performance */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">أداء الفرق — {monthLabel}</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLocation("/operations")}>
              تفاصيل كاملة
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stats.teamStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد بيانات</p>
          ) : (
            <div className="space-y-4">
              {stats.teamStats.map((team, idx) => (
                <div key={team.teamLeaderId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                        idx === 0 ? "bg-blue-500" : idx === 1 ? "bg-purple-500" : idx === 2 ? "bg-emerald-500" : "bg-gray-400"
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{team.teamLeaderName}</p>
                        <p className="text-xs text-muted-foreground">
                          {team.accountantCount} محاسب · {team.clientCount} عميل · {team.completed}/{team.totalReports} مكتمل
                          {team.inReview > 0 && (
                            <span className="text-orange-600 mr-1">· {team.inReview} بانتظار المراجعة</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge variant={team.completionRate >= 80 ? "default" : team.completionRate >= 50 ? "secondary" : "destructive"}>
                      {team.completionRate}%
                    </Badge>
                  </div>
                  <Progress value={team.completionRate} className="h-1.5" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CS Performance */}
      {stats.csStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">أداء فريق CS — {monthLabel}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.csStats.map((cs) => {
                const sentRate = cs.totalReports > 0 ? Math.round((cs.sent / cs.totalReports) * 100) : 0;
                return (
                  <div key={cs.csId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <UserCheck className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{cs.csName}</p>
                          <p className="text-xs text-muted-foreground">
                            {cs.clientCount} عميل · {cs.sent} مُرسَل · {cs.readyToSend} جاهز
                          </p>
                        </div>
                      </div>
                      <Badge variant={sentRate >= 80 ? "default" : sentRate >= 50 ? "secondary" : "outline"}>
                        {sentRate}%
                      </Badge>
                    </div>
                    <Progress value={sentRate} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accountant Stats Summary */}
      {stats.accountantStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">أداء المحاسبين — {monthLabel}</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLocation("/performance")}>
                تفاصيل الأداء
                <ArrowLeft className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stats.accountantStats
                .sort((a, b) => b.completionRate - a.completionRate)
                .slice(0, 10)
                .map((acc) => (
                  <div key={acc.accountantId} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <p className="text-xs font-medium truncate">{acc.accountantName}</p>
                        <span className={`text-xs font-bold shrink-0 ${
                          acc.completionRate >= 80 ? "text-green-600" :
                          acc.completionRate >= 50 ? "text-yellow-600" : "text-red-600"
                        }`}>{acc.completionRate}%</span>
                      </div>
                      <Progress value={acc.completionRate} className="h-1" />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {acc.clientCount} عميل · {acc.completed}/{acc.totalReports}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
            {stats.accountantStats.length > 10 && (
              <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => setLocation("/performance")}>
                عرض جميع المحاسبين ({stats.accountantStats.length})
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
