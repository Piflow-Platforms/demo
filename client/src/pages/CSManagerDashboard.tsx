/**
 * CSManagerDashboard — dashboard for CS Manager.
 * Shows team performance, ticket stats, NPS placeholder, and client coverage.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Ticket,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Building2,
  Star,
  Target,
  BarChart3,
  Send,
  RefreshCw,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { MONTH_NAMES_AR, REPORT_STAGES } from "@shared/types";

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

export default function CSManagerDashboardPage() {
  const [, setLocation] = useLocation();

  const [currentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });
  const currentMonth = useMemo(() => {
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  }, [currentDate]);
  const monthLabel = MONTH_NAMES_AR[currentDate.getMonth() + 1] ?? "";
  const yearNum = currentDate.getFullYear();

  const { data: csUsers, isLoading: usersLoading } = trpc.users.byRole.useQuery({ role: "customer_success" });
  const { data: allClients } = trpc.clients.list.useQuery();
  const { data: allReports } = trpc.reports.list.useQuery({ month: currentMonth });
  const { data: allTickets } = trpc.csTickets.list.useQuery({});

  if (usersLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const csTeam = csUsers ?? [];
  const clients = allClients ?? [];
  const reports = allReports ?? [];
  const tickets = allTickets ?? [];

  // Stats
  const openTickets = tickets.filter(t => t.status === "open").length;
  const resolvedTickets = tickets.filter(t => t.status === "resolved").length;
  const urgentTickets = tickets.filter(t => t.priority === "urgent" && t.status === "open").length;
  const sentReports = reports.filter(r => r.stage === "sent_to_client").length;
  const totalReports = reports.length;
  const sendRate = totalReports > 0 ? Math.round((sentReports / totalReports) * 100) : 0;

  // Per-CS stats
  const csStats = csTeam.map(cs => {
    // CS assignments are tracked via cs_assignments table — for now use clients list
    const csTickets = tickets.filter(t => t.assignedTo === cs.id);
    const openCsTickets = csTickets.filter(t => t.status === "open").length;
    const resolvedCsTickets = csTickets.filter(t => t.status === "resolved").length;
    const totalCsTickets = csTickets.length;
    const resolutionRate = totalCsTickets > 0 ? Math.round((resolvedCsTickets / totalCsTickets) * 100) : 0;
    return { cs, openCsTickets, resolvedCsTickets, totalCsTickets, resolutionRate };
  });

  // Ticket type distribution
  const ticketTypes: Record<string, number> = {};
  tickets.forEach(t => { ticketTypes[t.type] = (ticketTypes[t.type] ?? 0) + 1; });

  const TICKET_TYPE_LABELS: Record<string, string> = {
    complaint: "شكاوى",
    extra_service: "خدمات إضافية",
    volume_increase: "ارتفاع حجم",
    data_delay: "تأخر بيانات",
    other: "أخرى",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          لوحة مدير CS — {monthLabel} {yearNum}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">مراقبة أداء الفريق، التذاكر، ومعدلات الإرسال</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "فريق CS", value: csTeam.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "تذاكر مفتوحة", value: openTickets, icon: Ticket, color: "text-red-600", bg: "bg-red-50", urgent: urgentTickets > 0 },
          { label: "معدل الإرسال", value: `${sendRate}%`, icon: Send, color: "text-green-600", bg: "bg-green-50" },
          { label: "تذاكر محلولة", value: resolvedTickets, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(s => (
          <Card key={s.label} className={`hover:shadow-sm transition-shadow ${(s as any).urgent ? "border-red-300 ring-1 ring-red-200" : ""}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CS Team Performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              أداء فريق CS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {csTeam.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا يوجد أعضاء في فريق CS</p>
            ) : (
              csStats.map(({ cs, openCsTickets, resolvedCsTickets, totalCsTickets, resolutionRate }) => (
                <div key={cs.id} className="p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{cs.name?.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{cs.name}</p>
                        <p className="text-xs text-muted-foreground">{totalCsTickets} تذكرة إجمالاً</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {openCsTickets > 0 && (
                        <Badge className="bg-red-100 text-red-700 border-0 text-xs">{openCsTickets} مفتوحة</Badge>
                      )}
                      <Badge className="bg-green-100 text-green-700 border-0 text-xs">{resolvedCsTickets} محلولة</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={resolutionRate} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground shrink-0">{resolutionRate}% حل</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Ticket Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              توزيع التذاكر حسب النوع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(ticketTypes).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد تذاكر بعد</p>
            ) : (
              Object.entries(ticketTypes).map(([type, count]) => {
                const total = tickets.length;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{TICKET_TYPE_LABELS[type] ?? type}</span>
                      <span className="font-medium">{count} ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* NPS Placeholder */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              مؤشر رضا العملاء (NPS)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-20 h-20 rounded-full bg-yellow-50 border-4 border-yellow-200 flex items-center justify-center mb-3">
                <span className="text-2xl font-bold text-yellow-600">—</span>
              </div>
              <p className="font-semibold text-muted-foreground">لا توجد بيانات NPS بعد</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                سيتم عرض مؤشر رضا العملاء هنا بعد تفعيل نظام الاستبيانات
              </p>
              <Button variant="outline" size="sm" className="mt-4 gap-1.5" disabled>
                <TrendingUp className="w-4 h-4" />
                إعداد استبيان NPS
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Urgent Tickets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              التذاكر العاجلة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tickets.filter(t => t.priority === "urgent" && t.status === "open").length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">لا توجد تذاكر عاجلة</p>
              </div>
            ) : (
              tickets.filter(t => t.priority === "urgent" && t.status === "open").map(ticket => {
                const client = clients.find(c => c.id === ticket.clientId);
                return (
                  <div key={ticket.id} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-800">{ticket.title}</p>
                      <p className="text-xs text-red-600 mt-0.5">{client?.name} · {new Date(ticket.createdAt).toLocaleDateString("ar-SA")}</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Send Rate */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            معدل إرسال التقارير — {monthLabel} {yearNum}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <Progress value={sendRate} className="h-4" />
            </div>
            <span className="text-2xl font-bold text-primary shrink-0">{sendRate}%</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "إجمالي التقارير", value: totalReports, color: "text-foreground" },
              { label: "تم الإرسال", value: sentReports, color: "text-green-600" },
              { label: "لم يُرسل بعد", value: totalReports - sentReports, color: "text-orange-600" },
            ].map(s => (
              <div key={s.label} className="p-3 bg-muted/30 rounded-lg">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
