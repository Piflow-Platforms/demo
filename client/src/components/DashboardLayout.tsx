import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelRight,
  Users,
  FileText,
  CheckCircle,
  Send,
  Bell,
  Settings,
  UserCog,
  Building2,
  CalendarDays,
  BarChart3,
  ArrowLeftRight,
  TrendingUp,
  Target,
  CheckSquare,
  Calendar,
  Timer,
  Ticket,
  ClipboardList,
  UserCheck,
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState, createContext, useContext } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff } from "lucide-react";

// ─── Role Preview Context ─────────────────────────────────────────────────────
const PREVIEW_ROLE_KEY = "preview-role";

type PreviewRoleContextType = {
  previewRole: string | null;
  setPreviewRole: (role: string | null) => void;
};

const PreviewRoleContext = createContext<PreviewRoleContextType>({
  previewRole: null,
  setPreviewRole: () => {},
});

export function usePreviewRole() {
  return useContext(PreviewRoleContext);
}

const ALL_ROLES = [
  { value: "accountant", label: "محاسب" },
  { value: "team_leader", label: "قائد الفريق" },
  { value: "customer_success", label: "Customer Success" },
  { value: "cs_manager", label: "مدير CS" },
  { value: "operation_manager", label: "مدير العمليات" },
  { value: "user", label: "عميل" },
  { value: "admin", label: "مدير النظام" },
];

type MenuItem = {
  icon: any;
  label: string;
  path: string;
  roles?: string[];
};

const allMenuItems: MenuItem[] = [
  // ─── Common ───────────────────────────────────────────────────────────────
  { icon: LayoutDashboard, label: "لوحة التحكم", path: "/", roles: ["accountant", "team_leader", "customer_success", "operation_manager", "cs_manager", "admin"] },
  // ─── Client Portal ────────────────────────────────────────────────────────
  { icon: Building2, label: "بوابة العميل", path: "/client-portal", roles: ["user"] },
  // ─── Accountant ───────────────────────────────────────────────────────────
  // For accountant: /my-tasks shows the unified workflow page (same as /monthly)
  { icon: ClipboardList, label: "سير العمل الشهري", path: "/my-tasks", roles: ["accountant"] },
  { icon: Building2, label: "العملاء", path: "/clients", roles: ["accountant", "admin", "operation_manager", "customer_success", "cs_manager"] },
  { icon: CalendarDays, label: "التقارير الشهرية", path: "/monthly", roles: ["team_leader", "customer_success", "operation_manager", "cs_manager", "admin"] },
  { icon: Timer, label: "تتبع الوقت", path: "/time-tracker", roles: ["accountant", "team_leader", "operation_manager", "admin"] },
  { icon: CheckSquare, label: "المهام الداخلية", path: "/tasks", roles: ["accountant", "team_leader", "operation_manager", "admin"] },
  // ─── Team Leader ──────────────────────────────────────────────────────────
  { icon: UserCheck, label: "مراجعة الفريق", path: "/team-review", roles: ["team_leader"] },
  { icon: CheckCircle, label: "مراجعة الجودة", path: "/review", roles: ["team_leader", "admin", "operation_manager"] },
  { icon: TrendingUp, label: "أداء المحاسبين", path: "/performance", roles: ["team_leader", "operation_manager", "admin"] },
  // ─── Customer Success ─────────────────────────────────────────────────────
  { icon: Ticket, label: "تذاكر CS", path: "/cs-tickets", roles: ["customer_success", "cs_manager"] },
  { icon: Send, label: "إرسال التقارير", path: "/send-reports", roles: ["customer_success", "admin", "operation_manager"] },
  // ─── CS Manager ───────────────────────────────────────────────────────────
  { icon: Target, label: "لوحة مدير CS", path: "/cs-manager", roles: ["cs_manager", "admin"] },
  // ─── Operation Manager ────────────────────────────────────────────────────
  { icon: BarChart3, label: "إحصائيات العمليات", path: "/operations", roles: ["operation_manager", "admin"] },
  { icon: Target, label: "مؤشرات الأداء (KPI)", path: "/kpi", roles: ["team_leader", "operation_manager", "admin"] },
  { icon: ArrowLeftRight, label: "إعادة توزيع العملاء", path: "/admin/reassign", roles: ["admin", "operation_manager"] },
  // ─── Common Tools ─────────────────────────────────────────────────────────
  { icon: Calendar, label: "تقويم العمل", path: "/calendar", roles: ["accountant", "team_leader", "customer_success", "operation_manager", "cs_manager", "admin"] },
  { icon: Bell, label: "الإشعارات", path: "/notifications", roles: ["accountant", "team_leader", "customer_success", "operation_manager", "cs_manager", "admin"] },
  // ─── Admin ────────────────────────────────────────────────────────────────
  { icon: UserCog, label: "إدارة المستخدمين", path: "/admin/users", roles: ["admin"] },
  { icon: Users, label: "إدارة الفرق", path: "/admin/teams", roles: ["admin"] },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [previewRole, setPreviewRoleState] = useState<string | null>(() => {
    return localStorage.getItem(PREVIEW_ROLE_KEY);
  });

  const setPreviewRole = (role: string | null) => {
    if (role) {
      localStorage.setItem(PREVIEW_ROLE_KEY, role);
    } else {
      localStorage.removeItem(PREVIEW_ROLE_KEY);
    }
    setPreviewRoleState(role);
  };
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir="rtl">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-center">
              نظام إدارة الخدمات المحاسبية
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
              سجّل دخولك للوصول إلى لوحة التحكم وإدارة العمليات المحاسبية
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all text-base"
          >
            تسجيل الدخول
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PreviewRoleContext.Provider value={{ previewRole, setPreviewRole }}>
      <SidebarProvider
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
          } as CSSProperties
        }
      >
        <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
          {children}
        </DashboardLayoutContent>
      </SidebarProvider>
    </PreviewRoleContext.Provider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { previewRole, setPreviewRole } = usePreviewRole();
  const effectiveRole = (user?.role === "admin" && previewRole) ? previewRole : user?.role;

  const menuItems = useMemo(() => {
    if (!user) return [];
    return allMenuItems.filter(
      (item) => !item.roles || item.roles.includes(effectiveRole ?? "")
    );
  }, [user, effectiveRole]);

  const activeMenuItem = menuItems.find((item) => item.path === location);

  const roleLabel = useMemo(() => {
    const roles: Record<string, string> = {
      accountant: "محاسب",
      team_leader: "قائد الفريق",
      customer_success: "نجاح العملاء",
      cs_manager: "مدير CS",
      operation_manager: "مدير العمليات",
      admin: "مدير النظام",
      user: "عميل",
    };
    if (user?.role === "admin" && previewRole) {
      return `معاينة: ${roles[previewRole] ?? previewRole}`;
    }
    return roles[user?.role ?? "user"] ?? "مستخدم";
  }, [user, previewRole]);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarEl = sidebarRef.current;
      if (!sidebarEl) return;
      const rect = sidebarEl.getBoundingClientRect();
      // RTL: sidebar is on the right
      const newWidth = rect.right - e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-l-0 border-r"
          side="right"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-border/50">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="تبديل القائمة"
              >
                <PanelRight className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold tracking-tight truncate text-sm">
                    الخدمات المحاسبية
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 pt-2">
            <SidebarMenu className="px-2 py-1 gap-0.5">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                const isNotification = item.path === "/notifications";
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal relative`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                      {isNotification && unreadCount && unreadCount > 0 ? (
                        <Badge
                          variant="destructive"
                          className="h-5 min-w-5 text-[10px] px-1 absolute left-2 top-1/2 -translate-y-1/2"
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-border/50 space-y-2">
            {/* Role Switcher — admin only */}
            {user?.role === "admin" && !isCollapsed && (
              <div className="px-1">
                <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  معاينة واجهة
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {ALL_ROLES.filter(r => r.value !== "admin").map((role) => (
                    <button
                      key={role.value}
                      onClick={() => setPreviewRole(previewRole === role.value ? null : role.value)}
                      className={`text-[11px] px-2 py-1 rounded-md border transition-all text-right truncate ${
                        previewRole === role.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {role.label}
                    </button>
                  ))}
                  {previewRole && (
                    <button
                      onClick={() => setPreviewRole(null)}
                      className="text-[11px] px-2 py-1 rounded-md border border-destructive/50 text-destructive hover:bg-destructive/10 transition-all col-span-2 flex items-center justify-center gap-1"
                    >
                      <EyeOff className="w-3 h-3" />
                      إلغاء المعاينة
                    </button>
                  )}
                </div>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-accent/50 transition-colors w-full text-right group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className={`h-9 w-9 border shrink-0 ${
                    user?.role === "admin" && previewRole ? "bg-amber-500/20" : "bg-primary/10"
                  }`}>
                    <AvatarFallback className={`text-xs font-semibold ${
                      user?.role === "admin" && previewRole ? "text-amber-600 bg-amber-500/20" : "text-primary bg-primary/10"
                    }`}>
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "مستخدم"}
                    </p>
                    <p className={`text-xs truncate mt-1.5 ${
                      user?.role === "admin" && previewRole ? "text-amber-500" : "text-muted-foreground"
                    }`}>
                      {roleLabel}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="ml-2 h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="tracking-tight text-foreground font-medium">
                {activeMenuItem?.label ?? "القائمة"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6" dir="rtl">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
