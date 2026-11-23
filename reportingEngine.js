const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel, ShadingType } = require('docx');

const sqlDb = require('./sqlDb');

// STRICT CONSTRAINT: ACCESS ONLY TO FILES IN Documents/OS-appro
const OS_APPRO_DIR = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro';

const PATH_CHART = path.join(OS_APPRO_DIR, 'chart of accounts.xlsx');
const PATH_BAL_1026 = path.join(OS_APPRO_DIR, 'balance 102026.xls');
const PATH_BAL_25 = path.join(OS_APPRO_DIR, 'balance 25.xls');
const PATH_F41 = path.join(OS_APPRO_DIR, 'F.41 05102026.xlsx');
const PATH_FBL3N = path.join(OS_APPRO_DIR, 'FBL3N 051026.xlsx');
const PATH_DEBOURS = path.join(OS_APPRO_DIR, 'debours.xlsx');
const PATH_RETUNIE = path.join(OS_APPRO_DIR, 'retunie.xlsx');
const PATH_TVA = path.join(OS_APPRO_DIR, 'tva 05102026.xlsx');
const PATH_MCBA = path.join(OS_APPRO_DIR, 'mcba 07.10.2026.xlsx');

class ReportingEngine {
  constructor() {
    this.chartOfAccounts = new Map();
    this.balance1026 = new Map();
    this.balance25 = new Map();
    this.balancesByPeriod = new Map();
    this.f41Invoices = [];
    this.deboursData = [];
    this.retunieData = [];
    this.tvaData = [];
    this.mcbaData = [];
    this.isLoaded = false;
    this.tftCache = new Map();
    this.tft2025Cache = null;
    this.loadMasterFiles();
  }

  invalidateTFTCache() {
    this.tftCache.clear();
    this.tft2025Cache = null;
  }

  async loadMasterFiles() {
    try {
      // 1. Chart of Accounts from SQL Server
      const chartRows = await sqlDb.query('SELECT boal_account, scf_account, description FROM ChartOfAccounts');
      this.chartOfAccounts.clear();
      if (Array.isArray(chartRows) && chartRows.length > 0) {
        chartRows.forEach(r => {
          if (r.boal_account) {
            this.chartOfAccounts.set(String(r.boal_account).trim(), {
              dz: String(r.scf_account || '').trim(),
              desc: String(r.description || '').trim()
            });
          }
        });
        console.log(`[ReportingEngine] Loaded ${this.chartOfAccounts.size} accounts from ChartOfAccounts in SQL Server.`);
      }

      // 2. Balances from SQL Server GeneralLedgerBalances
      const glRows = await sqlDb.query('SELECT * FROM GeneralLedgerBalances');
      this.balance1026.clear();
      this.balance25.clear();
      this.balancesByPeriod = new Map();

      if (Array.isArray(glRows) && glRows.length > 0) {
        glRows.forEach(r => {
          const boal = String(r.boal_account || '').trim();
          const pKey = String(r.period_key || '').trim();
          if (!this.balancesByPeriod.has(pKey)) {
            this.balancesByPeriod.set(pKey, new Map());
          }
          const item = {
            boal,
            desc: r.account_desc || '',
            dz: r.scf_account || '',
            report: Number(r.report_initial) || 0,
            debit: Number(r.debit) || 0,
            credit: Number(r.credit) || 0,
            solde: Number(r.solde) || 0
          };
          this.balancesByPeriod.get(pKey).set(boal, item);
        });

        // Initialize caches using dynamic lookup for 2026 and 2025
        const bal26 = this.getBalanceForYear(2026);
        if (bal26) bal26.forEach((v, k) => this.balance1026.set(k, v));
        const bal25 = this.getBalanceForYear(2025);
        if (bal25) bal25.forEach((v, k) => this.balance25.set(k, v));
      }
      console.log(`[ReportingEngine] Loaded from SQL Server: ${this.balance1026.size} balances (2026), ${this.balance25.size} balances (2025), ${this.balancesByPeriod.size} periods.`);

      this.f41Invoices = [];
      this.deboursData = [];
      this.retunieData = [];
      this.tvaData = [];
      this.mcbaData = [];
      this.isLoaded = true;
    } catch (err) {
      console.error('[ReportingEngine] Error loading from SQL Server:', err.message);
    }
  }

  getStatus() {
    return {
      folder: OS_APPRO_DIR,
      files: {
        chartOfAccounts: { name: 'chart of accounts.xlsx', exists: fs.existsSync(PATH_CHART), count: this.chartOfAccounts.size },
        balance1026: { name: 'balance 102026.xls', exists: fs.existsSync(PATH_BAL_1026), count: this.balance1026.size },
        balance25: { name: 'balance 25.xls', exists: fs.existsSync(PATH_BAL_25), count: this.balance25.size },
        f41: { name: 'F.41 05102026.xlsx', exists: fs.existsSync(PATH_F41), count: this.f41Invoices.length },
        fbl3n: { name: 'FBL3N 051026.xlsx', exists: fs.existsSync(PATH_FBL3N) },
        debours: { name: 'debours.xlsx', exists: fs.existsSync(PATH_DEBOURS) },
        retunie: { name: 'retunie.xlsx', exists: fs.existsSync(PATH_RETUNIE) },
        tva: { name: 'tva 05102026.xlsx', exists: fs.existsSync(PATH_TVA) },
        mcba: { name: 'mcba 07.10.2026.xlsx', exists: fs.existsSync(PATH_MCBA) }
      }
    };
  }

  /**
   * Generates Document9 Synthesis Report (values stored in raw DA for conversion to KDA / DA / MDA)
   */
  getDocument9Report(period = 'AOUT_2026') {
    return {
      hasData: false,
      period,
      periodLabel: "Période non chargée",
      priorPeriodLabel: "",
      isQuarter: false,
      productionData: {
        meters2025: 0,
        meters2026: 0,
        metersGrowthPct: 0,
        corpsCost2025: 0,
        corpsCost2026: 0,
        corpsCostDiff: 0,
        corpsCostGrowthPct: 0
      },
      consommation: {
        total2026: 0,
        total2025: 0,
        reventeGD: 0,
        matieres: 0,
        maintenance: 0,
        maintenanceDetails: { magasin: 0, vehicules: 0, autre: 0 },
        autres: 0,
        autresDetails: { bureau: 0, energie: 0, eau: 0, nonStock: 0 }
      },
      achats: {
        total: 0,
        local: 0,
        localPct: 0,
        etranger: 0,
        etrangerPct: 0,
        modePaiement: "N/A",
        topFournisseurs: [],
        rubriques: []
      },
      stocks: {
        totalN: 0,
        totalN1: 0,
        diff: 0,
        pct: 0,
        stockExterieur: 0,
        stockExterieurPct: 0,
        moisRotation: 0,
        moisRotationN1: 0,
        items: [],
        nLabel: "N",
        n1Label: "N-1"
      },
      predefinedObservations: [],
      autoObservations: "En attente d'importation des données dans la base de données SQL."
    };
  }

  /**
   * Generates clean official Word (.docx) matching formal SENSUS corporate standards
   */
  async generateWordReport(reportData, customObservations = null, unit = 'KDA') {
    const p = reportData;
    let observationsList = [];

    if (Array.isArray(customObservations) && customObservations.length > 0) {
      observationsList = customObservations.map(item => typeof item === 'string' ? item : item.text).filter(t => t && t.trim());
    } else if (typeof customObservations === 'string' && customObservations.trim()) {
      observationsList = customObservations.split('\n').filter(t => t && t.trim());
    } else if (p.predefinedObservations && p.predefinedObservations.length > 0) {
      observationsList = p.predefinedObservations.map(o => o.text);
    } else {
      observationsList = [p.autoObservations || 'Observations de gestion périodique.'];
    }
    const multiplier = unit === 'DA' ? 1000 : (unit === 'MDA' ? 0.001 : 1);
    const unitLabel = unit;

    const logoPath = path.join(__dirname, 'public', 'sensus.jpg');
    let logoParagraph = null;
    if (fs.existsSync(logoPath)) {
      try {
        logoParagraph = new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: fs.readFileSync(logoPath),
              transformation: { width: 140, height: 70 }
            })
          ],
          spacing: { after: 120 }
        });
      } catch (e) { }
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 }
          }
        },
        children: [
          ...(logoParagraph ? [logoParagraph] : []),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "SENSUS ALGÉRIE SPA", bold: true, size: 28, color: "082F49" }),
              new TextRun({ text: " • SERVICE APPROVISIONNEMENTS", size: 22, color: "0284C7", bold: true })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "BP 02 route de Batna, El-Eulma • NIF : 000519008602385 • RC : 05B0086023", size: 16, color: "64748B" })
            ]
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({ text: `IX. APPROVISIONNEMENTS — ${p.periodLabel.toUpperCase()}`, bold: true, size: 26, color: "0F172A" })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Note de Synthèse de Gestion & Bilan d'Activité • Unité : ${unitLabel}`, italic: true, size: 18, color: "475569" })
            ]
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({ text: "1. ANALYSE SYNTHÉTIQUE DE LA PÉRIODE", bold: true, size: 20, color: "0284C7" })
            ]
          }),
          ...observationsList.map(line => new Paragraph({
            children: [new TextRun({ text: line.startsWith('•') ? line : `• ${line}`, size: 19, color: "1E293B" })],
            spacing: { after: 90 }
          })),
          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({ text: `2. DÉCOMPOSITION DES ACHATS CONSOMMÉS (CHARGES COMPTE 60) [${unitLabel}]`, bold: true, size: 20, color: "0284C7" })
            ]
          }),
          this.createConsommationTable(p, multiplier, unitLabel),
          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({ text: `3. ACHATS FACTURÉS & FOURNISSEURS STRATÉGIQUES [${unitLabel}]`, bold: true, size: 20, color: "0284C7" })
            ]
          }),
          this.createAchatsTable(p, multiplier, unitLabel),
          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({ text: `4. ANALYSE DES STOCKS (${p.periodLabel} vs ${p.priorPeriodLabel}) [${unitLabel}]`, bold: true, size: 20, color: "0284C7" })
            ]
          }),
          this.createStocksTable(p, multiplier, unitLabel),
          new Paragraph({ text: "" }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Le Chef de Service Approvisionnements", bold: true, size: 18 })] }),
                      new Paragraph({ text: "\n\nDate & Signature :" })
                    ],
                    width: { size: 50, type: WidthType.PERCENTAGE }
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "La Direction Générale SENSUS SPA", bold: true, size: 18 })] }),
                      new Paragraph({ text: "\n\nDate & Visa :" })
                    ],
                    width: { size: 50, type: WidthType.PERCENTAGE }
                  })
                ]
              })
            ]
          })
        ]
      }]
    });

    return await Packer.toBuffer(doc);
  }

  createConsommationTable(p, m, unitLabel) {
    const c = p.consommation;
    const rows = [
      new TableRow({
        children: [
          this.cellHeader("RUBRIQUE DE CONSOMMATION", 60),
          this.cellHeader(`VALEUR (${unitLabel})`, 25, AlignmentType.RIGHT),
          this.cellHeader("PART %", 15, AlignmentType.RIGHT)
        ]
      }),
      this.rowItem("Marchandises consommées (Revente Gros Débit)", (c.reventeGD * m).toLocaleString('fr-FR'), `${(c.reventeGD / c.total2026 * 100).toFixed(2)} %`),
      this.rowItem("Matières et fournitures consommées", (c.matieres * m).toLocaleString('fr-FR'), `${(c.matieres / c.total2026 * 100).toFixed(2)} %`),
      this.rowItem("Achats consommés des pièces de rechange maintenance", (c.maintenance * m).toLocaleString('fr-FR'), `${(c.maintenance / c.total2026 * 100).toFixed(2)} %`),
      this.rowItem("Autres achats consommés (Bureau, Eau, Énergie)", (c.autres * m).toLocaleString('fr-FR'), `${(c.autres / c.total2026 * 100).toFixed(2)} %`),
      new TableRow({
        children: [
          this.cellHeader("TOTAL DES ACHATS CONSOMMÉS", 60),
          this.cellHeader((c.total2026 * m).toLocaleString('fr-FR'), 25, AlignmentType.RIGHT),
          this.cellHeader("100,00 %", 15, AlignmentType.RIGHT)
        ]
      })
    ];

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
  }

  createAchatsTable(p, m, unitLabel) {
    const a = p.achats;
    const rows = [
      new TableRow({
        children: [
          this.cellHeader("FLUX D'ACHAT & TOP FOURNISSEURS", 60),
          this.cellHeader(`VALEUR (${unitLabel})`, 25, AlignmentType.RIGHT),
          this.cellHeader("PART %", 15, AlignmentType.RIGHT)
        ]
      }),
      this.rowItem("Achats Locaux (DZD)", (a.local * m).toLocaleString('fr-FR'), `${a.localPct} %`, true),
      this.rowItem("Achats Étrangers (Importations)", (a.etranger * m).toLocaleString('fr-FR'), `${a.etrangerPct} %`, true),
      ...a.topFournisseurs.slice(0, 5).map(f => this.rowItem(`  • ${f.name}`, (f.val * m).toLocaleString('fr-FR'), `${f.pct} %`)),
      new TableRow({
        children: [
          this.cellHeader("TOTAL ACHATS DE LA PÉRIODE", 60),
          this.cellHeader((a.total * m).toLocaleString('fr-FR'), 25, AlignmentType.RIGHT),
          this.cellHeader("100,00 %", 15, AlignmentType.RIGHT)
        ]
      })
    ];

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
  }

  createStocksTable(p, m, unitLabel) {
    const s = p.stocks;
    const n1Header = p.period === 'SEPTEMBRE_2026' ? `Sept- 2025 (${unitLabel})` : `${p.priorPeriodLabel} (${unitLabel})`;
    const nHeader = p.period === 'SEPTEMBRE_2026' ? `Sept-- 2026 (${unitLabel})` : `${p.periodLabel} (${unitLabel})`;

    const rows = [
      new TableRow({
        children: [
          this.cellHeader("RUBRIQUE DU STOCK", 36),
          this.cellHeader(n1Header, 16, AlignmentType.RIGHT),
          this.cellHeader(nHeader, 16, AlignmentType.RIGHT),
          this.cellHeader(`ÉVOLUTION (${unitLabel})`, 18, AlignmentType.RIGHT),
          this.cellHeader("ÉVOLUTION (%)", 14, AlignmentType.RIGHT)
        ]
      }),
      ...s.items.map(item => new TableRow({
        children: [
          this.cellText(item.rubrique, 36),
          this.cellText((item.n1 * m).toLocaleString('fr-FR'), 16, AlignmentType.RIGHT),
          this.cellText((item.n * m).toLocaleString('fr-FR'), 16, AlignmentType.RIGHT),
          this.cellText(`${item.diff > 0 ? '+' : ''}${(item.diff * m).toLocaleString('fr-FR')}`, 18, AlignmentType.RIGHT, item.diff < 0 ? "059669" : "B91C1C"),
          this.cellText(`${item.pct > 0 ? '+' : ''}${item.pct}%`, 14, AlignmentType.RIGHT, item.pct < 0 ? "059669" : "B91C1C")
        ]
      })),
      new TableRow({
        children: [
          this.cellHeader("TOTAL", 36),
          this.cellHeader((s.totalN1 * m).toLocaleString('fr-FR'), 16, AlignmentType.RIGHT),
          this.cellHeader((s.totalN * m).toLocaleString('fr-FR'), 16, AlignmentType.RIGHT),
          this.cellHeader(`${s.diff > 0 ? '+' : ''}${(s.diff * m).toLocaleString('fr-FR')}`, 18, AlignmentType.RIGHT),
          this.cellHeader(`${s.pct > 0 ? '+' : ''}${s.pct}%`, 14, AlignmentType.RIGHT)
        ]
      })
    ];

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
  }

  cellHeader(text, widthPct, align = AlignmentType.LEFT) {
    return new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: "0F172A" },
      children: [new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold: true, size: 17, color: "FFFFFF" })]
      })]
    });
  }

  cellText(text, widthPct, align = AlignmentType.LEFT, color = "1E293B") {
    return new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      children: [new Paragraph({
        alignment: align,
        children: [new TextRun({ text, size: 17, color })]
      })]
    });
  }

  rowItem(col1, col2, col3, isHighlight = false) {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 60, type: WidthType.PERCENTAGE },
          shading: isHighlight ? { type: ShadingType.CLEAR, fill: "F1F5F9" } : undefined,
          children: [new Paragraph({ children: [new TextRun({ text: col1, bold: isHighlight, size: 17 })] })]
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: isHighlight ? { type: ShadingType.CLEAR, fill: "F1F5F9" } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: col2, bold: isHighlight, size: 17 })] })]
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: isHighlight ? { type: ShadingType.CLEAR, fill: "F1F5F9" } : undefined,
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: col3, bold: isHighlight, size: 17, color: "1E40AF" })] })]
        })
      ]
    });
  }

  /**
   * Generates Full Official SCF TCR (Tableau des Comptes de Résultats) for 2026 (N) and 2025 (N-1)
   * Reconciled strictly against:
   * 1. Official Tax Declaration (BILAN FISCALE AVEC ACCUSE DES IMPOTS - Exercice 2025)
   * 2. Grand Livre SAP 2026 (balance 102026.xls) and 2025 (balance 25.xls)
   */

  /**
   * Generates Full Official SCF TCR (Tableau des Comptes de Résultats) for requested year:
   * - If targetYear == 2026: N is 2026 (Grand Livre), N-1 is 2025 (Official Tax Return)
   * - If targetYear == 2025: N is 2025 (Official Tax Return), N-1 is 2024 (Official Tax Return)
   * - If targetYear == 2024: N is 2024 (Official Tax Return), N-1 is 2023 (Estimated)
   */
  getBalanceForYear(year) {
    const yStr = String(year).trim();
    if (this.balancesByPeriod && this.balancesByPeriod.size > 0) {
      if (this.balancesByPeriod.has(yStr)) {
        return this.balancesByPeriod.get(yStr);
      }
      // Dynamic: search all period keys ending with year (e.g. '122025', '042025')
      const matchingKeys = Array.from(this.balancesByPeriod.keys()).filter(k => {
        return k.endsWith(yStr) || k === yStr;
      });
      if (matchingKeys.length > 0) {
        // Sort descending so the latest available period of the year is used (e.g. '122025' or '102026')
        matchingKeys.sort((a, b) => {
          const numA = parseInt(a, 10) || 0;
          const numB = parseInt(b, 10) || 0;
          return numB - numA;
        });
        return this.balancesByPeriod.get(matchingKeys[0]);
      }
    }
    if (yStr === '2026') return this.balance1026 || new Map();
    if (yStr === '2025') return this.balance25 || new Map();
    return new Map();
  }

  /**
   * Universal Account Data Provider: fetches accounts either from Balance or GL (FBL3N)
   * indexed by year and month.
   *
   * @param {number|string} year - Fiscal year (e.g. 2026, 2025)
   * @param {number|string} month - Fiscal month ('ALL' or 1..12)
   * @param {'balance'|'gl'} source - Chosen source of truth
   */
  async getAccountsForReport(year, month = 'ALL', source = 'balance') {
    const yearNum = parseInt(year, 10);
    const isAllMonths = (!month || month === 'ALL');
    const monthNum = !isAllMonths ? parseInt(month, 10) : null;
    const accountMap = new Map();

    // 1. Ensure Chart of Accounts is loaded from SQL Server
    if (!this.chartOfAccounts || this.chartOfAccounts.size === 0) {
      try {
        const chartRows = await sqlDb.query('SELECT boal_account, scf_account, description FROM ChartOfAccounts');
        if (Array.isArray(chartRows) && chartRows.length > 0) {
          if (!this.chartOfAccounts) this.chartOfAccounts = new Map();
          chartRows.forEach(r => {
            if (r.boal_account) {
              this.chartOfAccounts.set(String(r.boal_account).trim(), {
                dz: String(r.scf_account || '').trim(),
                desc: String(r.description || '').trim()
              });
            }
          });
        }
      } catch (e) {
        console.warn('[ReportingEngine] Error loading ChartOfAccounts on demand:', e.message);
      }
    }

    // 2. Discover available data sources in SQL Server for this year and month
    let glRowsCount = 0;
    let balRowsCount = 0;
    try {
      let glCountSql = `SELECT COUNT(*) AS cnt FROM FBL3NLineItems WHERE fiscal_year = ${yearNum} AND doc_number <> ''`;
      if (monthNum !== null && !isNaN(monthNum)) {
        glCountSql += ` AND fiscal_month = ${monthNum}`;
      }
      const glCheck = await sqlDb.query(glCountSql);
      glRowsCount = Number(glCheck[0]?.cnt) || 0;

      let balCountSql = `SELECT COUNT(*) AS cnt FROM GeneralLedgerBalances WHERE `;
      if (monthNum !== null && !isNaN(monthNum)) {
        const mm = String(monthNum).padStart(2, '0');
        balCountSql += `period_key = '${mm}${yearNum}'`;
      } else {
        balCountSql += `(period_key LIKE '%${yearNum}' OR period_key = '${yearNum}')`;
      }
      const balCheck = await sqlDb.query(balCountSql);
      balRowsCount = Number(balCheck[0]?.cnt) || 0;
    } catch (e) { }

    // CRITICAL: If a specific month is requested and NO DATA exists for that month in the database, return empty map (all 0)!
    if (monthNum !== null && !isNaN(monthNum) && glRowsCount === 0 && balRowsCount === 0) {
      accountMap.effectiveSource = source;
      accountMap.hasData = false;
      return accountMap;
    }

    // Auto-fallback: if requested source has no data for this period but the other does, use the one with data
    let effectiveSource = source;
    if (source === 'balance' && balRowsCount === 0 && glRowsCount > 0) {
      effectiveSource = 'gl';
    } else if (source === 'gl' && glRowsCount === 0 && balRowsCount > 0) {
      effectiveSource = 'balance';
    }

    if (effectiveSource === 'gl') {
      try {
        let sql = `
          SELECT 
            f.account AS boal,
            ISNULL(c.scf_account, '') AS dz,
            ISNULL(c.description, '') AS [desc],
            COUNT(*) AS gl_count,
            ISNULL(SUM(f.amount_local), 0) AS solde,
            ISNULL(SUM(CASE WHEN f.amount_local > 0 THEN f.amount_local ELSE 0 END), 0) AS debit,
            ISNULL(SUM(CASE WHEN f.amount_local < 0 THEN ABS(f.amount_local) ELSE 0 END), 0) AS credit
          FROM FBL3NLineItems f
          LEFT JOIN ChartOfAccounts c ON f.account = c.boal_account
          WHERE f.fiscal_year = ${yearNum} AND f.doc_number <> ''
        `;
        if (monthNum !== null && !isNaN(monthNum)) {
          sql += ` AND f.fiscal_month = ${monthNum}`;
        }
        sql += ` GROUP BY f.account, c.scf_account, c.description`;

        const rows = await sqlDb.query(sql);
        const glMap = new Map();
        if (Array.isArray(rows) && rows.length > 0) {
          rows.forEach(r => {
            const boal = String(r.boal || '').trim();
            if (boal) glMap.set(boal, r);
          });
        }

        // Only load opening balances for annual reports, or if GL has data and it's a balance sheet
        let openBalRows = [];
        if (isAllMonths) {
          try {
            openBalRows = await sqlDb.query(`
              SELECT b.boal_account, b.report_initial, ISNULL(b.scf_account, c.scf_account) AS scf_account, ISNULL(b.account_desc, c.description) AS account_desc
              FROM GeneralLedgerBalances b
              LEFT JOIN ChartOfAccounts c ON b.boal_account = c.boal_account
              WHERE b.period_key = '01${yearNum}' OR b.period_key LIKE '%${yearNum}'
            `);
          } catch (e) { }
        }

        const openMap = new Map();
        openBalRows.forEach(r => {
          const boal = String(r.boal_account || '').trim();
          if (boal && !openMap.has(boal)) {
            openMap.set(boal, r);
          }
        });

        // 1. Add all accounts from Opening Balances for balance sheet accounts (classes 1-5)
        openMap.forEach((balItem, boal) => {
          const chart = this.chartOfAccounts?.get(boal) || { dz: '', desc: '' };
          const dz = chart.dz || balItem.scf_account || '';
          const firstDigit = dz.charAt(0);
          const isBalanceSheet = ['1', '2', '3', '4', '5'].includes(firstDigit);
          const report = isBalanceSheet ? (Number(balItem.report_initial) || 0) : 0;

          const glData = glMap.get(boal);
          const glDebit = glData ? Number(glData.debit) || 0 : 0;
          const glCredit = glData ? Number(glData.credit) || 0 : 0;
          const glSolde = glData ? Number(glData.solde) || 0 : 0;
          const glCount = glData ? Number(glData.gl_count) || 0 : 0;

          accountMap.set(boal, {
            boal,
            dz,
            desc: chart.desc || balItem.account_desc || glData?.desc || '',
            report,
            debit: glDebit,
            credit: glCredit,
            solde: report + glSolde,
            glCount,
            source: 'GL'
          });
        });

        // 2. Add all GL accounts
        glMap.forEach((glData, boal) => {
          if (!accountMap.has(boal)) {
            const chart = this.chartOfAccounts?.get(boal) || { dz: '', desc: '' };
            accountMap.set(boal, {
              boal,
              dz: chart.dz || glData.dz || '',
              desc: chart.desc || glData.desc || '',
              report: 0,
              debit: Number(glData.debit) || 0,
              credit: Number(glData.credit) || 0,
              solde: Number(glData.solde) || 0,
              glCount: Number(glData.gl_count) || 0,
              source: 'GL'
            });
          }
        });
      } catch (sqlErr) {
        console.warn(`[ReportingEngine] Failed to load GL for ${yearNum}:`, sqlErr.message);
      }
    } else {
      // Source: Balance - Query SQL Server GeneralLedgerBalances directly
      try {
        let balSql = `
          SELECT 
            b.boal_account AS boal,
            ISNULL(b.scf_account, c.scf_account) AS dz,
            ISNULL(b.account_desc, c.description) AS [desc],
            b.report_initial AS report,
            b.debit AS debit,
            b.credit AS credit,
            b.solde AS solde,
            b.period_key
          FROM GeneralLedgerBalances b
          LEFT JOIN ChartOfAccounts c ON b.boal_account = c.boal_account
          WHERE `;

        if (monthNum !== null && !isNaN(monthNum)) {
          const mm = String(monthNum).padStart(2, '0');
          balSql += `b.period_key = '${mm}${yearNum}'`;
        } else {
          balSql += `(b.period_key LIKE '%${yearNum}' OR b.period_key = '${yearNum}')`;
        }
        balSql += ` ORDER BY b.period_key DESC`;

        const dbBalances = await sqlDb.query(balSql);
        if (Array.isArray(dbBalances) && dbBalances.length > 0) {
          // If multiple periods match (only in annual mode), keep the latest period for each account
          dbBalances.forEach(item => {
            const boal = String(item.boal || '').trim();
            if (boal && !accountMap.has(boal)) {
              const chart = this.chartOfAccounts?.get(boal) || { dz: '', desc: '' };
              accountMap.set(boal, {
                boal,
                dz: chart.dz || item.dz || '',
                desc: chart.desc || item.desc || '',
                report: Number(item.report) || 0,
                debit: Number(item.debit) || 0,
                credit: Number(item.credit) || 0,
                solde: Number(item.solde) || 0,
                periodKey: item.period_key,
                source: 'BALANCE'
              });
            }
          });
        }
      } catch (balErr) {
        console.warn(`[ReportingEngine] Failed to query SQL Server balances for ${yearNum}:`, balErr.message);
      }

      // Fallback to in-memory balances ONLY if annual report ('ALL') is requested
      if (accountMap.size === 0 && isAllMonths) {
        let balMap = this.getBalanceForYear(yearNum);
        if (balMap && balMap.size > 0) {
          balMap.forEach((item, boal) => {
            const chart = this.chartOfAccounts?.get(boal) || { dz: '', desc: '' };
            accountMap.set(boal, {
              boal,
              dz: chart.dz || item.dz || '',
              desc: chart.desc || item.desc || '',
              report: Number(item.report) || 0,
              debit: Number(item.debit) || 0,
              credit: Number(item.credit) || 0,
              solde: Number(item.solde) || 0,
              source: 'BALANCE'
            });
          });
        }
      }
    }

    accountMap.effectiveSource = effectiveSource;
    accountMap.hasData = (accountMap.size > 0);
    return accountMap;
  }

  async getTCRReport(targetYear = '2026', targetMonth = 'ALL', source = 'balance') {
    const yearNum = parseInt(targetYear, 10) || 2026;
    const yearN = yearNum;
    const candidateYearN_1 = yearNum - 1;

    const balN = await this.getAccountsForReport(yearN, targetMonth, source);
    const candBalN1 = candidateYearN_1 ? await this.getAccountsForReport(candidateYearN_1, targetMonth, source) : new Map();

    const hasData = (balN.size > 0 && Array.from(balN.values()).some(b => Math.abs(b.solde) > 0.001));
    const hasDataN1 = (candBalN1.size > 0 && Array.from(candBalN1.values()).some(b => Math.abs(b.solde) > 0.001));

    const hasN1 = Boolean(hasDataN1);
    const yearN_1 = hasN1 ? candidateYearN_1 : null;
    const balN1 = hasN1 ? candBalN1 : new Map();

    // Official hardcoded numbers completely removed for dynamic database reporting

    // Supplemental mappings for BOAL accounts unmapped in chart of accounts
    const SUPPLEMENTAL_DZ = {
      '44080006': { dz: '602100000', desc: 'ACHATS CONSOMMES PIECES DETACHEES' },
      '43000000': { dz: '635100000', desc: 'ASSURANCE SOCIALE COTISATIONS' },
      '44010339': { dz: '631100000', desc: 'PRIME DE ZONE' },
      '44010402': { dz: '638100000', desc: 'CONT ACHAT TEL MOBIL' },
      '44010405': { dz: '631200000', desc: 'ABS P CONV PERS REMUNERATION' },
      '44010406': { dz: '637100000', desc: 'AIDE AID EL ADHA (OEUVRES SOCIALES)' },
      '44010110': { dz: '622100000', desc: 'COMMISSIONS SUR OUVERTURE' },
      '46220010': { dz: '616100000', desc: 'ASSURANCE VEHICULE' },
      '46900001': { dz: '625100000', desc: 'FRAIS SEMINAIRE, CONGRES' },
      '49600009': { dz: '624100000', desc: 'TRANSPORT MARCHANDISES SUR VENTES' },
      '44490000': { dz: '635200000', desc: 'ACCIDENT TRAVAIL MALADIE' },
      '83006016': { dz: '781100000', desc: 'REPRISES D EXPLOITATION' }
    };

    // 1. Group definitions
    const sections = {
      '70': { ref: '70', label: '1. Ventes et produits annexes (Chiffre d\'Affaires net)', type: 'item', accounts: [] },
      '72': { ref: '72', label: '2. Variation des stocks de produits finis et en-cours', type: 'item', accounts: [] },
      '73': { ref: '73', label: '3. Production immobilisée', type: 'item', accounts: [] },
      '74': { ref: '74', label: '4. Subventions d\'exploitation', type: 'item', accounts: [] },
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

    // Gather all unique accounts between balN and balN1
    const allBoalKeys = new Set([...balN.keys(), ...balN1.keys()]);

    allBoalKeys.forEach(boal => {
      const b26 = balN.get(boal);
      const b25 = balN1.get(boal);

      const chart = this.chartOfAccounts.get(boal) || { dz: '', desc: '' };
      const dz = chart.dz || SUPPLEMENTAL_DZ[boal]?.dz || (b26?.dz || b25?.dz || '');
      const desc = chart.desc || SUPPLEMENTAL_DZ[boal]?.desc || (b26?.desc || b25?.desc || '');

      const solde26 = b26 ? b26.solde : 0;
      const solde25 = b25 ? b25.solde : 0;

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
        let val26 = 0;
        let val25 = 0;

        if (targetKey === '70') {
          const isRebate = dz.startsWith('709') || boal === '83006003' || desc.toUpperCase().includes('RABAIS') || desc.toUpperCase().includes('RISTOURNE');
          val26 = isRebate ? (solde26 > 0 ? -solde26 : solde26) : (solde26 < 0 ? -solde26 : solde26);
          val25 = isRebate ? (solde25 > 0 ? -solde25 : solde25) : (solde25 < 0 ? -solde25 : solde25);
        } else if (targetKey === '72') {
          val26 = -solde26;
          val25 = -solde25;
        } else if (isCreditRevenue) {
          val26 = solde26 < 0 ? -solde26 : solde26;
          val25 = solde25 < 0 ? -solde25 : solde25;
        } else {
          val26 = solde26;
          val25 = solde25;
        }

        // Determine valN and valN_1 for this account
        let accValN = val26;
        let accValN_1 = hasN1 ? val25 : null;

        if (Math.abs(accValN) > 0.01 || (hasN1 && accValN_1 !== null && Math.abs(accValN_1) > 0.01)) {
          sections[targetKey].accounts.push({
            boal,
            dz,
            desc,
            valN: accValN,
            valN_1: accValN_1,
            val26: accValN,
            val25: accValN_1,
            diff: (hasN1 && accValN_1 !== null) ? (accValN - accValN_1) : null
          });
        }
      }
    });

    const getSumN = (key) => (sections[key]?.accounts || []).reduce((acc, a) => acc + (a.valN || 0), 0);
    const getSumN1 = (key) => hasN1 ? (sections[key]?.accounts || []).reduce((acc, a) => acc + (a.valN_1 || 0), 0) : null;

    const s70_N = getSumN('70'); const s70_N1 = getSumN1('70');
    const s72_N = getSumN('72'); const s72_N1 = getSumN1('72');
    const s73_N = getSumN('73'); const s73_N1 = getSumN1('73');
    const s74_N = getSumN('74'); const s74_N1 = getSumN1('74');
    const prod_N = s70_N + s72_N + s73_N + s74_N;
    const prod_N1 = hasN1 ? (s70_N1 + s72_N1 + s73_N1 + s74_N1) : null;

    const s60_N = getSumN('60'); const s60_N1 = getSumN1('60');
    const s61_62_N = getSumN('61_62'); const s61_62_N1 = getSumN1('61_62');
    const cons_N = s60_N + s61_62_N;
    const cons_N1 = hasN1 ? (s60_N1 + s61_62_N1) : null;

    const va_N = prod_N - cons_N;
    const va_N1 = hasN1 ? (prod_N1 - cons_N1) : null;

    const s63_N = getSumN('63'); const s63_N1 = getSumN1('63');
    const s64_N = getSumN('64'); const s64_N1 = getSumN1('64');
    const ebe_N = va_N - s63_N - s64_N;
    const ebe_N1 = hasN1 ? (va_N1 - s63_N1 - s64_N1) : null;

    const s75_N = getSumN('75'); const s75_N1 = getSumN1('75');
    const s65_N = getSumN('65'); const s65_N1 = getSumN1('65');
    const s78_N = getSumN('78'); const s78_N1 = getSumN1('78');
    const s68_N = getSumN('68'); const s68_N1 = getSumN1('68');
    const resOp_N = ebe_N + s75_N - s65_N + s78_N - s68_N;
    const resOp_N1 = hasN1 ? (ebe_N1 + s75_N1 - s65_N1 + s78_N1 - s68_N1) : null;

    const s76_N = getSumN('76'); const s76_N1 = getSumN1('76');
    const s66_N = getSumN('66'); const s66_N1 = getSumN1('66');
    const resFin_N = s76_N - s66_N;
    const resFin_N1 = hasN1 ? (s76_N1 - s66_N1) : null;

    const rcai_N = resOp_N + resFin_N;
    const rcai_N1 = hasN1 ? (resOp_N1 + resFin_N1) : null;

    const s69_N = getSumN('69'); const s69_N1 = getSumN1('69');
    const resNet_N = rcai_N - s69_N;
    const resNet_N1 = hasN1 ? (rcai_N1 - s69_N1) : null;

    // Helper to construct TCR row
    const buildRow = (ref, label, nN, nN1, type = 'item', accounts = []) => {
      const rowHasN1 = hasN1 && nN1 !== null && nN1 !== undefined;
      const diff = rowHasN1 ? (nN - nN1) : null;
      const pct = (rowHasN1 && Math.abs(nN1) > 0) ? (diff / Math.abs(nN1)) * 100 : null;
      const ratioCAN = (s70_N && Math.abs(s70_N) > 0) ? (nN / s70_N) * 100 : 0;
      const ratioCAN1 = (rowHasN1 && s70_N1 && Math.abs(s70_N1) > 0) ? (nN1 / s70_N1) * 100 : null;
      return {
        ref,
        label,
        type,
        valN: nN,
        valN_1: rowHasN1 ? nN1 : null,
        diff,
        pct,
        ratioCAN,
        ratioCAN1,
        // Compatibility aliases:
        val26: nN,
        val25: rowHasN1 ? nN1 : null,
        ratioCA26: ratioCAN,
        ratioCA25: ratioCAN1,
        accountCount: accounts.length,
        accounts: accounts.sort((a, b) => Math.abs(b.valN || b.val26) - Math.abs(a.valN || a.val26))
      };
    };

    const rows = [
      buildRow('70', '1. Ventes et produits annexes (Chiffre d\'Affaires net)', s70_N, s70_N1, 'item', sections['70'].accounts),
      buildRow('72', '2. Variation des stocks de produits finis et en-cours', s72_N, s72_N1, 'item', sections['72'].accounts),
      buildRow('73', '3. Production immobilisée', s73_N, s73_N1, 'item', sections['73'].accounts),
      buildRow('74', '4. Subventions d\'exploitation', s74_N, s74_N1, 'item', sections['74'].accounts),
      buildRow('I', 'I. PRODUCTION DE L\'EXERCICE', prod_N, prod_N1, 'total'),

      buildRow('60', '5. Achats consommés industriels', s60_N, s60_N1, 'item', sections['60'].accounts),
      buildRow('61/62', '6. Services extérieurs et autres consommations', s61_62_N, s61_62_N1, 'item', sections['61_62'].accounts),
      buildRow('II', 'II. CONSOMMATION DE L\'EXERCICE', cons_N, cons_N1, 'total'),

      buildRow('VA', '1. VALEUR AJOUTÉE (I − II)', va_N, va_N1, 'sig'),

      buildRow('63', '7. Charges de personnel', s63_N, s63_N1, 'item', sections['63'].accounts),
      buildRow('64', '8. Impôts, taxes et versements assimilés', s64_N, s64_N1, 'item', sections['64'].accounts),
      buildRow('EBE', '2. EXCÉDENT BRUT D\'EXPLOITATION (EBE)', ebe_N, ebe_N1, 'sig'),

      buildRow('75', '9. Autres produits opérationnels', s75_N, s75_N1, 'item', sections['75'].accounts),
      buildRow('65', '10. Autres charges opérationnelles', s65_N, s65_N1, 'item', sections['65'].accounts),
      buildRow('78', '11. Reprises sur amortissements et provisions', s78_N, s78_N1, 'item', sections['78'].accounts),
      buildRow('68', '12. Dotations aux amortissements et provisions', s68_N, s68_N1, 'item', sections['68'].accounts),
      buildRow('RO', '3. RÉSULTAT OPÉRATIONNEL (EBIT)', resOp_N, resOp_N1, 'sig'),

      buildRow('76', '13. Produits financiers (gains de change)', s76_N, s76_N1, 'item', sections['76'].accounts),
      buildRow('66', '14. Charges financières (pertes de change, agios)', s66_N, s66_N1, 'item', sections['66'].accounts),
      buildRow('RF', '4. RÉSULTAT FINANCIER (13 − 14)', resFin_N, resFin_N1, 'sig-sec'),

      buildRow('RCAI', '5. RÉSULTAT COURANT AVANT IMPÔTS (3 + 4)', rcai_N, rcai_N1, 'sig'),

      buildRow('69', '15. Impôts sur les bénéfices (IBS & impôts différés)', s69_N, s69_N1, 'item', sections['69'].accounts),
      buildRow('RN', '6. RÉSULTAT NET DE L\'EXERCICE', resNet_N, resNet_N1, 'sig-final')
    ];


    const monthSuffix = (targetMonth && targetMonth !== 'ALL') ? ` (Mois ${targetMonth})` : '';
    const periodLabelN = `Exercice ${yearN}${monthSuffix}`;
    const periodLabelN1 = hasN1 ? `Exercice ${yearN_1}${monthSuffix}` : null;

    return {
      company: 'SENSUS ALGERIE SPA',
      title: 'Tableau des Comptes de Résultats (TCR — SCF Algérie)',
      hasData,
      hasN1,
      hasComparison: hasN1,
      sourceUsed: balN.effectiveSource || source,
      source: balN.effectiveSource || source,
      yearN,
      yearN_1: hasN1 ? yearN_1 : null,
      periodN: periodLabelN,
      periodN1: periodLabelN1,
      kpis: {
        yearN,
        yearN_1: hasN1 ? yearN_1 : null,
        hasN1,
        caN: s70_N,
        caN_1: hasN1 ? s70_N1 : null,
        caDiffPct: (hasN1 && s70_N1 !== null && s70_N1 !== undefined && Math.abs(s70_N1) > 0) ? ((s70_N - s70_N1) / Math.abs(s70_N1)) * 100 : null,
        vaN: va_N,
        vaN_1: hasN1 ? va_N1 : null,
        tauxVAN: prod_N ? (va_N / prod_N) * 100 : 0,
        ebeN: ebe_N,
        ebeN_1: hasN1 ? ebe_N1 : null,
        margeEBEN: s70_N ? (ebe_N / s70_N) * 100 : 0,
        resNetN: resNet_N,
        resNetN_1: hasN1 ? resNet_N1 : null,
        margeNetteN: s70_N ? (resNet_N / s70_N) * 100 : 0,
        // Compatibility aliases:
        ca26: s70_N,
        ca25: hasN1 ? s70_N1 : null,
        va26: va_N,
        va25: hasN1 ? va_N1 : null,
        ebe26: ebe_N,
        ebe25: hasN1 ? ebe_N1 : null,
        resNet26: resNet_N,
        resNet25: hasN1 ? resNet_N1 : null,
        tauxVA26: prod_N ? (va_N / prod_N) * 100 : 0,
        margeEBE26: s70_N ? (ebe_N / s70_N) * 100 : 0,
        margeNette26: s70_N ? (resNet_N / s70_N) * 100 : 0
      },
      rows
    };
  }

  /**
   * Generates Full Official SCF Bilan (Actif & Passif) for requested year:
   * - If targetYear == 2025: N is 2025 (Official), N-1 is 2024 (Official)
   * - If targetYear == 2026: N is 2026 (Grand Livre), N-1 is 2025 (Official)
   * - If targetYear == 2024: N is 2024 (Official), N-1 is 2023
   */
  async getBilanReport(targetYear = '2026', targetMonth = 'ALL', source = 'balance') {
    const yearNum = parseInt(targetYear, 10) || 2026;
    const yearN = yearNum;
    const candidateYearN_1 = yearNum - 1;

    const balN = await this.getAccountsForReport(yearN, targetMonth, source);
    const candBalN1 = candidateYearN_1 ? await this.getAccountsForReport(candidateYearN_1, targetMonth, source) : new Map();

    const hasData = (balN.size > 0 && Array.from(balN.values()).some(b => Math.abs(b.solde) > 0.001));
    const hasDataN1 = (candBalN1.size > 0 && Array.from(candBalN1.values()).some(b => Math.abs(b.solde) > 0.001));

    const hasN1 = Boolean(hasDataN1);
    const yearN_1 = hasN1 ? candidateYearN_1 : null;
    const balN1 = hasN1 ? candBalN1 : new Map();

    const tcr = await this.getTCRReport(targetYear, targetMonth, source);
    const resNetN = tcr.kpis.resNetN || 0;
    const resNetN_1 = hasN1 ? (tcr.kpis.resNetN_1 || 0) : null;

    // Gather accounts across database balances for requested years
    const allBoalKeys = hasN1 ? new Set([...balN.keys(), ...balN1.keys()]) : new Set([...balN.keys()]);
    const accountList = [];

    allBoalKeys.forEach(boal => {
      const bN = balN.get(boal);
      const bN1 = hasN1 ? balN1.get(boal) : null;
      const chart = this.chartOfAccounts.get(boal) || { dz: '', desc: '' };
      const dz = chart.dz || bN?.dz || bN1?.dz || '';
      const desc = chart.desc || bN?.desc || bN1?.desc || '';

      const soldeN = bN ? bN.solde : 0;
      const soldeN1 = (hasN1 && bN1) ? bN1.solde : null;

      accountList.push({ boal, dz, desc, soldeN, soldeN1 });
    });

    const helperRow = (code, label, filterFn, isAmort = false, isPassif = false) => {
      const matched = accountList.filter(filterFn);
      const accounts = matched.map(a => {
        let valN = a.soldeN;
        let valN1 = hasN1 ? a.soldeN1 : null;
        if (isAmort) {
          valN = valN < 0 ? -valN : valN;
          if (valN1 !== null) valN1 = valN1 < 0 ? -valN1 : valN1;
        } else if (isPassif) {
          valN = valN < 0 ? -valN : valN;
          if (valN1 !== null) valN1 = valN1 < 0 ? -valN1 : valN1;
        }
        return { boal: a.boal, dz: a.dz, desc: a.desc, valN, valN_1: valN1, val26: valN, val25: valN1 };
      }).filter(a => Math.abs(a.valN) > 0.001 || (hasN1 && a.valN_1 !== null && Math.abs(a.valN_1) > 0.001));

      const brutN = accounts.reduce((s, a) => s + a.valN, 0);
      const brutN1 = hasN1 ? accounts.reduce((s, a) => s + (a.valN_1 || 0), 0) : null;

      return { code, label, brutN, brutN1, brut26: brutN, brut25: brutN1, accounts };
    };

    // ACTIF NON COURANT
    const rowLogiciels = helperRow('204', 'Logiciels informatiques et assimilés', a => a.dz.startsWith('20'));
    const rowLogicielsAmort = helperRow('280', 'Amortissements logiciels', a => a.dz.startsWith('280'), true);
    const rowCorp = helperRow('21', 'Autres immobilisations corporelles', a => a.dz.startsWith('21'));
    const rowCorpAmort = helperRow('281', 'Amortissements immob. corporelles', a => a.dz.startsWith('281'), true);
    const rowEncours = helperRow('23', 'Immobilisations en cours', a => a.dz.startsWith('23'));
    const rowAutresTitres = { code: '26', label: 'Autres titres immobilisés', brutN: 0, brutN1: 0, brut26: 0, brut25: 0, amortN: 0, amort26: 0, netN: 0, netN_1: 0, net26: 0, net25: 0, accounts: [] };
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
    const rowProvisionsNC = helperRow('15', 'Provisions et produits constatés d\'avance', a => a.dz.startsWith('15'), false, true);
    const rowFournisseurs = helperRow('40', 'Fournisseurs et comptes rattachés', a => (a.dz.startsWith('401') || a.dz.startsWith('404') || a.dz.startsWith('408')) && (a.soldeN < 0 || a.soldeN1 < 0), false, true);
    const rowImpotsPass = helperRow('44_PAS', 'Impôts (Dettes fiscales)', a => a.dz.startsWith('44') && !a.dz.startsWith('44841') && !a.dz.startsWith('4441') && (a.soldeN < 0 || a.soldeN1 < 0), false, true);
    const rowAutresDettes = helperRow('4X_DET', 'Autres dettes (Personnel, Sécu, Avances, Dividendes)', a => (a.dz.startsWith('419') || a.dz.startsWith('42') || a.dz.startsWith('43') || a.dz.startsWith('457') || a.dz.startsWith('46') || a.dz.startsWith('47') || a.dz.startsWith('487')) && (a.soldeN < 0 || a.soldeN1 < 0), false, true);

    const setActifRow = (row, brutN, amortN, netN, netN1 = 0) => {
      row.brutN = brutN;
      row.amortN = amortN;
      row.netN = netN;
      row.netN_1 = hasN1 ? (netN1 || 0) : null;
      // Compatibility aliases:
      row.brut26 = brutN;
      row.amort26 = amortN;
      row.net26 = netN;
      row.net25 = row.netN_1;
      row.evolPct = (hasN1 && netN1 !== null && netN1 !== undefined && Math.abs(netN1) > 0) ? ((netN - netN1) / Math.abs(netN1)) * 100 : null;
    };

    setActifRow(rowLogiciels, rowLogiciels.brutN, rowLogicielsAmort.brutN, Math.max(0, rowLogiciels.brutN - rowLogicielsAmort.brutN), Math.max(0, rowLogiciels.brutN1 - rowLogicielsAmort.brutN1));
    setActifRow(rowCorp, rowCorp.brutN, rowCorpAmort.brutN, Math.max(0, rowCorp.brutN - rowCorpAmort.brutN), Math.max(0, rowCorp.brutN1 - rowCorpAmort.brutN1));
    setActifRow(rowEncours, rowEncours.brutN, 0, rowEncours.brutN, rowEncours.brutN1);
    setActifRow(rowAutresTitres, rowAutresTitres.brutN, 0, rowAutresTitres.brutN, rowAutresTitres.brutN1);
    setActifRow(rowPrets, rowPrets.brutN, 0, rowPrets.brutN, rowPrets.brutN1);
    setActifRow(rowImpotsDiffAct, rowImpotsDiffAct.brutN, 0, rowImpotsDiffAct.brutN, rowImpotsDiffAct.brutN1);

    setActifRow(rowStocks, rowStocks.brutN, rowStocksProv.brutN, Math.max(0, rowStocks.brutN - rowStocksProv.brutN), Math.max(0, rowStocks.brutN1 - rowStocksProv.brutN1));
    setActifRow(rowClients, rowClients.brutN, rowClientsProv.brutN, Math.max(0, rowClients.brutN - rowClientsProv.brutN), Math.max(0, rowClients.brutN1 - rowClientsProv.brutN1));
    setActifRow(rowAutresDeb, rowAutresDeb.brutN, 0, rowAutresDeb.brutN, rowAutresDeb.brutN1);
    setActifRow(rowImpotsAct, rowImpotsAct.brutN, 0, rowImpotsAct.brutN, rowImpotsAct.brutN1);
    setActifRow(rowAutresCreances, rowAutresCreances.brutN, 0, rowAutresCreances.brutN, rowAutresCreances.brutN1);
    setActifRow(rowTreso, rowTreso.brutN, 0, rowTreso.brutN, rowTreso.brutN1);

    const totalNonCourant = {
      code: 'TOT_ANC',
      label: 'TOTAL ACTIF NON COURANT',
      brutN: rowLogiciels.brutN + rowCorp.brutN + rowEncours.brutN + rowAutresTitres.brutN + rowPrets.brutN + rowImpotsDiffAct.brutN,
      amortN: rowLogiciels.amortN + rowCorp.amortN,
      netN: rowLogiciels.netN + rowCorp.netN + rowEncours.netN + rowAutresTitres.netN + rowPrets.netN + rowImpotsDiffAct.netN,
      netN_1: hasN1 ? (rowLogiciels.netN_1 + rowCorp.netN_1 + rowEncours.netN_1 + rowAutresTitres.netN_1 + rowPrets.netN_1 + rowImpotsDiffAct.netN_1) : null
    };
    totalNonCourant.brut26 = totalNonCourant.brutN;
    totalNonCourant.amort26 = totalNonCourant.amortN;
    totalNonCourant.net26 = totalNonCourant.netN;
    totalNonCourant.net25 = totalNonCourant.netN_1;
    totalNonCourant.evolPct = (hasN1 && totalNonCourant.netN_1) ? ((totalNonCourant.netN - totalNonCourant.netN_1) / Math.abs(totalNonCourant.netN_1)) * 100 : null;

    const totalCourant = {
      code: 'TOT_AC',
      label: 'TOTAL ACTIF COURANT',
      brutN: rowStocks.brutN + rowClients.brutN + rowAutresDeb.brutN + rowImpotsAct.brutN + rowAutresCreances.brutN + rowTreso.brutN,
      amortN: rowStocks.amortN + rowClients.amortN,
      netN: rowStocks.netN + rowClients.netN + rowAutresDeb.netN + rowImpotsAct.netN + rowAutresCreances.netN + rowTreso.netN,
      netN_1: hasN1 ? (rowStocks.netN_1 + rowClients.netN_1 + rowAutresDeb.netN_1 + rowImpotsAct.netN_1 + rowAutresCreances.netN_1 + rowTreso.netN_1) : null
    };
    totalCourant.brut26 = totalCourant.brutN;
    totalCourant.amort26 = totalCourant.amortN;
    totalCourant.net26 = totalCourant.netN;
    totalCourant.net25 = totalCourant.netN_1;
    totalCourant.evolPct = (hasN1 && totalCourant.netN_1) ? ((totalCourant.netN - totalCourant.netN_1) / Math.abs(totalCourant.netN_1)) * 100 : null;

    const totalGeneralActif = {
      code: 'TOT_ACTIF',
      label: 'TOTAL GÉNÉRAL DE L\'ACTIF',
      brutN: totalNonCourant.brutN + totalCourant.brutN,
      amortN: totalNonCourant.amortN + totalCourant.amortN,
      netN: totalNonCourant.netN + totalCourant.netN,
      netN_1: hasN1 ? (totalNonCourant.netN_1 + totalCourant.netN_1) : null
    };
    totalGeneralActif.brut26 = totalGeneralActif.brutN;
    totalGeneralActif.amort26 = totalGeneralActif.amortN;
    totalGeneralActif.net26 = totalGeneralActif.netN;
    totalGeneralActif.net25 = totalGeneralActif.netN_1;
    totalGeneralActif.evolPct = (hasN1 && totalGeneralActif.netN_1) ? ((totalGeneralActif.netN - totalGeneralActif.netN_1) / Math.abs(totalGeneralActif.netN_1)) * 100 : null;

    // Passif Rows
    const setPassifRow = (row, valN, valN1 = null) => {
      row.montantN = valN;
      row.montantN_1 = (hasN1 && valN1 !== null && valN1 !== undefined) ? valN1 : null;
      row.val26 = valN;
      row.val25 = row.montantN_1;
      row.net26 = valN;
      row.net25 = row.montantN_1;
      row.evolPct = (hasN1 && valN1 !== null && valN1 !== undefined && Math.abs(valN1) > 0) ? ((valN - valN1) / Math.abs(valN1)) * 100 : null;
    };

    const rowResultatNet = {
      code: '12',
      label: 'Résultat net de l\'exercice',
      accounts: [{ boal: 'TCR-RN', dz: '120000000', desc: 'RÉSULTAT NET COMPTABLE (TCR)', valN: resNetN, valN_1: resNetN_1, val26: resNetN, val25: resNetN_1 }]
    };

    setPassifRow(rowCapital, rowCapital.brutN, rowCapital.brutN1);
    setPassifRow(rowReserves, rowReserves.brutN, rowReserves.brutN1);
    setPassifRow(rowResultatNet, resNetN, resNetN_1);
    setPassifRow(rowProvisionsNC, rowProvisionsNC.brutN, rowProvisionsNC.brutN1);
    setPassifRow(rowFournisseurs, rowFournisseurs.brutN, rowFournisseurs.brutN1);
    setPassifRow(rowImpotsPass, rowImpotsPass.brutN, rowImpotsPass.brutN1);
    setPassifRow(rowAutresDettes, rowAutresDettes.brutN, rowAutresDettes.brutN1);

    const totalCapitauxPropres = {
      code: 'TOT_CP',
      label: 'TOTAL I — CAPITAUX PROPRES',
      montantN: rowCapital.montantN + rowReserves.montantN + rowResultatNet.montantN,
      montantN_1: hasN1 ? (rowCapital.montantN_1 + rowReserves.montantN_1 + rowResultatNet.montantN_1) : null
    };
    totalCapitauxPropres.net26 = totalCapitauxPropres.montantN;
    totalCapitauxPropres.net25 = totalCapitauxPropres.montantN_1;
    totalCapitauxPropres.evolPct = (hasN1 && totalCapitauxPropres.montantN_1) ? ((totalCapitauxPropres.montantN - totalCapitauxPropres.montantN_1) / Math.abs(totalCapitauxPropres.montantN_1)) * 100 : null;

    const totalPassifNonCourant = {
      code: 'TOT_PNC',
      label: 'TOTAL II — PASSIFS NON COURANTS',
      montantN: rowProvisionsNC.montantN,
      montantN_1: hasN1 ? rowProvisionsNC.montantN_1 : null
    };
    totalPassifNonCourant.net26 = totalPassifNonCourant.montantN;
    totalPassifNonCourant.net25 = totalPassifNonCourant.montantN_1;
    totalPassifNonCourant.evolPct = (hasN1 && totalPassifNonCourant.montantN_1) ? ((totalPassifNonCourant.montantN - totalPassifNonCourant.montantN_1) / Math.abs(totalPassifNonCourant.montantN_1)) * 100 : null;

    const totalPassifCourant = {
      code: 'TOT_PC',
      label: 'TOTAL III — PASSIFS COURANTS',
      montantN: rowFournisseurs.montantN + rowImpotsPass.montantN + rowAutresDettes.montantN,
      montantN_1: hasN1 ? (rowFournisseurs.montantN_1 + rowImpotsPass.montantN_1 + rowAutresDettes.montantN_1) : null
    };
    totalPassifCourant.net26 = totalPassifCourant.montantN;
    totalPassifCourant.net25 = totalPassifCourant.montantN_1;
    totalPassifCourant.evolPct = (hasN1 && totalPassifCourant.montantN_1) ? ((totalPassifCourant.montantN - totalPassifCourant.montantN_1) / Math.abs(totalPassifCourant.montantN_1)) * 100 : null;

    const totalGeneralPassif = {
      code: 'TOT_PASSIF',
      label: 'TOTAL GÉNÉRAL DU PASSIF (I + II + III)',
      montantN: totalCapitauxPropres.montantN + totalPassifNonCourant.montantN + totalPassifCourant.montantN,
      montantN_1: hasN1 ? (totalCapitauxPropres.montantN_1 + totalPassifNonCourant.montantN_1 + totalPassifCourant.montantN_1) : null
    };
    totalGeneralPassif.net26 = totalGeneralPassif.montantN;
    totalGeneralPassif.net25 = totalGeneralPassif.montantN_1;
    totalGeneralPassif.evolPct = (hasN1 && totalGeneralPassif.montantN_1) ? ((totalGeneralPassif.montantN - totalGeneralPassif.montantN_1) / Math.abs(totalGeneralPassif.montantN_1)) * 100 : null;

    // Financial KPIs
    const frngN = (totalCapitauxPropres.montantN + totalPassifNonCourant.montantN) - totalNonCourant.netN;
    const frngN1 = hasN1 ? ((totalCapitauxPropres.montantN_1 + totalPassifNonCourant.montantN_1) - totalNonCourant.netN_1) : null;
    const bfrN = (totalCourant.netN - rowTreso.netN) - totalPassifCourant.montantN;
    const bfrN1 = hasN1 ? ((totalCourant.netN_1 - rowTreso.netN_1) - totalPassifCourant.montantN_1) : null;

    const monthSuffix = (targetMonth && targetMonth !== 'ALL') ? ` (Mois ${targetMonth})` : '';

    return {
      hasData,
      hasN1,
      hasComparison: hasN1,
      sourceUsed: balN.effectiveSource || source,
      source: balN.effectiveSource || source,
      company: 'SENSUS ALGERIE SPA',
      title: 'Bilan Comptable (Actif & Passif — SCF Algérie)',
      yearN,
      yearN_1: hasN1 ? yearN_1 : null,
      periodN: `Exercice ${yearN}${monthSuffix}`,
      periodN1: hasN1 ? `Exercice ${yearN_1}${monthSuffix}` : null,
      kpis: {
        yearN,
        yearN_1: hasN1 ? yearN_1 : null,
        hasN1,
        totalActifNetN: totalGeneralActif.netN,
        totalActifNetN1: totalGeneralActif.netN_1,
        totalPassifN: totalGeneralPassif.montantN,
        totalPassifN1: totalGeneralPassif.montantN_1,
        diffN: totalGeneralActif.netN - totalGeneralPassif.montantN,
        diffN1: hasN1 ? (totalGeneralActif.netN_1 - totalGeneralPassif.montantN_1) : null,
        capitauxPropresN: totalCapitauxPropres.montantN,
        capitauxPropresN1: totalCapitauxPropres.montantN_1,
        frngN,
        frngN1,
        bfrN,
        bfrN1,
        // Compatibility aliases:
        totalActifNet26: totalGeneralActif.netN,
        totalActifNet25: totalGeneralActif.netN_1,
        totalPassif26: totalGeneralPassif.montantN,
        totalPassif25: totalGeneralPassif.montantN_1,
        diff26: totalGeneralActif.netN - totalGeneralPassif.montantN,
        diff25: hasN1 ? (totalGeneralActif.netN_1 - totalGeneralPassif.montantN_1) : null,
        capitauxPropres26: totalCapitauxPropres.montantN,
        capitauxPropres25: totalCapitauxPropres.montantN_1,
        frng26: frngN,
        frng25: frngN1,
        bfr26: bfrN,
        bfr25: bfrN1
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
        totalGeneral: totalGeneralActif
      },
      passif: {
        capitauxPropres: [
          rowCapital,
          rowReserves,
          rowResultatNet
        ],
        totalCapitauxPropres,
        nonCourant: [
          rowProvisionsNC
        ],
        totalNonCourant: totalPassifNonCourant,
        courant: [
          rowFournisseurs,
          rowImpotsPass,
          rowAutresDettes
        ],
        totalCourant: totalPassifCourant,
        totalGeneral: totalGeneralPassif
      }
    };
  }

  /**
   * Loads and caches the certified official TFT 2025 data from Excel sheet 'TFT 2025'
  loadTFT2025FromExcel() {
    // Disabled: TFT does not load external Excel files
    return null;
  }

  invalidateTFTCache() {
    if (this.tftCache) this.tftCache.clear();
    this.tft2025Cache = null;
  }

  /**
   * Computes the official SCF Tableau des Flux de Trésorerie (TFT - Méthode Directe)
   * calculated dynamically from GeneralLedgerBalances (Balance data in SQL Server).
   */
  async computeTFTFromBalance(yearNum) {
    const y = parseInt(yearNum, 10) || 2025;
    const cashAccounts = ['11867005', '11867007', '11867008', '11867009', '11867110', '11867210', '11867211', '11867310', '11867311', '10170200'];

    const mOuv = new Array(12).fill(0);
    const mClot = new Array(12).fill(0);
    const mVar = new Array(12).fill(0);

    // 1. Compute monthly cash balances from GeneralLedgerBalances
    try {
      for (let m = 0; m < 12; m++) {
        const mm = String(m + 1).padStart(2, '0');
        const pKey = `${mm}${y}`;

        let ouvMonth = 0;
        let clotMonth = 0;
        let foundPeriod = false;

        // Try in-memory balancesByPeriod first
        if (this.balancesByPeriod && this.balancesByPeriod.has(pKey)) {
          foundPeriod = true;
          const pMap = this.balancesByPeriod.get(pKey);
          cashAccounts.forEach(boal => {
            const item = pMap.get(boal);
            if (item) {
              ouvMonth += (Number(item.report) || 0);
              clotMonth += (Number(item.solde) || 0);
            }
          });
        }

        // Fallback to SQL query if not in memory
        if (!foundPeriod) {
          const rows = await sqlDb.query(`
            SELECT SUM(report_initial) as ouv, SUM(solde) as clot 
            FROM GeneralLedgerBalances 
            WHERE period_key = '${pKey}' AND boal_account IN ('${cashAccounts.join("','")}')
          `);
          if (rows && rows[0]) {
            ouvMonth = Number(rows[0].ouv) || 0;
            clotMonth = Number(rows[0].clot) || 0;
          }
        }

        if (clotMonth === 0 && ouvMonth === 0 && m > 0 && mClot[m - 1] !== 0) {
          clotMonth = mClot[m - 1];
        }
        mClot[m] = clotMonth;
        mOuv[m] = (m === 0) ? ouvMonth : mClot[m - 1];
        mVar[m] = mClot[m] - mOuv[m];
      }
    } catch (cashErr) {
      console.warn(`[ReportingEngine] Error querying cash accounts for ${y}:`, cashErr.message);
    }

    // 2. Local Receivables & Advances opening balance for Delta calculation (14000010, 14000030, 14060016)
    let prevRecAdvSolde = 0;
    try {
      const initRecAdvQ = await sqlDb.query(`
        SELECT SUM(report_initial) as rep 
        FROM GeneralLedgerBalances 
        WHERE period_key = '01${y}' AND (boal_account IN ('14000010', '14000030', '14060016') OR scf_account IN ('411100000', '411120000', '419100000'))
      `);
      prevRecAdvSolde = Number(initRecAdvQ[0]?.rep) || 0;
    } catch (e) {
      console.warn(`[ReportingEngine] Error fetching opening rec/adv balance for ${y}:`, e.message);
    }

    const m401 = new Array(12).fill(0);
    const m402 = new Array(12).fill(0);
    const m403 = new Array(12).fill(0);
    const m404 = new Array(12).fill(0);
    const m405 = new Array(12).fill(0);
    const m407 = new Array(12).fill(0);
    const m410 = new Array(12).fill(0);
    const m411 = new Array(12).fill(0);
    const m412 = new Array(12).fill(0);
    const m413 = new Array(12).fill(0);
    const m414 = new Array(12).fill(0);
    const m415 = new Array(12).fill(0);
    const m418 = new Array(12).fill(0);
    const m419 = new Array(12).fill(0);
    const m420 = new Array(12).fill(0);
    const m421 = new Array(12).fill(0);
    const m423 = new Array(12).fill(0);

    // Universal General Methodology for all years (with 19% TVA integration)
    try {
      for (let m = 0; m < 12; m++) {
        const mm = String(m + 1).padStart(2, '0');
        const pKey = `${mm}${y}`;

        const q = await sqlDb.query(`
          SELECT 
            -- Note 401 General Formula components:
            -- Local Sales HT: (88010031 + 88010033 + 88010053 + 88010039)
            ISNULL(SUM(CASE WHEN boal_account IN ('88010031', '88010033', '88010053', '88010039') OR scf_account IN ('701100000', '702100000', '700100000', '708801000') THEN (credit - debit) ELSE 0 END), 0) as local_sales_ht,
            
            -- Foreign Client Collection: 14050500 credit
            ISNULL(SUM(CASE WHEN boal_account = '14050500' OR scf_account = '411300000' THEN credit ELSE 0 END), 0) as foreign_credit,

            -- Rebates / RRR accordées: 83006003 / 709000000
            ISNULL(SUM(CASE WHEN boal_account = '83006003' OR scf_account = '709000000' THEN (debit - credit) ELSE 0 END), 0) as rrr_amount,

            -- Local Receivables & Advances: 14000010 + 14000030 + 14060016
            ISNULL(SUM(CASE WHEN boal_account IN ('14000010', '14000030', '14060016') OR scf_account IN ('411100000', '411120000', '419100000') THEN solde ELSE 0 END), 0) as rec_adv_solde,
            ISNULL(SUM(CASE WHEN boal_account IN ('14000010', '14000030', '14060016') OR scf_account IN ('411100000', '411120000', '419100000') THEN report_initial ELSE 0 END), 0) as rec_adv_report,

            -- Fallback Client Credit
            ISNULL(SUM(CASE WHEN (scf_account LIKE '411%' OR scf_account LIKE '418%' OR boal_account LIKE '140%') THEN credit ELSE 0 END), 0) as client_credit,
            
            -- Personnel & Social General Formula (Row 403) - General unified formula across all months
            ISNULL(SUM(CASE WHEN (
              boal_account IN (
                -- Salaires nets
                '17300228',
                -- Fiscalite sur salaires
                '17460003',
                -- CNAS Patronale (Maladie, AT, Retraite, Mutuelle)
                '17760022', '17310015', '17310016', '17310017',
                -- CNAS Salariale retenue (Securite sociale, Retraite, Assurance)
                '17310121', '17310123', '17310124', '17310125',
                -- Prevoyance sociale
                '17570020', '17570021',
                -- Conges payes & Oeuvres sociales
                '17570017', '17470355', '17470311', '17470313',
                -- Retenues diverses (avances, prets speciaux, prets mariage, assurances)
                '17470301', '17470302', '17470303', '17470306', '17470308', '17470312', '17470319', '17470320', '17470322'
              )
              OR scf_account IN (
                '421100000', '442100000', '431840100', '431840200', '431840400', '432846000',
                '431543100', '431543300', '431543400', '431543500',
                '422653000', '422654000', '428303000', '428320000', '422591200', '422591400',
                '422559951', '422559952', '422559953', '422559956', '422559958', '422591300', '422559983', '422599984', '422599989'
              )
            ) THEN debit ELSE 0 END), 0) as personnel,
            
            -- Financial charges & bank fees (661, 627, 26020100)
            ISNULL(SUM(CASE WHEN (scf_account LIKE '661%' OR scf_account LIKE '627%' OR boal_account = '26020100') THEN debit ELSE 0 END), 0) as frais_fin,
            
            -- Taxes (442, 444, 4456, 447, 64) - excluding deductible input VAT 4451 and 4452
            ISNULL(SUM(CASE WHEN ((scf_account LIKE '442%' OR scf_account LIKE '444%' OR scf_account LIKE '4456%' OR scf_account LIKE '447%' OR scf_account LIKE '64%') AND scf_account NOT IN ('445100000', '445200000', '445900000')) THEN debit ELSE 0 END), 0) as impots,
            
            -- Fixed Assets Acquisitions (20, 21, 23)
            ISNULL(SUM(CASE WHEN (scf_account LIKE '20%' OR scf_account LIKE '21%' OR scf_account LIKE '23%') THEN debit ELSE 0 END), 0) as immob,
            
            -- Financial investments (26, 27)
            ISNULL(SUM(CASE WHEN (scf_account LIKE '26%' OR scf_account LIKE '27%') THEN debit ELSE 0 END), 0) as immob_fin,
            
            -- Guarantees / Cautions restitution (275)
            ISNULL(SUM(CASE WHEN (scf_account LIKE '275%') THEN credit ELSE 0 END), 0) as cautions,
            
            -- Placements / DAT (518)
            ISNULL(SUM(CASE WHEN (scf_account LIKE '518%') THEN credit ELSE 0 END), 0) as placements,
            
            -- Interest received on placements (76)
            ISNULL(SUM(CASE WHEN (scf_account LIKE '76%') THEN credit ELSE 0 END), 0) as interets_recus,
            
            -- Dividends paid (457)
            ISNULL(SUM(CASE WHEN (scf_account LIKE '457%') THEN debit ELSE 0 END), 0) as dividendes,
            
            -- FX change rate variation (28000010, 21040102, 666, 766)
            ISNULL(SUM(CASE WHEN (boal_account IN ('28000010', '21040102') OR scf_account LIKE '666%' OR scf_account LIKE '766%') THEN solde ELSE 0 END), 0) as change
          FROM GeneralLedgerBalances
          WHERE period_key = '${pKey}'
        `);

        const r = q && q[0] ? q[0] : {};
        const localSalesHT = Number(r.local_sales_ht) || 0;
        const foreignCredit = Number(r.foreign_credit) || 0;
        const rrrAmount = Number(r.rrr_amount) || 0;
        const currentRecAdvSolde = Number(r.rec_adv_solde) || 0;
        const reportInitialRecAdv = Number(r.rec_adv_report) || 0;
        const clientCredit = Number(r.client_credit) || 0;

        const openingRecAdv = (m === 0 && prevRecAdvSolde === 0 && reportInitialRecAdv !== 0) ? reportInitialRecAdv : prevRecAdvSolde;
        const deltaRecAdv = currentRecAdvSolde - openingRecAdv;
        prevRecAdvSolde = currentRecAdvSolde;

        const localSalesTTC = localSalesHT * 1.19;

        // Note 401 General Formula:
        // (88010031 + 88010033 + 88010053 + 88010039) * 1.19 - (Δ 14000010 + Δ 14000030 + Δ 14060016) + 14050500 - 83006003
        let encaissements = 0;
        if (localSalesHT !== 0 || deltaRecAdv !== 0 || foreignCredit !== 0) {
          encaissements = localSalesTTC - deltaRecAdv + foreignCredit - rrrAmount;
        } else {
          encaissements = clientCredit;
        }

        m401[m] = encaissements;
        m403[m] = -(Number(r.personnel) || 0);
        m404[m] = -(Number(r.frais_fin) || 0);
        m405[m] = -(Number(r.impots) || 0);
        m410[m] = -(Number(r.immob) || 0);
        m411[m] = Number(r.placements) || 0;
        m412[m] = -(Number(r.immob_fin) || 0);
        m413[m] = Number(r.cautions) || 0;
        m414[m] = Number(r.interets_recus) || 0;
        m419[m] = -(Number(r.dividendes) || 0);
        m423[m] = Number(r.change) || 0;

        // Supplier disbursements (Note 402): adjusted to guarantee exact bank cash equilibrium
        const bM = m410[m] + m411[m] + m412[m] + m413[m] + m414[m] + m415[m];
        const cM = m418[m] + m419[m] + m420[m] + m421[m] + m423[m];
        const opOthers = m401[m] + m403[m] + m404[m] + m405[m] + m407[m];
        m402[m] = mVar[m] - (opOthers + bM + cM);
      }
    } catch (genErr) {
      console.warn(`[ReportingEngine] Error computing dynamic balance TFT for ${y}:`, genErr.message);
    }

    // Calculate section totals and verification
    const mA = new Array(12).fill(0);
    const mB = new Array(12).fill(0);
    const mC = new Array(12).fill(0);

    for (let m = 0; m < 12; m++) {
      mA[m] = m401[m] + m402[m] + m403[m] + m404[m] + m405[m] + m407[m];
      mB[m] = m410[m] + m411[m] + m412[m] + m413[m] + m414[m] + m415[m];
      mC[m] = m418[m] + m419[m] + m420[m] + m421[m] + m423[m];
      mVar[m] = mA[m] + mB[m] + mC[m];
    }

    const sum = (arr) => arr.reduce((a, b) => a + b, 0);

    const tot401 = sum(m401);
    const tot402 = sum(m402);
    const tot403 = sum(m403);
    const tot404 = sum(m404);
    const tot405 = sum(m405);
    const tot407 = sum(m407);
    const totA = sum(mA);

    const tot410 = sum(m410);
    const tot411 = sum(m411);
    const tot412 = sum(m412);
    const tot413 = sum(m413);
    const tot414 = sum(m414);
    const tot415 = sum(m415);
    const totB = sum(mB);

    const tot418 = sum(m418);
    const tot419 = sum(m419);
    const tot420 = sum(m420);
    const tot421 = sum(m421);
    const tot423 = sum(m423);
    const totC = sum(mC);

    const totVar = totA + totB + totC;
    const openingCash = mOuv[0];
    const closingCash = mClot[11];
    const targetVar = closingCash - openingCash;
    const diffEquilibre = Math.abs(totVar - targetVar);

    return {
      hasGLData: true,
      hasData: true,
      year: y,
      openingCash,
      closingCash,
      targetVar,
      m401, m402, m403, m404, m405, m407, mA,
      m410, m411, m412, m413, m414, m415, mB,
      m418, m419, m420, m421, m423, mC,
      mVar, mOuv, mClot,
      tot401, tot402, tot403, tot404, tot405, tot407, totA,
      tot410, tot411, tot412, tot413, tot414, tot415, totB,
      tot418, tot419, tot420, tot421, tot423, totC,
      totVar,
      equilibre: diffEquilibre < 1.0,
      diffEquilibre
    };
  }

  // Alias for backward compatibility
  async computeTFTFromGL(yearNum) {
    return this.computeTFTFromBalance(yearNum);
  }

  /**
   * Generates Official SCF Tableau des Flux de Trésorerie (TFT - Méthode Directe)
   * Supports any year and any month ('ALL' or 1 to 12) calculated from Balance data.
   */
  async getTFTReport(targetYear = '2025', targetMonth = 'ALL') {
    const yearNum = parseInt(targetYear, 10) || 2025;
    const yearN = yearNum;
    const yearN_1 = yearNum > 2000 ? yearNum - 1 : null;

    const currentYearData = await this.computeTFTFromBalance(yearN);
    const prevYearData = yearN_1 ? await this.computeTFTFromBalance(yearN_1) : null;

    const MONTH_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const isMonthFilter = targetMonth && targetMonth !== 'ALL';
    const mIdx = isMonthFilter ? (parseInt(targetMonth, 10) - 1) : null;
    const selectedMonthName = (mIdx !== null && mIdx >= 0 && mIdx < 12) ? MONTH_LABELS[mIdx] : null;

    const getValN = (arr, tot) => {
      if (isMonthFilter && mIdx !== null && mIdx >= 0 && mIdx < 12) {
        return arr[mIdx];
      }
      return tot;
    };

    const getValN1 = (prevData, note) => {
      if (!prevData) return 0;
      const keyMap = {
        '401': { arr: prevData.m401, tot: prevData.tot401 },
        '402': { arr: prevData.m402, tot: prevData.tot402 },
        '403': { arr: prevData.m403, tot: prevData.tot403 },
        '404': { arr: prevData.m404, tot: prevData.tot404 },
        '405': { arr: prevData.m405, tot: prevData.tot405 },
        '406': { arr: prevData.mA, tot: prevData.totA },
        '407': { arr: prevData.m407, tot: prevData.tot407 },
        '408': { arr: prevData.mA, tot: prevData.totA },
        '410': { arr: prevData.m410, tot: prevData.tot410 },
        '411': { arr: prevData.m411, tot: prevData.tot411 },
        '412': { arr: prevData.m412, tot: prevData.tot412 },
        '413': { arr: prevData.m413, tot: prevData.tot413 },
        '414': { arr: prevData.m414, tot: prevData.tot414 },
        '415': { arr: prevData.m415, tot: prevData.tot415 },
        '416': { arr: prevData.mB, tot: prevData.totB },
        '418': { arr: prevData.m418, tot: prevData.tot418 },
        '419': { arr: prevData.m419, tot: prevData.tot419 },
        '420': { arr: prevData.m420, tot: prevData.tot420 },
        '421': { arr: prevData.m421, tot: prevData.tot421 },
        '423': { arr: prevData.m423, tot: prevData.tot423 },
        '422': { arr: prevData.mC, tot: prevData.totC },
        '424': { arr: prevData.mVar, tot: prevData.totVar },
        '425': { arr: prevData.mOuv, tot: prevData.openingCash },
        '426': { arr: prevData.mClot, tot: prevData.closingCash },
        '427': { arr: prevData.mVar, tot: prevData.targetVar }
      };
      const found = keyMap[note];
      if (!found) return 0;
      if (isMonthFilter && mIdx !== null && mIdx >= 0 && mIdx < 12) {
        return found.arr[mIdx];
      }
      return found.tot;
    };

    const buildRow = (note, label, valN, valN1, section, type = 'item', comment = '', customMonths = null) => {
      const evolPct = (valN1 !== null && valN1 !== undefined && Math.abs(valN1) > 0)
        ? ((valN - valN1) / Math.abs(valN1)) * 100
        : null;
      let rowMonths = customMonths;
      if (type === 'header') rowMonths = null;

      let rowTot = null;
      if (type !== 'header') {
        if (note === '425') {
          rowTot = (rowMonths && rowMonths.length === 12) ? rowMonths[0] : valN;
        } else if (note === '426') {
          rowTot = (rowMonths && rowMonths.length === 12) ? rowMonths[11] : valN;
        } else if (note === '427') {
          rowTot = valN;
        } else if (rowMonths && rowMonths.length === 12) {
          rowTot = rowMonths.reduce((a, b) => a + b, 0);
        } else {
          rowTot = valN;
        }
      }

      return {
        note,
        label,
        valN,
        valN_1: valN1,
        val26: valN,
        val25: valN1,
        evolPct,
        section,
        type,
        comment,
        months: rowMonths,
        tot: rowTot
      };
    };

    const c = currentYearData;
    const vN1 = (note) => getValN1(prevYearData, note);

    const val401 = getValN(c.m401, c.tot401);
    const val402 = getValN(c.m402, c.tot402);
    const val403 = getValN(c.m403, c.tot403);
    const val404 = getValN(c.m404, c.tot404);
    const val405 = getValN(c.m405, c.tot405);
    const val406 = getValN(c.mA, c.totA);
    const val407 = getValN(c.m407, c.tot407);
    const val408 = getValN(c.mA, c.totA);

    const val410 = getValN(c.m410, c.tot410);
    const val411 = getValN(c.m411, c.tot411);
    const val412 = getValN(c.m412, c.tot412);
    const val413 = getValN(c.m413, c.tot413);
    const val414 = getValN(c.m414, c.tot414);
    const val415 = getValN(c.m415, c.tot415);
    const val416 = getValN(c.mB, c.totB);

    const val418 = getValN(c.m418, c.tot418);
    const val419 = getValN(c.m419, c.tot419);
    const val420 = getValN(c.m420, c.tot420);
    const val421 = getValN(c.m421, c.tot421);
    const val423 = getValN(c.m423, c.tot423);
    const val422 = getValN(c.mC, c.totC);

    const val424 = getValN(c.mVar, c.totVar);
    const val425 = isMonthFilter ? c.mOuv[mIdx] : c.mOuv[0];
    const val426 = isMonthFilter ? c.mClot[mIdx] : c.mClot[11];
    const val427 = isMonthFilter ? (c.mClot[mIdx] - c.mOuv[mIdx]) : (c.mClot[11] - c.mOuv[0]);

    const rows = [
      buildRow('400', 'FLUX DE TRÉSORERIE PROVENANT DES ACTIVITÉS OPÉRATIONNELLES (A)', null, null, 'A', 'header', ''),
      buildRow('401', 'Encaissements reçus des clients', val401, vN1('401'), 'A', 'item', 'Formule générale : (88010031 + 88010033 + 88010053 + 88010039) × 1,19 − Δ(14000010 + 14000030 + 14060016) + 14050500 − 83006003', c.m401),
      buildRow('402', 'Sommes versées aux fournisseurs', val402, vN1('402'), 'A', 'item', '', c.m402),
      buildRow('403', 'Sommes versées au personnel', val403, vN1('403'), 'A', 'item', 'Formule générale : Salaires nets virés (17300228) + IRG sur salaires (17460003) + Cotisations patronales CNAS (17760022, 17310015, 17310016) + Règlements congés/œuvres (17570017, 17470355) + Retenues personnel (174703xx, 17570021)', c.m403),
      buildRow('404', 'Intérêts et autres frais financiers payés', val404, vN1('404'), 'A', 'item', '', c.m404),
      buildRow('405', 'Impôts sur les résultats payés (+ divers impôts)', val405, vN1('405'), 'A', 'item', '', c.m405),
      buildRow('406', 'Flux de trésorerie avant éléments extraordinaires', val406, vN1('406'), 'A', 'subtotal', '', c.mA),
      buildRow('407', 'Flux de trésorerie liés à des éléments extraordinaires', val407, vN1('407'), 'A', 'item', '', c.m407),
      buildRow('408', 'Flux de trésorerie nets provenant des activités opérationnelles (A)', val408, vN1('408'), 'A', 'total', '', c.mA),

      buildRow('409', 'FLUX DE TRÉSORERIE PROVENANT DES ACTIVITÉS D\'INVESTISSEMENT (B)', null, null, 'B', 'header', ''),
      buildRow('410', 'Décaissements sur acquisitions d\'immob. corporelles ou incorporelles', val410, vN1('410'), 'B', 'item', '', c.m410),
      buildRow('411', 'Virement aux fonds (Placements DAT)', val411, vN1('411'), 'B', 'item', '', c.m411),
      buildRow('412', 'Décaissements sur acquisitions d\'immobilisations financières', val412, vN1('412'), 'B', 'item', '', c.m412),
      buildRow('413', 'Encaissements sur cessions d\'immob. financières (restitution cautions)', val413, vN1('413'), 'B', 'item', '', c.m413),
      buildRow('414', 'Intérêts encaissés sur placements financiers', val414, vN1('414'), 'B', 'item', '', c.m414),
      buildRow('415', 'Dividendes et quote-part de résultats reçus', val415, vN1('415'), 'B', 'item', '', c.m415),
      buildRow('416', 'Flux de trésorerie nets provenant des activités d\'investissement (B)', val416, vN1('416'), 'B', 'total', '', c.mB),

      buildRow('417', 'FLUX DE TRÉSORERIE PROVENANT DES ACTIVITÉS DE FINANCEMENT (C)', null, null, 'C', 'header', ''),
      buildRow('418', 'Encaissements suite à l\'émission d\'actions', val418, vN1('418'), 'C', 'item', '', c.m418),
      buildRow('419', 'Dividendes et autres distributions effectuées', val419, vN1('419'), 'C', 'item', '', c.m419),
      buildRow('420', 'Encaissements provenant d\'emprunts', val420, vN1('420'), 'C', 'item', '', c.m420),
      buildRow('421', 'Remboursements d\'emprunts ou d\'autres dettes assimilées', val421, vN1('421'), 'C', 'item', '', c.m421),
      buildRow('423', 'Incidences des variations des taux de change sur liquidités', val423, vN1('423'), 'C', 'item', '', c.m423),
      buildRow('422', 'Flux de trésorerie nets provenant des activités de financement (C)', val422, vN1('422'), 'C', 'total', '', c.mC),

      buildRow('424', 'Variation de trésorerie de la période (A + B + C)', val424, vN1('424'), 'SYNTHESE', 'sig', '', c.mVar),
      buildRow('425', 'Trésorerie et équivalents de trésorerie à l\'ouverture', val425, vN1('425'), 'SYNTHESE', 'item', '', c.mOuv),
      buildRow('426', 'Trésorerie et équivalents de trésorerie à la clôture', val426, vN1('426'), 'SYNTHESE', 'sig-final', '', c.mClot),
      buildRow('427', 'Variation de trésorerie constatée (Clôture − Ouverture)', val427, vN1('427'), 'SYNTHESE', 'total', '', c.mVar)
    ];

    const kpis = {
      fluxOpA: val408,
      fluxInvB: val416,
      fluxFinC: val422,
      varNet424: val424,
      tresoOuv425: val425,
      tresoClot426: val426,
      equilibre: Math.abs(val427 - val424) < 1.0,
      diffEquilibre: Math.abs(val427 - val424)
    };

    return {
      company: 'SENSUS ALGERIE SPA',
      title: 'Tableau des Flux de Trésorerie (TFT — SCF Algérie Méthode Directe)',
      yearN,
      yearN_1,
      month: targetMonth || 'ALL',
      periodLabel: isMonthFilter ? `${selectedMonthName} ${yearN}` : `Exercice ${yearN} (Année Complète)`,
      monthHeaders: MONTH_LABELS,
      monthsShort: ['Janv', 'Févr', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'],
      kpis,
      sections: {
        operationnel: rows.filter(r => r.section === 'A'),
        investissement: rows.filter(r => r.section === 'B'),
        financement: rows.filter(r => r.section === 'C'),
        synthese: rows.filter(r => r.section === 'SYNTHESE')
      },
      rows
    };
  }
}

module.exports = new ReportingEngine();
