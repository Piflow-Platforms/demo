/**
 * ClientPortal — view for clients (role: "user" with a linked client record).
 * Clients can upload data files per category and track report status.
 * Each uploaded file goes through accountant review (approve/reject/reupload).
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
  CheckCircle2,
  Clock,
  FileText,
  Upload,
  Building2,
  AlertCircle,
  Download,
  TrendingUp,
  RefreshCw,
  X,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Eye,
  RotateCcw,
} from "lucide-react";
import { useState, useMemo, useRef, useCallback } from "react";
import { REPORT_STAGES, DATA_FIELDS, MONTH_NAMES_AR } from "@shared/types";
import { toast } from "sonner";

const STAGE_TIMELINE = [
  { stage: "data_entry", label: "استلام البيانات", icon: Upload },
  { stage: "justification", label: "معالجة البيانات", icon: FileText },
  { stage: "audit_review", label: "المراجعة والتدقيق", icon: Clock },
  { stage: "quality_check", label: "فحص الجودة", icon: TrendingUp },
  { stage: "report_sent", label: "التقرير جاهز", icon: CheckCircle2 },
  { stage: "sent_to_client", label: "تم الإرسال إليك", icon: Download },
];

const DATA_CATEGORIES = [
  { key: "bank", label: "كشف الحساب البنكي", icon: "🏦", description: "كشف حساب شهري من البنك" },
  { key: "salaries", label: "كشف الرواتب", icon: "👥", description: "قائمة الرواتب والأجور" },
  { key: "sales", label: "فواتير المبيعات", icon: "📈", description: "فواتير المبيعات والإيرادات" },
  { key: "purchases", label: "فواتير المشتريات", icon: "🛒", description: "فواتير المشتريات والمصروفات" },
  { key: "inventory", label: "الجرد والمخزون", icon: "📦", description: "تقرير المخزون والجرد" },
  { key: "other", label: "مستندات أخرى", icon: "📎", description: "أي مستندات أخرى مطلوبة" },
] as const;

type UploadCategory = typeof DATA_CATEGORIES[number]["key"];

const STATUS_CONFIG = {
  pending: { label: "بانتظار المراجعة", color: "bg-yellow-100 text-yellow-800 border-yellow-300", dot: "bg-yellow-500" },
  approved: { label: "تمت الموافقة", color: "bg-green-100 text-green-800 border-green-300", dot: "bg-green-500" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800 border-red-300", dot: "bg-red-500" },
  reupload_requested: { label: "مطلوب إعادة الرفع", color: "bg-orange-100 text-orange-800 border-orange-300", dot: "bg-orange-500" },
};

function getStageIndex(stage: string): number {
  return STAGE_TIMELINE.findIndex(s => s.stage === stage);
}

export default function ClientPortalPage() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  });

  const [expandedCategory, setExpandedCategory] = useState<UploadCategory | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<UploadCategory | null>(null);
  const [reuploadTarget, setReuploadTarget] = useState<{ id: number; category: UploadCategory; fileName: string } | null>(null);
  const [uploadNotes, setUploadNotes] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return `${MONTH_NAMES_AR[m] ?? ""} ${y}`;
  }, [selectedMonth]);

  const { data: clients, isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const { data: reports, isLoading: reportsLoading } = trpc.reports.list.useQuery({ month: selectedMonth });

  const myClient = clients?.[0]; // For user role, show first linked client

  const { data: uploads, refetch: refetchUploads } = trpc.clientUploads.list.useQuery(
    { clientId: myClient?.id ?? 0, month: selectedMonth },
    { enabled: !!myClient?.id }
  );

  const uploadFileMutation = trpc.files.upload.useMutation();
  const createUploadMutation = trpc.clientUploads.upload.useMutation();
  const reuploadMutation = trpc.clientUploads.reupload.useMutation();
  const deleteUploadMutation = trpc.clientUploads.delete.useMutation();

  const handleFileSelect = useCallback(async (files: FileList | null, category: UploadCategory, parentId?: number) => {
    if (!files || files.length === 0 || !myClient) return;

    for (const file of Array.from(files)) {
      if (file.size > 16 * 1024 * 1024) {
        toast.error(`${file.name} يتجاوز 16MB`, { description: "الملف كبير جداً" });
        continue;
      }

      try {
        // Read file as base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]); // remove data:...;base64, prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Upload to S3
        const { url, key } = await uploadFileMutation.mutateAsync({
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type || "application/octet-stream",
          folder: `client-data/${myClient.id}/${selectedMonth}`,
        });

        if (parentId) {
          // Re-upload
          await reuploadMutation.mutateAsync({
            parentId,
            fileUrl: url,
            fileKey: key,
            fileName: file.name,
            notes: uploadNotes || undefined,
          });
        } else {
          // New upload
          await createUploadMutation.mutateAsync({
            clientId: myClient.id,
            month: selectedMonth,
            type: category,
            fileUrl: url,
            fileKey: key,
            fileName: file.name,
            notes: uploadNotes || undefined,
          });
        }

        toast.success(`تم رفع ${file.name}`, { description: "بانتظار مراجعة المحاسب" });
      } catch (err: any) {
        toast.error("فشل رفع الملف", { description: err.message });
      }
    }

    setUploadNotes("");
    setReuploadTarget(null);
    refetchUploads();
  }, [myClient, selectedMonth, uploadNotes, uploadFileMutation, createUploadMutation, reuploadMutation, refetchUploads, toast]);

  const handleDelete = async (id: number) => {
    try {
      await deleteUploadMutation.mutateAsync({ id });
      toast.success("تم حذف الملف");
      refetchUploads();
    } catch (err: any) {
      toast.error("فشل الحذف", { description: err.message });
    }
  };

  // Group uploads by category - must be before any early returns
  const uploadsByCategory = useMemo(() => {
    const map: Record<string, typeof uploads> = {};
    for (const cat of DATA_CATEGORIES) {
      map[cat.key] = (uploads ?? []).filter(u => u.type === cat.key);
    }
    return map;
  }, [uploads]);

  if (clientsLoading || reportsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!myClient) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">مرحباً بك في بوابة العملاء</h2>
        <p className="text-muted-foreground max-w-sm">
          لم يتم ربط حسابك بأي عميل بعد. تواصل مع فريق المحاسبة لربط حسابك.
        </p>
      </div>
    );
  }

  const report = reports?.find(r => r.clientId === myClient.id);
  const stageIndex = report ? getStageIndex(report.stage) : -1;
  const progressPct = report ? Math.round(((stageIndex + 1) / STAGE_TIMELINE.length) * 100) : 0;

  // Category status: all approved = green, any pending = yellow, any rejected/reupload = red/orange, none = gray
  const getCategoryStatus = (cat: UploadCategory) => {
    const files = uploadsByCategory[cat] ?? [];
    const latest = files.filter(f => f.isLatest === 1);
    if (latest.length === 0) return "empty";
    if (latest.some(f => f.status === "rejected")) return "rejected";
    if (latest.some(f => f.status === "reupload_requested")) return "reupload";
    if (latest.some(f => f.status === "pending")) return "pending";
    if (latest.every(f => f.status === "approved")) return "approved";
    return "partial";
  };

  const categoryStatusConfig = {
    empty: { color: "border-border bg-muted/30", badge: null, icon: null },
    pending: { color: "border-yellow-300 bg-yellow-50", badge: "بانتظار المراجعة", badgeClass: "bg-yellow-100 text-yellow-800", icon: <Clock className="w-4 h-4 text-yellow-600" /> },
    approved: { color: "border-green-300 bg-green-50", badge: "تمت الموافقة", badgeClass: "bg-green-100 text-green-800", icon: <CheckCircle2 className="w-4 h-4 text-green-600" /> },
    rejected: { color: "border-red-300 bg-red-50", badge: "مرفوض", badgeClass: "bg-red-100 text-red-800", icon: <X className="w-4 h-4 text-red-600" /> },
    reupload: { color: "border-orange-300 bg-orange-50", badge: "مطلوب إعادة الرفع", badgeClass: "bg-orange-100 text-orange-800", icon: <RefreshCw className="w-4 h-4 text-orange-600" /> },
    partial: { color: "border-blue-300 bg-blue-50", badge: "جزئي", badgeClass: "bg-blue-100 text-blue-800", icon: <Clock className="w-4 h-4 text-blue-600" /> },
  };

  const isUploading = uploadFileMutation.isPending || createUploadMutation.isPending || reuploadMutation.isPending;

  return (
    <div className="space-y-5 max-w-3xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {myClient.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">بوابة رفع البيانات ومتابعة التقارير</p>
        </div>
        {/* Month selector */}
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {Array.from({ length: 12 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const lbl = `${MONTH_NAMES_AR[d.getMonth() + 1]} ${d.getFullYear()}`;
            return <option key={val} value={val}>{lbl}</option>;
          })}
        </select>
      </div>

      {/* Report Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            حالة تقرير {monthLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!report ? (
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl">
              <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">لم يتم إنشاء تقرير لهذا الشهر بعد</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">تقدم التقرير</span>
                <span className="text-sm font-bold text-primary">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2.5 mb-4" />
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {STAGE_TIMELINE.map((step, idx) => {
                  const isDone = stageIndex > idx;
                  const isActive = stageIndex === idx;
                  const Icon = step.icon;
                  return (
                    <div key={step.stage} className={`flex flex-col items-center gap-1.5 p-2 rounded-lg text-center ${
                      isDone ? "bg-green-50" : isActive ? "bg-primary/5" : "bg-muted/30"
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isDone ? "bg-green-500 text-white" : isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <p className={`text-[10px] font-medium leading-tight ${
                        isDone ? "text-green-700" : isActive ? "text-primary" : "text-muted-foreground"
                      }`}>{step.label}</p>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                    </div>
                  );
                })}
              </div>
              {report.stage === "sent_to_client" && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mt-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-700">تقريرك جاهز!</p>
                    <p className="text-sm text-emerald-600">تم إرسال تقرير {monthLabel} إليك. تواصل مع فريق المحاسبة للحصول على النسخة النهائية.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Data Upload Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            رفع البيانات — {monthLabel}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            ارفع ملفاتك لكل فئة. سيراجعها المحاسب ويوافق عليها أو يطلب التعديل.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {DATA_CATEGORIES.map(cat => {
            const catStatus = getCategoryStatus(cat.key);
            const config = categoryStatusConfig[catStatus];
            const catUploads = (uploadsByCategory[cat.key] ?? []).filter(u => u.isLatest === 1);
            const isExpanded = expandedCategory === cat.key;
            const hasRejected = catUploads.some(u => u.status === "rejected" || u.status === "reupload_requested");

            return (
              <div key={cat.key} className={`border rounded-xl overflow-hidden transition-all ${config.color}`}>
                {/* Category Header */}
                <button
                  className="w-full flex items-center gap-3 p-4 text-right hover:bg-black/5 transition-colors"
                  onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                >
                  <span className="text-2xl shrink-0">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{cat.label}</p>
                      {config.badge && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${config.badgeClass}`}>
                          {config.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                    {catUploads.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">{catUploads.length} ملف مرفوع</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {config.icon}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                    {/* Existing files */}
                    {catUploads.length > 0 && (
                      <div className="space-y-2">
                        {catUploads.map(upload => {
                          const sc = STATUS_CONFIG[upload.status as keyof typeof STATUS_CONFIG];
                          return (
                            <div key={upload.id} className={`flex items-start gap-3 p-3 rounded-lg border ${sc.color}`}>
                              <Paperclip className="w-4 h-4 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{upload.fileName}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${sc.color}`}>
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${sc.dot} ml-1`} />
                                    {sc.label}
                                  </span>
                                  {upload.version && upload.version > 1 && (
                                    <span className="text-[10px] text-muted-foreground">الإصدار {upload.version}</span>
                                  )}
                                </div>
                                {upload.rejectionReason && (
                                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-xs font-medium text-red-700">سبب الرفض:</p>
                                    <p className="text-xs text-red-600 mt-0.5">{upload.rejectionReason}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <a href={upload.fileUrl} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                </a>
                                {(upload.status === "rejected" || upload.status === "reupload_requested") && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-orange-600 hover:text-orange-700"
                                    onClick={() => setReuploadTarget({ id: upload.id, category: cat.key, fileName: upload.fileName })}
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {upload.status === "pending" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(upload.id)}
                                    disabled={deleteUploadMutation.isPending}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Upload new file */}
                    <div
                      className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                        isDragging && uploadingCategory === cat.key
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-muted/30"
                      }`}
                      onDragOver={e => { e.preventDefault(); setIsDragging(true); setUploadingCategory(cat.key); }}
                      onDragLeave={() => { setIsDragging(false); setUploadingCategory(null); }}
                      onDrop={e => {
                        e.preventDefault();
                        setIsDragging(false);
                        setUploadingCategory(null);
                        handleFileSelect(e.dataTransfer.files, cat.key);
                      }}
                      onClick={() => {
                        setUploadingCategory(cat.key);
                        fileInputRef.current?.click();
                      }}
                    >
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium">اسحب الملفات هنا أو اضغط للاختيار</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, Excel, Word, صور — حد أقصى 16MB لكل ملف</p>
                      {isUploading && uploadingCategory === cat.key && (
                        <p className="text-xs text-primary mt-2 animate-pulse">جارٍ الرفع...</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg,.csv"
            onChange={e => {
              if (uploadingCategory) {
                handleFileSelect(e.target.files, uploadingCategory);
              }
              e.target.value = "";
            }}
          />
        </CardContent>
      </Card>

      {/* Re-upload Dialog */}
      <Dialog open={!!reuploadTarget} onOpenChange={() => setReuploadTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إعادة رفع الملف</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              إعادة رفع بديل عن: <span className="font-medium text-foreground">{reuploadTarget?.fileName}</span>
            </p>
            <Textarea
              placeholder="ملاحظات (اختياري) — مثلاً: تم تصحيح الفاتورة رقم 5"
              value={uploadNotes}
              onChange={e => setUploadNotes(e.target.value)}
              className="text-sm"
              rows={3}
            />
            <div
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">اختر الملف المصحح</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, Excel, Word, صور — حد أقصى 16MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg,.csv"
              onChange={e => {
                if (reuploadTarget) {
                  handleFileSelect(e.target.files, reuploadTarget.category, reuploadTarget.id);
                }
                e.target.value = "";
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReuploadTarget(null)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
