const XLSX = require('xlsx');
const p = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(p);
const wsBal = wb.Sheets['BAL DEC'];
const raw = XLSX.utils.sheet_to_json(wsBal, { header: 1 });

// Header is at row 5 (index 4)
const headers = raw[4];
console.log('Headers:', headers);

const accounts = [];
for (let i = 5; i < raw.length; i++) {
  const r = raw[i];
  if (!r || !r[1]) continue;
  const cpte = String(r[1]).trim();
  const desc = String(r[2] || '').trim();
  const reportSolde = typeof r[4] === 'number' ? r[4] : parseFloat(String(r[4] || 0).replace(/\s/g, '').replace(',', '.')) || 0;
  const soldePrec = typeof r[5] === 'number' ? r[5] : parseFloat(String(r[5] || 0).replace(/\s/g, '').replace(',', '.')) || 0;
  const debit = typeof r[6] === 'number' ? r[6] : parseFloat(String(r[6] || 0).replace(/\s/g, '').replace(',', '.')) || 0;
  const credit = typeof r[7] === 'number' ? r[7] : parseFloat(String(r[7] || 0).replace(/\s/g, '').replace(',', '.')) || 0;
  const soldeCum = typeof r[8] === 'number' ? r[8] : parseFloat(String(r[8] || 0).replace(/\s/g, '').replace(',', '.')) || 0;

  accounts.push({ cpte, desc, reportSolde, soldePrec, debit, credit, soldeCum });
}

console.log(`Loaded ${accounts.length} accounts from BAL DEC.`);

// Let's test cash accounts (Classe 5) in BAL DEC:
const class5 = accounts.filter(a => a.cpte.startsWith('5') || a.desc.toLowerCase().includes('banque') || a.desc.toLowerCase().includes('caisse'));
console.log('\n--- CASH ACCOUNTS IN BAL DEC ---');
let totReport5 = 0;
let totSoldeCum5 = 0;
for (const a of class5) {
  console.log(`${a.cpte.padEnd(12)} | ${a.desc.slice(0, 30).padEnd(30)} | Report: ${a.reportSolde.toLocaleString('fr-FR').padStart(18)} | SoldeCum: ${a.soldeCum.toLocaleString('fr-FR').padStart(18)}`);
  totReport5 += a.reportSolde;
  totSoldeCum5 += a.soldeCum;
}
console.log(`TOTAL Class 5 Report de solde: ${totReport5.toLocaleString('fr-FR')} (TFT Note 425 = 517 706 428,71)`);
console.log(`TOTAL Class 5 Solde Cumulé   : ${totSoldeCum5.toLocaleString('fr-FR')} (TFT Note 426 = 1 366 395 095,47)`);
