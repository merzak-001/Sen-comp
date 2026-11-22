const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const months = {
  '2026/01': {
    name: 'January',
    targets: { r401: 71268189.42, r402: -58476977.38, r403: -26964763.13, r404: -75649.19, r405: -18738627.00 }
  },
  '2026/05': {
    name: 'May',
    targets: { r401: 167821572.15, r402: -116818574.84, r403: -26107976.41, r404: -618508.96, r405: -15032851.00 }
  },
  '2026/09': {
    name: 'September',
    targets: { r401: 210951817.50, r402: -164882135.60, r403: -16619584.21, r404: -276581.48, r405: -985249.00 }
  }
};

const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];

for (const [period, m] of Object.entries(months)) {
  console.log(`\n==============================================`);
  console.log(`ANALYSIS FOR ${m.name.toUpperCase()} 2026 (${period})`);
  console.log(`==============================================`);
  
  const mRows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][7] === period) {
      mRows.push({
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

  // Look at Bank rows:
  const bankRows = mRows.filter(r => bankAccts.includes(r.acct));
  console.log(`Bank rows: ${bankRows.length}, Inflows: ${bankRows.filter(r => r.amt > 0).reduce((s, r) => s + r.amt, 0).toFixed(2)}, Outflows: ${bankRows.filter(r => r.amt < 0).reduce((s, r) => s + r.amt, 0).toFixed(2)}`);
  
  // Targets:
  console.log(`Targets:`);
  console.log(`  401: ${m.targets.r401.toFixed(2)}`);
  console.log(`  402: ${m.targets.r402.toFixed(2)}`);
  console.log(`  403: ${m.targets.r403.toFixed(2)}`);
  console.log(`  404: ${m.targets.r404.toFixed(2)}`);
  console.log(`  405: ${m.targets.r405.toFixed(2)}`);
}
