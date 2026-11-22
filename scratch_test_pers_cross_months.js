const sqlDb = require('./sqlDb');

(async () => {
  const pKeys = ['012025', '022025', '122025'];
  const targets = {
    '012025': 16413689.20,
    '022025': 16777848.10,
    '122025': 18698570.82
  };

  const persAccounts = [
    '17300228', // Salaires nets
    '17460003', // IRG sur salaires
    '17760022', // Cotisations patronales CNAS
    '17310016', // Cotisation retraite CNAS
    '17310015', // Cotisation accident CNAS
    '17300013', // Charges à payer personnel
    '17570017', // Congés payés
    '17305019', // Charges constatées personnel
    '17470355', // Oeuvre sociale
    '17470303', // Retenues
    '17570021', // Contribution logement
    '17470301', // Retenues
    '17470312', // Retenues assurances
    '17470319', // Retenues mariage
    '17470311', // Muteg
    '17470313', // Fonds d'aide
    '17470308', // Retenues
    '17470306', // Retenues
    '17470302', // Retenues
    '17470320', // Prêt spécial
    '17470322', // Frais
    '17570002', // Acomptes
    '17570020'  // Retraite anticipée
  ];

  for (const p of pKeys) {
    const rows = await sqlDb.query(`SELECT boal_account, debit FROM GeneralLedgerBalances WHERE period_key = '${p}'`);
    let sum = 0;
    for (const a of persAccounts) {
      const r = rows.find(x => x.boal_account === a);
      if (r) sum += Number(r.debit || 0);
    }
    console.log(`Period ${p}: Sum=${sum.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Target=${targets[p].toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Diff=${(sum - targets[p]).toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
  }
})();
