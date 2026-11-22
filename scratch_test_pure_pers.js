const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = tftData.find(x => String(x[1]).trim() === '403');
  const targets2025 = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  const allBalances2025 = await sqlDb.query(`
    SELECT period_key, boal_account, scf_account, account_desc, debit, credit, solde, report_initial
    FROM GeneralLedgerBalances
    WHERE period_key LIKE '%2025'
  `);

  console.log('=== PURE PERSONNEL ACCOUNTS ANALYSIS (EXCLUDING 408 & 444) ===\n');

  // Let's test what accounts the accountant used in each month:
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = targets2025[m - 1];

    const mRows = allBalances2025.filter(r => r.period_key === pKey && (
      (r.boal_account.startsWith('173') ||
       r.boal_account.startsWith('174') ||
       r.boal_account.startsWith('175') ||
       r.boal_account.startsWith('177') ||
       r.scf_account.startsWith('42') ||
       r.scf_account.startsWith('43') ||
       r.scf_account.startsWith('4421')) &&
      !r.scf_account.startsWith('408') && // exclude supplier invoices non parvenues
      !r.scf_account.startsWith('444') && // exclude IBS
      !r.scf_account.startsWith('447') && // exclude apprentissage / formation
      !r.scf_account.startsWith('448') && // exclude credit d'impot
      !r.boal_account.startsWith('17470350') && // exclude 408
      !r.boal_account.startsWith('17470352') && // exclude 408
      !r.boal_account.startsWith('17470353') && // exclude 408
      !r.boal_account.startsWith('17760023') && // exclude IBS
      !r.boal_account.startsWith('17760019')    // exclude credit impot
    ) && Number(r.debit) > 0);

    const totalDebit = mRows.reduce((s, r) => s + Number(r.debit || 0), 0);
    const diff = totalDebit - target;

    console.log(`M${mm}/2025 | Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} | Debits: ${totalDebit.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} | Diff: ${diff.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)}`);
  }

  process.exit(0);
})();
