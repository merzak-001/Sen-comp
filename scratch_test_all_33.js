const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = excelData.find(x => String(x[1]).trim() === '403');
  const targets = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  console.log('=== TEST ALL 33 ACCOUNTS (SCF 42, 43, 4421) ===\n');

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = targets[m - 1];

    const rows = await sqlDb.query(`
      SELECT boal_account, scf_account, account_desc, debit, credit 
      FROM GeneralLedgerBalances 
      WHERE period_key = '${pKey}' AND (
        scf_account LIKE '42%' OR 
        scf_account LIKE '43%' OR 
        scf_account LIKE '4421%'
      )
    `);

    let totalDebit = 0;
    let totalCredit = 0;
    let totalNetDebit = 0;

    rows.forEach(r => {
      totalDebit += Number(r.debit) || 0;
      totalCredit += Number(r.credit) || 0;
      totalNetDebit += (Number(r.debit) || 0) - (Number(r.credit) || 0);
    });

    console.log(`Month ${mm}/2025: Target = ${target.toFixed(2)} | Sum Debits = ${totalDebit.toFixed(2)} | Diff = ${(totalDebit - target).toFixed(2)} | Net Debit = ${totalNetDebit.toFixed(2)}`);
  }

  process.exit(0);
})();
