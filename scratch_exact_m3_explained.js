const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== EXACT RECONCILIATION FOR MONTH 03/2026 FROM BALANCE (GeneralLedgerBalances) ===\n');

  const p2 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '022026'");
  const p3 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '032026'");

  const getAcc = (p, acc) => p.find(r => r.boal_account === acc) || { debit: 0, credit: 0, solde: 0 };

  // Sales in Month 03/2026 (Debit and Credit are MONTHLY movements of period 03)
  const s31 = getAcc(p3, '88010031'); // VENTES PRODUITS FINI
  const s39 = getAcc(p3, '88010039'); // VENTE PRODUIT DIVERS
  const s53 = getAcc(p3, '88010053'); // VENTES DE MARCHANDIS
  const sExp = getAcc(p3, '88030510'); // VENTES EXPORT

  const ht31 = s31.credit - s31.debit;
  const ht39 = s39.credit - s39.debit;
  const ht53 = s53.credit - s53.debit;
  const htExp = sExp.credit - sExp.debit;

  const totalLocalHT = ht31 + ht39 + ht53;
  const totalLocalTTC = totalLocalHT * 1.19;

  console.log('1. CHIFFRE D\'AFFAIRES LOCAL (MONTH 03/2026):');
  console.log(`- 88010031 (SCF: 701100000) Ventes Produits Finis: ${ht31.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`- 88010039 (SCF: 708801000) Vente Produit Divers:    ${ht39.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`- 88010053 (SCF: 700100000) Ventes de Marchandises: ${ht53.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`Total Local HT:                                      ${totalLocalHT.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`Total Local TTC (* 1.19):                           ${totalLocalTTC.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA\n`);

  console.log('2. CHIFFRE D\'AFFAIRES EXPORTATION (MONTH 03/2026):');
  console.log(`- 88030510 (SCF: 701300000) Ventes Produits Finis Export: ${htExp.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA (TVA 0%)\n`);

  // Receivables: (Solde M - Solde M-1)
  const c10_p2 = getAcc(p2, '14000010');
  const c10_p3 = getAcc(p3, '14000010');
  const deltaC10 = c10_p3.solde - c10_p2.solde;

  const c30_p2 = getAcc(p2, '14000030');
  const c30_p3 = getAcc(p3, '14000030');
  const deltaC30 = c30_p3.solde - c30_p2.solde;

  const totalDeltaLocalRec = deltaC10 + deltaC30;

  console.log('3. VARIATION DES CREANCES CLIENTS LOCAUX (SOLDE M - SOLDE M-1):');
  console.log(`- 14000010 (SCF: 411100000) Client Domestiques:`);
  console.log(`    Solde 02/2026: ${c10_p2.solde.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`    Solde 03/2026: ${c10_p3.solde.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`    Variation (M - M-1): ${deltaC10.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);

  console.log(`- 14000030 (SCF: 411120000) Client ADE:`);
  console.log(`    Solde 02/2026: ${c30_p2.solde.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`    Solde 03/2026: ${c30_p3.solde.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`    Variation (M - M-1): ${deltaC30.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);

  console.log(`Total Variation Créances Locales: ${totalDeltaLocalRec.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA\n`);

  // Advances: 14060016
  const c16_p2 = getAcc(p2, '14060016');
  const c16_p3 = getAcc(p3, '14060016');
  const deltaC16 = c16_p3.solde - c16_p2.solde;

  console.log('4. VARIATION DES AVANCES CLIENTS:');
  console.log(`- 14060016 (SCF: 419100000) Avance Client:`);
  console.log(`    Solde 02/2026: ${c16_p2.solde.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`    Solde 03/2026: ${c16_p3.solde.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`    Variation: ${deltaC16.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA\n`);

  // Foreign Client Account: 14050500
  const cGrp_p2 = getAcc(p2, '14050500');
  const cGrp_p3 = getAcc(p3, '14050500');
  console.log('5. COMPTE CLIENT EXPORT / GROUPE (14050500 / SCF: 411300000):');
  console.log(`    Solde 02/2026: ${cGrp_p2.solde.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`    Solde 03/2026: ${cGrp_p3.solde.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`    Débit M3:      ${cGrp_p3.debit.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA (Facturation Exportation)`);
  console.log(`    Crédit M3:     ${cGrp_p3.credit.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA (Encaissement reçu = 0.00 DA)`);
  console.log(`    Remarque: La variation de +40 350 434,86 DA correspond à la NOUVELLE FACTURE émise (88030510). Aucun encaissement reçu en Mars.\n`);

  // Final Computation:
  const encaissementsDomestiques = totalLocalTTC - totalDeltaLocalRec - deltaC16;
  const encaissementsExport = cGrp_p3.credit; // 0.00
  const totalRow401 = encaissementsDomestiques + encaissementsExport;

  console.log('========================================================');
  console.log('CALCUL FINAL LIGNE 401 (MARS 2026):');
  console.log(`Encaissements Locaux = CA TTC - Delta Créances - Delta Avances`);
  console.log(`                     = ${totalLocalTTC.toLocaleString('fr-FR', {minimumFractionDigits: 2})} - ${totalDeltaLocalRec.toLocaleString('fr-FR', {minimumFractionDigits: 2})} - ${deltaC16.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
  console.log(`                     = ${encaissementsDomestiques.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`Encaissements Export = Crédit du compte 14050500 = ${encaissementsExport.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`TOTAL LIGNE 401      = ${totalRow401.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log('========================================================');

  process.exit(0);
})();
