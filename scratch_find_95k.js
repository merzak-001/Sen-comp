const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== SEARCHING EXACT ORIGIN OF 95,143.98 DA IN 01/2025 ===\n');

  const rows = await sqlDb.query("SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '012025'");

  const target = 95143.98;

  for (const r of rows) {
    const d = Number(r.debit || 0);
    const c = Number(r.credit || 0);
    const s = Number(r.solde || 0);
    const rep = Number(r.report_initial || 0);
    const delta = s - rep;
    const flux = d - c;

    if (Math.abs(d - target) < 1) console.log('Exact DEBIT match:', r.boal_account, r.scf_account, r.account_desc, d);
    if (Math.abs(c - target) < 1) console.log('Exact CREDIT match:', r.boal_account, r.scf_account, r.account_desc, c);
    if (Math.abs(s - target) < 1) console.log('Exact SOLDE match:', r.boal_account, r.scf_account, r.account_desc, s);
    if (Math.abs(flux - target) < 1) console.log('Exact FLUX match:', r.boal_account, r.scf_account, r.account_desc, flux);
    if (Math.abs(delta - target) < 1) console.log('Exact DELTA match:', r.boal_account, r.scf_account, r.account_desc, delta);
  }

  // Also search combinations of accounts or FBL3N line items
  console.log('\nSearching in FBL3N file if available...');
})();
