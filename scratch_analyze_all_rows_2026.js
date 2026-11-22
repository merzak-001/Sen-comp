const XLSX = require('xlsx');

// 1. Load FBL3N 051026.xlsx for 2026
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const monthsData26 = {};
for (let m = 1; m <= 12; m++) monthsData26[m] = [];

for (let i = 1; i < data.length; i++) {
  const period = data[i][7];
  if (!period || !period.startsWith('2026/')) continue;
  const m = parseInt(period.split('/')[1], 10);
  if (m >= 1 && m <= 12) {
    monthsData26[m].push({
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

// 2. Load 2025 certified data from TFT DEC 2025.xlsx
const wb25 = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
const ws25 = wb25.Sheets['TFT 2025'];
const tft25Rows = {};

for (let r = 7; r <= 34; r++) {
  const codeCell = ws25['B' + r];
  const labelCell = ws25['A' + r];
  if (codeCell && codeCell.v) {
    const code = String(codeCell.v).trim();
    const label = labelCell ? String(labelCell.v).trim() : '';
    const months = [];
    for (let c = 2; c <= 13; c++) {
      const col = XLSX.utils.encode_col(c);
      const val = ws25[col + r] ? Number(ws25[col + r].v) || 0 : 0;
      months.push(val);
    }
    const tot = ws25['O' + r] ? Number(ws25['O' + r].v) || 0 : 0;
    tft25Rows[code] = { code, label, months, tot };
  }
}

console.log('2025 Certified Rows Loaded:', Object.keys(tft25Rows));

// 3. Let's analyze Section B & C for 2026
const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];

const tft2026 = {
  '401': [71268189.42, 116333741.70, 113048059.35, 190250637.84, 167821572.15, 188208923.20, 149860643.65, 348430299.60, 210951817.50, 0, 0, 0],
  '402': new Array(12).fill(0),
  '403': new Array(12).fill(0),
  '404': new Array(12).fill(0),
  '405': new Array(12).fill(0),
  '408': new Array(12).fill(0),
  '410': new Array(12).fill(0),
  '411': new Array(12).fill(0),
  '412': new Array(12).fill(0),
  '413': new Array(12).fill(0),
  '414': new Array(12).fill(0),
  '416': new Array(12).fill(0),
  '419': new Array(12).fill(0),
  '423': new Array(12).fill(0),
  '422': new Array(12).fill(0),
  '424': new Array(12).fill(0)
};

// Known targets for May & September 2026:
tft2026['402'][4] = -116818574.84;
tft2026['403'][4] = -26107976.41;
tft2026['404'][4] = -618508.96;
tft2026['405'][4] = -15032851.00;

tft2026['402'][8] = -164882135.60;
tft2026['403'][8] = -16619584.21;
tft2026['404'][8] = -276581.48;
tft2026['405'][8] = -985249.00;
tft2026['412'][8] = -353563.87;

// Let's inspect each month in 2026 for Cautions (412/413), Capex (410), FX (423), Dividends (419)
for (let m = 1; m <= 9; m++) {
  const rows = monthsData26[m];
  const outflows = rows.filter(r => bankAccts.includes(r.acct) && r.amt < 0);
  const inflows = rows.filter(r => bankAccts.includes(r.acct) && r.amt > 0);

  // Cautions versées (412): Accounts 2751 / 196 or txt containing caution
  const cautionsOut = outflows.filter(r => r.off.startsWith('275') || r.off.startsWith('196') || (r.txt.toLowerCase().includes('caution') && !r.txt.toLowerCase().includes('frais') && !r.txt.toLowerCase().includes('commi')));
  const cautionsIn = inflows.filter(r => r.off.startsWith('275') || r.off.startsWith('196') || r.txt.toLowerCase().includes('main levee') || r.txt.toLowerCase().includes('restitution caution'));

  // FX adjustments (423):
  const fxOut = outflows.filter(r => r.txt.toLowerCase().includes('taux de change') || r.txt.toLowerCase().includes('ecart de change') || r.acct === '11867211' && r.off === '28000010');

  // Dividends (419):
  const dividOut = outflows.filter(r => r.txt.toLowerCase().includes('divid') || r.off.startsWith('457') || r.off.startsWith('159'));

  // Capex (410):
  const capexOut = outflows.filter(r => r.off.startsWith('21') || r.off.startsWith('100') || r.txt.toLowerCase().includes('achat immo') || r.txt.toLowerCase().includes('materiel'));

  console.log(`Month ${m} (2026):`);
  if (cautionsOut.length) console.log(`   Cautions Out (412): ${cautionsOut.reduce((a, r) => a + r.amt, 0)} | Docs:`, cautionsOut.map(r => `${r.doc}: ${r.amt}`));
  if (cautionsIn.length) console.log(`   Cautions In  (413): ${cautionsIn.reduce((a, r) => a + r.amt, 0)} | Docs:`, cautionsIn.map(r => `${r.doc}: ${r.amt}`));
  if (fxOut.length) console.log(`   FX Adj (423):       ${fxOut.reduce((a, r) => a + r.amt, 0)} | Docs:`, fxOut.map(r => `${r.doc}: ${r.amt}`));
  if (dividOut.length) console.log(`   Dividends (419):    ${dividOut.reduce((a, r) => a + r.amt, 0)} | Docs:`, dividOut.map(r => `${r.doc}: ${r.amt}`));
  if (capexOut.length) console.log(`   Capex (410):        ${capexOut.reduce((a, r) => a + r.amt, 0)} | Docs:`, capexOut.map(r => `${r.doc}: ${r.amt}`));
}
