import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Timer,
  TrendingUp,
  Send,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { REPORT_STAGES, MONTH_NAMES_AR, DATA_FIELDS } from "@shared/types";
import type { DataStatus } from "@shared/types";

const stageColors: Record<string, string> = {
  data_entry: "bg-blue-100 text-blue-700",
  justification: "bg-yellow-100 text-yellow-700",
  audit_review: "bg-orange-100 text-orange-700",
  quality_check: "bg-purple-100 text-purple-700",
  report_sent: "bg-green-100 text-green-700",
  sent_to_client: "bg-emerald-100 text-emerald-700",
};

const stageProgress: Record<string, number> = {
  data_entry: 16, justification: 33, audit_review: 50,
  quality_check: 66, report_sent: 83, sent_to_client: 100,
};

export default function AccountantDashboardPage() {
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

  const { data: clientsData, isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const { data: reportsData, isLoading: reportsLoading } = trpc.filters.reports.useQuery({ month: currentMonth });
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();
  const { data: myLeader } = trpc.teams.myLeader.useQuery();

  const clients = clientsData ?? [];
  const reports = reportsData ?? [];

  const totalReports = reports.length;
  const completedReports = reports.filter(r => r.stage === "sent_to_client").length;
  const inReview = reports.filter(r => r.stage === "audit_review").length;
  const pendingData = reports.filter(r => r.stage === "data_entry").length;
  const overallProgress = totalReports > 0 ? Math.round((completedReports / totalReports) * 100) : 0;

  const isLoading = clientsLoading || reportsLoading;

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
          <h1 className="text-2xl font-bold tracking-tight">مرحباً، {user?.name ?? "محاسب"}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            محاسب
            {myLeader ? ` · تحت إشراف ${myLeader.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation("/time-tracker")}>
            <Timer className="w-4 h-4" />
            تتبع الوقت
          </Button>
          {(unreadCount ?? 0) > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation("/notifications")}>
              <AlertCircle className="w-4 h-4 text-destructive" />
              {unreadCount} إشعار
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => setLocation("/clients")}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">العملاء</p>
                <p className="text-3xl font-bold mt-1">{clients.length}</p>
                <p className="text-xs text-muted-foreground mt-1">من أصل 8</p>
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
                <p className="text-3xl font-bold mt-1">{totalReports}</p>
                <p className="text-xs text-muted-foreground mt-1">{overallProgress}% منجز</p>
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
                <p className="text-xs text-muted-foreground font-medium">بانتظار البيانات</p>
                <p className="text-3xl font-bold mt-1 text-blue-600">{pendingData}</p>
                <p className="text-xs text-muted-foreground mt-1">إدخال بيانات</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">مكتمل</p>
                <p className="text-3xl font-bold mt-1 text-green-600">{completedReports}</p>
                <p className="text-xs text-muted-foreground mt-1">تم الإرسال</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-600" />
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary">{overallProgress}%</span>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
          </div>
          <Progress value={overallProgress} className="h-2.5" />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{completedReports} مكتمل</span>
            <span>{totalReports} إجمالي</span>
          </div>
        </CardContent>
      </Card>

      {/* Client Status Grid */}
      {clients.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">حالة عملائك — {monthLabel} {yearNum}</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLocation("/monthly")}>
                عرض التفاصيل
                <ArrowLeft className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {clients.map((client) => {
                const report = reports.find(r => r.clientId === client.id);
                const stageInfo = report ? REPORT_STAGES[report.stage as keyof typeof REPORT_STAGES] : null;
                const colorClass = report ? (stageColors[report.stage] ?? "bg-gray-100 text-gray-700") : "bg-gray-100 text-gray-400";
                const progress = report ? (stageProgress[report.stage] ?? 0) : 0;

                const dataFields = ["bankStatus", "salariesStatus", "salesStatus", "purchasesStatus", "inventoryStatus"] as const;
                const receivedCount = report ? dataFields.filter(f => (report as any)[f] === "received").length : 0;

                return (
                  <div
                    key={client.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => report ? setLocation(`/reports/${report.id}`) : setLocation(`/clients/${client.id}/masterdata`)}
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{client.name?.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{client.name}</p>
                        {stageInfo ? (
                          <Badge className={`text-[10px] ${colorClass} border-0 shrink-0`}>{stageInfo.ar}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] shrink-0">لا يوجد تقرير</Badge>
                        )}
                      </div>
                      {report && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <Progress value={progress} className="h-1 flex-1" />
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            بيانات: {receivedCount}/5
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stage Distribution */}
      {totalReports > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">توزيع المراحل</CardTitle>
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
