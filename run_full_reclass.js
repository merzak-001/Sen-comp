const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

console.log(`Loaded ${rows.length} rows from FBL3N.`);

// Load retunie (account 19710001)
let retunieRows = [];
try {
  const wbR = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/retunie.xlsx');
  retunieRows = XLSX.utils.sheet_to_json(wbR.Sheets[wbR.SheetNames[0]]);
} catch (e) {}

// Load debours (account 17300015)
let deboursRows = [];
try {
  const wbD = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/debours.xlsx');
  deboursRows = XLSX.utils.sheet_to_json(wbD.Sheets[wbD.SheetNames[0]]);
} catch (e) {}

const months = ['2026/01', '2026/02', '2026/03', '2026/04', '2026/05', '2026/06', '2026/07', '2026/08', '2026/09', '2026/10'];

// Process monthly results
const monthlyResults = months.map(ym => {
  const mRows = rows.filter(r => String(r['Année/Mois'] || '').trim() === ym);
  
  // Note 401: Encaissements clients
  // Gross credits on 14000010 + 14000030 + advances 14060016 minus client retentions 19610003
  let c401_gross = 0;
  let c401_retention = 0;
  let c401_advances = 0;
  let c401_creditNotes = 0;

  // Note 402: Fournisseurs
  let c402_local = 0;
  let c402_foreign = 0;
  let c402_transit = 0;
  let c402_retention = 0;

  // Note 403: Personnel
  let c403_salaries = 0;
  let c403_cnas = 0;
  let c403_irg = 0;
  let c403_fraisMission = 0;

  // Note 404: Frais financiers
  let c404_agios = 0;

  // Note 405: Impots
  let c405_g50_net = 0;
  let c405_apprentissage = 0;
  let c405_ibs = 0;

  // Note 410: Capex
  let c410_capex = 0;

  // Note 412: Cautions versées
  let c412_cautions = 0;

  // Note 413: Restitution cautions
  let c413_restitutions = 0;

  // Note 419: Dividendes
  let c419_dividendes = 0;

  // Note 423: Variation de change
  let c423_change = 0;

  mRows.forEach(r => {
    const acct = String(r['Compte'] || '').trim();
    const cpart = String(r['Compte contrepartie'] || '').trim();
    const docType = String(r['Type de pièce'] || '').trim();
    const debit = Number(r['Débit']) || 0;
    const credit = Number(r['Crédit']) || 0;
    const amt = Number(r['Montant en devise interne']) || 0;
    const text = String(r['Texte'] || '').toUpperCase();

    // 401 - Clients (account 14000010 / 14000030 credit)
    if (['14000010', '14000030'].includes(acct)) {
      if (['DZ', 'ZP'].includes(docType) && amt < 0) {
        c401_gross += Math.abs(amt);
      } else if (['AB', 'RV'].includes(docType) && amt > 0) {
        c401_creditNotes += amt;
      }
    }
    // Avances clients 14060016
    if (acct === '14060016' && amt < 0 && ['DZ', 'ZP'].includes(docType)) {
      c401_advances += Math.abs(amt);
    }
    // Client guarantee retention 19610003
    if (acct === '19610003' && amt > 0) {
      c401_retention += amt;
    }

    // 403 - Personnel: 17300228 (Virements salaires)
    if (acct === '17300228' && amt > 0 && docType === 'ZP') {
      c403_salaries += amt;
    }
    // 17760022 (CNAS)
    if (acct === '17760022' && amt > 0 && docType === 'ZP') {
      c403_cnas += amt;
    }
    // 17300225 (Frais de mission)
    if (acct === '17300225' && amt > 0) {
      c403_fraisMission += amt;
    }

    // 404 - Frais financiers: 44010110, 44010114, 26020100
    if (['44010110', '44010114', '26020100'].includes(acct) && amt > 0 && docType === 'ZP') {
      c404_agios += amt;
    }

    // 405 - Impôts: 17460003 (G50), 17470126 (Taxe apprentissage), 17800004 (IBS)
    if (acct === '17460003' && amt > 0 && docType === 'ZP') {
      c405_g50_net += amt;
    }
    if (acct === '17470126' && amt > 0 && docType === 'ZP') {
      c405_apprentissage += amt;
    }
    if (acct === '17800004' && amt > 0) {
      c405_ibs += amt;
    }

    // 412 - Cautions versées (17110102)
    if (acct === '17110102' && amt > 0 && docType === 'ZP') {
      c412_cautions += amt;
    }
    // 413 - Cautions restituées (17110102)
    if (acct === '17110102' && amt < 0 && docType === 'DZ') {
      c413_restitutions += Math.abs(amt);
    }

    // 419 - Dividendes
    if (text.includes('DIVIDEN') && amt > 0) {
      c419_dividendes += amt;
    }

    // 402 - Fournisseurs: 15200003 (Règlements CPA/BEA)
    if (acct === '15200003' && amt > 0 && docType === 'ZP') {
      c402_local += amt;
    }
    // 16010800 / 16000010 (Fournisseurs étrangers / import)
    if (acct === '16010800' && amt > 0 && docType === 'KZ') {
      c402_foreign += amt;
    }
    // Debours transit 17300015
    if (acct === '17300015' && amt > 0 && ['ZP', 'KZ'].includes(docType)) {
      c402_transit += amt;
    }
  });

  const note401 = c401_gross + c401_advances - c401_retention - c401_creditNotes;
  const note402 = -(c402_local + c402_foreign + c402_transit - c402_retention);
  const note403 = -(c403_salaries + c403_cnas + c403_irg + c403_fraisMission);
  const note404 = -c404_agios;
  const note405 = -(c405_g50_net + c405_apprentissage + c405_ibs);

  return {
    month: ym,
    note401,
    details401: { gross: c401_gross, adv: c401_advances, ret: c401_retention, avoirs: c401_creditNotes },
    note402,
    details402: { local: c402_local, foreign: c402_foreign, transit: c402_transit },
    note403,
    details403: { sal: c403_salaries, cnas: c403_cnas, irg: c403_irg },
    note404,
    note405,
    details405: { g50: c405_g50_net, apprentissage: c405_apprentissage, ibs: c405_ibs }
  };
});

console.log('\n--- 2026 MONTHLY COMPUTATIONS (RAW RECLASSIFIED) ---');
monthlyResults.forEach(r => {
  console.log(`\n=== ${r.month} ===`);
  console.log(`401 Clients       : ${r.note401.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)} (Gross:${r.details401.gross.toLocaleString('fr-FR')} | Ret:${r.details401.ret.toLocaleString('fr-FR')})`);
  console.log(`402 Fournisseurs  : ${r.note402.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)} (Loc:${r.details402.local.toLocaleString('fr-FR')} | For:${r.details402.foreign.toLocaleString('fr-FR')} | Trans:${r.details402.transit.toLocaleString('fr-FR')})`);
  console.log(`403 Personnel     : ${r.note403.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)} (Sal:${r.details403.sal.toLocaleString('fr-FR')} | CNAS:${r.details403.cnas.toLocaleString('fr-FR')})`);
  console.log(`404 Frais Fin.    : ${r.note404.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)}`);
  console.log(`405 Impots        : ${r.note405.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)} (G50:${r.details405.g50.toLocaleString('fr-FR')} | Apprent:${r.details405.apprentissage.toLocaleString('fr-FR')})`);
});
