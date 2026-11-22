const XLSX = require('xlsx');

// Let's load all 2026/01 rows from FBL3N 051026.xlsx
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const janRows = [];
for (let i = 1; i < data.length; i++) {
  if (data[i][7] === '2026/01') {
    janRows.push({
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

console.log(`January 2026 rows loaded from Excel: ${janRows.length}`);
const targetJan = 71268189.42;
console.log('Target Jan:', targetJan);

// 1. Domestic sales in Jan (Accounts 88010031, 88010039, 88010053)
const salesDom = janRows.filter(r => ['88010031', '88010039', '88010053'].includes(r.acct));
const salesDomHT = salesDom.reduce((a, r) => a - r.amt, 0);
const salesDomTTC = salesDomHT * 1.19;
console.log('Sales Dom HT:', salesDomHT, '| TTC:', salesDomTTC);

// 2. Export sales in Jan (88030510)
const salesExp = janRows.filter(r => r.acct === '88030510');
const salesExpHT = salesExp.reduce((a, r) => a - r.amt, 0);
console.log('Sales Exp HT:', salesExpHT);

// 3. Receivables in Jan (14000010, 14000030)
const recDom = janRows.filter(r => ['14000010', '14000030'].includes(r.acct));
const netRecDom = recDom.reduce((a, r) => a + r.amt, 0);
console.log('Net Receivables Dom movement (Debits - Credits):', netRecDom);

// 4. Advances in Jan (14060016)
const adv = janRows.filter(r => r.acct === '14060016');
const netAdv = adv.reduce((a, r) => a + r.amt, 0);
console.log('Net Advances movement:', netAdv);

// 5. Domestic formula: Sales Dom TTC - Net Receivables Dom - Net Advances
const scfDom = salesDomTTC - netRecDom - netAdv;
console.log('SCF Domestic Jan:', scfDom);
console.log('Diff with target (scfDom - targetJan):', scfDom - targetJan);

// 6. Direct customer collections on bank in Jan
const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
const bankPos = janRows.filter(r => bankAccts.includes(r.acct) && r.amt > 0);
console.log('Total bank positive in Jan:', bankPos.reduce((a, r) => a + r.amt, 0));

// Let's test combinations that yield exactly targetJan = 71,268,189.42
console.log('\nTesting formulas...');
// What if salesDomTTC is calculated differently, or what if specific accounts are used?
// Let's check:
console.log('Difference scfDom - targetJan:', scfDom - targetJan);

process.exit(0);
