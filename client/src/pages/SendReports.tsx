import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, FileText, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import FilterBar, { type FilterValues } from "@/components/FilterBar";

export default function SendReportsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [filters, setFilters] = useState<FilterValues>({});

  // Use filtered reports endpoint - default to report_sent stage
  const { data: reportsData, isLoading } = trpc.filters.reports.useQuery({
    stage: filters.stage ?? "report_sent",
    month: filters.month,
    accountantId: filters.accountantId,
    teamLeaderId: filters.teamLeaderId,
    csUserId: filters.csUserId,
  });

  const { data: clientsData } = trpc.clients.list.useQuery();

  const sendMutation = trpc.reports.sendToClient.useMutation({
    onSuccess: () => {
      utils.filters.reports.invalidate();
      utils.reports.readyToSend.invalidate();
      utils.reports.list.invalidate();
      toast.success("تم إرسال التقرير للعميل بنجاح");
    },
    onError: (err) => toast.error(err.message),
  });

  const reports = useMemo(() => reportsData ?? [], [reportsData]);
  const clients = clientsData ?? [];

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
        <h1 className="text-2xl font-bold tracking-tight">إرسال التقارير</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {reports.length} تقرير
          {!filters.stage || filters.stage === "report_sent" ? " جاهز للإرسال" : ""}
        </p>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        show={{
          month: true,
          stage: canSeeAllStages,
          accountant: user?.role === "admin" || user?.role === "operation_manager",
          teamLeader: user?.role === "admin" || user?.role === "operation_manager",
          cs: user?.role === "admin" || user?.role === "operation_manager",
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
                : "سيتم إشعارك عند جاهزية تقارير جديدة"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const client = clients.find((c) => c.id === report.clientId);
            const isReadyToSend = report.stage === "report_sent";
            return (
              <Card
                key={report.id}
                className={`hover:shadow-md transition-all ${
                  isReadyToSend ? "border-green-200/50" : "hover:border-border"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isReadyToSend ? "bg-green-100" : "bg-muted"
                      }`}>
                        <FileText className={`w-5 h-5 ${isReadyToSend ? "text-green-600" : "text-muted-foreground"}`} />
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
                      {!isReadyToSend && (
                        <Badge className="border-0 text-xs bg-muted text-muted-foreground">
                          {report.stage}
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/reports/${report.id}`);
                        }}
                      >
                        عرض التفاصيل
                      </Button>
                      {isReadyToSend && (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-green-600 hover:bg-green-700 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            sendMutation.mutate({ reportId: report.id });
                          }}
                          disabled={sendMutation.isPending}
                        >
                          <Send className="w-3.5 h-3.5" />
                          إرسال للعميل
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
