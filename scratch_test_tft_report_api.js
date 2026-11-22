const reportingEngine = require('./reportingEngine');

(async () => {
  try {
    console.log('Testing reportingEngine.getTFTReport(2026, ALL)...');
    const res = await reportingEngine.getTFTReport('2026', 'ALL');
    const r401 = res.rows.find(r => r.note === '401');
    console.log('Row 401 label:', r401.label);
    console.log('Row 401 comment:', r401.comment);
    console.log('Row 401 months:');
    r401.months.forEach((val, idx) => {
      console.log(`  Month ${idx + 1}: ${Number(val).toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
    });
    console.log('Row 401 Total 2026:', Number(r401.tot).toLocaleString('fr-FR', {minimumFractionDigits: 2}), 'DA');

    console.log('\nTesting reportingEngine.getTFTReport(2026, 3) [March]...');
    const resM3 = await reportingEngine.getTFTReport('2026', '3');
    const r401_m3 = resM3.rows.find(r => r.note === '401');
    console.log('March 401 amount:', Number(r401_m3.valN).toLocaleString('fr-FR', {minimumFractionDigits: 2}), 'DA');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
