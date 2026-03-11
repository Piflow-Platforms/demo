import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import FilterBar, { type FilterValues } from "@/components/FilterBar";
import { REPORT_STAGES } from "@shared/types";

export default function ReviewPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<FilterValues>({});

  // Use filtered reports endpoint for TL/admin/OM
  const { data: reviewData, isLoading } = trpc.filters.reports.useQuery({
    stage: filters.stage ?? "audit_review", // default: only audit_review
    month: filters.month,
    accountantId: filters.accountantId,
    teamLeaderId: filters.teamLeaderId,
    csUserId: filters.csUserId,
  });

  const { data: clientsData } = trpc.clients.list.useQuery();

  const reports = useMemo(() => reviewData ?? [], [reviewData]);
  const clients = clientsData ?? [];

  // Show stage filter only for admin/OM who can see all stages
  const canSeeAllStages = user?.role === "admin" || user?.role === "operation_manager";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">مراجعة الجودة</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {reports.length} تقرير
          {!filters.stage || filters.stage === "audit_review" ? " بانتظار المراجعة" : ""}
        </p>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onChange={(f) => {
          // When user clears stage filter, default back to audit_review
          if (!f.stage) f = { ...f, stage: undefined };
          setFilters(f);
        }}
        show={{
          month: true,
          stage: canSeeAllStages,
          accountant: true,
          teamLeader: user?.role === "admin" || user?.role === "operation_manager",
          cs: false,
        }}
      />

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد تقارير</h3>
            <p className="text-muted-foreground text-sm">
              {Object.values(filters).some(Boolean)
                ? "لا توجد نتائج تطابق الفلاتر المحددة"
                : "جميع التقارير تمت مراجعتها"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const client = clients.find((c) => c.id === report.clientId);
            const stageInfo = REPORT_STAGES[report.stage as keyof typeof REPORT_STAGES];
            const isAuditReview = report.stage === "audit_review";
            return (
              <Card
                key={report.id}
                className={`hover:shadow-md transition-all cursor-pointer ${
                  isAuditReview
                    ? "border-orange-200/50 hover:border-orange-300"
                    : "hover:border-border"
                }`}
                onClick={() => setLocation(`/reports/${report.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isAuditReview ? "bg-orange-100" : "bg-muted"
                      }`}>
                        <FileText className={`w-5 h-5 ${isAuditReview ? "text-orange-600" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">
                          {client?.name ?? `عميل #${report.clientId}`}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {report.month} — تقرير #{report.id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`border-0 text-xs ${
                        isAuditReview
                          ? "bg-orange-100 text-orange-700"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {stageInfo?.ar ?? report.stage}
                      </Badge>
                      {isAuditReview && (
                        <Button variant="outline" size="sm" className="text-xs">
                          مراجعة
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
