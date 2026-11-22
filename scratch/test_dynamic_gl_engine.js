const sqlDb = require('../sqlDb');

async function testAllMonths() {
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  const rows = await sqlDb.query(`
    SELECT fiscal_month, doc_type, account, amount_local, text_desc, assignment, counterparty_account, doc_number, clearing_doc
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account IN ('${bankAccounts.join("','")}')
    ORDER BY fiscal_month, doc_number
  `);
  console.log('Total bank rows for 2026:', rows.length);

  const m401 = Array(12).fill(0);
  const m402 = Array(12).fill(0);
  const m403 = Array(12).fill(0);
  const m404 = Array(12).fill(0);
  const m405 = Array(12).fill(0);
  const m410 = Array(12).fill(0);
  const m412 = Array(12).fill(0);
  const m413 = Array(12).fill(0);
  const m419 = Array(12).fill(0);
  const m423 = Array(12).fill(0);

  for (const r of rows) {
    const m = (r.fiscal_month >= 1 && r.fiscal_month <= 12) ? (r.fiscal_month - 1) : 0;
    const dt = String(r.doc_type || '').toUpperCase();
    const amt = Number(r.amount_local) || 0;
    const txt = String(r.text_desc || '').toLowerCase();
    const off = String(r.counterparty_account || '');
    const doc = String(r.doc_number || '');

    if (amt > 0) {
      // Inflow
      if (dt === 'DZ') {
        m401[m] += amt;
      } else if (txt.includes('caution') || off.startsWith('196') || off.startsWith('275')) {
        m413[m] += amt;
      } else if (txt.includes('change') || txt.includes('devise') || r.account === '11867211') {
        m423[m] += amt;
      } else {
        m401[m] += amt;
      }
    } else {
      // Outflow (amt < 0)
      // Check personnel (Net salaries, CNAS, and G50 IRG check)
      if (
        txt.includes('salaire') || txt.includes('paie') || txt.includes('cnas') ||
        off.startsWith('17300228') || off.startsWith('17760022') || off.startsWith('17310121') ||
        off.startsWith('42') || off.startsWith('43') || off === '17460003'
      ) {
        m403[m] += amt;
      } else if (
        txt.includes('taxe app') || off === '17470126' || off === '17460004' ||
        off.startsWith('17800004') || off.startsWith('17760023') ||
        (txt.includes('impot') && off !== '17460003')
      ) {
        m405[m] += amt;
      } else if (dt === 'SK' || off.startsWith('4401011') || off.startsWith('26020100') || txt.includes('agios') || txt.includes('commiss')) {
        m404[m] += amt;
      } else if (txt.includes('caution') || off.startsWith('196') || off.startsWith('275')) {
        m412[m] += amt;
      } else if (txt.includes('divid') || off.startsWith('159') || off.startsWith('457')) {
        m419[m] += amt;
      } else if (txt.includes('immo') || off.startsWith('100') || off.startsWith('21')) {
        m410[m] += amt;
      } else if (txt.includes('change') || txt.includes('devise') || r.account === '11867211') {
        m423[m] += amt;
      } else {
        m402[m] += amt;
      }
    }
  }

  console.log('\n--- COMPARISON FOR MONTH 9 (SEPTEMBER 2026) ---');
  console.log('Target 401:', 210951817.50, ' | Calculated:', m401[8], ' | Diff:', m401[8] - 210951817.50);
  console.log('Target 402:', -164882135.60, ' | Calculated:', m402[8], ' | Diff:', m402[8] - (-164882135.60));
  console.log('Target 403:', -16619584.21, ' | Calculated:', m403[8], ' | Diff:', m403[8] - (-16619584.21));
  console.log('Target 404:', -276581.48, ' | Calculated:', m404[8], ' | Diff:', m404[8] - (-276581.48));
  console.log('Target 405:', -985249.00, ' | Calculated:', m405[8], ' | Diff:', m405[8] - (-985249.00));
  console.log('Target 412:', -353563.87, ' | Calculated:', m412[8], ' | Diff:', m412[8] - (-353563.87));

  console.log('\n--- ALL 12 MONTHS SUMMARY ---');
  for (let i = 0; i < 12; i++) {
    console.log(`M${i+1}: 401=${m401[i].toFixed(2)} | 402=${m402[i].toFixed(2)} | 403=${m403[i].toFixed(2)} | 404=${m404[i].toFixed(2)} | 405=${m405[i].toFixed(2)}`);
  }
}

testAllMonths();
