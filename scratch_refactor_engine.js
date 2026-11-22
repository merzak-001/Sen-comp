const fs = require('fs');

const targetPath = 'reportingEngine.js';
let code = fs.readFileSync(targetPath, 'utf8');

// Find start of getTCRReport
const tcrStartMarker = '  /**\r\n   * Generates Full Official SCF TCR';
const tcrStartMarkerUnix = '  /**\n   * Generates Full Official SCF TCR';
let tcrStartIdx = code.indexOf(tcrStartMarker);
if (tcrStartIdx === -1) tcrStartIdx = code.indexOf(tcrStartMarkerUnix);

// Find end of getBilanReport (start of TFT)
const tftStartMarker = '  /**\r\n   * Loads and caches the certified official TFT 2025 data';
const tftStartMarkerUnix = '  /**\n   * Loads and caches the certified official TFT 2025 data';
let tftStartIdx = code.indexOf(tftStartMarker);
if (tftStartIdx === -1) tftStartIdx = code.indexOf(tftStartMarkerUnix);

if (tcrStartIdx === -1 || tftStartIdx === -1) {
  console.error('Could not find markers! tcrStartIdx:', tcrStartIdx, 'tftStartIdx:', tftStartIdx);
  process.exit(1);
}

const newEngineCode = `  /**
   * Helper to get database balances for a given fiscal year
   */
  getBalanceForYear(year) {
    if (!year) return new Map();
    const yStr = String(year).trim();
    if (this.balancesByPeriod && this.balancesByPeriod.has(yStr)) {
      return this.balancesByPeriod.get(yStr);
    }
    if (this.balancesByPeriod) {
      for (const [pKey, map] of this.balancesByPeriod.entries()) {
        if (pKey === yStr || pKey.endsWith(yStr) || pKey.includes(yStr)) {
          return map;
        }
      }
    }
    // Fallback to legacy balance1026/balance25 maps
    if (yStr === '2026' || yStr === '102026') return this.balance1026 || new Map();
    if (yStr === '2025') return this.balance25 || new Map();
    return new Map();
  }

  /**
   * Generates 100% Dynamic Official SCF TCR (Tableau des Comptes de Résultats)
   * Computed STRICTLY from SQL Server database balances. If database has no data, all numbers are 0.
   */
  getTCRReport(targetYear = '2026') {
    const yearNum = parseInt(targetYear, 10) || 2026;
    const yearN = yearNum;
    const yearN_1 = yearNum > 2000 ? yearNum - 1 : null;

    const balN = this.getBalanceForYear(yearN);
    const balN1 = yearN_1 ? this.getBalanceForYear(yearN_1) : new Map();

    const sections = {
      '70': { ref: '70', label: "1. Ventes et produits annexes (Chiffre d'Affaires net)", type: 'item', accounts: [] },
      '72': { ref: '72', label: '2. Variation des stocks de produits finis et en-cours', type: 'item', accounts: [] },
      '73': { ref: '73', label: '3. Production immobilisée', type: 'item', accounts: [] },
      '74': { ref: '74', label: "4. Subventions d'exploitation", type: 'item', accounts: [] },
      '60': { ref: '60', label: '5. Achats consommés industriels', type: 'item', accounts: [] },
      '61_62': { ref: '61/62', label: '6. Services extérieurs et autres consommations', type: 'item', accounts: [] },
      '63': { ref: '63', label: '7. Charges de personnel', type: 'item', accounts: [] },
      '64': { ref: '64', label: '8. Impôts, taxes et versements assimilés', type: 'item', accounts: [] },
      '75': { ref: '75', label: '9. Autres produits opérationnels', type: 'item', accounts: [] },
      '65': { ref: '65', label: '10. Autres charges opérationnelles', type: 'item', accounts: [] },
      '78': { ref: '78', label: '11. Reprises sur amortissements et provisions', type: 'item', accounts: [] },
      '68': { ref: '68', label: '12. Dotations aux amortissements et provisions', type: 'item', accounts: [] },
      '76': { ref: '76', label: '13. Produits financiers (gains de change)', type: 'item', accounts: [] },
      '66': { ref: '66', label: '14. Charges financières (pertes de change, agios)', type: 'item', accounts: [] },
      '69': { ref: '69', label: '15. Impôts sur les bénéfices (IBS & impôts différés)', type: 'item', accounts: [] }
    };

    const allBoalKeys = new Set([...balN.keys(), ...balN1.keys()]);

    allBoalKeys.forEach(boal => {
      const bN = balN.get(boal);
      const bN1 = balN1.get(boal);

      const chart = this.chartOfAccounts.get(boal) || { dz: '', desc: '' };
      const dz = chart.dz || bN?.dz || bN1?.dz || '';
      const desc = chart.desc || bN?.desc || bN1?.desc || '';

      const soldeN = bN ? bN.solde : 0;
      const soldeN1 = bN1 ? bN1.solde : 0;

      if (!dz) return;

      let targetKey = null;
      let isCreditRevenue = false;

      if (dz.startsWith('70')) { targetKey = '70'; isCreditRevenue = true; }
      else if (dz.startsWith('72')) { targetKey = '72'; }
      else if (dz.startsWith('73')) { targetKey = '73'; isCreditRevenue = true; }
      else if (dz.startsWith('74')) { targetKey = '74'; isCreditRevenue = true; }
      else if (dz.startsWith('75')) { targetKey = '75'; isCreditRevenue = true; }
      else if (dz.startsWith('76')) { targetKey = '76'; isCreditRevenue = true; }
      else if (dz.startsWith('78')) { targetKey = '78'; isCreditRevenue = true; }
      else if (dz.startsWith('60')) { targetKey = '60'; }
      else if (dz.startsWith('61') || dz.startsWith('62')) { targetKey = '61_62'; }
      else if (dz.startsWith('63')) { targetKey = '63'; }
      else if (dz.startsWith('64')) { targetKey = '64'; }
      else if (dz.startsWith('65')) { targetKey = '65'; }
      else if (dz.startsWith('66')) { targetKey = '66'; }
      else if (dz.startsWith('68')) { targetKey = '68'; }
      else if (dz.startsWith('69')) { targetKey = '69'; }

      if (targetKey && sections[targetKey]) {
        let valN = 0;
        let valN1 = 0;

        if (targetKey === '70') {
          const isRebate = dz.startsWith('709') || desc.toUpperCase().includes('RABAIS') || desc.toUpperCase().includes('RISTOURNE');
          valN = isRebate ? (soldeN > 0 ? -soldeN : soldeN) : (soldeN < 0 ? -soldeN : soldeN);
          valN1 = isRebate ? (soldeN1 > 0 ? -soldeN1 : soldeN1) : (soldeN1 < 0 ? -soldeN1 : soldeN1);
        } else if (targetKey === '72') {
          valN = -soldeN;
          valN1 = -soldeN1;
        } else if (isCreditRevenue) {
          valN = soldeN < 0 ? -soldeN : soldeN;
          valN1 = soldeN1 < 0 ? -soldeN1 : soldeN1;
        } else {
          valN = soldeN;
          valN1 = soldeN1;
        }

        if (Math.abs(valN) > 0.001 || Math.abs(valN1) > 0.001) {
          sections[targetKey].accounts.push({
            boal,
            dz,
            desc,
            valN,
            valN_1: valN1,
            val26: valN,
            val25: valN1,
            diff: valN - valN1
          });
        }
      }
    });

    const getSumN = (key) => (sections[key]?.accounts || []).reduce((acc, a) => acc + (a.valN || 0), 0);
    const getSumN1 = (key) => (sections[key]?.accounts || []).reduce((acc, a) => acc + (a.valN_1 || 0), 0);

    const s70_N = getSumN('70'); const s70_N1 = getSumN1('70');
    const s72_N = getSumN('72'); const s72_N1 = getSumN1('72');
    const s73_N = getSumN('73'); const s73_N1 = getSumN1('73');
    const s74_N = getSumN('74'); const s74_N1 = getSumN1('74');
    const prod_N = s70_N + s72_N + s73_N + s74_N;
    const prod_N1 = s70_N1 + s72_N1 + s73_N1 + s74_N1;

    const s60_N = getSumN('60'); const s60_N1 = getSumN1('60');
    const s61_62_N = getSumN('61_62'); const s61_62_N1 = getSumN1('61_62');
    const cons_N = s60_N + s61_62_N;
    const cons_N1 = s60_N1 + s61_62_N1;

    const va_N = prod_N - cons_N;
    const va_N1 = prod_N1 - cons_N1;

    const s63_N = getSumN('63'); const s63_N1 = getSumN1('63');
    const s64_N = getSumN('64'); const s64_N1 = getSumN1('64');
    const ebe_N = va_N - s63_N - s64_N;
    const ebe_N1 = va_N1 - s63_N1 - s64_N1;

    const s75_N = getSumN('75'); const s75_N1 = getSumN1('75');
    const s65_N = getSumN('65'); const s65_N1 = getSumN1('65');
    const s78_N = getSumN('78'); const s78_N1 = getSumN1('78');
    const s68_N = getSumN('68'); const s68_N1 = getSumN1('68');
    const resOp_N = ebe_N + s75_N - s65_N + s78_N - s68_N;
    const resOp_N1 = ebe_N1 + s75_N1 - s65_N1 + s78_N1 - s68_N1;

    const s76_N = getSumN('76'); const s76_N1 = getSumN1('76');
    const s66_N = getSumN('66'); const s66_N1 = getSumN1('66');
    const resFin_N = s76_N - s66_N;
    const resFin_N1 = s76_N1 - s66_N1;

    const rcai_N = resOp_N + resFin_N;
    const rcai_N1 = resOp_N1 + resFin_N1;

    const s69_N = getSumN('69'); const s69_N1 = getSumN1('69');
    const resNet_N = rcai_N - s69_N;
    const resNet_N1 = rcai_N1 - s69_N1;

    const hasData = (balN.size > 0 || balN1.size > 0);

    const buildRow = (ref, label, nN, nN1, type = 'item', accounts = []) => {
      const hasN1 = nN1 !== null && nN1 !== undefined;
      const diff = hasN1 ? nN - nN1 : null;
      const pct = (hasN1 && Math.abs(nN1) > 0) ? (diff / Math.abs(nN1)) * 100 : null;
      const ratioCAN = Math.abs(s70_N) > 0 ? (nN / s70_N) * 100 : 0;
      return {
        ref,
        label,
        valN: nN,
        valN_1: hasN1 ? nN1 : null,
        val26: nN,
        val25: hasN1 ? nN1 : null,
        diff,
        pct,
        ratioCAN,
        type,
        accounts
      };
    };

    const rows = [
      buildRow('70', '1. Ventes et produits annexes (Chiffre d\\'Affaires net)', s70_N, s70_N1, 'item', sections['70'].accounts),
      buildRow('72', '2. Variation des stocks de produits finis et en-cours', s72_N, s72_N1, 'item', sections['72'].accounts),
      buildRow('73', '3. Production immobilisée', s73_N, s73_N1, 'item', sections['73'].accounts),
      buildRow('74', '4. Subventions d\\'exploitation', s74_N, s74_N1, 'item', sections['74'].accounts),
      buildRow('I', 'I. PRODUCTION DE L\\'EXERCICE (1+2+3+4)', prod_N, prod_N1, 'total'),

      buildRow('60', '5. Achats consommés industriels', s60_N, s60_N1, 'item', sections['60'].accounts),
      buildRow('61/62', '6. Services extérieurs et autres consommations', s61_62_N, s61_62_N1, 'item', sections['61_62'].accounts),
      buildRow('II', 'II. CONSOMMATION DE L\\'EXERCICE (5+6)', cons_N, cons_N1, 'total'),

      buildRow('III', 'III. VALEUR AJOUTÉE D\\'EXPLOITATION (I - II)', va_N, va_N1, 'sig'),

      buildRow('63', '7. Charges de personnel', s63_N, s63_N1, 'item', sections['63'].accounts),
      buildRow('64', '8. Impôts, taxes et versements assimilés', s64_N, s64_N1, 'item', sections['64'].accounts),
      buildRow('IV', 'IV. EXCÉDENT BRUT D\\'EXPLOITATION (EBE = III - 7 - 8)', ebe_N, ebe_N1, 'sig'),

      buildRow('75', '9. Autres produits opérationnels', s75_N, s75_N1, 'item', sections['75'].accounts),
      buildRow('65', '10. Autres charges opérationnelles', s65_N, s65_N1, 'item', sections['65'].accounts),
      buildRow('78', '11. Reprises sur amortissements et provisions', s78_N, s78_N1, 'item', sections['78'].accounts),
      buildRow('68', '12. Dotations aux amortissements et provisions', s68_N, s68_N1, 'item', sections['68'].accounts),
      buildRow('V', 'V. RÉSULTAT OPÉRATIONNEL (IV + 9 - 10 + 11 - 12)', resOp_N, resOp_N1, 'sig'),

      buildRow('76', '13. Produits financiers (gains de change)', s76_N, s76_N1, 'item', sections['76'].accounts),
      buildRow('66', '14. Charges financières (pertes de change, agios)', s66_N, s66_N1, 'item', sections['66'].accounts),
      buildRow('VI', 'VI. RÉSULTAT FINANCIER (13 - 14)', resFin_N, resFin_N1, 'sig-sec'),

      buildRow('VII', 'VII. RÉSULTAT COURANT AVANT IMPÔTS (V + VI)', rcai_N, rcai_N1, 'sig'),

      buildRow('69', '15. Impôts sur les bénéfices (IBS & impôts différés)', s69_N, s69_N1, 'item', sections['69'].accounts),
      buildRow('VIII', 'VIII. RÉSULTAT NET DE L\\'EXERCICE (VII - 15)', resNet_N, resNet_N1, 'sig-final')
    ];

    const caDiffPct = (Math.abs(s70_N1) > 0) ? ((s70_N - s70_N1) / Math.abs(s70_N1)) * 100 : 0;
    const tauxVAN = prod_N > 0 ? (va_N / prod_N) * 100 : 0;
    const margeEBEN = s70_N > 0 ? (ebe_N / s70_N) * 100 : 0;
    const margeNetteN = s70_N > 0 ? (resNet_N / s70_N) * 100 : 0;

    return {
      hasData,
      company: 'SENSUS ALGERIE SPA',
      title: 'Tableau des Comptes de Résultats (TCR — SCF Algérie)',
      yearN,
      yearN_1,
      periodN: \`Exercice \${yearN}\`,
      periodN1: yearN_1 ? \`Exercice \${yearN_1}\` : '',
      kpis: {
        yearN,
        yearN_1,
        caN: s70_N,
        caN_1: s70_N1,
        caDiffPct,
        vaN: va_N,
        vaN_1: va_N1,
        tauxVAN,
        ebeN: ebe_N,
        ebeN_1: ebe_N1,
        margeEBEN,
        resNetN: resNet_N,
        resNetN_1: resNet_N1,
        margeNetteN
      },
      rows
    };
  }

  /**
   * Generates 100% Dynamic Official SCF Bilan (Actif & Passif)
   * Computed STRICTLY from SQL Server database balances. If database has no data, all numbers are 0.
   */
  getBilanReport(targetYear = '2026') {
    const yearNum = parseInt(targetYear, 10) || 2026;
    const yearN = yearNum;
    const yearN_1 = yearNum > 2000 ? yearNum - 1 : null;

    const balN = this.getBalanceForYear(yearN);
    const balN1 = yearN_1 ? this.getBalanceForYear(yearN_1) : new Map();

    const tcr = this.getTCRReport(targetYear);
    const resNetN = tcr.kpis.resNetN;
    const resNetN_1 = tcr.kpis.resNetN_1;

    const allBoalKeys = new Set([...balN.keys(), ...balN1.keys()]);
    const accountList = [];

    allBoalKeys.forEach(boal => {
      const bN = balN.get(boal);
      const bN1 = balN1.get(boal);
      const chart = this.chartOfAccounts.get(boal) || { dz: '', desc: '' };
      const dz = chart.dz || bN?.dz || bN1?.dz || '';
      const desc = chart.desc || bN?.desc || bN1?.desc || '';

      const soldeN = bN ? bN.solde : 0;
      const soldeN1 = bN1 ? bN1.solde : 0;

      accountList.push({ boal, dz, desc, soldeN, soldeN1 });
    });

    const helperRow = (code, label, filterFn, isAmort = false, isPassif = false) => {
      const matched = accountList.filter(filterFn);
      const accounts = matched.map(a => {
        let valN = a.soldeN;
        let valN1 = a.soldeN1;
        if (isAmort || isPassif) {
          valN = valN < 0 ? -valN : valN;
          valN1 = valN1 < 0 ? -valN1 : valN1;
        }
        return { boal: a.boal, dz: a.dz, desc: a.desc, valN, valN_1: valN1, val26: valN, val25: valN1 };
      }).filter(a => Math.abs(a.valN) > 0.001 || Math.abs(a.valN_1) > 0.001);

      const brutN = accounts.reduce((s, a) => s + a.valN, 0);
      const brutN1 = accounts.reduce((s, a) => s + a.valN_1, 0);

      return { code, label, brutN, brutN1, brut26: brutN, brut25: brutN1, accounts };
    };

    // ACTIF NON COURANT
    const rowLogiciels = helperRow('204', 'Logiciels informatiques et assimilés', a => a.dz.startsWith('20'));
    const rowLogicielsAmort = helperRow('280', 'Amortissements logiciels', a => a.dz.startsWith('280'), true);
    const rowCorp = helperRow('21', 'Autres immobilisations corporelles', a => a.dz.startsWith('21'));
    const rowCorpAmort = helperRow('281', 'Amortissements immob. corporelles', a => a.dz.startsWith('281'), true);
    const rowEncours = helperRow('23', 'Immobilisations en cours', a => a.dz.startsWith('23'));
    const rowAutresTitres = helperRow('26', 'Autres titres immobilisés', a => a.dz.startsWith('26'));
    const rowPrets = helperRow('27', 'Prêts et autres actifs financiers non courants', a => a.dz.startsWith('27'));
    const rowImpotsDiffAct = helperRow('133', 'Impôts différés actif', a => a.dz.startsWith('133'));

    // ACTIF COURANT
    const rowStocks = helperRow('3', 'Stocks et encours', a => a.dz.startsWith('3') && !a.dz.startsWith('39'));
    const rowStocksProv = helperRow('39', 'Pertes de valeur sur stocks', a => a.dz.startsWith('39'), true);
    const rowClients = helperRow('41', 'Créances clients et comptes rattachés', a => a.dz.startsWith('411') || a.dz.startsWith('413') || a.dz.startsWith('418'));
    const rowClientsProv = helperRow('49', 'Pertes de valeur sur clients', a => a.dz.startsWith('49'), true);
    const rowAutresDeb = helperRow('409', 'Autres débiteurs (Acomptes versés)', a => a.dz.startsWith('409'));
    const rowImpotsAct = helperRow('44_ACT', 'Impôts et assimilés (Acomptes IBS, TVA)', a => (a.dz.startsWith('44841') || a.dz.startsWith('4441')) && (a.soldeN > 0 || a.soldeN1 > 0));
    const rowAutresCreances = helperRow('486', 'Autres créances et emplois assimilés', a => a.dz.startsWith('486'));
    const rowTreso = helperRow('5', 'Trésorerie et disponibilités', a => (a.dz.startsWith('51') || a.dz.startsWith('53')) && (a.soldeN > 0 || a.soldeN1 > 0));

    // PASSIF
    const rowCapital = helperRow('101', 'Capital émis / Capital social', a => a.dz.startsWith('101'), false, true);
    const rowReserves = helperRow('106', 'Primes et réserves consolidées', a => a.dz.startsWith('106'), false, true);
    const rowProvisionsNC = helperRow('15', 'Provisions et produits constatés d\\'avance', a => a.dz.startsWith('15'), false, true);
    const rowFournisseurs = helperRow('40', 'Fournisseurs et comptes rattachés', a => (a.dz.startsWith('401') || a.dz.startsWith('404') || a.dz.startsWith('408')) && (a.soldeN < 0 || a.soldeN1 < 0), false, true);
    const rowImpotsPass = helperRow('44_PAS', 'Impôts (Dettes fiscales)', a => a.dz.startsWith('44') && !a.dz.startsWith('44841') && !a.dz.startsWith('4441') && (a.soldeN < 0 || a.soldeN1 < 0), false, true);
    const rowAutresDettes = helperRow('4X_DET', 'Autres dettes (Personnel, Sécu, Avances, Dividendes)', a => (a.dz.startsWith('419') || a.dz.startsWith('42') || a.dz.startsWith('43') || a.dz.startsWith('457') || a.dz.startsWith('46') || a.dz.startsWith('47') || a.dz.startsWith('487')) && (a.soldeN < 0 || a.soldeN1 < 0), false, true);

    const setActifRow = (row, brutN, amortN, netN, netN1 = 0) => {
      row.brutN = brutN;
      row.amortN = amortN;
      row.netN = netN;
      row.netN_1 = netN1 || 0;
      row.brut26 = brutN;
      row.amort26 = amortN;
      row.net26 = netN;
      row.net25 = row.netN_1;
      row.evolPct = (netN1 && Math.abs(netN1) > 0) ? ((netN - netN1) / Math.abs(netN1)) * 100 : null;
    };

    const setPassifRow = (row, netN, netN1 = 0) => {
      row.netN = netN;
      row.netN_1 = netN1 || 0;
      row.net26 = netN;
      row.net25 = row.netN_1;
      row.evolPct = (netN1 && Math.abs(netN1) > 0) ? ((netN - netN1) / Math.abs(netN1)) * 100 : null;
    };

    setActifRow(rowLogiciels, rowLogiciels.brutN, rowLogicielsAmort.brutN, Math.max(0, rowLogiciels.brutN - rowLogicielsAmort.brutN), Math.max(0, rowLogiciels.brutN1 - rowLogicielsAmort.brutN1));
    setActifRow(rowCorp, rowCorp.brutN, rowCorpAmort.brutN, Math.max(0, rowCorp.brutN - rowCorpAmort.brutN), Math.max(0, rowCorp.brutN1 - rowCorpAmort.brutN1));
    setActifRow(rowEncours, rowEncours.brutN, 0, rowEncours.brutN, rowEncours.brutN1);
    setActifRow(rowAutresTitres, rowAutresTitres.brutN, 0, rowAutresTitres.brutN, rowAutresTitres.brutN1);
    setActifRow(rowPrets, rowPrets.brutN, 0, rowPrets.brutN, rowPrets.brutN1);
    setActifRow(rowImpotsDiffAct, rowImpotsDiffAct.brutN, 0, rowImpotsDiffAct.brutN, rowImpotsDiffAct.brutN1);

    const totNCBrutN = rowLogiciels.brutN + rowCorp.brutN + rowEncours.brutN + rowAutresTitres.brutN + rowPrets.brutN + rowImpotsDiffAct.brutN;
    const totNCAmortN = rowLogicielsAmort.brutN + rowCorpAmort.brutN;
    const totNCNetN = rowLogiciels.netN + rowCorp.netN + rowEncours.netN + rowAutresTitres.netN + rowPrets.netN + rowImpotsDiffAct.netN;

    const totNCBrutN1 = rowLogiciels.brutN1 + rowCorp.brutN1 + rowEncours.brutN1 + rowAutresTitres.brutN1 + rowPrets.brutN1 + rowImpotsDiffAct.brutN1;
    const totNCAmortN1 = rowLogicielsAmort.brutN1 + rowCorpAmort.brutN1;
    const totNCNetN1 = rowLogiciels.netN_1 + rowCorp.netN_1 + rowEncours.netN_1 + rowAutresTitres.netN_1 + rowPrets.netN_1 + rowImpotsDiffAct.netN_1;

    const totalNonCourant = {
      code: 'TOTAL_NC',
      label: 'TOTAL ACTIF NON COURANT',
      brutN: totNCBrutN, amortN: totNCAmortN, netN: totNCNetN, netN_1: totNCNetN1,
      brut26: totNCBrutN, amort26: totNCAmortN, net26: totNCNetN, net25: totNCNetN1,
      evolPct: totNCNetN1 > 0 ? ((totNCNetN - totNCNetN1) / totNCNetN1) * 100 : null
    };

    setActifRow(rowStocks, rowStocks.brutN, rowStocksProv.brutN, Math.max(0, rowStocks.brutN - rowStocksProv.brutN), Math.max(0, rowStocks.brutN1 - rowStocksProv.brutN1));
    setActifRow(rowClients, rowClients.brutN, rowClientsProv.brutN, Math.max(0, rowClients.brutN - rowClientsProv.brutN), Math.max(0, rowClients.brutN1 - rowClientsProv.brutN1));
    setActifRow(rowAutresDeb, rowAutresDeb.brutN, 0, rowAutresDeb.brutN, rowAutresDeb.brutN1);
    setActifRow(rowImpotsAct, rowImpotsAct.brutN, 0, rowImpotsAct.brutN, rowImpotsAct.brutN1);
    setActifRow(rowAutresCreances, rowAutresCreances.brutN, 0, rowAutresCreances.brutN, rowAutresCreances.brutN1);
    setActifRow(rowTreso, rowTreso.brutN, 0, rowTreso.brutN, rowTreso.brutN1);

    const totCBrutN = rowStocks.brutN + rowClients.brutN + rowAutresDeb.brutN + rowImpotsAct.brutN + rowAutresCreances.brutN + rowTreso.brutN;
    const totCAmortN = rowStocksProv.brutN + rowClientsProv.brutN;
    const totCNetN = rowStocks.netN + rowClients.netN + rowAutresDeb.netN + rowImpotsAct.netN + rowAutresCreances.netN + rowTreso.netN;

    const totCBrutN1 = rowStocks.brutN1 + rowClients.brutN1 + rowAutresDeb.brutN1 + rowImpotsAct.brutN1 + rowAutresCreances.brutN1 + rowTreso.brutN1;
    const totCAmortN1 = rowStocksProv.brutN1 + rowClientsProv.brutN1;
    const totCNetN1 = rowStocks.netN_1 + rowClients.netN_1 + rowAutresDeb.netN_1 + rowImpotsAct.netN_1 + rowAutresCreances.netN_1 + rowTreso.netN_1;

    const totalCourant = {
      code: 'TOTAL_C',
      label: 'TOTAL ACTIF COURANT',
      brutN: totCBrutN, amortN: totCAmortN, netN: totCNetN, netN_1: totCNetN1,
      brut26: totCBrutN, amort26: totCAmortN, net26: totCNetN, net25: totCNetN1,
      evolPct: totCNetN1 > 0 ? ((totCNetN - totCNetN1) / totCNetN1) * 100 : null
    };

    const totGeneralBrutN = totNCBrutN + totCBrutN;
    const totGeneralAmortN = totNCAmortN + totCAmortN;
    const totGeneralNetN = totNCNetN + totCNetN;
    const totGeneralNetN1 = totNCNetN1 + totCNetN1;

    const totalActif = {
      code: 'TOTAL_ACTIF',
      label: 'TOTAL GÉNÉRAL DE L\\'ACTIF',
      brutN: totGeneralBrutN, amortN: totGeneralAmortN, netN: totGeneralNetN, netN_1: totGeneralNetN1,
      brut26: totGeneralBrutN, amort26: totGeneralAmortN, net26: totGeneralNetN, net25: totGeneralNetN1,
      evolPct: totGeneralNetN1 > 0 ? ((totGeneralNetN - totGeneralNetN1) / totGeneralNetN1) * 100 : null
    };

    setPassifRow(rowCapital, rowCapital.brutN, rowCapital.brutN1);
    setPassifRow(rowReserves, rowReserves.brutN, rowReserves.brutN1);
    const rowResNet = {
      code: '12',
      label: 'Résultat net de l\\'exercice (Bénéfice / Perte)',
      netN: resNetN,
      netN_1: resNetN_1,
      net26: resNetN,
      net25: resNetN_1,
      evolPct: (resNetN_1 && Math.abs(resNetN_1) > 0) ? ((resNetN - resNetN_1) / Math.abs(resNetN_1)) * 100 : null,
      accounts: []
    };

    const totCapPropresN = rowCapital.netN + rowReserves.netN + rowResNet.netN;
    const totCapPropresN1 = rowCapital.netN_1 + rowReserves.netN_1 + rowResNet.netN_1;
    const totalCapitauxPropres = {
      code: 'TOTAL_CP',
      label: 'TOTAL CAPITAUX PROPRES',
      netN: totCapPropresN, netN_1: totCapPropresN1,
      net26: totCapPropresN, net25: totCapPropresN1,
      evolPct: totCapPropresN1 > 0 ? ((totCapPropresN - totCapPropresN1) / totCapPropresN1) * 100 : null
    };

    setPassifRow(rowProvisionsNC, rowProvisionsNC.brutN, rowProvisionsNC.brutN1);
    const totPassifNCN = rowProvisionsNC.netN;
    const totPassifNCN1 = rowProvisionsNC.netN_1;
    const totalPassifNonCourant = {
      code: 'TOTAL_PNC',
      label: 'TOTAL PASSIF NON COURANT',
      netN: totPassifNCN, netN_1: totPassifNCN1,
      net26: totPassifNCN, net25: totPassifNCN1,
      evolPct: totPassifNCN1 > 0 ? ((totPassifNCN - totPassifNCN1) / totPassifNCN1) * 100 : null
    };

    setPassifRow(rowFournisseurs, rowFournisseurs.brutN, rowFournisseurs.brutN1);
    setPassifRow(rowImpotsPass, rowImpotsPass.brutN, rowImpotsPass.brutN1);
    setPassifRow(rowAutresDettes, rowAutresDettes.brutN, rowAutresDettes.brutN1);

    const totPassifCourantN = rowFournisseurs.netN + rowImpotsPass.netN + rowAutresDettes.netN;
    const totPassifCourantN1 = rowFournisseurs.netN_1 + rowImpotsPass.netN_1 + rowAutresDettes.netN_1;
    const totalPassifCourant = {
      code: 'TOTAL_PC',
      label: 'TOTAL PASSIF COURANT',
      netN: totPassifCourantN, netN_1: totPassifCourantN1,
      net26: totPassifCourantN, net25: totPassifCourantN1,
      evolPct: totPassifCourantN1 > 0 ? ((totPassifCourantN - totPassifCourantN1) / totPassifCourantN1) * 100 : null
    };

    const totGeneralPassifN = totCapPropresN + totPassifNCN + totPassifCourantN;
    const totGeneralPassifN1 = totCapPropresN1 + totPassifNCN1 + totPassifCourantN1;
    const totalGeneralPassif = {
      code: 'TOTAL_PASSIF',
      label: 'TOTAL GÉNÉRAL DU PASSIF',
      netN: totGeneralPassifN, netN_1: totGeneralPassifN1,
      net26: totGeneralPassifN, net25: totGeneralPassifN1,
      evolPct: totGeneralPassifN1 > 0 ? ((totGeneralPassifN - totGeneralPassifN1) / totGeneralPassifN1) * 100 : null
    };

    const diffN = totGeneralNetN - totGeneralPassifN;
    const diffN1 = totGeneralNetN1 - totGeneralPassifN1;
    const frngN = totCapPropresN + totPassifNCN - totNCNetN;
    const frngN1 = totCapPropresN1 + totPassifNCN1 - totNCNetN1;
    const bfrN = (rowStocks.netN + rowClients.netN + rowAutresDeb.netN + rowImpotsAct.netN + rowAutresCreances.netN) - totPassifCourantN;
    const bfrN1 = (rowStocks.netN_1 + rowClients.netN_1 + rowAutresDeb.netN_1 + rowImpotsAct.netN_1 + rowAutresCreances.netN_1) - totPassifCourantN1;

    const hasData = (balN.size > 0 || balN1.size > 0);

    return {
      hasData,
      company: 'SENSUS ALGERIE SPA',
      title: 'Bilan Comptable (Actif & Passif — SCF Algérie)',
      yearN,
      yearN_1,
      periodN: \`Exercice \${yearN}\`,
      periodN1: yearN_1 ? \`Exercice \${yearN_1}\` : '',
      kpis: {
        yearN,
        yearN_1,
        totalActifNetN: totGeneralNetN,
        totalActifNetN1: totGeneralNetN1,
        totalPassifN: totGeneralPassifN,
        totalPassifN1: totGeneralPassifN1,
        diffN,
        diffN1,
        capitauxPropresN: totCapPropresN,
        capitauxPropresN1: totCapPropresN1,
        frngN,
        frngN1,
        bfrN,
        bfrN1
      },
      actif: {
        nonCourant: [
          rowLogiciels,
          rowCorp,
          rowEncours,
          rowAutresTitres,
          rowPrets,
          rowImpotsDiffAct
        ],
        totalNonCourant,
        courant: [
          rowStocks,
          rowClients,
          rowAutresDeb,
          rowImpotsAct,
          rowAutresCreances,
          rowTreso
        ],
        totalCourant,
        totalActif
      },
      passif: {
        capitauxPropres: [
          rowCapital,
          rowReserves,
          rowResNet
        ],
        totalCapitauxPropres,
        passifNonCourant: [
          rowProvisionsNC
        ],
        totalPassifNonCourant,
        passifCourant: [
          rowFournisseurs,
          rowImpotsPass,
          rowAutresDettes
        ],
        totalCourant: totalPassifCourant,
        totalGeneral: totalGeneralPassif
      }
    };
  }

`;

const updatedCode = code.slice(0, tcrStartIdx) + newEngineCode + code.slice(tftStartIdx);
fs.writeFileSync(targetPath, updatedCode, 'utf8');
console.log('Successfully refactored reportingEngine.js! Previous length:', code.length, 'New length:', updatedCode.length);
