const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, debit, credit 
    FROM GeneralLedgerBalances 
    WHERE period_key = '102025' AND debit > 0 AND (
      boal_account LIKE '17%' OR scf_account LIKE '42%' OR scf_account LIKE '43%' OR scf_account LIKE '4421%'
    )
    ORDER BY debit ASC
  `);
  console.log(`Found ${rows.length} rows for 10/2025:`);
  rows.forEach(r => console.log(r.boal_account, (r.account_desc || '').slice(0, 30), Number(r.debit)));
  process.exit(0);
})();
