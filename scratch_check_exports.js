const sql = require('./sqlDb');

async function testExportsAndDomestic() {
  console.log('=== CHECKING DOMESTIC VS EXPORT SALES & PAYMENTS ===\n');

  // Let's check sales accounts in 2026:
  // 88010031: VENTES PRODUITS FINIS (Locales -> soumis à TVA 19%)
  // 88010039: VENTE PRODUIT DIVERS
  // 88010053: VENTES DE MARCHANDISES
  // 88030510: VENTES PRODUITS FINIS GROUPE (Exports -> EXONÉRÉ TVA 0%!)
  
  const salesByMonth = await sql.query(`
    SELECT fiscal_month, account, 
           SUM(CASE WHEN amount_local < 0 THEN -amount_local ELSE -amount_local END) as revenue
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account IN ('88010031', '88010039', '88010053', '88030510')
    GROUP BY fiscal_month, account
    ORDER BY fiscal_month, account
  `);

  console.log('Monthly revenue by account:');
  console.table(salesByMonth);

  process.exit(0);
}

testExportsAndDomestic();
