import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, ArrowLeftRight, Building2, GripVertical, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TRPCError } from "@trpc/server";

export default function ClientReassign() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [draggedClientId, setDraggedClientId] = useState<number | null>(null);
  const [dragOverAccountantId, setDragOverAccountantId] = useState<number | null>(null);

  const { data: allClients, refetch: refetchClients } = trpc.clients.list.useQuery();
  const { data: allUsers } = trpc.users.byRole.useQuery({ role: "accountant" });

  const reassignClient = trpc.clients.reassign.useMutation({
    onSuccess: () => {
      toast.success("تم نقل العميل بنجاح");
      refetchClients();
    },
    onError: (err) => toast.error("حدث خطأ: " + err.message),
  });

  // Check access
  if (user?.role !== "admin" && user?.role !== "operation_manager") {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground" dir="rtl">
        ليس لديك صلاحية الوصول لهذه الصفحة
      </div>
    );
  }

  const accountants = allUsers ?? [];

  // Group clients by accountant
  const clientsByAccountant: Record<number, typeof allClients> = {};
  accountants.forEach(a => { clientsByAccountant[a.id] = []; });
  (allClients ?? []).forEach(c => {
    if (!clientsByAccountant[c.accountantId]) clientsByAccountant[c.accountantId] = [];
    clientsByAccountant[c.accountantId]!.push(c);
  });

  // Filter clients by search
  const filterClients = (clients: typeof allClients) =>
    (clients ?? []).filter(c =>
      !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.companyName ?? "").toLowerCase().includes(search.toLowerCase())
    );

  const handleDragStart = (clientId: number) => {
    setDraggedClientId(clientId);
  };

  const handleDragOver = (e: React.DragEvent, accountantId: number) => {
    e.preventDefault();
    setDragOverAccountantId(accountantId);
  };

  const handleDrop = (e: React.DragEvent, newAccountantId: number) => {
    e.preventDefault();
    if (!draggedClientId) return;

    const client = (allClients ?? []).find(c => c.id === draggedClientId);
    if (!client || client.accountantId === newAccountantId) {
      setDraggedClientId(null);
      setDragOverAccountantId(null);
      return;
    }

    // Check target accountant doesn't exceed 8 clients
    const targetCount = (clientsByAccountant[newAccountantId] ?? []).length;
    if (targetCount >= 8) {
      toast.error("المحاسب وصل للحد الأقصى (8 عملاء)");
      setDraggedClientId(null);
      setDragOverAccountantId(null);
      return;
    }

    reassignClient.mutate({ clientId: draggedClientId, newAccountantId });
    setDraggedClientId(null);
    setDragOverAccountantId(null);
  };

  const handleDragEnd = () => {
    setDraggedClientId(null);
    setDragOverAccountantId(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-primary" />
          إعادة توزيع العملاء
        </h1>
        <p className="text-muted-foreground mt-1">
          اسحب العميل وأفلته على المحاسب المراد نقله إليه
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث عن عميل..."
          className="pr-9"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">إجمالي العملاء</p>
          <p className="text-2xl font-bold text-primary">{(allClients ?? []).length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">المحاسبون</p>
          <p className="text-2xl font-bold text-primary">{accountants.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">متوسط العملاء / محاسب</p>
          <p className="text-2xl font-bold text-primary">
            {accountants.length > 0 ? Math.round((allClients ?? []).length / accountants.length) : 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">محاسبون عند الحد الأقصى</p>
          <p className="text-2xl font-bold text-amber-600">
            {accountants.filter(a => (clientsByAccountant[a.id] ?? []).length >= 8).length}
          </p>
        </Card>
      </div>

      {/* Accountant Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {accountants.map(accountant => {
          const clients = filterClients(clientsByAccountant[accountant.id]);
          const totalClients = (clientsByAccountant[accountant.id] ?? []).length;
          const isOver = dragOverAccountantId === accountant.id;
          const isFull = totalClients >= 8;

          return (
            <div
              key={accountant.id}
              onDragOver={e => handleDragOver(e, accountant.id)}
              onDrop={e => handleDrop(e, accountant.id)}
              className={`rounded-xl border-2 transition-all duration-200 ${
                isOver && !isFull
                  ? "border-primary bg-primary/5 shadow-lg scale-[1.01]"
                  : isOver && isFull
                  ? "border-destructive bg-destructive/5"
                  : "border-border bg-card"
              }`}
            >
              {/* Accountant Header */}
              <div className="p-3 border-b bg-muted/30 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {(accountant.name ?? "م")[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{accountant.name ?? "محاسب"}</p>
                    </div>
                  </div>
                  <Badge
                    variant={isFull ? "destructive" : totalClients >= 6 ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {totalClients}/8
                  </Badge>
                </div>
                {isFull && (
                  <p className="text-xs text-destructive mt-1">وصل للحد الأقصى</p>
                )}
              </div>

              {/* Clients List */}
              <div className="p-2 min-h-[120px] space-y-1">
                {clients.length === 0 && !search && (
                  <div className="flex items-center justify-center h-20 text-muted-foreground text-xs">
                    لا يوجد عملاء
                  </div>
                )}
                {clients.map(client => (
                  <div
                    key={client.id}
                    draggable
                    onDragStart={() => handleDragStart(client.id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 p-2 rounded-lg border bg-background cursor-grab active:cursor-grabbing hover:shadow-sm transition-all ${
                      draggedClientId === client.id ? "opacity-40 scale-95" : ""
                    }`}
                  >
                    <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    {client.logoUrl ? (
                      <img src={client.logoUrl} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-3 h-3 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{client.companyName || client.name}</p>
                      {client.companyName && (
                        <p className="text-xs text-muted-foreground truncate">{client.name}</p>
                      )}
                    </div>
                  </div>
                ))}
                {search && clients.length === 0 && (
                  <div className="flex items-center justify-center h-16 text-muted-foreground text-xs">
                    لا نتائج
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {reassignClient.isPending && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 shadow-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>جاري نقل العميل...</span>
          </div>
        </div>
      )}
    </div>
  );
}
