import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, Plus, CheckCircle2, Clock, AlertTriangle, Trash2, Circle } from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "معلقة", icon: Circle, color: "text-slate-500" },
  in_progress: { label: "قيد التنفيذ", icon: Clock, color: "text-amber-600" },
  done: { label: "منجزة", icon: CheckCircle2, color: "text-emerald-600" },
};

export default function ReportTasksPage() {
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [reportId, setReportId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  const utils = trpc.useUtils();

  // Get all reports for the current user to pick from
  const { data: reports = [] } = trpc.reports.list.useQuery({});

  // Get tasks for selected report
  const { data: tasks = [], isLoading } = trpc.tasks.byReport.useQuery(
    { reportId: reportId! },
    { enabled: !!reportId }
  );

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.byReport.invalidate();
      setShowAdd(false);
      setTitle("");
      setDueDate("");
      toast.success("تمت إضافة المهمة");
    },
    onError: () => toast.error("فشل في إضافة المهمة"),
  });

  const updateStatus = trpc.tasks.updateStatus.useMutation({
    onSuccess: () => utils.tasks.byReport.invalidate(),
    onError: () => toast.error("فشل في تحديث المهمة"),
  });

  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.byReport.invalidate();
      toast.success("تم حذف المهمة");
    },
    onError: () => toast.error("فشل في حذف المهمة"),
  });

  const pendingTasks = tasks.filter((t: any) => t.status !== "done");
  const doneTasks = tasks.filter((t: any) => t.status === "done");

  const nextStatus = (current: string) => {
    if (current === "pending") return "in_progress";
    if (current === "in_progress") return "done";
    return "pending";
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CheckSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">المهام الداخلية</h1>
            <p className="text-muted-foreground text-sm">إدارة مهام التقارير</p>
          </div>
        </div>
        {reportId && (
          <Button onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة مهمة
          </Button>
        )}
      </div>

      {/* Report Selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <label className="text-sm font-medium whitespace-nowrap">اختر التقرير:</label>
            <Select
              value={reportId ? String(reportId) : ""}
              onValueChange={(v) => setReportId(Number(v))}
            >
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="اختر تقريراً لعرض مهامه..." />
              </SelectTrigger>
              <SelectContent>
                {reports.map((r: any) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.clientName} — {r.month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!reportId ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>اختر تقريراً لعرض مهامه</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending / In Progress Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                المهام النشطة ({pendingTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">لا توجد مهام نشطة</p>
              ) : (
                <div className="space-y-3">
                  {pendingTasks.map((task: any) => {
                    const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
                    const Icon = cfg.icon;
                    return (
                      <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                        <button
                          onClick={() => updateStatus.mutate({ taskId: task.id, status: nextStatus(task.status) as any })}
                          className={`mt-0.5 shrink-0 ${cfg.color} hover:scale-110 transition-transform`}
                          title="تحديث الحالة"
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="secondary" className="text-xs">{cfg.label}</Badge>
                            {task.dueDate && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {new Date(task.dueDate).toLocaleDateString("ar-SA")}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteTask.mutate({ taskId: task.id })}
                          className="shrink-0 text-muted-foreground hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Done Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                المهام المنجزة ({doneTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {doneTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">لا توجد مهام منجزة</p>
              ) : (
                <div className="space-y-3">
                  {doneTasks.map((task: any) => (
                    <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20 opacity-70">
                      <button
                        onClick={() => updateStatus.mutate({ taskId: task.id, status: "pending" })}
                        className="mt-0.5 shrink-0 text-emerald-600 hover:text-muted-foreground transition-colors"
                      >
                        <CheckCircle2 className="h-5 w-5 fill-emerald-600 text-white" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-through text-muted-foreground">{task.title}</p>
                      </div>
                      <button
                        onClick={() => deleteTask.mutate({ taskId: task.id })}
                        className="shrink-0 text-muted-foreground hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Task Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة مهمة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">عنوان المهمة *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: انتظار كشف بنكي"
                dir="rtl"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">تاريخ الاستحقاق (اختياري)</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
            <Button
              onClick={() => {
                if (!title.trim() || !reportId) return;
                createTask.mutate({
                  reportId,
                  title: title.trim(),
                  dueDate: dueDate || undefined,
                });
              }}
              disabled={!title.trim() || createTask.isPending}
            >
              {createTask.isPending ? "جاري الإضافة..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
