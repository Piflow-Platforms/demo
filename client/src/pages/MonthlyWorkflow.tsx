/**
 * MonthlyWorkflow — unified page for all roles.
 * - Accountant: sees their clients, picks one, works through the full workflow
 *   (receive data → data entry → justification → review → send report)
 * - Other roles: sees filtered reports list with stage distribution and filters
 *
 * Replaces both AccountantWorkflow (/my-tasks) and MonthlyReports (/monthly, /reports)
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
  ChevronLeft,
  AlertTriangle,
  Clock,
  Building2,
  ArrowRight,
  MessageSquare,
  RefreshCw,
  Paperclip,
  Eye,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Calendar,
  FileText,
  Plus,
  Receipt,
  BarChart3,
  Filter,
  Upload,
  Download,
  Trash2,
  FileSpreadsheet,
  File,
  User,
} from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  REPORT_STAGES,
  DATA_FIELDS,
  MONTH_NAMES_AR,
  isVatDueMonth,
  getVatQuarter,
} from "@shared/types";
import type { DataStatus } from "@shared/types";
import FilterBar, { type FilterValues } from "@/components/FilterBar";
import { usePreviewRole } from "@/components/DashboardLayout";

// ─── Shared constants ────────────────────────────────────────────────────────

const stageColors: Record<string, string> = {
  data_entry: "bg-blue-100 text-blue-700",
  justification: "bg-yellow-100 text-yellow-700",
  audit_review: "bg-orange-100 text-orange-700",
  quality_check: "bg-purple-100 text-purple-700",
  report_sent: "bg-green-100 text-green-700",
  sent_to_client: "bg-emerald-100 text-emerald-700",
};

const stageProgress: Record<string, number> = {
  data_entry: 16,
  justification: 33,
  audit_review: 50,
  quality_check: 66,
  report_sent: 83,
  sent_to_client: 100,
};

const WORKFLOW_STEPS = [
  { id: "receive_data", icon: Inbox, label: "استلام البيانات", color: "bg-blue-100 text-blue-700 border-blue-200", stage: "data_entry" },
  { id: "data_entry", icon: FileInput, label: "إدخال البيانات", color: "bg-purple-100 text-purple-700 border-purple-200", stage: "data_entry" },
  { id: "justification", icon: MessageSquare, label: "الجستفيكيشن", color: "bg-yellow-100 text-yellow-700 border-yellow-200", stage: "justification" },
  { id: "submit_review", icon: FileCheck, label: "إرسال للمراجعة", color: "bg-orange-100 text-orange-700 border-orange-200", stage: "audit_review" },
  { id: "send_report", icon: Send, label: "إرسال التقرير", color: "bg-green-100 text-green-700 border-green-200", stage: "report_sent" },
];

function getStepIndex(stage: string): number {
  if (stage === "data_entry") return 1;
  if (stage === "justification") return 2;
  if (stage === "audit_review" || stage === "quality_check") return 3;
  if (stage === "report_sent") return 4;
  if (stage === "sent_to_client") return 5;
  return 0;
}

// ─── Accountant workflow view ─────────────────────────────────────────────────

function AccountantView({ currentMonth, monthLabel, yearNum }: { currentMonth: string; monthLabel: string; yearNum: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [ticketForm, setTicketForm] = useState({ type: "data_delay" as const, title: "", description: "", priority: "medium" as const });
  const [reviewDialog, setReviewDialog] = useState<{ id: number; fileName: string; action: "approve" | "reject" | "reupload" } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [newComment, setNewComment] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients, isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const { data: reports, isLoading: reportsLoading } = trpc.reports.list.useQuery({ month: currentMonth });

  const selectedClient = clients?.find(c => c.id === selectedClientId) ?? clients?.[0] ?? null;
  const selectedReport = reports?.find(r => r.clientId === selectedClient?.id);

  const { data: clientUploads, refetch: refetchUploads } = trpc.clientUploads.list.useQuery(
    { clientId: selectedClient?.id ?? 0, month: currentMonth },
    { enabled: !!selectedClient?.id }
  );

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

  const reviewMutation = trpc.clientUploads.review.useMutation({
    onSuccess: () => { refetchUploads(); setReviewDialog(null); setRejectionReason(""); toast.success("تم تحديث حالة الملف"); },
    onError: (e) => toast.error(e.message),
  });

  const uploadFileMutation = trpc.reportFiles.upload.useMutation({
    onSuccess: () => { utils.reports.list.invalidate(); setIsUploadingFile(false); toast.success("تم رفع ملف التقرير"); },
    onError: (err: any) => { setIsUploadingFile(false); toast.error(err.message); },
  });

  const removeFileMutation = trpc.reportFiles.remove.useMutation({
    onSuccess: () => { utils.reports.list.invalidate(); toast.success("تم حذف ملف التقرير"); },
    onError: (err: any) => toast.error(err.message),
  });

  const { data: commentsData, refetch: refetchComments } = trpc.reportComments.list.useQuery(
    { reportId: selectedReport?.id ?? 0 },
    { enabled: !!selectedReport?.id }
  );

  const addCommentMutation = trpc.reportComments.add.useMutation({
    onSuccess: () => { refetchComments(); setNewComment(""); toast.success("تم إضافة التعليق"); },
    onError: (e) => toast.error(e.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedReport) return;
    if (file.size > 16 * 1024 * 1024) { toast.error("حجم الملف يتجاوز 16 ميجابايت"); return; }
    setIsUploadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadFileMutation.mutate({ reportId: selectedReport.id, base64Data: base64, fileName: file.name, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReview = () => {
    if (!reviewDialog) return;
    const statusMap = { approve: "approved", reject: "rejected", reupload: "reupload_requested" } as const;
    reviewMutation.mutate({ id: reviewDialog.id, status: statusMap[reviewDialog.action], rejectionReason: rejectionReason || undefined });
  };

  const handleDataStatusToggle = (field: string, current: string) => {
    if (!selectedReport) return;
    const next = current === "received" ? "not_received" : "received";
    updateDataMutation.mutate({ reportId: selectedReport.id, [field]: next } as any);
  };

  const pendingUploads = (clientUploads ?? []).filter(u => u.status === "pending" && u.isLatest === 1);

  if (clientsLoading || reportsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const myClients = clients ?? [];
  const myReports = reports ?? [];

  const totalClients = myClients.length;
  const pendingData = myReports.filter(r => r.stage === "data_entry" && (r.bankStatus !== "received" || r.salariesStatus !== "received")).length;
  const inProgress = myReports.filter(r => ["data_entry", "justification"].includes(r.stage)).length;
  const readyToSend = myReports.filter(r => r.stage === "report_sent").length;
  const completed = myReports.filter(r => r.stage === "sent_to_client").length;
  const overallProgress = totalClients > 0 ? Math.round((completed / totalClients) * 100) : 0;

  const activeStep = selectedReport ? getStepIndex(selectedReport.stage) : 0;

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "عملائي", value: totalClients, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "بيانات ناقصة", value: pendingData, icon: Inbox, color: "text-red-600", bg: "bg-red-50" },
          { label: "قيد الإنجاز", value: inProgress, icon: RefreshCw, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "مكتمل", value: completed, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
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

      {/* Overall progress */}
      {totalClients > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">نسبة إنجاز الشهر</span>
              <span className="text-sm font-bold text-primary">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Main split: client list + workflow panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Client List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                عملائي ({totalClients})
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-orange-600" onClick={() => setShowTicketDialog(true)}>
                <AlertTriangle className="w-3.5 h-3.5" />
                تذكرة CS
              </Button>
            </div>
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
                const progress = report ? stageProgress[stage] ?? 0 : 0;

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
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <Progress value={progress} className="w-12 h-1.5" />
                      <span className="text-[9px] text-muted-foreground">{progress}%</span>
                    </div>
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
              <div className="text-center text-muted-foreground">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">اختر عميلاً من القائمة لعرض سير العمل</p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">{selectedClient.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedReport
                        ? `تقرير ${monthLabel} ${yearNum} — ${REPORT_STAGES[selectedReport.stage as keyof typeof REPORT_STAGES]?.ar ?? selectedReport.stage}`
                        : `لا يوجد تقرير لـ ${monthLabel} ${yearNum}`}
                    </p>
                  </div>

                </div>

                {/* Workflow steps bar */}
                {selectedReport && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 mt-3">
                    {WORKFLOW_STEPS.map((step, idx) => {
                      const isDone = activeStep > idx;
                      const isStepActive = activeStep === idx;
                      return (
                        <div key={step.id} className="flex items-center gap-1 shrink-0">
                          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isDone ? "bg-green-100 text-green-700 border-green-200" :
                            isStepActive ? step.color :
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
                )}
              </CardHeader>

              <CardContent className="p-0">
                {!selectedReport ? (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <div className="text-center">
                      <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">لم يتم إنشاء تقرير لهذا الشهر بعد</p>
                      <p className="text-xs mt-1 opacity-70">استخدم زر "إنشاء تقارير الشهر" من صفحة التقارير</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-border">

                    {/* ══ SECTION 1: البيانات المرفوعة من العميل ══ */}
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            activeStep > 0 ? "bg-green-500 text-white" : "bg-blue-500 text-white"
                          }`}>
                            {activeStep > 0 ? <CheckCircle2 className="w-4 h-4" /> : "١"}
                          </div>
                          <div>
                            <p className="text-sm font-bold">البيانات المرفوعة من العميل</p>
                            <p className="text-xs text-muted-foreground">الملفات التي أرسلها العميل للمعالجة</p>
                          </div>
                        </div>
                        {pendingUploads.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {pendingUploads.length} بانتظار المراجعة
                          </span>
                        )}
                        {pendingUploads.length === 0 && (clientUploads ?? []).length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            تمت المراجعة
                          </span>
                        )}
                      </div>

                      {/* Uploaded files by category */}
                      {(clientUploads ?? []).length > 0 ? (
                        <div className="space-y-3">
                          {["bank","salaries","sales","purchases","inventory","other"].map(cat => {
                            const catLabels: Record<string,string> = { bank:"كشف البنك", salaries:"الرواتب", sales:"المبيعات", purchases:"المشتريات", inventory:"المخزون", other:"أخرى" };
                            const catFiles = (clientUploads ?? []).filter(u => u.type === cat && u.isLatest === 1);
                            if (catFiles.length === 0) return null;
                            return (
                              <div key={cat} className="rounded-xl border border-border overflow-hidden">
                                <div className="px-3 py-2 bg-muted/40 flex items-center gap-2">
                                  <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-xs font-semibold text-muted-foreground">{catLabels[cat]}</span>
                                  <span className="text-[10px] text-muted-foreground ml-auto">{catFiles.length} ملف</span>
                                </div>
                                <div className="divide-y divide-border">
                                  {catFiles.map(file => {
                                    const statusStyles: Record<string, { border: string; bg: string; label: string; labelColor: string }> = {
                                      pending: { border: "border-yellow-200", bg: "bg-yellow-50/50", label: "بانتظار المراجعة", labelColor: "text-yellow-700" },
                                      approved: { border: "border-green-200", bg: "bg-green-50/50", label: "تمت الموافقة", labelColor: "text-green-700" },
                                      rejected: { border: "border-red-200", bg: "bg-red-50/50", label: "مرفوض", labelColor: "text-red-700" },
                                      reupload_requested: { border: "border-orange-200", bg: "bg-orange-50/50", label: "مطلوب إعادة الرفع", labelColor: "text-orange-700" },
                                    };
                                    const ss = statusStyles[file.status as string] ?? { border: "", bg: "", label: file.status, labelColor: "text-muted-foreground" };
                                    return (
                                      <div key={file.id} className={`flex items-center gap-3 px-3 py-3 ${ss.bg}`}>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <Paperclip className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                            <p className="text-sm font-medium truncate">{file.fileName}</p>
                                            {file.version && file.version > 1 && (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">v{file.version}</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 pr-5">
                                            <span className={`text-[11px] font-medium ${ss.labelColor}`}>{ss.label}</span>
                                            {file.rejectionReason && (
                                              <span className="text-[11px] text-red-600">— {file.rejectionReason}</span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                                              <Eye className="w-3.5 h-3.5" />
                                              عرض
                                            </Button>
                                          </a>
                                          {file.status === "pending" && (
                                            <>
                                              <Button size="sm" className="h-8 gap-1 text-xs bg-green-600 hover:bg-green-700"
                                                onClick={() => setReviewDialog({ id: file.id, fileName: file.fileName, action: "approve" })}>
                                                <ThumbsUp className="w-3.5 h-3.5" />
                                                قبول
                                              </Button>
                                              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                                                onClick={() => setReviewDialog({ id: file.id, fileName: file.fileName, action: "reupload" })}>
                                                <RotateCcw className="w-3.5 h-3.5" />
                                                إعادة
                                              </Button>
                                              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs text-red-600 border-red-300 hover:bg-red-50"
                                                onClick={() => setReviewDialog({ id: file.id, fileName: file.fileName, action: "reject" })}>
                                                <ThumbsDown className="w-3.5 h-3.5" />
                                                رفض
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
                        <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-border text-muted-foreground">
                          <Paperclip className="w-8 h-8 mb-2 opacity-30" />
                          <p className="text-sm">لم يرفع العميل أي ملفات بعد لهذا الشهر</p>
                          <p className="text-xs mt-1 opacity-60">ستظهر الملفات هنا بمجرد رفع العميل بياناته</p>
                        </div>
                      )}

                      {/* Manual data receipt toggles */}
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          تأكيد استلام البيانات يدوياً
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {DATA_FIELDS.map(field => {
                            const status = (selectedReport as any)[field.key] as string;
                            const isReceived = status === "received";
                            return (
                              <button
                                key={field.key}
                                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                                  isReceived ? "bg-green-100 text-green-700 border-green-300" : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
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
                      </div>

                      {activeStep === 0 && (
                        <Button size="sm" className="mt-4 w-full gap-1.5"
                          onClick={() => updateStageMutation.mutate({ reportId: selectedReport.id, stage: "justification" })}
                          disabled={updateStageMutation.isPending}>
                          <ArrowRight className="w-4 h-4" />
                          الانتقال لمرحلة الجستفيكيشن
                        </Button>
                      )}
                    </div>

                    {/* ══ SECTION 2: إدخال البيانات والجستفيكيشن ══ */}
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            ["audit_review","quality_check","report_sent","sent_to_client"].includes(selectedReport.stage)
                              ? "bg-green-500 text-white"
                              : selectedReport.stage === "justification"
                              ? "bg-yellow-500 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {["audit_review","quality_check","report_sent","sent_to_client"].includes(selectedReport.stage)
                              ? <CheckCircle2 className="w-4 h-4" />
                              : "٢"}
                          </div>
                          <div>
                            <p className="text-sm font-bold">إدخال البيانات والجستفيكيشن</p>
                            <p className="text-xs text-muted-foreground">إدخال البيانات في النظام وإصدار التبريرات</p>
                          </div>
                        </div>
                        {["audit_review","quality_check","report_sent","sent_to_client"].includes(selectedReport.stage) && (
                          <Badge className="bg-green-100 text-green-700 border-0">مكتمل</Badge>
                        )}
                        {selectedReport.stage === "justification" && (
                          <Badge className="bg-yellow-100 text-yellow-700 border-0 animate-pulse">جارٍ العمل</Badge>
                        )}
                        {selectedReport.stage === "data_entry" && (
                          <Badge variant="outline" className="text-muted-foreground">في الانتظار</Badge>
                        )}
                      </div>

                      {/* ── Report File ── */}
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          ملف التقرير
                        </p>
                        {(selectedReport as any).reportFileUrl ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                              {(selectedReport as any).reportFileMime?.includes("pdf") ? (
                                <FileText className="w-5 h-5 text-red-500 shrink-0" />
                              ) : (selectedReport as any).reportFileMime?.includes("spreadsheet") || (selectedReport as any).reportFileMime?.includes("excel") || (selectedReport as any).reportFileMime?.includes("xlsx") ? (
                                <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
                              ) : (
                                <File className="w-5 h-5 text-blue-500 shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{(selectedReport as any).reportFileName}</p>
                                <p className="text-xs text-muted-foreground">{(selectedReport as any).reportFileMime}</p>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                                  onClick={() => window.open((selectedReport as any).reportFileUrl, "_blank")}>
                                  <Eye className="w-3.5 h-3.5" />عرض
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                                  <a href={(selectedReport as any).reportFileUrl} download={(selectedReport as any).reportFileName ?? "report"}>
                                    <Download className="w-3.5 h-3.5" />تحميل
                                  </a>
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
                                  onClick={() => removeFileMutation.mutate({ reportId: selectedReport.id })}
                                  disabled={removeFileMutation.isPending}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                            <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.doc,.docx" className="hidden" onChange={handleFileSelect} />
                            <Button variant="outline" size="sm" className="gap-2 text-xs"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploadingFile || uploadFileMutation.isPending}>
                              <Upload className="w-3.5 h-3.5" />
                              {isUploadingFile || uploadFileMutation.isPending ? "جاري الرفع..." : "استبدال الملف"}
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center py-5 border-2 border-dashed rounded-lg">
                            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                            <p className="text-xs text-muted-foreground mb-3">لم يتم إرفاق ملف التقرير بعد</p>
                            <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.doc,.docx" className="hidden" onChange={handleFileSelect} />
                            <Button variant="outline" size="sm" className="gap-2 text-xs"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploadingFile || uploadFileMutation.isPending}>
                              <Upload className="w-3.5 h-3.5" />
                              {isUploadingFile || uploadFileMutation.isPending ? "جاري الرفع..." : "رفع ملف التقرير"}
                            </Button>
                            <p className="text-[10px] text-muted-foreground mt-1.5">PDF, Excel, Word — حد أقصى 16 ميجابايت</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-4">
                        {selectedReport.stage === "justification" && (
                          <Button size="sm" className="gap-1.5 flex-1"
                            onClick={() => updateStageMutation.mutate({ reportId: selectedReport.id, stage: "audit_review" })}
                            disabled={updateStageMutation.isPending}>
                            <FileCheck className="w-3.5 h-3.5" />
                            إرسال للمراجعة
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* ══ SECTION 3: مراجعة قائد الفريق ══ */}
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            ["report_sent","sent_to_client"].includes(selectedReport.stage)
                              ? "bg-green-500 text-white"
                              : ["audit_review","quality_check"].includes(selectedReport.stage)
                              ? "bg-orange-500 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {["report_sent","sent_to_client"].includes(selectedReport.stage)
                              ? <CheckCircle2 className="w-4 h-4" />
                              : "٣"}
                          </div>
                          <div>
                            <p className="text-sm font-bold">مراجعة قائد الفريق</p>
                            <p className="text-xs text-muted-foreground">قائد الفريق يراجع التقرير ويوافق أو يطلب تعديلات</p>
                          </div>
                        </div>
                        {["report_sent","sent_to_client"].includes(selectedReport.stage) && (
                          <Badge className="bg-green-100 text-green-700 border-0">موافق عليه</Badge>
                        )}
                        {["audit_review","quality_check"].includes(selectedReport.stage) && (
                          <Badge className="bg-orange-100 text-orange-700 border-0 animate-pulse">بانتظار المراجعة</Badge>
                        )}
                        {["data_entry","justification"].includes(selectedReport.stage) && (
                          <Badge variant="outline" className="text-muted-foreground">في الانتظار</Badge>
                        )}
                      </div>

                      {["audit_review","quality_check"].includes(selectedReport.stage) && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200">
                          <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                          <p className="text-xs text-orange-700">التقرير مُرسل لقائد الفريق وبانتظار مراجعته. ستصلك إشعار عند الموافقة أو طلب التعديل.</p>
                        </div>
                      )}
                      {["report_sent","sent_to_client"].includes(selectedReport.stage) && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                          <p className="text-xs text-green-700">وافق قائد الفريق على التقرير. يمكنك الآن إرساله للعميل.</p>
                        </div>
                      )}
                    </div>

                    {/* ══ SECTION 4: التقرير النهائي ══ */}
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            selectedReport.stage === "sent_to_client"
                              ? "bg-emerald-500 text-white"
                              : selectedReport.stage === "report_sent"
                              ? "bg-green-500 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {selectedReport.stage === "sent_to_client"
                              ? <CheckCircle2 className="w-4 h-4" />
                              : "٤"}
                          </div>
                          <div>
                            <p className="text-sm font-bold">التقرير النهائي</p>
                            <p className="text-xs text-muted-foreground">إرسال التقرير النهائي للعميل</p>
                          </div>
                        </div>
                        {selectedReport.stage === "sent_to_client" && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0">✓ تم الإرسال</Badge>
                        )}
                        {selectedReport.stage === "report_sent" && (
                          <Badge className="bg-green-100 text-green-700 border-0 animate-pulse">جاهز للإرسال</Badge>
                        )}
                        {!["report_sent","sent_to_client"].includes(selectedReport.stage) && (
                          <Badge variant="outline" className="text-muted-foreground">في الانتظار</Badge>
                        )}
                      </div>

                      {selectedReport.stage === "report_sent" && (
                        <>
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 mb-3">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            <p className="text-xs text-green-700">تمت الموافقة على التقرير من قائد الفريق. يمكنك الآن إرساله للعميل.</p>
                          </div>
                          <Button size="sm" className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => updateStageMutation.mutate({ reportId: selectedReport.id, stage: "sent_to_client" })}
                            disabled={updateStageMutation.isPending}>
                            <Send className="w-4 h-4" />
                            إرسال التقرير للعميل
                          </Button>
                        </>
                      )}
                      {selectedReport.stage === "sent_to_client" && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <p className="text-xs text-emerald-700 font-medium">تم إرسال التقرير للعميل بنجاح. العملية مكتملة لهذا الشهر.</p>
                        </div>
                      )}
                      {!["report_sent","sent_to_client"].includes(selectedReport.stage) && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border">
                          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                          <p className="text-xs text-muted-foreground">يتوفر هذا الخيار بعد موافقة قائد الفريق على التقرير.</p>
                        </div>
                      )}
                    </div>

                    {/* ══ SECTION 5: التعليقات والملاحظات ══ */}
                    <div className="p-5">
                      <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-muted text-muted-foreground">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">التعليقات والملاحظات</p>
                          <p className="text-xs text-muted-foreground">تواصل داخلي بين الفريق</p>
                        </div>
                        {(commentsData ?? []).length > 0 && (
                          <span className="mr-auto inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                            {(commentsData ?? []).length}
                          </span>
                        )}
                      </div>

                      {/* Comments list */}
                      {(commentsData ?? []).length > 0 ? (
                        <div className="space-y-2.5 mb-4">
                          {(commentsData ?? []).map((c: any) => (
                            <div key={c.id} className="flex gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                <User className="w-3.5 h-3.5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-semibold">{c.userName}</span>
                                  <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                                <p className="text-xs text-foreground/80 leading-relaxed">{c.comment}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground text-xs mb-4">
                          لا توجد تعليقات بعد
                        </div>
                      )}

                      {/* Add comment */}
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="اكتب تعليقك هنا..."
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          rows={2}
                          className="text-xs resize-none flex-1"
                        />
                        <Button size="sm" className="shrink-0 self-end gap-1"
                          onClick={() => { if (newComment.trim() && selectedReport) addCommentMutation.mutate({ reportId: selectedReport.id, comment: newComment.trim() }); }}
                          disabled={!newComment.trim() || addCommentMutation.isPending}>
                          <Send className="w-3.5 h-3.5" />
                          إرسال
                        </Button>
                      </div>
                    </div>

                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* File Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => { setReviewDialog(null); setRejectionReason(""); }}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewDialog?.action === "approve" && <ThumbsUp className="w-5 h-5 text-green-600" />}
              {reviewDialog?.action === "reject" && <ThumbsDown className="w-5 h-5 text-red-600" />}
              {reviewDialog?.action === "reupload" && <RotateCcw className="w-5 h-5 text-orange-600" />}
              {reviewDialog?.action === "approve" ? "الموافقة على الملف" : reviewDialog?.action === "reject" ? "رفض الملف" : "طلب إعادة الرفع"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">الملف: <span className="font-medium text-foreground">{reviewDialog?.fileName}</span></p>
            {reviewDialog?.action !== "approve" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{reviewDialog?.action === "reject" ? "سبب الرفض *" : "ملاحظات للعميل *"}</label>
                <Textarea
                  placeholder={reviewDialog?.action === "reject" ? "مثلاً: الفاتورة رقم 5 تحتوي على خطأ في المبلغ" : "مثلاً: يرجى إرسال الكشف كاملاً بدون قطع"}
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
            <Button onClick={handleReview}
              disabled={reviewMutation.isPending || (reviewDialog?.action !== "approve" && !rejectionReason.trim())}
              className={reviewDialog?.action === "approve" ? "bg-green-600 hover:bg-green-700" : reviewDialog?.action === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}>
              {reviewMutation.isPending ? "جارٍ الحفظ..." : reviewDialog?.action === "approve" ? "موافقة" : reviewDialog?.action === "reject" ? "رفض" : "طلب إعادة الرفع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CS Ticket Dialog */}
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
                <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                <SelectContent>
                  {myClients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">نوع المشكلة</label>
              <Select value={ticketForm.type} onValueChange={(v: any) => setTicketForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="وصف مختصر للمشكلة" value={ticketForm.title}
                onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">التفاصيل (اختياري)</label>
              <Textarea placeholder="اشرح المشكلة بالتفصيل..." rows={3} value={ticketForm.description}
                onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowTicketDialog(false)}>إلغاء</Button>
            <Button disabled={!selectedClientId || !ticketForm.title || createTicketMutation.isPending}
              onClick={() => {
                if (!selectedClientId || !ticketForm.title) return;
                createTicketMutation.mutate({ clientId: selectedClientId, type: ticketForm.type, priority: ticketForm.priority, title: ticketForm.title, description: ticketForm.description || undefined, month: currentMonth });
              }}>
              رفع التذكرة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Non-accountant reports view ─────────────────────────────────────────────

function ReportsView({ currentMonth, monthLabel, yearNum, role }: { currentMonth: string; monthLabel: string; yearNum: number; role: string }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [filters, setFilters] = useState<FilterValues>({});
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("");

  const { data: reportsData, isLoading: reportsLoading } = trpc.filters.reports.useQuery({
    month: currentMonth,
    stage: filters.stage,
    accountantId: filters.accountantId,
    teamLeaderId: filters.teamLeaderId,
    csUserId: filters.csUserId,
  });

  const { data: clientsData } = trpc.clients.list.useQuery();

  const createBulkMutation = trpc.reports.createBulk.useMutation({
    onSuccess: (data) => {
      utils.filters.reports.invalidate();
      if (data.created > 0) toast.success(`تم إنشاء ${data.created} تقرير لشهر ${monthLabel}`);
      else toast.info("جميع التقارير موجودة بالفعل لهذا الشهر");
    },
    onError: (err) => toast.error(err.message),
  });

  const createMutation = trpc.reports.create.useMutation({
    onSuccess: () => { utils.filters.reports.invalidate(); setShowCreate(false); setSelectedClient(""); toast.success("تم إنشاء التقرير بنجاح"); },
    onError: (err) => toast.error(err.message),
  });

  const reports = reportsData ?? [];
  const clients = clientsData ?? [];
  const totalReports = reports.length;
  const completedReports = reports.filter(r => r.stage === "sent_to_client").length;
  const inProgressReports = reports.filter(r => !["sent_to_client","report_sent"].includes(r.stage)).length;
  const readyToSend = reports.filter(r => r.stage === "report_sent").length;
  const overallProgress = totalReports > 0 ? Math.round((completedReports / totalReports) * 100) : 0;

  const stageGroups = useMemo(() => {
    const groups: Record<string, typeof reports> = {};
    for (const stage of Object.keys(REPORT_STAGES)) groups[stage] = reports.filter(r => r.stage === stage);
    return groups;
  }, [reports]);

  const canCreateReports = role === "admin";
  const canSeeFilters = true;

  if (reportsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي التقارير", value: totalReports, color: "text-foreground" },
          { label: "قيد العمل", value: inProgressReports, color: "text-blue-600" },
          { label: "جاهز للإرسال", value: readyToSend, color: "text-orange-600" },
          { label: "مكتمل", value: completedReports, color: "text-green-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress */}
      {totalReports > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">نسبة الإنجاز</span>
              <span className="text-sm font-bold text-primary">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        show={{
          month: false,
          stage: true,
          accountant: canSeeFilters,
          teamLeader: role === "admin" || role === "operation_manager",
          cs: role === "admin" || role === "operation_manager",
        }}
      />

      {/* Action buttons */}
      {canCreateReports && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" />تقرير جديد
          </Button>
          <Button size="sm" className="gap-1.5 text-xs"
            onClick={() => createBulkMutation.mutate({ month: currentMonth })}
            disabled={createBulkMutation.isPending}>
            <Plus className="w-3.5 h-3.5" />إنشاء تقارير الشهر
          </Button>
        </div>
      )}

      {/* Reports table */}
      {totalReports === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد تقارير</h3>
            <p className="text-muted-foreground text-sm">لا توجد تقارير تطابق الفلاتر المحددة</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">تقارير العملاء — {monthLabel} {yearNum}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b mb-2">
              <div className="col-span-4">العميل</div>
              <div className="col-span-4 text-center">حالة البيانات</div>
              <div className="col-span-2 text-center">المرحلة</div>
              <div className="col-span-2 text-center">التقدم</div>
            </div>
            <div className="space-y-1.5">
              {reports.map(report => {
                const client = clients.find(c => c.id === report.clientId);
                const stageInfo = REPORT_STAGES[report.stage as keyof typeof REPORT_STAGES];
                const colorClass = stageColors[report.stage] ?? "bg-gray-100 text-gray-700";
                const progress = stageProgress[report.stage] ?? 0;
                const dataFields = ["bankStatus","salariesStatus","salesStatus","purchasesStatus","inventoryStatus"] as const;
                const receivedCount = dataFields.filter(f => (report as any)[f] === "received").length;

                return (
                  <div key={report.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border/50"
                    onClick={() => setLocation(`/reports/${report.id}`)}>
                    <div className="md:col-span-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{client?.name?.charAt(0) ?? "#"}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{client?.name ?? `عميل #${report.clientId}`}</p>
                        <p className="text-[10px] text-muted-foreground truncate md:hidden">{stageInfo?.ar}</p>
                      </div>
                    </div>
                    <div className="md:col-span-4 hidden md:flex items-center justify-center gap-1">
                      {dataFields.map(field => {
                        const status = (report as any)[field] as DataStatus;
                        const fieldInfo = DATA_FIELDS.find(f => f.key === field);
                        return (
                          <div key={field}
                            className={`w-7 h-7 rounded flex items-center justify-center text-[9px] font-medium ${
                              status === "received" ? "bg-green-100 text-green-700" :
                              status === "partial" ? "bg-yellow-100 text-yellow-700" :
                              "bg-gray-100 text-gray-400"
                            }`}
                            title={`${fieldInfo?.ar}: ${status}`}>
                            {fieldInfo?.ar.charAt(0)}
                          </div>
                        );
                      })}
                    </div>
                    <div className="md:col-span-2 hidden md:flex items-center justify-center">
                      <Badge className={`text-[10px] ${colorClass} border-0`}>{stageInfo?.ar ?? report.stage}</Badge>
                    </div>
                    <div className="md:col-span-2 hidden md:flex items-center justify-center gap-1.5">
                      <div className="w-full max-w-16"><Progress value={progress} className="h-1.5" /></div>
                      <span className="text-[10px] text-muted-foreground">{progress}%</span>
                    </div>
                    <div className="md:hidden flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">البيانات: {receivedCount}/5</span>
                      <Badge className={`text-[10px] ${colorClass} border-0`}>{stageInfo?.ar}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stage distribution */}
      {totalReports > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">توزيع المراحل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {Object.entries(REPORT_STAGES).map(([key, val]) => {
                const count = stageGroups[key]?.length ?? 0;
                const colorClass = stageColors[key] ?? "bg-gray-100 text-gray-700";
                return (
                  <div key={key}
                    className={`p-3 rounded-lg text-center cursor-pointer transition-all hover:scale-105 ${count > 0 ? colorClass : "bg-muted/50"}`}
                    onClick={() => setFilters(f => ({ ...f, stage: f.stage === key ? undefined : key }))}>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-[10px] mt-1 font-medium">{val.ar}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader><DialogTitle>إنشاء تقرير جديد</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">العميل *</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            <Button onClick={() => { if (!selectedClient) return; createMutation.mutate({ clientId: parseInt(selectedClient), month: currentMonth }); }}
              disabled={!selectedClient || createMutation.isPending}>
              {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MonthlyWorkflowPage() {
  const { user } = useAuth();
  const { previewRole } = usePreviewRole();

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
  const vatInfo = isVatDueMonth(yearNum, monthNum);
  const vatQuarter = getVatQuarter(monthNum);

  const goToPreviousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToCurrentMonth = () => { const now = new Date(); setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1)); };

  const effectiveRole = (user?.role === "admin" && previewRole) ? previewRole : user?.role;
  const isAccountant = effectiveRole === "accountant";

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            {isAccountant ? "سير العمل الشهري" : "التقارير الشهرية"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAccountant
              ? "مهامك الشهرية من استلام البيانات حتى إرسال التقرير النهائي"
              : "نظرة شاملة على حالة التقارير لجميع العملاء"}
          </p>
        </div>
      </div>

      {/* ── Month Navigator ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-9 w-9">
                <ChevronRight className="w-5 h-5" />
              </Button>
              <div className="text-center min-w-44">
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold">{monthLabel} {yearNum}</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{currentMonth}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={goToPreviousMonth} className="h-9 w-9">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goToCurrentMonth} className="text-xs">
              الشهر الحالي
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── VAT Alert ── */}
      {vatInfo.isVatDue && (
        <Card className="border-amber-300 bg-amber-50/80">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800 text-sm">شهر تقديم الإقرار الضريبي (VAT)</h3>
                <p className="text-xs text-amber-700 mt-1">{vatInfo.quarterLabel} — يشمل أشهر: {vatInfo.quarterMonths}</p>
                <p className="text-xs text-amber-600 mt-0.5">يجب تقديم الإقرار الضريبي خلال هذا الشهر</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {vatQuarter && !vatInfo.isVatDue && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <Receipt className="w-3.5 h-3.5" />
          <span>{vatQuarter.info.label} — الإقرار الضريبي مستحق في {MONTH_NAMES_AR[vatQuarter.info.dueMonth]}{vatQuarter.info.dueYearOffset > 0 ? ` ${yearNum + 1}` : ""}</span>
        </div>
      )}

      {/* ── Role-specific view ── */}
      {isAccountant ? (
        <AccountantView currentMonth={currentMonth} monthLabel={monthLabel} yearNum={yearNum} />
      ) : (
        <ReportsView currentMonth={currentMonth} monthLabel={monthLabel} yearNum={yearNum} role={effectiveRole ?? ""} />
      )}
    </div>
  );
}
