const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query(`
    SELECT period_key, boal_account, account_desc, debit, credit 
    FROM GeneralLedgerBalances 
    WHERE boal_account = '17300228' AND period_key LIKE '%2025'
    ORDER BY period_key
  `);
  rows.forEach(r => {
    console.log(`${r.period_key}: Debit = ${Number(r.debit).toLocaleString('fr-FR')} | Credit = ${Number(r.credit).toLocaleString('fr-FR')}`);
  });
  process.exit(0);
})();
