import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Plus, X, Shield, UserPlus } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function AdminTeamsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: usersData, isLoading: usersLoading } = trpc.users.list.useQuery();
  const { data: assignmentsData, isLoading: assignmentsLoading } = trpc.teams.allAssignments.useQuery();

  const [selectedLeader, setSelectedLeader] = useState<string>("");
  const [selectedAccountant, setSelectedAccountant] = useState<string>("");

  const assignMutation = trpc.teams.assign.useMutation({
    onSuccess: () => {
      utils.teams.allAssignments.invalidate();
      setSelectedAccountant("");
      toast.success("تم تعيين المحاسب للفريق");
    },
    onError: (err) => toast.error(err.message),
  });

  const unassignMutation = trpc.teams.unassign.useMutation({
    onSuccess: () => {
      utils.teams.allAssignments.invalidate();
      toast.success("تم إزالة المحاسب من الفريق");
    },
    onError: (err) => toast.error(err.message),
  });

  if (user?.role !== "admin") {
    return (
      <div className="text-center py-16">
        <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold">غير مصرح</h3>
        <p className="text-muted-foreground text-sm">هذه الصفحة متاحة فقط لمدير النظام</p>
      </div>
    );
  }

  if (usersLoading || assignmentsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const allUsers = usersData ?? [];
  const assignments = assignmentsData ?? [];
  const teamLeaders = allUsers.filter((u) => u.role === "team_leader");
  const accountants = allUsers.filter((u) => u.role === "accountant");

  const getTeamMembers = (leaderId: number) => {
    const memberIds = assignments
      .filter((a) => a.teamLeaderId === leaderId)
      .map((a) => a.accountantId);
    return allUsers.filter((u) => memberIds.includes(u.id));
  };

  const assignedAccountantIds = assignments.map((a) => a.accountantId);
  const unassignedAccountants = accountants.filter((a) => !assignedAccountantIds.includes(a.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">إدارة الفرق</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {teamLeaders.length} قائد فريق — {accountants.length} محاسب
        </p>
      </div>

      {/* Quick Assign */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            تعيين محاسب لفريق
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5 flex-1 min-w-48">
              <label className="text-xs font-medium text-muted-foreground">قائد الفريق</label>
              <Select value={selectedLeader} onValueChange={setSelectedLeader}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="اختر قائد الفريق" />
                </SelectTrigger>
                <SelectContent>
                  {teamLeaders.map((tl) => {
                    const teamSize = getTeamMembers(tl.id).length;
                    return (
                      <SelectItem key={tl.id} value={String(tl.id)} disabled={teamSize >= 6}>
                        {tl.name ?? `#${tl.id}`} ({teamSize}/6)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-48">
              <label className="text-xs font-medium text-muted-foreground">المحاسب</label>
              <Select value={selectedAccountant} onValueChange={setSelectedAccountant}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="اختر المحاسب" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedAccountants.map((acc) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.name ?? `#${acc.id}`}
                    </SelectItem>
                  ))}
                  {unassignedAccountants.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">جميع المحاسبين معينون</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (!selectedLeader || !selectedAccountant) return;
                assignMutation.mutate({
                  teamLeaderId: parseInt(selectedLeader),
                  accountantId: parseInt(selectedAccountant),
                });
              }}
              disabled={!selectedLeader || !selectedAccountant || assignMutation.isPending}
            >
              <Plus className="w-3.5 h-3.5" />
              تعيين
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Cards */}
      {teamLeaders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا يوجد قادة فرق</h3>
            <p className="text-muted-foreground text-sm">قم بتعيين دور "قائد الفريق" للمستخدمين من صفحة إدارة المستخدمين</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teamLeaders.map((leader) => {
            const members = getTeamMembers(leader.id);
            return (
              <Card key={leader.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                        <Users className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{leader.name ?? `قائد #${leader.id}`}</CardTitle>
                        <p className="text-xs text-muted-foreground">{members.length}/6 محاسبين</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {members.length}/6
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {members.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">لا يوجد محاسبين معينين</p>
                  ) : (
                    <div className="space-y-2">
                      {members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                              <span className="text-xs font-semibold text-blue-600">
                                {member.name?.charAt(0) ?? "M"}
                              </span>
                            </div>
                            <span className="text-sm">{member.name ?? `محاسب #${member.id}`}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => unassignMutation.mutate({
                              teamLeaderId: leader.id,
                              accountantId: member.id,
                            })}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Unassigned Accountants */}
      {unassignedAccountants.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-muted-foreground">
              محاسبون بدون فريق ({unassignedAccountants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unassignedAccountants.map((acc) => (
                <Badge key={acc.id} variant="outline" className="text-xs py-1.5 px-3">
                  {acc.name ?? `#${acc.id}`}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
