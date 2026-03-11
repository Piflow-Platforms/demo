import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Send,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Calendar,
  FileText,
  Clock,
  TrendingUp,
  Ticket,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  PhoneCall,
  Star,
  XCircle,
  BarChart3,
  Users,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { MONTH_NAMES_AR } from "@shared/types";
import { toast } from "sonner";

export default function CSDashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

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

  const { data: reportsData, isLoading: reportsLoading } = trpc.filters.reports.useQuery({ month: currentMonth });
  const { data: clientsData, isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const { data: ticketsData, isLoading: ticketsLoading } = trpc.csTickets.list.useQuery();
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();

  const sendMutation = trpc.reports.sendToClient.useMutation({
    onSuccess: () => {
      utils.filters.reports.invalidate();
      toast.success("تم إرسال التقرير للعميل بنجاح");
    },
    onError: (err) => toast.error(err.message),
  });

  const reports = reportsData ?? [];
  const clients = clientsData ?? [];
  const tickets = ticketsData ?? [];

  // Report stats
  const readyToSend = reports.filter(r => r.stage === "report_sent");
  const sentThisMonth = reports.filter(r => r.stage === "sent_to_client");
  const inProgress = reports.filter(r => !["sent_to_client", "report_sent"].includes(r.stage));
  const totalReports = reports.length;
  const sentRate = totalReports > 0 ? Math.round((sentThisMonth.length / totalReports) * 100) : 0;

  // Ticket stats
  const openTickets = tickets.filter(t => t.status === "open");
  const inProgressTickets = tickets.filter(t => t.status === "in_progress");
  const resolvedTickets = tickets.filter(t => t.status === "resolved" || t.status === "closed");
  const urgentTickets = tickets.filter(t => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed");

  const isLoading = reportsLoading || clientsLoading || ticketsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6" dir="rtl">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            مرحباً، {user?.name ?? "نجاح العملاء"} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            نجاح العملاء · {clients.length} عميل · {monthLabel} {yearNum}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {urgentTickets.length > 0 && (
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setLocation("/cs-tickets")}>
              <AlertTriangle className="w-4 h-4" />
              {urgentTickets.length} تذكرة عاجلة
            </Button>
          )}
          {readyToSend.length > 0 && (
            <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => setLocation("/send-reports")}>
              <Send className="w-4 h-4" />
              {readyToSend.length} جاهز للإرسال
            </Button>
          )}
          {(unreadCount ?? 0) > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation("/notifications")}>
              <AlertCircle className="w-4 h-4 text-destructive" />
              {unreadCount} إشعار
            </Button>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => setLocation("/clients")}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">عملائي</p>
                <p className="text-3xl font-bold mt-1">{clients.length}</p>
                <p className="text-xs text-muted-foreground mt-1">عميل نشط</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover:shadow-md transition-all ${readyToSend.length > 0 ? "border-green-200" : ""}`}
          onClick={() => setLocation("/send-reports")}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">جاهز للإرسال</p>
                <p className={`text-3xl font-bold mt-1 ${readyToSend.length > 0 ? "text-green-600" : ""}`}>
                  {readyToSend.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">تقرير</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${readyToSend.length > 0 ? "bg-green-100" : "bg-muted"}`}>
                <Send className={`w-4 h-4 ${readyToSend.length > 0 ? "text-green-600" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => setLocation("/cs-tickets")}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">تذاكر مفتوحة</p>
                <p className={`text-3xl font-bold mt-1 ${openTickets.length + inProgressTickets.length > 0 ? "text-orange-600" : ""}`}>
                  {openTickets.length + inProgressTickets.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {urgentTickets.length > 0 ? `${urgentTickets.length} عاجلة` : "تذكرة"}
                </p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${urgentTickets.length > 0 ? "bg-red-100" : openTickets.length > 0 ? "bg-orange-100" : "bg-muted"}`}>
                <Ticket className={`w-4 h-4 ${urgentTickets.length > 0 ? "text-red-600" : openTickets.length > 0 ? "text-orange-600" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">تم الإرسال</p>
                <p className="text-3xl font-bold mt-1 text-emerald-600">{sentThisMonth.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{sentRate}% من الكل</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Month Navigator + Progress ── */}
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
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {inProgress.length} قيد العمل
              </span>
              <span className="flex items-center gap-1.5 text-green-600 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                {sentRate}% مُرسَل
              </span>
            </div>
          </div>
          <Progress value={sentRate} className="h-2.5" />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{sentThisMonth.length} تم إرسالهم</span>
            <span>{totalReports} إجمالي</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Main Grid: Ready to Send + Urgent Tickets ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Ready to Send */}
        <Card className={readyToSend.length > 0 ? "border-green-200/60" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                {readyToSend.length > 0 ? (
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-muted" />
                )}
                جاهزة للإرسال
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={readyToSend.length > 0 ? "bg-green-100 text-green-700 border-0" : "bg-muted text-muted-foreground border-0"}>
                  {readyToSend.length}
                </Badge>
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={() => setLocation("/send-reports")}>
                  عرض الكل <ArrowLeft className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {readyToSend.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا توجد تقارير جاهزة للإرسال حالياً</p>
                <p className="text-xs text-muted-foreground mt-1">ستظهر هنا التقارير التي وافق عليها قائد الفريق</p>
              </div>
            ) : (
              <div className="space-y-2">
                {readyToSend.slice(0, 5).map(report => {
                  const client = clients.find(c => c.id === report.clientId);
                  return (
                    <div
                      key={report.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-green-50/50 border border-green-100 hover:bg-green-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-green-700">{client?.name?.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{client?.name ?? `عميل #${report.clientId}`}</p>
                          <p className="text-xs text-muted-foreground">{report.month}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setLocation(`/reports/${report.id}`)}
                        >
                          عرض
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-green-600 hover:bg-green-700 text-xs h-7"
                          onClick={() => sendMutation.mutate({ reportId: report.id })}
                          disabled={sendMutation.isPending}
                        >
                          <Send className="w-3 h-3" />
                          إرسال
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {readyToSend.length > 5 && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setLocation("/send-reports")}>
                    عرض الكل ({readyToSend.length})
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Urgent / Open Tickets */}
        <Card className={urgentTickets.length > 0 ? "border-red-200/60" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                {urgentTickets.length > 0 ? (
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-orange-400" />
                )}
                التذاكر المفتوحة
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={urgentTickets.length > 0 ? "bg-red-100 text-red-700 border-0" : "bg-orange-100 text-orange-700 border-0"}>
                  {openTickets.length + inProgressTickets.length}
                </Badge>
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={() => setLocation("/cs-tickets")}>
                  إدارة <ArrowLeft className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {openTickets.length + inProgressTickets.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا توجد تذاكر مفتوحة</p>
                <p className="text-xs text-muted-foreground mt-1">رائع! كل التذاكر محلولة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...urgentTickets, ...openTickets.filter(t => t.priority !== "urgent"), ...inProgressTickets].slice(0, 5).map(ticket => {
                  const client = clients.find(c => c.id === ticket.clientId);
                  const isUrgent = ticket.priority === "urgent";
                  const isInProgress = ticket.status === "in_progress";
                  return (
                    <div
                      key={ticket.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors ${
                        isUrgent ? "border-red-200 bg-red-50/30" :
                        isInProgress ? "border-blue-200 bg-blue-50/20" :
                        "border-border"
                      }`}
                      onClick={() => setLocation("/cs-tickets")}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isUrgent ? "bg-red-100" : isInProgress ? "bg-blue-100" : "bg-orange-100"
                      }`}>
                        {isUrgent ? (
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        ) : isInProgress ? (
                          <RefreshCw className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Ticket className="w-4 h-4 text-orange-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ticket.title}</p>
                        <p className="text-xs text-muted-foreground">{client?.name ?? "عميل غير معروف"}</p>
                      </div>
                      {isUrgent && (
                        <Badge className="bg-red-100 text-red-700 border-0 text-[10px] shrink-0">عاجلة</Badge>
                      )}
                      {isInProgress && !isUrgent && (
                        <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] shrink-0">جارية</Badge>
                      )}
                    </div>
                  );
                })}
                {openTickets.length + inProgressTickets.length > 5 && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setLocation("/cs-tickets")}>
                    عرض الكل ({openTickets.length + inProgressTickets.length})
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Client Status Grid ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              حالة العملاء — {monthLabel} {yearNum}
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLocation("/monthly")}>
              عرض التفاصيل
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">لا يوجد عملاء مخصصون لك</p>
            </div>
          ) : (
            <>
              {/* Summary Row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                  <p className="text-xl font-bold text-emerald-600">{sentThisMonth.length}</p>
                  <p className="text-[10px] text-emerald-700 font-medium mt-0.5">تم الإرسال</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-green-50 border border-green-100">
                  <p className="text-xl font-bold text-green-600">{readyToSend.length}</p>
                  <p className="text-[10px] text-green-700 font-medium mt-0.5">جاهز للإرسال</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-orange-50 border border-orange-100">
                  <p className="text-xl font-bold text-orange-600">{inProgress.length}</p>
                  <p className="text-[10px] text-orange-700 font-medium mt-0.5">قيد العمل</p>
                </div>
              </div>

              {/* Client Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {clients.slice(0, 15).map((client) => {
                  const report = reports.find(r => r.clientId === client.id);
                  const isSent = report?.stage === "sent_to_client";
                  const isReady = report?.stage === "report_sent";
                  const isInProg = report && !isSent && !isReady;
                  const clientTickets = tickets.filter(t => t.clientId === client.id && t.status !== "resolved" && t.status !== "closed");
                  return (
                    <div
                      key={client.id}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        isSent ? "border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50" :
                        isReady ? "border-green-200 bg-green-50/30 hover:bg-green-50" :
                        "border-border/50 hover:bg-muted/50"
                      }`}
                      onClick={() => report ? setLocation(`/reports/${report.id}`) : setLocation("/monthly")}
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{client.name?.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{client.name}</p>
                        {clientTickets.length > 0 && (
                          <p className="text-[10px] text-orange-600">{clientTickets.length} تذكرة مفتوحة</p>
                        )}
                      </div>
                      {isSent ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : isReady ? (
                        <Send className="w-4 h-4 text-green-600 shrink-0" />
                      ) : isInProg ? (
                        <Clock className="w-4 h-4 text-orange-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
              {clients.length > 15 && (
                <Button variant="ghost" size="sm" className="w-full mt-3 text-xs" onClick={() => setLocation("/clients")}>
                  عرض جميع العملاء ({clients.length})
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Ticket Stats ── */}
      {tickets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                إحصائيات التذاكر
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLocation("/cs-tickets")}>
                إدارة التذاكر <ArrowLeft className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/40">
                <p className="text-2xl font-bold">{tickets.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">إجمالي</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-50">
                <p className="text-2xl font-bold text-orange-600">{openTickets.length}</p>
                <p className="text-xs text-orange-700 mt-0.5">مفتوحة</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50">
                <p className="text-2xl font-bold text-blue-600">{inProgressTickets.length}</p>
                <p className="text-xs text-blue-700 mt-0.5">قيد المعالجة</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-50">
                <p className="text-2xl font-bold text-emerald-600">{resolvedTickets.length}</p>
                <p className="text-xs text-emerald-700 mt-0.5">محلولة</p>
              </div>
            </div>
            {tickets.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>معدل الحل</span>
                  <span className="font-medium text-emerald-600">
                    {Math.round((resolvedTickets.length / tickets.length) * 100)}%
                  </span>
                </div>
                <Progress value={(resolvedTickets.length / tickets.length) * 100} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
