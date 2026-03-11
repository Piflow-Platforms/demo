import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building2, FileText, Upload, Trash2, Eye, ArrowRight,
  Save, Edit3, X, CheckCircle, Calendar, Users, Briefcase,
  Hash, DollarSign, MapPin, FileCheck, Image, Loader2
} from "lucide-react";
import { ATTACHMENT_TYPES } from "@shared/types";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const STAGE_COLORS: Record<string, string> = {
  data_entry: "bg-slate-100 text-slate-700",
  justification: "bg-amber-100 text-amber-700",
  audit_review: "bg-blue-100 text-blue-700",
  quality_check: "bg-purple-100 text-purple-700",
  report_sent: "bg-emerald-100 text-emerald-700",
  sent_to_client: "bg-green-100 text-green-700",
};

const STAGE_AR: Record<string, string> = {
  data_entry: "إدخال البيانات",
  justification: "التبرير والتوضيح",
  audit_review: "المراجعة والتدقيق",
  quality_check: "فحص الجودة",
  report_sent: "تم إرسال التقرير",
  sent_to_client: "تم الإرسال للعميل",
};

const ATTACHMENT_ICONS: Record<string, React.ReactNode> = {
  cr: <FileCheck className="w-5 h-5 text-blue-500" />,
  contract: <FileText className="w-5 h-5 text-purple-500" />,
  eol: <FileText className="w-5 h-5 text-orange-500" />,
  logo: <Image className="w-5 h-5 text-green-500" />,
  other: <FileText className="w-5 h-5 text-gray-500" />,
};

export default function ClientMasterData() {
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id ?? "0");
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadType, setPendingUploadType] = useState<string>("other");

  const { data: client, refetch: refetchClient } = trpc.clients.byId.useQuery({ id: clientId });
  const { data: attachments, refetch: refetchAttachments } = trpc.clients.attachments.useQuery({ clientId });
  const { data: reports } = trpc.reports.byClient.useQuery({ clientId });

  const updateMasterData = trpc.clients.updateMasterData.useMutation({
    onSuccess: () => { toast.success("تم حفظ البيانات بنجاح"); setIsEditing(false); refetchClient(); },
    onError: () => toast.error("حدث خطأ أثناء الحفظ"),
  });

  const uploadAttachment = trpc.clients.uploadAttachment.useMutation({
    onSuccess: () => { toast.success("تم رفع الملف بنجاح"); refetchAttachments(); refetchClient(); setUploadingType(null); },
    onError: () => { toast.error("حدث خطأ أثناء رفع الملف"); setUploadingType(null); },
  });

  const deleteAttachment = trpc.clients.deleteAttachment.useMutation({
    onSuccess: () => { toast.success("تم حذف الملف"); refetchAttachments(); },
    onError: () => toast.error("حدث خطأ أثناء الحذف"),
  });

  const [form, setForm] = useState({
    taxNumber: "", crNumber: "", crExpiry: "", capital: "",
    partnersCount: "", branchesCount: "", companyType: "",
    establishedDate: "", businessActivity: "", masterNotes: "",
  });

  // Sync form when client loads
  const [formInitialized, setFormInitialized] = useState(false);
  if (client && !formInitialized) {
    setForm({
      taxNumber: client.taxNumber ?? "",
      crNumber: client.crNumber ?? "",
      crExpiry: client.crExpiry ?? "",
      capital: client.capital ?? "",
      partnersCount: client.partnersCount?.toString() ?? "",
      branchesCount: client.branchesCount?.toString() ?? "",
      companyType: client.companyType ?? "",
      establishedDate: client.establishedDate ?? "",
      businessActivity: client.businessActivity ?? "",
      masterNotes: client.masterNotes ?? "",
    });
    setFormInitialized(true);
  }

  const canEdit = user?.role === "admin" || user?.role === "operation_manager" ||
    user?.role === "team_leader" || (user?.role === "accountant" && client?.accountantId === user?.id);

  const handleSave = () => {
    updateMasterData.mutate({
      id: clientId,
      taxNumber: form.taxNumber || undefined,
      crNumber: form.crNumber || undefined,
      crExpiry: form.crExpiry || undefined,
      capital: form.capital || undefined,
      partnersCount: form.partnersCount ? parseInt(form.partnersCount) : undefined,
      branchesCount: form.branchesCount ? parseInt(form.branchesCount) : undefined,
      companyType: form.companyType || undefined,
      establishedDate: form.establishedDate || undefined,
      businessActivity: form.businessActivity || undefined,
      masterNotes: form.masterNotes || undefined,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("حجم الملف يجب أن يكون أقل من 10 ميغابايت"); return; }

    setUploadingType(pendingUploadType);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadAttachment.mutate({
        clientId,
        type: pendingUploadType as any,
        fileName: file.name,
        mimeType: file.type,
        base64Data: base64,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const triggerUpload = (type: string) => {
    setPendingUploadType(type);
    fileInputRef.current?.click();
  };

  // Group reports by year
  const reportsByYear: Record<string, typeof reports> = {};
  (reports ?? []).forEach(r => {
    const year = r.month.split("-")[0];
    if (!reportsByYear[year]) reportsByYear[year] = [];
    reportsByYear[year]!.push(r);
  });

  if (!client) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/clients")} className="gap-2">
          <ArrowRight className="w-4 h-4" />
          العودة للعملاء
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {client.logoUrl ? (
              <img src={client.logoUrl} alt="logo" className="w-12 h-12 rounded-xl object-cover border shadow-sm" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{client.companyName || client.name}</h1>
              <p className="text-muted-foreground text-sm">{client.name}</p>
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="gap-1">
                  <X className="w-4 h-4" /> إلغاء
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateMasterData.isPending} className="gap-1">
                  {updateMasterData.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1">
                <Edit3 className="w-4 h-4" /> تعديل
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="masterdata" dir="rtl">
        <TabsList className="mb-6">
          <TabsTrigger value="masterdata" className="gap-2">
            <Building2 className="w-4 h-4" /> البيانات الأساسية
          </TabsTrigger>
          <TabsTrigger value="attachments" className="gap-2">
            <FileText className="w-4 h-4" /> المرفقات
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <Calendar className="w-4 h-4" /> التقارير الشهرية
          </TabsTrigger>
        </TabsList>

        {/* ── Master Data Tab ── */}
        <TabsContent value="masterdata">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Company Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" /> معلومات الشركة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Hash className="w-3 h-3" /> الرقم الضريبي
                    </Label>
                    {isEditing ? (
                      <Input value={form.taxNumber} onChange={e => setForm(f => ({ ...f, taxNumber: e.target.value }))} placeholder="300XXXXXXXXX" />
                    ) : (
                      <p className="text-sm font-medium">{client.taxNumber || <span className="text-muted-foreground">—</span>}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <FileCheck className="w-3 h-3" /> رقم السجل التجاري
                    </Label>
                    {isEditing ? (
                      <Input value={form.crNumber} onChange={e => setForm(f => ({ ...f, crNumber: e.target.value }))} placeholder="1XXXXXXXXX" />
                    ) : (
                      <p className="text-sm font-medium">{client.crNumber || <span className="text-muted-foreground">—</span>}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3" /> تاريخ انتهاء السجل
                    </Label>
                    {isEditing ? (
                      <Input value={form.crExpiry} onChange={e => setForm(f => ({ ...f, crExpiry: e.target.value }))} placeholder="1446/12/30" />
                    ) : (
                      <p className="text-sm font-medium">{client.crExpiry || <span className="text-muted-foreground">—</span>}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3" /> تاريخ التأسيس
                    </Label>
                    {isEditing ? (
                      <Input value={form.establishedDate} onChange={e => setForm(f => ({ ...f, establishedDate: e.target.value }))} placeholder="1440/01/01" />
                    ) : (
                      <p className="text-sm font-medium">{client.establishedDate || <span className="text-muted-foreground">—</span>}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" /> المعلومات المالية والهيكلية
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <DollarSign className="w-3 h-3" /> رأس المال
                    </Label>
                    {isEditing ? (
                      <Input value={form.capital} onChange={e => setForm(f => ({ ...f, capital: e.target.value }))} placeholder="500,000 ريال" />
                    ) : (
                      <p className="text-sm font-medium">{client.capital || <span className="text-muted-foreground">—</span>}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Briefcase className="w-3 h-3" /> نوع الشركة
                    </Label>
                    {isEditing ? (
                      <Input value={form.companyType} onChange={e => setForm(f => ({ ...f, companyType: e.target.value }))} placeholder="شركة ذات مسؤولية محدودة" />
                    ) : (
                      <p className="text-sm font-medium">{client.companyType || <span className="text-muted-foreground">—</span>}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Users className="w-3 h-3" /> عدد الشركاء
                    </Label>
                    {isEditing ? (
                      <Input type="number" value={form.partnersCount} onChange={e => setForm(f => ({ ...f, partnersCount: e.target.value }))} placeholder="2" />
                    ) : (
                      <p className="text-sm font-medium">{client.partnersCount ?? <span className="text-muted-foreground">—</span>}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <MapPin className="w-3 h-3" /> عدد المنشآت
                    </Label>
                    {isEditing ? (
                      <Input type="number" value={form.branchesCount} onChange={e => setForm(f => ({ ...f, branchesCount: e.target.value }))} placeholder="1" />
                    ) : (
                      <p className="text-sm font-medium">{client.branchesCount ?? <span className="text-muted-foreground">—</span>}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Business Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" /> النشاط التجاري
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Input value={form.businessActivity} onChange={e => setForm(f => ({ ...f, businessActivity: e.target.value }))} placeholder="تجارة التجزئة، الخدمات الاستشارية..." />
                ) : (
                  <p className="text-sm">{client.businessActivity || <span className="text-muted-foreground">لم يتم الإدخال بعد</span>}</p>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> ملاحظات عامة
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea value={form.masterNotes} onChange={e => setForm(f => ({ ...f, masterNotes: e.target.value }))} rows={4} placeholder="أي ملاحظات إضافية حول العميل..." />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{client.masterNotes || <span className="text-muted-foreground">لا توجد ملاحظات</span>}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Attachments Tab ── */}
        <TabsContent value="attachments">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
            onChange={handleFileUpload}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Upload Buttons */}
            {canEdit && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" /> رفع مرفق جديد
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.entries(ATTACHMENT_TYPES) as [string, { ar: string }][]).map(([type, label]) => (
                      <Button
                        key={type}
                        variant="outline"
                        className="h-16 flex-col gap-1 text-xs"
                        onClick={() => triggerUpload(type)}
                        disabled={uploadingType === type}
                      >
                        {uploadingType === type ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          ATTACHMENT_ICONS[type]
                        )}
                        {label.ar}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    PDF, صور, Word, Excel — حد أقصى 10 ميغابايت
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Logo Display */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Image className="w-4 h-4 text-primary" /> شعار الشركة
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {client.logoUrl ? (
                  <img src={client.logoUrl} alt="logo" className="w-32 h-32 object-contain rounded-xl border shadow-sm" />
                ) : (
                  <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                    <Building2 className="w-12 h-12 text-muted-foreground/40" />
                  </div>
                )}
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => triggerUpload("logo")} className="gap-2">
                    <Upload className="w-4 h-4" />
                    {client.logoUrl ? "تغيير الشعار" : "رفع الشعار"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Attachments List */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">المرفقات المرفوعة ({attachments?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!attachments || attachments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>لا توجد مرفقات بعد</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                      {ATTACHMENT_ICONS[att.type]}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{att.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {ATTACHMENT_TYPES[att.type as keyof typeof ATTACHMENT_TYPES]?.ar} •{" "}
                          {new Date(att.createdAt).toLocaleDateString("ar-SA")}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Eye className="w-4 h-4" />
                          </a>
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteAttachment.mutate({ attachmentId: att.id })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Monthly Reports Tab ── */}
        <TabsContent value="reports">
          {Object.keys(reportsByYear).length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>لا توجد تقارير بعد لهذا العميل</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(reportsByYear).sort(([a], [b]) => b.localeCompare(a)).map(([year, yearReports]) => (
                <Card key={year}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" /> سنة {year}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {(yearReports ?? []).sort((a, b) => a.month.localeCompare(b.month)).map(report => {
                        const monthNum = parseInt(report.month.split("-")[1] ?? "1") - 1;
                        const monthName = MONTHS_AR[monthNum] ?? report.month;
                        return (
                          <div
                            key={report.id}
                            className="p-3 rounded-xl border bg-card hover:shadow-sm transition-all cursor-pointer"
                            onClick={() => navigate(`/reports/${report.id}`)}
                          >
                            <p className="font-semibold text-sm mb-2">{monthName}</p>
                            <Badge className={`text-xs ${STAGE_COLORS[report.stage] ?? ""}`}>
                              {STAGE_AR[report.stage] ?? report.stage}
                            </Badge>
                            <div className="mt-2 flex gap-1 flex-wrap">
                              {[
                                { key: "bankStatus", label: "بنك" },
                                { key: "salariesStatus", label: "رواتب" },
                                { key: "salesStatus", label: "مبيعات" },
                              ].map(({ key, label }) => {
                                const val = report[key as keyof typeof report];
                                return (
                                  <span
                                    key={key}
                                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                                      val === "received" ? "bg-green-100 text-green-700" :
                                      val === "partial" ? "bg-amber-100 text-amber-700" :
                                      "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {label}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
