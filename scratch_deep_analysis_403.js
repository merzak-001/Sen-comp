const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  // 1. Get official 2025 targets from TFT DEC 2025.xlsx
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = tftData.find(x => String(x[1]).trim() === '403');
  const targets2025 = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  console.log('Official 2025 Targets for Row 403:');
  targets2025.forEach((t, i) => console.log(`  M${i+1}: ${t.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`));

  // 2. Fetch all balance accounts related to personnel (173%, 174%, 175%, 177%, 42%, 43%, 63%)
  const pKeys2025 = Array.from({length: 12}, (_, i) => `${String(i+1).padStart(2, '0')}2025`);
  const pKeys2026 = Array.from({length: 12}, (_, i) => `${String(i+1).padStart(2, '0')}2026`);

  const persAccounts = await sqlDb.query(`
    SELECT DISTINCT boal_account, scf_account, account_desc
    FROM GeneralLedgerBalances
    WHERE (
      boal_account LIKE '173%' OR 
      boal_account LIKE '174%' OR 
      boal_account LIKE '175%' OR 
      boal_account LIKE '177%' OR 
      scf_account LIKE '42%' OR 
      scf_account LIKE '43%' OR 
      scf_account LIKE '4421%'
    )
    ORDER BY boal_account
  `);

  console.log(`\nFound ${persAccounts.length} candidate Personnel accounts in Chart / Balances.\n`);

  // Let's inspect debits of these accounts month by month in 2025
  const allBalances2025 = await sqlDb.query(`
    SELECT period_key, boal_account, scf_account, debit, credit, solde, report_initial
    FROM GeneralLedgerBalances
    WHERE period_key LIKE '%2025'
  `);

  // For each month, let's see which accounts have debits
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = targets2025[m - 1];

    const mRows = allBalances2025.filter(r => r.period_key === pKey && (
      r.boal_account.startsWith('173') ||
      r.boal_account.startsWith('174') ||
      r.boal_account.startsWith('175') ||
      r.boal_account.startsWith('177') ||
      r.scf_account.startsWith('42') ||
      r.scf_account.startsWith('43') ||
      r.scf_account.startsWith('4421')
    ) && Number(r.debit) > 0);

    const totalDebit = mRows.reduce((s, r) => s + Number(r.debit || 0), 0);
    const diff = totalDebit - target;

    console.log(`\n--- MONTH ${mm}/2025 (Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2})}) ---`);
    console.log(`Total Debits of ALL Pers Accounts: ${totalDebit.toLocaleString('fr-FR', {minimumFractionDigits: 2})} (Diff = ${diff.toLocaleString('fr-FR', {minimumFractionDigits: 2})})`);

    // Top accounts by debit
    mRows.sort((a, b) => Number(b.debit) - Number(a.debit));
    for (const r of mRows.slice(0, 8)) {
      console.log(`   ${r.boal_account} (${r.scf_account} - ${persAccounts.find(x => x.boal_account === r.boal_account)?.account_desc || ''}): Debit=${Number(r.debit).toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
    }
  }

  process.exit(0);
})();
