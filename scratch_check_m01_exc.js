const sqlDb = require('./sqlDb');
const exactMatches = require('./scratch_403_exact_breakdown.json');

(async () => {
  const m1 = exactMatches[0];
  const inc = new Set(m1.chosen.map(c => c.acc));

  const rows = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, debit, credit 
    FROM GeneralLedgerBalances 
    WHERE period_key = '012025' AND debit > 0 AND (
      scf_account LIKE '42%' OR scf_account LIKE '43%' OR scf_account LIKE '4421%'
    )
  `);

  console.log('Included accounts in M01:');
  m1.chosen.forEach(c => console.log(' INC:', c.acc, c.desc, c.origVal));

  console.log('\nExcluded accounts in M01:');
  rows.filter(r => !inc.has(r.boal_account)).forEach(r => {
    console.log(' EXC:', r.boal_account, r.account_desc, Number(r.debit));
  });

  process.exit(0);
})();
