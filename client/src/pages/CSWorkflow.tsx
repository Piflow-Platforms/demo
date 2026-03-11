/**
 * CSWorkflow — Customer Success interface.
 * Shows tickets raised by TLs, allows CS to handle them, and manage client interventions.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Ticket,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Users,
  RefreshCw,
  XCircle,
  ArrowRight,
  MessageSquare,
  Filter,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { MONTH_NAMES_AR, REPORT_STAGES } from "@shared/types";

const TICKET_TYPES: Record<string, { label: string; color: string }> = {
  complaint: { label: "شكوى", color: "bg-red-100 text-red-700" },
  extra_service: { label: "خدمة إضافية", color: "bg-blue-100 text-blue-700" },
  volume_increase: { label: "ارتفاع حجم العمل", color: "bg-purple-100 text-purple-700" },
  data_delay: { label: "تأخر في البيانات", color: "bg-orange-100 text-orange-700" },
  other: { label: "أخرى", color: "bg-gray-100 text-gray-700" },
};

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

const STATUS_LABELS: Record<string, string> = {
  open: "مفتوحة",
  in_progress: "قيد المعالجة",
  resolved: "محلولة",
  closed: "مغلقة",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-orange-100 text-orange-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

const stageColors: Record<string, string> = {
  data_entry: "bg-blue-100 text-blue-700",
  justification: "bg-yellow-100 text-yellow-700",
  audit_review: "bg-orange-100 text-orange-700",
  quality_check: "bg-purple-100 text-purple-700",
  report_sent: "bg-green-100 text-green-700",
  sent_to_client: "bg-emerald-100 text-emerald-700",
};

export default function CSWorkflowPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [currentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });
  const currentMonth = useMemo(() => {
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  }, [currentDate]);
  const monthLabel = MONTH_NAMES_AR[currentDate.getMonth() + 1] ?? "";
  const yearNum = currentDate.getFullYear();

  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [newStatus, setNewStatus] = useState<string>("in_progress");

  const { data: tickets, isLoading: ticketsLoading } = trpc.csTickets.list.useQuery({ status: statusFilter === "all" ? undefined : statusFilter });
  const { data: clients } = trpc.clients.list.useQuery();
  const { data: reports } = trpc.reports.list.useQuery({ month: currentMonth });
  const { data: readyToSend } = trpc.reports.readyToSend.useQuery();

  const updateTicketMutation = trpc.csTickets.update.useMutation({
    onSuccess: () => {
      utils.csTickets.list.invalidate();
      setSelectedTicket(null);
      setResolutionNote("");
      toast.success("تم تحديث التذكرة بنجاح");
    },
    onError: (e) => toast.error(e.message),
  });

  const sendReportMutation = trpc.reports.sendToClient.useMutation({
    onSuccess: () => { utils.reports.readyToSend.invalidate(); utils.reports.list.invalidate(); toast.success("تم إرسال التقرير للعميل"); },
    onError: (e) => toast.error(e.message),
  });

  if (ticketsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const allTickets = tickets ?? [];
  const allClients = clients ?? [];
  const myReports = reports ?? [];
  const readyReports = readyToSend ?? [];

  const openCount = allTickets.filter(t => t.status === "open").length;
  const inProgressCount = allTickets.filter(t => t.status === "in_progress").length;
  const resolvedCount = allTickets.filter(t => t.status === "resolved").length;

  const selectedTicketData = allTickets.find(t => t.id === selectedTicket);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          لوحة Customer Success — {monthLabel} {yearNum}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">إدارة التذاكر، التدخل في المشاكل، وإرسال التقارير</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "تذاكر مفتوحة", value: openCount, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", urgent: openCount > 0 },
          { label: "قيد المعالجة", value: inProgressCount, icon: RefreshCw, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "محلولة", value: resolvedCount, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "تقارير جاهزة للإرسال", value: readyReports.length, icon: Send, color: "text-blue-600", bg: "bg-blue-50", urgent: readyReports.length > 0 },
        ].map(s => (
          <Card key={s.label} className={`hover:shadow-sm transition-shadow ${(s as any).urgent ? "border-orange-300 ring-1 ring-orange-200" : ""}`}>
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

      <Tabs defaultValue="tickets" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="tickets" className="gap-1.5">
            <Ticket className="w-4 h-4" />
            التذاكر
            {openCount > 0 && (
              <Badge className="bg-red-500 text-white text-[10px] h-4 px-1">{openCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5">
            <Building2 className="w-4 h-4" />
            عملائي
          </TabsTrigger>
        </TabsList>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="space-y-3">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-1.5 flex-wrap">
              {["all", "open", "in_progress", "resolved", "closed"].map(s => (
                <button
                  key={s}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "all" ? "الكل" : STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {allTickets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                <p className="font-semibold">لا توجد تذاكر في هذا التصنيف</p>
              </CardContent>
            </Card>
          ) : (
            allTickets.map(ticket => {
              const client = allClients.find(c => c.id === ticket.clientId);
              const typeInfo = TICKET_TYPES[ticket.type];
              return (
                <Card key={ticket.id} className={`hover:shadow-sm transition-shadow cursor-pointer ${ticket.priority === "urgent" ? "border-red-300" : ""}`}
                  onClick={() => setSelectedTicket(ticket.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeInfo?.color}`}>{typeInfo?.label}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[ticket.priority]}`}>{PRIORITY_LABELS[ticket.priority]}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ticket.status]}`}>{STATUS_LABELS[ticket.status]}</span>
                        </div>
                        <p className="font-semibold text-sm">{ticket.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {client?.name ?? "عميل غير معروف"} · {new Date(ticket.createdAt).toLocaleDateString("ar-SA")}
                        </p>
                        {ticket.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-3">
          {/* Ready to send */}
          {readyReports.length > 0 && (
            <Card className="border-green-300 bg-green-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-green-700 flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  تقارير جاهزة للإرسال ({readyReports.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {readyReports.map(report => {
                  const client = allClients.find(c => c.id === report.clientId);
                  return (
                    <div key={report.id} className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-green-700">{client?.name?.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{client?.name}</p>
                          <p className="text-xs text-muted-foreground">جاهز للإرسال</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-green-600 hover:bg-green-700 text-xs"
                        onClick={() => sendReportMutation.mutate({ reportId: report.id })}
                        disabled={sendReportMutation.isPending}
                      >
                        <Send className="w-3.5 h-3.5" />
                        إرسال
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* All clients status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">حالة عملائي — {monthLabel} {yearNum}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allClients.map(client => {
                  const report = myReports.find(r => r.clientId === client.id);
                  const stage = report?.stage ?? "no_report";
                  const colorClass = stageColors[stage] ?? "bg-gray-100 text-gray-500";
                  const clientTickets = allTickets.filter(t => t.clientId === client.id && t.status === "open");
                  return (
                    <div key={client.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{client.name?.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{client.name}</p>
                          {clientTickets.length > 0 && (
                            <Badge className="bg-red-100 text-red-700 border-0 text-[10px] shrink-0">
                              {clientTickets.length} تذكرة
                            </Badge>
                          )}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colorClass}`}>
                          {report ? REPORT_STAGES[stage as keyof typeof REPORT_STAGES]?.ar ?? stage : "لا يوجد تقرير"}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {allClients.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6 col-span-2">لا يوجد عملاء مسندون إليك</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ticket Detail Dialog */}
      <Dialog open={selectedTicket !== null} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          {selectedTicketData && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-primary" />
                  تفاصيل التذكرة
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${TICKET_TYPES[selectedTicketData.type]?.color}`}>
                    {TICKET_TYPES[selectedTicketData.type]?.label}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_COLORS[selectedTicketData.priority]}`}>
                    {PRIORITY_LABELS[selectedTicketData.priority]}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[selectedTicketData.status]}`}>
                    {STATUS_LABELS[selectedTicketData.status]}
                  </span>
                </div>
                <div>
                  <p className="font-semibold">{selectedTicketData.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {allClients.find(c => c.id === selectedTicketData.clientId)?.name} · {new Date(selectedTicketData.createdAt).toLocaleDateString("ar-SA")}
                  </p>
                </div>
                {selectedTicketData.description && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    {selectedTicketData.description}
                  </div>
                )}
                {selectedTicketData.resolution && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <p className="font-medium text-green-700 mb-1">الحل:</p>
                    {selectedTicketData.resolution}
                  </div>
                )}
                <div className="space-y-3 border-t pt-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">تحديث الحالة</label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_progress">قيد المعالجة</SelectItem>
                        <SelectItem value="resolved">محلولة</SelectItem>
                        <SelectItem value="closed">مغلقة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">ملاحظات الحل</label>
                    <Textarea
                      placeholder="اشرح كيف تم حل المشكلة..."
                      rows={3}
                      value={resolutionNote}
                      onChange={e => setResolutionNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedTicket(null)}>إغلاق</Button>
                <Button
                  disabled={updateTicketMutation.isPending}
                  onClick={() => {
                    updateTicketMutation.mutate({
                      id: selectedTicketData.id,
                      status: newStatus as any,
                      resolution: resolutionNote || undefined,
                    });
                  }}
                >
                  حفظ التحديث
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
