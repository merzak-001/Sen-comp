const sql = require('./sqlDb');

async function checkAccountantFormula() {
  console.log('=== TESTING ACCOUNTANT FORMULA: CA TTC + (Créances M-1 - Créances M) + Avances Clients ===');

  // 1. Sales in Month 8
  const sales = await sql.query(`
    SELECT account, text_desc, SUM(amount_local) as total
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 8 AND (account LIKE '70%' OR account LIKE '7%')
    GROUP BY account, text_desc
  `);
  console.log('Sales lines in Month 8:', sales);
  const totalSales = sales.reduce((a, b) => a + Number(b.total), 0);
  console.log('Total Sales Month 8:', totalSales);
  console.log('Total Sales Month 8 * 1.19:', -totalSales * 1.19);

  // 2. Client Accounts 140* in Month 7 vs Month 8
  const clientsM7 = await sql.query(`
    SELECT account, SUM(amount_local) as total
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month <= 7 AND account LIKE '140%' AND account NOT IN ('14060016')
    GROUP BY account
  `);
  const clientsM8 = await sql.query(`
    SELECT account, SUM(amount_local) as total
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month <= 8 AND account LIKE '140%' AND account NOT IN ('14060016')
    GROUP BY account
  `);
  console.log('Client Balances M7:', clientsM7);
  console.log('Client Balances M8:', clientsM8);

  // 3. Avances clients 14060016 in Month 8
  const avancesM8 = await sql.query(`
    SELECT doc_type, SUM(amount_local) as total
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 8 AND account = '14060016'
    GROUP BY doc_type
  `);
  console.log('Avances clients 14060016 M8:', avancesM8);

  process.exit(0);
}

checkAccountantFormula();
