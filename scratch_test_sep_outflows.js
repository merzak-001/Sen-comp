const sqlDb = require('./sqlDb');

(async () => {
  // Check month 9 (September 2026) GL rows for bank disbursements
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  const rows = await sqlDb.query(`
    SELECT doc_type, account, counterparty_account, amount_local, text_desc
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 9 AND account IN ('11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200')
    ORDER BY doc_number
  `);

  console.log('September 2026 bank rows count:', rows.length);
  const outflows = rows.filter(r => r.amount_local < 0);
  console.log('Total bank outflows in Sep 2026:', outflows.reduce((a, r) => a + r.amount_local, 0));

  // Let's test Row 404: Financial charges in Sep 2026
  const r404 = outflows.filter(r => {
    const txt = String(r.text_desc || '').toLowerCase();
    const off = String(r.counterparty_account || '');
    const dt = String(r.doc_type || '').toUpperCase();
    return dt === 'SK' || off.startsWith('4401011') || off.startsWith('26020100') || txt.includes('agios') || txt.includes('commiss') || txt.includes('frais') || txt.includes('tenue');
  });
  console.log('Sep 2026 Row 404 sum:', r404.reduce((a, r) => a + r.amount_local, 0), '| Target: -276581.48');

  // Let's test Row 403: Personnel in Sep 2026
  const r403 = outflows.filter(r => {
    const txt = String(r.text_desc || '').toLowerCase();
    const off = String(r.counterparty_account || '');
    return txt.includes('salaire') || txt.includes('paie') || txt.includes('cnas') ||
      off.startsWith('17300228') || off.startsWith('17760022') || off.startsWith('17310121') ||
      off.startsWith('42') || off.startsWith('43') || off === '17460003';
  });
  console.log('Sep 2026 Row 403 sum:', r403.reduce((a, r) => a + r.amount_local, 0), '| Target: -16619584.21');

  // Let's test Row 405: Impôts in Sep 2026
  const r405 = outflows.filter(r => {
    const txt = String(r.text_desc || '').toLowerCase();
    const off = String(r.counterparty_account || '');
    return txt.includes('taxe app') || off === '17470126' || off === '17460004' ||
      off.startsWith('17800004') || off.startsWith('17760023') ||
      (txt.includes('impot') && off !== '17460003') ||
      txt.includes('irg') || txt.includes('tap') || txt.includes('tva') || txt.includes('ibs') ||
      off.startsWith('174') || off.startsWith('44');
  });
  console.log('Sep 2026 Row 405 sum:', r405.reduce((a, r) => a + r.amount_local, 0), '| Target: -985249.00');

  process.exit(0);
})();
