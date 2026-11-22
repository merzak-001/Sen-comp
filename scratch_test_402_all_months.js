const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const cert402 = [];
  for (let r = 5; r <= 35; r++) {
    const row = tftData[r];
    if (!row) continue;
    if (String(row[1] || '').trim() === '402') {
      for (let c = 2; c <= 13; c++) cert402.push(Number(row[c]) || 0);
      break;
    }
  }

  console.log('=== COMPARING SUPPLIER ACCOUNT DEBITS VS CERTIFIED ROW 402 (2025) ===\n');
  const supplAccounts = ['16000010', '16010800', '17110102', '16030110', '16000007', '15200003', '15200007'];

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;

    const rows = await sqlDb.query(`
      SELECT boal_account, scf_account, debit, credit
      FROM GeneralLedgerBalances
      WHERE period_key = '${pKey}' AND boal_account IN ('${supplAccounts.join("','")}')
    `);

    let debits = 0;
    for (const r of rows) debits += Number(r.debit || 0);

    const cert = cert402[m - 1] || 0;
    const diff = (-debits) - cert;

    console.log(`Month ${mm}/2025: Debits=${debits.toLocaleString('fr-FR', {minimumFractionDigits:2})} DA | Certified=${cert.toLocaleString('fr-FR', {minimumFractionDigits:2})} DA | Diff=${diff.toLocaleString('fr-FR', {minimumFractionDigits:2})} DA`);
  }
})();
