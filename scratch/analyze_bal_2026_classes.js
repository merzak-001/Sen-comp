const XLSX = require('xlsx');
const path = require('path');
const OS_DIR = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro';

// Load chart of accounts
const wbChart = XLSX.readFile(path.join(OS_DIR, 'chart accounts.xlsx'));
const chartRows = XLSX.utils.sheet_to_json(wbChart.Sheets[wbChart.SheetNames[0]]);
const boalToScf = {};
const scfDesc = {};
for (const r of chartRows) {
  const b = String(r['Cpte gén.'] || '').trim();
  const dz = String(r['Autre cpte'] || r['Dz'] || '').trim();
  const desc = String(r['Texte descriptif'] || '').trim();
  if (b) {
    boalToScf[b] = dz;
    scfDesc[dz || b] = desc;
  }
}
console.log(`Loaded ${Object.keys(boalToScf).length} account mappings from chart accounts.xlsx`);

// Load balance 102026.xls
const wbBal = XLSX.readFile(path.join(OS_DIR, 'balance 102026.xls'));
const wsBal = wbBal.Sheets[wbBal.SheetNames[0]];
const balRows = XLSX.utils.sheet_to_json(wsBal, { header: 1 });

const accounts2026 = [];
for (let i = 4; i < balRows.length; i++) {
  const r = balRows[i];
  if (!r) continue;
  for (let c = 0; c < r.length; c++) {
    const val = String(r[c] || '').trim();
    if (/^\d{6,10}$/.test(val)) {
      const boal = val;
      const desc = String(r[c + 2] || r[c + 1] || '').trim();
      const scf = boalToScf[boal] || '';
      // Extract numbers:
      // In RFSSLD00: [Report, Solde prec, Debit interv, Credit interv, Solde cum]
      const nums = r.filter(x => typeof x === 'number' && x !== 8660 && x !== Number(boal));
      const report = nums[0] !== undefined ? nums[0] : 0;
      const soldePrec = nums[1] !== undefined ? nums[1] : 0;
      const debit = nums[2] !== undefined ? nums[2] : 0;
      const credit = nums[3] !== undefined ? nums[3] : 0;
      const soldeCum = nums[4] !== undefined ? nums[4] : 0;
      accounts2026.push({ boal, scf, desc, report, soldePrec, debit, credit, soldeCum });
      break;
    }
  }
}

console.log(`Parsed ${accounts2026.length} accounts from balance 102026.xls`);

// Let's inspect by SCF class
const byClass = {};
for (const a of accounts2026) {
  const cls = (a.scf || a.boal).charAt(0);
  byClass[cls] = (byClass[cls] || 0) + 1;
}
console.log('Account distribution by SCF Class (1 to 7):', byClass);

// Print summary by major account families
console.log('\n--- CLASS 7 (PRODUITS / CA) ---');
const c7 = accounts2026.filter(a => (a.scf || a.boal).startsWith('7'));
let tot7 = 0;
for (const a of c7) {
  tot7 += a.soldeCum;
  console.log(`${a.boal.padEnd(10)} | SCF ${a.scf.padEnd(10)} | ${a.desc.slice(0, 30).padEnd(30)} | Solde: ${a.soldeCum.toLocaleString('fr-FR').padStart(18)}`);
}
console.log(`TOTAL Produits (Classe 7): ${tot7.toLocaleString('fr-FR')} DA`);

console.log('\n--- CLASS 411 / 419 (CLIENTS) ---');
const c41 = accounts2026.filter(a => (a.scf || a.boal).startsWith('41'));
for (const a of c41) {
  console.log(`${a.boal.padEnd(10)} | SCF ${a.scf.padEnd(10)} | ${a.desc.slice(0, 30).padEnd(30)} | Report: ${a.report.toLocaleString('fr-FR').padStart(16)} | Solde: ${a.soldeCum.toLocaleString('fr-FR').padStart(16)}`);
}

console.log('\n--- CLASS 401 / 404 (FOURNISSEURS) ---');
const c40 = accounts2026.filter(a => (a.scf || a.boal).startsWith('40'));
for (const a of c40) {
  console.log(`${a.boal.padEnd(10)} | SCF ${a.scf.padEnd(10)} | ${a.desc.slice(0, 30).padEnd(30)} | Report: ${a.report.toLocaleString('fr-FR').padStart(16)} | Solde: ${a.soldeCum.toLocaleString('fr-FR').padStart(16)}`);
}

console.log('\n--- CLASS 42 / 43 (PERSONNEL & ORGANISMES SOCIAUX) ---');
const c42_43 = accounts2026.filter(a => (a.scf || a.boal).startsWith('42') || (a.scf || a.boal).startsWith('43'));
for (const a of c42_43) {
  console.log(`${a.boal.padEnd(10)} | SCF ${a.scf.padEnd(10)} | ${a.desc.slice(0, 30).padEnd(30)} | Report: ${a.report.toLocaleString('fr-FR').padStart(16)} | Solde: ${a.soldeCum.toLocaleString('fr-FR').padStart(16)}`);
}

console.log('\n--- CLASS 44 (IMPÔTS ET ÉTAT) ---');
const c44 = accounts2026.filter(a => (a.scf || a.boal).startsWith('44'));
for (const a of c44) {
  console.log(`${a.boal.padEnd(10)} | SCF ${a.scf.padEnd(10)} | ${a.desc.slice(0, 30).padEnd(30)} | Report: ${a.report.toLocaleString('fr-FR').padStart(16)} | Solde: ${a.soldeCum.toLocaleString('fr-FR').padStart(16)}`);
}

console.log('\n--- CLASS 5 (TRÉSORERIE) ---');
const c5 = accounts2026.filter(a => (a.scf || a.boal).startsWith('5') || (a.scf || a.boal).startsWith('1017') || (a.scf || a.boal).startsWith('1186') || (a.scf || a.boal).startsWith('1187'));
let totReport5 = 0;
let totSolde5 = 0;
for (const a of c5) {
  totReport5 += a.report;
  totSolde5 += a.soldeCum;
  console.log(`${a.boal.padEnd(10)} | SCF ${a.scf.padEnd(10)} | ${a.desc.slice(0, 30).padEnd(30)} | Report: ${a.report.toLocaleString('fr-FR').padStart(16)} | Solde: ${a.soldeCum.toLocaleString('fr-FR').padStart(16)}`);
}
console.log(`TOTAL Trésorerie Report (01/01/2026): ${totReport5.toLocaleString('fr-FR')} DA`);
console.log(`TOTAL Trésorerie Solde (31/10/2026) : ${totSolde5.toLocaleString('fr-FR')} DA`);
console.log(`VARIATION DE TRÉSORERIE CONSTATÉE  : ${(totSolde5 - totReport5).toLocaleString('fr-FR')} DA`);
