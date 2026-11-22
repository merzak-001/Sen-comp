const sql = require('./sqlDb');

async function run() {
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  const rows = await sql.query(`
    SELECT fiscal_month, doc_type, account, amount_local, text_desc, counterparty_account, doc_number
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account IN ('${bankAccounts.join("','")}')
    ORDER BY fiscal_month, doc_number
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
    const amt = Number(r.amount_local) || 0;
    const txt = String(r.text_desc || '').toLowerCase();
    const off = String(r.counterparty_account || '');

    // Skip internal transfer legs between our own bank accounts
    if (bankAccounts.includes(off) && dt !== 'DZ') {
      continue;
    }

    if (amt > 0) {
      // INFLOWS (Receipts / Encaissements)
      if (
        dt === 'DZ' ||
        off.startsWith('140') || // Client accounts: 14000010, 14000030, 14050500, 14060016
        txt.includes('vrt recu') ||
        txt.includes('encaissement') ||
        txt.includes('encaiss') ||
        txt.includes('ade ') ||
        txt.includes('seaal') ||
        txt.includes('seor') ||
        txt.includes('chq') ||
        txt.includes('cheque')
      ) {
        m401[m] += amt;
      } else if (txt.includes('caution') || off.startsWith('196') || off.startsWith('275')) {
        m413[m] += amt; // restitution caution reçue
      } else if (txt.includes('change') || txt.includes('devise') || r.account === '11867211') {
        m423[m] += amt;
      } else if (txt.includes('agios') || txt.includes('interet') || txt.includes('int.')) {
        m404[m] += amt;
      } else {
        // Any other positive receipt from business operations is client collections
        m401[m] += amt;
      }
    } else if (amt < 0) {
      // OUTFLOWS (Disbursements / Décaissements)
      if (
        txt.includes('salaire') || txt.includes('paie') || txt.includes('cnas') ||
        off.startsWith('17300228') || off.startsWith('17760022') || off.startsWith('17310121') ||
        off.startsWith('42') || off.startsWith('43') || off === '17460003'
      ) {
        m403[m] += amt; // Personnel
      } else if (
        txt.includes('taxe app') || off === '17470126' || off === '17460004' ||
        off.startsWith('17800004') || off.startsWith('17760023') ||
        (txt.includes('impot') && off !== '17460003') ||
        txt.includes('irg') || txt.includes('tap') || txt.includes('tva') || txt.includes('ibs') ||
        off.startsWith('174') || off.startsWith('44')
      ) {
        m405[m] += amt; // Impôts payés
      } else if (dt === 'SK' || off.startsWith('4401011') || off.startsWith('26020100') || txt.includes('agios') || txt.includes('commiss') || txt.includes('frais')) {
        m404[m] += amt; // Frais financiers
      } else if (txt.includes('divid') || off.startsWith('159') || off.startsWith('457')) {
        m419[m] += amt; // Dividendes
      } else if (txt.includes('immo') || off.startsWith('100') || off.startsWith('21')) {
        m410[m] += amt; // Immobilisations
      } else if (txt.includes('caution') || off.startsWith('196') || off.startsWith('275')) {
        m412[m] += amt; // Cautions versées
      } else if (txt.includes('change') || txt.includes('devise') || r.account === '11867211') {
        m423[m] += amt; // Écart de change
      } else {
        m402[m] += amt; // Fournisseurs d'exploitation
      }
    }
  }

  // Display results in Dinars and KDA
  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  console.log("\n=================== 2026 TFT MONTHLY SUMMARY (in Millions DA) ===================");
  const toM = v => (v / 1000000).toFixed(2).padStart(8);
  console.log("Mois      |  Clients (401) | Fourniss (402) | Salaires (403) | Impôts (405) | Net Mois (424) | Solde Fin (426)");
  console.log("-----------------------------------------------------------------------------------------------------------");
  let runningCash = 1366395095.47;
  for (let m = 0; m < 10; m++) {
    const netM = m401[m] + m402[m] + m403[m] + m404[m] + m405[m] + m410[m] + m412[m] + m413[m] + m419[m] + m423[m];
    runningCash += netM;
    console.log(
      `${MONTHS[m].padEnd(10)}| ` +
      `${toM(m401[m])} M | ` +
      `${toM(m402[m])} M | ` +
      `${toM(m403[m])} M | ` +
      `${toM(m405[m])} M | ` +
      `${toM(netM)} M | ` +
      `${toM(runningCash)} M`
    );
  }

  process.exit(0);
}
run();
