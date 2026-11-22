const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = excelData.find(x => String(x[1]).trim() === '403');
  const targets = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  console.log('Targets 403:', targets);

  // Let's check bank accounts (scf_account like '512%')
  const bankRows = await sqlDb.query(`
    SELECT period_key, boal_account, scf_account, account_desc, debit, credit 
    FROM GeneralLedgerBalances 
    WHERE scf_account LIKE '512%' AND period_key LIKE '%2025'
    ORDER BY period_key, boal_account
  `);
  
  const byAcc = {};
  bankRows.forEach(r => {
    if (!byAcc[r.boal_account]) byAcc[r.boal_account] = { desc: r.account_desc, scf: r.scf_account, months: {} };
    byAcc[r.boal_account].months[r.period_key] = { debit: Number(r.debit), credit: Number(r.credit) };
  });

  console.log('Bank accounts found:', Object.keys(byAcc).map(k => k + ' - ' + byAcc[k].desc));

  if (byAcc['11867311']) {
    console.log('\n--- 11867311 (BEA El Eulma Credit vs Target) ---');
    for (let m = 1; m <= 12; m++) {
      const pKey = String(m).padStart(2, '0') + '2025';
      const mData = byAcc['11867311'].months[pKey] || { debit: 0, credit: 0 };
      console.log(`M${pKey}: Target = ${targets[m-1].toFixed(2)} | Bank Credit = ${mData.credit.toFixed(2)} | Diff = ${(targets[m-1] - mData.credit).toFixed(2)}`);
    }
  }

  process.exit(0);
})();
