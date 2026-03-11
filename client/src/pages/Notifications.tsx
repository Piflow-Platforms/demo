import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, BellOff, CheckCircle, XCircle, FileText, Send, Check } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const notificationIcons: Record<string, any> = {
  audit_review: FileText,
  approved: CheckCircle,
  rejected: XCircle,
  report_ready: Send,
};

const notificationColors: Record<string, string> = {
  audit_review: "bg-orange-100 text-orange-600",
  approved: "bg-green-100 text-green-600",
  rejected: "bg-red-100 text-red-600",
  report_ready: "bg-blue-100 text-blue-600",
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: notificationsData, isLoading } = trpc.notifications.list.useQuery();

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      toast.success("تم تعليم جميع الإشعارات كمقروءة");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const notifications = notificationsData ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الإشعارات</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} إشعار جديد` : "لا توجد إشعارات جديدة"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <Check className="w-3.5 h-3.5" />
            تعليم الكل كمقروء
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BellOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد إشعارات</h3>
            <p className="text-muted-foreground text-sm">ستظهر الإشعارات هنا عند وجود تحديثات جديدة</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const Icon = notificationIcons[notification.type] ?? Bell;
            const colorClass = notificationColors[notification.type] ?? "bg-gray-100 text-gray-600";
            const isUnread = !notification.isRead;

            return (
              <Card
                key={notification.id}
                className={`transition-all cursor-pointer hover:shadow-sm ${
                  isUnread ? "border-primary/30 bg-primary/[0.02]" : ""
                }`}
                onClick={() => {
                  if (isUnread) {
                    markReadMutation.mutate({ id: notification.id });
                  }
                  if (notification.reportId) {
                    setLocation(`/reports/${notification.reportId}`);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className={`text-sm ${isUnread ? "font-semibold" : "font-medium"}`}>
                          {notification.title}
                        </h3>
                        {isUnread && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        {new Date(notification.createdAt).toLocaleDateString("ar-SA", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
