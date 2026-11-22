const XLSX = require('xlsx');

// Load FBL3N 2026
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];

const months = {};
for (let m = 1; m <= 9; m++) {
  months[m] = [];
}

for (let i = 1; i < data.length; i++) {
  const period = data[i][7];
  if (!period || !period.startsWith('2026/')) continue;
  const m = parseInt(period.split('/')[1], 10);
  if (m >= 1 && m <= 9) {
    months[m].push({
      acct: String(data[i][2] || ''),
      doc: String(data[i][3] || ''),
      ref: String(data[i][4] || ''),
      postingDate: String(data[i][5] || ''),
      off: String(data[i][6] || ''),
      type: String(data[i][9] || ''),
      amt: Number(data[i][14]) || 0,
      txt: String(data[i][20] || '')
    });
  }
}

// 401 values (Certified/Turnover Reconciled)
const r401 = {
  1: 71268189.42,
  2: 116327311.97, // or 116333741.70
  3: 113045437.38,
  4: 190248270.82,
  5: 167821572.15,
  6: 188210345.50,
  7: 149860643.65,
  8: 348430299.60,
  9: 210951817.50
};

console.log('Analyzing Months 1 to 9 for 402, 403, 404, 405, 410, 412, 420, etc...\n');

for (let m = 1; m <= 9; m++) {
  const rows = months[m];
  const bankRows = rows.filter(r => bankAccts.includes(r.acct));

  // Bank net change
  const netBank = bankRows.reduce((sum, r) => sum + r.amt, 0);

  // Separate Outflows and Inflows
  const outflows = bankRows.filter(r => r.amt < 0);
  const inflows = bankRows.filter(r => r.amt > 0);

  // Group outflows by offset account / doc
  console.log(`=== MONTH ${m} ===`);
  console.log(`Total bank outflows: ${outflows.reduce((s, r) => s + r.amt, 0).toFixed(2)} DZD`);
  console.log(`Total bank inflows:  ${inflows.reduce((s, r) => s + r.amt, 0).toFixed(2)} DZD`);
  console.log(`Net bank variation:  ${netBank.toFixed(2)} DZD\n`);

  // Let's identify the specific categories:
  // 1. Social & Personnel (173*, 177*, CNAS, Paie, STC)
  // 2. Taxes (G50, IBS, Impôts)
  // 3. Bank fees (Frais, Comm, Intérêts)
  // 4. Dividends (SAIEG, ADE, Dividendes)
  // 5. Internal bank transfers (between our bank accounts)
  // 6. Customs & Port RPD
  // 7. Cautions / Guarantees
  // 8. Capex / Fixed assets
  // 9. Trade Suppliers (remaining)
}
