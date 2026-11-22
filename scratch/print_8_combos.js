const list = [
  {
    name: 'Pack 1: Exclusion du Port d Alger (13,64M) + Sensus France (7,79M)',
    excl: 13642231.00 + 7789263.94,
    desc: 'Transit portuaire douane + virement principal Sensus France',
  },
  {
    name: 'Pack 2: Exclusion du Port d Alger (13,64M) + Francar (8,06M)',
    excl: 13642231.00 + 8064608.36,
    desc: 'Transit portuaire douane + virement Francar',
  },
  {
    name: 'Pack 3: Exclusion du Port d Alger (13,64M) + Jostar 1 (6,48M)',
    excl: 13642231.00 + 6484177.47,
    desc: 'Transit portuaire douane + premier virement Jostar',
  },
  {
    name: 'Pack 4: Exclusion de la grosse facture SLR (Doc 9214: 23,52M)',
    excl: 23522432.50,
    desc: 'Gros règlement SLR considéré comme investissement ou crédit documentaire',
  },
  {
    name: 'Pack 5: Exclusion Port d Alger (13,64M) + SLR 2 (7,52M)',
    excl: 13642231.00 + 7520205.00,
    desc: 'Transit portuaire + deuxième facture SLR',
  },
  {
    name: 'Pack 6: Exclusion de Sensus France complet (10,38M) + Jostar complet (9,46M)',
    excl: 10380633.85 + 9460945.57,
    desc: 'Tous les virements Sensus France et Jostar isolés en importations',
  },
  {
    name: 'Pack 7: Exclusion Port d Alger (13,64M) + Sensus France complet (10,38M)',
    excl: 13642231.00 + 10380633.85,
    desc: 'Transit portuaire + ensemble des virements maison-mère Sensus France',
  },
  {
    name: 'Pack 8: Exclusion Port d Alger (13,64M) + Jostar complet (9,46M)',
    excl: 13642231.00 + 9460945.57,
    desc: 'Transit portuaire + ensemble des virements Jostar',
  }
];

const totalSuppliers = 74958362.20;
const r401 = 71268189.42;
const r403 = -27059991.03;
const r404 = -62642.49;
const r405 = -18649480.00;

console.log('=== 8 NOUVELLES COMBINAISONS DÉTAILLÉES ===');
list.forEach((p, idx) => {
  const r402 = -(totalSuppliers - p.excl);
  const r406 = r401 + r402 + r403 + r404 + r405;
  console.log(`\n[COMBINAISON ${idx+1}] ${p.name}`);
  console.log(`  Description: ${p.desc} (Total reclassé: ${p.excl.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA)`);
  console.log(`  401: ${r401.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  402: ${r402.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  403: ${r403.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  404: ${r404.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  405: ${r405.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  406: ${r406.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
});
