/**
 * AccountantWorkflow — task-based interface for accountants.
 * Shows only the accountant's own clients and their current workflow step.
 * Steps: 1) Receive Data → 2) Data Entry → 3) Justification → 4) Submit for Review → 5) Send Report
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import {
  Inbox,
  FileInput,
  FileCheck,
  Send,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Clock,
  Building2,
  ArrowRight,
  UploadCloud,
  MessageSquare,
  RefreshCw,
  Paperclip,
  Eye,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { REPORT_STAGES, DATA_FIELDS, MONTH_NAMES_AR } from "@shared/types";

// Workflow steps definition
const WORKFLOW_STEPS = [
  {
    id: "receive_data",
    stage: "data_entry",
    icon: Inbox,
    label: "استلام البيانات",
    desc: "تأكيد استلام البيانات من العميل لكل فئة",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    activeColor: "bg-blue-500",
  },
  {
    id: "data_entry",
    stage: "data_entry",
    icon: FileInput,
    label: "إدخال البيانات",
    desc: "إدخال البيانات في النظام ومطابقتها",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    activeColor: "bg-purple-500",
  },
  {
    id: "justification",
    stage: "justification",
    icon: MessageSquare,
    label: "الجستفيكيشن",
    desc: "إضافة التبريرات والملاحظات على التقرير",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    activeColor: "bg-yellow-500",
  },
  {
    id: "submit_review",
    stage: "audit_review",
    icon: FileCheck,
    label: "إرسال للمراجعة",
    desc: "إرسال التقرير لقائد الفريق للمراجعة والموافقة",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    activeColor: "bg-orange-500",
  },
  {
    id: "send_report",
    stage: "report_sent",
    icon: Send,
    label: "إرسال التقرير",
    desc: "إرسال التقرير النهائي للعميل بعد الموافقة",
    color: "bg-green-100 text-green-700 border-green-200",
    activeColor: "bg-green-500",
  },
];

const DATA_UPLOAD_TYPES = [
  { key: "bank", label: "كشف البنك" },
  { key: "salaries", label: "الرواتب" },
  { key: "sales", label: "المبيعات" },
  { key: "purchases", label: "المشتريات" },
  { key: "inventory", label: "المخزون" },
  { key: "other", label: "أخرى" },
] as const;

function getStepIndex(stage: string): number {
  if (stage === "data_entry" || stage === "justification") return 1;
  if (stage === "audit_review") return 3;
  if (stage === "quality_check") return 3;
  if (stage === "report_sent") return 4;
  if (stage === "sent_to_client") return 5;
  return 0;
}

export default function AccountantWorkflowPage() {
  const { user } = useAuth();
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

  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [ticketForm, setTicketForm] = useState({ type: "data_delay" as const, title: "", description: "", priority: "medium" as const });

  const { data: clients, isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const { data: reports, isLoading: reportsLoading } = trpc.reports.list.useQuery({ month: currentMonth });

  const selectedClient = clients?.find(c => c.id === selectedClientId) ?? clients?.[0] ?? null;
  const selectedReport = reports?.find(r => r.clientId === selectedClient?.id);

  const updateDataMutation = trpc.reports.updateDataStatus.useMutation({
    onSuccess: () => { utils.reports.list.invalidate(); toast.success("تم تحديث حالة البيانات"); },
    onError: (e) => toast.error(e.message),
  });

  const updateStageMutation = trpc.reports.updateStage.useMutation({
    onSuccess: () => { utils.reports.list.invalidate(); toast.success("تم تحديث مرحلة التقرير"); },
    onError: (e) => toast.error(e.message),
  });

  const createTicketMutation = trpc.csTickets.create.useMutation({
    onSuccess: () => { setShowTicketDialog(false); toast.success("تم رفع التذكرة للـ CS بنجاح"); },
    onError: (e) => toast.error(e.message),
  });

  // File review state
  const [reviewDialog, setReviewDialog] = useState<{ id: number; fileName: string; action: "approve" | "reject" | "reupload" } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: clientUploads, refetch: refetchUploads } = trpc.clientUploads.list.useQuery(
    { clientId: selectedClient?.id ?? 0, month: currentMonth },
    { enabled: !!selectedClient?.id }
  );

  const reviewMutation = trpc.clientUploads.review.useMutation({
    onSuccess: () => {
      refetchUploads();
      setReviewDialog(null);
      setRejectionReason("");
      toast.success("تم تحديث حالة الملف");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleReview = () => {
    if (!reviewDialog) return;
    const statusMap = { approve: "approved", reject: "rejected", reupload: "reupload_requested" } as const;
    reviewMutation.mutate({
      id: reviewDialog.id,
      status: statusMap[reviewDialog.action],
      rejectionReason: rejectionReason || undefined,
    });
  };

  const pendingUploads = (clientUploads ?? []).filter(u => u.status === "pending" && u.isLatest === 1);

  if (clientsLoading || reportsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const myClients = clients ?? [];
  const myReports = reports ?? [];

  // Stats
  const totalClients = myClients.length;
  const pendingData = myReports.filter(r => r.stage === "data_entry" && (r.bankStatus !== "received" || r.salariesStatus !== "received")).length;
  const inProgress = myReports.filter(r => ["data_entry", "justification"].includes(r.stage)).length;
  const waitingReview = myReports.filter(r => r.stage === "audit_review").length;
  const readyToSend = myReports.filter(r => r.stage === "report_sent").length;

  const handleDataStatusToggle = (field: string, current: string) => {
    if (!selectedReport) return;
    const next = current === "received" ? "not_received" : "received";
    updateDataMutation.mutate({ reportId: selectedReport.id, [field]: next } as any);
  };

  const handleMoveToJustification = () => {
    if (!selectedReport) return;
    updateStageMutation.mutate({ reportId: selectedReport.id, stage: "justification" });
  };

  const handleSubmitForReview = () => {
    if (!selectedReport) return;
    updateStageMutation.mutate({ reportId: selectedReport.id, stage: "audit_review" });
  };

  const handleSendReport = () => {
    if (!selectedReport) return;
    updateStageMutation.mutate({ reportId: selectedReport.id, stage: "sent_to_client" });
  };

  const activeStep = selectedReport ? getStepIndex(selectedReport.stage) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-primary" />
            سير العمل — {monthLabel} {yearNum}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">مهامك لهذا الشهر مرتبة حسب الأولوية</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowTicketDialog(true)}>
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          رفع تذكرة للـ CS
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "عملائي", value: totalClients, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "بيانات ناقصة", value: pendingData, icon: Inbox, color: "text-red-600", bg: "bg-red-50" },
          { label: "قيد الإنجاز", value: inProgress, icon: RefreshCw, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "جاهز للإرسال", value: readyToSend, icon: Send, color: "text-green-600", bg: "bg-green-50" },
        ].map(s => (
          <Card key={s.label} className="hover:shadow-sm transition-shadow">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Client List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">عملائي ({totalClients})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {myClients.map(client => {
                const report = myReports.find(r => r.clientId === client.id);
                const stage = report?.stage ?? "no_report";
                const stageInfo = report ? REPORT_STAGES[stage as keyof typeof REPORT_STAGES] : null;
                const isActive = selectedClient?.id === client.id;
                const dataFields = ["bankStatus", "salariesStatus", "salesStatus", "purchasesStatus", "inventoryStatus"] as const;
                const receivedCount = report ? dataFields.filter(f => (report as any)[f] === "received").length : 0;
                const hasIssue = report && receivedCount < 5 && stage === "data_entry";

                return (
                  <button
                    key={client.id}
                    className={`w-full text-right px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors ${isActive ? "bg-primary/5 border-r-2 border-primary" : ""}`}
                    onClick={() => setSelectedClientId(client.id)}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${isActive ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {client.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{client.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {stageInfo ? (
                          <span className="text-[10px] text-muted-foreground">{stageInfo.ar}</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">لا يوجد تقرير</span>
                        )}
                        {hasIssue && <AlertTriangle className="w-3 h-3 text-orange-500 shrink-0" />}
                      </div>
                    </div>
                    {report && (
                      <div className="shrink-0">
                        <Progress value={(receivedCount / 5) * 100} className="w-10 h-1" />
                      </div>
                    )}
                  </button>
                );
              })}
              {myClients.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">لا يوجد عملاء مسندون إليك</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Workflow Panel */}
        <Card className="lg:col-span-2">
          {!selectedClient ? (
            <CardContent className="flex items-center justify-center h-64">
              <p className="text-muted-foreground text-sm">اختر عميلاً من القائمة لعرض مهامه</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">{selectedClient.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedReport ? `تقرير ${monthLabel} ${yearNum}` : "لا يوجد تقرير لهذا الشهر"}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => selectedReport && setLocation(`/reports/${selectedReport.id}`)}>
                    عرض التقرير
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Workflow Steps */}
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                  {WORKFLOW_STEPS.map((step, idx) => {
                    const isDone = activeStep > idx;
                    const isActive = activeStep === idx;
                    return (
                      <div key={step.id} className="flex items-center gap-1 shrink-0">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          isDone ? "bg-green-100 text-green-700 border-green-200" :
                          isActive ? step.color :
                          "bg-muted/50 text-muted-foreground border-border"
                        }`}>
                          {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <step.icon className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">{step.label}</span>
                        </div>
                        {idx < WORKFLOW_STEPS.length - 1 && (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {!selectedReport ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>لم يتم إنشاء تقرير لهذا الشهر بعد</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Step 1: Data Receipt */}
                    <div className={`p-4 rounded-xl border-2 transition-all ${activeStep === 0 ? "border-blue-300 bg-blue-50/50" : "border-border bg-muted/20"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Inbox className={`w-4 h-4 ${activeStep === 0 ? "text-blue-600" : "text-muted-foreground"}`} />
                          <span className="text-sm font-semibold">١. استلام البيانات</span>
                          {pendingUploads.length > 0 && (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                              {pendingUploads.length}
                            </span>
                          )}
                        </div>
                        {activeStep > 0 && <Badge className="bg-green-100 text-green-700 border-0 text-xs">مكتمل</Badge>}
                      </div>

                      {/* Uploaded files from client — grouped by category */}
                      {(clientUploads ?? []).length > 0 ? (
                        <div className="mb-4 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5" />
                            الملفات المرفوعة من العميل
                          </p>
                          {["bank","salaries","sales","purchases","inventory","other"].map(cat => {
                            const catLabels: Record<string,string> = { bank:"كشف البنك", salaries:"الرواتب", sales:"المبيعات", purchases:"المشتريات", inventory:"المخزون", other:"أخرى" };
                            const catFiles = (clientUploads ?? []).filter(u => u.type === cat && u.isLatest === 1);
                            if (catFiles.length === 0) return null;
                            return (
                              <div key={cat}>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{catLabels[cat]}</p>
                                <div className="space-y-1">
                                  {catFiles.map(file => {
                                    const sc = { pending:"border-yellow-300 bg-yellow-50", approved:"border-green-300 bg-green-50", rejected:"border-red-300 bg-red-50", reupload_requested:"border-orange-300 bg-orange-50" }[file.status as string] ?? "border-border bg-muted/20";
                                    const sl = { pending:"بانتظار المراجعة", approved:"تمت الموافقة", rejected:"مرفوض", reupload_requested:"مطلوب إعادة الرفع" }[file.status as string] ?? file.status;
                                    return (
                                      <div key={file.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${sc}`}>
                                        <Paperclip className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium truncate">{file.fileName}</p>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground">{sl}</span>
                                            {file.version && file.version > 1 && <span className="text-[10px] text-muted-foreground">• الإصدار {file.version}</span>}
                                          </div>
                                          {file.rejectionReason && (
                                            <p className="text-[10px] text-red-600 mt-0.5">سبب الرفض: {file.rejectionReason}</p>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                          {/* Download button */}
                                          <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" download={file.fileName}>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" title="تحميل الملف">
                                              <Eye className="w-3.5 h-3.5" />
                                            </Button>
                                          </a>
                                          {/* Review buttons — only for pending files */}
                                          {file.status === "pending" && (
                                            <>
                                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-50" title="موافقة"
                                                onClick={() => setReviewDialog({ id: file.id, fileName: file.fileName, action: "approve" })}>
                                                <ThumbsUp className="w-3.5 h-3.5" />
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-600 hover:bg-orange-50" title="طلب إعادة الرفع"
                                                onClick={() => setReviewDialog({ id: file.id, fileName: file.fileName, action: "reupload" })}>
                                                <RotateCcw className="w-3.5 h-3.5" />
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50" title="رفض"
                                                onClick={() => setReviewDialog({ id: file.id, fileName: file.fileName, action: "reject" })}>
                                                <ThumbsDown className="w-3.5 h-3.5" />
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg border border-dashed border-border text-muted-foreground text-xs">
                          <Paperclip className="w-4 h-4 shrink-0 opacity-40" />
                          <span>لم يرفع العميل أي ملفات بعد لهذا الشهر</span>
                        </div>
                      )}

                      {/* Manual data receipt toggles */}
                      <p className="text-xs font-semibold text-muted-foreground mb-2">تأكيد استلام البيانات يدوياً</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {DATA_FIELDS.map(field => {
                          const status = (selectedReport as any)[field.key] as string;
                          const isReceived = status === "received";
                          return (
                            <button
                              key={field.key}
                              className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                                isReceived
                                  ? "bg-green-100 text-green-700 border-green-300"
                                  : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                              }`}
                              onClick={() => handleDataStatusToggle(field.key, status)}
                              disabled={updateDataMutation.isPending}
                            >
                              <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isReceived ? "text-green-600" : "text-muted-foreground/40"}`} />
                              {field.ar}
                            </button>
                          );
                        })}
                      </div>
                      {activeStep === 0 && (
                        <Button
                          size="sm"
                          className="mt-3 w-full gap-1.5"
                          onClick={handleMoveToJustification}
                          disabled={updateStageMutation.isPending}
                        >
                          <ArrowRight className="w-4 h-4" />
                          الانتقال لمرحلة الجستفيكيشن
                        </Button>
                      )}
                    </div>

                    {/* Step 2: Justification */}
                    <div className={`p-4 rounded-xl border-2 transition-all ${selectedReport.stage === "justification" ? "border-yellow-300 bg-yellow-50/50" : "border-border bg-muted/20"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <MessageSquare className={`w-4 h-4 ${selectedReport.stage === "justification" ? "text-yellow-600" : "text-muted-foreground"}`} />
                          <span className="text-sm font-semibold">٢. الجستفيكيشن والملاحظات</span>
                        </div>
                        {["audit_review", "quality_check", "report_sent", "sent_to_client"].includes(selectedReport.stage) && (
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs">مكتمل</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">أضف التبريرات والملاحظات على التقرير في صفحة التقرير</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setLocation(`/reports/${selectedReport.id}`)}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        فتح صفحة التقرير
                      </Button>
                      {selectedReport.stage === "justification" && (
                        <Button
                          size="sm"
                          className="mt-2 w-full gap-1.5"
                          onClick={handleSubmitForReview}
                          disabled={updateStageMutation.isPending}
                        >
                          <FileCheck className="w-4 h-4" />
                          إرسال للمراجعة
                        </Button>
                      )}
                    </div>

                    {/* Step 3: Awaiting Review */}
                    <div className={`p-4 rounded-xl border-2 transition-all ${selectedReport.stage === "audit_review" || selectedReport.stage === "quality_check" ? "border-orange-300 bg-orange-50/50" : "border-border bg-muted/20"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className={`w-4 h-4 ${["audit_review", "quality_check"].includes(selectedReport.stage) ? "text-orange-600" : "text-muted-foreground"}`} />
                          <span className="text-sm font-semibold">٣. بانتظار مراجعة قائد الفريق</span>
                        </div>
                        {["report_sent", "sent_to_client"].includes(selectedReport.stage) && (
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs">موافق عليه</Badge>
                        )}
                        {["audit_review", "quality_check"].includes(selectedReport.stage) && (
                          <Badge className="bg-orange-100 text-orange-700 border-0 text-xs animate-pulse">بانتظار المراجعة</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">قائد الفريق سيراجع التقرير ويوافق عليه أو يرفضه مع ملاحظات</p>
                    </div>

                    {/* Step 4: Send Report */}
                    <div className={`p-4 rounded-xl border-2 transition-all ${selectedReport.stage === "report_sent" ? "border-green-300 bg-green-50/50" : "border-border bg-muted/20"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Send className={`w-4 h-4 ${selectedReport.stage === "report_sent" ? "text-green-600" : "text-muted-foreground"}`} />
                          <span className="text-sm font-semibold">٤. إرسال التقرير للعميل</span>
                        </div>
                        {selectedReport.stage === "sent_to_client" && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">تم الإرسال</Badge>
                        )}
                      </div>
                      {selectedReport.stage === "report_sent" && (
                        <>
                          <p className="text-xs text-muted-foreground mb-3">تمت الموافقة على التقرير. يمكنك الآن إرساله للعميل</p>
                          <Button
                            size="sm"
                            className="w-full gap-1.5 bg-green-600 hover:bg-green-700"
                            onClick={handleSendReport}
                            disabled={updateStageMutation.isPending}
                          >
                            <Send className="w-4 h-4" />
                            إرسال التقرير للعميل
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>



      {/* File Review Confirmation Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => { setReviewDialog(null); setRejectionReason(""); }}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewDialog?.action === "approve" && <ThumbsUp className="w-5 h-5 text-green-600" />}
              {reviewDialog?.action === "reject" && <ThumbsDown className="w-5 h-5 text-red-600" />}
              {reviewDialog?.action === "reupload" && <RotateCcw className="w-5 h-5 text-orange-600" />}
              {reviewDialog?.action === "approve" ? "الموافقة على الملف" :
               reviewDialog?.action === "reject" ? "رفض الملف" :
               "طلب إعادة الرفع"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              الملف: <span className="font-medium text-foreground">{reviewDialog?.fileName}</span>
            </p>
            {reviewDialog?.action !== "approve" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {reviewDialog?.action === "reject" ? "سبب الرفض *" : "ملاحظات للعميل *"}
                </label>
                <Textarea
                  placeholder={reviewDialog?.action === "reject"
                    ? "مثلاً: الفاتورة رقم 5 تحتوي على خطأ في المبلغ"
                    : "مثلاً: يرجى إرسال الكشف كاملاً بدون قطع"}
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setReviewDialog(null); setRejectionReason(""); }}>إلغاء</Button>
            <Button
              onClick={handleReview}
              disabled={reviewMutation.isPending || (reviewDialog?.action !== "approve" && !rejectionReason.trim())}
              className={reviewDialog?.action === "approve" ? "bg-green-600 hover:bg-green-700" :
                         reviewDialog?.action === "reject" ? "bg-red-600 hover:bg-red-700" :
                         "bg-orange-600 hover:bg-orange-700"}
            >
              {reviewMutation.isPending ? "جارٍ الحفظ..." :
               reviewDialog?.action === "approve" ? "موافقة" :
               reviewDialog?.action === "reject" ? "رفض" :
               "طلب إعادة الرفع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Raise CS Ticket Dialog */}
      <Dialog open={showTicketDialog} onOpenChange={setShowTicketDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              رفع تذكرة للـ Customer Success
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">العميل</label>
              <Select onValueChange={(v) => setSelectedClientId(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent>
                  {myClients.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">نوع المشكلة</label>
              <Select value={ticketForm.type} onValueChange={(v: any) => setTicketForm(f => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="data_delay">تأخر في تسليم البيانات</SelectItem>
                  <SelectItem value="complaint">شكوى</SelectItem>
                  <SelectItem value="extra_service">خدمة إضافية</SelectItem>
                  <SelectItem value="volume_increase">ارتفاع حجم العمل</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الأولوية</label>
              <Select value={ticketForm.priority} onValueChange={(v: any) => setTicketForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">العنوان</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="وصف مختصر للمشكلة"
                value={ticketForm.title}
                onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">التفاصيل (اختياري)</label>
              <Textarea
                placeholder="اشرح المشكلة بالتفصيل..."
                rows={3}
                value={ticketForm.description}
                onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowTicketDialog(false)}>إلغاء</Button>
            <Button
              disabled={!selectedClientId || !ticketForm.title || createTicketMutation.isPending}
              onClick={() => {
                if (!selectedClientId || !ticketForm.title) return;
                createTicketMutation.mutate({
                  clientId: selectedClientId,
                  type: ticketForm.type,
                  priority: ticketForm.priority,
                  title: ticketForm.title,
                  description: ticketForm.description || undefined,
                  month: currentMonth,
                });
              }}
            >
              رفع التذكرة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
