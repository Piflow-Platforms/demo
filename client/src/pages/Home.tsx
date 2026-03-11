import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  FileText,
  CheckCircle,
  Clock,
  Building2,
  UserCog,
  BarChart3,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { REPORT_STAGES, USER_ROLES_MAP } from "@shared/types";
import { useLocation } from "wouter";
import AccountantDashboardPage from "./AccountantDashboard";
import TeamLeaderDashboardPage from "./TeamLeaderDashboard";
import CSDashboardPage from "./CSDashboard";
import OMDashboardPage from "./OMDashboard";
import CSManagerDashboardPage from "./CSManagerDashboard";
import ClientPortalPage from "./ClientPortal";
import { usePreviewRole } from "@/components/DashboardLayout";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { previewRole } = usePreviewRole();

  if (!user) return null;

  // Effective role: admin can preview any role
  const effectiveRole = (user.role === "admin" && previewRole) ? previewRole : user.role;

  // Route each role to their dedicated dashboard
  if (effectiveRole === "accountant") return <AccountantDashboardPage />;
  if (effectiveRole === "team_leader") return <TeamLeaderDashboardPage />;
  if (effectiveRole === "customer_success") return <CSDashboardPage />;
  if (effectiveRole === "operation_manager") return <OMDashboardPage />;
  if (effectiveRole === "cs_manager") return <CSManagerDashboardPage />;
  if (effectiveRole === "user") return <ClientPortalPage />;
  if (effectiveRole === "admin") return <AdminDashboard />;

  // Fallback for unassigned users
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">مرحباً، {user.name ?? "مستخدم"}</h1>
        <p className="text-muted-foreground">لم يتم تعيين دور بعد</p>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <UserCog className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">لم يتم تعيين دور بعد</h3>
          <p className="text-muted-foreground">يرجى التواصل مع مدير النظام لتعيين دورك في النظام</p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  onClick,
}: {
  title: string;
  value: number | string;
  icon: any;
  description?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`transition-all hover:shadow-md ${onClick ? "cursor-pointer hover:-translate-y-0.5" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { data: usersData } = trpc.users.list.useQuery();
  const { data: statsData, isLoading } = trpc.reports.stats.useQuery({
    month: `${new Date().getFullYear()}-${String(new Date().getMonth()).padStart(2, "0")}`,
  });

  const allUsers = usersData ?? [];
  const accountants = allUsers.filter((u) => u.role === "accountant");
  const teamLeaders = allUsers.filter((u) => u.role === "team_leader");
  const csUsers = allUsers.filter((u) => u.role === "customer_success");

  if (isLoading || !statsData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const overallCompletion = statsData.totalReports > 0
    ? Math.round((statsData.completedReports / statsData.totalReports) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">لوحة مدير النظام</h1>
          <p className="text-muted-foreground text-sm mt-1">نظرة شاملة على جميع العمليات</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation("/admin/users")}>
            <Settings className="w-4 h-4" />
            إدارة المستخدمين
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="المستخدمون" value={allUsers.length} icon={Users} onClick={() => setLocation("/admin/users")} />
        <StatCard title="المحاسبون" value={accountants.length} icon={Building2} />
        <StatCard title="قادة الفرق" value={teamLeaders.length} icon={UserCog} />
        <StatCard title="نجاح العملاء" value={csUsers.length} icon={CheckCircle} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="إجمالي العملاء"
          value={statsData.totalClients}
          icon={Building2}
          onClick={() => setLocation("/clients")}
        />
        <StatCard
          title="إجمالي التقارير"
          value={statsData.totalReports}
          icon={FileText}
          onClick={() => setLocation("/monthly")}
        />
        <StatCard
          title="نسبة الإنجاز"
          value={`${overallCompletion}%`}
          icon={BarChart3}
          onClick={() => setLocation("/operations")}
        />
        <StatCard
          title="بانتظار المراجعة"
          value={statsData.stageDistribution["audit_review"] || 0}
          icon={CheckCircle}
          onClick={() => setLocation("/review")}
        />
      </div>

      {/* Stage Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">توزيع المراحل</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLocation("/monthly")}>
              عرض التقارير
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Object.entries(REPORT_STAGES).map(([key, val]) => {
              const count = statsData.stageDistribution[key] || 0;
              return (
                <div
                  key={key}
                  className="p-3 rounded-lg bg-muted/50 text-center cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => setLocation("/monthly")}
                >
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground mt-1">{val.ar}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Team Performance */}
      {statsData.teamStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">أداء الفرق</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLocation("/operations")}>
                تفاصيل كاملة
                <ArrowLeft className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statsData.teamStats.map((team, idx) => (
                <div key={team.teamLeaderId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold ${
                      idx === 0 ? "bg-blue-500" : idx === 1 ? "bg-purple-500" : "bg-emerald-500"
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{team.teamLeaderName}</p>
                      <p className="text-xs text-muted-foreground">{team.accountantCount} محاسبين · {team.clientCount} عميل</p>
                    </div>
                  </div>
                  <Badge variant={team.completionRate >= 80 ? "default" : team.completionRate >= 50 ? "secondary" : "destructive"}>
                    {team.completionRate}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
