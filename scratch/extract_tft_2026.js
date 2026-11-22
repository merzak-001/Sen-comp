const sqlDb = require('../sqlDb');

async function extractTFT2026Breakdown() {
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];

  const rows = await sqlDb.query(`
    SELECT fiscal_month, doc_type, account, amount_local, text_desc, assignment, counterparty_account
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account IN ('${bankAccounts.join("','")}')
    ORDER BY fiscal_month
  `);
  console.log(`Loaded ${rows.length} bank line items for 2026.`);

  const m401 = new Array(12).fill(0); // Clients (DZ)
  const m402 = new Array(12).fill(0); // Fournisseurs (KZ, ZP)
  const m403 = new Array(12).fill(0); // Personnel
  const m404 = new Array(12).fill(0); // Frais financiers
  const m405 = new Array(12).fill(0); // Impôts
  const m410 = new Array(12).fill(0); // Immo
  const m412 = new Array(12).fill(0); // Cautions -
  const m413 = new Array(12).fill(0); // Cautions +
  const m419 = new Array(12).fill(0); // Dividendes
  const m423 = new Array(12).fill(0); // Change

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

  console.log('\n--- EXTRACTED TOTALS FOR 2026 (JAN - OCT) ---');
  console.log('Note 401 (Clients)    :', m401.reduce((a, b) => a + b, 0).toLocaleString('fr-FR'), 'DA');
  console.log('Note 402 (Fourn)      :', m402.reduce((a, b) => a + b, 0).toLocaleString('fr-FR'), 'DA');
  console.log('Note 403 (Paie)       :', m403.reduce((a, b) => a + b, 0).toLocaleString('fr-FR'), 'DA');
  console.log('Note 404 (Agios)      :', m404.reduce((a, b) => a + b, 0).toLocaleString('fr-FR'), 'DA');
  console.log('Note 405 (Impôts)     :', m405.reduce((a, b) => a + b, 0).toLocaleString('fr-FR'), 'DA');
  console.log('Note 410 (Immo)       :', m410.reduce((a, b) => a + b, 0).toLocaleString('fr-FR'), 'DA');
  console.log('Note 412 (Cautions -) :', m412.reduce((a, b) => a + b, 0).toLocaleString('fr-FR'), 'DA');
  console.log('Note 413 (Cautions +) :', m413.reduce((a, b) => a + b, 0).toLocaleString('fr-FR'), 'DA');
  console.log('Note 419 (Dividendes) :', m419.reduce((a, b) => a + b, 0).toLocaleString('fr-FR'), 'DA');
  console.log('Note 423 (Change)     :', m423.reduce((a, b) => a + b, 0).toLocaleString('fr-FR'), 'DA');

  const totalVar = [m401, m402, m403, m404, m405, m410, m412, m413, m419, m423].reduce((acc, v) => acc + v.reduce((a, b) => a + b, 0), 0);
  console.log('\nTOTAL NET VARIATION CALCULATED:', totalVar.toLocaleString('fr-FR'), 'DA');
  console.log('OPENING CASH (01/01/2026)     : 1 366 395 095,47 DA');
  console.log('CLOSING CASH CALCULATED       :', (1366395095.47 + totalVar).toLocaleString('fr-FR'), 'DA');
  console.log('REAL SAP BALANCE CLOSING      : 739 410 623,92 DA');

  console.log('\n--- MONTHLY VECTORS (MONTHS 1 TO 10) ---');
  for (let i = 0; i < 10; i++) {
    console.log(`Mois ${i+1}: 401=${m401[i].toFixed(2)}, 402=${m402[i].toFixed(2)}, 403=${m403[i].toFixed(2)}, 404=${m404[i].toFixed(2)}, 405=${m405[i].toFixed(2)}`);
  }
}

extractTFT2026Breakdown().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
