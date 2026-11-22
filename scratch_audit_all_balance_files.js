const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const BalanceManager = require('./balanceManager');
const sqlDb = require('./sqlDb');

(async () => {
const bm = require('./balanceManager');
  const dir = 'C:/Users/msai/Downloads/balance';
  const files = fs.readdirSync(dir)
    .filter(f => f.toLowerCase().startsWith('balance') && (f.endsWith('.xls') || f.endsWith('.xlsx')))
    .sort();

  console.log(`Analyzing ${files.length} balance files in ${dir}...\n`);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const wb = XLSX.readFile(fullPath);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const pKey = bm.detectPeriodKey(fullPath, rawRows);
    
    // Check in database
    const dbRows = await sqlDb.query(`
      SELECT COUNT(*) as cnt, SUM(debit) as totDebit, SUM(credit) as totCredit 
      FROM GeneralLedgerBalances 
      WHERE period_key = '${pKey}'
    `);

    const dbCnt = dbRows[0]?.cnt || 0;
    const dbDeb = dbRows[0]?.totDebit || 0;

    console.log(`File: ${file.padEnd(20)} -> Period: ${pKey} | Sheet Rows: ${rawRows.length} | DB Records: ${dbCnt} | DB Debit: ${Number(dbDeb).toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
  }

  process.exit(0);
})();
