const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = tftData.find(x => String(x[1]).trim() === '403');
  const targets = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  // Let's load all accounts for 2025
  const allRows = await sqlDb.query(`
    SELECT period_key, boal_account, scf_account, account_desc, report_initial, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key LIKE '%2025'
  `);

  console.log('=== INVESTIGATING ROW 403 EXACT FORMULA FOR ALL 12 MONTHS ===\n');

  // Let's test different candidate formulas:
  // Candidate A: Direct Débits on specific accounts
  // Let's see which accounts have non-zero debits in each month:
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = targets[m - 1];

    const monthAccounts = allRows.filter(r => r.period_key === pKey && Number(r.debit) > 0);

    // Let's find single accounts or small subsets that come close
    // In particular, look at:
    // 17300228 (Net salary)
    // 17460003 (IRG)
    // 17760022 (CNAS maladie)
    // 17310016 (CNAS retraite)
    // 17310015 (CNAS accident)
    const salNet = Number(monthAccounts.find(r => r.boal_account === '17300228')?.debit || 0);
    const irg = Number(monthAccounts.find(r => r.boal_account === '17460003')?.debit || 0);
    const cnasMal = Number(monthAccounts.find(r => r.boal_account === '17760022')?.debit || 0);
    const cnasRet = Number(monthAccounts.find(r => r.boal_account === '17310016')?.debit || 0);
    const cnasAcc = Number(monthAccounts.find(r => r.boal_account === '17310015')?.debit || 0);
    const cnasTotal = cnasMal + cnasRet + cnasAcc;

    const baseSum = salNet + irg + cnasTotal;
    const diffFromBase = target - baseSum;

    console.log(`M${mm} | Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(14)} | SalNet: ${salNet.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(13)} | IRG: ${irg.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(12)} | CNAS: ${cnasTotal.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(12)} | BaseSum: ${baseSum.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(14)} | Remainder: ${diffFromBase.toLocaleString('fr-FR', {minimumFractionDigits:2}).padStart(13)}`);
  }

  process.exit(0);
})();
