const sqlDb = require('./sqlDb');

(async () => {
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const q = await sqlDb.query(`SELECT debit FROM GeneralLedgerBalances WHERE period_key = '${mm}2025' AND boal_account = '17305019'`);
    console.log(`M${mm}/2025 17305019 debit:`, Number(q[0]?.debit || 0).toLocaleString('fr-FR', {minimumFractionDigits: 2}));
  }
  process.exit(0);
})();
