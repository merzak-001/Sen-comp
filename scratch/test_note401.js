const XLSX = require('xlsx');
const p = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(p);
const wsBal = wb.Sheets['BAL DEC'];
const raw = XLSX.utils.sheet_to_json(wsBal, { header: 1 });

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

// 1. Chiffre d'affaires (Comptes 70*)
const c70 = accounts.filter(a => a.cpte.startsWith('70'));
let caDebit = 0, caCredit = 0, caSolde = 0;
for (const a of c70) {
  caDebit += a.debit;
  caCredit += a.credit;
  caSolde += a.soldeCum;
  console.log(`70: ${a.cpte} ${a.desc} | solde: ${a.soldeCum.toLocaleString('fr-FR')}`);
}
console.log(`CA Solde Cumulé (HT): ${caSolde.toLocaleString('fr-FR')}`);
console.log(`CA TTC (* 1.19): ${Math.abs(caSolde * 1.19).toLocaleString('fr-FR')}`);

// 2. Créances clients (Comptes 411*)
const c411 = accounts.filter(a => a.cpte.startsWith('411'));
let creanceN_1 = 0, creanceN = 0;
for (const a of c411) {
  creanceN_1 += a.reportSolde;
  creanceN += a.soldeCum;
  console.log(`411: ${a.cpte} ${a.desc} | Report (N-1): ${a.reportSolde.toLocaleString('fr-FR')} | Solde (N): ${a.soldeCum.toLocaleString('fr-FR')}`);
}
console.log(`Créances N-1: ${creanceN_1.toLocaleString('fr-FR')}`);
console.log(`Créances N  : ${creanceN.toLocaleString('fr-FR')}`);
console.log(`Variation créances (N-1 - N): ${(creanceN_1 - creanceN).toLocaleString('fr-FR')}`);

// 3. Avances clients (Comptes 419*)
const c419 = accounts.filter(a => a.cpte.startsWith('419'));
let avanceN_1 = 0, avanceN = 0;
for (const a of c419) {
  avanceN_1 += a.reportSolde;
  avanceN += a.soldeCum;
  console.log(`419: ${a.cpte} ${a.desc} | Report: ${a.reportSolde.toLocaleString('fr-FR')} | Solde: ${a.soldeCum.toLocaleString('fr-FR')}`);
}
console.log(`Avance N-1: ${avanceN_1.toLocaleString('fr-FR')}, Avance N: ${avanceN.toLocaleString('fr-FR')}`);

// Check formula
const enc1 = Math.abs(caSolde * 1.19) + (creanceN_1 - creanceN) + Math.abs(avanceN);
console.log(`\nCalcul Note 401 [CA*1.19 + (N-1 - N) + Avance]: ${enc1.toLocaleString('fr-FR')}`);
console.log(`TFT Note 401 Référence: 2 683 587 091,00`);
