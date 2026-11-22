const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row401 = excelData.find(x => String(x[1]).trim() === '401');
  const targets = row401.slice(2, 14).map(v => Number(v) || 0);

  const allRows = await sqlDb.query(`
    SELECT period_key, boal_account, scf_account, report_initial, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key LIKE '%2025' OR period_key = '122024'
  `);

  const getAcc = (pKey, boal) => {
    return allRows.find(r => r.period_key === pKey && r.boal_account === boal) || { report_initial:0, debit:0, credit:0, solde:0 };
  };

  console.log('=== VERIFYING LINE 401 FOR ALL 12 MONTHS OF 2025 ===\n');

  let prevRecAdvSolde = 0;
  const initialRow = await sqlDb.query(`
    SELECT SUM(report_initial) as rep 
    FROM GeneralLedgerBalances 
    WHERE period_key = '012025' AND boal_account IN ('14000010', '14000030', '14060016')
  `);
  prevRecAdvSolde = Number(initialRow[0]?.rep) || 0;

  let sumFormula = 0;
  let sumTarget = 0;

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = targets[m - 1];

    const s31 = getAcc(pKey, '88010031');
    const s33 = getAcc(pKey, '88010033');
    const s53 = getAcc(pKey, '88010053');
    const s39 = getAcc(pKey, '88010039');

    const ht = (Number(s31.credit) - Number(s31.debit)) +
               (Number(s33.credit) - Number(s33.debit)) +
               (Number(s53.credit) - Number(s53.debit)) +
               (Number(s39.credit) - Number(s39.debit));
    const ttc = ht * 1.19;

    const c10 = getAcc(pKey, '14000010');
    const c30 = getAcc(pKey, '14000030');
    const c16 = getAcc(pKey, '14060016');
    const currRecAdvSolde = Number(c10.solde) + Number(c30.solde) + Number(c16.solde);
    const deltaRecAdv = currRecAdvSolde - prevRecAdvSolde;
    prevRecAdvSolde = currRecAdvSolde;

    const cExp = getAcc(pKey, '14050500');
    const foreignCredit = Number(cExp.credit || 0);

    const rrr = getAcc(pKey, '83006003');
    const rrrAmount = Number(rrr.debit || 0) - Number(rrr.credit || 0);

    const calc = ttc - deltaRecAdv + foreignCredit - rrrAmount;
    const diff = calc - target;

    sumFormula += calc;
    sumTarget += target;

    console.log(`Month ${mm}/2025 | Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)} | Formula: ${calc.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)} | Diff: ${diff.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)}`);
  }

  console.log(`\nANNUAL TOTAL FORMULA: ${sumFormula.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`ANNUAL TOTAL TARGET : ${sumTarget.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`TOTAL DIFFERENCE    : ${(sumFormula - sumTarget).toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);

  process.exit(0);
})();
