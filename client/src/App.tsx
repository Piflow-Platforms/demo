import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import ClientsPage from "./pages/Clients";
import MonthlyWorkflowPage from "./pages/MonthlyWorkflow";
import ReviewPage from "./pages/Review";
import SendReportsPage from "./pages/SendReports";
import NotificationsPage from "./pages/Notifications";
import AdminUsersPage from "./pages/AdminUsers";
import AdminTeamsPage from "./pages/AdminTeams";
import ReportDetailPage from "./pages/ReportDetail";
import OperationsPage from "./pages/Operations";
import ClientMasterDataPage from "./pages/ClientMasterData";
import ClientReassignPage from "./pages/ClientReassign";
import PerformancePage from "./pages/Performance";
import WorkCalendarPage from "./pages/WorkCalendar";
import KPIDashboardPage from "./pages/KPIDashboard";
import ReportTasksPage from "./pages/ReportTasks";
import TimeTrackerPage from "./pages/TimeTracker";
import TeamLeaderWorkflowPage from "./pages/TeamLeaderWorkflow";
import CSWorkflowPage from "./pages/CSWorkflow";
import ClientPortalPage from "./pages/ClientPortal";
import CSManagerDashboardPage from "./pages/CSManagerDashboard";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        {/* Unified monthly workflow page — replaces /monthly, /reports, and /my-tasks */}
        <Route path="/monthly" component={MonthlyWorkflowPage} />
        <Route path="/reports" component={MonthlyWorkflowPage} />
        <Route path="/reports/:id" component={ReportDetailPage} />
        <Route path="/clients" component={ClientsPage} />
        <Route path="/review" component={ReviewPage} />
        <Route path="/send-reports" component={SendReportsPage} />
        <Route path="/operations" component={OperationsPage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/admin/users" component={AdminUsersPage} />
        <Route path="/admin/teams" component={AdminTeamsPage} />
        <Route path="/clients/:id/masterdata" component={ClientMasterDataPage} />
        <Route path="/admin/reassign" component={ClientReassignPage} />
        <Route path="/performance" component={PerformancePage} />
        <Route path="/calendar" component={WorkCalendarPage} />
        <Route path="/kpi" component={KPIDashboardPage} />
        <Route path="/tasks" component={ReportTasksPage} />
        <Route path="/time-tracker" component={TimeTrackerPage} />
        {/* Role-specific workflow pages */}
        <Route path="/my-tasks" component={MonthlyWorkflowPage} />
        <Route path="/team-review" component={TeamLeaderWorkflowPage} />
        <Route path="/cs-tickets" component={CSWorkflowPage} />
        <Route path="/client-portal" component={ClientPortalPage} />
        <Route path="/cs-manager" component={CSManagerDashboardPage} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" dir="rtl" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
