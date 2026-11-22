const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = excelData.find(x => String(x[1]).trim() === '403');
  const targets = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  const allRows = await sqlDb.query(`
    SELECT period_key, boal_account, scf_account, account_desc, debit, credit, solde, report_initial
    FROM GeneralLedgerBalances
    WHERE period_key LIKE '%2025' AND (
      boal_account LIKE '173%' OR 
      boal_account LIKE '174%' OR 
      boal_account LIKE '175%' OR 
      boal_account LIKE '177%' OR 
      scf_account LIKE '42%' OR 
      scf_account LIKE '43%' OR 
      scf_account LIKE '4421%'
    ) AND (
      NOT scf_account LIKE '408%' AND
      NOT scf_account LIKE '444%'
    )
  `);

  console.log('=== LISTING ALL DISTINCT PERSONNEL ACCOUNTS WITH MOVEMENTS IN 2025 ===');
  const accMap = new Map();
  for (const r of allRows) {
    if (!accMap.has(r.boal_account)) {
      accMap.set(r.boal_account, { scf: r.scf_account, desc: r.account_desc, debits: new Array(12).fill(0), credits: new Array(12).fill(0) });
    }
    const m = parseInt(r.period_key.slice(0, 2), 10) - 1;
    accMap.get(r.boal_account).debits[m] = Number(r.debit || 0);
    accMap.get(r.boal_account).credits[m] = Number(r.credit || 0);
  }

  console.log(`Found ${accMap.size} distinct personnel accounts.\n`);

  for (const [acc, data] of accMap.entries()) {
    const totDeb = data.debits.reduce((a, b) => a + b, 0);
    if (totDeb > 0) {
      console.log(`${acc.padEnd(10)} | ${data.scf.padEnd(12)} | ${data.desc.padEnd(30)} | Tot Debit: ${totDeb.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)}`);
    }
  }

  process.exit(0);
})();
