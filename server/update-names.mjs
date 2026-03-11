/**
 * Update staff names in the database with real names from the visual editor
 * Run: node server/update-names.mjs
 */
import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const db = await createConnection(process.env.DATABASE_URL);

// Real staff names as provided by the user
const nameUpdates = [
  // Team 1 accountants (7)
  { openId: "seed-acc-01", name: "ياسر أبكر" },
  { openId: "seed-acc-02", name: "لجين شرف الدين" },
  { openId: "seed-acc-03", name: "شيماء بندقجي" },
  { openId: "seed-acc-04", name: "إيلاف باشطح" },
  { openId: "seed-acc-05", name: "يوسف ابو طالب" },
  { openId: "seed-acc-06", name: "أحمد مالك" },
  { openId: "seed-acc-07", name: "أحمد ضمراني" },
  // Team 2 accountants (6)
  { openId: "seed-acc-08", name: "أحمد كامل" },
  { openId: "seed-acc-09", name: "أحمد صفوت" },
  { openId: "seed-acc-10", name: "محمد عبدالستار" },
  { openId: "seed-acc-11", name: "هشام محمد" },
  { openId: "seed-acc-12", name: "عمرو يسري" },
  { openId: "seed-acc-13", name: "اسراء محمد" },
  // Team 3 accountants (4)
  { openId: "seed-acc-14", name: "محمد صلاح" },
  { openId: "seed-acc-15", name: "عبدالله مصطفى" },
  { openId: "seed-acc-16", name: "علي العسراني" },
  { openId: "seed-acc-17", name: "عدلي صبحي" },
  // Team Leaders (3)
  { openId: "seed-tl-01", name: "معتز عوض" },
  { openId: "seed-tl-02", name: "محمد سليمان" },
  { openId: "seed-tl-03", name: "عمر النحاس" },
  // Customer Success (5)
  { openId: "seed-cs-01", name: "هيا ابراهيم" },
  { openId: "seed-cs-02", name: "هشام زين" },
  { openId: "seed-cs-03", name: "محمود عباس" },
  { openId: "seed-cs-04", name: "محمد علي" },
  { openId: "seed-cs-05", name: "سارة ابراهيم" },
  // Operation Manager (1)
  { openId: "seed-om-01", name: "مصطفى عطا" },
];

console.log("🔄 Updating staff names...");
let updated = 0;
for (const { openId, name } of nameUpdates) {
  const [result] = await db.execute(
    "UPDATE users SET name = ? WHERE openId = ?",
    [name, openId]
  );
  if (result.affectedRows > 0) {
    console.log(`  ✅ ${openId} → ${name}`);
    updated++;
  } else {
    console.log(`  ⚠️  ${openId} not found (may not be seeded yet)`);
  }
}

console.log(`\n✅ Updated ${updated}/${nameUpdates.length} staff names`);
await db.end();
