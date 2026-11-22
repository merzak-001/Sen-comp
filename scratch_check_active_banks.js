const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query(`
    SELECT account, count(*) as cnt, sum(amount_local) as total
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 9 AND account IN ('11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200')
    GROUP BY account
  `);
  console.log('Bank accounts active in Sep 2026:');
  console.log(rows);
  process.exit(0);
})();
