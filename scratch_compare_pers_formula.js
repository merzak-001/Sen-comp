const sqlDb = require('./sqlDb');

(async () => {
  const pCurr = '012025';
  const rows = await sqlDb.query("SELECT boal_account, scf_account, account_desc, debit FROM GeneralLedgerBalances WHERE period_key = '" + pCurr + "'");

  // The 14 accounts that gave exactly 16,413,689.15:
  const exactMatchAccs = [
    '17305019', // CHARGES CONSTATEES D: 252,335.00
    '17310015', // COTISATION PATR ACC: 146,119.60
    '17300228', // REMUNERATION DU PERS: 8,197,247.86
    '17310016', // COTISATION PATR RET: 1,285,852.62
    '17300013', // DIVERS CHARGES A PAY: 1,325,515.00
    '17470319', // RETENUES S/ PRET MAR: 2,500.00
    '17570021', // CONTRIBUTION LOGEMEN: 57,506.56
    '17760022', // COTISATION PATR ASSU: 1,607,315.72
    '17570017', // PROVISION CONGE: 755,487.67
    '17470355', // PROVISION ŒUVRE SOCI: 115,013.12
    '17470303', // RETENUES SUR SALAIRE: 68,620.00
    '17470312', // RETENUES ASSURANCES: 14,100.00
    '17460003', // IRG SUR SALAIRES: 2,539,076.00
    '17470301'  // RETENUES SUR SALAIRE: 47,000.00
  ];

  let sumExact = 0;
  console.log('=== THE 14 ACCOUNTS THAT MAKE 16,413,689.15 DA ===');
  for (const a of exactMatchAccs) {
    const r = rows.find(x => x.boal_account === a);
    const d = r ? Number(r.debit || 0) : 0;
    sumExact += d;
    console.log(`  ${a} (${r?.account_desc}): ${d.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  }
  console.log(`TOTAL EXACT: ${sumExact.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA (Target: 16,413,689.20 DA)\n`);

  // Now, what accounts were in the 33-account list that caused the extra 2,863,320.67 DA?
  const all33 = [
    '17300228', '17560002', '17570002', '17300013', '17305019', '17570017', '17570018', '17570019',
    '17460003',
    '17760022', '17310015', '17310016', '17310017', '17310121', '17310123', '17310124', '17310125',
    '17470311', '17470313', '17470355', '17470308', '17470306', '17470303', '17470301', '17470302',
    '17470312', '17470319', '17470320', '17470322', '17570020', '17570021',
    '43290061', '44010088'
  ];

  console.log('=== THE EXTRA ACCOUNTS IN THE 33-LIST THAT WERE NOT IN THE EXACT MATCH ===');
  let sumExtra = 0;
  for (const a of all33) {
    if (!exactMatchAccs.includes(a)) {
      const r = rows.find(x => x.boal_account === a);
      const d = r ? Number(r.debit || 0) : 0;
      if (d > 0) {
        sumExtra += d;
        console.log(`  EXTRA: ${a} (${r?.account_desc}): ${d.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
      }
    }
  }
  console.log(`TOTAL EXTRA: ${sumExtra.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`16,413,689.15 + ${sumExtra.toLocaleString('fr-FR', {minimumFractionDigits: 2})} = ${(sumExact + sumExtra).toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
})();
