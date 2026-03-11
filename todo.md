# Project TODO

- [x] Database schema (users with roles, clients, data receipts, reports, notifications, feedback)
- [x] Backend API - user role management procedures
- [x] Backend API - client CRUD procedures
- [x] Backend API - data receipt tracking procedures
- [x] Backend API - report stage workflow procedures
- [x] Backend API - quality check approve/reject with feedback
- [x] Backend API - notification system
- [x] Backend API - customer success send report procedures
- [x] Global theming - elegant dark/light design with OKLCH colors
- [x] RTL Arabic layout support
- [x] DashboardLayout with role-based sidebar navigation
- [x] Login and role selection flow
- [x] Accountant Dashboard - overview of assigned clients and pending tasks
- [x] Accountant - Client management page (up to 8 clients)
- [x] Accountant - Data receipt tracking (Bank, Salaries, Sales, Purchases, Inventory)
- [x] Accountant - Report stage workflow management
- [x] Team Leader Dashboard - overview of supervised accountants and pending reviews
- [x] Team Leader - Quality check review page with approve/reject
- [x] Team Leader - Feedback text box for rejected reports
- [x] Customer Success Dashboard - reports ready to send
- [x] Customer Success - Send report to client and mark as sent
- [x] Notification system - alerts for stage transitions
- [x] Hierarchical structure - Team Leader oversees 6 accountants
- [x] Vitest tests for backend procedures

- [x] Monthly-based workflow - reports organized by month with clear month navigation
- [x] VAT filing indicator - months 7,8,9 have VAT due in month 10; months 10,11,12 have VAT due in month 1 next year
- [x] Seed demo data - 30 clients, 3 accountants (10 each), 1 team leader, 1 CS user
- [x] Monthly dashboard view - show all clients for current month with their report status
- [x] Auto-create monthly reports for all clients when navigating to a new month
- [x] Improve report workflow to show current month vs previous month context
- [x] Update tests for new features

- [x] Add Operation Manager role with full analytics dashboard
- [x] Add CS client assignment system (each CS handles max 25 clients)
- [x] Update role enum to include operation_manager
- [x] Create cs_assignments table to link CS users to clients
- [x] Update seed data: 17 accountants (3 teams: 7+6+4), 3 TL, 5 CS, 1 OM, 136 clients (8 per accountant)
- [x] Accountant sees only their own clients
- [x] Team Leader sees only clients under their team's accountants
- [x] CS sees only their assigned clients (max 25)
- [x] Operation Manager sees all clients with comprehensive analytics
- [x] Operation Manager dashboard with full statistics and team performance
- [x] CS dashboard showing only their assigned 25 clients
- [x] Update all queries to respect role-based data filtering
- [x] Update tests for new roles and filtering

- [x] Backend: add filtered reports query (by accountant, teamLeader, cs, stage, month)
- [x] Backend: add filter options query (returns available accountants/TLs/CS for current user's scope)
- [x] Frontend: reusable FilterBar component with dropdowns
- [x] MonthlyView: add filters (accountant, team, stage, CS)
- [x] Reports page: add filters (month, stage, accountant)
- [x] Review page (Team Leader): add filters (accountant, stage, month)
- [x] SendReports page (CS): add filters (accountant, team, month)
- [x] Operations page (OM): add filters (team, accountant, CS, month)
- [ ] Persist filter state in URL params for shareability

- [x] Schema: add master data fields to clients table (taxNumber, crNumber, capital, partners, branches, crExpiry, contractType)
- [x] Schema: add client_attachments table (clientId, type: logo/cr/contract/eol, fileUrl, fileKey, fileName, uploadedAt)
- [x] Backend: upload attachment procedure (S3 storage)
- [x] Backend: delete attachment procedure
- [x] Backend: get client master data procedure
- [x] Backend: update client master data procedure
- [x] Backend: reassign client to different accountant procedure (admin/OM only)
- [x] Backend: update user name procedure
- [x] Frontend: Client Master Data page with all fixed info fields
- [x] Frontend: Logo upload and display on client card/page
- [x] Frontend: Attachments section (upload/view/delete CR, contract, EOL, logo)
- [x] Frontend: Monthly report history tab inside client page
- [x] Frontend: User name editing in AdminUsers page
- [x] Frontend: Drag-and-drop client reassignment between accountants (admin/OM)
- [x] Apply real staff names to seed data and AdminUsers page
- [x] Tests for new master data and reassignment procedures

- [x] Schema: add reportFileUrl, reportFileKey, reportFileName fields to reports table
- [x] Schema: add report_comments table (reportId, userId, userName, userRole, comment, createdAt)
- [x] Backend: upload report file procedure (S3 storage, PDF/Excel)
- [x] Backend: delete report file procedure
- [x] Backend: add comment procedure (all roles can comment)
- [x] Backend: list comments procedure (by reportId)
- [x] Backend: delete comment procedure (own comment only)
- [x] Frontend: ReportDetail - file upload section with drag-and-drop
- [x] Frontend: ReportDetail - inline PDF preview (iframe/embed)
- [x] Frontend: ReportDetail - Excel/PDF download button
- [x] Frontend: ReportDetail - comments section with avatar, name, role badge, timestamp
- [x] Frontend: ReportDetail - add comment text area with submit
- [x] Tests for report file and comments procedures

## Features Batch 2

### 1. Monthly Progress Dashboard
- [ ] Backend: monthly progress stats per accountant (completed/total/pending/late)
- [ ] Frontend: progress bars per accountant on Home dashboard
- [ ] Frontend: color coding (green=done, yellow=in-progress, red=late)

### 2. Delay Alert System
- [ ] Backend: detect reports stuck in a stage > N days
- [ ] Backend: scheduled delay check and notification to team leader
- [ ] Frontend: delay badge on report cards and MonthlyView

### 3. Excel/PDF Export
- [ ] Backend: generate Excel export of monthly client status
- [ ] Backend: generate PDF summary report
- [ ] Frontend: export button on MonthlyView and Operations pages

### 4. Client Profile History Page
- [ ] Frontend: full client history page with all past reports
- [ ] Frontend: stats per client (avg completion time, rejection count, quality rate)

### 5. Internal Tasks System
- [ ] Schema: report_tasks table (reportId, assignedTo, title, status, dueDate)
- [ ] Backend: CRUD for tasks
- [ ] Frontend: tasks section in ReportDetail page

### 6. Accountant Performance Report
- [ ] Backend: performance stats per accountant (speed, rejections, quality score)
- [ ] Frontend: performance comparison page (TL and OM only)

### 7. KPI Dashboard
- [ ] Backend: KPI metrics (on-time rate, avg cycle time, rejection rate)
- [ ] Frontend: KPI cards and charts on Operations/Home pages

### 8. Work Calendar
- [ ] Frontend: calendar view showing report deadlines and VAT filing dates
- [ ] Frontend: month navigation with color-coded events

### 9. Email Notifications
- [ ] Backend: send email on report sent to client
- [ ] Backend: send email on rejection with feedback
- [ ] Frontend: email settings per user (opt-in/out)

## Time Tracking System (تتبع الوقت والجهد)

- [x] Add SOP task types constant (32 SOPs from SOP-A01 to SOP-C07)
- [x] Schema: add time_sessions table (userId, clientId, sopCode, sopName, transactionCount, startedAt, endedAt, durationSeconds, notes)
- [x] Backend: startSession, stopSession, listSessions, sessionStats procedures
- [x] Frontend: redesign Tasks page as time-tracker with live timer
- [x] Frontend: client selector + SOP selector + transaction count input
- [x] Frontend: live running timer display with start/stop button
- [x] Frontend: session history table per client/user
- [x] Frontend: time summary by SOP type (total time, avg per transaction)

## Role-Specific Views & Unified Reports Page

- [x] Merge Reports + MonthlyView into one unified monthly reports page (/monthly)
- [x] Remove old /reports route (redirect to /monthly)
- [x] Accountant dashboard: rich view with 8 clients, monthly status grid, data receipt indicators
- [x] Team Leader dashboard: team overview, pending reviews list, accountant progress bars
- [x] Customer Success dashboard: 25 clients, ready-to-send list, sent this month stats
- [x] Operation Manager dashboard: full team stats, stage distribution, delay alerts
- [x] Update sidebar navigation to reflect new structure per role
- [x] Add month-based client status grid to unified reports page

## Role-Specific Task Interfaces (واجهات المهام لكل دور)

### Schema & Backend
- [x] Schema: add cs_tickets table (type: complaint/extra_service/volume_increase/data_delay/other, status, priority, raisedBy, assignedTo, clientId, description, resolution, createdAt)
- [ ] Schema: add client_portal_users table (clientId, email, passwordHash, name, createdAt) — for client login
- [x] Schema: add client_data_uploads table (clientId, month, fileUrl, fileKey, fileName, uploadedBy, uploadedAt, type: bank/salaries/sales/purchases/inventory/other, notes)
- [x] Schema: add cs_manager role to user role enum
- [x] Backend: cs_tickets CRUD procedures (create, list, update status, assign)
- [ ] Backend: client portal auth (login with email/password, separate from OAuth)
- [x] Backend: client data upload procedures
- [ ] Backend: client portal: get my reports status
- [ ] Backend: cs_manager stats (team NPS, ticket resolution rate, avg response time)

### Accountant Interface
- [x] Accountant: task-based workflow page — step-by-step for each client (receive data → data entry → justification → send report)
- [x] Accountant: data receipt confirmation per category (bank, salaries, sales, purchases, inventory) with upload button
- [ ] Accountant: justification notes page (per report)
- [x] Accountant: submit report for review button (moves to audit_review)
- [x] Accountant: after TL approval → send report to client button

### Team Leader Interface
- [x] TL: team overview — each accountant with their clients and current stage
- [x] TL: data entry monitoring — which clients have missing data
- [x] TL: quality review queue — reports waiting for review with approve/reject
- [x] TL: raise CS ticket button (complaint/service request)
- [ ] TL: accountant workload view

### CS Interface
- [x] CS: ticket management page — view/handle tickets raised by TL
- [x] CS: ticket detail with resolution notes and status updates
- [ ] CS: client contact log (record calls/emails with clients)
- [ ] CS: escalation to CS manager

### Client Portal
- [ ] Client portal: separate login page (email + password, not OAuth)
- [ ] Client portal: upload data files per category per month
- [x] Client portal: view report status timeline (which stage, what's pending)
- [ ] Client portal: download final report when sent
- [ ] Client portal: submit service request / complaint

### Operation Manager Interface
- [ ] OM: real-time operations dashboard (all teams, all stages)
- [ ] OM: bottleneck detection (reports stuck > X days)
- [ ] OM: CS tickets overview

### CS Manager Interface
- [x] CS Manager: new role (cs_manager) in sidebar and auth
- [x] CS Manager: team dashboard (each CS, their clients, ticket stats)
- [x] CS Manager: NPS tracking (placeholder for now)
- [x] CS Manager: ticket escalation management

### Navigation Updates
- [x] Update sidebar: show only role-relevant pages per user
- [ ] Add client portal route (separate layout, no sidebar)
- [x] Update App.tsx with all new routes

## Role Switcher (تبديل الدور للتجربة)

- [x] Add role switcher dropdown in sidebar footer (admin only) to preview any role's UI
- [x] Role switcher stores selected preview role in localStorage
- [x] All pages read preview role instead of actual role when switcher is active
- [x] Visual indicator (banner) when in preview mode to remind admin they're previewing

## Data Upload & Review System (نظام رفع ومراجعة البيانات)

### Schema & Backend
- [x] Schema: update client_data_uploads table — add status (pending/approved/rejected/reupload_requested), rejectionReason, reviewedBy, reviewedAt, version (for re-uploads), parentId (link re-upload to original)
- [x] Backend: client upload file procedure (S3 upload, creates new record)
- [x] Backend: accountant approve file procedure (sets status=approved)
- [x] Backend: accountant reject file procedure (sets status=rejected/reupload_requested + reason)
- [x] Backend: list uploads per client+month with all versions
- [ ] Backend: delete own pending upload (client only, before review)

### Client Interface (بوابة العميل)
- [x] Client portal: data upload section per month with category tabs (bank, salaries, sales, purchases, inventory, other)
- [x] Client portal: upload multiple files per category (drag-and-drop)
- [x] Client portal: show each file status (pending=بانتظار المراجعة, approved=تمت الموافقة, rejected=مرفوض, reupload=مطلوب إعادة الرفع)
- [x] Client portal: show rejection reason when file is rejected
- [x] Client portal: re-upload button for rejected/reupload_requested files
- [ ] Client portal: overall data completeness indicator per category

### Accountant Interface (واجهة المحاسب)
- [x] Accountant workflow: data review section per client showing all uploaded files
- [x] Accountant: approve individual file button
- [x] Accountant: reject file with reason text (free text + quick reason chips: خطأ في البيانات، ملف غير مكتمل، صيغة خاطئة، فاتورة مكررة)
- [x] Accountant: request re-upload (different from reject — keeps original, asks for correction)
- [ ] Accountant: category-level status indicator (all approved = green, any pending = yellow, any rejected = red)
- [ ] Accountant: notification badge when new files are uploaded by client

## استلام البيانات في واجهة المحاسب

- [ ] إضافة صفحة/قسم "البيانات المستلمة" في واجهة المحاسب يعرض كل الملفات المرفوعة من العميل
- [ ] عرض الملفات مجمّعة حسب الفئة (بنك، رواتب، مبيعات، مشتريات، مخزون، أخرى)
- [ ] زر تحميل لكل ملف مع اسم الملف وتاريخ الرفع
- [ ] أزرار موافقة / رفض / طلب إعادة رفع مع سبب الرفض
- [ ] مؤشر حالة لكل فئة (كل الملفات معتمدة = أخضر، في انتظار = أصفر، مرفوض = أحمر)
- [ ] شارة تنبيه بعدد الملفات الجديدة بانتظار المراجعة

## دمج مهامي والتقارير الشهرية
- [ ] بناء صفحة WorkflowReports موحدة تجمع مهام المحاسب الشهرية مع التقارير
- [ ] منتقي الشهر في أعلى الصفحة يؤثر على كل المحتوى
- [ ] قائمة العملاء مع حالة كل تقرير + سير العمل الكامل في نفس الصفحة
- [ ] تحديث App.tsx: /my-tasks و/monthly و/reports تشير لنفس الصفحة
- [ ] تحديث السايدبار: عنصر واحد "التقارير الشهرية" بدلاً من عنصرين
- [ ] تحديث Home.tsx: المحاسب يُوجَّه للصفحة الجديدة

## إعادة تصميم بطاقة العميل الشهرية (أقسام متسلسلة)
- [ ] قسم ١: البيانات المرفوعة — عرض ملفات العميل مع موافقة/رفض لكل ملف وإمكانية التحميل
- [ ] قسم ٢: إدخال البيانات — تأكيد الإدخال في النظام
- [ ] قسم ٣: التبرير والجستفيكيشن — إصدار الجستفيكيشن
- [ ] قسم ٤: المراجعة — رفع للتيم ليدر والموافقة
- [ ] قسم ٥: التقرير النهائي — إرسال التقرير للعميل
- [ ] كل قسم يعرض حالته بوضوح مع شريط تقدم عام في أعلى البطاقة

## إظهار الملفات في بطاقة سير العمل الشهري
- [ ] إضافة قسم "الملفات المرفوعة من العميل" داخل بطاقة سير العمل الشهري مع عرض واضح وأزرار مراجعة
