import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Clock,
  TrendingUp,
  Building2,
  Send,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { REPORT_STAGES, MONTH_NAMES_AR } from "@shared/types";

const stageColors: Record<string, string> = {
  data_entry: "bg-blue-100 text-blue-700",
  justification: "bg-yellow-100 text-yellow-700",
  audit_review: "bg-orange-100 text-orange-700",
  quality_check: "bg-purple-100 text-purple-700",
  report_sent: "bg-green-100 text-green-700",
  sent_to_client: "bg-emerald-100 text-emerald-700",
};

export default function TeamLeaderDashboardPage() {
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

  const { data: teamData, isLoading: teamLoading } = trpc.teams.myTeam.useQuery();
  const { data: reportsData, isLoading: reportsLoading } = trpc.filters.reports.useQuery({ month: currentMonth });
  const { data: clientsData } = trpc.clients.list.useQuery();
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();

  const team = teamData ?? [];
  const reports = reportsData ?? [];
  const clients = clientsData ?? [];

  const pendingReview = reports.filter(r => r.stage === "audit_review");
  const completed = reports.filter(r => r.stage === "sent_to_client").length;
  const totalReports = reports.length;
  const overallProgress = totalReports > 0 ? Math.round((completed / totalReports) * 100) : 0;

  // Per-accountant stats
  const accountantStats = useMemo(() => {
    return team.map(acc => {
      const accReports = reports.filter(r => r.accountantId === acc.id);
      const accClients = clients.filter(c => c.accountantId === acc.id);
      const accCompleted = accReports.filter(r => r.stage === "sent_to_client").length;
      const accReview = accReports.filter(r => r.stage === "audit_review").length;
      const completionRate = accReports.length > 0 ? Math.round((accCompleted / accReports.length) * 100) : 0;
      return {
        id: acc.id,
        name: acc.name,
        clientCount: accClients.length,
        totalReports: accReports.length,
        completed: accCompleted,
        inReview: accReview,
        completionRate,
      };
    });
  }, [team, reports, clients]);

  const isLoading = teamLoading || reportsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">مرحباً، {user?.name ?? "قائد الفريق"}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            قائد الفريق · {team.length} محاسبين تحت إشرافك
          </p>
        </div>
        {(unreadCount ?? 0) > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation("/notifications")}>
            <AlertCircle className="w-4 h-4 text-destructive" />
            {unreadCount} إشعار
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">المحاسبون</p>
                <p className="text-3xl font-bold mt-1">{team.length}</p>
                <p className="text-xs text-muted-foreground mt-1">تحت إشرافك</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => setLocation("/review")}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">بانتظار المراجعة</p>
                <p className={`text-3xl font-bold mt-1 ${pendingReview.length > 0 ? "text-orange-600" : ""}`}>
                  {pendingReview.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">تقرير</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${pendingReview.length > 0 ? "bg-orange-100" : "bg-muted"}`}>
                <CheckCircle className={`w-4 h-4 ${pendingReview.length > 0 ? "text-orange-600" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">إجمالي التقارير</p>
                <p className="text-3xl font-bold mt-1">{totalReports}</p>
                <p className="text-xs text-muted-foreground mt-1">{monthLabel}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">نسبة الإنجاز</p>
                <p className="text-3xl font-bold mt-1 text-green-600">{overallProgress}%</p>
                <p className="text-xs text-muted-foreground mt-1">{completed} مكتمل</p>
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
          <Progress value={overallProgress} className="h-2.5" />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{completed} مكتمل</span>
            <span>{totalReports} إجمالي</span>
          </div>
        </CardContent>
      </Card>

      {/* Pending Reviews */}
      {pendingReview.length > 0 && (
        <Card className="border-orange-200/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                تقارير بانتظار مراجعتك
              </CardTitle>
              <Badge variant="destructive">{pendingReview.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingReview.slice(0, 5).map(report => {
                const client = clients.find(c => c.id === report.clientId);
                return (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-orange-50/50 hover:bg-orange-50 transition-colors cursor-pointer border border-orange-100"
                    onClick={() => setLocation(`/reports/${report.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{client?.name ?? `عميل #${report.clientId}`}</p>
                        <p className="text-xs text-muted-foreground">{report.month}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs border-orange-200 hover:bg-orange-50">
                      مراجعة
                    </Button>
                  </div>
                );
              })}
              {pendingReview.length > 5 && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setLocation("/review")}>
                  عرض الكل ({pendingReview.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Performance */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">أداء الفريق — {monthLabel}</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLocation("/performance")}>
              تفاصيل الأداء
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accountantStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا يوجد محاسبون في فريقك بعد</p>
          ) : (
            <div className="space-y-3">
              {accountantStats.map((acc, idx) => (
                <div key={acc.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                        idx === 0 ? "bg-blue-500" : idx === 1 ? "bg-purple-500" : idx === 2 ? "bg-emerald-500" : "bg-gray-400"
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{acc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {acc.clientCount} عميل · {acc.completed}/{acc.totalReports} مكتمل
                          {acc.inReview > 0 && (
                            <span className="text-orange-600 mr-1">· {acc.inReview} بانتظار المراجعة</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge variant={acc.completionRate >= 80 ? "default" : acc.completionRate >= 50 ? "secondary" : "destructive"}>
                      {acc.completionRate}%
                    </Badge>
                  </div>
                  <Progress value={acc.completionRate} className="h-1.5" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage Distribution */}
      {totalReports > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">توزيع المراحل — {monthLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Object.entries(REPORT_STAGES).map(([key, val]) => {
                const count = reports.filter(r => r.stage === key).length;
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
      )}
    </div>
  );
}
