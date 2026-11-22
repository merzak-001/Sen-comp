const sqlDb = require('./sqlDb');

(async () => {
  const p2 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '022026'");
  const p3 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '032026'");

  console.log('=== DETAILED BALANCE INSPECTION FOR MONTH 03/2026 (VERSUS 02/2026) ===\n');

  // Helper
  function getDiff(boal) {
    const r2 = p2.find(x => x.boal_account === boal) || { report_initial:0, debit:0, credit:0, solde:0 };
    const r3 = p3.find(x => x.boal_account === boal) || { report_initial:0, debit:0, credit:0, solde:0 };
    return {
      boal,
      desc: r3.account_desc || r2.account_desc,
      scf: r3.scf_account || r2.scf_account,
      r2_solde: r2.solde,
      r3_solde: r3.solde,
      delta_solde: r3.solde - r2.solde,
      r2_deb: r2.debit,
      r3_deb: r3.debit,
      m_deb: r3.debit - r2.debit,
      r2_crd: r2.credit,
      r3_crd: r3.credit,
      m_crd: r3.credit - r2.credit
    };
  }

  // 1. Sales Accounts
  const s88010031 = getDiff('88010031'); // VENTES PRODUITS FINIS
  const s88010039 = getDiff('88010039'); // VENTE PRODUIT DIVERS
  const s88010053 = getDiff('88010053'); // VENTES DE MARCHANDISES
  const s88030510 = getDiff('88030510'); // VENTES EXPORT

  console.log('--- 1. SALES ACCOUNTS ---');
  console.log(s88010031.boal, s88010031.scf, s88010031.desc, 'M-Deb:', s88010031.m_deb, 'M-Crd:', s88010031.m_crd, 'Net HT:', s88010031.m_crd - s88010031.m_deb);
  console.log(s88010039.boal, s88010039.scf, s88010039.desc, 'M-Deb:', s88010039.m_deb, 'M-Crd:', s88010039.m_crd, 'Net HT:', s88010039.m_crd - s88010039.m_deb);
  console.log(s88010053.boal, s88010053.scf, s88010053.desc, 'M-Deb:', s88010053.m_deb, 'M-Crd:', s88010053.m_crd, 'Net HT:', s88010053.m_crd - s88010053.m_deb);
  console.log(s88030510.boal, s88030510.scf, s88030510.desc, 'M-Deb:', s88030510.m_deb, 'M-Crd:', s88030510.m_crd, 'Net HT:', s88030510.m_crd - s88030510.m_deb);

  // 2. Client Receivables
  const c14000010 = getDiff('14000010'); // CLIENTS DOMESTIQUES
  const c14000030 = getDiff('14000030'); // CLIENT ADE
  const c14050500 = getDiff('14050500'); // CLIENTS GROUPE / EXPORT
  const c14060016 = getDiff('14060016'); // AVANCES CLIENTS

  console.log('\n--- 2. CLIENT ACCOUNTS ---');
  console.log(c14000010.boal, c14000010.scf, c14000010.desc, 'Solde Feb:', c14000010.r2_solde, 'Solde Mar:', c14000010.r3_solde, 'Delta:', c14000010.delta_solde, 'M-Deb:', c14000010.m_deb, 'M-Crd:', c14000010.m_crd);
  console.log(c14000030.boal, c14000030.scf, c14000030.desc, 'Solde Feb:', c14000030.r2_solde, 'Solde Mar:', c14000030.r3_solde, 'Delta:', c14000030.delta_solde, 'M-Deb:', c14000030.m_deb, 'M-Crd:', c14000030.m_crd);
  console.log(c14050500.boal, c14050500.scf, c14050500.desc, 'Solde Feb:', c14050500.r2_solde, 'Solde Mar:', c14050500.r3_solde, 'Delta:', c14050500.delta_solde, 'M-Deb:', c14050500.m_deb, 'M-Crd:', c14050500.m_crd);
  console.log(c14060016.boal, c14060016.scf, c14060016.desc, 'Solde Feb:', c14060016.r2_solde, 'Solde Mar:', c14060016.r3_solde, 'Delta:', c14060016.delta_solde, 'M-Deb:', c14060016.m_deb, 'M-Crd:', c14060016.m_crd);

  // 3. TVA Collectée (SCF 4457 / BOAL 243)
  const tvaRows = p3.filter(r => (r.scf_account && r.scf_account.startsWith('4457')) || (r.boal_account && r.boal_account.startsWith('243')));
  console.log('\n--- 3. TVA COLLECTEE ACCOUNTS ---');
  tvaRows.forEach(t => {
    const td = getDiff(t.boal_account);
    console.log(td.boal, td.scf, td.desc, 'Solde Feb:', td.r2_solde, 'Solde Mar:', td.r3_solde, 'Delta:', td.delta_solde, 'M-Deb:', td.m_deb, 'M-Crd:', td.m_crd);
  });

  process.exit(0);
})();
