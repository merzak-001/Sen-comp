const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== FINDING 2,634,383.81 DA DIFFERENCE IN 01/2025 ===');
  const rows = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key = '012025'
  `);

  for (const r of rows) {
    const d = Number(r.debit || 0);
    const c = Number(r.credit || 0);
    const s = Number(r.solde || 0);
    if (Math.abs(d - 2634383.81) < 1 || Math.abs(c - 2634383.81) < 1 || Math.abs(s - 2634383.81) < 1) {
      console.log('MATCH:', r);
    }
  }

  // Also check if any account combination or specific supplier credit
  // In supplier accounts (16000010, etc.), what were the credits?
  // Credits in 16010800 (Foreign supplier) was 1,255,959.99
  // In 15200003 (Acomptes versés) credit was 256,716.16
  // In 16030110 credit was 151,774.13
  // In 16000007 credit was 12,376.00
  // In 15200007 credit was 13,500.00
  // What about 19710001 (Retenue de garantie): credit 474,906.39
  console.log('Done searching direct match.');
})();
