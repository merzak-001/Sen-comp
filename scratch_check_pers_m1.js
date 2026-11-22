const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== VERIFYING PERSONNEL ACCOUNTS FOR MONTH 01/2025 ===\n');

  const rows = await sqlDb.query("SELECT boal_account, scf_account, account_desc, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '012025'");

  // Let's test the exact accounts identified in the sheet:
  // 17300228 (Salaires nets)
  // 17760022 (CNAS)
  // 17460003 (IRG sur salaires)
  // 17470311 (MUTEG)
  // 17470313 (Fonds d'aide)
  // 17470308 (Retenues sur salaires)
  // 44010088 (Missions)
  // 43290061 (Jetons)
  // 17310xxx (Cotisations)

  const getD = (acc) => {
    const r = rows.find(x => x.boal_account === acc);
    return r ? Number(r.debit || 0) : 0;
  };

  const getC = (acc) => {
    const r = rows.find(x => x.boal_account === acc);
    return r ? Number(r.credit || 0) : 0;
  };

  const d17300228 = getD('17300228'); // Salaires
  const d17760022 = getD('17760022'); // CNAS
  const d17460003 = getD('17460003'); // IRG
  const d17470311 = getD('17470311'); // Muteg
  const d17470313 = getD('17470313'); // Fonds d'aide
  const d17470308 = getD('17470308'); // Retenues
  const d17470306 = getD('17470306');
  const d17470301 = getD('17470301');
  const d17470302 = getD('17470302');
  const d17470303 = getD('17470303');
  const d17470312 = getD('17470312');
  const d44010088 = getD('44010088'); // Missions
  const d43290061 = getD('43290061'); // Jetons

  console.log('17300228 (Salaires nets):', d17300228);
  console.log('17760022 (CNAS):', d17760022);
  console.log('17460003 (IRG sur salaires):', d17460003);
  console.log('17470311 (Muteg):', d17470311);
  console.log('17470313 (Fonds aide):', d17470313);
  console.log('17470308 (Retenues):', d17470308);
  console.log('44010088 (Missions):', d44010088);

  const target = 16413689.20;
  console.log('\nTarget 403 Month 1:', target);

  // Let's check CNAS accounts (17310xxx)
  const cnasAccs = rows.filter(r => r.boal_account.startsWith('17310') || r.scf_account.startsWith('431'));
  let sumCNAS = 0;
  for (const r of cnasAccs) {
    if (r.debit > 0) {
      console.log(`CNAS ${r.boal_account} (${r.account_desc}): Debit=${r.debit}`);
      sumCNAS += Number(r.debit);
    }
  }

  // Let's search exact combination that equals 16413689.20
  const persRows = rows.filter(r => r.boal_account.startsWith('173') || r.boal_account.startsWith('174') || r.boal_account.startsWith('177') || r.boal_account.startsWith('175') || r.scf_account.startsWith('42') || r.scf_account.startsWith('43') || r.boal_account === '44010088' || r.boal_account === '43290061');

  console.log('\nAll candidate debits count:', persRows.length);
})();
