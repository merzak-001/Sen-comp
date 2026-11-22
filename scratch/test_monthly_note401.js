const XLSX = require('xlsx');
const path = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx';
const wb = XLSX.readFile(path);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Feuil1']);

// Accounts:
// 70* (Sales / Turnover): 700100000, 701100000, 701300000, 702100000, 709000000
// Or Invoices RV: doc_type = 'RV'
// Client accounts: 14000010 (Domestiques), 14000030 (ADE), 14050500 (Groupe), 14060016 (Avance)

console.log('Testing monthly formula: CA*1.19 + (Creance_start - Creance_end) + Avance...');

// 1. Sales by month
const caByMonth = {};
for (const r of rows) {
  const dt = r['Type de pièce'];
  const m = r['Période comptable'];
  const amt = r['Montant en devise interne'] || 0;
  if (dt === 'RV') {
    caByMonth[m] = (caByMonth[m] || 0) + Math.abs(amt);
  }
}
console.log('Sales (RV) by Month:', caByMonth);

// 2. Bank entries from clients: doc_type = 'DZ'
const dzByMonth = {};
for (const r of rows) {
  const dt = r['Type de pièce'];
  const m = r['Période comptable'];
  const amt = r['Montant en devise interne'] || 0;
  const cpte = String(r['Compte'] || '');
  if (dt === 'DZ') {
    dzByMonth[m] = (dzByMonth[m] || 0) + amt;
  }
}
console.log('DZ by Month:', dzByMonth);

// Check if any combination gives 210951817.50
for (const [m, ca] of Object.entries(caByMonth)) {
  const caTTC = ca * 1.19;
  console.log(`Month ${m}: CA HT = ${ca.toLocaleString('fr-FR')}, CA TTC = ${caTTC.toLocaleString('fr-FR')}`);
}
