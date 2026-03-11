import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

async function seed() {
  console.log("🌱 Seeding demo data (real company structure)...");

  // Clean old demo data
  await db.execute(sql`DELETE FROM cs_assignments WHERE 1=1`);
  await db.execute(sql`DELETE FROM notifications WHERE 1=1`);
  await db.execute(sql`DELETE FROM feedbacks WHERE 1=1`);
  await db.execute(sql`DELETE FROM reports WHERE 1=1`);
  await db.execute(sql`DELETE FROM team_assignments WHERE 1=1`);
  await db.execute(sql`DELETE FROM clients WHERE 1=1`);
  await db.execute(sql`DELETE FROM users WHERE openId LIKE 'demo-%' OR openId LIKE 'seed-%'`);
  console.log("✅ Cleaned old seed data");

  // ─── Team 1: 7 accountants ────────────────────────────────
  const team1 = [
    { openId: "seed-acc-01", name: "أحمد الغامدي" },
    { openId: "seed-acc-02", name: "محمد العتيبي" },
    { openId: "seed-acc-03", name: "خالد الشهري" },
    { openId: "seed-acc-04", name: "عبدالله القحطاني" },
    { openId: "seed-acc-05", name: "فهد الدوسري" },
    { openId: "seed-acc-06", name: "سعد المالكي" },
    { openId: "seed-acc-07", name: "ناصر الحربي" },
  ];

  // ─── Team 2: 6 accountants ────────────────────────────────
  const team2 = [
    { openId: "seed-acc-08", name: "عمر الزهراني" },
    { openId: "seed-acc-09", name: "يوسف السبيعي" },
    { openId: "seed-acc-10", name: "إبراهيم المطيري" },
    { openId: "seed-acc-11", name: "حسن البقمي" },
    { openId: "seed-acc-12", name: "طارق الشمري" },
    { openId: "seed-acc-13", name: "ماجد العنزي" },
  ];

  // ─── Team 3: 4 accountants ────────────────────────────────
  const team3 = [
    { openId: "seed-acc-14", name: "بندر الرشيدي" },
    { openId: "seed-acc-15", name: "تركي الجهني" },
    { openId: "seed-acc-16", name: "مشعل السلمي" },
    { openId: "seed-acc-17", name: "وليد الثبيتي" },
  ];

  const teamLeaders = [
    { openId: "seed-tl-01", name: "سلطان الأحمري" },
    { openId: "seed-tl-02", name: "عادل المحمدي" },
    { openId: "seed-tl-03", name: "منصور الخالدي" },
  ];

  const csUsers = [
    { openId: "seed-cs-01", name: "نورة العمري" },
    { openId: "seed-cs-02", name: "سارة الحارثي" },
    { openId: "seed-cs-03", name: "هند القرني" },
    { openId: "seed-cs-04", name: "ريم الشريف" },
    { openId: "seed-cs-05", name: "لمياء الفيفي" },
  ];

  const omUser = { openId: "seed-om-01", name: "فيصل الراجحي" };

  // Insert all users
  const allAccountants = [...team1, ...team2, ...team3];
  for (const u of allAccountants) {
    await db.execute(sql`INSERT INTO users (openId, name, role, lastSignedIn) VALUES (${u.openId}, ${u.name}, 'accountant', NOW())`);
  }
  for (const u of teamLeaders) {
    await db.execute(sql`INSERT INTO users (openId, name, role, lastSignedIn) VALUES (${u.openId}, ${u.name}, 'team_leader', NOW())`);
  }
  for (const u of csUsers) {
    await db.execute(sql`INSERT INTO users (openId, name, role, lastSignedIn) VALUES (${u.openId}, ${u.name}, 'customer_success', NOW())`);
  }
  await db.execute(sql`INSERT INTO users (openId, name, role, lastSignedIn) VALUES (${omUser.openId}, ${omUser.name}, 'operation_manager', NOW())`);
  console.log("✅ Users created: 17 accountants, 3 TLs, 5 CS, 1 OM");

  // Get IDs
  const [usersRows] = await db.execute(sql`SELECT id, openId, role FROM users WHERE openId LIKE 'seed-%'`);
  const idMap = {};
  for (const row of usersRows) idMap[row.openId] = row.id;

  // ─── Team Assignments ─────────────────────────────────────
  for (const acc of team1) {
    await db.execute(sql`INSERT INTO team_assignments (teamLeaderId, accountantId) VALUES (${idMap["seed-tl-01"]}, ${idMap[acc.openId]})`);
  }
  for (const acc of team2) {
    await db.execute(sql`INSERT INTO team_assignments (teamLeaderId, accountantId) VALUES (${idMap["seed-tl-02"]}, ${idMap[acc.openId]})`);
  }
  for (const acc of team3) {
    await db.execute(sql`INSERT INTO team_assignments (teamLeaderId, accountantId) VALUES (${idMap["seed-tl-03"]}, ${idMap[acc.openId]})`);
  }
  console.log("✅ Team assignments: TL1→7, TL2→6, TL3→4");

  // ─── Create 136 Clients (8 per accountant) ────────────────
  const bizNames = [
    "مؤسسة الحكمة للتجارة","شركة الإنجاز للمقاولات","شركة الطموح للتقنية","مكتب الرؤية الاستشاري",
    "شركة الأمان للتأمين","مؤسسة البركة التجارية","مطاعم السعادة","شركة التقدم للنقل",
    "مؤسسة الأصالة للعطور","شركة الوطن للعقارات","شركة الخليج للتجارة","مؤسسة الإتقان للبناء",
    "شركة النجاح للتسويق","مكتب الحلول المحاسبية","شركة التميز للأغذية","شركة الأفق للاستثمار",
    "مؤسسة الريادة للتدريب","مطاعم الشرق","مؤسسة الجودة للخدمات","مؤسسة الصفاء للتنظيف",
    "شركة المستقبل للتقنية","شركة الوفاء للتوريدات","مكتب الإبداع للتصميم","شركة السلام للنقل",
    "مؤسسة الرياض التجارية","شركة البناء الحديث","مطعم الديرة","شركة النور للتجارة",
    "شركة الأمل للتقنية","مؤسسة الفجر للخدمات","شركة الصقر للأمن","مؤسسة الواحة للسياحة",
    "شركة الرائد للمقاولات","مكتب الثقة للاستشارات","شركة الجزيرة للتجارة","مؤسسة النخبة للتدريب",
    "شركة الشروق للعقارات","مطاعم الأندلس","مؤسسة الكوثر التجارية","شركة الفارس للنقل",
    "شركة الأرض للزراعة","مؤسسة السحاب للتقنية","شركة الهدف للتسويق","مكتب الأمانة المحاسبي",
    "شركة الرحمة الطبية","مؤسسة الغد للتعليم","شركة الوسام للمجوهرات","مطاعم البيت العربي",
    "شركة الإمداد للتوريدات","مؤسسة الأثر للإعلام","شركة الركيزة للبناء","مكتب السداد المالي",
    "شركة الحصاد الزراعية","مؤسسة المنارة للتدريب","شركة الأساس للعقارات","مطاعم الضيافة",
    "شركة التواصل للاتصالات","مؤسسة الإشراق للخدمات","شركة الدرع للأمن","مكتب الميزان المحاسبي",
    "شركة السفير للسياحة","مؤسسة الوعد التجارية","شركة القمة للمقاولات","مطاعم الطيب",
    "شركة الابتكار للتقنية","مؤسسة الحياة للصحة","شركة الأنوار للإنارة","مكتب الرشد الاستشاري",
    "شركة المحيط للتجارة","مؤسسة الأجيال للتعليم","شركة الفخر للعطور","مطاعم النكهة",
    "شركة التحالف للاستثمار","مؤسسة الصدارة للخدمات","شركة الجسر للنقل","مكتب البصيرة المالي",
    "شركة الكنز للمجوهرات","مؤسسة العزم للمقاولات","شركة الأثير للإعلام","مطاعم الريف",
    "شركة المسار للتقنية","مؤسسة الإنماء التجارية","شركة الحماية للتأمين","مكتب الوضوح الاستشاري",
    "شركة الأعمال المتحدة","مؤسسة السلامة للصحة","شركة الرونق للتصميم","مطاعم الأصيل",
    "شركة التكامل للخدمات","مؤسسة الإبحار للسياحة","شركة الصرح للبناء","مكتب الحكمة القانوني",
    "شركة الريحان للأغذية","مؤسسة الطليعة للتدريب","شركة الأركان للعقارات","مطاعم الجنوب",
    "شركة الرقمية للتقنية","مؤسسة الإحسان الخيرية","شركة الفنار للإنارة","مكتب الدقة المحاسبي",
    "شركة الأطلس للتجارة","مؤسسة البشائر للخدمات","شركة النسيم للتكييف","مطاعم الحارة",
    "شركة الوصل للاتصالات","مؤسسة القبس للتعليم","شركة الإعمار للمقاولات","مكتب الأفضل الاستشاري",
    "شركة الجوهرة للمجوهرات","مؤسسة الرفعة التجارية","شركة الحراك للنقل","مطاعم المذاق",
    "شركة الرؤية للاستثمار","مؤسسة الخطوة للتدريب","شركة الدانة للعقارات","مكتب النجم المالي",
    "شركة الأفنان للتصميم","مؤسسة العهد للخدمات","شركة البوابة للتقنية","مطاعم الشام",
    "شركة الأساطير للإعلام","مؤسسة الوطنية للتجارة","شركة الحصن للأمن","مكتب الصواب القانوني",
    "شركة الأرجوان للأزياء","مؤسسة الفلاح الزراعية","شركة المعالي للمقاولات","مطاعم الفردوس",
    "شركة التطوير للتقنية","مؤسسة الأمنيات للسياحة","شركة الأعالي للعقارات","مكتب الرقي الاستشاري",
    "شركة الوئام للتجارة","مؤسسة الأثاث الحديث","شركة المدار للتقنية","مطاعم الجود",
    "شركة الحرف للطباعة","مؤسسة السنابل الزراعية","شركة الأمواج للسياحة","مكتب الإرشاد المالي",
  ];

  const allClientIds = [];
  let clientIdx = 0;
  for (const acc of allAccountants) {
    const accId = idMap[acc.openId];
    for (let i = 0; i < 8; i++) {
      const name = bizNames[clientIdx % bizNames.length];
      await db.execute(sql`INSERT INTO clients (name, companyName, accountantId) VALUES (${name}, ${name}, ${accId})`);
      clientIdx++;
    }
  }
  console.log(`✅ Created ${clientIdx} clients (8 per accountant)`);

  // Get all client IDs
  const [clientRows] = await db.execute(sql`SELECT id, accountantId FROM clients ORDER BY id`);
  for (const row of clientRows) {
    allClientIds.push({ id: row.id, accountantId: row.accountantId });
  }

  // ─── CS Assignments (25 clients per CS, 5 CS = 125 assigned) ─
  const csOpenIds = ["seed-cs-01", "seed-cs-02", "seed-cs-03", "seed-cs-04", "seed-cs-05"];
  let csClientIdx = 0;
  for (let i = 0; i < 5; i++) {
    const csId = idMap[csOpenIds[i]];
    const count = Math.min(25, allClientIds.length - csClientIdx);
    for (let j = 0; j < count; j++) {
      await db.execute(sql`INSERT INTO cs_assignments (csUserId, clientId) VALUES (${csId}, ${allClientIds[csClientIdx].id})`);
      csClientIdx++;
    }
    console.log(`   CS ${csUsers[i].name}: ${count} clients`);
  }
  if (csClientIdx < allClientIds.length) {
    // Assign remaining to CS1 (they can handle a few extra)
    const csId = idMap[csOpenIds[0]];
    while (csClientIdx < allClientIds.length) {
      await db.execute(sql`INSERT INTO cs_assignments (csUserId, clientId) VALUES (${csId}, ${allClientIds[csClientIdx].id})`);
      csClientIdx++;
    }
  }
  console.log(`✅ CS assignments: ${csClientIdx} clients distributed`);

  // ─── Create Reports ───────────────────────────────────────
  const months = ["2025-12", "2026-01", "2026-02"];
  const stages = ["data_entry", "justification", "audit_review", "quality_check", "report_sent", "sent_to_client"];
  const dataStatuses = ["not_received", "partial", "received"];

  for (const month of months) {
    for (const client of allClientIds) {
      let stageIdx;
      if (month === "2025-12") {
        stageIdx = Math.floor(Math.random() * 2) + 4; // report_sent or sent_to_client
      } else if (month === "2026-01") {
        stageIdx = Math.floor(Math.random() * 3) + 2; // audit_review to report_sent
      } else {
        stageIdx = Math.floor(Math.random() * 3); // data_entry to audit_review
      }
      const stage = stages[Math.min(stageIdx, stages.length - 1)];

      const getStatus = () => {
        if (month === "2025-12") return "received";
        if (month === "2026-01") return dataStatuses[Math.floor(Math.random() * 2) + 1];
        return dataStatuses[Math.floor(Math.random() * 3)];
      };

      await db.execute(sql`
        INSERT INTO reports (clientId, accountantId, month, stage, bankStatus, salariesStatus, salesStatus, purchasesStatus, inventoryStatus)
        VALUES (${client.id}, ${client.accountantId}, ${month}, ${stage}, ${getStatus()}, ${getStatus()}, ${getStatus()}, ${getStatus()}, ${getStatus()})
      `);
    }
    console.log(`   Reports for ${month}: ${allClientIds.length}`);
  }
  console.log(`✅ Created ${allClientIds.length * 3} reports (3 months)`);

  console.log("\n🎉 Seed Summary:");
  console.log(`   17 Accountants (Team1: 7, Team2: 6, Team3: 4)`);
  console.log(`   3 Team Leaders`);
  console.log(`   5 Customer Success`);
  console.log(`   1 Operation Manager`);
  console.log(`   ${allClientIds.length} Clients (8 per accountant)`);
  console.log(`   ${allClientIds.length * 3} Reports (3 months)`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
