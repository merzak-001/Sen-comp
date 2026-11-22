const sqlDb = require('../sqlDb');

async function check2026Monthly() {
  // Let's get monthly DZ (clients)
  const dzByMonth = await sqlDb.query(`
    SELECT fiscal_month, sum(abs(amount_local)) as dzAmt
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND doc_type = 'DZ'
    GROUP BY fiscal_month
    ORDER BY fiscal_month;
  `);
  console.log('2026 DZ by Month:', dzByMonth);

  // Monthly KZ (fournisseurs)
  const kzByMonth = await sqlDb.query(`
    SELECT fiscal_month, sum(abs(amount_local)) as kzAmt
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND doc_type = 'KZ'
    GROUP BY fiscal_month
    ORDER BY fiscal_month;
  `);
  console.log('2026 KZ by Month:', kzByMonth);
}

check2026Monthly().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
