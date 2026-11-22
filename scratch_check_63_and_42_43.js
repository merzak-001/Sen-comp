const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = excelData.find(x => String(x[1]).trim() === '403');
  const targets = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  // Let's inspect all accounts with scf_account like '63%' (charges de personnel)
  const p63 = await sqlDb.query(`
    SELECT DISTINCT boal_account, scf_account, account_desc 
    FROM GeneralLedgerBalances 
    WHERE scf_account LIKE '63%'
    ORDER BY boal_account
  `);
  console.log('SCF 63 accounts count:', p63.length);
  p63.forEach(r => console.log(r.boal_account, r.scf_account, r.account_desc));

  // Let's inspect all accounts with scf_account like '42%' or '43%' (dettes personnel & organismes sociaux)
  const p42_43 = await sqlDb.query(`
    SELECT DISTINCT boal_account, scf_account, account_desc 
    FROM GeneralLedgerBalances 
    WHERE scf_account LIKE '42%' OR scf_account LIKE '43%' OR scf_account LIKE '4421%'
    ORDER BY boal_account
  `);
  console.log('\nSCF 42/43/4421 accounts count:', p42_43.length);
  p42_43.forEach(r => console.log(r.boal_account, r.scf_account, r.account_desc));

  process.exit(0);
})();
