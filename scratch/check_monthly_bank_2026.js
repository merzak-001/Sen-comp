const sqlDb = require('../sqlDb');

async function checkMonthlyBankFBL3N() {
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  
  // Monthly bank movement by month
  const monthlyMvt = await sqlDb.query(`
    SELECT fiscal_month,
           SUM(CASE WHEN amount_local > 0 THEN amount_local ELSE 0 END) as debitEncaissement,
           SUM(CASE WHEN amount_local < 0 THEN amount_local ELSE 0 END) as creditDecaissement,
           SUM(amount_local) as netVariation
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account IN ('${bankAccounts.join("','")}')
    GROUP BY fiscal_month
    ORDER BY fiscal_month
  `);
  console.log('Monthly Net Bank Variations in FBL3N (2026):');
  console.table(monthlyMvt);

  // By Doc Type across months
  const monthlyDocType = await sqlDb.query(`
    SELECT fiscal_month, doc_type, SUM(amount_local) as sumAmt
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account IN ('${bankAccounts.join("','")}')
    GROUP BY fiscal_month, doc_type
    ORDER BY fiscal_month, doc_type
  `);
  console.log('\nBank movements by Doc Type & Month (sample):');
  console.log(monthlyDocType.slice(0, 25));
}

checkMonthlyBankFBL3N().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
