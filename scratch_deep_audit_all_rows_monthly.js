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

  console.log('=== MONTHLY AUDIT FOR ALL OTHER TFT ROWS IN 2025 ===\n');

  // Let's audit Row 419 (Dividendes)
  const t419 = getTargetRow('419');
  console.log('--- NOTE 419 (DIVIDENDES VERSES) ---');
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = t419[m - 1];
    const divDeb = allRows
      .filter(r => r.period_key === pKey && (r.boal_account === '15911302' || r.scf_account.startsWith('457')))
      .reduce((s, r) => s + Number(r.debit || 0), 0);
    console.log(`M${mm} | Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(16)} | Formula: ${(-divDeb).toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(16)} | Diff: ${(target - (-divDeb)).toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(12)}`);
  }

  // Let's audit Row 412 & 413 (Cautions)
  const t412 = getTargetRow('412');
  const t413 = getTargetRow('413');
  console.log('\n--- NOTE 412 (DECAISSEMENTS CAUTIONS 2751) ---');
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = t412[m - 1];
    const cDeb = allRows
      .filter(r => r.period_key === pKey && (r.boal_account === '19610003' || r.scf_account.startsWith('2751')))
      .reduce((s, r) => s + Number(r.debit || 0), 0);
    console.log(`M${mm} | Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(16)} | Formula: ${(-cDeb).toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(16)} | Diff: ${(target - (-cDeb)).toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(12)}`);
  }

  console.log('\n--- NOTE 413 (RESTITUTION CAUTIONS 2751) ---');
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = t413[m - 1];
    const cCred = allRows
      .filter(r => r.period_key === pKey && (r.boal_account === '19610003' || r.scf_account.startsWith('2751')))
      .reduce((s, r) => s + Number(r.credit || 0), 0);
    console.log(`M${mm} | Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(16)} | Formula: ${cCred.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(16)} | Diff: ${(target - cCred).toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(12)}`);
  }

  process.exit(0);
})();
