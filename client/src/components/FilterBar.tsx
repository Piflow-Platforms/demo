import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Filter } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { REPORT_STAGES, STAGE_ORDER } from "@shared/types";

export interface FilterValues {
  month?: string;
  stage?: string;
  accountantId?: number;
  teamLeaderId?: number;
  csUserId?: number;
}

interface FilterBarProps {
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
  /** Which filters to show */
  show?: {
    month?: boolean;
    stage?: boolean;
    accountant?: boolean;
    teamLeader?: boolean;
    cs?: boolean;
  };
  availableMonths?: string[];
}

const MONTH_NAMES: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};

function formatMonth(month: string) {
  const [year, m] = month.split("-");
  return `${MONTH_NAMES[m] ?? m} ${year}`;
}

export default function FilterBar({ filters, onChange, show = {}, availableMonths }: FilterBarProps) {
  const { data: options } = trpc.filters.options.useQuery();

  const activeCount = Object.values(filters).filter(Boolean).length;

  const update = (key: keyof FilterValues, value: string | number | undefined) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  const clearAll = () => onChange({});

  const months = availableMonths ?? options?.months ?? [];

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border/50">
      {/* Filter icon + label */}
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
        <Filter className="h-4 w-4" />
        <span>فلترة</span>
        {activeCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {activeCount}
          </Badge>
        )}
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Month filter */}
      {show.month !== false && months.length > 0 && (
        <Select
          value={filters.month ?? "all"}
          onValueChange={v => update("month", v === "all" ? undefined : v)}
        >
          <SelectTrigger className="h-8 w-[160px] text-sm bg-background">
            <SelectValue placeholder="كل الأشهر" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأشهر</SelectItem>
            {months.map(m => (
              <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Stage filter */}
      {show.stage !== false && (
        <Select
          value={filters.stage ?? "all"}
          onValueChange={v => update("stage", v === "all" ? undefined : v)}
        >
          <SelectTrigger className="h-8 w-[180px] text-sm bg-background">
            <SelectValue placeholder="كل المراحل" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المراحل</SelectItem>
            {STAGE_ORDER.map(s => (
              <SelectItem key={s} value={s}>{REPORT_STAGES[s].ar}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Team Leader filter */}
      {show.teamLeader && options && options.teamLeaders.length > 1 && (
        <Select
          value={filters.teamLeaderId?.toString() ?? "all"}
          onValueChange={v => update("teamLeaderId", v === "all" ? undefined : parseInt(v))}
        >
          <SelectTrigger className="h-8 w-[180px] text-sm bg-background">
            <SelectValue placeholder="كل قادة الفرق" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل قادة الفرق</SelectItem>
            {options.teamLeaders.map(tl => (
              <SelectItem key={tl.id} value={tl.id.toString()}>{tl.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Accountant filter */}
      {show.accountant && options && options.accountants.length > 1 && (
        <Select
          value={filters.accountantId?.toString() ?? "all"}
          onValueChange={v => update("accountantId", v === "all" ? undefined : parseInt(v))}
        >
          <SelectTrigger className="h-8 w-[180px] text-sm bg-background">
            <SelectValue placeholder="كل المحاسبين" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المحاسبين</SelectItem>
            {options.accountants.map(a => (
              <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* CS filter */}
      {show.cs && options && options.csUsers.length > 1 && (
        <Select
          value={filters.csUserId?.toString() ?? "all"}
          onValueChange={v => update("csUserId", v === "all" ? undefined : parseInt(v))}
        >
          <SelectTrigger className="h-8 w-[180px] text-sm bg-background">
            <SelectValue placeholder="كل فريق CS" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل فريق CS</SelectItem>
            {options.csUsers.map(cs => (
              <SelectItem key={cs.id} value={cs.id.toString()}>{cs.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Clear all */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          onClick={clearAll}
        >
          <X className="h-3.5 w-3.5 ml-1" />
          مسح الفلاتر
        </Button>
      )}
    </div>
  );
}
