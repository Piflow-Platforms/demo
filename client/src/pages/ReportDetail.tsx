import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Database,
  Upload,
  Trash2,
  Eye,
  Send,
  Download,
  File,
  FileSpreadsheet,
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { REPORT_STAGES, DATA_STATUSES, DATA_FIELDS, STAGE_ORDER } from "@shared/types";
import type { ReportStage, DataStatus } from "@shared/types";

const stageColors: Record<string, string> = {
  data_entry: "bg-blue-100 text-blue-700 border-blue-200",
  justification: "bg-yellow-100 text-yellow-700 border-yellow-200",
  audit_review: "bg-orange-100 text-orange-700 border-orange-200",
  quality_check: "bg-purple-100 text-purple-700 border-purple-200",
  report_sent: "bg-green-100 text-green-700 border-green-200",
  sent_to_client: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const dataStatusColors: Record<string, string> = {
  received: "bg-green-100 text-green-700",
  partial: "bg-yellow-100 text-yellow-700",
  not_received: "bg-gray-100 text-gray-500",
};

function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    accountant: "محاسب",
    team_leader: "قائد الفريق",
    customer_success: "نجاح العملاء",
    admin: "مدير النظام",
    operation_manager: "مدير العمليات",
  };
  return labels[role] ?? role;
}

function getRoleColor(role: string) {
  const colors: Record<string, string> = {
    accountant: "bg-blue-100 text-blue-700",
    team_leader: "bg-purple-100 text-purple-700",
    customer_success: "bg-green-100 text-green-700",
    admin: "bg-red-100 text-red-700",
    operation_manager: "bg-orange-100 text-orange-700",
  };
  return colors[role] ?? "bg-gray-100 text-gray-700";
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("xlsx") || mimeType.includes("xls"))
    return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
  return <File className="w-5 h-5 text-blue-500" />;
}

export default function ReportDetailPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const reportId = parseInt(params.id ?? "0");

  const { data: report, isLoading: reportLoading } = trpc.reports.byId.useQuery({ id: reportId });
  const { data: clientData } = trpc.clients.byId.useQuery(
    { id: report?.clientId ?? 0 },
    { enabled: !!report?.clientId }
  );
  const { data: feedbacksData } = trpc.feedbacks.byReport.useQuery({ reportId }, { enabled: reportId > 0 });
  const { data: commentsData, isLoading: commentsLoading } = trpc.reportComments.list.useQuery(
    { reportId },
    { enabled: reportId > 0 }
  );

  const [feedbackText, setFeedbackText] = useState("");
  const [newComment, setNewComment] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateDataMutation = trpc.reports.updateDataStatus.useMutation({
    onSuccess: () => {
      utils.reports.byId.invalidate({ id: reportId });
      toast.success("تم تحديث حالة البيانات");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStageMutation = trpc.reports.updateStage.useMutation({
    onSuccess: () => {
      utils.reports.byId.invalidate({ id: reportId });
      utils.reports.list.invalidate();
      toast.success("تم تحديث مرحلة التقرير");
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMutation = trpc.reports.approve.useMutation({
    onSuccess: () => {
      utils.reports.byId.invalidate({ id: reportId });
      utils.reports.list.invalidate();
      utils.reports.forReview.invalidate();
      toast.success("تمت الموافقة على التقرير");
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.reports.reject.useMutation({
    onSuccess: () => {
      utils.reports.byId.invalidate({ id: reportId });
      utils.reports.list.invalidate();
      utils.reports.forReview.invalidate();
      setFeedbackText("");
      toast.success("تم رفض التقرير وإرسال الملاحظات");
    },
    onError: (err) => toast.error(err.message),
  });

  const sendToClientMutation = trpc.reports.sendToClient.useMutation({
    onSuccess: () => {
      utils.reports.byId.invalidate({ id: reportId });
      utils.reports.list.invalidate();
      utils.reports.readyToSend.invalidate();
      toast.success("تم إرسال التقرير للعميل");
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadFileMutation = trpc.reportFiles.upload.useMutation({
    onSuccess: () => {
      utils.reports.byId.invalidate({ id: reportId });
      toast.success("تم رفع الملف بنجاح");
      setIsUploadingFile(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsUploadingFile(false);
    },
  });

  const removeFileMutation = trpc.reportFiles.remove.useMutation({
    onSuccess: () => {
      utils.reports.byId.invalidate({ id: reportId });
      toast.success("تم حذف الملف");
    },
    onError: (err) => toast.error(err.message),
  });

  const addCommentMutation = trpc.reportComments.add.useMutation({
    onSuccess: () => {
      utils.reportComments.list.invalidate({ reportId });
      setNewComment("");
      toast.success("تم إضافة التعليق");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteCommentMutation = trpc.reportComments.delete.useMutation({
    onSuccess: () => {
      utils.reportComments.list.invalidate({ reportId });
      toast.success("تم حذف التعليق");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 16 * 1024 * 1024; // 16MB
    if (file.size > maxSize) {
      toast.error("حجم الملف يتجاوز 16 ميجابايت");
      return;
    }

    setIsUploadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadFileMutation.mutate({
        reportId,
        base64Data: base64,
        fileName: file.name,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (reportLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-16">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold">التقرير غير موجود</h3>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/reports")}>
          العودة للتقارير
        </Button>
      </div>
    );
  }

  const stageInfo = REPORT_STAGES[report.stage as keyof typeof REPORT_STAGES];
  const currentStageIndex = STAGE_ORDER.indexOf(report.stage as ReportStage);
  const isAccountant = user?.role === "accountant" && report.accountantId === user.id;
  const isTeamLeader = user?.role === "team_leader";
  const isCS = user?.role === "customer_success";
  const isAdmin = user?.role === "admin";
  const isOM = user?.role === "operation_manager";
  const canEditData = (isAccountant || isAdmin) && (report.stage === "data_entry" || report.stage === "justification");
  const canChangeStage = isAccountant || isAdmin;
  const canReview = (isTeamLeader || isAdmin) && report.stage === "audit_review";
  const canSendToClient = (isCS || isAdmin) && report.stage === "report_sent";
  const canUploadFile = isAccountant || isTeamLeader || isAdmin || isOM;
  const canComment = !!user;

  const feedbacks = feedbacksData ?? [];
  const comments = commentsData ?? [];

  const allowedNextStages = (): ReportStage[] => {
    if (!canChangeStage) return [];
    const current = report.stage as ReportStage;
    if (current === "data_entry") return ["justification", "audit_review"];
    if (current === "justification") return ["data_entry", "audit_review"];
    return [];
  };

  const reportFileUrl = (report as any).reportFileUrl as string | null;
  const reportFileName = (report as any).reportFileName as string | null;
  const reportFileMime = (report as any).reportFileMime as string | null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/reports")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {clientData?.name ?? `عميل #${report.clientId}`}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            تقرير {report.month} — #{report.id}
          </p>
        </div>
        <Badge className={`text-sm px-3 py-1 ${stageColors[report.stage] ?? ""} border-0`}>
          {stageInfo?.ar ?? report.stage}
        </Badge>
      </div>

      {/* Stage Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4" />
            مراحل التقرير
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STAGE_ORDER.map((stage, idx) => {
              const info = REPORT_STAGES[stage];
              const isCurrent = stage === report.stage;
              const isCompleted = idx < currentStageIndex;
              return (
                <div key={stage} className="flex items-center gap-1 shrink-0">
                  <div
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isCurrent
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : isCompleted
                        ? "bg-green-100 text-green-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {info.ar}
                  </div>
                  {idx < STAGE_ORDER.length - 1 && (
                    <div className={`w-4 h-0.5 ${isCompleted ? "bg-green-400" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Stage Actions */}
          {canChangeStage && allowedNextStages().length > 0 && (
            <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground ml-2 self-center">نقل إلى:</span>
              {allowedNextStages().map((stage) => {
                const info = REPORT_STAGES[stage];
                return (
                  <Button
                    key={stage}
                    variant="outline"
                    size="sm"
                    onClick={() => updateStageMutation.mutate({ reportId, stage })}
                    disabled={updateStageMutation.isPending}
                  >
                    {info.ar}
                  </Button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Receipt Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Database className="w-4 h-4" />
            حالة استلام البيانات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DATA_FIELDS.map((field) => {
              const currentStatus = (report as any)[field.key] as DataStatus;
              const statusInfo = DATA_STATUSES[currentStatus];
              return (
                <div key={field.key} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{field.ar}</span>
                    <Badge className={`text-xs border-0 ${dataStatusColors[currentStatus]}`}>
                      {statusInfo.ar}
                    </Badge>
                  </div>
                  {canEditData && (
                    <Select
                      value={currentStatus}
                      onValueChange={(val) => {
                        updateDataMutation.mutate({
                          reportId,
                          [field.key]: val,
                        } as any);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_received">لم يتم الاستلام</SelectItem>
                        <SelectItem value="partial">جزئي</SelectItem>
                        <SelectItem value="received">تم الاستلام</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Report File Section ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" />
            ملف التقرير
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reportFileUrl ? (
            <div className="space-y-3">
              {/* File info row */}
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <FileIcon mimeType={reportFileMime ?? ""} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{reportFileName}</p>
                  <p className="text-xs text-muted-foreground">{reportFileMime}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => window.open(reportFileUrl, "_blank")}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    عرض
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    asChild
                  >
                    <a href={reportFileUrl} download={reportFileName ?? "report"}>
                      <Download className="w-3.5 h-3.5" />
                      تحميل
                    </a>
                  </Button>
                  {canUploadFile && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => removeFileMutation.mutate({ reportId })}
                      disabled={removeFileMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      حذف
                    </Button>
                  )}
                </div>
              </div>

              {/* Inline PDF preview */}
              {reportFileMime?.includes("pdf") && (
                <div className="rounded-lg border overflow-hidden" style={{ height: "500px" }}>
                  <iframe
                    src={reportFileUrl}
                    className="w-full h-full"
                    title="معاينة التقرير"
                  />
                </div>
              )}

              {/* Replace file button */}
              {canUploadFile && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFile || uploadFileMutation.isPending}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isUploadingFile || uploadFileMutation.isPending ? "جاري الرفع..." : "استبدال الملف"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">لم يتم إرفاق ملف التقرير بعد</p>
              {canUploadFile && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFile || uploadFileMutation.isPending}
                  >
                    <Upload className="w-4 h-4" />
                    {isUploadingFile || uploadFileMutation.isPending ? "جاري الرفع..." : "رفع ملف التقرير"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">PDF, Excel, Word — حد أقصى 16 ميجابايت</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quality Check Actions (Team Leader) */}
      {canReview && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-orange-700">
              <CheckCircle className="w-4 h-4" />
              مراجعة الجودة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">ملاحظات المراجعة</label>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="اكتب ملاحظاتك هنا... (مطلوب في حالة الرفض)"
                className="min-h-24 bg-white"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => approveMutation.mutate({ reportId, comment: feedbackText || undefined })}
                disabled={approveMutation.isPending}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                موافقة
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!feedbackText.trim()) {
                    toast.error("يرجى كتابة ملاحظات الرفض");
                    return;
                  }
                  rejectMutation.mutate({ reportId, comment: feedbackText });
                }}
                disabled={rejectMutation.isPending}
                className="gap-2"
              >
                <XCircle className="w-4 h-4" />
                رفض مع ملاحظات
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Send to Client (CS) */}
      {canSendToClient && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-green-700">التقرير جاهز للإرسال</h3>
                <p className="text-sm text-green-600 mt-1">تمت الموافقة على التقرير ويمكن إرساله للعميل</p>
              </div>
              <Button
                onClick={() => sendToClientMutation.mutate({ reportId })}
                disabled={sendToClientMutation.isPending}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <Send className="w-4 h-4" />
                إرسال للعميل
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Comments Section ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            التعليقات والملاحظات
            {comments.length > 0 && (
              <Badge variant="secondary" className="text-xs">{comments.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Comments list */}
          {commentsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              لا توجد تعليقات بعد. كن أول من يعلق!
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">
                      {(comment.userName ?? "م").charAt(0)}
                    </span>
                  </div>
                  {/* Bubble */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold">{comment.userName}</span>
                      <Badge className={`text-xs border-0 px-1.5 py-0 ${getRoleColor(comment.userRole ?? "")}`}>
                        {getRoleLabel(comment.userRole ?? "")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString("ar-SA", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="bg-muted/50 rounded-lg px-3 py-2">
                      <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                    </div>
                    {/* Delete button for own comments */}
                    {(comment.userId === user?.id || user?.role === "admin") && (
                      <button
                        className="text-xs text-muted-foreground hover:text-destructive mt-1 transition-colors"
                        onClick={() => deleteCommentMutation.mutate({ commentId: comment.id })}
                        disabled={deleteCommentMutation.isPending}
                      >
                        حذف
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add comment */}
          {canComment && (
            <div className="pt-3 border-t space-y-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="اكتب تعليقاً أو ملاحظة..."
                className="min-h-20 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    if (newComment.trim()) {
                      addCommentMutation.mutate({ reportId, comment: newComment.trim() });
                    }
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ctrl+Enter للإرسال</span>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    if (!newComment.trim()) return;
                    addCommentMutation.mutate({ reportId, comment: newComment.trim() });
                  }}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                >
                  <Send className="w-3.5 h-3.5" />
                  إرسال
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback History */}
      {feedbacks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              سجل مراجعات الجودة ({feedbacks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {feedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className={`p-3 rounded-lg border ${
                    fb.action === "approved"
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {fb.action === "approved" ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${fb.action === "approved" ? "text-green-700" : "text-red-700"}`}>
                      {fb.action === "approved" ? "موافقة" : "رفض"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(fb.createdAt).toLocaleDateString("ar-SA", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 pr-6">{fb.comment}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
