const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  // Load certified 2025 TFT sheet for benchmark
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const cert = {};
  for (let r = 5; r <= 33; r++) {
    const row = tftData[r];
    if (!row) continue;
    const code = String(row[1] || '').trim();
    if (!code) continue;
    cert[code] = [];
    for (let c = 2; c <= 13; c++) cert[code].push(Number(row[c]) || 0);
  }

  // Let's inspect Month 1 (012025)
  // Let's see the movements of:
  // 1. Clients: accounts starting with 411 or 140
  const clients = await sqlDb.query("SELECT boal_account, scf_account, account_desc, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '012025' AND (scf_account LIKE '411%' OR scf_account LIKE '418%' OR boal_account LIKE '140%')");
  console.log('Client accounts in M1 (012025):');
  clients.forEach(c => console.log(`${c.boal_account} | ${c.scf_account} | ${c.account_desc} | deb:${c.debit} | cred:${c.credit} | solde:${c.solde}`));
  const totClientCredit = clients.reduce((sum, c) => sum + c.credit, 0);
  console.log('Total Client Credit in M1:', totClientCredit, 'vs Cert 401 M1:', cert['401'][0]);

  // 2. Fournisseurs: accounts starting with 401 or 280
  const suppliers = await sqlDb.query("SELECT boal_account, scf_account, account_desc, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '012025' AND (scf_account LIKE '401%' OR scf_account LIKE '408%' OR boal_account LIKE '280%')");
  console.log('\nSupplier accounts in M1 (012025):');
  suppliers.forEach(s => console.log(`${s.boal_account} | ${s.scf_account} | ${s.account_desc} | deb:${s.debit} | cred:${s.credit} | solde:${s.solde}`));
  const totSupplierDebit = suppliers.reduce((sum, s) => sum + s.debit, 0);
  console.log('Total Supplier Debit in M1:', totSupplierDebit, 'vs Cert 402 M1:', cert['402'][0]);

  // 3. Personnel: accounts starting with 421, 422, 431
  const personnel = await sqlDb.query("SELECT boal_account, scf_account, account_desc, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '012025' AND (scf_account LIKE '421%' OR scf_account LIKE '422%' OR scf_account LIKE '431%' OR scf_account LIKE '432%')");
  console.log('\nPersonnel accounts in M1 (012025):');
  personnel.forEach(p => console.log(`${p.boal_account} | ${p.scf_account} | ${p.account_desc} | deb:${p.debit} | cred:${p.credit} | solde:${p.solde}`));
  const totPersDebit = personnel.reduce((sum, p) => sum + p.debit, 0);
  console.log('Total Personnel Debit in M1:', totPersDebit, 'vs Cert 403 M1:', cert['403'][0]);
})();
