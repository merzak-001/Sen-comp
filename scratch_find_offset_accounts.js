const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== FINDING EXACT COMPOSITION OF 2,634,383.81 DA IN 01/2025 ===\n');

  const rows = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key = '012025'
  `);

  const target = 2634383.81;

  console.log('--- 1. Exact or close single accounts ---');
  for (const r of rows) {
    const d = Number(r.debit || 0);
    const c = Number(r.credit || 0);
    const s = Number(r.solde || 0);
    const rep = Number(r.report_initial || 0);
    const flux = d - c;

    if (Math.abs(d - target) < 1) console.log('Exact DEBIT match:', r.boal_account, r.scf_account, r.account_desc, d);
    if (Math.abs(c - target) < 1) console.log('Exact CREDIT match:', r.boal_account, r.scf_account, r.account_desc, c);
    if (Math.abs(s - target) < 1) console.log('Exact SOLDE match:', r.boal_account, r.scf_account, r.account_desc, s);
    if (Math.abs(flux - target) < 1) console.log('Exact FLUX match:', r.boal_account, r.scf_account, r.account_desc, flux);
  }

  console.log('\n--- 2. Checking Supplier Accounts in 01/2025 in detail ---');
  // Debits:
  // 16000010: 10414509.42
  // 16010800: 46329826.86
  // 17110102: 2594501.80
  // 16030110: 6847068.80
  // 16000007: 1134784.26
  // 15200003: 373086.86
  // Total = 67693778.00

  // What about subsets of these 6 accounts?
  // What if some of these accounts are NOT in 402?
  // e.g. What is 67693778 - target?
  // Check if any combination of accounts equals 65059394.19 directly!
  const supplAccs = [
    { acc: '16000010', d: 10414509.42, c: 78321008.26, desc: 'Domestiques' },
    { acc: '16010800', d: 46329826.86, c: 1255959.99, desc: 'Etrangers' },
    { acc: '17110102', d: 2594501.80, c: 1890666.01, desc: 'Services' },
    { acc: '16030110', d: 6847068.80, c: 151774.13, desc: 'Sensus France' },
    { acc: '16000007', d: 1134784.26, c: 12376.00, desc: 'SAIEG' },
    { acc: '15200003', d: 373086.86, c: 256716.16, desc: 'Acomptes' }
  ];

  // What other accounts have debits in class 40?
  const all40 = rows.filter(r => r.scf_account.startsWith('40') || r.boal_account.startsWith('16') || r.boal_account.startsWith('171') || r.boal_account.startsWith('152') || r.boal_account.startsWith('197'));
  console.log('\nAll Class 40 / Supplier accounts with movements in 01/2025:');
  for (const r of all40) {
    if (r.debit > 0 || r.credit > 0) {
      console.log(`  ${r.boal_account} (${r.scf_account} - ${r.account_desc}): Debit=${r.debit}, Credit=${r.credit}, Solde=${r.solde}`);
    }
  }

})();
