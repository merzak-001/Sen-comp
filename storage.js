const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

const SUPPLIERS_FILE = path.join(DATA_DIR, 'suppliers.json');

const CATEGORIES = ['PD', 'MA', 'MP', 'GD', 'EQUIP', 'PR', 'TE', 'S', 'Diver'];

const RUBRIQUES_CONFIG = [
  { code: 'PD', label: 'PIECES DETACHEE CPT' },
  { code: 'MA', label: 'MATIERE AUXILIERE' },
  { code: 'MP', label: 'MATIERE PREMIERE' },
  { code: 'GD', label: 'COMPTEUR G D' },
  { code: 'EQUIP', label: 'EQUIPEMENT' },
  { code: 'PR', label: 'PIECES DE RECHANGE' },
  { code: 'TE', label: 'TRAVAUX ENTREPRENEUR' },
  { code: 'S', label: 'SERVICES' },
  { code: 'Diver', label: 'DIVERS' }
];

const STRATEGIC_SUPPLIERS = [
  { label: 'SARL SLR', match: s => s.supplierName.toUpperCase().includes('SANITARY') || s.supplierName.toUpperCase().includes('SLR') || s.supplierId === '1010979' },
  { label: 'SIMONFOND', match: s => s.supplierName.toUpperCase().includes('SIMONFOND') || s.supplierId === '1380763' },
  { label: 'SENSUS SAS', match: s => s.supplierName.toUpperCase().includes('SENSUS') || s.supplierId === '6640' || s.supplierId === '1011032' },
  { label: 'ARBURG Gmbh', match: s => s.supplierName.toUpperCase().includes('ARBURG') },
  { label: 'SAIEG', match: s => s.supplierName.toUpperCase().includes('SAIEG') || s.supplierName.toUpperCase().includes('INDUSTRIES') || s.supplierId === '1012946' },
  { label: 'ALBIS', match: s => s.supplierName.toUpperCase().includes('ALBIS') || s.supplierId === '1012447' },
  { label: 'YANDA +JOSTAR', match: s => s.supplierName.toUpperCase().includes('YANDA') || s.supplierName.toUpperCase().includes('JOSTAR') },
  { label: 'TRANSMARE', match: s => s.supplierName.toUpperCase().includes('TRANSMARE') }
];

const DEFAULT_SUPPLIER_RULES = {
  '1380763': 'PD', // Simonfond s.r.l. (PIECES DETACHEES - PD)
  '1012447': 'MP', // ALBIS PLASTIQUE FRANCE
  '1014087': 'MP', // SARL EL WATANIA GLASS
  '6640': 'PD',    // SENSUS FRANCE S.A.S.
  '1011032': 'PD', // SENSUS GMBH
  '1010979': 'PD', // SARL SANITARY LUXE ROBINETTERIE
  '1012946': 'S',  // SAIEG (Prestations / maintenance)
  '1009916': 'MA', // SPA GENERAL EMBALLAGE SETIF
  '1012594': 'S',  // TRANSIT SACI ABDELRAHMAN
  '1012700': 'S',  // TRANS GLORY
  '1009816': 'S',  // Douanes d'Alger
  '200037': 'S',   // douanes de skikda
  '200032': 'S',   // OFFICE ALGERIEN DE METROLOGIE
  '200034': 'S',   // ALGERIE TELECOM
  '200036': 'S',   // CMA CGM SKIKDA
  '1011978': 'S',  // ENTREPRISE PORTUAIRE DE SKIKDA
  '1010848': 'Diver', // SARL DJEMILA OFFICE
  '1013361': 'S',  // SARL BAOSEM
  '1013757': 'S',  // HOTEL DU LAC VERT
  '1013786': 'S',  // SARL BAY DIAB HOTEL
  '1011507': 'S',  // IBIS HOTEL
  '1013844': 'S'   // Notaire BOUDOUKHA BOUMÉDIÈNE
};

class Storage {
  constructor() {
    this.invoices = new Map();
    this.deletedPieces = new Set();
    this.suppliers = new Map();
    this.supplierRules = { ...DEFAULT_SUPPLIER_RULES };
    this.history = [];
    this.load();
  }

  load() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // Load Suppliers Master
      if (fs.existsSync(SUPPLIERS_FILE)) {
        try {
          const rawSups = fs.readFileSync(SUPPLIERS_FILE, 'utf8');
          const supsObj = JSON.parse(rawSups);
          Object.values(supsObj).forEach(s => {
            if (s.supplierId) {
              // Ensure Simonfond is strictly PD and Fixed
              if (s.supplierId === '1380763' || (s.supplierName && s.supplierName.toUpperCase().includes('SIMONFOND'))) {
                s.category = 'PD';
                s.isFixed = true;
              }
              this.suppliers.set(String(s.supplierId), s);
            }
          });
          console.log(`[Storage] Loaded ${this.suppliers.size} suppliers from suppliers master.`);
        } catch (e) {
          console.error('[Storage] Error loading suppliers.json:', e.message);
        }
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data.invoices && Array.isArray(data.invoices)) {
          data.invoices.forEach(inv => {
            // Apply Simonfond fix
            if (inv.supplierId === '1380763' || (inv.supplierName && inv.supplierName.toUpperCase().includes('SIMONFOND'))) {
              inv.category = 'PD';
            }
            this.invoices.set(inv.piece, inv);
            if (inv.isDeleted) {
              this.deletedPieces.add(inv.piece);
            }
            // Auto-register supplier if missing
            if (inv.supplierId && !this.suppliers.has(inv.supplierId)) {
              this.suppliers.set(inv.supplierId, {
                supplierId: inv.supplierId,
                supplierName: inv.supplierName || `FOURNISSEUR #${inv.supplierId}`,
                category: inv.category || 'Diver',
                isFixed: true,
                currency: inv.currency || 'DZD',
                isStrategic: false,
                invoiceCount: 1,
                totalVolume: Math.abs(inv.f41Amount || 0)
              });
            }
          });
        }
        if (data.deletedPieces && Array.isArray(data.deletedPieces)) {
          data.deletedPieces.forEach(p => this.deletedPieces.add(p));
        }
        if (data.supplierRules) {
          this.supplierRules = { ...this.supplierRules, ...data.supplierRules };
          this.supplierRules['1380763'] = 'PD';
        }
        if (data.history) {
          this.history = data.history;
        }
        console.log(`Loaded ${this.invoices.size} invoices (${this.deletedPieces.size} marked deleted) from persistent store.`);
      }
    } catch (err) {
      console.error('Error loading database:', err.message);
    }
  }

  save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = {
        invoices: Array.from(this.invoices.values()),
        deletedPieces: Array.from(this.deletedPieces),
        supplierRules: this.supplierRules,
        history: this.history,
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
      this.saveSuppliers();
    } catch (err) {
      console.error('Error saving database:', err.message);
    }
  }

  saveSuppliers() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const obj = {};
      this.suppliers.forEach((sup, id) => {
        obj[id] = sup;
      });
      fs.writeFileSync(SUPPLIERS_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving suppliers:', err.message);
    }
  }

  getSuppliersList() {
    const list = Array.from(this.suppliers.values());
    // Recalculate invoice counts & volumes dynamically from current invoices
    const stats = {};
    this.invoices.forEach(inv => {
      if (inv.isDeleted) return;
      const sid = inv.supplierId;
      if (!sid) return;
      if (!stats[sid]) stats[sid] = { count: 0, volume: 0 };
      stats[sid].count++;
      stats[sid].volume += Math.abs(inv.f41Amount || 0);
    });

    list.forEach(s => {
      if (stats[s.supplierId]) {
        s.invoiceCount = stats[s.supplierId].count;
        s.totalVolume = stats[s.supplierId].volume;
      }
    });

    return list.sort((a, b) => (b.totalVolume || 0) - (a.totalVolume || 0));
  }

  updateSupplier({ supplierId, supplierName, category, isFixed }) {
    if (!supplierId) throw new Error('supplierId is required');
    let sup = this.suppliers.get(String(supplierId));
    if (!sup) {
      sup = {
        supplierId: String(supplierId),
        supplierName: supplierName || `FOURNISSEUR #${supplierId}`,
        category: category || 'Diver',
        isFixed: isFixed !== undefined ? Boolean(isFixed) : true,
        currency: 'DZD',
        isStrategic: false,
        invoiceCount: 0,
        totalVolume: 0
      };
      this.suppliers.set(String(supplierId), sup);
    } else {
      if (supplierName !== undefined) sup.supplierName = supplierName;
      if (category !== undefined) sup.category = category;
      if (isFixed !== undefined) sup.isFixed = Boolean(isFixed);
      sup.updatedAt = new Date().toISOString();
    }

    // If Simonfond, keep PD strictly
    if (sup.supplierId === '1380763') {
      sup.category = 'PD';
      sup.isFixed = true;
    }

    // Sync supplierRules
    this.supplierRules[supplierId] = sup.category;

    // Propagate to existing invoices if isFixed is true (and invoice was not manually modified by user)
    let affectedCount = 0;
    if (sup.isFixed) {
      this.invoices.forEach(inv => {
        if (inv.supplierId === supplierId && !inv.isUserModified) {
          inv.category = sup.category;
          inv.updatedAt = new Date().toISOString();
          affectedCount++;
        }
      });
    }

    this.save();
    return { supplier: sup, affectedInvoices: affectedCount };
  }

  suggestCategory(supplierId, supplierName, glAccounts = []) {
    const sId = String(supplierId || '');
    const sup = this.suppliers.get(sId);

    // 1. If supplier is explicitly FIXED: ALWAYS enforce supplier category!
    if (sup && sup.isFixed && sup.category) {
      return sup.category;
    }

    // 2. Multi-categories / Dynamic mode: Deduce from G/L accounts first!
    if (Array.isArray(glAccounts) && glAccounts.length > 0) {
      if (glAccounts.some(a => a === '2200010' || a === '21040102' || a.startsWith('21') || a.startsWith('22') || a.startsWith('23'))) {
        return 'EQUIP';
      }
      if (glAccounts.some(a => a === '16010800' || a === '3000005' || a.startsWith('380') || a.startsWith('600'))) {
        return 'MP';
      }
      if (glAccounts.some(a => a === '3110014' || a.startsWith('381') || a.startsWith('602'))) {
        return 'MA';
      }
      if (glAccounts.some(a => a === '16000010' || a === '16030110' || a.startsWith('382') || a.startsWith('603'))) {
        return 'PD';
      }
      if (glAccounts.some(a => a === '16000007' || a.startsWith('40') || a.startsWith('44') || a.startsWith('46') || a.startsWith('61') || a.startsWith('62') || a === '19210000' || a === '19230000')) {
        return 'S';
      }
    }

    // 3. Fallback to supplier category if defined
    if (sup && sup.category) {
      return sup.category;
    }
    if (this.supplierRules[sId]) {
      return this.supplierRules[sId];
    }

    // 4. Name heuristics
    const upperName = (supplierName || '').toUpperCase();
    if (upperName.includes('TRANSIT') || upperName.includes('DOUANE') || upperName.includes('HOTEL') || upperName.includes('PORT') || upperName.includes('TELECOM')) {
      return 'S';
    }
    if (upperName.includes('EMBALLAGE') || upperName.includes('CARTON')) {
      return 'MA';
    }
    if (upperName.includes('OFFICE') || upperName.includes('FOURNITURE') || upperName.includes('BUREAU')) {
      return 'Diver';
    }
    if (upperName.includes('PLAST') || upperName.includes('FONDR') || upperName.includes('METAL') || upperName.includes('VERRE') || upperName.includes('GLASS')) {
      return 'MP';
    }
    return 'Diver';
  }

  importData(f41List, fbl3nMap, sourceName = 'Manual Import') {
    let newCount = 0;
    let updatedCount = 0;
    let previouslyDeletedCount = 0;

    f41List.forEach(item => {
      const piece = item.piece;
      const fbl = fbl3nMap.get(piece) || { debours: 0, retunie: 0, tva: 0, glAccounts: [] };

      const existing = this.invoices.get(piece);
      const wasDeletedBefore = this.deletedPieces.has(piece) || (existing && existing.isDeleted);

      const debours = fbl.debours || 0;
      const retunie = fbl.retunie || 0;
      const tva = fbl.tva || 0;
      const f41Amount = item.f41Amount || 0;

      const netHT = f41Amount + retunie - tva - debours;

      if (existing) {
        existing.f41Amount = f41Amount;
        existing.foreignAmount = item.foreignAmount;
        existing.affectation = item.affectation;
        existing.retunie = retunie;
        existing.tva = tva;
        existing.debours = debours;
        existing.netHT = netHT;
        existing.glAccounts = fbl.glAccounts || existing.glAccounts;
        if (wasDeletedBefore) {
          existing.isDeleted = true;
          existing.wasPreviouslyDeleted = true;
          existing.status = 'previously_deleted';
          previouslyDeletedCount++;
        }
        existing.updatedAt = new Date().toISOString();
        updatedCount++;
      } else {
        const suggestedCat = this.suggestCategory(item.supplierId, item.supplierName, fbl.glAccounts);
        const newInvoice = {
          piece,
          docType: item.docType,
          postingKey: item.postingKey,
          datePiece: item.datePiece,
          dateComptable: item.dateComptable,
          year: item.year,
          month: item.month,
          yearMonth: item.yearMonth,
          currency: item.currency,
          isLocal: item.isLocal,
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          affectation: item.affectation,
          foreignAmount: item.foreignAmount,
          f41Amount,
          retunie,
          tva,
          debours,
          netHT,
          glAccounts: fbl.glAccounts,
          category: suggestedCat,
          status: wasDeletedBefore ? 'previously_deleted' : 'treated',
          isDeleted: Boolean(wasDeletedBefore),
          wasPreviouslyDeleted: Boolean(wasDeletedBefore),
          isUserModified: false,
          createdAt: new Date().toISOString()
        };
        if (wasDeletedBefore) previouslyDeletedCount++;
        this.invoices.set(piece, newInvoice);
        newCount++;
      }
    });

    this.history.push({
      date: new Date().toISOString(),
      source: sourceName,
      totalInF41: f41List.length,
      newInvoices: newCount,
      updatedInvoices: updatedCount,
      previouslyDeletedInvoices: previouslyDeletedCount
    });

    this.save();
    return { newCount, updatedCount, previouslyDeletedCount, totalCount: this.invoices.size };
  }

  deleteInvoice(piece) {
    const inv = this.invoices.get(piece);
    if (!inv) return null;

    inv.isDeleted = true;
    inv.wasPreviouslyDeleted = true;
    inv.status = 'previously_deleted';
    inv.deletedAt = new Date().toISOString();
    this.deletedPieces.add(piece);

    this.save();
    return inv;
  }

  deleteInvoicesBulk(pieces = []) {
    let count = 0;
    pieces.forEach(p => {
      const inv = this.invoices.get(p);
      if (inv) {
        inv.isDeleted = true;
        inv.wasPreviouslyDeleted = true;
        inv.status = 'previously_deleted';
        inv.deletedAt = new Date().toISOString();
        this.deletedPieces.add(p);
        count++;
      }
    });
    this.save();
    return { count };
  }

  restoreInvoice(piece) {
    const inv = this.invoices.get(piece);
    if (!inv) return null;

    inv.isDeleted = false;
    inv.wasPreviouslyDeleted = false;
    inv.restoredAt = new Date().toISOString();
    inv.status = 'treated';
    this.deletedPieces.delete(piece);

    this.save();
    return inv;
  }

  updateCategory(piece, newCategory, applyToSupplier = false) {
    const inv = this.invoices.get(piece);
    if (!inv) return null;

    if (!CATEGORIES.includes(newCategory)) {
      throw new Error(`Catégorie invalide: ${newCategory}`);
    }

    inv.category = newCategory;
    inv.isUserModified = true;
    inv.updatedAt = new Date().toISOString();

    if (applyToSupplier && inv.supplierId) {
      this.supplierRules[inv.supplierId] = newCategory;
      this.invoices.forEach(other => {
        if (other.supplierId === inv.supplierId && !other.isUserModified) {
          other.category = newCategory;
        }
      });
    }

    this.save();
    return inv;
  }

  updateSupplierDefaultCategory(supplierId, newCategory, applyToAllInvoices = true) {
    if (!CATEGORIES.includes(newCategory)) {
      throw new Error(`Catégorie invalide: ${newCategory}`);
    }

    this.supplierRules[supplierId] = newCategory;
    let updatedCount = 0;

    if (applyToAllInvoices) {
      this.invoices.forEach(inv => {
        if (inv.supplierId === supplierId) {
          inv.category = newCategory;
          inv.isUserModified = true;
          inv.updatedAt = new Date().toISOString();
          updatedCount++;
        }
      });
    }

    this.save();
    return { supplierId, newCategory, updatedCount };
  }

  getSuppliers() {
    const map = new Map();

    this.invoices.forEach(inv => {
      if (inv.isDeleted) return;
      const id = inv.supplierId || 'INCONNU';
      if (!map.has(id)) {
        map.set(id, {
          supplierId: id,
          supplierName: inv.supplierName || 'Fournisseur Inconnu',
          isLocal: inv.isLocal,
          currency: inv.currency,
          totalAmount: 0,
          totalForeignAmount: 0,
          invoiceCount: 0,
          categories: {},
          defaultCategory: this.supplierRules[id] || inv.category
        });
      }

      const s = map.get(id);
      s.totalAmount += inv.netHT || 0;
      if (!inv.isLocal && inv.foreignAmount) {
        s.totalForeignAmount = (s.totalForeignAmount || 0) + inv.foreignAmount;
      }
      s.invoiceCount++;
      s.categories[inv.category] = (s.categories[inv.category] || 0) + 1;
    });

    const list = Array.from(map.values()).map(s => {
      const distinctCats = Object.keys(s.categories);
      return {
        ...s,
        distinctCategories: distinctCats,
        hasMultipleCategories: distinctCats.length > 1
      };
    });

    list.sort((a, b) => b.totalAmount - a.totalAmount);
    return list;
  }

  getInvoices(filters = {}) {
    let list = Array.from(this.invoices.values());

    const statusFilter = filters.status || 'ACTIVE';
    if (statusFilter === 'ACTIVE') {
      list = list.filter(i => !i.isDeleted);
    } else if (statusFilter === 'DELETED') {
      list = list.filter(i => i.isDeleted === true);
    }

    if (filters.category && filters.category !== 'ALL') {
      list = list.filter(i => i.category === filters.category);
    }
    if (filters.market && filters.market !== 'ALL') {
      const isLocal = filters.market === 'LOCAL';
      list = list.filter(i => i.isLocal === isLocal);
    }
    if (filters.year && filters.year !== 'ALL') {
      list = list.filter(i => String(i.year) === String(filters.year));
    }
    if (filters.month && filters.month !== 'ALL') {
      list = list.filter(i => i.month === filters.month);
    }
    if (filters.supplierId) {
      list = list.filter(i => i.supplierId === filters.supplierId);
    }
    if (filters.supplier) {
      const q = filters.supplier.toLowerCase();
      list = list.filter(i => (i.supplierName && i.supplierName.toLowerCase().includes(q)) || (i.supplierId && i.supplierId.includes(q)));
    }
    if (filters.onlyMultiCategory) {
      const multiSuppliers = new Set(this.getSuppliers().filter(s => s.hasMultipleCategories).map(s => s.supplierId));
      list = list.filter(i => multiSuppliers.has(i.supplierId));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(i => 
        i.piece.toLowerCase().includes(q) ||
        (i.supplierName && i.supplierName.toLowerCase().includes(q)) ||
        (i.affectation && i.affectation.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => (b.dateComptable || '').localeCompare(a.dateComptable || ''));
    return list;
  }

  getDashboardData(filters = {}) {
    const list = this.getInvoices({ ...filters, status: 'ACTIVE' });

    let totalNetHT = 0;
    let totalF41 = 0;
    let totalRetenue = 0;
    let totalTva = 0;
    let totalDebours = 0;

    let positiveCount = 0;
    let positiveAmount = 0;
    let creditCount = 0;
    let creditAmount = 0;

    const byCategory = {};
    CATEGORIES.forEach(c => byCategory[c] = { amount: 0, count: 0, percentage: 0 });

    const byMarket = {
      Local: { amount: 0, count: 0, percentage: 0 },
      Etranger: { amount: 0, count: 0, percentage: 0 }
    };

    const bySupplier = {};
    const byMonth = {};
    const byYear = {};

    list.forEach(inv => {
      const amt = inv.netHT || 0;
      totalNetHT += amt;
      totalF41 += inv.f41Amount || 0;
      totalRetenue += inv.retunie || 0;
      totalTva += inv.tva || 0;
      totalDebours += inv.debours || 0;

      if (amt >= 0) {
        positiveCount++;
        positiveAmount += amt;
      } else {
        creditCount++;
        creditAmount += amt;
      }

      const cat = inv.category || 'Diver';
      if (!byCategory[cat]) byCategory[cat] = { amount: 0, count: 0, percentage: 0 };
      byCategory[cat].amount += amt;
      byCategory[cat].count++;

      const mktKey = inv.isLocal ? 'Local' : 'Etranger';
      byMarket[mktKey].amount += amt;
      byMarket[mktKey].count++;

      const suppId = inv.supplierId || 'INCONNU';
      if (!bySupplier[suppId]) {
        bySupplier[suppId] = {
          supplierId: suppId,
          supplierName: inv.supplierName || 'Fournisseur Inconnu',
          amount: 0,
          grossAmount: 0,
          creditAmount: 0,
          foreignAmount: 0,
          count: 0,
          isLocal: inv.isLocal,
          currency: inv.currency,
          categories: new Set()
        };
      }
      bySupplier[suppId].amount += amt;
      if (amt >= 0) bySupplier[suppId].grossAmount += amt;
      else bySupplier[suppId].creditAmount += amt;

      if (!inv.isLocal && inv.foreignAmount) {
        bySupplier[suppId].foreignAmount += inv.foreignAmount;
      }
      bySupplier[suppId].count++;
      bySupplier[suppId].categories.add(inv.category);

      const ym = inv.yearMonth || `${inv.year}-${inv.month}`;
      if (!byMonth[ym]) byMonth[ym] = { yearMonth: ym, amount: 0, count: 0 };
      byMonth[ym].amount += amt;
      byMonth[ym].count++;

      const yr = inv.year || '2026';
      if (!byYear[yr]) byYear[yr] = { year: yr, amount: 0, count: 0 };
      byYear[yr].amount += amt;
      byYear[yr].count++;
    });

    totalNetHT = Number(totalNetHT.toFixed(2));
    totalF41 = Number(totalF41.toFixed(2));
    totalRetenue = Number(totalRetenue.toFixed(2));
    totalTva = Number(totalTva.toFixed(2));
    totalDebours = Number(totalDebours.toFixed(2));
    positiveAmount = Number(positiveAmount.toFixed(2));
    creditAmount = Number(creditAmount.toFixed(2));

    if (totalNetHT > 0) {
      CATEGORIES.forEach(c => {
        byCategory[c].amount = Number(byCategory[c].amount.toFixed(2));
        byCategory[c].percentage = Number(((byCategory[c].amount / totalNetHT) * 100).toFixed(2));
      });
      byMarket.Local.amount = Number(byMarket.Local.amount.toFixed(2));
      byMarket.Local.percentage = Number(((byMarket.Local.amount / totalNetHT) * 100).toFixed(2));
      byMarket.Etranger.amount = Number(byMarket.Etranger.amount.toFixed(2));
      byMarket.Etranger.percentage = Number(((byMarket.Etranger.amount / totalNetHT) * 100).toFixed(2));
    }

    const topSuppliers = Object.values(bySupplier)
      .map(s => ({
        ...s,
        amount: Number(s.amount.toFixed(2)),
        grossAmount: Number(s.grossAmount.toFixed(2)),
        creditAmount: Number(s.creditAmount.toFixed(2)),
        foreignAmount: Number(s.foreignAmount.toFixed(2)),
        categories: Array.from(s.categories),
        hasMultipleCategories: s.categories.size > 1,
        percentage: totalNetHT > 0 ? Number(((s.amount / totalNetHT) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    const multiCategorySuppliers = topSuppliers.filter(s => s.hasMultipleCategories);
    const sortedMonths = Object.values(byMonth)
      .map(m => ({ ...m, amount: Number(m.amount.toFixed(2)) }))
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

    const allYears = Array.from(new Set(Array.from(this.invoices.values()).map(i => i.year))).filter(Boolean).sort();
    const allMonths = Array.from(new Set(Array.from(this.invoices.values()).map(i => i.month))).filter(Boolean).sort();

    const allInvoicesList = Array.from(this.invoices.values());
    const totalActive = allInvoicesList.filter(i => !i.isDeleted).length;
    const totalDeleted = allInvoicesList.filter(i => i.isDeleted).length;

    const hasActiveFilters = Boolean(
      (filters.year && filters.year !== 'ALL') ||
      (filters.month && filters.month !== 'ALL') ||
      (filters.category && filters.category !== 'ALL') ||
      (filters.market && filters.market !== 'ALL') ||
      (filters.search && filters.search.trim())
    );

    return {
      totals: {
        totalNetHT,
        totalF41,
        totalRetenue,
        totalTva,
        totalDebours,
        positiveCount,
        positiveAmount,
        creditCount,
        creditAmount,
        invoiceCount: list.length,
        totalActive,
        totalDeleted,
        totalInStore: this.invoices.size,
        hasActiveFilters
      },
      byCategory,
      byMarket,
      topSuppliers: topSuppliers.slice(0, 10),
      multiCategorySuppliers,
      byMonth: sortedMonths,
      byYear: Object.values(byYear),
      availableFilters: {
        years: allYears,
        months: allMonths,
        categories: CATEGORIES
      }
    };
  }

  getManagementReport(filters = {}, unit = 'KDA') {
    const list = this.getInvoices({ ...filters, status: 'ACTIVE' });
    let totalNetHT = 0;

    const byCat = {};
    CATEGORIES.forEach(c => byCat[c] = 0);

    let localAmt = 0;
    let etrangerAmt = 0;

    const supplierMap = new Map();

    list.forEach(inv => {
      const amt = inv.netHT || 0;
      totalNetHT += amt;

      const cat = inv.category || 'Diver';
      byCat[cat] = (byCat[cat] || 0) + amt;

      if (inv.isLocal) localAmt += amt;
      else etrangerAmt += amt;

      const suppId = inv.supplierId || 'INCONNU';
      if (!supplierMap.has(suppId)) {
        supplierMap.set(suppId, {
          supplierId: suppId,
          supplierName: inv.supplierName || 'Inconnu',
          totalAmount: 0
        });
      }
      supplierMap.get(suppId).totalAmount += amt;
    });

    totalNetHT = Number(totalNetHT.toFixed(2));
    const divisor = unit === 'KDA' ? 1000 : (unit === 'MDA' ? 1000000 : 1);

    // 1. Rubriques Table
    let rubriquesRawSum = 0;
    const rubriques = RUBRIQUES_CONFIG.map(r => {
      const rawAmt = byCat[r.code] || 0;
      rubriquesRawSum += rawAmt;
      const val = Math.round(rawAmt / divisor);
      const ratio = totalNetHT > 0 ? Number(((rawAmt / totalNetHT) * 100).toFixed(2)) : 0;
      return {
        code: r.code,
        label: r.label,
        rawAmount: rawAmt,
        val: val,
        ratio: ratio
      };
    });

    // 2. Strategic Suppliers Table
    const allSupps = Array.from(supplierMap.values());
    const matchedIds = new Set();
    let stratRawSum = 0;

    const suppliersTable = STRATEGIC_SUPPLIERS.map(item => {
      const matched = allSupps.filter(item.match);
      const amt = matched.reduce((a, s) => { matchedIds.add(s.supplierId); return a + s.totalAmount; }, 0);
      stratRawSum += amt;
      const val = Math.round(amt / divisor);
      const ratio = totalNetHT > 0 ? Number(((amt / totalNetHT) * 100).toFixed(2)) : 0;
      return {
        label: item.label,
        rawAmount: amt,
        val: val,
        ratio: ratio
      };
    });

    const othersSupps = allSupps.filter(s => !matchedIds.has(s.supplierId));
    const othersRawAmt = othersSupps.reduce((a, s) => a + s.totalAmount, 0);
    const othersVal = Math.round(othersRawAmt / divisor);
    const othersRatio = totalNetHT > 0 ? Number(((othersRawAmt / totalNetHT) * 100).toFixed(2)) : 0;

    suppliersTable.push({
      label: 'Autres',
      rawAmount: othersRawAmt,
      val: othersVal,
      ratio: othersRatio
    });

    // 3. Type Loc / Etranger Table
    const localVal = Math.round(localAmt / divisor);
    const localRatio = totalNetHT > 0 ? Number(((localAmt / totalNetHT) * 100).toFixed(2)) : 0;

    const etrangerVal = Math.round(etrangerAmt / divisor);
    const etrangerRatio = totalNetHT > 0 ? Number(((etrangerAmt / totalNetHT) * 100).toFixed(2)) : 0;

    const marketsTable = [
      { label: 'Achats locaux', rawAmount: localAmt, val: localVal, ratio: localRatio },
      { label: 'Achats Etrangers', rawAmount: etrangerAmt, val: etrangerVal, ratio: etrangerRatio }
    ];

    const totalVal = Math.round(totalNetHT / divisor);

    // Period label
    let periodLabel = 'Janvier-Septembre 2026';
    if (filters.month && filters.month !== 'ALL') {
      const monthNames = { '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril', '05': 'Mai', '06': 'Juin', '07': 'Juillet', '08': 'Août', '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre' };
      periodLabel = `${monthNames[filters.month] || filters.month} ${filters.year || 2026}`;
    } else if (filters.year && filters.year !== 'ALL') {
      periodLabel = `Exercice ${filters.year}`;
    }

    return {
      unit,
      divisor,
      periodLabel,
      totalNetHT,
      totalVal,
      rubriques,
      suppliers: suppliersTable,
      markets: marketsTable,
      invoiceCount: list.length
    };
  }
}

module.exports = new Storage();
