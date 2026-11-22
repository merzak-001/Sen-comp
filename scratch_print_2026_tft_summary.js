const reportingEngine = require('./reportingEngine');

(async () => {
  console.log('=== GENERATING OFFICIAL TFT TABLE FOR 2026 BASED ON DOWNLOADS/BALANCE ===\n');

  const rep = await reportingEngine.getTFTReport('2026', 'ALL');

  console.log('Reporting Engine Rows for 2026:\n');

  // Print all rows with note and total
  for (const r of rep.rows) {
    if (r.type === 'header') {
      console.log(`\n================== ${r.label.toUpperCase()} ==================`);
    } else {
      const noteStr = (r.note || '').padEnd(5);
      const labelStr = (r.label || '').slice(0, 45).padEnd(47);
      const totStr = Number(r.tot || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }).padStart(18);
      console.log(`${noteStr} | ${labelStr} | Total 2026: ${totStr} DA`);
    }
  }

  console.log('\n=== MONTH-BY-MONTH BREAKDOWN FOR ROW 403 (PERSONNEL) IN 2026 ===');
  const r403 = rep.rows.find(r => r.note === '403');
  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  r403.months.forEach((val, idx) => {
    console.log(`  ${MONTHS[idx].padEnd(5)} 2026: ${Number(val).toLocaleString('fr-FR', { minimumFractionDigits: 2 }).padStart(16)} DA`);
  });
  console.log(`  TOTAL 2026: ${Number(r403.tot).toLocaleString('fr-FR', { minimumFractionDigits: 2 }).padStart(16)} DA`);

  process.exit(0);
})();
