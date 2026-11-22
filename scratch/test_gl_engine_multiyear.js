const sqlDb = require('../sqlDb');

async function testYears() {
  const years = [2024, 2025, 2026];
  for (const yr of years) {
    const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
    const rows = await sqlDb.query(`
      SELECT COUNT(*) as cnt, MIN(fiscal_month) as min_m, MAX(fiscal_month) as max_m
      FROM FBL3NLineItems
      WHERE fiscal_year = ${yr} AND account IN ('${bankAccounts.join("','")}')
    `);
    console.log(`Year ${yr} bank lines in SQL:`, rows[0]);
  }
}

testYears().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
