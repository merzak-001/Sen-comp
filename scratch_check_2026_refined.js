const sqlDb = require('./sqlDb');

(async () => {
  const accsWithout486 = [
    '17300228', '17460003', '17760022', '17300013', '17310016',
    '17570017', '17310015', '17470355', '17470303',
    '17570021', '17470301', '17470312', '17470319'
  ];

  console.log('=== ROW 403 IN 2026 WITH REFINED GENERAL FORMULA ===');
  let tot2026 = 0;
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2026`;
    const q = await sqlDb.query(`
      SELECT SUM(debit) as deb 
      FROM GeneralLedgerBalances 
      WHERE period_key = '${pKey}' AND boal_account IN ('${accsWithout486.join("','")}')
    `);
    const deb = Number(q[0]?.deb || 0);
    tot2026 += deb;
    console.log(`Month ${mm}/2026: ${deb.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  }
  console.log('\nTotal 2026 Row 403: ' + tot2026.toLocaleString('fr-FR', {minimumFractionDigits: 2}) + ' DA');
  process.exit(0);
})();
