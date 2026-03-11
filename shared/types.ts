/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

export type UserRole = "user" | "admin" | "accountant" | "team_leader" | "customer_success" | "cs_manager" | "operation_manager";

export type DataStatus = "not_received" | "partial" | "received";

export type ReportStage = "data_entry" | "justification" | "audit_review" | "quality_check" | "report_sent" | "sent_to_client";

export type FeedbackAction = "approved" | "rejected";

export type NotificationType = "audit_review" | "approved" | "rejected" | "report_ready";

export const REPORT_STAGES = {
  data_entry: { en: "Data Entry & Reconciliation", ar: "إدخال البيانات والمطابقة" },
  justification: { en: "Justification", ar: "التبرير والتوضيح" },
  audit_review: { en: "Audit & Review", ar: "المراجعة والتدقيق" },
  quality_check: { en: "Quality Check", ar: "فحص الجودة" },
  report_sent: { en: "Report Sent", ar: "تم إرسال التقرير" },
  sent_to_client: { en: "Sent to Client", ar: "تم الإرسال للعميل" },
} as const;

export const DATA_STATUSES = {
  not_received: { en: "Not Received", ar: "لم يتم الاستلام" },
  partial: { en: "Partial", ar: "جزئي" },
  received: { en: "Received", ar: "تم الاستلام" },
} as const;

export const USER_ROLES_MAP = {
  accountant: { en: "Accountant", ar: "محاسب" },
  team_leader: { en: "Team Leader", ar: "قائد الفريق" },
  customer_success: { en: "Customer Success", ar: "نجاح العملاء" },
  cs_manager: { en: "CS Manager", ar: "مدير نجاح العملاء" },
  operation_manager: { en: "Operation Manager", ar: "مدير العمليات" },
  admin: { en: "Admin", ar: "مدير النظام" },
  user: { en: "User", ar: "مستخدم" },
} as const;

export const DATA_FIELDS = [
  { key: "bankStatus" as const, en: "Bank", ar: "البنك" },
  { key: "salariesStatus" as const, en: "Salaries", ar: "الرواتب" },
  { key: "salesStatus" as const, en: "Sales", ar: "المبيعات" },
  { key: "purchasesStatus" as const, en: "Purchases", ar: "المشتريات" },
  { key: "inventoryStatus" as const, en: "Inventory", ar: "المخزون" },
] as const;

export const STAGE_ORDER: ReportStage[] = [
  "data_entry",
  "justification",
  "audit_review",
  "quality_check",
  "report_sent",
  "sent_to_client",
];

/**
 * VAT filing quarters:
 * Q3 (Jul-Sep) → VAT due Oct
 * Q4 (Oct-Dec) → VAT due Jan next year
 * Q1 (Jan-Mar) → VAT due Apr
 * Q2 (Apr-Jun) → VAT due Jul
 */
export const VAT_QUARTERS: Record<number, { months: number[]; dueMonth: number; dueYearOffset: number; label: string }> = {
  1: { months: [1, 2, 3], dueMonth: 4, dueYearOffset: 0, label: "الربع الأول" },
  2: { months: [4, 5, 6], dueMonth: 7, dueYearOffset: 0, label: "الربع الثاني" },
  3: { months: [7, 8, 9], dueMonth: 10, dueYearOffset: 0, label: "الربع الثالث" },
  4: { months: [10, 11, 12], dueMonth: 1, dueYearOffset: 1, label: "الربع الرابع" },
};

export function getVatQuarter(month: number): { quarter: number; info: typeof VAT_QUARTERS[1] } | null {
  for (const [q, info] of Object.entries(VAT_QUARTERS)) {
    if (info.months.includes(month)) {
      return { quarter: parseInt(q), info };
    }
  }
  return null;
}

export function isVatDueMonth(year: number, month: number): { isVatDue: boolean; quarterLabel?: string; quarterMonths?: string } {
  // Check if this month is a VAT due month
  for (const [, info] of Object.entries(VAT_QUARTERS)) {
    const dueYear = month === 1 && info.dueYearOffset === 1 ? year - 1 : year;
    if (info.dueMonth === month) {
      const monthNames = info.months.map(m => {
        const d = new Date(dueYear + info.dueYearOffset - (info.dueYearOffset === 1 ? 1 : 0), m - 1);
        return d.toLocaleDateString("ar-SA", { month: "long" });
      });
      return { isVatDue: true, quarterLabel: info.label, quarterMonths: monthNames.join("، ") };
    }
  }
  return { isVatDue: false };
}

export const MONTH_NAMES_AR: Record<number, string> = {
  1: "يناير", 2: "فبراير", 3: "مارس", 4: "أبريل",
  5: "مايو", 6: "يونيو", 7: "يوليو", 8: "أغسطس",
  9: "سبتمبر", 10: "أكتوبر", 11: "نوفمبر", 12: "ديسمبر",
};

export const ATTACHMENT_TYPES = {
  cr: { en: "Commercial Register", ar: "السجل التجاري" },
  contract: { en: "Foundation Contract", ar: "عقد التأسيس" },
  eol: { en: "EOL", ar: "EOL" },
  logo: { en: "Logo", ar: "الشعار" },
  other: { en: "Other", ar: "أخرى" },
} as const;
