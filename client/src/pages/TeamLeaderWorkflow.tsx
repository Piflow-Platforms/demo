/**
 * TeamLeaderWorkflow — task-based interface for team leaders.
 * Shows team accountants, their clients' data entry status, and reports awaiting review.
 */
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileCheck,
  Eye,
  TrendingUp,
  Building2,
  ArrowRight,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  FileText,
  FileSpreadsheet,
  File,
  Download,
  Send,
  User,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { REPORT_STAGES, DATA_FIELDS, MONTH_NAMES_AR } from "@shared/types";

const stageColors: Record<string, string> = {
  data_entry: "bg-blue-100 text-blue-700",
  justification: "bg-yellow-100 text-yellow-700",
  audit_review: "bg-orange-100 text-orange-700",
  quality_check: "bg-purple-100 text-purple-700",
  report_sent: "bg-green-100 text-green-700",
  sent_to_client: "bg-emerald-100 text-emerald-700",
};

// ─── ReportReviewCard sub-component ─────────────────────────────────────────

function ReportReviewCard({
  report, client, receivedCount, isExpanded, onToggleExpand,
  onApprove, onReject, approveLoading,
  newComment, onCommentChange, onCommentSubmit, commentLoading,
}: {
  report: any; client: any; receivedCount: number;
  isExpanded: boolean; onToggleExpand: () => void;
  onApprove: () => void; onReject: () => void; approveLoading: boolean;
  newComment: string; onCommentChange: (v: string) => void;
  onCommentSubmit: () => void; commentLoading: boolean;
}) {
  const { data: commentsData } = trpc.reportComments.list.useQuery(
    { reportId: report.id },
    { enabled: isExpanded }
  );
  const comments = commentsData ?? [];

  return (
    <Card className="border-orange-200 hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-orange-700">{client?.name?.charAt(0)}</span>
            </div>
            <div>
              <p className="font-semibold text-sm">{client?.name ?? "عميل غير معروف"}</p>
              <p className="text-xs text-muted-foreground">بيانات مستلمة: {receivedCount}/5</p>
            </div>
          </div>
          <Badge className="bg-orange-100 text-orange-700 border-0 text-xs shrink-0">بانتظار المراجعة</Badge>
        </div>

        {/* Data Status */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {DATA_FIELDS.map((field: any) => {
            const status = (report as any)[field.key] as string;
            return (
              <span key={field.key} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                status === "received" ? "bg-green-100 text-green-700" :
                status === "partial" ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-700"
              }`}>
                {field.ar}: {status === "received" ? "✓" : status === "partial" ? "جزئي" : "✗"}
              </span>
            );
          })}
        </div>

        {/* Report File */}
        {(report as any).reportFileUrl && (
          <div className="mt-3 flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            {(report as any).reportFileMime?.includes("pdf") ? (
              <FileText className="w-5 h-5 text-red-500 shrink-0" />
            ) : (report as any).reportFileMime?.includes("spreadsheet") || (report as any).reportFileMime?.includes("excel") || (report as any).reportFileMime?.includes("xlsx") ? (
              <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
            ) : (
              <File className="w-5 h-5 text-blue-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{(report as any).reportFileName ?? "ملف التقرير"}</p>
              <p className="text-[10px] text-muted-foreground">ملف التقرير</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs"
                onClick={() => window.open((report as any).reportFileUrl, "_blank")}>
                <Eye className="w-3 h-3" />عرض
              </Button>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
                <a href={(report as any).reportFileUrl} download={(report as any).reportFileName ?? "report"}>
                  <Download className="w-3 h-3" />تحميل
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline" size="sm" className="gap-1.5"
            onClick={onToggleExpand}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            تعليقات {comments.length > 0 && `(${comments.length})`}
          </Button>
          <Button
            size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 flex-1"
            onClick={onApprove} disabled={approveLoading}
          >
            <ThumbsUp className="w-3.5 h-3.5" />موافقة
          </Button>
          <Button
            variant="destructive" size="sm" className="gap-1.5 flex-1"
            onClick={onReject}
          >
            <ThumbsDown className="w-3.5 h-3.5" />رفض
          </Button>
        </div>

        {/* Expanded Comments */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            {comments.length > 0 ? (
              <div className="space-y-2.5">
                {comments.map((c: any) => (
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
              <p className="text-xs text-muted-foreground text-center py-2">لا توجد تعليقات بعد</p>
            )}
            <div className="flex gap-2">
              <Textarea
                placeholder="اكتب تعليقك هنا..."
                value={newComment}
                onChange={e => onCommentChange(e.target.value)}
                rows={2}
                className="text-xs resize-none flex-1"
              />
              <Button size="sm" className="shrink-0 self-end gap-1"
                onClick={onCommentSubmit}
                disabled={!newComment.trim() || commentLoading}>
                <Send className="w-3.5 h-3.5" />إرسال
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TeamLeaderWorkflowPage() {
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

  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [ticketClientId, setTicketClientId] = useState<number | null>(null);
  const [ticketForm, setTicketForm] = useState({ type: "complaint" as const, title: "", description: "", priority: "medium" as const });
  const [rejectReportId, setRejectReportId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [expandedReportId, setExpandedReportId] = useState<number | null>(null);
  const [newComments, setNewComments] = useState<Record<number, string>>({});

  const { data: teamData, isLoading: teamLoading } = trpc.teams.myTeam.useQuery();
  const { data: reviewReports, isLoading: reviewLoading } = trpc.reports.forReview.useQuery();
  const { data: allClients } = trpc.clients.list.useQuery();
  const { data: allReports } = trpc.reports.list.useQuery({ month: currentMonth });

  const approveMutation = trpc.reports.approve.useMutation({
    onSuccess: () => { utils.reports.forReview.invalidate(); utils.reports.list.invalidate(); toast.success("تمت الموافقة على التقرير"); },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = trpc.reports.reject.useMutation({
    onSuccess: () => { utils.reports.forReview.invalidate(); utils.reports.list.invalidate(); setRejectReportId(null); setRejectNote(""); toast.success("تم رفض التقرير مع الملاحظات"); },
    onError: (e) => toast.error(e.message),
  });

  const createTicketMutation = trpc.csTickets.create.useMutation({
    onSuccess: () => { setShowTicketDialog(false); toast.success("تم رفع التذكرة للـ CS بنجاح"); },
    onError: (e) => toast.error(e.message),
  });

  const addCommentMutation = trpc.reportComments.add.useMutation({
    onSuccess: (_, vars) => {
      utils.reportComments.list.invalidate({ reportId: vars.reportId });
      setNewComments(prev => ({ ...prev, [vars.reportId]: "" }));
      toast.success("تم إضافة التعليق");
    },
    onError: (e) => toast.error(e.message),
  });

  if (teamLoading || reviewLoading) {
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

  const team = teamData ?? [];
  const pendingReviews = reviewReports ?? [];
  const clients = allClients ?? [];
  const reports = allReports ?? [];

  // Build per-accountant stats
  const accountantStats = team.map(member => {
    const memberClients = clients.filter(c => c.accountantId === member.id);
    const memberReports = reports.filter(r => memberClients.some(c => c.id === r.clientId));
    const dataFields = ["bankStatus", "salariesStatus", "salesStatus", "purchasesStatus", "inventoryStatus"] as const;
    const missingData = memberReports.filter(r => dataFields.some(f => (r as any)[f] !== "received")).length;
    const inReview = memberReports.filter(r => r.stage === "audit_review").length;
    const done = memberReports.filter(r => ["report_sent", "sent_to_client"].includes(r.stage)).length;
    const progress = memberClients.length > 0 ? Math.round((done / memberClients.length) * 100) : 0;
    return { member, clients: memberClients, reports: memberReports, missingData, inReview, done, progress };
  });

  const totalClients = clients.length;
  const totalPendingReview = pendingReviews.length;
  const totalDone = reports.filter(r => ["report_sent", "sent_to_client"].includes(r.stage)).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            لوحة قائد الفريق — {monthLabel} {yearNum}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">مراقبة الفريق، مراجعة الجودة، ورفع التذاكر</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowTicketDialog(true)}>
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          رفع تذكرة للـ CS
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "أعضاء الفريق", value: team.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "إجمالي العملاء", value: totalClients, icon: Building2, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "بانتظار مراجعتك", value: totalPendingReview, icon: FileCheck, color: "text-orange-600", bg: "bg-orange-50", urgent: totalPendingReview > 0 },
          { label: "مكتملة هذا الشهر", value: totalDone, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
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

      <Tabs defaultValue="review" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="review" className="gap-1.5">
            <FileCheck className="w-4 h-4" />
            مراجعة التقارير
            {totalPendingReview > 0 && (
              <Badge className="bg-orange-500 text-white text-[10px] h-4 px-1">{totalPendingReview}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5">
            <Users className="w-4 h-4" />
            مراقبة الفريق
          </TabsTrigger>
        </TabsList>

        {/* Review Tab */}
        <TabsContent value="review" className="space-y-3">
          {pendingReviews.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                <p className="font-semibold">لا توجد تقارير بانتظار مراجعتك</p>
                <p className="text-sm text-muted-foreground mt-1">جميع التقارير تمت مراجعتها</p>
              </CardContent>
            </Card>
          ) : (
            pendingReviews.map(report => {
              const client = clients.find(c => c.id === report.clientId);
              const dataFields = ["bankStatus", "salariesStatus", "salesStatus", "purchasesStatus", "inventoryStatus"] as const;
              const receivedCount = dataFields.filter(f => (report as any)[f] === "received").length;
              const isExpanded = expandedReportId === report.id;
              return (
                <ReportReviewCard
                  key={report.id}
                  report={report}
                  client={client}
                  receivedCount={receivedCount}
                  isExpanded={isExpanded}
                  onToggleExpand={() => setExpandedReportId(isExpanded ? null : report.id)}
                  onApprove={() => approveMutation.mutate({ reportId: report.id })}
                  onReject={() => setRejectReportId(report.id)}
                  approveLoading={approveMutation.isPending}
                  newComment={newComments[report.id] ?? ""}
                  onCommentChange={(v) => setNewComments(prev => ({ ...prev, [report.id]: v }))}
                  onCommentSubmit={() => {
                    const c = newComments[report.id]?.trim();
                    if (c) addCommentMutation.mutate({ reportId: report.id, comment: c });
                  }}
                  commentLoading={addCommentMutation.isPending}
                />
              );
            })
          )}
        </TabsContent>

        {/* Team Monitoring Tab */}
        <TabsContent value="team" className="space-y-3">
          {accountantStats.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground/40 mb-3" />
                <p className="font-semibold">لا يوجد محاسبون في فريقك</p>
                <p className="text-sm text-muted-foreground mt-1">تواصل مع المدير لإضافة أعضاء للفريق</p>
              </CardContent>
            </Card>
          ) : (
            accountantStats.map(({ member, clients: mClients, reports: mReports, missingData, inReview, done, progress }) => (
              <Card key={member.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">{member.name?.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{mClients.length} عميل</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {missingData > 0 && (
                        <Badge className="bg-red-100 text-red-700 border-0 text-xs gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {missingData} ناقص
                        </Badge>
                      )}
                      {inReview > 0 && (
                        <Badge className="bg-orange-100 text-orange-700 border-0 text-xs gap-1">
                          <Clock className="w-3 h-3" />
                          {inReview} مراجعة
                        </Badge>
                      )}
                      <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                        {done}/{mClients.length} مكتمل
                      </Badge>
                    </div>
                  </div>

                  <Progress value={progress} className="h-2 mb-3" />

                  {/* Client Status Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {mClients.map(client => {
                      const report = mReports.find(r => r.clientId === client.id);
                      const stage = report?.stage ?? "no_report";
                      const colorClass = stageColors[stage] ?? "bg-gray-100 text-gray-500";
                      const dataFields = ["bankStatus", "salariesStatus", "salesStatus", "purchasesStatus", "inventoryStatus"] as const;
                      const receivedCount = report ? dataFields.filter(f => (report as any)[f] === "received").length : 0;
                      return (
                        <button
                          key={client.id}
                          className={`text-right p-2 rounded-lg border text-xs hover:opacity-80 transition-opacity ${colorClass}`}
                          onClick={() => report && setLocation(`/reports/${report.id}`)}
                        >
                          <p className="font-medium truncate">{client.name}</p>
                          <p className="opacity-70 mt-0.5">
                            {report ? REPORT_STAGES[stage as keyof typeof REPORT_STAGES]?.ar ?? stage : "لا يوجد"}
                          </p>
                          {report && (
                            <p className="opacity-60 text-[10px]">بيانات: {receivedCount}/5</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Reject Report Dialog */}
      <Dialog open={rejectReportId !== null} onOpenChange={(open) => !open && setRejectReportId(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              رفض التقرير مع ملاحظات
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">أضف ملاحظاتك لتوضيح سبب الرفض للمحاسب</p>
            <Textarea
              placeholder="اكتب ملاحظات الرفض هنا..."
              rows={4}
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectReportId(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              disabled={!rejectNote.trim() || rejectMutation.isPending}
              onClick={() => {
                if (!rejectReportId || !rejectNote.trim()) return;
                rejectMutation.mutate({ reportId: rejectReportId, comment: rejectNote });
              }}
            >
              تأكيد الرفض
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
              <Select onValueChange={(v) => setTicketClientId(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">نوع المشكلة</label>
              <Select value={ticketForm.type} onValueChange={(v: any) => setTicketForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="complaint">شكوى</SelectItem>
                  <SelectItem value="extra_service">خدمة إضافية</SelectItem>
                  <SelectItem value="volume_increase">ارتفاع حجم العمل</SelectItem>
                  <SelectItem value="data_delay">تأخر في تسليم البيانات</SelectItem>
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
              disabled={!ticketClientId || !ticketForm.title || createTicketMutation.isPending}
              onClick={() => {
                if (!ticketClientId || !ticketForm.title) return;
                createTicketMutation.mutate({
                  clientId: ticketClientId,
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
