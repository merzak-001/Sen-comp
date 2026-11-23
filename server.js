const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');

const parser = require('./parser');
const storage = require('./storage');
const reportingEngine = require('./reportingEngine');
const sqlDb = require('./sqlDb');
const fbl3nManager = require('./fbl3nManager');
const balanceManager = require('./balanceManager');
const reconciliationManager = require('./reconciliationManager');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }
});

if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

// Authentication Configuration & Endpoints
const AUTH_USERS = {
  'admin': {
    password: '0505',
    username: 'admin',
    displayName: 'Administrateur',
    role: 'admin',
    allowedPages: ['*']
  },
  'khaled.kaddour': {
    password: '1010',
    username: 'khaled.kaddour',
    displayName: 'Khaled Kaddour',
    role: 'user',
    allowedPages: ['page-bilan', 'page-tcr', 'page-balance', 'page-tft', 'page-parametres', 'page-import']
  }
};

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanU = (username || '').trim().toLowerCase();
  const cleanP = (password || '').trim();

  let matchedUser = null;
  if (cleanU === 'admin' && cleanP === '0505') {
    matchedUser = AUTH_USERS['admin'];
  } else if ((cleanU === 'khaled.kaddour' || cleanU === 'khaled') && cleanP === '1010') {
    matchedUser = AUTH_USERS['khaled.kaddour'];
  }

  if (matchedUser) {
    const token = Buffer.from(`${matchedUser.username}:${Date.now()}`).toString('base64');
    return res.json({
      success: true,
      token,
      user: {
        username: matchedUser.username,
        displayName: matchedUser.displayName,
        role: matchedUser.role,
        allowedPages: matchedUser.allowedPages
      }
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Identifiant ou mot de passe incorrect'
  });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ success: true, authenticated: true });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Déconnecté avec succès' });
});

app.post('/api/admin/restart', (req, res) => {
  res.json({ success: true, message: 'Redémarrage du serveur en cours...' });
  setTimeout(() => {
    process.exit(0);
  }, 500);
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    totalInvoices: storage.invoices.size,
    totalSuppliers: storage.suppliers.size,
    history: storage.history
  });
});

// Suppliers Management Endpoints
app.get('/api/suppliers', (req, res) => {
  try {
    const list = storage.getSuppliersList();
    res.json({
      success: true,
      total: list.length,
      suppliers: list
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suppliers/:id', (req, res) => {
  try {
    const supplierId = req.params.id;
    const { category, isFixed, supplierName } = req.body;
    const result = storage.updateSupplier({
      supplierId,
      category,
      isFixed,
      supplierName
    });
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 1-Click Import strictly from OS-appro folder
app.post('/api/import-default', (req, res) => {
  try {
    const osApproDir = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro';
    const f41Path = path.join(osApproDir, 'F.41 05102026.xlsx');
    const fbl3nPath = path.join(osApproDir, 'FBL3N 051026.xlsx');

    if (!fs.existsSync(f41Path)) {
      return res.status(404).json({ error: `Fichier F.41 introuvable dans OS-appro: ${f41Path}` });
    }
    if (!fs.existsSync(fbl3nPath)) {
      return res.status(404).json({ error: `Fichier FBL3N introuvable dans OS-appro: ${fbl3nPath}` });
    }

    console.time('import-default');
    console.log('Parsing F.41...');
    const f41List = parser.parseF41(f41Path);

    console.log('Parsing FBL3N...');
    const fbl3nMap = parser.parseFBL3N(fbl3nPath);

    console.log(`Matching ${f41List.length} F.41 invoices with FBL3N...`);
    const result = storage.importData(f41List, fbl3nMap, 'F.41 05102026 & FBL3N 05102026');
    console.timeEnd('import-default');

    res.json({
      success: true,
      message: 'Importation et rapprochement réussis !',
      ...result
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// File Upload endpoint
app.post('/api/upload', upload.fields([
  { name: 'f41File', maxCount: 1 },
  { name: 'fbl3nFile', maxCount: 1 }
]), (req, res) => {
  try {
    if (!req.files || !req.files.f41File || !req.files.fbl3nFile) {
      return res.status(400).json({ error: 'Veuillez sélectionner les deux fichiers : F.41 et FBL3N' });
    }

    const f41Path = req.files.f41File[0].path;
    const fbl3nPath = req.files.fbl3nFile[0].path;

    const f41List = parser.parseF41(f41Path);
    const fbl3nMap = parser.parseFBL3N(fbl3nPath);

    const sourceName = `${req.files.f41File[0].originalname} + ${req.files.fbl3nFile[0].originalname}`;
    const result = storage.importData(f41List, fbl3nMap, sourceName);

    try {
      fs.unlinkSync(f41Path);
      fs.unlinkSync(fbl3nPath);
    } catch (e) {}

    res.json({
      success: true,
      message: 'Fichiers importés avec succès !',
      ...result
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Dashboard Analytics
app.get('/api/dashboard', (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      market: req.query.market,
      year: req.query.year,
      month: req.query.month,
      supplier: req.query.supplier,
      search: req.query.search
    };
    const data = storage.getDashboardData(filters);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invoices List
app.get('/api/invoices', async (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      market: req.query.market,
      search: req.query.search,
      year: req.query.year,
      month: req.query.month
    };
    
    // Primary: Query SQL Server (SensusSAPDB)
    try {
      const sqlList = await sqlDb.getInvoicesFromDb(filters);
      if (Array.isArray(sqlList)) {
        return res.json({
          total: sqlList.length,
          invoices: sqlList,
          source: 'SQL_SERVER_SQLEXPRESS'
        });
      }
    } catch (sqlErr) {
      console.warn('[SQL Server Warning] Fallback to memory store:', sqlErr.message);
    }

    // Fallback: In-memory store
    const list = storage.getInvoices(filters);
    res.json({
      total: list.length,
      invoices: list,
      source: 'LOCAL_STORE'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Category for a single invoice
app.post('/api/invoices/update-category', async (req, res) => {
  try {
    const { piece, category, applyToSupplier } = req.body;
    if (!piece || !category) {
      return res.status(400).json({ error: 'Nº pièce et catégorie requis' });
    }
    const updated = storage.updateCategory(piece, category, applyToSupplier);
    try {
      await sqlDb.updateInvoiceCategoryInDb(piece, category);
    } catch (sqlErr) {
      console.warn('SQL update category error:', sqlErr.message);
    }
    res.json({ success: true, invoice: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete invoice
app.post('/api/invoices/delete', async (req, res) => {
  try {
    const { piece } = req.body;
    if (!piece) return res.status(400).json({ error: 'Nº de pièce requis' });
    const inv = storage.deleteInvoice(piece);
    if (!inv) return res.status(404).json({ error: 'Pièce non trouvée' });
    try {
      await sqlDb.deleteInvoiceInDb(piece);
    } catch (sqlErr) {
      console.warn('SQL delete invoice error:', sqlErr.message);
    }
    res.json({ success: true, piece, isDeleted: true, wasPreviouslyDeleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk delete invoices
app.post('/api/invoices/bulk-delete', async (req, res) => {
  try {
    const { pieces } = req.body;
    if (!Array.isArray(pieces) || pieces.length === 0) {
      return res.status(400).json({ error: 'Liste de pièces requise' });
    }
    const result = storage.deleteInvoicesBulk(pieces);
    for (const p of pieces) {
      try {
        await sqlDb.deleteInvoiceInDb(p);
      } catch (sqlErr) {}
    }
    res.json({ success: true, count: result.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore invoice
app.post('/api/invoices/restore', async (req, res) => {
  try {
    const { piece } = req.body;
    if (!piece) return res.status(400).json({ error: 'Nº de pièce requis' });
    const inv = storage.restoreInvoice(piece);
    if (!inv) return res.status(404).json({ error: 'Pièce non trouvée' });
    try {
      await sqlDb.restoreInvoiceInDb(piece);
    } catch (sqlErr) {
      console.warn('SQL restore invoice error:', sqlErr.message);
    }
    res.json({ success: true, piece, isDeleted: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk update categories for multiple pieces
app.post('/api/invoices/bulk-update', async (req, res) => {
  try {
    const { pieces, category } = req.body;
    if (!Array.isArray(pieces) || !category) {
      return res.status(400).json({ error: 'Liste de pièces et catégorie requises' });
    }
    let count = 0;
    pieces.forEach(p => {
      try {
        storage.updateCategory(p, category, false);
        count++;
      } catch (e) {}
    });
    res.json({ success: true, count });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Suppliers Master List
app.get('/api/suppliers', (req, res) => {
  try {
    const suppliers = storage.getSuppliersList();
    res.json({
      success: true,
      total: suppliers.length,
      suppliers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Supplier by ID (Category / isFixed mode)
app.post('/api/suppliers/:id', (req, res) => {
  try {
    const supplierId = req.params.id;
    const { category, isFixed, supplierName } = req.body;
    const result = storage.updateSupplier({ supplierId, supplierName, category, isFixed });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Supplier Default Category
app.post('/api/suppliers/update-category', (req, res) => {
  try {
    const { supplierId, category, applyToAllInvoices } = req.body;
    if (!supplierId || !category) {
      return res.status(400).json({ error: 'Fournisseur et catégorie requis' });
    }
    const result = storage.updateSupplierDefaultCategory(supplierId, category, applyToAllInvoices !== false);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Management Summary Report (KDA / DZD / MDA)
app.get('/api/report/summary', (req, res) => {
  try {
    const filters = {
      year: req.query.year,
      month: req.query.month
    };
    const unit = req.query.unit || 'KDA';
    const report = storage.getManagementReport(filters, unit);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export Summary Report matching official model
app.get('/api/report/export-summary-excel', (req, res) => {
  try {
    const filters = {
      year: req.query.year,
      month: req.query.month
    };
    const unit = req.query.unit || 'KDA';
    const report = storage.getManagementReport(filters, unit);

    const formatRatio = (val) => (val !== undefined && val !== null ? Number(val).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00') + '%';

    const rows = [
      ['Rubriques', '', report.periodLabel],
      ['', `Val ${unit}`, 'RATIO'],
      ...report.rubriques.map(r => [r.label, r.val || '-', formatRatio(r.ratio)]),
      ['TOTAL', report.totalVal, '100,00%'],
      [],
      ['ACHATS PAR FOURNISSEUR', '', ''],
      ['', report.periodLabel, ''],
      ['Fournisseur', 'valeur achats', 'ratios /global'],
      ...report.suppliers.map(s => [s.label, s.val || '-', formatRatio(s.ratio)]),
      ['Total', report.totalVal, '100,00%'],
      [],
      ['ACHATS PAR TYPE LOC ETRANGER', '', ''],
      ['', report.periodLabel, ''],
      ['type d\'achat', 'valeur achats', 'ratios /global'],
      ...report.markets.map(m => [m.label, m.val || '-', formatRatio(m.ratio)]),
      ['Total', report.totalVal, '100,00%']
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Set column widths
    ws['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 15 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Synthese ${unit}`);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Synthese_Achats_${unit}_${(report.periodLabel || '2026').replace(/\s+/g, '_')}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export Summary Report as formatted Microsoft Word document (.doc)
app.get('/api/report/export-summary-word', (req, res) => {
  try {
    const filters = {
      year: req.query.year,
      month: req.query.month
    };
    const unit = req.query.unit || 'KDA';
    const report = storage.getManagementReport(filters, unit);

    const formatNum = (val) => val ? Number(val).toLocaleString('fr-FR') : '-';
    const formatRatio = (val) => (val !== undefined && val !== null ? Number(val).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00') + '%';
    const sanitizeForWord = (text, isNumeric = false) => {
      if (text === null || text === undefined || text === '') return '&nbsp;';
      let clean = String(text).trim();
      if (clean === '-' || clean === '0' || clean === '0,00%') return clean;
      if (isNumeric || /\d/.test(clean)) {
        clean = clean.replace(/(\d)\s+(\d)/g, '$1&nbsp;$2');
        clean = clean.replace(/(\d)\s+%/g, '$1%');
      }
      return clean;
    };

    const wordHtml = `
<html xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <title>Synthèse de Gestion - ${report.periodLabel}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4 portrait;
      margin: 0.5cm 0.5cm 0.5cm 0.5cm;
      mso-page-orientation: portrait;
    }
    @page Section1 {
      size: 595.35pt 841.95pt;
      mso-page-orientation: portrait;
      margin: 14.17pt 14.17pt 14.17pt 14.17pt;
      mso-header-margin: 10.0pt;
      mso-footer-margin: 10.0pt;
      mso-paper-source: 0;
    }
    div.Section1 {
      page: Section1;
      width: 100.0%;
      mso-element: section;
    }
    body {
      font-family: 'Arial Narrow', Calibri, Arial, sans-serif;
      font-size: 8.5pt;
      color: #0f172a;
      margin: 0;
      padding: 0;
    }
    h1.doc-title {
      font-family: 'Arial Narrow', Calibri, Arial, sans-serif;
      font-size: 13pt;
      font-weight: bold;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 2pt;
      border-bottom: 2pt solid #1e3a8a;
      padding-bottom: 3pt;
    }
    p.doc-subtitle {
      font-family: 'Arial Narrow', Calibri, Arial, sans-serif;
      font-size: 8pt;
      color: #475569;
      margin-top: 0;
      margin-bottom: 12pt;
    }
    h2.table-title {
      font-family: 'Arial Narrow', Calibri, Arial, sans-serif;
      font-size: 10.5pt;
      font-weight: bold;
      color: #0f172a;
      margin-top: 10pt;
      margin-bottom: 1.5pt;
    }
    p.table-subtitle {
      font-family: 'Arial Narrow', Calibri, Arial, sans-serif;
      font-size: 7.5pt;
      color: #475569;
      margin-top: 0;
      margin-bottom: 4pt;
    }
    table.word-a4-table {
      width: 100.0% !important;
      width: 100% !important;
      min-width: 100% !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
      mso-table-layout-alt: fixed !important;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
      mso-padding-alt: 1.5pt 2.0pt 1.5pt 2.0pt;
      font-family: 'Arial Narrow', Calibri, Arial, sans-serif;
      font-size: 8.5pt;
      border: 1pt solid #0f172a;
      line-height: 1.15;
      margin-bottom: 14pt;
    }
    table.word-a4-table th {
      border: 0.5pt solid #94a3b8;
      background-color: #0f172a;
      color: #ffffff;
      padding: 3.0pt 2.5pt;
      font-weight: bold;
      text-align: center;
      mso-border-alt: solid #94a3b8 .5pt;
      mso-hyphenate: none;
      white-space: nowrap;
      word-break: keep-all;
    }
    table.word-a4-table td {
      border: 0.5pt solid #cbd5e1;
      padding: 2.2pt 2.5pt;
      vertical-align: middle;
      mso-border-alt: solid #cbd5e1 .5pt;
      mso-hyphenate: none;
    }
    table.word-a4-table tfoot td {
      border: 0.5pt solid #475569;
      background-color: #0f172a;
      color: #ffffff;
      font-weight: bold;
      padding: 3.0pt 2.5pt;
      border-top: 1.5pt solid #0f172a;
    }
  </style>
</head>
<body>
<div class="Section1">
  <h1 class="doc-title">SENSUS SPA - RAPPORT DE GESTION &amp; SYNTHÈSE DES ACHATS</h1>
  <p class="doc-subtitle">Période : <strong>${report.periodLabel}</strong> &nbsp;|&nbsp; Unité : <strong>Val ${unit}</strong> &nbsp;|&nbsp; Total Net HT : <strong style="color:#1e3a8a;">${sanitizeForWord(formatNum(report.totalVal), true)} ${unit}</strong></p>

  <h2 class="table-title">1. RUBRIQUES &amp; POSTES DE DÉPENSES</h2>
  <p class="table-subtitle">9 Catégories d'arbitrage budgétaire • Période : ${report.periodLabel} • Unité : Val ${unit}</p>
  <table class="word-a4-table" width="100%" border="1" cellpadding="1" cellspacing="0">
    <colgroup>
      <col style="width:54%;" width="54%">
      <col style="width:24%;" width="24%">
      <col style="width:22%;" width="22%">
    </colgroup>
    <thead>
      <tr style="background-color:#0f172a; color:#ffffff;">
        <th nowrap="nowrap" style="text-align:left;">RUBRIQUE</th>
        <th nowrap="nowrap" style="text-align:right;">VALEUR (${unit})</th>
        <th nowrap="nowrap" style="text-align:right;">RATIO GLOBAL</th>
      </tr>
    </thead>
    <tbody>
      ${report.rubriques.map((r, i) => `
      <tr style="background-color:${i % 2 === 1 ? '#f8fafc' : '#ffffff'};">
        <td style="text-align:left;">
          <span style="font-family:Consolas,monospace; font-weight:bold; color:#475569; font-size:7.5pt; background-color:#f1f5f9; padding:1pt 3pt; border:0.5pt solid #cbd5e1; margin-right:4pt;">${r.code || ''}</span>
          <strong>${r.label}</strong>
        </td>
        <td nowrap="nowrap" style="text-align:right; font-weight:bold;">${sanitizeForWord(formatNum(r.val), true)}</td>
        <td nowrap="nowrap" style="text-align:right; font-weight:bold; color:#1e40af;">${sanitizeForWord(formatRatio(r.ratio), true)}</td>
      </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr style="background-color:#0f172a; color:#ffffff; font-weight:bold; border-top:1.5pt solid #0f172a;">
        <td nowrap="nowrap" style="text-align:left;">TOTAL GÉNÉRAL</td>
        <td nowrap="nowrap" style="text-align:right;">${sanitizeForWord(formatNum(report.totalVal), true)}</td>
        <td nowrap="nowrap" style="text-align:right;">100,00%</td>
      </tr>
    </tfoot>
  </table>

  <h2 class="table-title">2. ACHATS PAR FOURNISSEUR PARTENAIRE</h2>
  <p class="table-subtitle">Fournisseurs stratégiques &amp; Autres • Période : ${report.periodLabel} • Unité : Val ${unit}</p>
  <table class="word-a4-table" width="100%" border="1" cellpadding="1" cellspacing="0">
    <colgroup>
      <col style="width:54%;" width="54%">
      <col style="width:24%;" width="24%">
      <col style="width:22%;" width="22%">
    </colgroup>
    <thead>
      <tr style="background-color:#0f172a; color:#ffffff;">
        <th nowrap="nowrap" style="text-align:left;">FOURNISSEUR</th>
        <th nowrap="nowrap" style="text-align:right;">VALEUR ACHATS (${unit})</th>
        <th nowrap="nowrap" style="text-align:right;">RATIO GLOBAL</th>
      </tr>
    </thead>
    <tbody>
      ${report.suppliers.map((s, i) => {
        const isAutres = (s.label || '').toLowerCase().includes('autre');
        const rankLabel = isAutres ? '∑' : `#${i + 1}`;
        return `
      <tr style="background-color:${i % 2 === 1 ? '#f8fafc' : '#ffffff'};">
        <td style="text-align:left;">
          <span style="font-size:7.5pt; font-weight:bold; color:#475569; background-color:#f1f5f9; padding:1pt 3pt; border:0.5pt solid #cbd5e1; margin-right:4pt;">${rankLabel}</span>
          <strong>${s.label}</strong>
        </td>
        <td nowrap="nowrap" style="text-align:right; font-weight:bold;">${sanitizeForWord(formatNum(s.val), true)}</td>
        <td nowrap="nowrap" style="text-align:right; font-weight:bold; color:#1e40af;">${sanitizeForWord(formatRatio(s.ratio), true)}</td>
      </tr>
        `;
      }).join('')}
    </tbody>
    <tfoot>
      <tr style="background-color:#0f172a; color:#ffffff; font-weight:bold; border-top:1.5pt solid #0f172a;">
        <td nowrap="nowrap" style="text-align:left;">TOTAL FOURNISSEURS</td>
        <td nowrap="nowrap" style="text-align:right;">${sanitizeForWord(formatNum(report.totalVal), true)}</td>
        <td nowrap="nowrap" style="text-align:right;">100,00%</td>
      </tr>
    </tfoot>
  </table>

  <h2 class="table-title">3. RÉPARTITION DES ACHATS PAR MARCHÉ</h2>
  <p class="table-subtitle">Ventilation géographique des flux d'achats • Période : ${report.periodLabel} • Unité : Val ${unit}</p>
  <table class="word-a4-table" width="100%" border="1" cellpadding="1" cellspacing="0">
    <colgroup>
      <col style="width:54%;" width="54%">
      <col style="width:24%;" width="24%">
      <col style="width:22%;" width="22%">
    </colgroup>
    <thead>
      <tr style="background-color:#0f172a; color:#ffffff;">
        <th nowrap="nowrap" style="text-align:left;">TYPE D'ACHAT</th>
        <th nowrap="nowrap" style="text-align:right;">VALEUR ACHATS (${unit})</th>
        <th nowrap="nowrap" style="text-align:right;">RATIO GLOBAL</th>
      </tr>
    </thead>
    <tbody>
      ${report.markets.map((m, i) => {
        const isLocal = (m.label || '').toLowerCase().includes('loc');
        const tag = isLocal ? 'LOCAL' : 'IMPORT';
        return `
      <tr style="background-color:${i % 2 === 1 ? '#f8fafc' : '#ffffff'};">
        <td style="text-align:left;">
          <span style="font-size:7.5pt; font-weight:bold; color:${isLocal ? '#047857' : '#1d4ed8'}; background-color:${isLocal ? '#ecfdf5' : '#eff6ff'}; padding:1pt 3pt; border:0.5pt solid ${isLocal ? '#a7f3d0' : '#bfdbfe'}; margin-right:4pt;">${tag}</span>
          <strong>${m.label}</strong>
        </td>
        <td nowrap="nowrap" style="text-align:right; font-weight:bold;">${sanitizeForWord(formatNum(m.val), true)}</td>
        <td nowrap="nowrap" style="text-align:right; font-weight:bold; color:#1e40af;">${sanitizeForWord(formatRatio(m.ratio), true)}</td>
      </tr>
        `;
      }).join('')}
    </tbody>
    <tfoot>
      <tr style="background-color:#0f172a; color:#ffffff; font-weight:bold; border-top:1.5pt solid #0f172a;">
        <td nowrap="nowrap" style="text-align:left;">TOTAL FLUX ACHATS</td>
        <td nowrap="nowrap" style="text-align:right;">${sanitizeForWord(formatNum(report.totalVal), true)}</td>
        <td nowrap="nowrap" style="text-align:right;">100,00%</td>
      </tr>
    </tfoot>
  </table>
</div>
</body>
</html>
    `;

    const filename = `Synthese_Achats_${unit}_${(report.periodLabel || '2026').replace(/\s+/g, '_')}.doc`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/msword; charset=utf-8');
    res.send(Buffer.from(wordHtml, 'utf-8'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export to Excel
app.get('/api/export-excel', (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      market: req.query.market,
      year: req.query.year,
      month: req.query.month,
      supplierId: req.query.supplierId,
      supplier: req.query.supplier,
      onlyMultiCategory: req.query.onlyMultiCategory === 'true',
      search: req.query.search,
      status: req.query.status || 'ACTIVE'
    };
    const list = storage.getInvoices(filters);

    const exportRows = list.map(i => ({
      'Nº Pièce': i.piece,
      'Réf. Facture (Affectation)': i.affectation || '',
      'Type Pièce': i.docType,
      'Fournisseur': i.supplierName,
      'Code Fournisseur': i.supplierId,
      'Date Comptable': i.dateComptable,
      'Mois': i.month,
      'Année': i.year,
      'Marché': i.isLocal ? 'Local' : 'Étranger',
      'Devise': i.currency,
      'Montant en Devise': (!i.isLocal && i.foreignAmount) ? i.foreignAmount : '',
      'Catégorie': i.category,
      'Montant F.41': i.f41Amount,
      'Retenue 5% (+)': i.retunie,
      'TVA Déduite (-)': i.tva,
      'Débours Déduits (-)': i.debours,
      'Dépense Réelle HT': i.netHT
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dépenses Consolidées');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Depenses_Consolidees_SAP.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SENSUS REPORTING SYSTEM ENDPOINTS
// ==========================================

// 1. Document9 report synthesis
app.get('/api/reports/document9', (req, res) => {
  try {
    const period = req.query.period || 'AOUT_2026';
    const report = reportingEngine.getDocument9Report(period);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Export Word .docx for Document9
app.post('/api/reports/document9/export-docx', async (req, res) => {
  try {
    const period = req.body.period || 'AOUT_2026';
    const customObservations = req.body.observations;
    const unit = req.body.unit || 'KDA';
    const reportData = reportingEngine.getDocument9Report(period);
    const buffer = await reportingEngine.generateWordReport(reportData, customObservations, unit);

    const filename = `SENSUS_Synthese_Appro_${period}_${unit}.docx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (err) {
    console.error('Word export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Dedicated Stocks page data (SQL Server SensusSAPDB)
app.get('/api/reports/stocks', async (req, res) => {
  try {
    const period = req.query.period || 'AOUT_2026';
    const year = req.query.year || '2026';
    const doc9 = reportingEngine.getDocument9Report(period);
    let stocksList = [];
    const balanceKey = (year === '2025' || year === 2025) ? '2025' : '102026';
    try {
      stocksList = await sqlDb.getGLBalancesFromDb(balanceKey, 'stocks');
    } catch (e) {
      console.warn('SQL stocks fallback:', e.message);
    }
    if (!stocksList || stocksList.length === 0) {
      const sourceBalance = (balanceKey === '2025') ? reportingEngine.balance25 : reportingEngine.balance1026;
      stocksList = Array.from(sourceBalance.values()).filter(b => 
        b.dz.startsWith('3') || b.boal.startsWith('3000') || b.boal.startsWith('7800') || b.boal.startsWith('7900') || (b.desc || '').includes('STOCK') || (b.desc || '').includes('MATIERE')
      );
    }
    res.json({
      stocks: stocksList,
      summaryTable: doc9.stocks,
      year: year,
      source: 'SQL_SERVER'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Dedicated Consommation page data (SCF Class 60 - SQL Server SensusSAPDB)
app.get('/api/reports/consommation', async (req, res) => {
  try {
    const period = req.query.period || 'AOUT_2026';
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    const month = req.query.month && req.query.month !== 'ALL' ? parseInt(req.query.month, 10) : null;
    const doc9 = reportingEngine.getDocument9Report(period);
    let chargesList = [];

    // If year specified, query FBL3NLineItems for that year & month
    if (year) {
      try {
        chargesList = await fbl3nManager.getConsommationChargesByYear(year, month);
      } catch (fblErr) {
        console.warn('FBL3N charges query error:', fblErr.message);
      }
    }

    if (!chargesList || chargesList.length === 0) {
      try {
        chargesList = await sqlDb.getGLBalancesFromDb('102026', 'charges');
      } catch (e) {
        console.warn('SQL charges fallback:', e.message);
      }
    }
    if (!chargesList || chargesList.length === 0) {
      chargesList = Array.from(reportingEngine.balance1026.values()).filter(b => 
        b.dz.startsWith('60') || b.boal.startsWith('4000') || b.boal.startsWith('4001') || b.boal.startsWith('4403') || b.boal.startsWith('4404') || b.boal.startsWith('4409') || (b.desc || '').includes('ACHATS CONSOM')
      );
    }
    res.json({
      charges: chargesList,
      summary: doc9.consommation,
      year: year || 2026,
      month: month || 'ALL',
      source: (year && chargesList.length > 0) ? 'FBL3N_DATABASE' : 'SQL_SERVER'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Dedicated Douane & Fiscalité (SQL Server SensusSAPDB)
app.get('/api/reports/fiscalite', async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    const month = req.query.month && req.query.month !== 'ALL' ? parseInt(req.query.month, 10) : null;
    try {
      const sqlFiscal = await sqlDb.getTransitSummaryFromDb(year, month);
      if (sqlFiscal && sqlFiscal.totals && (sqlFiscal.totals.totalDebours > 0 || sqlFiscal.totals.totalTva > 0 || sqlFiscal.totals.totalRetenue > 0)) {
        return res.json(sqlFiscal);
      }
    } catch (e) {
      console.warn('SQL fiscal fallback:', e.message);
    }

    // In-memory fallback
    let invoices = Array.from(storage.invoices.values()).filter(i => !i.isDeleted);
    if (year) {
      invoices = invoices.filter(i => i.year === year || (i.dateComptable && i.dateComptable.startsWith(String(year))));
    }
    if (month) {
      invoices = invoices.filter(i => i.month === month || (i.dateComptable && parseInt(i.dateComptable.substring(5, 7), 10) === month));
    }
    let totalDebours = 0;
    let totalTva = 0;
    let totalRetenue = 0;
    const deboursBySupplier = {};
    invoices.forEach(i => {
      totalDebours += (i.debours || 0);
      totalTva += (i.tva || 0);
      totalRetenue += (i.retunie || 0);
      if (i.debours > 0) {
        const s = i.supplierName || 'Inconnu';
        deboursBySupplier[s] = (deboursBySupplier[s] || 0) + i.debours;
      }
    });
    res.json({
      totals: { 
        totalDebours: Number(totalDebours.toFixed(2)), 
        totalTva: Number(totalTva.toFixed(2)), 
        totalRetenue: Number(totalRetenue.toFixed(2)) 
      },
      deboursBySupplier: Object.entries(deboursBySupplier)
        .map(([supplier, amount]) => ({ supplier, amount: Number(amount.toFixed(2)) }))
        .sort((a,b) => b.amount - a.amount)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Data center & SQL Server status
app.get('/api/reports/status', async (req, res) => {
  try {
    const dbStats = await sqlDb.getDatabaseStats();
    res.json({
      database: dbStats,
      files: reportingEngine.getStatus(),
      invoicesCount: dbStats.stats?.invoicesCount || storage.invoices.size
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reports/sync', async (req, res) => {
  try {
    await reportingEngine.loadMasterFiles();
    const dbStats = await sqlDb.getDatabaseStats();
    res.json({ 
      success: true, 
      database: dbStats 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Tableau des Comptes de Résultats (TCR — SCF Algérie)
app.get('/api/tcr', async (req, res) => {
  try {
    const year = req.query.year || '2026';
    const month = req.query.month || 'ALL';
    const source = req.query.source || 'balance';
    const tcr = await reportingEngine.getTCRReport(year, month, source);
    tcr.month = month;
    tcr.source = source;
    res.json({
      success: true,
      tcr
    });
  } catch (err) {
    console.error('TCR error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Bilan Comptable (Actif & Passif — SCF Algérie)
app.get('/api/bilan', async (req, res) => {
  try {
    const year = req.query.year || '2026';
    const month = req.query.month || 'ALL';
    const source = req.query.source || 'balance';
    const bilan = await reportingEngine.getBilanReport(year, month, source);
    bilan.month = month;
    bilan.source = source;
    res.json({
      success: true,
      bilan
    });
  } catch (err) {
    console.error('Bilan error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8b. Tableau des Flux de Trésorerie (TFT — SCF Algérie Méthode Directe)
app.get('/api/tft', async (req, res) => {
  try {
    const year = req.query.year || '2025';
    const month = req.query.month || 'ALL';
    const tft = await reportingEngine.getTFTReport(year, month);
    res.json({
      success: true,
      tft
    });
  } catch (err) {
    console.error('TFT error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================================
// BALANCE GÉNÉRALE (SAP RFSSLD00) IMPORT & QUERY SYSTEM
// =====================================================================

// 8c. Get list of imported Balance periods with balance check
app.get('/api/balance/periods', async (req, res) => {
  try {
    const periods = await balanceManager.getPeriodsSummary();
    res.json({
      success: true,
      periods
    });
  } catch (err) {
    console.error('Balance periods error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8d. Query Balance rows by period, account class, and search query
app.get('/api/balance', async (req, res) => {
  try {
    const periodKey = req.query.period || req.query.period_key || '102026';
    const filterClass = req.query.class || null;
    const search = req.query.search || null;

    const rows = await balanceManager.getBalances(periodKey, filterClass, search);
    res.json({
      success: true,
      period: periodKey,
      total: rows.length,
      balances: rows
    });
  } catch (err) {
    console.error('Balance query error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// 8f. Upload a balance file and store in SQL Server
app.post('/api/balance/upload', upload.single('balanceFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
    }

    const periodKeyOverride = req.body.periodKey || null;
    const parsed = balanceManager.parseBalanceFile(req.file.path, periodKeyOverride);
    const saveRes = await balanceManager.saveBalanceToDb(parsed.records, parsed.periodKey, req.file.originalname);
    await reportingEngine.loadMasterFiles();

    // Clean up temporary upload file
    try { fs.unlinkSync(req.file.path); } catch (e) {}

    const periods = await balanceManager.getPeriodsSummary();

    res.json({
      success: true,
      message: `Balance importée avec succès : ${saveRes.count} comptes enregistrés pour la période ${parsed.periodKey}`,
      periodKey: parsed.periodKey,
      count: saveRes.count,
      periods
    });
  } catch (err) {
    console.error('Balance upload error:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8g. Delete a specific balance period
app.delete('/api/balance/:periodKey', async (req, res) => {
  try {
    const { periodKey } = req.params;
    const result = await balanceManager.deletePeriod(periodKey);
    await reportingEngine.loadMasterFiles();
    const periods = await balanceManager.getPeriodsSummary();
    res.json({
      success: true,
      message: `Période ${periodKey} supprimée avec succès`,
      periods
    });
  } catch (err) {
    console.error('Balance delete error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Dynamic Fiscal Years & Months Discovery (derived dynamically from SQL Server & FBL3N)
app.get('/api/years', async (req, res) => {
  try {
    const fbl3nYears = await fbl3nManager.getAvailableYears();

    // Discover years and months from GeneralLedgerBalances
    let glYears = [];
    let monthsByYear = {};

    try {
      const glRows = await sqlDb.query(`SELECT DISTINCT period_key FROM GeneralLedgerBalances;`);
      glRows.forEach(r => {
        const pk = String(r.period_key || '').trim();
        if (pk.length >= 4) {
          const yr = parseInt(pk.slice(-4), 10);
          if (yr && yr > 2000 && !glYears.includes(yr)) {
            glYears.push(yr);
          }
          if (pk.length === 6) {
            const mo = parseInt(pk.slice(0, 2), 10);
            const yrStr = String(yr);
            if (!monthsByYear[yrStr]) monthsByYear[yrStr] = [];
            if (mo && !monthsByYear[yrStr].includes(mo)) {
              monthsByYear[yrStr].push(mo);
            }
          }
        }
      });
    } catch (e) {
      console.warn('Error reading years from GeneralLedgerBalances:', e.message);
    }

    // Retrieve active months per year from FBL3NLineItems
    try {
      const mRes = await sqlDb.query(`
        SELECT DISTINCT fiscal_year AS [year], fiscal_month AS [month]
        FROM FBL3NLineItems
        WHERE fiscal_year IS NOT NULL AND fiscal_month IS NOT NULL AND doc_number <> ''
        ORDER BY fiscal_year DESC, fiscal_month ASC;
      `);
      mRes.forEach(r => {
        const yStr = String(r.year);
        if (!monthsByYear[yStr]) monthsByYear[yStr] = [];
        const mNum = parseInt(r.month, 10);
        if (mNum && !monthsByYear[yStr].includes(mNum)) {
          monthsByYear[yStr].push(mNum);
        }
      });
    } catch (e) {}

    // Sort months numerically for each year
    Object.keys(monthsByYear).forEach(k => {
      monthsByYear[k].sort((a, b) => a - b);
    });

    // Combine years with real data in the database
    const distinctDataYears = Array.from(new Set([...fbl3nYears, ...glYears]))
      .map(y => parseInt(y, 10))
      .filter(y => !isNaN(y) && y > 2000)
      .sort((a, b) => b - a);

    // If years exist with data, prioritize them dynamically
    const combinedYears = distinctDataYears.length > 0 
      ? distinctDataYears 
      : [2026, 2025, 2024];

    res.json({
      success: true,
      years: combinedYears,
      activeDataYears: distinctDataYears,
      monthsByYear
    });
  } catch (err) {
    console.error('Years discovery error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. FBL3N Grand Livre Management Endpoints
app.get('/api/fbl3n/filters', async (req, res) => {
  try {
    const filters = await fbl3nManager.getFilterOptions();
    res.json({ success: true, ...filters });
  } catch (err) {
    console.error('FBL3N filters error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/fbl3n', async (req, res) => {
  try {
    const data = await fbl3nManager.getLineItems(req.query);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('FBL3N query error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Import FBL3N Excel File Upload
app.post('/api/fbl3n/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Aucun fichier Excel transmis.' });
  }
  const filePath = req.file.path;
  try {
    const clearExisting = req.body.clearExisting === 'true' || req.body.clearExisting === true;
    const importMode = req.body.importMode || (clearExisting ? 'all' : 'month');
    const result = await fbl3nManager.importFromExcel(filePath, {
      importMode,
      clearExisting: importMode === 'all',
      sourceFileName: req.file.originalname
    });
    // Invalidate TFT cache so newly imported GL data is dynamically reflected
    reportingEngine.invalidateTFTCache();
    // Cleanup uploaded temp file
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
    res.json({ success: true, ...result });
  } catch (err) {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
    console.error('FBL3N Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// RECONCILIATION & IMPORT MANAGEMENT SYSTEM
// 1. Reconciliation query comparing GL and Balance
app.get('/api/reconciliation', async (req, res) => {
  try {
    const year = req.query.year || 2026;
    const month = req.query.month || 10;
    const periodKey = req.query.periodKey || null;
    const report = await reconciliationManager.reconcile(year, month, periodKey);
    res.json({ success: true, ...report });
  } catch (err) {
    console.error('Reconciliation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Upload FBL3N Excel (Single or Multiple Files) with auto-replacement & diff notification
app.post('/api/upload/fbl3n', upload.any(), async (req, res) => {
  try {
    const uploadedFiles = req.files || (req.file ? [req.file] : []);
    if (uploadedFiles.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun fichier FBL3N sélectionné.' });
    }

    const importMode = req.body.importMode || 'month';
    const batchResults = [];
    let totalInserted = 0;
    const allDiffs = [];

    for (const f of uploadedFiles) {
      try {
        const result = await reconciliationManager.importFBL3NWithDiff(f.path, { 
          importMode,
          sourceFileName: f.originalname 
        });
        batchResults.push({
          fileName: f.originalname,
          success: true,
          totalInserted: result.totalInserted,
          periods: result.periods,
          diffs: result.diffs || []
        });
        totalInserted += (result.totalInserted || 0);
        if (Array.isArray(result.diffs)) {
          allDiffs.push(...result.diffs);
        }
      } catch (fileErr) {
        batchResults.push({
          fileName: f.originalname,
          success: false,
          error: fileErr.message
        });
      } finally {
        if (fs.existsSync(f.path)) {
          try { fs.unlinkSync(f.path); } catch (e) {}
        }
      }
    }

    reportingEngine.invalidateTFTCache();
    res.json({
      success: true,
      filesCount: uploadedFiles.length,
      totalInserted,
      batchResults,
      diffs: allDiffs
    });
  } catch (err) {
    console.error('FBL3N upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Upload Balance Excel (Single or Multiple Files) with auto-replacement & diff notification
app.post('/api/upload/balance', upload.any(), async (req, res) => {
  try {
    const uploadedFiles = req.files || (req.file ? [req.file] : []);
    if (uploadedFiles.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun fichier Balance sélectionné.' });
    }

    const periodOverride = req.body.periodKey || null;
    const batchResults = [];
    let totalInserted = 0;
    const allDiffs = [];

    for (const f of uploadedFiles) {
      try {
        const result = await reconciliationManager.importBalanceWithDiff(f.path, periodOverride);
        batchResults.push({
          fileName: f.originalname,
          success: true,
          periodKey: result.periodKey,
          insertedCount: result.insertedCount,
          diffs: result.diffs || []
        });
        totalInserted += (result.insertedCount || 0);
        if (Array.isArray(result.diffs)) {
          allDiffs.push(...result.diffs);
        }
      } catch (fileErr) {
        batchResults.push({
          fileName: f.originalname,
          success: false,
          error: fileErr.message
        });
      } finally {
        if (fs.existsSync(f.path)) {
          try { fs.unlinkSync(f.path); } catch (e) {}
        }
      }
    }

    await reportingEngine.loadMasterFiles();
    res.json({
      success: true,
      filesCount: uploadedFiles.length,
      totalInserted,
      batchResults,
      diffs: allDiffs
    });
  } catch (err) {
    console.error('Balance upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Import Diff History
app.get('/api/import/history', (req, res) => {
  res.json({ success: true, history: reconciliationManager.getHistory() });
});

// 5. Loaded data summary
app.get('/api/import/summary', async (req, res) => {
  try {
    const glPeriods = await sqlDb.query(`
      SELECT fiscal_year, fiscal_month, COUNT(*) AS count, 
             SUM(amount_local) AS net_sum,
             SUM(CASE WHEN amount_local > 0 THEN amount_local ELSE 0 END) AS debit_sum,
             SUM(CASE WHEN amount_local < 0 THEN ABS(amount_local) ELSE 0 END) AS credit_sum
      FROM FBL3NLineItems
      WHERE doc_number <> ''
      GROUP BY fiscal_year, fiscal_month
      ORDER BY fiscal_year DESC, fiscal_month ASC
    `);
    const balPeriods = await sqlDb.query(`
      SELECT period_key, COUNT(*) AS accounts_count, 
             SUM(debit) AS total_debit, SUM(credit) AS total_credit,
             MAX(updated_at) AS last_updated
      FROM GeneralLedgerBalances
      GROUP BY period_key
      ORDER BY period_key DESC
    `);
    res.json({ success: true, glPeriods, balPeriods });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Delete Imported Data (FBL3N, Balance, or All)
app.post('/api/import/delete', async (req, res) => {
  try {
    const { target, year, month, periodKey } = req.body;
    let message = '';
    let deletedCount = 0;

    if (target === 'fbl3n') {
      if (year && month) {
        const delRes = await sqlDb.query(`
          DELETE FROM FBL3NLineItems WHERE fiscal_year = ${parseInt(year, 10)} AND fiscal_month = ${parseInt(month, 10)};
          SELECT @@ROWCOUNT AS affected;
        `);
        deletedCount = delRes[0]?.affected || 0;
        message = `Écritures FBL3N supprimées pour le mois ${String(month).padStart(2, '0')}/${year} (${deletedCount} lignes).`;
      } else if (year) {
        const delRes = await sqlDb.query(`
          DELETE FROM FBL3NLineItems WHERE fiscal_year = ${parseInt(year, 10)};
          SELECT @@ROWCOUNT AS affected;
        `);
        deletedCount = delRes[0]?.affected || 0;
        message = `Toutes les écritures FBL3N de l'exercice ${year} ont été supprimées (${deletedCount} lignes).`;
      } else {
        await sqlDb.query('TRUNCATE TABLE FBL3NLineItems');
        message = 'Toutes les écritures FBL3N (Grand Livre) ont été vidées avec succès.';
      }
    } else if (target === 'balance') {
      if (periodKey) {
        const delRes = await sqlDb.query(`
          DELETE FROM GeneralLedgerBalances WHERE period_key = ?;
          SELECT @@ROWCOUNT AS affected;
        `, [String(periodKey).trim()]);
        deletedCount = delRes[0]?.affected || 0;
        message = `Soldes de Balance supprimés pour la période ${periodKey} (${deletedCount} comptes).`;
      } else {
        await sqlDb.query('TRUNCATE TABLE GeneralLedgerBalances');
        message = 'Toutes les Balances Générales ont été vidées avec succès.';
      }
    } else if (target === 'all') {
      await sqlDb.query(`
        TRUNCATE TABLE FBL3NLineItems;
        TRUNCATE TABLE GeneralLedgerBalances;
      `);
      reconciliationManager.clearHistory();
      message = 'Toutes les données importées (Grand Livre, Balances, Journal des écarts) ont été réinitialisées.';
    } else {
      return res.status(400).json({ success: false, error: 'Cible de suppression invalide (fbl3n, balance, all).' });
    }

    reportingEngine.invalidateTFTCache();
    await reportingEngine.loadMasterFiles();

    res.json({
      success: true,
      target,
      message,
      deletedCount
    });
  } catch (err) {
    console.error('Delete import error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// SPA Direct Page Link Handlers
const spaRoutes = ['/doc9', '/achats', '/consommation', '/stocks', '/fiscalite', '/tcr', '/bilan', '/tft', '/fbl3n', '/fournisseurs', '/parametres', '/import'];
spaRoutes.forEach(r => {
  app.get(r, (req, res) => {
    res.sendFile('index.html', { root: path.join(__dirname, 'public') });
  });
});

// Port configuration (Default 50 with fallback)
const TARGET_PORT = parseInt(process.env.PORT || '50', 10);

function startServer(port) {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 SENSUS SAP Reporting System running on port ${port} (http://localhost:${port})`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
      console.warn(`[Port ${port} unavailable (${err.code}), attempting port ${port === 50 ? 8050 : port + 1}...]`);
      startServer(port === 50 ? 8050 : port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(TARGET_PORT);

// Auto-sync disabled: database remains clean and dynamic
// setTimeout(async () => {
//   try {
//     await fbl3nManager.syncVendorInvoicesFromFBL3N();
//   } catch (e) {
//     console.warn('[Server] Initial vendor invoice sync warning:', e.message);
//   }
// }, 1500);
