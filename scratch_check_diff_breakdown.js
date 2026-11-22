const sqlDb = require('./sqlDb');

(async () => {
  const p3 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '032025'");
  const p2 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '022025'");

  const target = 242430317.89;
  const rawCalc = 242444112.07;
  const diff = rawCalc - target;

  console.log('Target:', target);
  console.log('Raw Calc:', rawCalc);
  console.log('Difference:', diff); // 13,794.18

  // Check Gains de change debit: 13531.21
  const gdc = p3.find(r => r.boal_account === '21040102');
  console.log('Gains de change (21040102) Debit:', gdc ? gdc.debit : 0);
  console.log('Difference - GDC Debit:', diff - (gdc ? gdc.debit : 0)); // 262.97

  // Check if there is an account with 262.97 or 270 (retention frais)
  p3.forEach(r => {
    ['debit', 'credit', 'solde'].forEach(c => {
      const v = Math.abs(Number(r[c] || 0));
      if (Math.abs(v - 262.97) < 10 || Math.abs(v - diff) < 10) {
        console.log(`Small match in ${r.boal_account} ${r.account_desc} [${c}]: ${v}`);
      }
    });
  });

  process.exit(0);
})();
