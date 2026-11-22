const sqlDb = require('../sqlDb');

(async () => {
  try {
    const kz = await sqlDb.query(`
      SELECT fiscal_month, SUM(ABS(amount_local)) as tot
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND doc_type = 'KZ'
      GROUP BY fiscal_month
      ORDER BY fiscal_month;
    `);
    console.log('KZ (Fournisseurs) 2026 by month:', kz);

    const dz = await sqlDb.query(`
      SELECT fiscal_month, SUM(ABS(amount_local)) as tot
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND doc_type = 'DZ'
      GROUP BY fiscal_month
      ORDER BY fiscal_month;
    `);
    console.log('DZ (Clients) 2026 by month:', dz);

    const allTypes = await sqlDb.query(`
      SELECT doc_type, COUNT(id) as cnt, SUM(amount_local) as net, SUM(ABS(amount_local)) as gross
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026
      GROUP BY doc_type
      ORDER BY gross DESC;
    `);
    console.log('\nAll doc_types in 2026:', allTypes);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
})();
