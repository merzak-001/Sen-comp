const reportingEngine = require('./reportingEngine');

(async () => {
  const r25 = await reportingEngine.getTFTReport('2025', 'ALL');
  const row403 = r25.rows.find(x => x.note === '403');
  console.log('Row 403 Total 2025:', row403.tot);
  console.log('Row 403 Months 2025:', row403.months);

  const r26 = await reportingEngine.getTFTReport('2026', 'ALL');
  const row403_26 = r26.rows.find(x => x.note === '403');
  console.log('\nRow 403 Total 2026:', row403_26.tot);
  console.log('Row 403 Months 2026:', row403_26.months);

  process.exit(0);
})();
