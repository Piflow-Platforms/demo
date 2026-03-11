import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, Pencil, Trash2, Mail, Phone, User, FileText, ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function ClientsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: clientsData, isLoading } = trpc.clients.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const [deleteClient, setDeleteClient] = useState<any>(null);

  const createMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      setShowCreate(false);
      toast.success("تم إضافة العميل بنجاح");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      setEditClient(null);
      toast.success("تم تحديث بيانات العميل");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.clients.delete.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      setDeleteClient(null);
      toast.success("تم حذف العميل");
    },
    onError: (err) => toast.error(err.message),
  });

  const clients = clientsData ?? [];
  const canCreate = (user?.role === "accountant" || user?.role === "admin") && clients.length < 8;
  const canReassign = user?.role === "admin" || user?.role === "operation_manager";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">العملاء</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {clients.length} من 8 عملاء
          </p>
        </div>
        <div className="flex gap-2">
          {canReassign && (
            <Button variant="outline" onClick={() => setLocation("/admin/reassign")} className="gap-2">
              <ArrowLeftRight className="w-4 h-4" />
              إعادة التوزيع
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              إضافة عميل
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${(clients.length / 8) * 100}%` }}
        />
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا يوجد عملاء بعد</h3>
            <p className="text-muted-foreground text-sm mb-4">ابدأ بإضافة عملائك لإدارة تقاريرهم المحاسبية</p>
            {canCreate && (
              <Button onClick={() => setShowCreate(true)} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                إضافة أول عميل
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Card key={client.id} className="group hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                      {client.logoUrl ? (
                        <img src={client.logoUrl} alt="logo" className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{client.name}</h3>
                      {client.companyName && (
                        <p className="text-xs text-muted-foreground">{client.companyName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditClient(client)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteClient(client)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" />
                      <span dir="ltr">{client.phone}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs gap-1"
                    onClick={() => setLocation(`/reports?clientId=${client.id}`)}
                  >
                    التقارير
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs gap-1"
                    onClick={() => setLocation(`/clients/${client.id}/masterdata`)}
                  >
                    <FileText className="w-3 h-3" />
                    البيانات الأساسية
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <ClientFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
        title="إضافة عميل جديد"
      />

      {/* Edit Dialog */}
      {editClient && (
        <ClientFormDialog
          open={true}
          onClose={() => setEditClient(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editClient.id, ...data })}
          isLoading={updateMutation.isPending}
          title="تعديل بيانات العميل"
          defaultValues={editClient}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteClient} onOpenChange={() => setDeleteClient(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العميل</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف العميل "{deleteClient?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ id: deleteClient.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientFormDialog({
  open,
  onClose,
  onSubmit,
  isLoading,
  title,
  defaultValues,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; companyName?: string; email?: string; phone?: string }) => void;
  isLoading: boolean;
  title: string;
  defaultValues?: any;
}) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [companyName, setCompanyName] = useState(defaultValues?.companyName ?? "");
  const [email, setEmail] = useState(defaultValues?.email ?? "");
  const [phone, setPhone] = useState(defaultValues?.phone ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      companyName: companyName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>اسم العميل *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم العميل" required />
          </div>
          <div className="space-y-2">
            <Label>اسم الشركة</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="اسم الشركة (اختياري)" />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>رقم الهاتف</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966..." dir="ltr" />
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
