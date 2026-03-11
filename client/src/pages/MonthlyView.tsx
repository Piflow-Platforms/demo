import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ChevronRight,
  ChevronLeft,
  Calendar,
  FileText,
  AlertTriangle,
  Plus,
  CheckCircle,
  Clock,
  ArrowLeft,
  Receipt,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  REPORT_STAGES,
  DATA_FIELDS,
  DATA_STATUSES,
  MONTH_NAMES_AR,
  isVatDueMonth,
  getVatQuarter,
} from "@shared/types";
import type { ReportStage, DataStatus } from "@shared/types";
import FilterBar, { type FilterValues } from "@/components/FilterBar";

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

export default function MonthlyViewPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Current month state
  const [filters, setFilters] = useState<FilterValues>({});

  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    // Default to previous month (since we work on previous month's data)
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

  const { data: reportsData, isLoading: reportsLoading } = trpc.filters.reports.useQuery({
    month: currentMonth,
    stage: filters.stage,
    accountantId: filters.accountantId,
    teamLeaderId: filters.teamLeaderId,
    csUserId: filters.csUserId,
  });
  const { data: clientsData, isLoading: clientsLoading } = trpc.clients.list.useQuery();

  const createBulkMutation = trpc.reports.createBulk.useMutation({
    onSuccess: (data) => {
      utils.reports.byMonth.invalidate({ month: currentMonth });
      utils.reports.list.invalidate();
      if (data.created > 0) {
        toast.success(`تم إنشاء ${data.created} تقرير لشهر ${monthLabel}`);
      } else {
        toast.info("جميع التقارير موجودة بالفعل لهذا الشهر");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  };

  const reports = reportsData ?? [];
  const clients = clientsData ?? [];
  const isLoading = reportsLoading || clientsLoading;

  // Stats
  const totalReports = reports.length;
  const completedReports = reports.filter((r) => r.stage === "sent_to_client").length;
  const inProgressReports = reports.filter((r) => r.stage !== "sent_to_client" && r.stage !== "report_sent").length;
  const readyToSend = reports.filter((r) => r.stage === "report_sent").length;
  const overallProgress = totalReports > 0 ? Math.round((completedReports / totalReports) * 100) : 0;

  const canCreateReports = user?.role === "accountant" || user?.role === "admin";

  // Group reports by stage
  const stageGroups = useMemo(() => {
    const groups: Record<string, typeof reports> = {};
    for (const stage of Object.keys(REPORT_STAGES)) {
      groups[stage] = reports.filter((r) => r.stage === stage);
    }
    return groups;
  }, [reports]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month Navigation Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-9 w-9">
                <ChevronRight className="w-5 h-5" />
              </Button>
              <div className="text-center min-w-36">
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold">{monthLabel} {yearNum}</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {currentMonth}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={goToPreviousMonth} className="h-9 w-9">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToCurrentMonth} className="text-xs">
                الشهر الحالي
              </Button>
              {canCreateReports && clients.length > 0 && (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => createBulkMutation.mutate({ month: currentMonth })}
                  disabled={createBulkMutation.isPending}
                >
                  <Plus className="w-3.5 h-3.5" />
                  إنشاء تقارير الشهر
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VAT Alert */}
      {vatInfo.isVatDue && (
        <Card className="border-amber-300 bg-amber-50/80">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800 text-sm">
                  شهر تقديم الإقرار الضريبي (VAT)
                </h3>
                <p className="text-xs text-amber-700 mt-1">
                  {vatInfo.quarterLabel} — يشمل أشهر: {vatInfo.quarterMonths}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  يجب تقديم الإقرار الضريبي خلال هذا الشهر
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VAT Quarter Indicator */}
      {vatQuarter && !vatInfo.isVatDue && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <Receipt className="w-3.5 h-3.5" />
          <span>
            {vatQuarter.info.label} — الإقرار الضريبي مستحق في {MONTH_NAMES_AR[vatQuarter.info.dueMonth]}
            {vatQuarter.info.dueYearOffset > 0 ? ` ${yearNum + 1}` : ""}
          </span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{totalReports}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي التقارير</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{inProgressReports}</p>
            <p className="text-xs text-muted-foreground mt-1">قيد العمل</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-orange-600">{readyToSend}</p>
            <p className="text-xs text-muted-foreground mt-1">جاهز للإرسال</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{completedReports}</p>
            <p className="text-xs text-muted-foreground mt-1">مكتمل</p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      {totalReports > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">تقدم الشهر</span>
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
        show={{ stage: true, accountant: true, teamLeader: true, cs: true }}
      />

      {/* Reports by Client */}
      {totalReports === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد تقارير لهذا الشهر</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {canCreateReports
                ? "اضغط على \"إنشاء تقارير الشهر\" لإنشاء تقارير لجميع عملائك"
                : "لم يتم إنشاء تقارير لهذا الشهر بعد"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              تقارير العملاء — {monthLabel} {yearNum}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Table header */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b mb-2">
              <div className="col-span-3">العميل</div>
              <div className="col-span-4 text-center">حالة البيانات</div>
              <div className="col-span-3 text-center">المرحلة</div>
              <div className="col-span-2 text-center">التقدم</div>
            </div>

            <div className="space-y-1.5">
              {reports.map((report) => {
                const client = clients.find((c) => c.id === report.clientId);
                const stageInfo = REPORT_STAGES[report.stage as keyof typeof REPORT_STAGES];
                const colorClass = stageColors[report.stage] ?? "bg-gray-100 text-gray-700";
                const progress = stageProgress[report.stage] ?? 0;

                // Count received data
                const dataFields = ["bankStatus", "salariesStatus", "salesStatus", "purchasesStatus", "inventoryStatus"] as const;
                const receivedCount = dataFields.filter((f) => (report as any)[f] === "received").length;
                const partialCount = dataFields.filter((f) => (report as any)[f] === "partial").length;

                return (
                  <div
                    key={report.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border/50"
                    onClick={() => setLocation(`/reports/${report.id}`)}
                  >
                    {/* Client Name */}
                    <div className="md:col-span-3 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {client?.name?.charAt(0) ?? "#"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{client?.name ?? `عميل #${report.clientId}`}</p>
                        <p className="text-[10px] text-muted-foreground truncate md:hidden">
                          {stageInfo?.ar}
                        </p>
                      </div>
                    </div>

                    {/* Data Status (desktop) */}
                    <div className="md:col-span-4 hidden md:flex items-center justify-center gap-1">
                      {dataFields.map((field) => {
                        const status = (report as any)[field] as DataStatus;
                        const fieldInfo = DATA_FIELDS.find((f) => f.key === field);
                        return (
                          <div
                            key={field}
                            className={`w-7 h-7 rounded flex items-center justify-center text-[9px] font-medium ${
                              status === "received"
                                ? "bg-green-100 text-green-700"
                                : status === "partial"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-400"
                            }`}
                            title={`${fieldInfo?.ar}: ${DATA_STATUSES[status]?.ar}`}
                          >
                            {fieldInfo?.ar.charAt(0)}
                          </div>
                        );
                      })}
                    </div>

                    {/* Stage */}
                    <div className="md:col-span-3 hidden md:flex items-center justify-center">
                      <Badge className={`text-[10px] ${colorClass} border-0`}>
                        {stageInfo?.ar ?? report.stage}
                      </Badge>
                    </div>

                    {/* Progress */}
                    <div className="md:col-span-2 hidden md:flex items-center justify-center">
                      <div className="w-full max-w-16">
                        <Progress value={progress} className="h-1.5" />
                      </div>
                      <span className="text-[10px] text-muted-foreground mr-1.5">{progress}%</span>
                    </div>

                    {/* Mobile summary */}
                    <div className="md:hidden flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          البيانات: {receivedCount}/5
                          {partialCount > 0 && ` (+${partialCount} جزئي)`}
                        </span>
                      </div>
                      <Badge className={`text-[10px] ${colorClass} border-0`}>
                        {stageInfo?.ar}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stage Summary */}
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
                  <div key={key} className={`p-3 rounded-lg text-center ${count > 0 ? colorClass : "bg-muted/50"}`}>
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
