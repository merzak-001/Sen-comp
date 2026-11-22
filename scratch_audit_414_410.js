const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const getTargetRow = (note) => {
    const r = excelData.find(x => String(x[1]).trim() === String(note));
    if (!r) return new Array(12).fill(0);
    const months = [];
    for (let c = 2; c <= 13; c++) months.push(Number(r[c]) || 0);
    return months;
  };

  const allRows = await sqlDb.query(`
    SELECT period_key, boal_account, scf_account, account_desc, report_initial, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key LIKE '%2025'
  `);

  console.log('=== NOTE 414 (INTERETS ENCAISSES PLACEMENTS) ===');
  const t414 = getTargetRow('414');
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = t414[m - 1];
    // Placements interest accounts (76%)
    const intCred = allRows
      .filter(r => r.period_key === pKey && (r.scf_account.startsWith('76') || r.boal_account === '86010002'))
      .reduce((s, r) => s + (Number(r.credit || 0) - Number(r.debit || 0)), 0);
    console.log(`M${mm} | Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(14)} | Formula: ${intCred.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(14)} | Diff: ${(target - intCred).toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(12)}`);
  }

  console.log('\n=== NOTE 410 (ACHATS IMMOBILISATIONS) ===');
  const t410 = getTargetRow('410');
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = t410[m - 1];
    // Fixed asset acquisitions (Class 20, 21, 23)
    const immDeb = allRows
      .filter(r => r.period_key === pKey && (
        r.scf_account.startsWith('20') || 
        r.scf_account.startsWith('21') || 
        r.scf_account.startsWith('23')
      ) && (
        !r.scf_account.startsWith('28') && // exclude amortization
        !r.scf_account.startsWith('29')    // exclude depreciation
      ))
      .reduce((s, r) => s + Number(r.debit || 0), 0);
    console.log(`M${mm} | Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(14)} | Formula: ${(-immDeb).toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(14)} | Diff: ${(target - (-immDeb)).toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(12)}`);
  }

  process.exit(0);
})();
