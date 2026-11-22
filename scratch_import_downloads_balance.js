const fs = require('fs');
const path = require('path');
const bm = require('./balanceManager');

(async () => {
  const dir = 'C:/Users/msai/Downloads/balance';
  const files = fs.readdirSync(dir)
    .filter(f => f.toLowerCase().startsWith('balance') && (f.endsWith('.xls') || f.endsWith('.xlsx')))
    .sort();

  console.log(`Synchronizing ${files.length} balance files from ${dir} into database...`);

  for (const f of files) {
    const fullPath = path.join(dir, f);
    try {
      const parsed = bm.parseBalanceFile(fullPath);
      const res = await bm.saveBalanceToDb(parsed.records, parsed.periodKey, f);
      console.log(`[Synced] ${f.padEnd(20)} -> Period ${parsed.periodKey}: ${res.count} accounts saved.`);
    } catch (e) {
      console.error(`[Error] ${f}:`, e.message);
    }
  }

  console.log('\nAll balance files synced successfully.');
  process.exit(0);
})();
