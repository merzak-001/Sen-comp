const sqlDb = require('./sqlDb');

(async () => {
  const p3 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '032025'");
  const p2 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '022025'");

  console.log('Total accounts in 032025:', p3.length);

  // Let's list all accounts where debit !== 0 OR credit !== 0 OR (solde - prevSolde) !== 0
  const active = [];
  p3.forEach(r => {
    const r2 = p2.find(x => x.boal_account === r.boal_account) || { solde:0, debit:0, credit:0 };
    const dSolde = Number(r.solde || 0) - Number(r2.solde || 0);
    const deb = Number(r.debit || 0);
    const crd = Number(r.credit || 0);
    if (deb !== 0 || crd !== 0 || Math.abs(dSolde) > 0.001) {
      active.push({
        boal: r.boal_account,
        scf: r.scf_account,
        desc: r.account_desc,
        deb,
        crd,
        dSolde
      });
    }
  });

  console.log('Active accounts in 032025:', active.length);
  // Let's filter accounts related to taxes, timbre, charges, clients, sales
  const relevant = active.filter(a => 
    a.boal.startsWith('14') || a.boal.startsWith('88') || a.boal.startsWith('17') || 
    a.scf.startsWith('41') || a.scf.startsWith('70') || a.scf.startsWith('44') ||
    a.scf.startsWith('64') || a.desc.includes('TIMBRE') || a.desc.includes('TAXE') ||
    a.desc.includes('CLIENT') || a.desc.includes('VENTE') || a.desc.includes('ESCOMPTE') ||
    a.desc.includes('RABAIS') || a.desc.includes('AVOIR') || a.desc.includes('PERTE') || a.desc.includes('GAIN')
  );

  console.table(relevant.map(r => ({
    BOAL: r.boal,
    SCF: r.scf,
    Desc: r.desc.slice(0, 25),
    Deb: r.deb,
    Crd: r.crd,
    Delta: r.dSolde
  })));

  process.exit(0);
})();
