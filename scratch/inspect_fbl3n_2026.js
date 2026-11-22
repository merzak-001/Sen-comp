const sqlDb = require('../sqlDb');

async function testFBL3N() {
  console.log('Querying SQL Server FBL3NLineItems for 2026...');
  
  // Total transactions in 2026
  const count = await sqlDb.query("SELECT COUNT(*) as cnt, MIN(posting_date) as minDate, MAX(posting_date) as maxDate FROM FBL3NLineItems WHERE fiscal_year = 2026");
  console.log('2026 FBL3N stats:', count);

  // Group by document type
  const byType = await sqlDb.query(`
    SELECT doc_type, COUNT(*) as cnt, SUM(amount_local) as sumAmt
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026
    GROUP BY doc_type
    ORDER BY cnt DESC
  `);
  console.log('2026 by Doc Type:', byType);

  // Check accounts in FBL3N (bank accounts vs other accounts)
  const byAccount = await sqlDb.query(`
    SELECT account, COUNT(*) as cnt, SUM(amount_local) as sumAmt
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026
    GROUP BY account
    ORDER BY cnt DESC
  `);
  console.log('2026 by Account (top 15):', byAccount.slice(0, 15));
}

testFBL3N().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
