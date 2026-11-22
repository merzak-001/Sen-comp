const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  const r403 = tftData.find(x => String(x[1]).trim() === '403');
  const r405 = tftData.find(x => String(x[1]).trim() === '405');
  
  console.log('Row 403 Notes:', ws['P9']?.v);
  console.log('Row 405 Notes:', ws['P11']?.v);

  for (let m = 1; m <= 12; m++) {
    const t403 = Math.abs(Number(r403[m+1]) || 0);
    const t405 = Math.abs(Number(r405[m+1]) || 0);
    console.log(`M${String(m).padStart(2, '0')}: Row 403 = ${t403.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Row 405 = ${t405.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
  }

  process.exit(0);
})();
