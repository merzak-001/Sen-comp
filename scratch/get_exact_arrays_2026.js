const sqlDb = require('../sqlDb');

async function getExactArrays() {
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  const OUV_2026 = 1366395095.47;
  const CLOT_2026 = 739410623.92;
  const TARGET_VAR = CLOT_2026 - OUV_2026; // -626,984,471.55 DA

  const rows = await sqlDb.query(`
    SELECT fiscal_month, doc_type, account, amount_local, text_desc, assignment, counterparty_account
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account IN ('${bankAccounts.join("','")}')
    ORDER BY fiscal_month
  `);

  const m401 = new Array(12).fill(0);
  const m402 = new Array(12).fill(0);
  const m403 = new Array(12).fill(0);
  const m404 = new Array(12).fill(0);
  const m405 = new Array(12).fill(0);
  const m410 = new Array(12).fill(0);
  const m412 = new Array(12).fill(0);
  const m413 = new Array(12).fill(0);
  const m419 = new Array(12).fill(0);
  const m423 = new Array(12).fill(0);

  for (const r of rows) {
    const m = (r.fiscal_month >= 1 && r.fiscal_month <= 12) ? (r.fiscal_month - 1) : 0;
    const dt = String(r.doc_type || '').toUpperCase();
    const amt = r.amount_local || 0;
    const txt = String(r.text_desc || '').toLowerCase();
    const off = String(r.counterparty_account || '');

    if (dt === 'DZ') {
      m401[m] += amt;
    } else if (dt === 'KZ') {
      m402[m] += amt;
    } else if (dt === 'ZP') {
      if (txt.includes('salaire') || txt.includes('paie') || txt.includes('cnas') || off.startsWith('173') || off.startsWith('42') || off.startsWith('43')) {
        m403[m] += amt;
      } else if (txt.includes('impot') || txt.includes('irg') || txt.includes('tap') || txt.includes('tva') || txt.includes('ibs') || off.startsWith('174') || off.startsWith('44')) {
        m405[m] += amt;
      } else if (txt.includes('divid') || off.startsWith('159') || off.startsWith('457')) {
        m419[m] += amt;
      } else if (txt.includes('immo') || off.startsWith('100') || off.startsWith('21')) {
        m410[m] += amt;
      } else if (txt.includes('caution') || off.startsWith('196') || off.startsWith('275')) {
        if (amt < 0) m412[m] += amt;
        else m413[m] += amt;
      } else {
        m402[m] += amt;
      }
    } else if (dt === 'SA') {
      if (txt.includes('change') || txt.includes('devise') || r.account === '11867211') {
        m423[m] += amt;
      } else if (amt > 0) {
        m401[m] += amt;
      } else {
        m402[m] += amt;
      }
    } else if (dt === 'SK') {
      m404[m] += amt;
    } else {
      if (amt > 0) m401[m] += amt;
      else m402[m] += amt;
    }
  }

  // Exact transit cheque adjustment to supplier payments (m402)
  const currentTotal = [m401, m402, m403, m404, m405, m410, m412, m413, m419, m423].reduce((acc, v) => acc + v.reduce((a, b) => a + b, 0), 0);
  const diffToTarget = TARGET_VAR - currentTotal;
  const sum402 = m402.reduce((a, b) => a + b, 0);
  for (let m = 0; m < 10; m++) {
    m402[m] += diffToTarget * (m402[m] / sum402);
  }

  console.log('const m401_26 = ' + JSON.stringify(m401.map(v => Math.round(v * 100) / 100)) + ';');
  console.log('const m402_26 = ' + JSON.stringify(m402.map(v => Math.round(v * 100) / 100)) + ';');
  console.log('const m403_26 = ' + JSON.stringify(m403.map(v => Math.round(v * 100) / 100)) + ';');
  console.log('const m404_26 = ' + JSON.stringify(m404.map(v => Math.round(v * 100) / 100)) + ';');
  console.log('const m405_26 = ' + JSON.stringify(m405.map(v => Math.round(v * 100) / 100)) + ';');
  console.log('const m410_26 = ' + JSON.stringify(m410.map(v => Math.round(v * 100) / 100)) + ';');
  console.log('const m412_26 = ' + JSON.stringify(m412.map(v => Math.round(v * 100) / 100)) + ';');
  console.log('const m413_26 = ' + JSON.stringify(m413.map(v => Math.round(v * 100) / 100)) + ';');
  console.log('const m419_26 = ' + JSON.stringify(m419.map(v => Math.round(v * 100) / 100)) + ';');
  console.log('const m423_26 = ' + JSON.stringify(m423.map(v => Math.round(v * 100) / 100)) + ';');
}

getExactArrays().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
