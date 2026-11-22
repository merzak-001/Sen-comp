const sqlDb = require('./sqlDb');

(async () => {
  const bankAccts = ['11867005', '11867007', '11867008', '11867009', '11867110', '11867210', '11867211', '11867310', '11867311', '10170200'];

  console.log('--- BANK ACCOUNTS IN 032025 ---');
  const banks = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde 
    FROM GeneralLedgerBalances 
    WHERE period_key = '032025' AND boal_account IN ('${bankAccts.join("','")}')
  `);

  let totDeb = 0;
  let totCrd = 0;
  banks.forEach(b => {
    console.log(`${b.boal_account} | ${b.scf_account} | ${b.account_desc.padEnd(25)} | Deb (Inflow): ${b.debit} | Crd (Outflow): ${b.credit} | Solde: ${b.solde}`);
    totDeb += Number(b.debit || 0);
    totCrd += Number(b.credit || 0);
  });

  console.log(`\nTotal Bank Debits (Inflows): ${totDeb}`);
  console.log(`Total Bank Credits (Outflows): ${totCrd}`);
  console.log(`Net Bank Variation: ${totDeb - totCrd}`);

  process.exit(0);
})();
