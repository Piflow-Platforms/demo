import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Calendar, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { MONTH_NAMES_AR, REPORT_STAGES, isVatDueMonth } from "@shared/types";

const DAYS_AR = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

export default function WorkCalendarPage() {
  const { user } = useAuth();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const monthStr = `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
  const prevMonthStr = viewMonth === 1
    ? `${viewYear - 1}-12`
    : `${viewYear}-${String(viewMonth - 1).padStart(2, "0")}`;

  // Get delayed reports (reports stuck in a stage for too long)
  const { data: delayedReports = [] } = trpc.analytics.delayedReports.useQuery({ days: 3 });

  // Get monthly progress for current month
  const { data: progress = [] } = trpc.analytics.monthlyProgress.useQuery({ month: monthStr });

  const vatInfo = isVatDueMonth(viewYear, viewMonth);
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const days: Array<{ day: number | null; isToday: boolean; isPast: boolean }> = [];
    // Padding at start
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, isToday: false, isPast: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth - 1, d);
      const isToday = date.toDateString() === today.toDateString();
      const isPast = date < today && !isToday;
      days.push({ day: d, isToday, isPast });
    }
    return days;
  }, [viewYear, viewMonth, firstDay, daysInMonth]);

  const navigateMonth = (dir: 1 | -1) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setViewMonth(m);
    setViewYear(y);
    setSelectedDay(null);
  };

  // Important dates in this month
  const importantDates = useMemo(() => {
    const dates: Array<{ day: number; label: string; type: "vat" | "deadline" | "report" }> = [];
    // VAT due date (10th of the month)
    if (vatInfo.isVatDue) {
      dates.push({ day: 10, label: `إقرار ضريبي - ${vatInfo.quarterLabel}`, type: "vat" });
    }
    // Month-end deadline (25th)
    dates.push({ day: 25, label: "الموعد النهائي لتقارير الشهر السابق", type: "deadline" });
    return dates;
  }, [vatInfo]);

  const getDayEvents = (day: number) =>
    importantDates.filter(d => d.day === day);

  const selectedDayEvents = selectedDay ? getDayEvents(selectedDay) : [];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">تقويم العمل</h1>
          <p className="text-muted-foreground text-sm">مواعيد التقارير والإقرارات الضريبية</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-bold">
                  {MONTH_NAMES_AR[viewMonth]} {viewYear}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              {vatInfo.isVatDue && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs mt-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>هذا الشهر موعد الإقرار الضريبي لـ {vatInfo.quarterMonths}</span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS_AR.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                    {d}
                  </div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, idx) => {
                  if (!cell.day) return <div key={idx} />;
                  const events = getDayEvents(cell.day);
                  const hasVat = events.some(e => e.type === "vat");
                  const hasDeadline = events.some(e => e.type === "deadline");
                  const isSelected = selectedDay === cell.day;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDay(isSelected ? null : cell.day!)}
                      className={`
                        relative p-1.5 rounded-lg text-sm transition-all min-h-[44px] flex flex-col items-center
                        ${cell.isToday ? "bg-primary text-primary-foreground font-bold" : ""}
                        ${isSelected && !cell.isToday ? "bg-primary/20 ring-2 ring-primary" : ""}
                        ${!cell.isToday && !isSelected ? "hover:bg-muted" : ""}
                        ${cell.isPast && !cell.isToday ? "text-muted-foreground" : ""}
                      `}
                    >
                      <span>{cell.day}</span>
                      <div className="flex gap-0.5 mt-0.5">
                        {hasVat && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                        {hasDeadline && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>إقرار ضريبي</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>موعد نهائي</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span>اليوم</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Selected day events */}
          {selectedDay && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {selectedDay} {MONTH_NAMES_AR[viewMonth]} {viewYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDayEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لا توجد مواعيد في هذا اليوم</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.map((ev, i) => (
                      <div key={i} className={`p-2 rounded-md text-xs flex items-start gap-2 ${
                        ev.type === "vat" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        ev.type === "deadline" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                        "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}>
                        {ev.type === "vat" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> :
                         ev.type === "deadline" ? <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" /> :
                         <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                        <span>{ev.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Monthly progress summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                إنجاز {MONTH_NAMES_AR[viewMonth]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {progress.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا توجد بيانات لهذا الشهر</p>
              ) : (
                <div className="space-y-3">
                  {progress.slice(0, 5).map((p: any) => (
                    <div key={p.accountantId}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium truncate">{(p.accountantName ?? "").split(" ").slice(0, 2).join(" ")}</span>
                        <span className="text-muted-foreground">{p.completed}/{p.total}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            p.total === 0 ? "bg-muted" :
                            p.completed / p.total >= 0.8 ? "bg-emerald-500" :
                            p.completed / p.total >= 0.5 ? "bg-amber-500" : "bg-rose-500"
                          }`}
                          style={{ width: p.total > 0 ? `${Math.round((p.completed / p.total) * 100)}%` : "0%" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delayed reports */}
          {delayedReports.length > 0 && (
            <Card className="border-rose-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-rose-700">
                  <AlertTriangle className="h-4 w-4" />
                  تقارير متأخرة ({delayedReports.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {delayedReports.slice(0, 8).map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-rose-50">
                      <span className="font-medium truncate">{r.clientName}</span>
                      <Badge variant="destructive" className="text-xs shrink-0">
                        {r.daysStuck}ي
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming VAT deadlines */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                مواعيد الضريبة القادمة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                {[1, 2, 3].map(offset => {
                  let m = viewMonth + offset;
                  let y = viewYear;
                  if (m > 12) { m -= 12; y++; }
                  const vat = isVatDueMonth(y, m);
                  if (!vat.isVatDue) return null;
                  return (
                    <div key={offset} className="flex items-center gap-2 p-2 rounded-md bg-amber-50 border border-amber-100">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <div>
                        <p className="font-medium text-amber-800">{MONTH_NAMES_AR[m]} {y}</p>
                        <p className="text-amber-600">{vat.quarterLabel} — {vat.quarterMonths}</p>
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
                {[1, 2, 3].every(offset => {
                  let m = viewMonth + offset;
                  if (m > 12) m -= 12;
                  return !isVatDueMonth(viewYear, m).isVatDue;
                }) && (
                  <p className="text-muted-foreground">لا توجد مواعيد ضريبية في الأشهر القادمة</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
