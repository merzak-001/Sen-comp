const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  // Load certified 2025 TFT sheet
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Certified totals and monthly rows:
  const cert401 = [];
  const cert402 = [];
  const cert403 = [];
  const cert404 = [];
  const cert405 = [];
  const cert425 = [];
  const cert426 = [];

  for (let r = 5; r <= 33; r++) {
    const row = tftData[r];
    if (!row) continue;
    const code = String(row[1] || '').trim();
    if (code === '401') for (let c = 2; c <= 13; c++) cert401.push(Number(row[c]) || 0);
    if (code === '402') for (let c = 2; c <= 13; c++) cert402.push(Number(row[c]) || 0);
    if (code === '403') for (let c = 2; c <= 13; c++) cert403.push(Number(row[c]) || 0);
    if (code === '404') for (let c = 2; c <= 13; c++) cert404.push(Number(row[c]) || 0);
    if (code === '405') for (let c = 2; c <= 13; c++) cert405.push(Number(row[c]) || 0);
    if (code === '425') for (let c = 2; c <= 13; c++) cert425.push(Number(row[c]) || 0);
    if (code === '426') for (let c = 2; c <= 13; c++) cert426.push(Number(row[c]) || 0);
  }

  console.log('Certified 401 (Clients):', cert401.slice(0, 4));
  console.log('Certified 402 (Fournisseurs):', cert402.slice(0, 4));
  console.log('Certified 403 (Personnel):', cert403.slice(0, 4));
  console.log('Certified 425 (Cash Ouv):', cert425.slice(0, 4));
  console.log('Certified 426 (Cash Clot):', cert426.slice(0, 4));

  // Let's inspect balance data for month 1 (012025)
  const m1Rows = await sqlDb.query("SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '012025'");
  console.log(`Month 1 has ${m1Rows.length} balance rows.`);

  // Check Cash accounts in 012025:
  const cashM1 = m1Rows.filter(r => r.scf_account.startsWith('512') || r.scf_account.startsWith('53') || r.scf_account.startsWith('511'));
  console.log('Cash M1 accounts:', cashM1.map(r => ({ boal: r.boal_account, desc: r.account_desc, ouv: r.report_initial, solde: r.solde })));
  const totCashOuv = cashM1.reduce((s, r) => s + r.report_initial, 0);
  const totCashClot = cashM1.reduce((s, r) => s + r.solde, 0);
  console.log('Calculated Cash Ouv 012025:', totCashOuv, 'vs Certified 425[0]:', cert425[0]);
  console.log('Calculated Cash Clot 012025:', totCashClot, 'vs Certified 426[0]:', cert426[0]);
  console.log('Diff:', cert425[0] - totCashOuv);
})();
