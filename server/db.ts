import { and, eq, inArray, desc, sql, isNull, not } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  clients, InsertClient,
  clientAttachments, InsertClientAttachment,
  teamAssignments, InsertTeamAssignment,
  csAssignments, InsertCsAssignment,
  reports, InsertReport,
  feedbacks, InsertFeedback,
  notifications, InsertNotification,
  reportComments, InsertReportComment,
  reportTasks, InsertReportTask,
  timeSessions, InsertTimeSession,
  csTickets,
  clientDataUploads,
  clientPortalUsers,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User Helpers ────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users);
}

export async function getUsersByRole(role: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.role, role as any));
}

export async function updateUserRole(userId: number, role: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role: role as any }).where(eq(users.id, userId));
}

// ─── Client Helpers ──────────────────────────────────────────

export async function getClientsByAccountant(accountantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients).where(eq(clients.accountantId, accountantId));
}

export async function getClientById(clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clients).values(data);
  return result;
}

export async function updateClient(clientId: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set(data).where(eq(clients.id, clientId));
}

export async function deleteClient(clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(clients).where(eq(clients.id, clientId));
}

export async function getAllClients() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients);
}

/** Get clients for a team leader (all clients under their accountants) */
export async function getClientsByTeamLeader(teamLeaderId: number) {
  const db = await getDb();
  if (!db) return [];
  const assignments = await getTeamByLeader(teamLeaderId);
  if (assignments.length === 0) return [];
  const accountantIds = assignments.map(a => a.accountantId);
  return db.select().from(clients).where(inArray(clients.accountantId, accountantIds));
}

/** Get clients assigned to a CS user */
export async function getClientsByCs(csUserId: number) {
  const db = await getDb();
  if (!db) return [];
  const assignments = await db.select().from(csAssignments).where(eq(csAssignments.csUserId, csUserId));
  if (assignments.length === 0) return [];
  const clientIds = assignments.map(a => a.clientId);
  return db.select().from(clients).where(inArray(clients.id, clientIds));
}

// ─── Team Assignment Helpers ─────────────────────────────────

export async function getTeamByLeader(teamLeaderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teamAssignments).where(eq(teamAssignments.teamLeaderId, teamLeaderId));
}

export async function getLeaderForAccountant(accountantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(teamAssignments).where(eq(teamAssignments.accountantId, accountantId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function assignAccountantToLeader(data: InsertTeamAssignment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(teamAssignments)
    .where(and(eq(teamAssignments.teamLeaderId, data.teamLeaderId), eq(teamAssignments.accountantId, data.accountantId)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(teamAssignments).values(data);
}

export async function removeAccountantFromLeader(teamLeaderId: number, accountantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(teamAssignments).where(
    and(eq(teamAssignments.teamLeaderId, teamLeaderId), eq(teamAssignments.accountantId, accountantId))
  );
}

export async function getAllTeamAssignments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teamAssignments);
}

// ─── CS Assignment Helpers ──────────────────────────────────

export async function getCsAssignmentsByCs(csUserId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(csAssignments).where(eq(csAssignments.csUserId, csUserId));
}

export async function getCsForClient(clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(csAssignments).where(eq(csAssignments.clientId, clientId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function assignClientToCs(data: InsertCsAssignment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(csAssignments)
    .where(and(eq(csAssignments.csUserId, data.csUserId), eq(csAssignments.clientId, data.clientId)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(csAssignments).values(data);
}

export async function removeClientFromCs(csUserId: number, clientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(csAssignments).where(
    and(eq(csAssignments.csUserId, csUserId), eq(csAssignments.clientId, clientId))
  );
}

export async function getAllCsAssignments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(csAssignments);
}

export async function getCsAssignmentCount(csUserId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(csAssignments)
    .where(eq(csAssignments.csUserId, csUserId));
  return result[0]?.count ?? 0;
}

// ─── Report Helpers ──────────────────────────────────────────

export async function getReportsByAccountant(accountantId: number, month?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(reports.accountantId, accountantId)];
  if (month) conditions.push(eq(reports.month, month));
  return db.select().from(reports).where(and(...conditions)).orderBy(desc(reports.updatedAt));
}

export async function getReportsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reports).where(eq(reports.clientId, clientId)).orderBy(desc(reports.updatedAt));
}

export async function getReportById(reportId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createReport(data: InsertReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reports).values(data);
  return result;
}

export async function updateReport(reportId: number, data: Partial<InsertReport>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reports).set(data).where(eq(reports.id, reportId));
}

export async function getReportsByStage(stage: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reports).where(eq(reports.stage, stage as any)).orderBy(desc(reports.updatedAt));
}

export async function getReportsForTeamLeader(teamLeaderId: number) {
  const db = await getDb();
  if (!db) return [];
  const assignments = await getTeamByLeader(teamLeaderId);
  if (assignments.length === 0) return [];
  const accountantIds = assignments.map(a => a.accountantId);
  return db.select().from(reports)
    .where(inArray(reports.accountantId, accountantIds))
    .orderBy(desc(reports.updatedAt));
}

export async function getReportsForReview(teamLeaderId: number) {
  const db = await getDb();
  if (!db) return [];
  const assignments = await getTeamByLeader(teamLeaderId);
  if (assignments.length === 0) return [];
  const accountantIds = assignments.map(a => a.accountantId);
  return db.select().from(reports)
    .where(and(
      inArray(reports.accountantId, accountantIds),
      eq(reports.stage, "audit_review")
    ))
    .orderBy(desc(reports.updatedAt));
}

/** Get reports ready to send for a specific CS user (only their assigned clients) */
export async function getReportsReadyToSendForCs(csUserId: number) {
  const db = await getDb();
  if (!db) return [];
  const assignments = await getCsAssignmentsByCs(csUserId);
  if (assignments.length === 0) return [];
  const clientIds = assignments.map(a => a.clientId);
  return db.select().from(reports)
    .where(and(
      inArray(reports.clientId, clientIds),
      eq(reports.stage, "report_sent")
    ))
    .orderBy(desc(reports.updatedAt));
}

export async function getReportsReadyToSend() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reports)
    .where(eq(reports.stage, "report_sent"))
    .orderBy(desc(reports.updatedAt));
}

export async function getAllReports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reports).orderBy(desc(reports.updatedAt));
}

export async function getReportsByMonth(month: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reports).where(eq(reports.month, month)).orderBy(desc(reports.updatedAt));
}

export async function getReportsForTeamLeaderByMonth(teamLeaderId: number, month: string) {
  const db = await getDb();
  if (!db) return [];
  const assignments = await getTeamByLeader(teamLeaderId);
  if (assignments.length === 0) return [];
  const accountantIds = assignments.map(a => a.accountantId);
  return db.select().from(reports)
    .where(and(
      inArray(reports.accountantId, accountantIds),
      eq(reports.month, month)
    ))
    .orderBy(desc(reports.updatedAt));
}

/** Get reports by month for a CS user (only their assigned clients) */
export async function getReportsForCsByMonth(csUserId: number, month: string) {
  const db = await getDb();
  if (!db) return [];
  const assignments = await getCsAssignmentsByCs(csUserId);
  if (assignments.length === 0) return [];
  const clientIds = assignments.map(a => a.clientId);
  return db.select().from(reports)
    .where(and(
      inArray(reports.clientId, clientIds),
      eq(reports.month, month)
    ))
    .orderBy(desc(reports.updatedAt));
}

// ─── Filtered Reports ──────────────────────────────────────────────────

export interface ReportFilter {
  month?: string;
  stage?: string;
  accountantId?: number;
  teamLeaderId?: number;
  csUserId?: number;
  clientId?: number;
}

/**
 * Generic filtered reports query.
 * Scope is pre-restricted by the caller (e.g. only accountant's own clients).
 * Additional filters are applied on top.
 */
export async function getFilteredReports(
  scopeClientIds: number[] | null, // null = no scope restriction (admin/OM)
  scopeAccountantIds: number[] | null,
  filter: ReportFilter
) {
  const db = await getDb();
  if (!db) return [];

  const conditions: ReturnType<typeof eq>[] = [];

  // Scope restrictions
  if (scopeClientIds !== null && scopeClientIds.length > 0) {
    conditions.push(inArray(reports.clientId, scopeClientIds) as any);
  } else if (scopeClientIds !== null && scopeClientIds.length === 0) {
    return []; // no clients in scope
  }

  if (scopeAccountantIds !== null && scopeAccountantIds.length > 0) {
    conditions.push(inArray(reports.accountantId, scopeAccountantIds) as any);
  } else if (scopeAccountantIds !== null && scopeAccountantIds.length === 0) {
    return [];
  }

  // User-applied filters
  if (filter.month) conditions.push(eq(reports.month, filter.month) as any);
  if (filter.stage) conditions.push(eq(reports.stage, filter.stage as any) as any);
  if (filter.accountantId) conditions.push(eq(reports.accountantId, filter.accountantId) as any);
  if (filter.clientId) conditions.push(eq(reports.clientId, filter.clientId) as any);

  // teamLeaderId filter: resolve to accountant ids
  if (filter.teamLeaderId) {
    const tlAssignments = await getTeamByLeader(filter.teamLeaderId);
    const tlAccountantIds = tlAssignments.map(a => a.accountantId);
    if (tlAccountantIds.length === 0) return [];
    conditions.push(inArray(reports.accountantId, tlAccountantIds) as any);
  }

  // csUserId filter: resolve to client ids
  if (filter.csUserId) {
    const csAsgn = await getCsAssignmentsByCs(filter.csUserId);
    const csClientIds = csAsgn.map(a => a.clientId);
    if (csClientIds.length === 0) return [];
    conditions.push(inArray(reports.clientId, csClientIds) as any);
  }

  const query = conditions.length > 0
    ? db.select().from(reports).where(and(...conditions as any))
    : db.select().from(reports);

  return query.orderBy(desc(reports.updatedAt));
}

/**
 * Returns filter options (accountants, team leaders, CS users) visible to a given user.
 * Admins/OMs see all; TLs see their team; CS sees their own info only.
 */
export async function getFilterOptions(userId: number, userRole: string) {
  const db = await getDb();
  if (!db) return { accountants: [], teamLeaders: [], csUsers: [], months: [] };

  const allUsers = await getAllUsers();

  // Determine which accountants are visible
  let visibleAccountantIds: number[] | null = null; // null = all

  if (userRole === "team_leader") {
    const assignments = await getTeamByLeader(userId);
    visibleAccountantIds = assignments.map(a => a.accountantId);
  } else if (userRole === "accountant") {
    visibleAccountantIds = [userId];
  }

  const accountants = allUsers.filter(u => u.role === "accountant" &&
    (visibleAccountantIds === null || visibleAccountantIds.includes(u.id))
  );

  const teamLeaders = userRole === "admin" || userRole === "operation_manager"
    ? allUsers.filter(u => u.role === "team_leader")
    : userRole === "team_leader"
      ? allUsers.filter(u => u.id === userId)
      : [];

  const csUsers = userRole === "admin" || userRole === "operation_manager"
    ? allUsers.filter(u => u.role === "customer_success")
    : userRole === "customer_success"
      ? allUsers.filter(u => u.id === userId)
      : [];

  // Get distinct months from reports table
  const monthRows = await db
    .selectDistinct({ month: reports.month })
    .from(reports)
    .orderBy(desc(reports.month));
  const months = monthRows.map(r => r.month);

  return { accountants, teamLeaders, csUsers, months };
}

// ─── Feedback Helpers ────────────────────────────────────────

export async function createFeedback(data: InsertFeedback) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(feedbacks).values(data);
}

export async function getFeedbacksByReport(reportId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(feedbacks).where(eq(feedbacks.reportId, reportId)).orderBy(desc(feedbacks.createdAt));
}

// ─── Notification Helpers ────────────────────────────────────

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notifications).values(data);
}

export async function getNotificationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));
  return result[0]?.count ?? 0;
}

export async function markNotificationRead(notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.id, notificationId));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.userId, userId));
}

// ─── User Name Update ────────────────────────────────────────

export async function updateUserName(userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ name }).where(eq(users.id, userId));
}

// ─── Client Master Data ──────────────────────────────────────

export async function updateClientMasterData(clientId: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set(data).where(eq(clients.id, clientId));
}

/** Reassign a client to a different accountant (admin/OM only) */
export async function reassignClient(clientId: number, newAccountantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set({ accountantId: newAccountantId }).where(eq(clients.id, clientId));
}

/** Update sort order for multiple clients at once (drag-and-drop) */
export async function updateClientSortOrders(updates: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const u of updates) {
    await db.update(clients).set({ sortOrder: u.sortOrder }).where(eq(clients.id, u.id));
  }
}

// ─── Client Attachments ──────────────────────────────────────

export async function getAttachmentsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientAttachments)
    .where(eq(clientAttachments.clientId, clientId))
    .orderBy(desc(clientAttachments.createdAt));
}

export async function createAttachment(data: InsertClientAttachment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clientAttachments).values(data);
  return result;
}

export async function deleteAttachment(attachmentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(clientAttachments).where(eq(clientAttachments.id, attachmentId)).limit(1);
  await db.delete(clientAttachments).where(eq(clientAttachments.id, attachmentId));
  return result[0];
}

export async function getAttachmentById(attachmentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clientAttachments).where(eq(clientAttachments.id, attachmentId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Report File Helpers ────────────────────────────────────────

export async function updateReportFile(
  reportId: number,
  fileData: { reportFileUrl: string; reportFileKey: string; reportFileName: string; reportFileMime: string } | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (fileData === null) {
    await db.update(reports).set({
      reportFileUrl: null,
      reportFileKey: null,
      reportFileName: null,
      reportFileMime: null,
    }).where(eq(reports.id, reportId));
  } else {
    await db.update(reports).set(fileData).where(eq(reports.id, reportId));
  }
}

// ─── Report Comment Helpers ─────────────────────────────────────

export async function getCommentsByReport(reportId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportComments)
    .where(eq(reportComments.reportId, reportId))
    .orderBy(reportComments.createdAt); // ascending: oldest first
}

export async function createComment(data: InsertReportComment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reportComments).values(data);
  return result;
}

export async function deleteComment(commentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(reportComments).where(eq(reportComments.id, commentId));
}

export async function getCommentById(commentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reportComments).where(eq(reportComments.id, commentId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Report Tasks Helpers ────────────────────────────────────

export async function getTasksByReport(reportId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: reportTasks.id,
    reportId: reportTasks.reportId,
    createdBy: reportTasks.createdBy,
    assignedTo: reportTasks.assignedTo,
    title: reportTasks.title,
    status: reportTasks.status,
    dueDate: reportTasks.dueDate,
    createdAt: reportTasks.createdAt,
    updatedAt: reportTasks.updatedAt,
    assigneeName: users.name,
  })
    .from(reportTasks)
    .leftJoin(users, eq(users.id, reportTasks.assignedTo))
    .where(eq(reportTasks.reportId, reportId))
    .orderBy(reportTasks.createdAt);
}

export async function createTask(data: InsertReportTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reportTasks).values(data);
  return result;
}

export async function updateTaskStatus(taskId: number, status: "pending" | "in_progress" | "done") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reportTasks).set({ status }).where(eq(reportTasks.id, taskId));
}

export async function deleteTask(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(reportTasks).where(eq(reportTasks.id, taskId));
}

export async function getTaskById(taskId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reportTasks).where(eq(reportTasks.id, taskId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Monthly Progress Stats ──────────────────────────────────

export async function getMonthlyProgressByAccountant(month: string, accountantIds?: number[]) {
  const db = await getDb();
  if (!db) return [];

  // Get all accountants
  let accountantList: { id: number; name: string | null }[] = [];
  if (accountantIds && accountantIds.length > 0) {
    accountantList = await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, accountantIds));
  } else {
    accountantList = await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.role, "accountant"));
  }

  const results = [];
  for (const acc of accountantList) {
    const allReports = await db.select({ stage: reports.stage })
      .from(reports)
      .where(and(eq(reports.accountantId, acc.id), eq(reports.month, month)));

    const total = allReports.length;
    const done = allReports.filter(r => r.stage === "sent_to_client" || r.stage === "report_sent").length;
    const inProgress = allReports.filter(r => r.stage !== "sent_to_client" && r.stage !== "report_sent" && r.stage !== "data_entry").length;
    const notStarted = allReports.filter(r => r.stage === "data_entry").length;
    const pendingReview = allReports.filter(r => r.stage === "audit_review").length;

    results.push({
      accountantId: acc.id,
      accountantName: acc.name,
      total,
      done,
      inProgress,
      notStarted,
      pendingReview,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    });
  }
  return results;
}

export async function getDelayedReports(stageAgeDays: number = 5) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - stageAgeDays);

  const delayed = await db.select({
    id: reports.id,
    clientId: reports.clientId,
    accountantId: reports.accountantId,
    month: reports.month,
    stage: reports.stage,
    updatedAt: reports.updatedAt,
    clientName: clients.name,
    accountantName: users.name,
  })
    .from(reports)
    .leftJoin(clients, eq(clients.id, reports.clientId))
    .leftJoin(users, eq(users.id, reports.accountantId))
    .where(
      and(
        sql`${reports.updatedAt} < ${cutoff}`,
        sql`${reports.stage} NOT IN ('sent_to_client', 'report_sent')`
      )
    )
    .orderBy(reports.updatedAt);

  return delayed;
}

// ─── Performance Stats ───────────────────────────────────────

export async function getAccountantPerformanceStats(month?: string) {
  const db = await getDb();
  if (!db) return [];

  const accountants = await db.select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "accountant"));

  const results = [];
  for (const acc of accountants) {
    const conditions = month
      ? and(eq(reports.accountantId, acc.id), eq(reports.month, month))
      : eq(reports.accountantId, acc.id);

    const allReports = await db.select({ stage: reports.stage, updatedAt: reports.updatedAt })
      .from(reports)
      .where(conditions);

    const total = allReports.length;
    const completed = allReports.filter(r => r.stage === "sent_to_client").length;
    const inReview = allReports.filter(r => r.stage === "audit_review").length;

    // Count rejections from feedbacks
    const rejectionResult = await db.select({ count: sql<number>`count(*)` })
      .from(feedbacks)
      .innerJoin(reports, eq(reports.id, feedbacks.reportId))
      .where(
        month
          ? and(eq(reports.accountantId, acc.id), eq(feedbacks.action, "rejected"), eq(reports.month, month))
          : and(eq(reports.accountantId, acc.id), eq(feedbacks.action, "rejected"))
      );
    const rejections = Number(rejectionResult[0]?.count ?? 0);

    const qualityScore = total > 0
      ? Math.max(0, Math.round(100 - (rejections / total) * 100))
      : 100;

    results.push({
      accountantId: acc.id,
      accountantName: acc.name,
      total,
      completed,
      inReview,
      rejections,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      qualityScore,
    });
  }
  return results;
}

export async function getKPIStats(month?: string) {
  const db = await getDb();
  if (!db) return null;

  const conditions = month ? eq(reports.month, month) : undefined;
  const allReports = await db.select({ stage: reports.stage, updatedAt: reports.updatedAt })
    .from(reports)
    .where(conditions);

  const total = allReports.length;
  const completed = allReports.filter(r => r.stage === "sent_to_client").length;
  const inProgress = allReports.filter(r => r.stage !== "sent_to_client" && r.stage !== "data_entry").length;
  const notStarted = allReports.filter(r => r.stage === "data_entry").length;
  const pendingReview = allReports.filter(r => r.stage === "audit_review").length;

  const totalRejections = await db.select({ count: sql<number>`count(*)` })
    .from(feedbacks)
    .where(eq(feedbacks.action, "rejected"));
  const rejections = Number(totalRejections[0]?.count ?? 0);

  const totalApprovals = await db.select({ count: sql<number>`count(*)` })
    .from(feedbacks)
    .where(eq(feedbacks.action, "approved"));
  const approvals = Number(totalApprovals[0]?.count ?? 0);

  return {
    total,
    completed,
    inProgress,
    notStarted,
    pendingReview,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    rejections,
    approvals,
    firstPassRate: (rejections + approvals) > 0
      ? Math.round((approvals / (rejections + approvals)) * 100)
      : 100,
  };
}

// ─── Time Tracking Helpers ─────────────────────────────────────────────────

export async function startTimeSession(data: InsertTimeSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(timeSessions).values(data);
  return result[0].insertId as number;
}

export async function stopTimeSession(sessionId: number, userId: number, durationSeconds: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  await db.update(timeSessions)
    .set({ endedAt: now, durationSeconds })
    .where(and(eq(timeSessions.id, sessionId), eq(timeSessions.userId, userId)));
}

export async function getActiveSession(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(timeSessions)
    .where(and(eq(timeSessions.userId, userId), isNull(timeSessions.endedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTimeSessionsByUser(userId: number, month?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(timeSessions.userId, userId)];
  if (month) conditions.push(eq(timeSessions.month, month));
  return db.select().from(timeSessions)
    .where(and(...conditions))
    .orderBy(desc(timeSessions.createdAt));
}

export async function getTimeSessionsByClient(clientId: number, month?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(timeSessions.clientId, clientId)];
  if (month) conditions.push(eq(timeSessions.month, month));
  return db.select().from(timeSessions)
    .where(and(...conditions))
    .orderBy(desc(timeSessions.createdAt));
}

export async function getTimeSessionStats(userId: number, month?: string) {
  const db = await getDb();
  if (!db) return { totalSeconds: 0, totalSessions: 0, totalTransactions: 0, bySop: [] };
  const conditions = [eq(timeSessions.userId, userId), not(isNull(timeSessions.endedAt))];
  if (month) conditions.push(eq(timeSessions.month, month));
  const rows = await db.select().from(timeSessions).where(and(...conditions));
  const totalSeconds = rows.reduce((s, r) => s + (r.durationSeconds ?? 0), 0);
  const totalTransactions = rows.reduce((s, r) => s + r.transactionCount, 0);
  // Group by SOP
  const sopMap = new Map<string, { sopCode: string; sopName: string; seconds: number; sessions: number; transactions: number }>();
  for (const r of rows) {
    const existing = sopMap.get(r.sopCode) ?? { sopCode: r.sopCode, sopName: r.sopName, seconds: 0, sessions: 0, transactions: 0 };
    existing.seconds += r.durationSeconds ?? 0;
    existing.sessions += 1;
    existing.transactions += r.transactionCount;
    sopMap.set(r.sopCode, existing);
  }
  return {
    totalSeconds,
    totalSessions: rows.length,
    totalTransactions,
    bySop: Array.from(sopMap.values()).sort((a, b) => b.seconds - a.seconds),
  };
}

export async function deleteTimeSession(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(timeSessions)
    .where(and(eq(timeSessions.id, sessionId), eq(timeSessions.userId, userId)));
}

export async function getTimeSessionById(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(timeSessions)
    .where(eq(timeSessions.id, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

// ─── CS Tickets Helpers ──────────────────────────────────────

export async function createCsTicket(data: {
  raisedBy: number;
  clientId: number;
  type: "complaint" | "extra_service" | "volume_increase" | "data_delay" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  title: string;
  description?: string;
  month?: string;
  assignedTo?: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(csTickets).values({
    raisedBy: data.raisedBy,
    clientId: data.clientId,
    type: data.type,
    priority: data.priority,
    title: data.title,
    description: data.description ?? null,
    month: data.month ?? null,
    assignedTo: data.assignedTo ?? null,
    status: "open",
  });
}

export async function getCsTickets(filters: {
  userId?: number;
  role?: string;
  status?: string;
  clientId?: number;
}): Promise<typeof csTickets.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(csTickets);
  let filtered = rows;
  if (filters.status) filtered = filtered.filter(t => t.status === filters.status);
  if (filters.clientId) filtered = filtered.filter(t => t.clientId === filters.clientId);
  // CS and CS manager see tickets assigned to them or unassigned
  if (filters.role === "customer_success" && filters.userId) {
    filtered = filtered.filter(t => t.assignedTo === filters.userId || t.assignedTo === null);
  }
  // TL sees tickets they raised
  if (filters.role === "team_leader" && filters.userId) {
    filtered = filtered.filter(t => t.raisedBy === filters.userId);
  }
  // Accountant sees tickets for their clients
  if (filters.role === "accountant" && filters.userId) {
    filtered = filtered.filter(t => t.raisedBy === filters.userId);
  }
  return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function updateCsTicket(id: number, data: {
  status?: "open" | "in_progress" | "resolved" | "closed";
  assignedTo?: number | null;
  resolution?: string;
  priority?: "low" | "medium" | "high" | "urgent";
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
  if (data.resolution !== undefined) updateData.resolution = data.resolution;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (Object.keys(updateData).length === 0) return;
  await db.update(csTickets).set(updateData).where(eq(csTickets.id, id));
}

export async function getCsTicketById(id: number): Promise<typeof csTickets.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(csTickets).where(eq(csTickets.id, id));
  return rows[0] ?? null;
}

// ─── Client Data Uploads Helpers ────────────────────────────

export async function createClientDataUpload(data: {
  clientId: number;
  month: string;
  type: "bank" | "salaries" | "sales" | "purchases" | "inventory" | "other";
  fileUrl: string;
  fileKey: string;
  fileName: string;
  uploadedByType: "client" | "accountant";
  uploadedByUserId?: number;
  uploadedByClientPortalId?: number;
  notes?: string;
  parentId?: number;
  version?: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // If this is a re-upload, mark all previous versions as not latest
  if (data.parentId) {
    await db.update(clientDataUploads)
      .set({ isLatest: 0 })
      .where(eq(clientDataUploads.id, data.parentId));
  }
  await db.insert(clientDataUploads).values({
    clientId: data.clientId,
    month: data.month,
    type: data.type,
    fileUrl: data.fileUrl,
    fileKey: data.fileKey,
    fileName: data.fileName,
    uploadedByType: data.uploadedByType,
    uploadedByUserId: data.uploadedByUserId ?? null,
    uploadedByClientPortalId: data.uploadedByClientPortalId ?? null,
    notes: data.notes ?? null,
    status: "pending",
    version: data.version ?? 1,
    parentId: data.parentId ?? null,
    isLatest: 1,
  });
}

export async function getClientDataUploads(clientId: number, month?: string): Promise<typeof clientDataUploads.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(clientDataUploads).where(eq(clientDataUploads.clientId, clientId));
  const filtered = month ? rows.filter(r => r.month === month) : rows;
  return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getClientDataUploadById(id: number): Promise<typeof clientDataUploads.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(clientDataUploads).where(eq(clientDataUploads.id, id));
  return rows[0] ?? null;
}

export async function reviewClientDataUpload(id: number, reviewedBy: number, data: {
  status: "approved" | "rejected" | "reupload_requested";
  rejectionReason?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clientDataUploads)
    .set({
      status: data.status,
      rejectionReason: data.rejectionReason ?? null,
      reviewedBy,
      reviewedAt: new Date(),
    })
    .where(eq(clientDataUploads.id, id));
}

export async function deleteClientDataUpload(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(clientDataUploads).where(eq(clientDataUploads.id, id));
}

// ─── Client Portal User Helpers ──────────────────────────────

export async function getClientPortalUserByClientId(clientId: number): Promise<typeof clientPortalUsers.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(clientPortalUsers).where(eq(clientPortalUsers.clientId, clientId));
  return rows[0] ?? null;
}

export async function upsertClientPortalUser(data: {
  clientId: number;
  email: string;
  passwordHash: string;
  name: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(clientPortalUsers).values(data)
    .onDuplicateKeyUpdate({ set: { email: data.email, name: data.name, passwordHash: data.passwordHash } });
}
