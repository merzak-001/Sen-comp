const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== TESTING THE CERTIFIED FORMULA NOTE: FOURNISS - caisse + SOLDE ACREDITIF 1118 ===\n');

  const rows = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key = '012025'
  `);

  // 1. Accréditif account:
  // Let's check all accounts with '1118' or '11867008' or 'ACCREDITIF'
  const accred = rows.filter(r => r.boal_account.includes('1118') || r.boal_account === '11867008' || r.account_desc.includes('ACCRED'));
  console.log('Accréditif accounts:');
  console.table(accred);

  // 2. Caisse accounts:
  const caisse = rows.filter(r => r.boal_account.startsWith('1017') || r.scf_account.startsWith('531'));
  console.log('Caisse accounts:');
  console.table(caisse);

  // 3. Fournisseurs:
  // In the sheets '5' and '5,', how was 'FOURNISS' calculated?
  // Let's check sheet '5' and '5,' in TFT DEC 2025.xlsx!
})();
