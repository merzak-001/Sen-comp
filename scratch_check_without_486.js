const sqlDb = require('./sqlDb');

(async () => {
  const accsWithout486 = [
    '17300228', '17460003', '17760022', '17300013', '17310016',
    '17570017', '17310015', '17470355', '17470303',
    '17570021', '17470301', '17470312', '17470319'
  ];

  const q = await sqlDb.query(`
    SELECT SUM(debit) as deb 
    FROM GeneralLedgerBalances 
    WHERE period_key LIKE '%2025' AND boal_account IN ('${accsWithout486.join("','")}')
  `);

  const deb = Number(q[0].deb);
  const target = 301314508.18;
  console.log('Without 17305019: ' + deb.toLocaleString('fr-FR', {minimumFractionDigits: 2}) + ' DA');
  console.log('Target          : ' + target.toLocaleString('fr-FR', {minimumFractionDigits: 2}) + ' DA');
  console.log('Difference      : ' + (deb - target).toLocaleString('fr-FR', {minimumFractionDigits: 2}) + ' DA (' + (((deb - target)/target)*100).toFixed(2) + '%)');

  process.exit(0);
})();
