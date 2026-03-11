import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Role determines the user's access level in the accounting workflow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "accountant", "team_leader", "customer_success", "cs_manager", "operation_manager"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Clients managed by accountants.
 * Each accountant can manage up to 8 clients.
 * Includes master data (fixed company info) and sort order for drag-and-drop.
 */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  companyName: varchar("companyName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  accountantId: int("accountantId").notNull(),

  // ── Master Data (fixed company information) ──────────────────
  /** الرقم الضريبي */
  taxNumber: varchar("taxNumber", { length: 50 }),
  /** رقم السجل التجاري */
  crNumber: varchar("crNumber", { length: 50 }),
  /** تاريخ انتهاء السجل التجاري */
  crExpiry: varchar("crExpiry", { length: 20 }),
  /** رأس المال */
  capital: varchar("capital", { length: 100 }),
  /** عدد الشركاء */
  partnersCount: int("partnersCount"),
  /** عدد المنشآت */
  branchesCount: int("branchesCount"),
  /** نوع العقد / الشركة */
  companyType: varchar("companyType", { length: 100 }),
  /** تاريخ التأسيس */
  establishedDate: varchar("establishedDate", { length: 20 }),
  /** النشاط التجاري */
  businessActivity: varchar("businessActivity", { length: 255 }),
  /** ملاحظات عامة */
  masterNotes: text("masterNotes"),

  // ── Logo ─────────────────────────────────────────────────────
  /** URL of the client logo stored in S3 */
  logoUrl: text("logoUrl"),
  logoKey: varchar("logoKey", { length: 500 }),

  // ── Sort order for drag-and-drop within accountant's list ─────
  sortOrder: int("sortOrder").default(0).notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Client attachments - files uploaded for each client.
 * Types: cr (السجل التجاري), contract (عقد التأسيس), eol (EOL), logo (الشعار), other
 */
export const clientAttachments = mysqlTable("client_attachments", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  type: mysqlEnum("type", ["cr", "contract", "eol", "logo", "other"]).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  uploadedBy: int("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClientAttachment = typeof clientAttachments.$inferSelect;
export type InsertClientAttachment = typeof clientAttachments.$inferInsert;

/**
 * Team leader assignments - which accountants are supervised by which team leader.
 */
export const teamAssignments = mysqlTable("team_assignments", {
  id: int("id").autoincrement().primaryKey(),
  teamLeaderId: int("teamLeaderId").notNull(),
  accountantId: int("accountantId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TeamAssignment = typeof teamAssignments.$inferSelect;
export type InsertTeamAssignment = typeof teamAssignments.$inferInsert;

/**
 * CS (Customer Success) assignments - which clients are handled by which CS.
 * Each CS handles max 25 clients.
 */
export const csAssignments = mysqlTable("cs_assignments", {
  id: int("id").autoincrement().primaryKey(),
  csUserId: int("csUserId").notNull(),
  clientId: int("clientId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CsAssignment = typeof csAssignments.$inferSelect;
export type InsertCsAssignment = typeof csAssignments.$inferInsert;

/**
 * Monthly report for each client.
 * Tracks the report stage workflow and data receipt status.
 */
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  accountantId: int("accountantId").notNull(),
  /** Month in format YYYY-MM */
  month: varchar("month", { length: 7 }).notNull(),
  
  /** Data receipt statuses */
  bankStatus: mysqlEnum("bankStatus", ["not_received", "partial", "received"]).default("not_received").notNull(),
  salariesStatus: mysqlEnum("salariesStatus", ["not_received", "partial", "received"]).default("not_received").notNull(),
  salesStatus: mysqlEnum("salesStatus", ["not_received", "partial", "received"]).default("not_received").notNull(),
  purchasesStatus: mysqlEnum("purchasesStatus", ["not_received", "partial", "received"]).default("not_received").notNull(),
  inventoryStatus: mysqlEnum("inventoryStatus", ["not_received", "partial", "received"]).default("not_received").notNull(),
  
  /** Report stage workflow */
  stage: mysqlEnum("stage", [
    "data_entry",
    "justification",
    "audit_review",
    "quality_check",
    "report_sent",
    "sent_to_client"
  ]).default("data_entry").notNull(),
  
  /** Notes from accountant */
  notes: text("notes"),

  // ── Attached Report File ─────────────────────────────────────
  /** URL of the uploaded report file (PDF/Excel) stored in S3 */
  reportFileUrl: text("reportFileUrl"),
  reportFileKey: varchar("reportFileKey", { length: 500 }),
  reportFileName: varchar("reportFileName", { length: 255 }),
  reportFileMime: varchar("reportFileMime", { length: 100 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * Feedback from team leader on reports.
 * When a report is rejected during quality check, feedback is recorded here.
 */
export const feedbacks = mysqlTable("feedbacks", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  teamLeaderId: int("teamLeaderId").notNull(),
  comment: text("comment").notNull(),
  action: mysqlEnum("action", ["approved", "rejected"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Feedback = typeof feedbacks.$inferSelect;
export type InsertFeedback = typeof feedbacks.$inferInsert;

/**
 * In-app notifications for workflow transitions.
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["audit_review", "approved", "rejected", "report_ready"]).notNull(),
  reportId: int("reportId"),
  isRead: int("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/** Report stage labels for display */
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

export const USER_ROLES = {
  accountant: { en: "Accountant", ar: "محاسب" },
  team_leader: { en: "Team Leader", ar: "قائد الفريق" },
  customer_success: { en: "Customer Success", ar: "نجاح العملاء" },
  operation_manager: { en: "Operation Manager", ar: "مدير العمليات" },
  admin: { en: "Admin", ar: "مدير النظام" },
  user: { en: "User", ar: "مستخدم" },
} as const;

/**
 * Comments/discussion thread on a report.
 * Any role can post a comment; visible to all parties involved.
 */
export const reportComments = mysqlTable("report_comments", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 255 }).notNull(),
  userRole: varchar("userRole", { length: 64 }).notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReportComment = typeof reportComments.$inferSelect;
export type InsertReportComment = typeof reportComments.$inferInsert;

/**
 * Internal tasks on a report.
 * Any team member can add tasks; assigned to a specific user.
 */
export const reportTasks = mysqlTable("report_tasks", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  createdBy: int("createdBy").notNull(),
  assignedTo: int("assignedTo"),
  title: varchar("title", { length: 500 }).notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "done"]).default("pending").notNull(),
  dueDate: varchar("dueDate", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReportTask = typeof reportTasks.$inferSelect;
export type InsertReportTask = typeof reportTasks.$inferInsert;

/**
 * Time tracking sessions - records time spent by accountants on specific tasks per client.
 * Each session has a SOP code, client, transaction count, start/end time.
 */
export const timeSessions = mysqlTable("time_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId").notNull(),
  /** SOP code e.g. SOP-A01 */
  sopCode: varchar("sopCode", { length: 20 }).notNull(),
  /** SOP full name */
  sopName: varchar("sopName", { length: 255 }).notNull(),
  /** Number of transactions processed */
  transactionCount: int("transactionCount").default(0).notNull(),
  /** Month this session belongs to e.g. 2025-03 */
  month: varchar("month", { length: 7 }).notNull(),
  /** When the timer was started */
  startedAt: bigint("startedAt", { mode: "number" }).notNull(),
  /** When the timer was stopped (null = still running) */
  endedAt: bigint("endedAt", { mode: "number" }),
  /** Total duration in seconds (set when stopped) */
  durationSeconds: int("durationSeconds"),
  /** Optional notes */
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TimeSession = typeof timeSessions.$inferSelect;
export type InsertTimeSession = typeof timeSessions.$inferInsert;

/** All SOP task types available for time tracking */
export const SOP_TASK_TYPES = [
  { code: "SOP-A01", name: "Account Payable Review", nameAr: "مراجعة الحسابات الدائنة" },
  { code: "SOP-A02", name: "Account Receivable Review", nameAr: "مراجعة الحسابات المدينة" },
  { code: "SOP-A03", name: "Add Contacts", nameAr: "إضافة جهات الاتصال" },
  { code: "SOP-A04", name: "Add Chart of Accounts", nameAr: "إضافة دليل الحسابات" },
  { code: "SOP-A05", name: "Audit", nameAr: "التدقيق" },
  { code: "SOP-A06", name: "Bank Reconciliation", nameAr: "التسوية البنكية" },
  { code: "SOP-A07", name: "Bank Transactions", nameAr: "المعاملات البنكية" },
  { code: "SOP-A25", name: "Bank Transfers", nameAr: "التحويلات البنكية" },
  { code: "SOP-A08", name: "Bills (Purchases)", nameAr: "الفواتير (المشتريات)" },
  { code: "SOP-A09", name: "Collections", nameAr: "التحصيلات" },
  { code: "SOP-A10", name: "Data Processing", nameAr: "معالجة البيانات" },
  { code: "SOP-A11", name: "Deductions / Discount", nameAr: "الخصومات والحسومات" },
  { code: "SOP-A12", name: "Expenses", nameAr: "المصروفات" },
  { code: "SOP-A13", name: "Financial Analysis", nameAr: "التحليل المالي" },
  { code: "SOP-A14", name: "Financial Plan", nameAr: "الخطة المالية" },
  { code: "SOP-A15", name: "Invoices (Sales)", nameAr: "الفواتير (المبيعات)" },
  { code: "SOP-A16", name: "Make Cost Center List", nameAr: "قائمة مراكز التكلفة" },
  { code: "SOP-A17", name: "Manual Journals", nameAr: "القيود اليدوية" },
  { code: "SOP-A18", name: "Meeting with Clients", nameAr: "اجتماع مع العملاء" },
  { code: "SOP-A19", name: "Notes & Justifications", nameAr: "الملاحظات والمبررات" },
  { code: "SOP-A20", name: "Payments", nameAr: "المدفوعات" },
  { code: "SOP-A21", name: "Reports", nameAr: "التقارير" },
  { code: "SOP-A22", name: "Run Depreciation Assets", nameAr: "إهلاك الأصول" },
  { code: "SOP-A23", name: "Setup", nameAr: "الإعداد والتهيئة" },
  { code: "SOP-A24", name: "Wages and Salaries", nameAr: "الأجور والرواتب" },
  { code: "SOP-B07", name: "Google Drive Archiving", nameAr: "أرشفة Google Drive" },
  { code: "SOP-C01", name: "Filling SOP", nameAr: "تعبئة الـ SOP" },
  { code: "SOP-C02", name: "Follow Up", nameAr: "المتابعة" },
  { code: "SOP-C03", name: "Client Profile", nameAr: "ملف العميل" },
  { code: "SOP-C04", name: "Meeting with PiFlow Team", nameAr: "اجتماع مع فريق PiFlow" },
  { code: "SOP-C05", name: "Meeting with Team Leader", nameAr: "اجتماع مع قائد الفريق" },
  { code: "SOP-C06", name: "Filling the Accountant Sheet", nameAr: "تعبئة شيت المحاسب" },
  { code: "SOP-C07", name: "Filling the Work Report", nameAr: "تعبئة تقرير العمل" },
] as const;

export const ATTACHMENT_TYPES = {
  cr: { en: "Commercial Register", ar: "السجل التجاري" },
  contract: { en: "Foundation Contract", ar: "عقد التأسيس" },
  eol: { en: "EOL", ar: "EOL" },
  logo: { en: "Logo", ar: "الشعار" },
  other: { en: "Other", ar: "أخرى" },
} as const;

/**
 * CS Tickets — raised by Team Leaders for CS to handle.
 * Types: complaint, extra_service, volume_increase, data_delay, other
 */
export const csTickets = mysqlTable("cs_tickets", {
  id: int("id").autoincrement().primaryKey(),
  /** The TL or accountant who raised the ticket */
  raisedBy: int("raisedBy").notNull(),
  /** CS user assigned to handle it */
  assignedTo: int("assignedTo"),
  /** Client this ticket is about */
  clientId: int("clientId").notNull(),
  /** Ticket category */
  type: mysqlEnum("type", ["complaint", "extra_service", "volume_increase", "data_delay", "other"]).notNull(),
  /** Priority level */
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  /** Current status */
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).default("open").notNull(),
  /** Short title */
  title: varchar("title", { length: 500 }).notNull(),
  /** Full description */
  description: text("description"),
  /** Resolution notes (filled by CS when resolved) */
  resolution: text("resolution"),
  /** Month this ticket relates to e.g. 2025-03 */
  month: varchar("month", { length: 7 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CsTicket = typeof csTickets.$inferSelect;
export type InsertCsTicket = typeof csTickets.$inferInsert;

/**
 * Client portal users — clients can log in with email/password to upload data and track reports.
 * Separate from the main OAuth-based user system.
 */
export const clientPortalUsers = mysqlTable("client_portal_users", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  /** bcrypt hashed password */
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ClientPortalUser = typeof clientPortalUsers.$inferSelect;
export type InsertClientPortalUser = typeof clientPortalUsers.$inferInsert;

/**
 * Client data uploads — files uploaded by clients (or accountants on their behalf)
 * for each data category per month.
 * Each file goes through a review cycle: pending → approved | rejected | reupload_requested
 * Re-uploads create a new record linked to the original via parentId.
 */
export const clientDataUploads = mysqlTable("client_data_uploads", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  /** Month this upload belongs to e.g. 2025-03 */
  month: varchar("month", { length: 7 }).notNull(),
  /** Data category */
  type: mysqlEnum("type", ["bank", "salaries", "sales", "purchases", "inventory", "other"]).notNull(),
  /** S3 file URL */
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  /** Who uploaded: 'client' or 'accountant' */
  uploadedByType: mysqlEnum("uploadedByType", ["client", "accountant"]).default("accountant").notNull(),
  /** User ID if uploaded by accountant, null if by client portal */
  uploadedByUserId: int("uploadedByUserId"),
  /** Client portal user ID if uploaded by client */
  uploadedByClientPortalId: int("uploadedByClientPortalId"),
  notes: text("notes"),

  // ─── Review fields ────────────────────────────────────────────────────────────────────────
  /** Review status: pending=بانتظار, approved=موافق, rejected=مرفوض, reupload_requested=مطلوب إعادة رفع */
  status: mysqlEnum("status", ["pending", "approved", "rejected", "reupload_requested"]).default("pending").notNull(),
  /** Reason for rejection or re-upload request (filled by accountant) */
  rejectionReason: text("rejectionReason"),
  /** Accountant user ID who reviewed this file */
  reviewedBy: int("reviewedBy"),
  /** When the review was done */
  reviewedAt: timestamp("reviewedAt"),
  /** Version number: 1 for first upload, 2 for first re-upload, etc. */
  version: int("version").default(1).notNull(),
  /** Link to the original file this is a re-upload of (null for first upload) */
  parentId: int("parentId"),
  /** Whether this is the latest version for this client+month+type combination */
  isLatest: int("isLatest").default(1).notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientDataUpload = typeof clientDataUploads.$inferSelect;
export type InsertClientDataUpload = typeof clientDataUploads.$inferInsert;

export const UPLOAD_STATUSES = {
  pending: { en: "Pending Review", ar: "بانتظار المراجعة", color: "yellow" },
  approved: { en: "Approved", ar: "تمت الموافقة", color: "green" },
  rejected: { en: "Rejected", ar: "مرفوض", color: "red" },
  reupload_requested: { en: "Re-upload Requested", ar: "مطلوب إعادة الرفع", color: "orange" },
} as const;
