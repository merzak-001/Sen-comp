const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== FINDING ACCOUNT MATCHES FOR ROW 402, 403, 404, 405 IN MONTH 01/2025 ===\n');

  const gl0125 = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key = '012025'
  `);

  // Target values in Month 1:
  // 402: -65,059,394.19 (or 65,059,394.19)
  // 403: -16,413,689.20 (or 16,413,689.20)
  // 404: -175,746.88
  // 405: -6,239,431.00

  console.log('--- 1. Checking 404 (Frais financiers: 175,746.88) ---');
  for (const r of gl0125) {
    const deb = Number(r.debit) || 0;
    const cred = Number(r.credit) || 0;
    const solde = Number(r.solde) || 0;
    if (Math.abs(deb - 175746.88) < 1 || Math.abs(solde - 175746.88) < 1 || Math.abs(deb) > 100000 && Math.abs(deb) < 300000) {
      console.log(`404 candidate: ${r.boal_account} (${r.scf_account} - ${r.account_desc}): Debit=${deb}, Credit=${cred}, Solde=${solde}`);
    }
  }

  console.log('\n--- 2. Checking 405 (Impots: 6,239,431.00) ---');
  for (const r of gl0125) {
    const deb = Number(r.debit) || 0;
    const cred = Number(r.credit) || 0;
    const solde = Number(r.solde) || 0;
    if (Math.abs(deb - 6239431) < 1 || Math.abs(solde - 6239431) < 1 || (deb > 5000000 && deb < 8000000)) {
      console.log(`405 candidate: ${r.boal_account} (${r.scf_account} - ${r.account_desc}): Debit=${deb}, Credit=${cred}, Solde=${solde}`);
    }
  }

  console.log('\n--- 3. Checking 403 (Personnel: 16,413,689.20) ---');
  for (const r of gl0125) {
    const deb = Number(r.debit) || 0;
    const cred = Number(r.credit) || 0;
    const solde = Number(r.solde) || 0;
    if (Math.abs(deb - 16413689.20) < 1 || Math.abs(solde - 16413689.20) < 1 || (deb > 10000000 && deb < 25000000)) {
      console.log(`403 candidate: ${r.boal_account} (${r.scf_account} - ${r.account_desc}): Debit=${deb}, Credit=${cred}, Solde=${solde}`);
    }
  }
})();
