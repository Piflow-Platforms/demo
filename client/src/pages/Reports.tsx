import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Label } from "@/components/ui/label";
import { FileText, Plus, ArrowLeft } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { REPORT_STAGES } from "@shared/types";
import FilterBar, { type FilterValues } from "@/components/FilterBar";

const stageColors: Record<string, string> = {
  data_entry: "bg-blue-100 text-blue-700",
  justification: "bg-yellow-100 text-yellow-700",
  audit_review: "bg-orange-100 text-orange-700",
  quality_check: "bg-purple-100 text-purple-700",
  report_sent: "bg-green-100 text-green-700",
  sent_to_client: "bg-emerald-100 text-emerald-700",
};

export default function ReportsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [filters, setFilters] = useState<FilterValues>({});
  const { data: reportsData, isLoading: reportsLoading } = trpc.filters.reports.useQuery({
    month: filters.month,
    stage: filters.stage,
    accountantId: filters.accountantId,
    teamLeaderId: filters.teamLeaderId,
    csUserId: filters.csUserId,
  });
  const { data: clientsData, isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const createMutation = trpc.reports.create.useMutation({
    onSuccess: () => {
      utils.reports.list.invalidate();
      setShowCreate(false);
      setSelectedClient("");
      setSelectedMonth("");
      toast.success("تم إنشاء التقرير بنجاح");
    },
    onError: (err) => toast.error(err.message),
  });

  const reports = reportsData ?? [];
  const clients = clientsData ?? [];

  const months = useMemo(() => {
    const now = new Date();
    const result = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("ar-SA", { year: "numeric", month: "long" });
      result.push({ value: val, label });
    }
    return result;
  }, []);

  const isLoading = reportsLoading || clientsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const canCreate = user?.role === "accountant" || user?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">التقارير</h1>
          <p className="text-muted-foreground text-sm mt-1">{reports.length} تقرير</p>
        </div>
        {canCreate && clients.length > 0 && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            تقرير جديد
          </Button>
        )}
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        show={{
          month: true,
          stage: true,
          accountant: user?.role !== "accountant",
          teamLeader: user?.role === "admin" || user?.role === "operation_manager",
          cs: user?.role === "admin" || user?.role === "operation_manager",
        }}
      />

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد تقارير</h3>
            <p className="text-muted-foreground text-sm mb-4">ابدأ بإنشاء تقرير شهري لأحد عملائك</p>
            {canCreate && clients.length > 0 && (
              <Button onClick={() => setShowCreate(true)} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                إنشاء أول تقرير
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const client = clients.find((c) => c.id === report.clientId);
            const stageInfo = REPORT_STAGES[report.stage as keyof typeof REPORT_STAGES];
            const colorClass = stageColors[report.stage] ?? "bg-gray-100 text-gray-700";
            return (
              <Card
                key={report.id}
                className="hover:shadow-md transition-all cursor-pointer"
                onClick={() => setLocation(`/reports/${report.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{client?.name ?? `عميل #${report.clientId}`}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {report.month} — تقرير #{report.id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${colorClass} border-0`}>
                        {stageInfo?.ar ?? report.stage}
                      </Badge>
                      <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Report Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إنشاء تقرير جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>العميل *</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الشهر *</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الشهر" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            <Button
              onClick={() => {
                if (!selectedClient || !selectedMonth) return;
                createMutation.mutate({ clientId: parseInt(selectedClient), month: selectedMonth });
              }}
              disabled={!selectedClient || !selectedMonth || createMutation.isPending}
            >
              {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
