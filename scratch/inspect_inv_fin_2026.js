const XLSX = require('xlsx');
const path = require('path');
const OS_DIR = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro';

const wbChart = XLSX.readFile(path.join(OS_DIR, 'chart accounts.xlsx'));
const chartRows = XLSX.utils.sheet_to_json(wbChart.Sheets[wbChart.SheetNames[0]]);
const boalToScf = {};
for (const r of chartRows) {
  const b = String(r['Cpte gén.'] || '').trim();
  const dz = String(r['Autre cpte'] || r['Dz'] || '').trim();
  if (b) boalToScf[b] = dz;
}

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
      accounts.push({
        boal, scf, desc,
        report: nums[0] || 0,
        soldePrec: nums[1] || 0,
        debit: nums[2] || 0,
        credit: nums[3] || 0,
        soldeCum: nums[4] || 0
      });
      break;
    }
  }
}

console.log('--- CLASS 1 (CAPITAUX / DIVIDENDES / EMPRUNTS) ---');
const c1 = accounts.filter(a => (a.scf || a.boal).startsWith('1'));
for (const a of c1) {
  if (Math.abs(a.soldeCum - a.report) > 1 || Math.abs(a.debit) > 1 || Math.abs(a.credit) > 1) {
    console.log(`${a.boal.padEnd(10)} | SCF ${a.scf.padEnd(10)} | ${a.desc.slice(0, 30).padEnd(30)} | Report: ${a.report.toLocaleString('fr-FR').padStart(16)} | Solde: ${a.soldeCum.toLocaleString('fr-FR').padStart(16)} | Var: ${(a.soldeCum - a.report).toLocaleString('fr-FR').padStart(16)}`);
  }
}

console.log('\n--- CLASS 2 (IMMOBILISATIONS / INVESTISSEMENTS) ---');
const c2 = accounts.filter(a => (a.scf || a.boal).startsWith('2') || a.boal.startsWith('81'));
let varImmoCorp = 0;
let varImmoFin = 0;
for (const a of c2) {
  const v = a.soldeCum - a.report;
  if (Math.abs(v) > 1 || Math.abs(a.debit) > 1 || Math.abs(a.credit) > 1) {
    console.log(`${a.boal.padEnd(10)} | SCF ${a.scf.padEnd(10)} | ${a.desc.slice(0, 30).padEnd(30)} | Report: ${a.report.toLocaleString('fr-FR').padStart(16)} | Solde: ${a.soldeCum.toLocaleString('fr-FR').padStart(16)} | Var: ${v.toLocaleString('fr-FR').padStart(16)}`);
    if ((a.scf || a.boal).startsWith('27') || a.desc.toLowerCase().includes('caution')) {
      varImmoFin += v;
    } else if (!(a.scf || a.boal).startsWith('28')) { // exclude amortissements
      varImmoCorp += v;
    }
  }
}
console.log(`Variation Immobilisations Corp/Incorp (Brut): ${varImmoCorp.toLocaleString('fr-FR')} DA`);
console.log(`Variation Immobilisations Financières (Cautions): ${varImmoFin.toLocaleString('fr-FR')} DA`);

console.log('\n--- COMPTE 457 (DIVIDENDES) / 45 ---');
const c45 = accounts.filter(a => (a.scf || a.boal).startsWith('45'));
for (const a of c45) {
  console.log(`${a.boal.padEnd(10)} | SCF ${a.scf.padEnd(10)} | ${a.desc.slice(0, 30).padEnd(30)} | Report: ${a.report.toLocaleString('fr-FR').padStart(16)} | Solde: ${a.soldeCum.toLocaleString('fr-FR').padStart(16)}`);
}

console.log('\n--- ÉCARTS DE CHANGE / DEVISES (666 / 766) ---');
const cChange = accounts.filter(a => (a.scf || a.boal).startsWith('666') || (a.scf || a.boal).startsWith('766') || a.desc.toLowerCase().includes('change'));
for (const a of cChange) {
  console.log(`${a.boal.padEnd(10)} | SCF ${a.scf.padEnd(10)} | ${a.desc.slice(0, 30).padEnd(30)} | Solde: ${a.soldeCum.toLocaleString('fr-FR').padStart(16)}`);
}
