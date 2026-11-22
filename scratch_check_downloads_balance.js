const fs = require('fs');
const path = require('path');
const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  try {
    const dbRows = await sqlDb.query(`
      SELECT period_key, COUNT(*) as cnt, SUM(debit) as totDebit, SUM(credit) as totCredit 
      FROM GeneralLedgerBalances 
      GROUP BY period_key 
      ORDER BY period_key
    `);
    console.log('=== PERIODS CURRENTLY IN SQL DATABASE ===');
    console.table(dbRows);

    const dir = 'C:/Users/msai/Downloads/balance';
    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.xls') || f.toLowerCase().endsWith('.xlsx'));
    console.log('\n=== FILES IN C:/Users/msai/Downloads/balance ===');
    console.log(files);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
