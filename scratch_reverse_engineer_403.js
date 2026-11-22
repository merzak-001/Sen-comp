const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = tftData.find(x => String(x[1]).trim() === '403');
  const targets = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  console.log('Targets 403 (2025):');
  targets.forEach((t, i) => console.log(`  M${String(i+1).padStart(2,'0')}: ${t.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`));

  // Fetch all balances for 2025 and 12/2024 (if available) or initial report of 012025
  const allBalances = await sqlDb.query(`
    SELECT period_key, boal_account, scf_account, account_desc, report_initial, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key LIKE '%2025'
  `);

  console.log(`\nLoaded ${allBalances.length} balance lines for 2025.`);

  // Let's inspect Class 63 (Charges de personnel) for each month
  console.log('\n=== OPTION B TEST: CHARGES DE PERSONNEL (SCF 63 / 64) ===');
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = targets[m - 1];

    // Class 63 in SCF
    const class63 = allBalances.filter(r => r.period_key === pKey && (r.scf_account.startsWith('63') || r.scf_account.startsWith('64')));
    const chgPersonnel = class63.reduce((s, r) => s + (Number(r.debit || 0) - Number(r.credit || 0)), 0);

    // Dettes de personnel (SCF 42, 43, 4421)
    const dettes = allBalances.filter(r => r.period_key === pKey && (r.scf_account.startsWith('42') || r.scf_account.startsWith('43') || r.scf_account.startsWith('4421')));
    
    // In Algerian balance: Credit solde is negative or positive? In SAP solde = report + debit - credit
    // Solde of liabilities (42, 43): credit > debit => solde is negative in SAP RFSSLD00
    // Delta Dette = Solde(t) - Solde(t-1)
    console.log(`M${mm} | Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(14)} | Chg Pers 63/64: ${chgPersonnel.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(14)} | Diff: ${(chgPersonnel - target).toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(14)}`);
  }

  process.exit(0);
})();
