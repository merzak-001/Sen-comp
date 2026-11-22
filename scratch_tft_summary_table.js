const XLSX = require('xlsx');

// Load FBL3N 2026 data
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const monthsData = {};
for (let m = 1; m <= 9; m++) monthsData[m] = [];

for (let i = 1; i < data.length; i++) {
  const period = data[i][7];
  if (!period || !period.startsWith('2026/')) continue;
  const m = parseInt(period.split('/')[1], 10);
  if (m >= 1 && m <= 9) {
    monthsData[m].push({
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

const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];

// Certified Opening cash Jan 1, 2026
const openingCash2026 = 1366395095.47;

console.log('=== FULL SYSTEMIC RECONCILIATION FOR 2026 (ROWS 401 TO 427) ===\n');

// 401 Certified:
const r401 = [71268189.42, 116333741.70, 113048059.35, 190250637.84, 167821572.15, 188208923.20, 149860643.65, 348430299.60, 210951817.50];

// Let's print a monthly summary table:
console.log('| M | 401 (Clients) | 402 (Fourn.) | 403 (Personnel) | 404 (Banque) | 405 (Impôts) | Flux Op (A) | Flux Inv (B) | Flux Fin (C) | Var Nette (424) | Tréso Clôture (426) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');

let runningCash = openingCash2026;

for (let m = 1; m <= 9; m++) {
  const rows = monthsData[m];
  const bankRows = rows.filter(r => bankAccts.includes(r.acct));
  const netVarBank = bankRows.reduce((a, r) => a + r.amt, 0);
  
  // Specific known certified points:
  let v402, v403, v404, v405, vB = 0, vC = 0;

  if (m === 5) {
    v402 = -116818574.84;
    v403 = -26107976.41;
    v404 = -618508.96;
    v405 = -15032851.00;
    vC = -58201.62; // FX
    vB = netVarBank - (r401[m-1] + v402 + v403 + v404 + v405 + vC);
  } else if (m === 9) {
    v402 = -164882135.60;
    v403 = -16619584.21;
    v404 = -276581.48;
    v405 = -985249.00;
    vC = -897895.80; // FX
    vB = -353563.87; // Cautions
  } else if (m === 3) {
    // March had huge dividends: 362.57M!
    vC = -362573602.91;
    vB = -1388688.35 - 512380.00; // Capex + Cautions
    // G50 check was 2.89M
    // Paie was 87.2M (with bonuses/13th month)
  }

  runningCash += netVarBank;
  const monthName = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'][m];
  console.log(`| ${monthName} | ${(r401[m-1]/1e6).toFixed(2)}M | ${(v402 ? (v402/1e6).toFixed(2)+'M' : 'calc')} | ${(v403 ? (v403/1e6).toFixed(2)+'M' : 'calc')} | ${(v404 ? (v404/1e3).toFixed(0)+'k' : 'calc')} | ${(v405 ? (v405/1e6).toFixed(2)+'M' : 'calc')} | - | ${(vB/1e6).toFixed(2)}M | ${(vC/1e6).toFixed(2)}M | ${(netVarBank/1e6).toFixed(2)}M | ${(runningCash/1e6).toFixed(2)}M |`);
}
