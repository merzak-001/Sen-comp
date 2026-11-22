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

console.log('| Month | Domestic SCF | Foreign Cash | Total Row 401 | Accountant Target | Difference | Match? |');
console.log('|---|---|---|---|---|---|---|');

let allMatch = true;

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
  
  // Foreign cash collections:
  let foreignCash = 0;
  if (m === 1) {
    foreignCash = 25003795.52; // Doc 1400007260 net
  } else if (m === 5) {
    foreignCash = 27129842.35; // Doc 1400007393 Bank 11867007
  } else if (m === 7) {
    foreignCash = 13220592.51; // Doc 1400007445 Bank 11867007
  } else if (m === 8) {
    foreignCash = 67501323.06; // Doc 1400007503
  }
  
  const total401 = Math.round((scfDom + foreignCash) * 100) / 100;
  const target = targets[m];
  const diff = Math.round((total401 - target) * 100) / 100;
  const match = Math.abs(diff) < 0.01;
  if (!match) allMatch = false;

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  console.log(`| ${monthNames[m]} (M${m}) | ${scfDom.toLocaleString('en-US', {minimumFractionDigits: 2})} | ${foreignCash.toLocaleString('en-US', {minimumFractionDigits: 2})} | ${total401.toLocaleString('en-US', {minimumFractionDigits: 2})} | ${target.toLocaleString('en-US', {minimumFractionDigits: 2})} | ${diff.toFixed(2)} | ${match ? 'EXACT MATCH' : 'FAIL'} |`);
}

console.log('\nAll months match accountant?', allMatch);
