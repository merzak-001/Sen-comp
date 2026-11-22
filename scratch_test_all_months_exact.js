const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const targets = {
  1: 71268189.42,
  2: 116333741.70,
  3: 113048059.35,
  4: 190250637.84,
  5: 167821572.15,
  6: 188208923.20,
  7: 149860643.65,
  8: 348430299.60,
  9: 210951817.50
};

const rowsByMonth = {};
for (let m = 1; m <= 9; m++) rowsByMonth[m] = [];

for (let i = 1; i < data.length; i++) {
  const period = data[i][7];
  if (!period || !period.startsWith('2026/')) continue;
  const m = parseInt(period.split('/')[1], 10);
  if (m >= 1 && m <= 9) {
    rowsByMonth[m].push({
      acct: String(data[i][2]),
      doc: String(data[i][3]),
      ref: String(data[i][4]),
      off: String(data[i][6]),
      type: String(data[i][9]),
      amt: Number(data[i][14]) || 0,
      txt: String(data[i][20] || '')
    });
  }
}

console.log('--- RECONCILIATION AUDIT ACROSS ALL 9 MONTHS ---');
for (let m = 1; m <= 9; m++) {
  const rows = rowsByMonth[m];
  
  // 1. Sales Domestic TTC
  const salesDom = rows.filter(r => ['88010031', '88010039', '88010053'].includes(r.acct));
  const salesDomHT = salesDom.reduce((a, r) => a - r.amt, 0);
  const salesDomTTC = salesDomHT * 1.19;
  
  // 2. Receivables Domestic
  const recDom = rows.filter(r => ['14000010', '14000030'].includes(r.acct));
  const netRecDom = recDom.reduce((a, r) => a + r.amt, 0);
  
  // 3. Advances Domestic
  const adv = rows.filter(r => r.acct === '14060016');
  const netAdv = adv.reduce((a, r) => a + r.amt, 0);
  
  const scfDom = salesDomTTC - netRecDom - netAdv;
  
  // Foreign collections from DZ:
  // Foreign collection bank accounts: 11867005, 11867007, 11867009, 11867210, 11867311
  // with partner 38147 (Sensus France) or from foreign customers
  // We saw:
  // In Jan: Doc 1400007260 net collection = 25,003,795.52
  // In May: Doc 1400007393 bank line = 27,129,842.35
  // In July: Doc 1400007445 bank line = 13,220,592.51
  // In Aug: Foreign collections from Sensus France
  
  const diff = targets[m] - scfDom;
  console.log(`Month ${m}: Domestic SCF = ${scfDom.toFixed(2)} | Target = ${targets[m].toFixed(2)} | Diff = ${diff.toFixed(2)}`);
}
