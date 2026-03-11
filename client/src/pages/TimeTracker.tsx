import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Play, Square, Clock, BarChart3, Trash2, Timer, TrendingUp, Hash, Calendar } from "lucide-react";
import { SOP_TASK_TYPES } from "../../../drizzle/schema";
import { MONTH_NAMES_AR } from "../../../shared/types";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDurationLong(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h} ساعة و${m} دقيقة`;
  if (h > 0) return `${h} ساعة`;
  if (m > 0) return `${m} دقيقة`;
  return `${seconds} ثانية`;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function TimeTracker() {
  const { user: _user } = useAuth();

  // Month selector
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  // Form state
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedSopCode, setSelectedSopCode] = useState<string>("");
  const [transactionCount, setTransactionCount] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");

  // Live timer state
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Data queries
  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: activeSession, refetch: refetchActive } = trpc.timeTracking.activeSession.useQuery();
  const { data: sessions = [], refetch: refetchSessions } = trpc.timeTracking.mySessions.useQuery({ month: selectedMonth });
  const { data: stats, refetch: refetchStats } = trpc.timeTracking.myStats.useQuery({ month: selectedMonth });

  // Mutations
  const startMutation = trpc.timeTracking.start.useMutation({
    onSuccess: () => {
      toast.success("تم بدء التايمر");
      refetchActive();
      refetchSessions();
      refetchStats();
      setNotes("");
    },
    onError: (e) => toast.error(e.message),
  });

  const stopMutation = trpc.timeTracking.stop.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إيقاف التايمر — المدة: ${formatDurationLong(data.durationSeconds)}`);
      refetchActive();
      refetchSessions();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.timeTracking.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الجلسة");
      refetchSessions();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });

  // Start/stop timer interval
  useEffect(() => {
    if (activeSession) {
      const startElapsed = Math.floor((Date.now() - activeSession.startedAt) / 1000);
      setElapsed(startElapsed);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - activeSession.startedAt) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession]);

  // Month options (last 12 months)
  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthIdx = d.getMonth();
      const label = `${MONTH_NAMES_AR[monthIdx]} ${d.getFullYear()}`;
      opts.push({ val, label });
    }
    return opts;
  }, []);

  const selectedSop = SOP_TASK_TYPES.find(s => s.code === selectedSopCode);
  const activeClient = clients.find(c => c.id === activeSession?.clientId);
  const activeSop = SOP_TASK_TYPES.find(s => s.code === activeSession?.sopCode);

  const handleStart = () => {
    if (!selectedClientId) return toast.error("اختر عميلاً أولاً");
    if (!selectedSopCode) return toast.error("اختر نوع المهمة أولاً");
    startMutation.mutate({
      clientId: Number(selectedClientId),
      sopCode: selectedSop!.code,
      sopName: selectedSop!.name,
      transactionCount: Number(transactionCount) || 0,
      month: selectedMonth,
      notes: notes || undefined,
    });
  };

  const handleStop = () => {
    if (!activeSession) return;
    stopMutation.mutate({ sessionId: activeSession.id });
  };

  // Group sessions by SOP for summary
  const sessionsBySop = useMemo(() => {
    const map = new Map<string, { sopCode: string; sopName: string; count: number; totalSeconds: number; totalTx: number }>();
    for (const s of sessions) {
      if (!s.endedAt) continue;
      const existing = map.get(s.sopCode) ?? { sopCode: s.sopCode, sopName: s.sopName, count: 0, totalSeconds: 0, totalTx: 0 };
      existing.count++;
      existing.totalSeconds += s.durationSeconds ?? 0;
      existing.totalTx += s.transactionCount;
      map.set(s.sopCode, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [sessions]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">تتبع الوقت والجهد</h1>
            <p className="text-muted-foreground text-sm mt-1">قِس الوقت المستغرق لكل مهمة مع كل عميل</p>
          </div>
          {/* Month selector */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44">
              <Calendar className="w-4 h-4 ml-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => (
                <SelectItem key={o.val} value={o.val}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/10 to-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي الوقت</p>
                  <p className="text-xl font-bold text-foreground">{formatDurationLong(stats.totalSeconds)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">عدد الجلسات</p>
                  <p className="text-xl font-bold text-foreground">{stats.totalSessions}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-500/10 to-amber-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Hash className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي المعاملات</p>
                  <p className="text-xl font-bold text-foreground">{stats.totalTransactions.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Timer Card */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Timer className="w-5 h-5 text-primary" />
                {activeSession ? "جلسة نشطة" : "بدء جلسة جديدة"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeSession ? (
                /* Active Session Display */
                <div className="space-y-4">
                  {/* Timer Display */}
                  <div className="text-center py-6 bg-primary/5 rounded-xl border border-primary/20">
                    <div className="text-5xl font-mono font-bold text-primary tracking-wider">
                      {formatDuration(elapsed)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">جارٍ التتبع...</p>
                  </div>

                  {/* Active Session Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-muted-foreground">العميل</span>
                      <span className="font-medium">{activeClient?.name ?? `#${activeSession.clientId}`}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-muted-foreground">نوع المهمة</span>
                      <div className="text-left">
                        <Badge variant="secondary" className="text-xs">{activeSession.sopCode}</Badge>
                        <span className="font-medium mr-2">{activeSop?.nameAr ?? activeSession.sopName}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-muted-foreground">عدد المعاملات</span>
                      <span className="font-medium">{activeSession.transactionCount}</span>
                    </div>
                  </div>

                  {/* Stop Button */}
                  <Button
                    onClick={handleStop}
                    disabled={stopMutation.isPending}
                    className="w-full h-12 text-base bg-red-500 hover:bg-red-600 text-white"
                    size="lg"
                  >
                    <Square className="w-5 h-5 ml-2 fill-current" />
                    إيقاف التايمر
                  </Button>
                </div>
              ) : (
                /* New Session Form */
                <div className="space-y-4">
                  {/* Client Selector */}
                  <div className="space-y-1.5">
                    <Label>العميل</Label>
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر العميل..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* SOP Selector */}
                  <div className="space-y-1.5">
                    <Label>نوع المهمة (SOP)</Label>
                    <Select value={selectedSopCode} onValueChange={setSelectedSopCode}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر نوع المهمة..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {SOP_TASK_TYPES.map(sop => (
                          <SelectItem key={sop.code} value={sop.code}>
                            <span className="text-muted-foreground text-xs ml-2">{sop.code}</span>
                            {sop.nameAr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedSop && (
                      <p className="text-xs text-muted-foreground">{selectedSop.name}</p>
                    )}
                  </div>

                  {/* Transaction Count */}
                  <div className="space-y-1.5">
                    <Label>عدد المعاملات</Label>
                    <Input
                      type="number"
                      min="0"
                      value={transactionCount}
                      onChange={e => setTransactionCount(e.target.value)}
                      placeholder="0"
                      className="text-center text-lg font-mono"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label>ملاحظات (اختياري)</Label>
                    <Textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="أي ملاحظات إضافية..."
                      rows={2}
                    />
                  </div>

                  {/* Start Button */}
                  <Button
                    onClick={handleStart}
                    disabled={startMutation.isPending || !selectedClientId || !selectedSopCode}
                    className="w-full h-12 text-base"
                    size="lg"
                  >
                    <Play className="w-5 h-5 ml-2 fill-current" />
                    بدء التايمر
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SOP Summary */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-5 h-5 text-primary" />
                ملخص حسب نوع المهمة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessionsBySop.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">لا توجد جلسات مكتملة هذا الشهر</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessionsBySop.map(sop => {
                    const sopInfo = SOP_TASK_TYPES.find(s => s.code === sop.sopCode);
                    const maxSeconds = sessionsBySop[0]?.totalSeconds ?? 1;
                    const pct = Math.round((sop.totalSeconds / maxSeconds) * 100);
                    return (
                      <div key={sop.sopCode} className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-mono">{sop.sopCode}</Badge>
                            <span className="font-medium">{sopInfo?.nameAr ?? sop.sopName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground text-xs">
                            <span>{sop.count} جلسة</span>
                            <span className="font-mono font-medium text-foreground">{formatDuration(sop.totalSeconds)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {sop.totalTx > 0 && (
                          <p className="text-xs text-muted-foreground">{sop.totalTx.toLocaleString()} معاملة</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Session History */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-5 h-5 text-primary" />
              سجل الجلسات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد جلسات لهذا الشهر</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="text-right py-2 px-3 font-medium">العميل</th>
                      <th className="text-right py-2 px-3 font-medium">المهمة</th>
                      <th className="text-center py-2 px-3 font-medium">المعاملات</th>
                      <th className="text-center py-2 px-3 font-medium">المدة</th>
                      <th className="text-right py-2 px-3 font-medium">التاريخ</th>
                      <th className="text-center py-2 px-3 font-medium">الحالة</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(session => {
                      const client = clients.find(c => c.id === session.clientId);
                      const sop = SOP_TASK_TYPES.find(s => s.code === session.sopCode);
                      const isRunning = !session.endedAt;
                      return (
                        <tr key={session.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 font-medium">{client?.name ?? `#${session.clientId}`}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs font-mono">{session.sopCode}</Badge>
                              <span>{sop?.nameAr ?? session.sopName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-mono">{session.transactionCount}</td>
                          <td className="py-3 px-3 text-center font-mono font-medium">
                            {isRunning ? (
                              <span className="text-primary animate-pulse">{formatDuration(elapsed)}</span>
                            ) : (
                              formatDuration(session.durationSeconds ?? 0)
                            )}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground text-xs">
                            {new Date(session.createdAt).toLocaleDateString("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isRunning ? (
                              <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-300 text-xs">نشطة</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">مكتملة</Badge>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {!isRunning && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteMutation.mutate({ sessionId: session.id })}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
