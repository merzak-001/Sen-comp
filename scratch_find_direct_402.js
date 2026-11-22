const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== FINDING DIRECT FORMULA FOR 402 WITHOUT 403, 404 ===');
  const rows = await sqlDb.query("SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '012025'");

  const deb16000010 = 10414509.42;
  const deb16010800 = 46329826.86;
  const deb17110102 = 2594501.80;
  const deb16030110 = 6847068.80;
  const deb16000007 = 1134784.26;
  const deb15200003 = 373086.86;
  const totalDebits = deb16000010 + deb16010800 + deb17110102 + deb16030110 + deb16000007 + deb15200003; // 67,693,778.00

  const target = 65059394.19;
  const diff = totalDebits - target; // 2,634,383.81

  console.log('Total Debits:', totalDebits);
  console.log('Target:', target);
  console.log('Difference to subtract:', diff);

  // Check what accounts in the balance explain 2,634,383.81
  // Could it be credits on specific accounts?
  // 16010800 credit: 1255959.99
  // 15200003 credit: 256716.16
  // 16030110 credit: 151774.13
  // 16000007 credit: 12376.00
  // 15200007 credit: 13500.00
  // 19710001 credit: 474906.39
  // 21040102 net credit: 364307.16 (1869381.32 - 1505074.16)
  // Let's sum these exact accounts:
  const c16010800 = 1255959.99;
  const c15200003 = 256716.16;
  const c16030110 = 151774.13;
  const c16000007 = 12376.00;
  const c15200007 = 13500.00;
  const c19710001 = 474906.39;
  const c21040102 = 1869381.32 - 1505074.16; // 364307.16
  const c28000010 = 4373.23 - 624.00; // 3749.23

  const sumOffsets = c16010800 + c15200003 + c16030110 + c16000007 + c15200007 + c19710001 + c21040102 + c28000010;
  console.log('Sum offsets candidate:', sumOffsets);
  console.log('Remaining difference:', diff - sumOffsets);

  for (const r of rows) {
    if (Math.abs(Number(r.debit || 0) - 101094.75) < 10 || Math.abs(Number(r.credit || 0) - 101094.75) < 10 || Math.abs(Number(r.solde || 0) - 101094.75) < 10) {
      console.log('Match 101k:', r);
    }
  }
})();
