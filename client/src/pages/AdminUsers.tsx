import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Shield, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { USER_ROLES_MAP } from "@shared/types";
import { useState } from "react";

const roleBadgeColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  accountant: "bg-blue-100 text-blue-700",
  team_leader: "bg-orange-100 text-orange-700",
  customer_success: "bg-green-100 text-green-700",
  operation_manager: "bg-rose-100 text-rose-700",
  user: "bg-gray-100 text-gray-600",
};

export default function AdminUsersPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: usersData, isLoading } = trpc.users.list.useQuery();
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("تم تحديث دور المستخدم");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateNameMutation = trpc.users.updateName.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setEditingNameId(null);
      toast.success("تم تحديث الاسم");
    },
    onError: (err) => toast.error(err.message),
  });

  if (user?.role !== "admin") {
    return (
      <div className="text-center py-16" dir="rtl">
        <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold">غير مصرح</h3>
        <p className="text-muted-foreground text-sm">هذه الصفحة متاحة فقط لمدير النظام</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const allUsers = usersData ?? [];

  const startEditName = (u: { id: number; name: string | null }) => {
    setEditingNameId(u.id);
    setEditingNameValue(u.name ?? "");
  };

  const saveEditName = (userId: number) => {
    if (!editingNameValue.trim()) return;
    updateNameMutation.mutate({ userId, name: editingNameValue.trim() });
  };

  const cancelEditName = () => {
    setEditingNameId(null);
    setEditingNameValue("");
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">إدارة المستخدمين</h1>
        <p className="text-muted-foreground text-sm mt-1">{allUsers.length} مستخدم مسجل</p>
      </div>

      {/* Role Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(USER_ROLES_MAP).map(([key, val]) => {
          const count = allUsers.filter((u) => u.role === key).length;
          return (
            <div key={key} className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{val.ar}</p>
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">البريد الإلكتروني</TableHead>
                <TableHead className="text-right">الدور الحالي</TableHead>
                <TableHead className="text-right">تغيير الدور</TableHead>
                <TableHead className="text-right">تاريخ التسجيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allUsers.map((u) => {
                const roleInfo = USER_ROLES_MAP[u.role as keyof typeof USER_ROLES_MAP];
                const colorClass = roleBadgeColors[u.role] ?? "bg-gray-100 text-gray-600";
                const isEditingName = editingNameId === u.id;

                return (
                  <TableRow key={u.id}>
                    {/* Name cell with inline edit */}
                    <TableCell className="font-medium">
                      {isEditingName ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editingNameValue}
                            onChange={e => setEditingNameValue(e.target.value)}
                            className="h-7 text-sm w-36"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === "Enter") saveEditName(u.id);
                              if (e.key === "Escape") cancelEditName();
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-600"
                            onClick={() => saveEditName(u.id)}
                            disabled={updateNameMutation.isPending}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={cancelEditName}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <span>{u.name ?? "—"}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => startEditName(u)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm" dir="ltr">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs border-0 ${colorClass}`}>
                        {roleInfo?.ar ?? u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(val) => {
                          updateRoleMutation.mutate({
                            userId: u.id,
                            role: val as any,
                          });
                        }}
                        disabled={u.id === user.id}
                      >
                        <SelectTrigger className="h-8 w-40 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">مستخدم</SelectItem>
                          <SelectItem value="admin">مدير النظام</SelectItem>
                          <SelectItem value="accountant">محاسب</SelectItem>
                          <SelectItem value="team_leader">قائد الفريق</SelectItem>
                          <SelectItem value="customer_success">نجاح العملاء</SelectItem>
                          <SelectItem value="operation_manager">مدير العمليات</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("ar-SA")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
