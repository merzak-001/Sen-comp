const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const mayRows = [];
for (let i = 1; i < data.length; i++) {
  if (data[i][7] === '2026/05') {
    mayRows.push({
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
const outflows = mayRows.filter(r => bankAccts.includes(r.acct) && r.amt < 0);

console.log('--- ALL OUTFLOWS IN MAY 2026 ---');
outflows.forEach((r, idx) => {
  console.log(`${idx+1}. Doc ${r.doc} | Acct ${r.acct} | Off ${r.off.padEnd(10)} | Amt: ${r.amt.toFixed(2).padStart(14)} | Txt: ${r.txt}`);
});
