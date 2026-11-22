const XLSX = require('xlsx');
const wbTva = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/tva 05102026.xlsx');
const ws = wbTva.Sheets['Sheet1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

for (let r = 0; r < Math.min(data.length, 30); r++) {
  if (data[r] && data[r].some(c => c !== undefined && c !== '')) {
    console.log('R' + (r+1) + ': ' + JSON.stringify(data[r].slice(0, 10)));
  }
}
