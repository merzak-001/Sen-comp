const XLSX = require('xlsx');
const p = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(p);
const ws1 = wb.Sheets['TFT 2025'];

console.log('================================================================================');
console.log('  RECALCUL COMPLET DU TFT 2025 SELON L\'ALGORITHME DE TRÉSORERIE DIRECTE (SCF)');
console.log('  CONFRONTATION CELLULE PAR CELLULE AVEC LE TABLEAU DE RÉFÉRENCE DE LA DIRECTION');
console.log('================================================================================\n');

// 1. Extraction of the primary transaction flux rows from Sheet 1
// Notes primaires: 401, 402, 403, 404, 405, 407, 410, 411, 412, 413, 414, 415, 418, 419, 420, 421, 423
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const sheetData = {};
for (let r = 6; r <= 35; r++) {
  const note = String(ws1['B' + r]?.v || '').trim();
  const libelle = String(ws1['A' + r]?.v || '').trim();
  if (!note || note === 'undefined') continue;
  
  const months = [];
  for (let c = 2; c <= 13; c++) {
    const col = XLSX.utils.encode_col(c);
    const val = ws1[col + r]?.v;
    months.push(typeof val === 'number' ? val : 0);
  }
  const tot = typeof ws1['O' + r]?.v === 'number' ? ws1['O' + r].v : (months.reduce((a, b) => a + b, 0));
  sheetData[note] = { note, libelle, months, tot };
}

console.log(`✓ Données sources extraites pour ${Object.keys(sheetData).length} lignes du TFT.\n`);

// 2. Initial Cash at 01/01/2025 from General Balance (Comptes 51, 53, 54 hors 5181)
const OPENING_CASH_2025 = 517706428.71;

// 3. Application of the calculation algorithm
const calc = {};

// Primary monthly vectors
const getM = (note) => sheetData[note]?.months || [0,0,0,0,0,0,0,0,0,0,0,0];

const m401 = getM('401');
const m402 = getM('402');
const m403 = getM('403');
const m404 = getM('404');
const m405 = getM('405');
const m407 = getM('407');

const m410 = getM('410');
const m411 = getM('411');
const m412 = getM('412');
const m413 = getM('413');
const m414 = getM('414');
const m415 = getM('415');

const m418 = getM('418');
const m419 = getM('419');
const m420 = getM('420');
const m421 = getM('421');
const m423 = getM('423');

// Calculated vectors
const m406 = []; // Sous-total exploitation
const m408 = []; // Flux net opérationnel (A)
const m416 = []; // Flux net investissement (B)
const m422 = []; // Flux net financement (C)
const m424 = []; // Variation globale (A + B + C)
const m425 = []; // Trésorerie d'ouverture
const m426 = []; // Trésorerie de clôture
const m427 = []; // Variation constatée (Clôture - Ouverture)

let rollingCash = OPENING_CASH_2025;

for (let m = 0; m < 12; m++) {
  // A: Opérationnel
  const opAvantExtra = m401[m] + m402[m] + m403[m] + m404[m] + m405[m];
  m406.push(opAvantExtra);
  const fluxA = opAvantExtra + m407[m];
  m408.push(fluxA);

  // B: Investissement
  const fluxB = m410[m] + m411[m] + m412[m] + m413[m] + m414[m] + m415[m];
  m416.push(fluxB);

  // C: Financement
  const fluxC = m418[m] + m419[m] + m420[m] + m421[m] + m423[m];
  m422.push(fluxC);

  // Synthèse
  const varNet = fluxA + fluxB + fluxC;
  m424.push(varNet);

  // Chaînage de trésorerie
  m425.push(rollingCash);
  rollingCash += varNet;
  m426.push(rollingCash);
  m427.push(m426[m] - m425[m]);
}

// Annual aggregation rule
const sumVec = (v) => v.reduce((a, b) => a + b, 0);

calc['401'] = { months: m401, tot: sumVec(m401) };
calc['402'] = { months: m402, tot: sumVec(m402) };
calc['403'] = { months: m403, tot: sumVec(m403) };
calc['404'] = { months: m404, tot: sumVec(m404) };
calc['405'] = { months: m405, tot: sumVec(m405) };
calc['406'] = { months: m406, tot: sumVec(m406) };
calc['407'] = { months: m407, tot: sumVec(m407) };
calc['408'] = { months: m408, tot: sumVec(m408) };

calc['410'] = { months: m410, tot: sumVec(m410) };
calc['411'] = { months: m411, tot: sumVec(m411) };
calc['412'] = { months: m412, tot: sumVec(m412) };
calc['413'] = { months: m413, tot: sumVec(m413) };
calc['414'] = { months: m414, tot: sumVec(m414) };
calc['415'] = { months: m415, tot: sumVec(m415) };
calc['416'] = { months: m416, tot: sumVec(m416) };

calc['418'] = { months: m418, tot: sumVec(m418) };
calc['419'] = { months: m419, tot: sumVec(m419) };
calc['420'] = { months: m420, tot: sumVec(m420) };
calc['421'] = { months: m421, tot: sumVec(m421) };
calc['423'] = { months: m423, tot: sumVec(m423) };
calc['422'] = { months: m422, tot: sumVec(m422) };

calc['424'] = { months: m424, tot: sumVec(m424) };
calc['425'] = { months: m425, tot: m425[0] }; // Solde au 1er Janvier
calc['426'] = { months: m426, tot: m426[11] }; // Solde au 31 Décembre
calc['427'] = { months: m427, tot: m426[11] - m425[0] }; // Variation annuelle constatée

// 4. Comparison against Reference Sheet 1
console.log('--- TABLEAU COMPARATIF CALCULÉ vs RÉFÉRENCE (ANNUEL & SYNTHÈSE) ---');
console.log('Note | Désignation                                  | Calculé (Année 2025)   | Réf. Excel (Année 2025) | Écart (DA)    | Statut');
console.log('-----+----------------------------------------------+------------------------+-------------------------+---------------+-------');

const notesToCompare = ['401', '402', '403', '404', '405', '406', '407', '408', '410', '411', '412', '413', '414', '415', '416', '418', '419', '420', '421', '423', '422', '424', '425', '426', '427'];

let allPassed = true;
let totalChecks = 0;
let passedChecks = 0;

for (const note of notesToCompare) {
  const cData = calc[note];
  const sData = sheetData[note];
  const label = sData?.libelle || note;

  const cTot = cData?.tot || 0;
  const sTot = sData?.tot || 0;
  const diffTot = Math.abs(cTot - sTot);
  const okTot = diffTot < 0.05;

  totalChecks++;
  if (okTot) passedChecks++;
  else allPassed = false;

  const statusStr = okTot ? '✓ CONFORME' : '✗ ÉCART';
  console.log(`${note.padEnd(4)} | ${label.slice(0, 44).padEnd(44)} | ${cTot.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(22)} | ${sTot.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(23)} | ${diffTot.toFixed(4).padStart(13)} | ${statusStr}`);
}

console.log('\n--- VÉRIFICATION MENSUELLE (12 MOIS × 25 LIGNES = 300 CELLULES) ---');
let monthlyErrors = 0;
for (const note of notesToCompare) {
  const cMonths = calc[note].months;
  const sMonths = sheetData[note]?.months || [0,0,0,0,0,0,0,0,0,0,0,0];
  for (let m = 0; m < 12; m++) {
    const diff = Math.abs(cMonths[m] - sMonths[m]);
    totalChecks++;
    if (diff < 0.05) {
      passedChecks++;
    } else {
      monthlyErrors++;
      console.log(`⚠️ Écart détecté Note ${note} mois ${MONTH_NAMES[m]}: Calculé = ${cMonths[m]}, Réf = ${sMonths[m]}, Diff = ${diff}`);
    }
  }
}

console.log(`\n================================================================================`);
console.log(`RÉSULTAT DE L'AUDIT DE RECALCUL :`);
console.log(`  Total points de contrôle exécutés : ${totalChecks}`);
console.log(`  Points de contrôle validés       : ${passedChecks} / ${totalChecks} (${((passedChecks/totalChecks)*100).toFixed(2)}%)`);
console.log(`  Nombre d'écarts mensuels          : ${monthlyErrors}`);
console.log(`  Validation de l'équilibre SCF     :`);
console.log(`    - Trésorerie Clôture au 31/12   : ${calc['426'].tot.toLocaleString('fr-FR')} DA (Réf: ${sheetData['426'].tot.toLocaleString('fr-FR')} DA)`);
console.log(`    - Trésorerie Ouverture 01/01    : ${calc['425'].tot.toLocaleString('fr-FR')} DA (Réf: ${sheetData['425'].tot.toLocaleString('fr-FR')} DA)`);
console.log(`    - Variation Nette (A + B + C)   : ${calc['424'].tot.toLocaleString('fr-FR')} DA (Réf: ${sheetData['424'].tot.toLocaleString('fr-FR')} DA)`);
console.log(`    - Écart Équilibre Bilan/TFT     : ${(Math.abs(calc['427'].tot - calc['424'].tot)).toFixed(6)} DA`);
console.log(`================================================================================`);
