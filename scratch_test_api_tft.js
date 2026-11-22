(async () => {
  try {
    const res = await fetch('http://localhost:50/api/tft?year=2026');
    const data = await res.json();
    console.log('--- TFT 2026 API OUTPUT ---');
    console.log('Equilibre Status:', data.tft.kpis.equilibre, '| Diff:', data.tft.kpis.diffEquilibre);
    
    const notes = ['401', '402', '403', '404', '405', '408', '410', '412', '413', '416', '419', '423', '422', '424', '425', '426', '427'];
    
    console.log('\nRow  | Label                               | May (M5)        | Sep (M9)        | Total');
    console.log('-----|-------------------------------------|-----------------|-----------------|-----------------');
    
    notes.forEach(n => {
      const row = data.tft.rows.find(r => r.note === n);
      if (row) {
        const m5 = row.months ? Number(row.months[4]).toLocaleString('en-US', {minimumFractionDigits: 2}) : 'N/A';
        const m9 = row.months ? Number(row.months[8]).toLocaleString('en-US', {minimumFractionDigits: 2}) : 'N/A';
        const tot = row.tot !== null ? Number(row.tot).toLocaleString('en-US', {minimumFractionDigits: 2}) : 'N/A';
        console.log(`${n.padEnd(4)} | ${row.label.substring(0, 35).padEnd(35)} | ${m5.padStart(15)} | ${m9.padStart(15)} | ${tot.padStart(15)}`);
      }
    });
    process.exit(0);
  } catch(e) {
    console.error('Fetch error:', e.message);
    process.exit(1);
  }
})();
