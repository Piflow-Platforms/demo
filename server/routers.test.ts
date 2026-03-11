import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 1,
    openId: "test-user-001",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createMockContext(user: AuthenticatedUser | null = null): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ────────────────────────────────────────────
describe("auth.me", () => {
  it("returns null when no user is authenticated", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user when authenticated", async () => {
    const user = createMockUser({ name: "Ahmed" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Ahmed");
    expect(result?.id).toBe(1);
  });
});

describe("auth.logout", () => {
  it("clears cookie and returns success", async () => {
    const user = createMockUser();
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalled();
  });
});

// ─── Access Control Tests ──────────────────────────────────
describe("access control", () => {
  it("users.list requires admin role", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });

  it("users.updateRole requires admin role", async () => {
    const user = createMockUser({ role: "team_leader" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.users.updateRole({ userId: 2, role: "accountant" })
    ).rejects.toThrow();
  });

  it("reports.forReview requires team_leader or admin", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.reports.forReview()).rejects.toThrow();
  });

  it("reports.readyToSend requires customer_success or admin", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.reports.readyToSend()).rejects.toThrow();
  });

  it("reports.approve requires team_leader or admin", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.approve({ reportId: 1 })
    ).rejects.toThrow();
  });

  it("reports.reject requires team_leader or admin", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.reject({ reportId: 1, comment: "bad" })
    ).rejects.toThrow();
  });

  it("reports.sendToClient requires customer_success or admin", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.sendToClient({ reportId: 1 })
    ).rejects.toThrow();
  });

  it("teams.assign requires admin", async () => {
    const user = createMockUser({ role: "team_leader" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.teams.assign({ teamLeaderId: 1, accountantId: 2 })
    ).rejects.toThrow();
  });

  it("teams.unassign requires admin", async () => {
    const user = createMockUser({ role: "team_leader" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.teams.unassign({ teamLeaderId: 1, accountantId: 2 })
    ).rejects.toThrow();
  });

  it("teams.allAssignments requires admin", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.teams.allAssignments()).rejects.toThrow();
  });

  it("clients.create requires accountant or admin role", async () => {
    const user = createMockUser({ role: "customer_success" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.clients.create({ name: "Test Client" })
    ).rejects.toThrow();
  });

  it("reports.create requires accountant or admin role", async () => {
    const user = createMockUser({ role: "customer_success" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.create({ clientId: 1, month: "2026-01" })
    ).rejects.toThrow();
  });
});

// ─── Input Validation Tests ────────────────────────────────
describe("input validation", () => {
  it("clients.create requires non-empty name", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.clients.create({ name: "" })
    ).rejects.toThrow();
  });

  it("reports.reject requires non-empty comment", async () => {
    const user = createMockUser({ role: "team_leader" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.reject({ reportId: 1, comment: "" })
    ).rejects.toThrow();
  });

  it("reports.updateDataStatus validates enum values", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.updateDataStatus({
        reportId: 1,
        bankStatus: "invalid_status" as any,
      })
    ).rejects.toThrow();
  });

  it("reports.updateStage validates stage enum", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.updateStage({
        reportId: 1,
        stage: "invalid_stage" as any,
      })
    ).rejects.toThrow();
  });

  it("users.updateRole validates role enum", async () => {
    const user = createMockUser({ role: "admin" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.users.updateRole({
        userId: 2,
        role: "invalid_role" as any,
      })
    ).rejects.toThrow();
  });
});

// ─── Protected Procedure Tests ─────────────────────────────
describe("protected procedures require authentication", () => {
  it("clients.list requires auth", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.clients.list()).rejects.toThrow();
  });

  it("reports.list requires auth", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.reports.list()).rejects.toThrow();
  });

  it("notifications.list requires auth", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.list()).rejects.toThrow();
  });

  it("notifications.unreadCount requires auth", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.unreadCount()).rejects.toThrow();
  });

  it("feedbacks.byReport requires auth", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.feedbacks.byReport({ reportId: 1 })).rejects.toThrow();
  });

  it("teams.myTeam requires auth", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.teams.myTeam()).rejects.toThrow();
  });

  it("teams.myLeader requires auth", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.teams.myLeader()).rejects.toThrow();
  });
});

// ─── Monthly Workflow Tests ─────────────────────────
describe("reports.createBulk", () => {
  it("requires accountant or admin role", async () => {
    const user = createMockUser({ role: "customer_success" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.createBulk({ month: "2026-03" })
    ).rejects.toThrow();
  });

  it("requires non-empty month", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.createBulk({ month: "" })
    ).rejects.toThrow();
  });
});

describe("reports.byMonth", () => {
  it("requires authentication", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.byMonth({ month: "2026-02" })
    ).rejects.toThrow();
  });

  it("returns results for valid month", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reports.byMonth({ month: "2026-02" });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Operation Manager Tests ──────────────────────────────
describe("operation manager access", () => {
  it("reports.stats requires manager or admin role", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.reports.stats()).rejects.toThrow();
  });

  it("reports.stats accessible by operation_manager", async () => {
    const user = createMockUser({ role: "operation_manager" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reports.stats();
    expect(result).toBeDefined();
    expect(typeof result.totalClients).toBe("number");
    expect(typeof result.totalReports).toBe("number");
    expect(typeof result.totalAccountants).toBe("number");
    expect(Array.isArray(result.teamStats)).toBe(true);
    expect(Array.isArray(result.accountantStats)).toBe(true);
    expect(Array.isArray(result.csStats)).toBe(true);
  });

  it("reports.stats accessible by admin", async () => {
    const user = createMockUser({ role: "admin" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reports.stats();
    expect(result).toBeDefined();
    expect(typeof result.totalUsers).toBe("number");
  });

  it("reports.stats accepts month filter", async () => {
    const user = createMockUser({ role: "operation_manager" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reports.stats({ month: "2026-02" });
    expect(result).toBeDefined();
    expect(typeof result.stageDistribution).toBe("object");
  });

  it("operation_manager can access forReview", async () => {
    const user = createMockUser({ role: "operation_manager" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reports.forReview();
    expect(Array.isArray(result)).toBe(true);
  });

  it("operation_manager can access readyToSend", async () => {
    const user = createMockUser({ role: "operation_manager" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reports.readyToSend();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── CS Assignment Tests ──────────────────────────────────
describe("CS assignments", () => {
  it("csAssignments.assign requires admin", async () => {
    const user = createMockUser({ role: "customer_success" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.csAssignments.assign({ csUserId: 1, clientId: 1 })
    ).rejects.toThrow();
  });

  it("csAssignments.unassign requires admin", async () => {
    const user = createMockUser({ role: "customer_success" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.csAssignments.unassign({ csUserId: 1, clientId: 1 })
    ).rejects.toThrow();
  });

  it("csAssignments.allAssignments requires admin", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.csAssignments.allAssignments()).rejects.toThrow();
  });

  it("csAssignments.myClients returns empty for non-CS", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.csAssignments.myClients();
    expect(result).toEqual([]);
  });
});

// ─── Team Leader Specific Tests ────────────────────────────
describe("team leader workflow", () => {
  it("myTeam returns empty array for non-team_leader", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.teams.myTeam();
    expect(result).toEqual([]);
  });

  it("myLeader returns null for non-accountant", async () => {
    const user = createMockUser({ role: "team_leader" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.teams.myLeader();
    expect(result).toBeNull();
  });
});

// ─── Filter Procedure Tests ────────────────────────────────
describe("filters.options", () => {
  it("requires authentication", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.filters.options()).rejects.toThrow();
  });

  it("returns filter options for accountant role", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.filters.options();
    expect(result).toBeDefined();
    expect(Array.isArray(result.accountants)).toBe(true);
    expect(Array.isArray(result.teamLeaders)).toBe(true);
    expect(Array.isArray(result.csUsers)).toBe(true);
    expect(Array.isArray(result.months)).toBe(true);
  });

  it("returns filter options for operation_manager role", async () => {
    const user = createMockUser({ role: "operation_manager" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.filters.options();
    expect(result).toBeDefined();
    expect(Array.isArray(result.accountants)).toBe(true);
    expect(Array.isArray(result.teamLeaders)).toBe(true);
    expect(Array.isArray(result.csUsers)).toBe(true);
  });

  it("returns filter options for team_leader role", async () => {
    const user = createMockUser({ role: "team_leader" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.filters.options();
    expect(result).toBeDefined();
    expect(Array.isArray(result.accountants)).toBe(true);
    // TL should see their own team leader info
    expect(Array.isArray(result.teamLeaders)).toBe(true);
  });
});

describe("filters.reports", () => {
  it("requires authentication", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.filters.reports()).rejects.toThrow();
  });

  it("returns reports array for accountant with no filters", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.filters.reports();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns reports array for team_leader with no filters", async () => {
    const user = createMockUser({ role: "team_leader" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.filters.reports();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns reports array for operation_manager with no filters", async () => {
    const user = createMockUser({ role: "operation_manager" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.filters.reports();
    expect(Array.isArray(result)).toBe(true);
  });

  it("accepts month filter", async () => {
    const user = createMockUser({ role: "operation_manager" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.filters.reports({ month: "2026-02" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("accepts stage filter", async () => {
    const user = createMockUser({ role: "operation_manager" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.filters.reports({ stage: "audit_review" });
    expect(Array.isArray(result)).toBe(true);
    // All returned reports should be in audit_review stage
    result.forEach(r => expect(r.stage).toBe("audit_review"));
  });

  it("accepts combined month and stage filters", async () => {
    const user = createMockUser({ role: "operation_manager" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.filters.reports({ month: "2026-02", stage: "data_entry" });
    expect(Array.isArray(result)).toBe(true);
    result.forEach(r => {
      expect(r.stage).toBe("data_entry");
      expect(r.month).toBe("2026-02");
    });
  });

  it("customer_success scope restricts to their assigned clients", async () => {
    const user = createMockUser({ role: "customer_success" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    // CS user with id=1 has no assignments in test context → returns empty
    const result = await caller.filters.reports();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Report Files Tests ─────────────────────────────────────────
describe("reportFiles.remove", () => {
  it("throws UNAUTHORIZED when user is not authenticated", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.reportFiles.remove({ reportId: 1 })).rejects.toThrow();
  });

  it("throws UNAUTHORIZED for unauthenticated user on upload", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reportFiles.upload({
        reportId: 1,
        base64Data: "dGVzdA==",
        fileName: "test.pdf",
        mimeType: "application/pdf",
      })
    ).rejects.toThrow();
  });
});

// ─── Report Comments Tests ──────────────────────────────────────
describe("reportComments.list", () => {
  it("throws UNAUTHORIZED when user is not authenticated", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.reportComments.list({ reportId: 1 })).rejects.toThrow();
  });

  it("returns empty array for non-existent report when authenticated", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    // reportId 999999 does not exist, should return empty array
    const result = await caller.reportComments.list({ reportId: 999999 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe("reportComments.add", () => {
  it("throws UNAUTHORIZED when user is not authenticated", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reportComments.add({ reportId: 1, comment: "test" })
    ).rejects.toThrow();
  });

  it("throws NOT_FOUND for non-existent report", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reportComments.add({ reportId: 999999, comment: "test comment" })
    ).rejects.toThrow();
  });

  it("rejects empty comment", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reportComments.add({ reportId: 1, comment: "" })
    ).rejects.toThrow();
  });
});

describe("reportComments.delete", () => {
  it("throws UNAUTHORIZED when user is not authenticated", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.reportComments.delete({ commentId: 1 })).rejects.toThrow();
  });

  it("throws NOT_FOUND for non-existent comment", async () => {
    const user = createMockUser({ role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reportComments.delete({ commentId: 999999 })
    ).rejects.toThrow();
  });
});

// ─── Time Tracking Tests ────────────────────────────────────
describe("timeTracking.activeSession", () => {
  it("throws UNAUTHORIZED when user is not authenticated", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.timeTracking.activeSession()).rejects.toThrow();
  });

  it("returns null when no active session exists", async () => {
    const user = createMockUser({ id: 99999, role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.timeTracking.activeSession();
    expect(result).toBeNull();
  });
});

describe("timeTracking.start", () => {
  it("throws UNAUTHORIZED when user is not authenticated", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.timeTracking.start({
        clientId: 1,
        sopCode: "SOP-A01",
        sopName: "Account Payable Review",
        transactionCount: 10,
        month: "2026-03",
      })
    ).rejects.toThrow();
  });

  it("validates required fields - rejects negative transaction count", async () => {
    const user = createMockUser({ id: 99998, role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.timeTracking.start({
        clientId: 1,
        sopCode: "SOP-A01",
        sopName: "Account Payable Review",
        transactionCount: -5,
        month: "2026-03",
      })
    ).rejects.toThrow();
  });
});

describe("timeTracking.mySessions", () => {
  it("throws UNAUTHORIZED when user is not authenticated", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.timeTracking.mySessions({})).rejects.toThrow();
  });

  it("returns empty array for user with no sessions", async () => {
    const user = createMockUser({ id: 99997, role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.timeTracking.mySessions({ month: "2099-01" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("accepts month filter parameter", async () => {
    const user = createMockUser({ id: 99997, role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.timeTracking.mySessions({ month: "2026-03" });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("timeTracking.myStats", () => {
  it("throws UNAUTHORIZED when user is not authenticated", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.timeTracking.myStats({})).rejects.toThrow();
  });

  it("returns zero stats for user with no sessions", async () => {
    const user = createMockUser({ id: 99996, role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.timeTracking.myStats({ month: "2099-01" });
    expect(result).toBeDefined();
    expect(result.totalSessions).toBe(0);
    expect(result.totalSeconds).toBe(0);
    expect(result.totalTransactions).toBe(0);
  });
});

describe("timeTracking.stop", () => {
  it("throws UNAUTHORIZED when user is not authenticated", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.timeTracking.stop({ sessionId: 1 })
    ).rejects.toThrow();
  });

  it("throws NOT_FOUND for non-existent session", async () => {
    const user = createMockUser({ id: 99995, role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.timeTracking.stop({ sessionId: 999999 })
    ).rejects.toThrow();
  });
});

describe("timeTracking.delete", () => {
  it("throws UNAUTHORIZED when user is not authenticated", async () => {
    const ctx = createMockContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.timeTracking.delete({ sessionId: 1 })
    ).rejects.toThrow();
  });

  it("throws NOT_FOUND for non-existent session", async () => {
    const user = createMockUser({ id: 99994, role: "accountant" });
    const ctx = createMockContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.timeTracking.delete({ sessionId: 999999 })
    ).rejects.toThrow();
  });
});
