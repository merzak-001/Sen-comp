const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const may = [];
for (let i = 1; i < data.length; i++) {
  if (data[i][7] === '2026/05') {
    may.push({
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

// Check doc types or accounts in May:
// Check all accounts starting with 21, 27, 26, 10, etc. in May
const mayCapex = may.filter(r => r.acct.startsWith('10') || r.acct.startsWith('21') || r.acct.startsWith('275'));
console.log('Capex or Caution accounts in May:');
mayCapex.forEach(r => {
  if (Math.abs(r.amt) > 1000) console.log(r);
});

// Check if any row in bank has amt near 1,240,077 or 1,298,278 or 1,222,130
const bank = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
const outflows = may.filter(r => bank.includes(r.acct) && r.amt < 0);
outflows.filter(r => Math.abs(r.amt) > 500000 && Math.abs(r.amt) < 3000000).forEach(r => console.log('Bank outflow:', r));
