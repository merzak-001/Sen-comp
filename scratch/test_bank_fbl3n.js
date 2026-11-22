const sqlDb = require('../sqlDb');

async function testBankFBL3N() {
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  const res = await sqlDb.query(`
    SELECT account, 
           COUNT(*) as cnt, 
           SUM(CASE WHEN amount_local > 0 THEN amount_local ELSE 0 END) as totalDebit,
           SUM(CASE WHEN amount_local < 0 THEN amount_local ELSE 0 END) as totalCredit,
           SUM(amount_local) as netMvt
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account IN ('${bankAccounts.join("','")}')
    GROUP BY account
  `);
  console.log('Bank accounts in FBL3N 2026:');
  console.table(res);
}

testBankFBL3N().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
