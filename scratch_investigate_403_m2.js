const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = excelData.find(x => String(x[1]).trim() === '403');
  const targets = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  console.log('=== INVESTIGATING ROW 403 TARGETS (2025) ===');
  targets.forEach((t, i) => {
    console.log(`Month ${String(i + 1).padStart(2, '0')}: ${t.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA`);
  });

  // Let's inspect Month 2 in detail
  const m2Accounts = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, debit, credit, solde 
    FROM GeneralLedgerBalances 
    WHERE period_key = '022025' AND debit > 0
    ORDER BY debit DESC
  `);

  console.log(`\nMonth 02 total accounts with debit > 0: ${m2Accounts.length}`);
  
  // Filter for candidate accounts in Month 2
  const m2Pers = m2Accounts.filter(r => 
    r.boal_account.startsWith('173') ||
    r.boal_account.startsWith('174') ||
    r.boal_account.startsWith('175') ||
    r.boal_account.startsWith('177') ||
    r.scf_account.startsWith('42') ||
    r.scf_account.startsWith('43') ||
    r.scf_account.startsWith('4421') ||
    r.boal_account === '44010088' ||
    r.boal_account === '43290061'
  );

  console.log(`Month 02 personnel candidates: ${m2Pers.length}`);
  console.table(m2Pers.map(r => ({
    boal: r.boal_account,
    scf: r.scf_account,
    desc: r.account_desc.slice(0, 25),
    debit: Number(r.debit)
  })));

  process.exit(0);
})();
