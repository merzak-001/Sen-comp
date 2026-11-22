const XLSX = require('xlsx');
const path = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx';
const wb = XLSX.readFile(path);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Feuil1']);

// Monthly CA (HT) from invoices (RV):
const caByM = new Array(12).fill(0);
// Client receivables change by month:
const creanceByM = new Array(12).fill(0);
const avanceByM = new Array(12).fill(0);

for (const r of rows) {
  const m = (r['Période comptable'] >= 1 && r['Période comptable'] <= 12) ? (r['Période comptable'] - 1) : null;
  if (m === null) continue;
  const dt = r['Type de pièce'];
  const cpte = String(r['Compte'] || '');
  const amt = r['Montant en devise interne'] || 0;

  if (dt === 'RV') {
    caByM[m] += Math.abs(amt);
  }

  if (cpte === '14000010' || cpte === '14000030' || cpte === '14050500') {
    creanceByM[m] += amt; // net change in receivables during month m
  }
  if (cpte === '14060016') {
    avanceByM[m] += amt;
  }
}

console.log('Month | CA HT | CA TTC (1.19) | Delta Creances (Deb - Cred) | Avances | Formula: CA*1.19 - DeltaCreance');
for (let m = 0; m < 9; m++) {
  const caHT = caByM[m];
  const caTTC = caHT * 1.19;
  const dCreance = creanceByM[m]; // if receivables increased, less cash collected: - dCreance
  const dAvance = Math.abs(avanceByM[m]);
  const enc1 = caTTC - dCreance + dAvance;
  const enc2 = caTTC - dCreance;
  const enc3 = caHT - dCreance;
  console.log(`M${m+1} | HT: ${caHT.toFixed(2)} | TTC: ${caTTC.toFixed(2)} | dC: ${dCreance.toFixed(2)} | Enc (TTC - dC): ${enc2.toFixed(2)} | Enc (TTC - dC + Av): ${enc1.toFixed(2)} | Enc (HT - dC): ${enc3.toFixed(2)}`);
  
  if (Math.abs(enc1 - 210951817.50) < 100 || Math.abs(enc2 - 210951817.50) < 100 || Math.abs(enc3 - 210951817.50) < 100) {
    console.log('MATCH FOUND IN MONTH', m+1);
  }
}
