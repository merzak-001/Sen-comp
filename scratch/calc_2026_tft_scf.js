const XLSX = require('xlsx');
const path = require('path');
const OS_DIR = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro';

// Load chart of accounts
const wbChart = XLSX.readFile(path.join(OS_DIR, 'chart accounts.xlsx'));
const chartRows = XLSX.utils.sheet_to_json(wbChart.Sheets[wbChart.SheetNames[0]]);
const boalToScf = {};
for (const r of chartRows) {
  const b = String(r['Cpte gén.'] || '').trim();
  const dz = String(r['Autre cpte'] || r['Dz'] || '').trim();
  if (b) boalToScf[b] = dz;
}

// Load balance 102026.xls
const wbBal = XLSX.readFile(path.join(OS_DIR, 'balance 102026.xls'));
const balRows = XLSX.utils.sheet_to_json(wbBal.Sheets[wbBal.SheetNames[0]], { header: 1 });

const accounts = [];
for (let i = 4; i < balRows.length; i++) {
  const r = balRows[i];
  if (!r) continue;
  for (let c = 0; c < r.length; c++) {
    const val = String(r[c] || '').trim();
    if (/^\d{6,10}$/.test(val)) {
      const boal = val;
      const desc = String(r[c + 2] || r[c + 1] || '').trim();
      const scf = boalToScf[boal] || '';
      const nums = r.filter(x => typeof x === 'number' && x !== 8660 && x !== Number(boal));
      const report = nums[0] !== undefined ? nums[0] : 0;
      const soldePrec = nums[1] !== undefined ? nums[1] : 0;
      const debit = nums[2] !== undefined ? nums[2] : 0;
      const credit = nums[3] !== undefined ? nums[3] : 0;
      const soldeCum = nums[4] !== undefined ? nums[4] : 0;
      accounts.push({ boal, scf, desc, report, soldePrec, debit, credit, soldeCum });
      break;
    }
  }
}

console.log('--- RECONSTITUTION DU TFT 2026 SELON LE MODÈLE SCF ALGÉRIE (BALANCE 10/2026) ---');

// 1. Note 401 : Encaissements reçus des clients
// Formule SCF : CA TTC + (Créances N-1 - Créances N) + Avances clients
// CA (Comptes 70*)
const c70 = accounts.filter(a => (a.scf || a.boal).startsWith('70'));
let caSolde = 0;
for (const a of c70) caSolde += a.soldeCum;
const caHT = Math.abs(caSolde);
const caTTC = caHT * 1.19; // Avec TVA 19%

// Créances clients (Comptes 411*)
const c411 = accounts.filter(a => (a.scf || a.boal).startsWith('411'));
let creancesN_1 = 0, creancesN = 0;
for (const a of c411) {
  creancesN_1 += a.report;
  creancesN += a.soldeCum;
}
const deltaCreances = creancesN_1 - creancesN;

// Avances clients (Comptes 419*)
const c419 = accounts.filter(a => (a.scf || a.boal).startsWith('419'));
let avanceClientN = 0;
for (const a of c419) avanceClientN += Math.abs(a.soldeCum);

const note401_SCF = caTTC + deltaCreances + avanceClientN;
console.log(`Note 401 (Clients SCF) :`);
console.log(`  CA HT              : ${caHT.toLocaleString('fr-FR')} DA`);
console.log(`  CA TTC (1.19)      : ${caTTC.toLocaleString('fr-FR')} DA`);
console.log(`  Créances N-1       : ${creancesN_1.toLocaleString('fr-FR')} DA`);
console.log(`  Créances N         : ${creancesN.toLocaleString('fr-FR')} DA`);
console.log(`  Var Créances (N-1 - N): ${deltaCreances.toLocaleString('fr-FR')} DA`);
console.log(`  Avances clients N  : ${avanceClientN.toLocaleString('fr-FR')} DA`);
console.log(`  => Note 401 SCF    : ${note401_SCF.toLocaleString('fr-FR')} DA\n`);

// 2. Note 402 : Décaissements fournisseurs
// Fournisseurs (Comptes 401 / 404 / 408)
// Achats (Classe 60) + Services extérieurs (Classe 61, 62)
const c60_62 = accounts.filter(a => {
  const p = (a.scf || a.boal);
  return p.startsWith('60') || p.startsWith('61') || p.startsWith('62');
});
let achatsSolde = 0;
for (const a of c60_62) achatsSolde += a.soldeCum;
const achatsHT = Math.abs(achatsSolde);
const achatsTTC = achatsHT * 1.19;

const c401 = accounts.filter(a => {
  const p = (a.scf || a.boal);
  return p.startsWith('401') || p.startsWith('404') || p.startsWith('408');
});
let dettesFournN_1 = 0, dettesFournN = 0;
for (const a of c401) {
  dettesFournN_1 += a.report;
  dettesFournN += a.soldeCum;
}
// Dettes fournisseurs are credit (negative), so change in liability:
// Payment = Achats TTC + (Dettes N-1 - Dettes N)
const deltaDettes = Math.abs(dettesFournN_1) - Math.abs(dettesFournN);
const note402_SCF = -(achatsTTC + deltaDettes);
console.log(`Note 402 (Fournisseurs SCF) :`);
console.log(`  Achats & Services HT : ${achatsHT.toLocaleString('fr-FR')} DA`);
console.log(`  Achats TTC (1.19)    : ${achatsTTC.toLocaleString('fr-FR')} DA`);
console.log(`  Dettes Fourn N-1     : ${Math.abs(dettesFournN_1).toLocaleString('fr-FR')} DA`);
console.log(`  Dettes Fourn N       : ${Math.abs(dettesFournN).toLocaleString('fr-FR')} DA`);
console.log(`  => Note 402 SCF      : ${note402_SCF.toLocaleString('fr-FR')} DA\n`);

// 3. Note 403 : Personnel & charges sociales
const c63 = accounts.filter(a => (a.scf || a.boal).startsWith('63'));
let chargesPersonnel = 0;
for (const a of c63) chargesPersonnel += a.soldeCum;
console.log(`Note 403 (Personnel) : Charges de personnel (63) = ${chargesPersonnel.toLocaleString('fr-FR')} DA`);

// 4. Note 404 : Frais financiers (661)
const c66 = accounts.filter(a => (a.scf || a.boal).startsWith('66'));
let chargesFinancieres = 0;
for (const a of c66) chargesFinancieres += a.soldeCum;
console.log(`Note 404 (Frais Financiers 66) = ${chargesFinancieres.toLocaleString('fr-FR')} DA`);

// 5. Note 405 : Impôts et taxes (64 + 695/444)
const c64 = accounts.filter(a => (a.scf || a.boal).startsWith('64'));
let impotsTaxes = 0;
for (const a of c64) impotsTaxes += a.soldeCum;
console.log(`Note 405 (Impôts et taxes 64) = ${impotsTaxes.toLocaleString('fr-FR')} DA`);

// 6. Note 425 & 426 Trésorerie
const c5 = accounts.filter(a => (a.scf || a.boal).startsWith('5') || (a.scf || a.boal).startsWith('1017') || (a.scf || a.boal).startsWith('1186') || (a.scf || a.boal).startsWith('1187'));
let ouv5 = 0, clot5 = 0;
for (const a of c5) {
  ouv5 += a.report;
  clot5 += a.soldeCum;
}
console.log(`\nTrésorerie Ouverture (425) : ${ouv5.toLocaleString('fr-FR')} DA`);
console.log(`Trésorerie Clôture (426)   : ${clot5.toLocaleString('fr-FR')} DA`);
console.log(`Variation Constatée (427) : ${(clot5 - ouv5).toLocaleString('fr-FR')} DA`);
