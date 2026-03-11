import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import { TRPCError } from "@trpc/server";

/** Middleware: allow admin or operation_manager */
const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "operation_manager") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── User Management ──────────────────────────────────────
  users: router({
    list: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),
    byRole: protectedProcedure
      .input(z.object({ role: z.string() }))
      .query(async ({ input }) => {
        return db.getUsersByRole(input.role);
      }),
    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "accountant", "team_leader", "customer_success", "operation_manager"]) }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),
    updateName: adminProcedure
      .input(z.object({ userId: z.number(), name: z.string().min(1) }))
      .mutation(async ({ input }) => {
        await db.updateUserName(input.userId, input.name);
        return { success: true };
      }),
  }),

  // ─── Client Management ────────────────────────────────────
  clients: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (user.role === "accountant") {
        return db.getClientsByAccountant(user.id);
      }
      if (user.role === "team_leader") {
        return db.getClientsByTeamLeader(user.id);
      }
      if (user.role === "customer_success") {
        return db.getClientsByCs(user.id);
      }
      // admin and operation_manager see all
      return db.getAllClients();
    }),
    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getClientById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        companyName: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only accountants can create clients" });
        }
        const existing = await db.getClientsByAccountant(ctx.user.id);
        if (existing.length >= 8 && ctx.user.role === "accountant") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 8 clients per accountant" });
        }
        await db.createClient({
          ...input,
          companyName: input.companyName ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          accountantId: ctx.user.id,
        });
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        companyName: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) throw new TRPCError({ code: "NOT_FOUND" });
        if (client.accountantId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const { id, ...data } = input;
        await db.updateClient(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) throw new TRPCError({ code: "NOT_FOUND" });
        if (client.accountantId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteClient(input.id);
        return { success: true };
      }),
    /** Update master data (fixed company info) for a client */
    updateMasterData: protectedProcedure
      .input(z.object({
        id: z.number(),
        taxNumber: z.string().optional(),
        crNumber: z.string().optional(),
        crExpiry: z.string().optional(),
        capital: z.string().optional(),
        partnersCount: z.number().optional(),
        branchesCount: z.number().optional(),
        companyType: z.string().optional(),
        establishedDate: z.string().optional(),
        businessActivity: z.string().optional(),
        masterNotes: z.string().optional(),
        logoUrl: z.string().optional(),
        logoKey: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) throw new TRPCError({ code: "NOT_FOUND" });
        // Allow accountant, admin, OM, TL to update master data
        const canEdit = ctx.user.role === "admin" || ctx.user.role === "operation_manager" ||
          ctx.user.role === "team_leader" || client.accountantId === ctx.user.id;
        if (!canEdit) throw new TRPCError({ code: "FORBIDDEN" });
        const { id, ...data } = input;
        await db.updateClientMasterData(id, data);
        return { success: true };
      }),
    /** Reassign a client to a different accountant */
    reassign: managerProcedure
      .input(z.object({ clientId: z.number(), newAccountantId: z.number() }))
      .mutation(async ({ input }) => {
        await db.reassignClient(input.clientId, input.newAccountantId);
        return { success: true };
      }),
    /** Update sort orders for drag-and-drop reordering */
    updateSortOrders: protectedProcedure
      .input(z.array(z.object({ id: z.number(), sortOrder: z.number() })))
      .mutation(async ({ ctx, input }) => {
        const canReorder = ctx.user.role === "admin" || ctx.user.role === "operation_manager" || ctx.user.role === "accountant";
        if (!canReorder) throw new TRPCError({ code: "FORBIDDEN" });
        await db.updateClientSortOrders(input);
        return { success: true };
      }),
    /** Get all attachments for a client */
    attachments: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getAttachmentsByClient(input.clientId);
      }),
    /** Delete an attachment */
    deleteAttachment: protectedProcedure
      .input(z.object({ attachmentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const attachment = await db.getAttachmentById(input.attachmentId);
        if (!attachment) throw new TRPCError({ code: "NOT_FOUND" });
        const client = await db.getClientById(attachment.clientId);
        const canDelete = ctx.user.role === "admin" || ctx.user.role === "operation_manager" ||
          (client && client.accountantId === ctx.user.id) || attachment.uploadedBy === ctx.user.id;
        if (!canDelete) throw new TRPCError({ code: "FORBIDDEN" });
        await db.deleteAttachment(input.attachmentId);
        return { success: true };
      }),
    /** Upload a file attachment for a client (base64 encoded) */
    uploadAttachment: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        type: z.enum(["cr", "contract", "eol", "logo", "other"]),
        fileName: z.string(),
        mimeType: z.string(),
        base64Data: z.string(), // base64 encoded file content
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) throw new TRPCError({ code: "NOT_FOUND" });
        const canUpload = ctx.user.role === "admin" || ctx.user.role === "operation_manager" ||
          ctx.user.role === "team_leader" || client.accountantId === ctx.user.id;
        if (!canUpload) throw new TRPCError({ code: "FORBIDDEN" });

        // Upload to S3
        const ext = input.fileName.split(".").pop() ?? "bin";
        const fileKey = `client-attachments/${input.clientId}/${input.type}-${Date.now()}.${ext}`;
        const buffer = Buffer.from(input.base64Data, "base64");
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // If this is a logo, update the client logo fields too
        if (input.type === "logo") {
          await db.updateClientMasterData(input.clientId, { logoUrl: url, logoKey: fileKey });
        }

        // Save attachment record
        await db.createAttachment({
          clientId: input.clientId,
          type: input.type,
          fileName: input.fileName,
          fileUrl: url,
          fileKey,
          mimeType: input.mimeType,
          uploadedBy: ctx.user.id,
        });

        return { success: true, url, fileKey };
      }),
  }),

  // ─── Team Assignments ─────────────────────────────────────
  teams: router({
    myTeam: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "team_leader") {
        const assignments = await db.getTeamByLeader(ctx.user.id);
        const accountants = [];
        for (const a of assignments) {
          const u = await db.getUserById(a.accountantId);
          if (u) accountants.push(u);
        }
        return accountants;
      }
      return [];
    }),
    myLeader: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "accountant") {
        const assignment = await db.getLeaderForAccountant(ctx.user.id);
        if (assignment) {
          return db.getUserById(assignment.teamLeaderId);
        }
      }
      return null;
    }),
    assign: adminProcedure
      .input(z.object({ teamLeaderId: z.number(), accountantId: z.number() }))
      .mutation(async ({ input }) => {
        await db.assignAccountantToLeader(input);
        return { success: true };
      }),
    unassign: adminProcedure
      .input(z.object({ teamLeaderId: z.number(), accountantId: z.number() }))
      .mutation(async ({ input }) => {
        await db.removeAccountantFromLeader(input.teamLeaderId, input.accountantId);
        return { success: true };
      }),
    allAssignments: adminProcedure.query(async () => {
      return db.getAllTeamAssignments();
    }),
  }),

  // ─── CS Assignments ───────────────────────────────────────
  csAssignments: router({
    myClients: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "customer_success") {
        return db.getCsAssignmentsByCs(ctx.user.id);
      }
      return [];
    }),
    assign: adminProcedure
      .input(z.object({ csUserId: z.number(), clientId: z.number() }))
      .mutation(async ({ input }) => {
        // Check CS has less than 25 clients
        const count = await db.getCsAssignmentCount(input.csUserId);
        if (count >= 25) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 25 clients per CS" });
        }
        await db.assignClientToCs(input);
        return { success: true };
      }),
    unassign: adminProcedure
      .input(z.object({ csUserId: z.number(), clientId: z.number() }))
      .mutation(async ({ input }) => {
        await db.removeClientFromCs(input.csUserId, input.clientId);
        return { success: true };
      }),
    allAssignments: adminProcedure.query(async () => {
      return db.getAllCsAssignments();
    }),
    countByCs: protectedProcedure
      .input(z.object({ csUserId: z.number() }))
      .query(async ({ input }) => {
        return db.getCsAssignmentCount(input.csUserId);
      }),
  }),

  // ─── Reports ──────────────────────────────────────────────
  reports: router({
    list: protectedProcedure
      .input(z.object({ month: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        if (user.role === "accountant") {
          return db.getReportsByAccountant(user.id, input?.month);
        }
        if (user.role === "team_leader") {
          return db.getReportsForTeamLeader(user.id);
        }
        if (user.role === "customer_success") {
          return db.getReportsReadyToSendForCs(user.id);
        }
        // admin and operation_manager see all
        return db.getAllReports();
      }),
    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getReportById(input.id);
      }),
    byClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return db.getReportsByClient(input.clientId);
      }),
    forReview: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "team_leader" && ctx.user.role !== "admin" && ctx.user.role !== "operation_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (ctx.user.role === "team_leader") {
        return db.getReportsForReview(ctx.user.id);
      }
      return db.getReportsByStage("audit_review");
    }),
    readyToSend: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "customer_success" && ctx.user.role !== "admin" && ctx.user.role !== "operation_manager") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (ctx.user.role === "customer_success") {
        return db.getReportsReadyToSendForCs(ctx.user.id);
      }
      return db.getReportsReadyToSend();
    }),
    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        month: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.createReport({
          clientId: input.clientId,
          accountantId: ctx.user.id,
          month: input.month,
        });
        return { success: true };
      }),
    updateDataStatus: protectedProcedure
      .input(z.object({
        reportId: z.number(),
        bankStatus: z.enum(["not_received", "partial", "received"]).optional(),
        salariesStatus: z.enum(["not_received", "partial", "received"]).optional(),
        salesStatus: z.enum(["not_received", "partial", "received"]).optional(),
        purchasesStatus: z.enum(["not_received", "partial", "received"]).optional(),
        inventoryStatus: z.enum(["not_received", "partial", "received"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const report = await db.getReportById(input.reportId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND" });
        if (report.accountantId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const { reportId, ...data } = input;
        await db.updateReport(reportId, data);
        return { success: true };
      }),
    updateStage: protectedProcedure
      .input(z.object({
        reportId: z.number(),
        stage: z.enum(["data_entry", "justification", "audit_review", "quality_check", "report_sent", "sent_to_client"]),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const report = await db.getReportById(input.reportId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND" });

        const updateData: any = { stage: input.stage };
        if (input.notes !== undefined) updateData.notes = input.notes;
        await db.updateReport(input.reportId, updateData);

        // Notification logic
        if (input.stage === "audit_review") {
          const assignment = await db.getLeaderForAccountant(report.accountantId);
          if (assignment) {
            const client = await db.getClientById(report.clientId);
            const accountant = await db.getUserById(report.accountantId);
            await db.createNotification({
              userId: assignment.teamLeaderId,
              title: "تقرير جاهز للمراجعة",
              message: `التقرير الخاص بالعميل ${client?.name ?? ""} (${report.month}) من المحاسب ${accountant?.name ?? ""} جاهز للمراجعة والتدقيق`,
              type: "audit_review",
              reportId: input.reportId,
            });
          }
        }

        if (input.stage === "report_sent") {
          // Notify CS users who have this client assigned
          const csAssignment = await db.getCsForClient(report.clientId);
          const client = await db.getClientById(report.clientId);
          if (csAssignment) {
            await db.createNotification({
              userId: csAssignment.csUserId,
              title: "تقرير جاهز للإرسال",
              message: `التقرير الخاص بالعميل ${client?.name ?? ""} (${report.month}) جاهز للإرسال للعميل`,
              type: "report_ready",
              reportId: input.reportId,
            });
          }
        }

        // When accountant directly sends report to client (bypassing CS send flow)
        if (input.stage === "sent_to_client") {
          const csAssignment = await db.getCsForClient(report.clientId);
          const client = await db.getClientById(report.clientId);
          const accountant = await db.getUserById(report.accountantId);
          if (csAssignment) {
            await db.createNotification({
              userId: csAssignment.csUserId,
              title: "✅ تم إرسال التقرير للعميل",
              message: `قام المحاسب ${accountant?.name ?? ""} بإرسال تقرير العميل ${client?.name ?? ""} (${report.month}) للعميل بنجاح`,
              type: "report_ready",
              reportId: input.reportId,
            });
          }
        }

        return { success: true };
      }),
    approve: protectedProcedure
      .input(z.object({
        reportId: z.number(),
        comment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "team_leader" && ctx.user.role !== "admin" && ctx.user.role !== "operation_manager") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const report = await db.getReportById(input.reportId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND" });
        if (report.stage !== "audit_review") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Report is not in audit review stage" });
        }

        await db.createFeedback({
          reportId: input.reportId,
          teamLeaderId: ctx.user.id,
          comment: input.comment || "تمت الموافقة",
          action: "approved",
        });

        await db.updateReport(input.reportId, { stage: "report_sent" });

        // Notify CS assigned to this client
        const client = await db.getClientById(report.clientId);
        const csAssignment = await db.getCsForClient(report.clientId);
        if (csAssignment) {
          await db.createNotification({
            userId: csAssignment.csUserId,
            title: "تقرير جاهز للإرسال",
            message: `التقرير الخاص بالعميل ${client?.name ?? ""} (${report.month}) تمت الموافقة عليه وجاهز للإرسال`,
            type: "report_ready",
            reportId: input.reportId,
          });
        }

        // Notify accountant
        await db.createNotification({
          userId: report.accountantId,
          title: "تمت الموافقة على التقرير",
          message: `تمت الموافقة على تقرير العميل ${client?.name ?? ""} (${report.month})`,
          type: "approved",
          reportId: input.reportId,
        });

        return { success: true };
      }),
    reject: protectedProcedure
      .input(z.object({
        reportId: z.number(),
        comment: z.string().min(1, "Feedback is required"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "team_leader" && ctx.user.role !== "admin" && ctx.user.role !== "operation_manager") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const report = await db.getReportById(input.reportId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND" });
        if (report.stage !== "audit_review") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Report is not in audit review stage" });
        }

        await db.createFeedback({
          reportId: input.reportId,
          teamLeaderId: ctx.user.id,
          comment: input.comment,
          action: "rejected",
        });

        await db.updateReport(input.reportId, { stage: "data_entry" });

        const client = await db.getClientById(report.clientId);
        await db.createNotification({
          userId: report.accountantId,
          title: "تم رفض التقرير",
          message: `تم رفض تقرير العميل ${client?.name ?? ""} (${report.month}). الملاحظات: ${input.comment}`,
          type: "rejected",
          reportId: input.reportId,
        });

        return { success: true };
      }),
    createBulk: protectedProcedure
      .input(z.object({
        month: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const clientsList = ctx.user.role === "admin"
          ? await db.getAllClients()
          : await db.getClientsByAccountant(ctx.user.id);
        if (clientsList.length === 0) return { created: 0 };
        
        const existingReports = ctx.user.role === "admin"
          ? await db.getReportsByMonth(input.month)
          : await db.getReportsByAccountant(ctx.user.id, input.month);
        const existingClientIds = new Set(existingReports.map(r => r.clientId));
        
        let created = 0;
        for (const client of clientsList) {
          if (!existingClientIds.has(client.id)) {
            await db.createReport({
              clientId: client.id,
              accountantId: client.accountantId,
              month: input.month,
            });
            created++;
          }
        }
        return { created };
      }),
    byMonth: protectedProcedure
      .input(z.object({ month: z.string() }))
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        if (user.role === "accountant") {
          return db.getReportsByAccountant(user.id, input.month);
        }
        if (user.role === "team_leader") {
          return db.getReportsForTeamLeaderByMonth(user.id, input.month);
        }
        if (user.role === "customer_success") {
          return db.getReportsForCsByMonth(user.id, input.month);
        }
        // admin and operation_manager see all
        return db.getReportsByMonth(input.month);
      }),
    sendToClient: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "customer_success" && ctx.user.role !== "admin" && ctx.user.role !== "operation_manager") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const report = await db.getReportById(input.reportId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND" });
        if (report.stage !== "report_sent") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Report is not ready to send" });
        }

        await db.updateReport(input.reportId, { stage: "sent_to_client" });

        const client = await db.getClientById(report.clientId);
        await db.createNotification({
          userId: report.accountantId,
          title: "تم إرسال التقرير للعميل",
          message: `تم إرسال تقرير العميل ${client?.name ?? ""} (${report.month}) للعميل بنجاح`,
          type: "report_ready",
          reportId: input.reportId,
        });

        return { success: true };
      }),
    /** Operation Manager: get comprehensive stats */
    stats: managerProcedure
      .input(z.object({ month: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const allReports = input?.month
          ? await db.getReportsByMonth(input.month)
          : await db.getAllReports();
        
        const allUsers = await db.getAllUsers();
        const allClientsData = await db.getAllClients();
        const allTeamAssignments = await db.getAllTeamAssignments();
        const allCsAssignments = await db.getAllCsAssignments();

        const accountants = allUsers.filter(u => u.role === "accountant");
        const teamLeaders = allUsers.filter(u => u.role === "team_leader");
        const csUsers = allUsers.filter(u => u.role === "customer_success");

        // Stage distribution
        const stageDistribution: Record<string, number> = {};
        for (const r of allReports) {
          stageDistribution[r.stage] = (stageDistribution[r.stage] || 0) + 1;
        }

        // Per-team stats
        const teamStats = teamLeaders.map(tl => {
          const teamAccountantIds = allTeamAssignments
            .filter(a => a.teamLeaderId === tl.id)
            .map(a => a.accountantId);
          const teamReports = allReports.filter(r => teamAccountantIds.includes(r.accountantId));
          const teamClients = allClientsData.filter(c => teamAccountantIds.includes(c.accountantId));
          
          const completed = teamReports.filter(r => r.stage === "sent_to_client").length;
          const inReview = teamReports.filter(r => r.stage === "audit_review").length;
          const inProgress = teamReports.filter(r => !["sent_to_client", "report_sent"].includes(r.stage)).length;
          
          return {
            teamLeaderId: tl.id,
            teamLeaderName: tl.name,
            accountantCount: teamAccountantIds.length,
            clientCount: teamClients.length,
            totalReports: teamReports.length,
            completed,
            inReview,
            inProgress,
            completionRate: teamReports.length > 0 ? Math.round((completed / teamReports.length) * 100) : 0,
          };
        });

        // Per-accountant stats
        const accountantStats = accountants.map(acc => {
          const accReports = allReports.filter(r => r.accountantId === acc.id);
          const accClients = allClientsData.filter(c => c.accountantId === acc.id);
          const completed = accReports.filter(r => r.stage === "sent_to_client").length;
          const leader = allTeamAssignments.find(a => a.accountantId === acc.id);
          const leaderUser = leader ? teamLeaders.find(tl => tl.id === leader.teamLeaderId) : null;
          
          return {
            accountantId: acc.id,
            accountantName: acc.name,
            teamLeaderName: leaderUser?.name ?? "غير معين",
            clientCount: accClients.length,
            totalReports: accReports.length,
            completed,
            completionRate: accReports.length > 0 ? Math.round((completed / accReports.length) * 100) : 0,
          };
        });

        // Per-CS stats
        const csStats = csUsers.map(cs => {
          const csClientIds = allCsAssignments
            .filter(a => a.csUserId === cs.id)
            .map(a => a.clientId);
          const csReports = allReports.filter(r => csClientIds.includes(r.clientId));
          const sent = csReports.filter(r => r.stage === "sent_to_client").length;
          const readyToSend = csReports.filter(r => r.stage === "report_sent").length;
          
          return {
            csId: cs.id,
            csName: cs.name,
            clientCount: csClientIds.length,
            totalReports: csReports.length,
            sent,
            readyToSend,
          };
        });

        return {
          totalUsers: allUsers.length,
          totalAccountants: accountants.length,
          totalTeamLeaders: teamLeaders.length,
          totalCs: csUsers.length,
          totalClients: allClientsData.length,
          totalReports: allReports.length,
          stageDistribution,
          teamStats,
          accountantStats,
          csStats,
          completedReports: allReports.filter(r => r.stage === "sent_to_client").length,
          inProgressReports: allReports.filter(r => !["sent_to_client"].includes(r.stage)).length,
        };
      }),
  }),

  // ─── Filter Support ───────────────────────────────────────────
  filters: router({
    /** Returns available filter options for the current user's scope */
    options: protectedProcedure.query(async ({ ctx }) => {
      return db.getFilterOptions(ctx.user.id, ctx.user.role);
    }),

    /** Filtered reports list - respects role-based scope + user-applied filters */
    reports: protectedProcedure
      .input(z.object({
        month: z.string().optional(),
        stage: z.string().optional(),
        accountantId: z.number().optional(),
        teamLeaderId: z.number().optional(),
        csUserId: z.number().optional(),
        clientId: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        const filter = input ?? {};

        // Determine scope based on role
        let scopeClientIds: number[] | null = null;
        let scopeAccountantIds: number[] | null = null;

        if (user.role === "accountant") {
          scopeAccountantIds = [user.id];
        } else if (user.role === "team_leader") {
          const assignments = await db.getTeamByLeader(user.id);
          scopeAccountantIds = assignments.map(a => a.accountantId);
        } else if (user.role === "customer_success") {
          const csAsgn = await db.getCsAssignmentsByCs(user.id);
          scopeClientIds = csAsgn.map(a => a.clientId);
        }
        // admin and operation_manager: scopeClientIds = null, scopeAccountantIds = null (no restriction)

        return db.getFilteredReports(scopeClientIds, scopeAccountantIds, filter);
      }),
  }),

  // ─── Report File Upload ────────────────────────────────────────
  reportFiles: router({
    /** Upload a report file (PDF/Excel) to S3 and attach to report */
    upload: protectedProcedure
      .input(z.object({
        reportId: z.number(),
        base64Data: z.string(),
        fileName: z.string().min(1),
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const report = await db.getReportById(input.reportId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND" });
        // Only accountant who owns the report, team leader, admin, or OM can upload
        const canUpload =
          ctx.user.role === "admin" ||
          ctx.user.role === "operation_manager" ||
          ctx.user.role === "team_leader" ||
          report.accountantId === ctx.user.id;
        if (!canUpload) throw new TRPCError({ code: "FORBIDDEN" });

        const ext = input.fileName.split(".").pop() ?? "bin";
        const fileKey = `report-files/${input.reportId}/${Date.now()}-${input.fileName}`;
        const buffer = Buffer.from(input.base64Data, "base64");
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        await db.updateReportFile(input.reportId, {
          reportFileUrl: url,
          reportFileKey: fileKey,
          reportFileName: input.fileName,
          reportFileMime: input.mimeType,
        });

        return { success: true, url, fileKey, fileName: input.fileName };
      }),

    /** Remove the attached report file */
    remove: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const report = await db.getReportById(input.reportId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND" });
        const canRemove =
          ctx.user.role === "admin" ||
          ctx.user.role === "operation_manager" ||
          report.accountantId === ctx.user.id;
        if (!canRemove) throw new TRPCError({ code: "FORBIDDEN" });
        await db.updateReportFile(input.reportId, null);
        return { success: true };
      }),
  }),

  // ─── Report Comments ──────────────────────────────────────────
  reportComments: router({
    /** Get all comments for a report */
    list: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ input }) => {
        return db.getCommentsByReport(input.reportId);
      }),

    /** Add a comment to a report */
    add: protectedProcedure
      .input(z.object({
        reportId: z.number(),
        comment: z.string().min(1).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const report = await db.getReportById(input.reportId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND" });
        await db.createComment({
          reportId: input.reportId,
          userId: ctx.user.id,
          userName: ctx.user.name ?? "مستخدم",
          userRole: ctx.user.role,
          comment: input.comment,
        });
        return { success: true };
      }),

    /** Delete own comment */
    delete: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const comment = await db.getCommentById(input.commentId);
        if (!comment) throw new TRPCError({ code: "NOT_FOUND" });
        // Only the author or admin can delete
        if (comment.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteComment(input.commentId);
        return { success: true };
      }),
  }),

  // ─── Feedback ──────────────────────────────────────────────────
  feedbacks: router({
    byReport: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ input }) => {
        return db.getFeedbacksByReport(input.reportId);
      }),
  }),

  // ─── Report Tasks ───────────────────────────────────────────
  tasks: router({
    byReport: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ input }) => {
        return db.getTasksByReport(input.reportId);
      }),
    create: protectedProcedure
      .input(z.object({
        reportId: z.number(),
        title: z.string().min(1),
        assignedTo: z.number().optional(),
        dueDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createTask({
          reportId: input.reportId,
          createdBy: ctx.user.id,
          title: input.title,
          assignedTo: input.assignedTo ?? null,
          dueDate: input.dueDate ?? null,
          status: "pending",
        });
        return { success: true };
      }),
    updateStatus: protectedProcedure
      .input(z.object({ taskId: z.number(), status: z.enum(["pending", "in_progress", "done"]) }))
      .mutation(async ({ input }) => {
        await db.updateTaskStatus(input.taskId, input.status);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        if (task.createdBy !== ctx.user.id && ctx.user.role !== "admin" && ctx.user.role !== "operation_manager") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteTask(input.taskId);
        return { success: true };
      }),
  }),

  // ─── Progress & Analytics ─────────────────────────────────
  analytics: router({
    monthlyProgress: protectedProcedure
      .input(z.object({ month: z.string() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role === "accountant") {
          return db.getMonthlyProgressByAccountant(input.month, [ctx.user.id]);
        }
        if (ctx.user.role === "team_leader") {
          const team = await db.getTeamByLeader(ctx.user.id);
          const ids = team.map((t: { accountantId: number }) => t.accountantId);
          return db.getMonthlyProgressByAccountant(input.month, ids);
        }
        return db.getMonthlyProgressByAccountant(input.month);
      }),
    delayedReports: protectedProcedure
      .input(z.object({ days: z.number().default(5) }))
      .query(async ({ ctx, input }) => {
        const all = await db.getDelayedReports(input.days);
        if (ctx.user.role === "accountant") {
          return all.filter((r: { accountantId: number }) => r.accountantId === ctx.user.id);
        }
        if (ctx.user.role === "team_leader") {
          const team = await db.getTeamByLeader(ctx.user.id);
          const ids = new Set(team.map((t: { accountantId: number }) => t.accountantId));
          return all.filter((r: { accountantId: number }) => ids.has(r.accountantId));
        }
        return all;
      }),
    performance: protectedProcedure
      .input(z.object({ month: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role === "accountant") {
          const all = await db.getAccountantPerformanceStats(input.month);
          return all.filter((a: { accountantId: number }) => a.accountantId === ctx.user.id);
        }
        return db.getAccountantPerformanceStats(input.month);
      }),
    kpi: protectedProcedure
      .input(z.object({ month: z.string().optional() }))
      .query(async ({ input }) => {
        return db.getKPIStats(input.month);
      }),
  }),

  // ─── Notifications ────────────────────────────────────────
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getNotificationsByUser(ctx.user.id);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return db.getUnreadNotificationCount(ctx.user.id);
    }),
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markNotificationRead(input.id);
        return { success: true };
      }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  // ─── Time Tracking ────────────────────────────────────────────────────────
  timeTracking: router({
    /** Get the currently active (running) session for the logged-in user */
    activeSession: protectedProcedure.query(async ({ ctx }) => {
      return db.getActiveSession(ctx.user.id);
    }),

    /** Start a new time tracking session */
    start: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        sopCode: z.string(),
        sopName: z.string(),
        transactionCount: z.number().min(0).default(0),
        month: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if user already has an active session
        const existing = await db.getActiveSession(ctx.user.id);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "يوجد جلسة نشطة بالفعل. أوقفها أولاً." });
        }
        const id = await db.startTimeSession({
          userId: ctx.user.id,
          clientId: input.clientId,
          sopCode: input.sopCode,
          sopName: input.sopName,
          transactionCount: input.transactionCount,
          month: input.month,
          startedAt: Date.now(),
          notes: input.notes,
        });
        return { id };
      }),

    /** Stop the active session */
    stop: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        transactionCount: z.number().min(0).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getActiveSession(ctx.user.id);
        if (!session || session.id !== input.sessionId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "الجلسة غير موجودة أو ليست نشطة." });
        }
        const durationSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
        await db.stopTimeSession(input.sessionId, ctx.user.id, durationSeconds);
        return { durationSeconds };
      }),

    /** List sessions for the logged-in user */
    mySessions: protectedProcedure
      .input(z.object({ month: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return db.getTimeSessionsByUser(ctx.user.id, input.month);
      }),

    /** List sessions for a specific client (for TL/OM/admin) */
    byClient: protectedProcedure
      .input(z.object({ clientId: z.number(), month: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        // Accountants can only see their own sessions
        if (ctx.user.role === "accountant") {
          const sessions = await db.getTimeSessionsByClient(input.clientId, input.month);
          return sessions.filter(s => s.userId === ctx.user.id);
        }
        return db.getTimeSessionsByClient(input.clientId, input.month);
      }),

    /** Get stats summary for the logged-in user */
    myStats: protectedProcedure
      .input(z.object({ month: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return db.getTimeSessionStats(ctx.user.id, input.month);
      }),

    /** Delete a session (own sessions only) */
    delete: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getTimeSessionById(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "الجلسة غير موجودة." });
        if (session.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك حذف جلسة شخص آخر." });
        }
        await db.deleteTimeSession(input.sessionId, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── CS Tickets ───────────────────────────────────────────────
  csTickets: router({
    list: protectedProcedure
      .input(z.object({ status: z.string().optional(), clientId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return db.getCsTickets({
          userId: ctx.user.id,
          role: ctx.user.role,
          status: input?.status,
          clientId: input?.clientId,
        });
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        type: z.enum(["complaint", "extra_service", "volume_increase", "data_delay", "other"]),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        title: z.string().min(1),
        description: z.string().optional(),
        month: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createCsTicket({ ...input, raisedBy: ctx.user.id });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
        assignedTo: z.number().nullable().optional(),
        resolution: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const ticket = await db.getCsTicketById(input.id);
        if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
        // Only CS, CS manager, admin, OM can update
        const allowed = ["customer_success", "cs_manager", "admin", "operation_manager"];
        if (!allowed.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        await db.updateCsTicket(input.id, {
          status: input.status,
          assignedTo: input.assignedTo,
          resolution: input.resolution,
          priority: input.priority,
        });
        return { success: true };
      }),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCsTicketById(input.id);
      }),
  }),

  // ─── File Upload ─────────────────────────────────────────────
  files: router({
    /** Upload a file to S3 and return the URL */
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string(),
        folder: z.string().default("uploads"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import("./storage");
        const ext = input.fileName.split(".").pop() ?? "bin";
        const randomSuffix = Math.random().toString(36).slice(2, 8);
        const key = `${input.folder}/${ctx.user.id}-${Date.now()}-${randomSuffix}.${ext}`;
        const buffer = Buffer.from(input.fileBase64, "base64");
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url, key, fileName: input.fileName };
      }),
  }),

  // ─── Client Data Uploads ─────────────────────────────────────
  clientUploads: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number(), month: z.string().optional() }))
      .query(async ({ input }) => {
        return db.getClientDataUploads(input.clientId, input.month);
      }),

    upload: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        month: z.string(),
        type: z.enum(["bank", "salaries", "sales", "purchases", "inventory", "other"]),
        fileUrl: z.string(),
        fileKey: z.string(),
        fileName: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createClientDataUpload({
          ...input,
          uploadedByType: "accountant",
          uploadedByUserId: ctx.user.id,
        });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const upload = await db.getClientDataUploadById(input.id);
        if (!upload) throw new TRPCError({ code: "NOT_FOUND" });
        // Only allow deleting pending files by the uploader or admin
        if (upload.status !== "pending" && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن حذف ملف تمت مراجعته." });
        }
        await db.deleteClientDataUpload(input.id);
        return { success: true };
      }),

    /** Accountant reviews a file: approve, reject, or request re-upload */
    review: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected", "reupload_requested"]),
        rejectionReason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only accountants, team leaders, and admins can review
        const allowed = ["accountant", "team_leader", "admin"];
        if (!allowed.includes(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "غير مصرح لك بمراجعة الملفات." });
        }
        const upload = await db.getClientDataUploadById(input.id);
        if (!upload) throw new TRPCError({ code: "NOT_FOUND" });
        if (input.status !== "approved" && !input.rejectionReason) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "يجب إدخال سبب الرفض." });
        }
        await db.reviewClientDataUpload(input.id, ctx.user.id, {
          status: input.status,
          rejectionReason: input.rejectionReason,
        });
        return { success: true };
      }),

    /** Client or accountant re-uploads a file to replace a rejected one */
    reupload: protectedProcedure
      .input(z.object({
        parentId: z.number(),
        fileUrl: z.string(),
        fileKey: z.string(),
        fileName: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const parent = await db.getClientDataUploadById(input.parentId);
        if (!parent) throw new TRPCError({ code: "NOT_FOUND" });
        // Only allowed if parent is rejected or reupload_requested
        if (parent.status !== "rejected" && parent.status !== "reupload_requested") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إعادة الرفع إلا للملفات المرفوضة." });
        }
        await db.createClientDataUpload({
          clientId: parent.clientId,
          month: parent.month,
          type: parent.type,
          fileUrl: input.fileUrl,
          fileKey: input.fileKey,
          fileName: input.fileName,
          uploadedByType: "accountant",
          uploadedByUserId: ctx.user.id,
          notes: input.notes,
          parentId: input.parentId,
          version: (parent.version ?? 1) + 1,
        });
        return { success: true };
      }),

    /** Get all versions of a file (upload history) */
    history: protectedProcedure
      .input(z.object({ clientId: z.number(), month: z.string(), type: z.string() }))
      .query(async ({ input }) => {
        const all = await db.getClientDataUploads(input.clientId, input.month);
        return all.filter(u => u.type === input.type).sort((a, b) => (a.version ?? 1) - (b.version ?? 1));
      }),
  }),
});

export type AppRouter = typeof appRouter;
