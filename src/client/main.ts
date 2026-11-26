// ==========================================================================
// SENSUS SPA — EXECUTIVE FINANCIAL REPORTING SYSTEM
// CLIENT JAVASCRIPT: MULTI-PAGE ENGINE, LIVE UNIT CONVERTER (KDA/DA/MDA),
// A4 PRINTABLE DOSSIER & REACTIVE SAP DATA FILTERS
// ==========================================================================

import type { AuthUser, ClientAppState } from './types';

const MONTH_NAMES: Record<string, string> = {
  'ALL': 'Cumul annuel (Tous les mois)',
  '1': '01 - Janvier',
  '2': '02 - Février',
  '3': '03 - Mars',
  '4': '04 - Avril',
  '5': '05 - Mai',
  '6': '06 - Juin',
  '7': '07 - Juillet',
  '8': '08 - Août',
  '9': '09 - Septembre',
  '10': '10 - Octobre',
  '11': '11 - Novembre',
  '12': '12 - Décembre'
};

const YEAR_SELECT_IDS = [
  'globalSelectYear',
  'filterInvoiceYear',
  'selectConsommationYear',
  'selectStocksYear',
  'selectFiscaliteYear',
  'selectBilanYear',
  'selectTCRYear',
  'selectTFTYear'
];

const MONTH_SELECT_IDS = [
  'globalSelectMonth',
  'filterInvoiceMonth',
  'selectConsommationMonth',
  'selectStocksMonth',
  'selectFiscaliteMonth',
  'selectBilanMonth',
  'selectTCRMonth',
  'selectTFTMonth'
];

// Global Application State
const AppState: ClientAppState = {
  unit: localStorage.getItem('sensus_unit') || 'KDA', // Default is KDA
  period: 'AOUT_2026',
  selectedYear: localStorage.getItem('sensus_year') || '2025',
  selectedMonth: localStorage.getItem('sensus_month') || 'ALL',
  availableYears: [],
  monthsByYear: {},
  doc9Data: null,
  allInvoices: [],
  filteredInvoices: [],
  allSuppliers: [],
  filteredSuppliers: [],
  supplierFilter: 'all',
  supplierSearch: '',
  stocksData: null,
  consommationData: null,
  fiscaliteData: null,
  tcrData: null,
  tcrSource: 'balance', // 'balance' or 'gl'
  bilanData: null,
  bilanSource: 'balance', // 'balance' or 'gl'
  tftData: null,
  balanceData: null,
  balancePeriods: [],
  selectedBalancePeriod: '102026',
  balanceClassFilter: '',
  balanceSearch: '',
  settingsStatus: null,
  fbl3nData: null,
  fbl3nFilters: {
    year: '',
    month: '',
    account: '',
    docType: '',
    search: '',
    page: 1,
    limit: 50
  },
  fbl3nOptions: null
};

// ==========================================================================
// 0. AUTHENTICATION & ACCESS CONTROL
// ==========================================================================
let currentUser: AuthUser | null = null;

function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('sensus_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setStoredUser(user) {
  if (user) {
    localStorage.setItem('sensus_auth_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('sensus_auth_user');
  }
}

function applyUserRole(user) {
  const overlay = document.getElementById('authOverlay');
  const userNameEl = document.getElementById('currentUserName');
  const roleBadgeEl = document.getElementById('currentUserRoleBadge');

  if (!user) {
    if (overlay) overlay.style.display = 'flex';
    document.body.classList.remove('role-restricted');
    return;
  }

  // User is logged in
  if (overlay) overlay.style.display = 'none';

  if (userNameEl) {
    userNameEl.textContent = user.displayName || user.username;
  }

  if (roleBadgeEl) {
    if (user.role === 'admin') {
      roleBadgeEl.textContent = 'Admin Total';
      roleBadgeEl.style.background = '#0284c7';
      roleBadgeEl.style.color = '#ffffff';
      document.body.classList.remove('role-restricted');
    } else {
      roleBadgeEl.textContent = 'États SCF & Import';
      roleBadgeEl.style.background = '#10b981';
      roleBadgeEl.style.color = '#ffffff';
      document.body.classList.add('role-restricted');
      // Ensure the dropdown is open for quick access
      const dropdownFin = document.getElementById('dropdownFinanciers');
      if (dropdownFin) dropdownFin.classList.add('open');
    }
  }
}

function isPageAllowed(pageId, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const allowed = [
    'page-bilan',
    'page-tcr',
    'page-balance',
    'page-tft',
    'page-parametres',
    'page-import'
  ];
  return allowed.includes(pageId);
}

function initAuth() {
  const form = document.getElementById('authLoginForm');
  const alertBox = document.getElementById('authErrorAlert');
  const pwdInput = document.getElementById('authPassword');
  const btnTogglePwd = document.getElementById('btnToggleAuthPwd');
  const btnLogout = document.getElementById('btnLogout');

  if (btnTogglePwd && pwdInput) {
    btnTogglePwd.addEventListener('click', () => {
      const type = pwdInput.getAttribute('type') === 'password' ? 'text' : 'password';
      pwdInput.setAttribute('type', type);
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (e) { }
      currentUser = null;
      setStoredUser(null);
      applyUserRole(null);
      if (pwdInput) pwdInput.value = '';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('authUsername');
      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = pwdInput ? pwdInput.value.trim() : '';

      if (alertBox) {
        alertBox.style.display = 'none';
        alertBox.textContent = '';
      }

      const submitBtn = document.getElementById('btnSubmitLogin');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Connexion en cours...</span>';
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success && data.user) {
          currentUser = data.user;
          setStoredUser(currentUser);
          applyUserRole(currentUser);

          // Redirect to appropriate landing page
          if (currentUser.role === 'admin') {
            const currentRoute = window.location.hash || window.location.pathname;
            const targetPageId = getPageIdFromRoute(currentRoute);
            navigateToPage(targetPageId, true);
          } else {
            // khaled.kaddour -> land on bilan or requested allowed page
            const currentRoute = window.location.hash || '';
            const targetPageId = getPageIdFromRoute(currentRoute);
            if (isPageAllowed(targetPageId, currentUser)) {
              navigateToPage(targetPageId, true);
            } else {
              navigateToPage('page-bilan', true);
            }
          }
        } else {
          if (alertBox) {
            alertBox.textContent = data.error || 'Identifiant ou mot de passe incorrect.';
            alertBox.style.display = 'flex';
          }
        }
      } catch (err) {
        if (alertBox) {
          alertBox.textContent = 'Erreur réseau ou serveur inaccessible.';
          alertBox.style.display = 'flex';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Se connecter</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
        }
      }
    });
  }

  // Check stored user on startup
  currentUser = getStoredUser();
  applyUserRole(currentUser);
}

// Document Lifecycle Init
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initNavigation();
  initSidebarToggle();
  initUnitSystem();
  initYearSystem();
  initPeriodSelector();
  initActionButtons();
  initObservationsControls();
  initAchatsFilters();
  initSuppliersControls();
  initTCRControls();
  initBilanControls();
  initBalanceControls();
  initTFTControls();
  initFBL3NControls();
  initImportPage();

  // Resolve initial route from URL (e.g. #stocks, /stocks, etc.)
  if (currentUser) {
    const currentRoute = window.location.hash || window.location.pathname;
    let initialPageId = getPageIdFromRoute(currentRoute);
    if (!isPageAllowed(initialPageId, currentUser)) {
      initialPageId = 'page-bilan';
    }
    navigateToPage(initialPageId, true);
  }
});

// ==========================================================================
// 1. UNIT SYSTEM (KDA / DA / MDA)
// ==========================================================================
function initUnitSystem() {
  applyUnitUI(AppState.unit);

  // Topbar pills listener
  document.querySelectorAll('.unit-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const selected = e.target.getAttribute('data-unit');
      setGlobalUnit(selected);
    });
  });

  // Settings page radio buttons listener
  document.querySelectorAll('input[name="optUnit"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        setGlobalUnit(e.target.value);
      }
    });
  });
}

function setGlobalUnit(newUnit) {
  if (!['KDA', 'DA', 'MDA'].includes(newUnit)) return;
  AppState.unit = newUnit;
  localStorage.setItem('sensus_unit', newUnit);

  applyUnitUI(newUnit);
  reRenderAllPages();
}

function applyUnitUI(unit) {
  // 1. Topbar pills active state
  document.querySelectorAll('.unit-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-unit') === unit);
  });

  // 2. Radio button in Paramètres page
  const radio = document.querySelector(`input[name="optUnit"][value="${unit}"]`);
  if (radio) radio.checked = true;

  // 3. Badges in sidebar and top letterhead
  const sidebarBadge = document.getElementById('sidebarUnitBadge');
  if (sidebarBadge) sidebarBadge.textContent = unit;

  const docUnitFlag = document.getElementById('docUnitFlag');
  if (docUnitFlag) docUnitFlag.textContent = unit;

  // 4. Update all table column headers mentioning unit
  document.querySelectorAll('.col-unit').forEach(el => {
    el.textContent = unit;
  });

  // 5. Update preview in Paramètres page
  const previewEl = document.getElementById('previewParamValue');
  if (previewEl) {
    const sampleKda = 254429; // 254 429 KDA = 254 429 000 DA
    previewEl.textContent = `➔ ${formatFromKDA(sampleKda, true)}`;
  }
}

// Convert numbers that are natively in KDA (Document 9 tables)
function formatFromKDA(valInKDA, withUnit = false) {
  if (valInKDA === null || valInKDA === undefined || isNaN(valInKDA)) return '—';

  let converted = valInKDA;
  let formatted = '';

  if (AppState.unit === 'DA') {
    converted = valInKDA * 1000;
    formatted = Number(converted).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (AppState.unit === 'MDA') {
    converted = valInKDA / 1000;
    formatted = Number(converted).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    // KDA
    converted = valInKDA;
    formatted = Math.round(converted).toLocaleString('fr-FR');
  }

  return withUnit ? `${formatted} ${AppState.unit}` : formatted;
}

// Convert numbers that are natively in raw Algerian Dinars DA (Invoices, GL accounts)
function formatFromDA(valInDA, withUnit = false) {
  if (valInDA === null || valInDA === undefined || isNaN(valInDA)) return '—';

  let converted = valInDA;
  let formatted = '';

  if (AppState.unit === 'DA') {
    converted = valInDA;
    formatted = Number(converted).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (AppState.unit === 'MDA') {
    converted = valInDA / 1000000;
    formatted = Number(converted).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    // KDA
    converted = valInDA / 1000;
    formatted = Math.round(converted).toLocaleString('fr-FR');
  }

  return withUnit ? `${formatted} ${AppState.unit}` : formatted;
}

// Format percentages cleanly
function formatPct(val) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} %`;
}

// ==========================================================================
// 1b. DYNAMIC YEAR & MONTH FILTERING SYSTEM (SYNCHRONIZED ACROSS ALL PAGES)
// ==========================================================================
async function loadAvailableYears() {
  try {
    const res = await fetch('/api/years');
    const data = await res.json();
    if (data.success && Array.isArray(data.years) && data.years.length > 0) {
      AppState.availableYears = data.years.map(y => String(y));
      AppState.activeDataYears = (data.activeDataYears || []).map(y => String(y));
      AppState.monthsByYear = data.monthsByYear || {};
    } else {
      AppState.availableYears = ['2025', '2026'];
      AppState.monthsByYear = {};
    }
  } catch (err) {
    console.error('Failed to load available years:', err);
    if (!AppState.availableYears || AppState.availableYears.length === 0) {
      AppState.availableYears = ['2025', '2026'];
      AppState.monthsByYear = {};
    }
  }

  // Always default to the most recent year with data, or the latest available year
  if (AppState.activeDataYears && AppState.activeDataYears.length > 0) {
    // Sort descending to ensure latest year is first
    AppState.activeDataYears.sort((a, b) => parseInt(String(b), 10) - parseInt(String(a), 10));
    AppState.selectedYear = String(AppState.activeDataYears[0]);
    localStorage.setItem('sensus_year', AppState.selectedYear);
  } else if (AppState.availableYears && AppState.availableYears.length > 0) {
    AppState.availableYears.sort((a, b) => parseInt(String(b), 10) - parseInt(String(a), 10));
    AppState.selectedYear = String(AppState.availableYears[0]);
    localStorage.setItem('sensus_year', AppState.selectedYear);
  }

  populateYearSelects();
  populateMonthSelects();
}

function populateYearSelects() {
  const uniqueYears = [...new Set((AppState.availableYears || []).map(y => String(y).trim()).filter(Boolean))];
  YEAR_SELECT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    let html = '';
    uniqueYears.forEach(y => {
      const isSel = (String(y) === String(AppState.selectedYear)) ? 'selected' : '';
      html += `<option value="${y}" ${isSel}>Exercice ${y}</option>`;
    });
    el.innerHTML = html;
    el.value = AppState.selectedYear;
  });

  // Also sync FBL3N year filter dropdown
  const fbl3nYearEl = document.getElementById('fbl3nFilterYear');
  if (fbl3nYearEl) {
    let html = '<option value="">Toutes les années (' + uniqueYears.join(', ') + ')</option>';
    uniqueYears.forEach(y => {
      const isSel = (AppState.fbl3nFilters && String(AppState.fbl3nFilters.year) === String(y)) ? 'selected' : '';
      html += `<option value="${y}" ${isSel}>${y}</option>`;
    });
    fbl3nYearEl.innerHTML = html;
  }
}

function populateMonthSelects() {
  const activeMonths = (AppState.monthsByYear && AppState.monthsByYear[AppState.selectedYear]) || [];

  MONTH_SELECT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    let html = `<option value="ALL" ${AppState.selectedMonth === 'ALL' ? 'selected' : ''}>Cumul annuel (Tous les mois)</option>`;
    for (let m = 1; m <= 12; m++) {
      const isSel = (String(m) === String(AppState.selectedMonth)) ? 'selected' : '';
      const hasData = activeMonths.includes(m);
      const tag = hasData ? ' • Données' : '';
      html += `<option value="${m}" ${isSel}>${MONTH_NAMES[m]}${tag}</option>`;
    }
    el.innerHTML = html;
    el.value = AppState.selectedMonth;
  });

  // Also sync FBL3N month select if present
  const fbl3nMonthEl = document.getElementById('fbl3nFilterMonth');
  if (fbl3nMonthEl && AppState.selectedMonth !== 'ALL') {
    fbl3nMonthEl.value = AppState.selectedMonth;
  }

  // Update visibility and label of quick delete buttons in financial control bars
  const isMonthSelected = AppState.selectedMonth && AppState.selectedMonth !== 'ALL';
  const btnDelBilan = document.getElementById('btnDeleteBilanMonth');
  if (btnDelBilan) {
    btnDelBilan.style.display = isMonthSelected ? 'inline-block' : 'none';
    if (isMonthSelected) btnDelBilan.textContent = `🗑️ Vider M${AppState.selectedMonth}`;
  }
  const btnDelTCR = document.getElementById('btnDeleteTCRMonth');
  if (btnDelTCR) {
    btnDelTCR.style.display = isMonthSelected ? 'inline-block' : 'none';
    if (isMonthSelected) btnDelTCR.textContent = `🗑️ Vider M${AppState.selectedMonth}`;
  }
}

function setSelectedYear(year) {
  if (!year) return;
  AppState.selectedYear = String(year);
  localStorage.setItem('sensus_year', AppState.selectedYear);

  // Invalidate all report caches across the board so the new year is fetched fresh
  AppState.tcrData = null;
  AppState.bilanData = null;
  AppState.tftData = null;
  AppState.allInvoices = [];
  AppState.stocksData = null;
  AppState.consommationData = null;
  AppState.fiscaliteData = null;
  AppState.doc9Data = null;

  populateYearSelects();
  populateMonthSelects();

  // Reload current active page to apply the year filter
  const currentRoute = window.location.hash || window.location.pathname;
  const activeSection = document.querySelector('.page-section.active');
  const pageId = activeSection?.id || getPageIdFromRoute(currentRoute);

  if (pageId === 'page-achats') {
    loadAchatsPage();
  } else if (pageId === 'page-consommation') {
    loadConsommationPage();
  } else if (pageId === 'page-stocks') {
    loadStocksPage();
  } else if (pageId === 'page-fiscalite') {
    loadFiscalitePage();
  } else if (pageId === 'page-bilan') {
    loadBilanPage(true);
  } else if (pageId === 'page-tcr') {
    loadTCRPage(true);
  } else if (pageId === 'page-tft') {
    loadTFTPage(true);
  } else if (pageId === 'page-fbl3n') {
    AppState.fbl3nFilters.year = AppState.selectedYear;
    AppState.fbl3nFilters.month = AppState.selectedMonth === 'ALL' ? '' : AppState.selectedMonth;
    AppState.fbl3nFilters.page = 1;
    updateFBL3NMonthOptions(AppState.selectedYear);
    fetchFBL3NData();
  } else if (pageId === 'page-doc9') {
    loadDocument9Report();
  }
}

function setSelectedMonth(month) {
  if (!month) month = 'ALL';
  AppState.selectedMonth = String(month);
  localStorage.setItem('sensus_month', AppState.selectedMonth);

  // Invalidate all report caches
  AppState.tcrData = null;
  AppState.bilanData = null;
  AppState.tftData = null;
  AppState.allInvoices = [];
  AppState.stocksData = null;
  AppState.consommationData = null;
  AppState.fiscaliteData = null;
  AppState.doc9Data = null;

  populateMonthSelects();

  // Reload current active page to apply the month filter
  const currentRoute = window.location.hash || window.location.pathname;
  const activeSection = document.querySelector('.page-section.active');
  const pageId = activeSection?.id || getPageIdFromRoute(currentRoute);

  if (pageId === 'page-achats') {
    loadAchatsPage();
  } else if (pageId === 'page-consommation') {
    loadConsommationPage();
  } else if (pageId === 'page-stocks') {
    loadStocksPage();
  } else if (pageId === 'page-fiscalite') {
    loadFiscalitePage();
  } else if (pageId === 'page-bilan') {
    loadBilanPage(true);
  } else if (pageId === 'page-tcr') {
    loadTCRPage(true);
  } else if (pageId === 'page-tft') {
    loadTFTPage(true);
  } else if (pageId === 'page-fbl3n') {
    AppState.fbl3nFilters.month = AppState.selectedMonth === 'ALL' ? '' : AppState.selectedMonth;
    AppState.fbl3nFilters.page = 1;
    fetchFBL3NData();
  } else if (pageId === 'page-doc9') {
    loadDocument9Report();
  }
}

function initYearSystem() {
  YEAR_SELECT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', (e) => {
      setSelectedYear(e.target.value);
    });
  });

  MONTH_SELECT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', (e) => {
      setSelectedMonth(e.target.value);
    });
  });

  loadAvailableYears();
}

// ==========================================================================
// 2. MULTI-PAGE NAVIGATION & URL ROUTING ENGINE
// ==========================================================================
function getPageIdFromRoute(route) {
  const clean = (route || '').replace(/^#\/?/, '').replace(/^\//, '').toLowerCase().trim();
  const map = {
    'doc9': 'page-doc9',
    'page-doc9': 'page-doc9',
    'achats': 'page-achats',
    'page-achats': 'page-achats',
    'consommation': 'page-consommation',
    'page-consommation': 'page-consommation',
    'stocks': 'page-stocks',
    'page-stocks': 'page-stocks',
    'fiscalite': 'page-fiscalite',
    'page-fiscalite': 'page-fiscalite',
    'bilan': 'page-bilan',
    'page-bilan': 'page-bilan',
    'etats-financiers': 'page-bilan',
    'tcr': 'page-tcr',
    'page-tcr': 'page-tcr',
    'balance': 'page-balance',
    'page-balance': 'page-balance',
    'tft': 'page-tft',
    'page-tft': 'page-tft',
    'flux': 'page-tft',
    'fbl3n': 'page-fbl3n',
    'page-fbl3n': 'page-fbl3n',
    'fournisseurs': 'page-fournisseurs',
    'page-fournisseurs': 'page-fournisseurs',
    'suppliers': 'page-fournisseurs',
    'parametres': 'page-parametres',
    'page-parametres': 'page-parametres',
    'settings': 'page-parametres',
    'import': 'page-parametres',
    'page-import': 'page-parametres',
    'rapprochement': 'page-parametres'
  };
  return map[clean] || 'page-doc9';
}

function getRouteFromPageId(pageId) {
  const map = {
    'page-doc9': 'doc9',
    'page-achats': 'achats',
    'page-consommation': 'consommation',
    'page-stocks': 'stocks',
    'page-fiscalite': 'fiscalite',
    'page-bilan': 'bilan',
    'page-tcr': 'tcr',
    'page-balance': 'balance',
    'page-tft': 'tft',
    'page-fbl3n': 'fbl3n',
    'page-fournisseurs': 'fournisseurs',
    'page-parametres': 'parametres',
    'page-import': 'import'
  };
  return map[pageId] || 'doc9';
}

const PAGE_HEADERS = {
  'page-import': {
    title: "Chargement des Données & Rapprochement Comptable",
    sub: "Contrôle d'intégrité et de concordance entre le Grand Livre (FBL3N) et la Balance Générale",
    showPeriod: false
  },
  'page-doc9': {
    title: "Note de Synthèse Approvisionnements (Document 9)",
    sub: "Dossier exécutif prêt pour présentation et impression physique A4",
    showPeriod: true
  },
  'page-achats': {
    title: "Dépenses Fournisseurs & Portefeuille d'Achats",
    sub: "Analyse des flux facturés SAP F.41, ventilation Local/Import et Pareto",
    showPeriod: false
  },
  'page-consommation': {
    title: "Achats Consommés Industriels (SCF Classe 60)",
    sub: "Grand Livre SAP : Soldes et mouvements des comptes de charges",
    showPeriod: false
  },
  'page-stocks': {
    title: "Situation & Inventaire des Stocks (SCF Classe 3)",
    sub: "Valorisation comptable et évolution des stocks (Modèle Réalisation SEP-26)",
    showPeriod: true
  },
  'page-fiscalite': {
    title: "Débours Transit, Douane & Fiscalité Rapprochée",
    sub: "Apurement des comptes transitoires 17300015, TVA 1787 et Retenue 1971",
    showPeriod: false
  },
  'page-bilan': {
    title: "Bilan Comptable (Actif & Passif — SCF Algérie)",
    sub: "Situation patrimoniale de SENSUS SPA : Emplois, Ressources, Capitaux Propres et Dettes (2026 vs 2025)",
    showPeriod: false
  },
  'page-tcr': {
    title: "Tableau des Comptes de Résultats (TCR — SCF Algérie)",
    sub: "Soldes Intermédiaires de Gestion (SIG) de SENSUS SPA : Production, Consommation, VA, EBE, Résultat Opérationnel et Résultat Net (2026 vs 2025)",
    showPeriod: false
  },
  'page-balance': {
    title: "Balance Générale des Comptes (SAP RFSSLD00)",
    sub: "Grand Livre général, contrôle d'équilibre débit/crédit et importations multi-exercices",
    showPeriod: false
  },
  'page-tft': {
    title: "Tableau des Flux de Trésorerie (TFT — SCF Algérie)",
    sub: "Méthode Directe SCF : Flux opérationnels (A), d'investissement (B), de financement (C) et variation nette de trésorerie",
    showPeriod: false
  },
  'page-fbl3n': {
    title: "Grand Livre Général SAP (FBL3N)",
    sub: "Journal des écritures comptables, filtres par année/mois et import Excel",
    showPeriod: false
  },
  'page-fournisseurs': {
    title: "Référentiel Fournisseurs & Règles de Fixation",
    sub: "Contrôlez les catégories des tiers : verrouillez les exclusifs (🔒 Fixe) ou activez le mode dynamique (🔀 Multi-catégories)",
    showPeriod: false
  },
  'page-parametres': {
    title: "Importation des Données",
    sub: "Grand Livre (FBL3N) & Balance Générale",
    showPeriod: false
  }
};

function navigateToPage(targetPageId, updateHash = true) {
  if (!currentUser) {
    applyUserRole(null);
    return;
  }

  // Enforce role permissions
  if (!isPageAllowed(targetPageId, currentUser)) {
    targetPageId = 'page-bilan';
  }

  const navLinks = document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-nav .nav-subitem');
  const pages = document.querySelectorAll('.app-page');
  const topbarTitle = document.getElementById('topbarTitle');
  const topbarSubtitle = document.getElementById('topbarSubtitle');
  const topbarPeriodBox = document.getElementById('topbarPeriodBox');

  const routeName = getRouteFromPageId(targetPageId);
  if (updateHash && window.location.hash !== `#${routeName}`) {
    window.location.hash = routeName;
  }

  // Update sidebar active link
  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-page') === targetPageId);
  });

  // Handle dropdown parent state
  const isFinancier = targetPageId === 'page-bilan' || targetPageId === 'page-tcr' || targetPageId === 'page-balance' || targetPageId === 'page-tft' || targetPageId === 'page-fbl3n';
  const dropdownFin = document.getElementById('dropdownFinanciers');
  if (dropdownFin) {
    if (isFinancier) {
      dropdownFin.classList.add('open');
      dropdownFin.classList.add('active-parent');
    } else {
      dropdownFin.classList.remove('active-parent');
    }
  }

  // Update active page section
  pages.forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById(targetPageId);
  if (targetPage) targetPage.classList.add('active');

  // Update topbar texts
  if (PAGE_HEADERS[targetPageId]) {
    if (topbarTitle) topbarTitle.textContent = PAGE_HEADERS[targetPageId].title;
    if (topbarSubtitle) topbarSubtitle.textContent = PAGE_HEADERS[targetPageId].sub;
    if (topbarPeriodBox) {
      topbarPeriodBox.style.display = PAGE_HEADERS[targetPageId].showPeriod ? 'block' : 'none';
    }
  }

  // Hide global filters on Import/Parametres page
  const isImportPage = targetPageId === 'page-parametres';
  const topbarYearBox = document.getElementById('topbarYearBox');
  const topbarMonthBox = document.getElementById('topbarMonthBox');
  const unitPillBox = document.querySelector('.unit-pill-box') as HTMLElement | null;
  if (topbarYearBox) topbarYearBox.style.display = isImportPage ? 'none' : 'inline-flex';
  if (topbarMonthBox) topbarMonthBox.style.display = isImportPage ? 'none' : 'inline-flex';
  if (unitPillBox) unitPillBox.style.display = isImportPage ? 'none' : 'inline-flex';

  // Show print/word export buttons only on relevant report pages
  const btnPrint = document.getElementById('btnPrintReport');
  const btnWord = document.getElementById('btnDownloadWord');
  const printablePages = ['page-doc9', 'page-bilan', 'page-tcr', 'page-tft'];
  if (btnPrint) btnPrint.style.display = printablePages.includes(targetPageId) ? 'inline-flex' : 'none';
  if (btnWord) btnWord.style.display = targetPageId === 'page-doc9' ? 'inline-flex' : 'none';

  // Load data for the active page
  if (targetPageId === 'page-doc9') {
    if (!AppState.doc9Data) loadDocument9Report();
  } else if (targetPageId === 'page-achats') {
    loadAchatsPage();
  } else if (targetPageId === 'page-consommation') {
    loadConsommationPage();
  } else if (targetPageId === 'page-stocks') {
    loadStocksPage();
  } else if (targetPageId === 'page-fiscalite') {
    loadFiscalitePage();
  } else if (targetPageId === 'page-bilan') {
    loadBilanPage();
  } else if (targetPageId === 'page-tcr') {
    loadTCRPage();
  } else if (targetPageId === 'page-balance') {
    loadBalancePage();
  } else if (targetPageId === 'page-tft') {
    loadTFTPage();
  } else if (targetPageId === 'page-fbl3n') {
    loadFBL3NPage();
  } else if (targetPageId === 'page-fournisseurs') {
    loadSuppliersPage();
  } else if (targetPageId === 'page-parametres') {
    loadSettingsPage();
  } else if (targetPageId === 'page-import') {
    loadImportPage();
  }
}

function initNavigation() {
  const navLinks = document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-nav .nav-subitem');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPageId = link.getAttribute('data-page');
      navigateToPage(targetPageId, true);
    });
  });

  // Dropdown toggle button for États Financiers
  const btnDropdown = document.getElementById('btnDropdownFinanciers');
  if (btnDropdown) {
    btnDropdown.addEventListener('click', (e) => {
      e.preventDefault();
      const dropdown = document.getElementById('dropdownFinanciers');
      if (dropdown) dropdown.classList.toggle('open');
    });
  }

  // Listen to browser hash changes (Back/Forward buttons, direct bookmark navigation)
  window.addEventListener('hashchange', () => {
    let pageId = getPageIdFromRoute(window.location.hash);
    if (currentUser && !isPageAllowed(pageId, currentUser)) {
      pageId = 'page-bilan';
    }
    navigateToPage(pageId, false);
  });
}

function initPeriodSelector() {
  const select = document.getElementById('selectPeriod');
  if (select) {
    select.addEventListener('change', (e) => {
      AppState.period = e.target.value;
      loadDocument9Report();
      loadStocksPage();
      loadConsommationPage();
    });
  }
}

// Re-renders all open views when unit changes
function reRenderAllPages() {
  if (AppState.doc9Data) {
    renderDocument9Views(AppState.doc9Data);
  }
  if (AppState.allInvoices.length > 0) {
    applyAchatsFilters();
  }
  if (AppState.stocksData) {
    renderExecutiveStocksTable(AppState.stocksData);
    renderStocksGLTable(AppState.stocksData);
  }
  if (AppState.consommationData) {
    renderConsommationGLTable(AppState.consommationData);
  }
  if (AppState.fiscaliteData) {
    renderFiscaliteViews(AppState.fiscaliteData);
  }
  if (AppState.bilanData) {
    renderBilanTables(AppState.bilanData);
  }
  if (AppState.tcrData) {
    renderTCRTable(AppState.tcrData);
  }
  if (AppState.tftData) {
    if (currentTFTMode === 'charts') {
      renderTFTCharts(AppState.tftData);
    } else {
      renderTFTTable(AppState.tftData);
    }
  }
  if (AppState.fbl3nData) {
    renderFBL3NTable(AppState.fbl3nData);
    updateFBL3NKPIs(AppState.fbl3nData.stats);
  }
}

// ==========================================================================
// 3. ACTION BUTTONS (PRINT & DOCX EXPORT)
// ==========================================================================
function initActionButtons() {
  // Official physical print action
  const btnPrint = document.getElementById('btnPrintReport');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      // Ensure we switch to Doc 9 page first
      const doc9Link = document.querySelector('.sidebar-nav [data-page="page-doc9"]');
      if (doc9Link && !doc9Link.classList.contains('active')) {
        doc9Link.click();
      }
      setTimeout(() => {
        window.print();
      }, 150);
    });
  }

  // Word (.docx) export action
  const btnWord = document.getElementById('btnDownloadWord');
  if (btnWord) {
    btnWord.addEventListener('click', downloadWordDossier);
  }

}

async function downloadWordDossier() {
  const btnWord = document.getElementById('btnDownloadWord');
  const originalHtml = btnWord ? btnWord.innerHTML : '';
  if (btnWord) {
    btnWord.disabled = true;
    btnWord.textContent = '⏳ Génération Word...';
  }

  try {
    const observations = getActiveObservationsList();
    const res = await fetch('/api/reports/document9/export-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period: AppState.period,
        observations: observations,
        unit: AppState.unit
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SENSUS_Rapport_Appro_${AppState.period}_${AppState.unit}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Word export error:', err);
    alert('Erreur lors de la génération du document Word : ' + err.message);
  } finally {
    if (btnWord) {
      btnWord.disabled = false;
      btnWord.innerHTML = originalHtml;
    }
  }
}

// ==========================================================================
// 4. PAGE 1: DOCUMENT 9 SYNTHESIS (PRINTABLE DOSSIER)
// ==========================================================================
async function loadDocument9Report() {
  try {
    const yearParam = AppState.selectedYear ? `&year=${AppState.selectedYear}` : '';
    const monthParam = (AppState.selectedMonth && AppState.selectedMonth !== 'ALL') ? `&month=${AppState.selectedMonth}` : '';
    const res = await fetch(`/api/reports/document9?period=${AppState.period}${yearParam}${monthParam}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    AppState.doc9Data = data;

    // Initialize observations from predefined if first time or period switched
    AppState.observations = (data.predefinedObservations || []).map(o => ({
      id: o.id || 'obs_' + Math.random().toString(36).substr(2, 9),
      category: o.category || 'Gestion',
      text: o.text || '',
      isCustom: false
    }));

    renderDocument9Views(data);
  } catch (err) {
    console.error('Failed to load Document 9 report:', err);
  }
}

function renderDocument9Views(data) {
  // Main title
  const titleEl = document.getElementById('docReportTitle');
  if (titleEl) {
    titleEl.textContent = `IX. APPROVISIONNEMENTS — ${data.periodLabel.toUpperCase()}`;
  }

  // Render observations manager (Predefined + Custom + Deletable)
  renderObservationsList();

  // Table 1: Achats Consommés (Classe 60)
  renderDoc9ConsommationTable(data.consommation);

  // Table 2: Achats Facturés (Fournisseurs)
  renderDoc9AchatsTable(data.achats);

  // Table 3: Stocks
  renderDoc9StocksTable(data.stocks, data.priorPeriodLabel, data.periodLabel);
}

// OBSERVATIONS MANAGEMENT SYSTEM
function initObservationsControls() {
  const btnAdd = document.getElementById('btnAddObservation');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      addCustomObservation();
    });
  }

  const btnReset = document.getElementById('btnResetObservations');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (AppState.doc9Data && Array.isArray(AppState.doc9Data.predefinedObservations)) {
        AppState.observations = AppState.doc9Data.predefinedObservations.map(o => ({
          id: o.id || 'obs_' + Math.random().toString(36).substr(2, 9),
          category: o.category || 'Gestion',
          text: o.text || '',
          isCustom: false
        }));
        renderObservationsList();
      }
    });
  }
}

function renderObservationsList() {
  const container = document.getElementById('doc9ObservationsList');
  if (!container) return;

  if (AppState.observations.length === 0) {
    container.innerHTML = `
      <div style="padding:14px; text-align:center; color:#64748b; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:6px; font-size:12px;">
        Aucune observation active pour ce rapport. Cliquez sur <strong>« Ajouter une observation »</strong> ou <strong>« Rétablir prédéfinis »</strong> ci-dessus.
      </div>
    `;
    return;
  }

  let html = '';
  AppState.observations.forEach((obs, idx) => {
    html += `
      <div class="obs-card" data-id="${obs.id}">
        <span class="obs-bullet">•</span>
        <div class="obs-body">
          <div class="obs-meta no-print">
            <span class="obs-cat-tag">${obs.category}</span>
          </div>
          <textarea class="obs-textarea" rows="2" placeholder="Saisir une observation...">${escapeHtml(obs.text)}</textarea>
        </div>
        <div class="obs-actions no-print">
          <button type="button" class="btn-obs-del" title="Supprimer cette observation" data-del-id="${obs.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Bind input listeners on textareas to auto-expand & save
  container.querySelectorAll('.obs-card').forEach(card => {
    const id = card.getAttribute('data-id');
    const textarea = card.querySelector('.obs-textarea');
    if (textarea) {
      autoResizeTextarea(textarea);
      textarea.addEventListener('input', () => {
        autoResizeTextarea(textarea);
        const item = AppState.observations.find(o => o.id === id);
        if (item) item.text = textarea.value;
      });
    }
  });

  // Bind delete buttons
  container.querySelectorAll('.btn-obs-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const delId = btn.getAttribute('data-del-id');
      deleteObservation(delId);
    });
  });
}

function addCustomObservation() {
  const newObs = {
    id: 'custom_' + Date.now(),
    category: 'Observation Libre',
    text: '',
    isCustom: true
  };
  AppState.observations.push(newObs);
  renderObservationsList();

  // Focus the newly created textarea
  setTimeout(() => {
    const lastCard = document.querySelector(`.obs-card[data-id="${newObs.id}"] textarea`);
    if (lastCard) {
      lastCard.focus();
    }
  }, 50);
}

function deleteObservation(id) {
  AppState.observations = AppState.observations.filter(o => o.id !== id);
  renderObservationsList();
}

function getActiveObservationsList() {
  return AppState.observations
    .map(o => o.text.trim())
    .filter(t => t.length > 0);
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight) + 'px';
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}



function renderDoc9ConsommationTable(c) {
  const tbody = document.querySelector('#tableDoc9Consommation tbody');
  if (!tbody) return;

  if (!c || !c.total2026) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center; padding:28px 16px; color:#64748b; font-style:italic;">
          Aucune donnée de consommation enregistrée — En attente d'importation dans la base de données.
        </td>
      </tr>
    `;
    return;
  }

  const total = c.total2026 || 1;
  tbody.innerHTML = `
    <tr>
      <td><strong>Marchandises consommées (Revente Gros Débit)</strong></td>
      <td class="text-right font-mono font-bold">${formatFromKDA(c.reventeGD)}</td>
      <td class="text-right"><span class="badge badge-sky">${(c.reventeGD / total * 100).toFixed(2)} %</span></td>
    </tr>
    <tr>
      <td><strong>Matières et fournitures consommées</strong></td>
      <td class="text-right font-mono font-bold">${formatFromKDA(c.matieres)}</td>
      <td class="text-right"><span class="badge badge-purple">${(c.matieres / total * 100).toFixed(2)} %</span></td>
    </tr>
    <tr>
      <td>
        <strong>Achats consommés des pièces de rechange maintenance</strong>
        <div style="font-size:10.5px; color:#64748b; margin-top:2px;">
          • Magasin PR : ${formatFromKDA(c.maintenanceDetails.magasin, true)} &nbsp;|&nbsp; • Véhicules : ${formatFromKDA(c.maintenanceDetails.vehicules, true)}
        </div>
      </td>
      <td class="text-right font-mono font-bold">${formatFromKDA(c.maintenance)}</td>
      <td class="text-right">${(c.maintenance / total * 100).toFixed(2)} %</td>
    </tr>
    <tr>
      <td>
        <strong>Autres achats consommés</strong>
        <div style="font-size:10.5px; color:#64748b; margin-top:2px;">
          • Bureau : ${formatFromKDA(c.autresDetails.bureau, true)} &nbsp;|&nbsp; • Énergie : ${formatFromKDA(c.autresDetails.energie, true)} &nbsp;|&nbsp; • Eau : ${formatFromKDA(c.autresDetails.eau, true)}
        </div>
      </td>
      <td class="text-right font-mono font-bold">${formatFromKDA(c.autres)}</td>
      <td class="text-right">${(c.autres / total * 100).toFixed(2)} %</td>
    </tr>
    <tr class="total-row">
      <td>TOTAL DES ACHATS CONSOMMÉS</td>
      <td class="text-right font-mono font-bold">${formatFromKDA(c.total2026)}</td>
      <td class="text-right">100,00 %</td>
    </tr>
  `;
}

function renderDoc9AchatsTable(a) {
  const tbody = document.querySelector('#tableDoc9Achats tbody');
  if (!tbody) return;

  if (!a || !a.total) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center; padding:28px 16px; color:#64748b; font-style:italic;">
          Aucune donnée d'achats enregistrée — En attente d'importation dans la base de données.
        </td>
      </tr>
    `;
    return;
  }

  let html = `
    <tr class="highlight-row">
      <td><span class="badge badge-emerald">FLUX LOCAL</span> <strong>Achats Locaux (DZD)</strong></td>
      <td class="text-right font-mono font-bold">${formatFromKDA(a.local)}</td>
      <td class="text-right font-bold">${a.localPct} %</td>
    </tr>
    <tr class="highlight-row">
      <td><span class="badge badge-sky">IMPORTATION</span> <strong>Achats Étrangers (Devises Converties)</strong></td>
      <td class="text-right font-mono font-bold">${formatFromKDA(a.etranger)}</td>
      <td class="text-right font-bold">${a.etrangerPct} %</td>
    </tr>
  `;

  // Top 5 Suppliers
  if (Array.isArray(a.topFournisseurs)) {
    a.topFournisseurs.slice(0, 5).forEach(f => {
      html += `
        <tr>
          <td style="padding-left:22px;">• <strong>${f.name}</strong></td>
          <td class="text-right font-mono">${formatFromKDA(f.val)}</td>
          <td class="text-right">${f.pct} %</td>
        </tr>
      `;
    });
  }

  html += `
    <tr class="total-row">
      <td>TOTAL DES FLUX D'ACHATS FACTURÉS</td>
      <td class="text-right font-mono font-bold">${formatFromKDA(a.total)}</td>
      <td class="text-right font-bold">100,00 %</td>
    </tr>
  `;
  tbody.innerHTML = html;
}

function renderDoc9StocksTable(s, n1Label, nLabel) {
  const thN1 = document.getElementById('thDoc9StockN1');
  const thN = document.getElementById('thDoc9StockN');
  const titleStocks = document.getElementById('titleDoc9Stocks');

  if (thN1) thN1.innerHTML = `${n1Label} (<span class="col-unit">${AppState.unit}</span>)`;
  if (thN) thN.innerHTML = `${nLabel} (<span class="col-unit">${AppState.unit}</span>)`;
  if (titleStocks) titleStocks.textContent = `TABLEAU DE VENTILATION ET ÉVOLUTION DES STOCKS (${n1Label.toUpperCase()} vs ${nLabel.toUpperCase()})`;

  const tbody = document.querySelector('#tableDoc9Stocks tbody');
  if (!tbody) return;

  if (!s || !s.items || s.items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:28px 16px; color:#64748b; font-style:italic;">
          Aucun stock enregistré — En attente d'importation dans la base de données.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  s.items.forEach(item => {
    const isDown = item.diff < 0;
    const badgeClass = isDown ? 'badge-emerald' : 'badge-rose';
    html += `
      <tr>
        <td><strong>${item.rubrique}</strong></td>
        <td class="text-right font-mono">${formatFromKDA(item.n1)}</td>
        <td class="text-right font-mono font-bold">${formatFromKDA(item.n)}</td>
        <td class="text-right font-mono font-bold" style="color:${isDown ? '#059669' : '#dc2626'}">
          ${item.diff > 0 ? '+' : ''}${formatFromKDA(item.diff)}
        </td>
        <td class="text-right font-mono">
          <span class="badge ${badgeClass}">${item.pct > 0 ? '+' : ''}${item.pct} %</span>
        </td>
      </tr>
    `;
  });

  html += `
    <tr class="total-row">
      <td>TOTAL DES STOCKS NETS</td>
      <td class="text-right font-mono font-bold">${formatFromKDA(s.totalN1)}</td>
      <td class="text-right font-mono font-bold">${formatFromKDA(s.totalN)}</td>
      <td class="text-right font-mono font-bold" style="color:${s.diff < 0 ? '#059669' : '#dc2626'}">
        ${s.diff > 0 ? '+' : ''}${formatFromKDA(s.diff)}
      </td>
      <td class="text-right font-mono font-bold">
        <span class="badge ${s.pct < 0 ? 'badge-emerald' : 'badge-rose'}">${s.pct > 0 ? '+' : ''}${s.pct} %</span>
      </td>
    </tr>
  `;
  tbody.innerHTML = html;
}

// ==========================================================================
// 5. PAGE 2: ACHATS RÉALISÉS & LIVE FILTERING ENGINE
// ==========================================================================
function initAchatsFilters() {
  const searchInput = document.getElementById('inputSearchInvoices');
  const marketFilter = document.getElementById('filterMarket');
  const categoryFilter = document.getElementById('filterCategory');

  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      applyAchatsFilters();
    }, 200));
  }

  if (marketFilter) {
    marketFilter.addEventListener('change', () => applyAchatsFilters());
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => applyAchatsFilters());
  }
}

async function loadAchatsPage() {
  try {
    const yearParam = AppState.selectedYear ? `?year=${AppState.selectedYear}` : '';
    const monthParam = (AppState.selectedMonth && AppState.selectedMonth !== 'ALL') ? `&month=${AppState.selectedMonth}` : '';
    const url = `/api/invoices${yearParam ? yearParam + monthParam : (monthParam ? '?' + monthParam.slice(1) : '')}`;
    const res = await fetch(url);
    const data = await res.json();
    AppState.allInvoices = data.invoices || [];
  } catch (err) {
    console.error('Failed to load invoices:', err);
  }
  applyAchatsFilters();
}

function applyAchatsFilters() {
  const searchTerm = (document.getElementById('inputSearchInvoices')?.value || '').trim().toLowerCase();
  const marketVal = document.getElementById('filterMarket')?.value || 'ALL';
  const categoryVal = document.getElementById('filterCategory')?.value || 'ALL';

  let filtered = AppState.allInvoices.filter(inv => {
    // Search filter
    if (searchTerm) {
      const pMatch = (inv.piece || '').toLowerCase().includes(searchTerm);
      const sMatch = (inv.supplierName || '').toLowerCase().includes(searchTerm);
      const affMatch = (inv.affectation || '').toLowerCase().includes(searchTerm);
      if (!pMatch && !sMatch && !affMatch) return false;
    }

    // Market filter
    if (marketVal === 'LOCAL' && !inv.isLocal) return false;
    if (marketVal === 'ETRANGER' && inv.isLocal) return false;

    // Category filter
    if (categoryVal !== 'ALL' && inv.category !== categoryVal) return false;

    return true;
  });

  AppState.filteredInvoices = filtered;

  // 1. Calculate stats
  let totalNetHT = 0;
  let totalLocal = 0;
  let totalEtranger = 0;
  const suppliersMap = new Map();

  filtered.forEach(inv => {
    const net = inv.netHT || inv.f41Amount || 0;
    totalNetHT += net;
    if (inv.isLocal) totalLocal += net;
    else totalEtranger += net;

    const sName = inv.supplierName || 'Fournisseur Inconnu';
    const sMarket = inv.isLocal ? 'Local' : 'Étranger';
    if (!suppliersMap.has(sName)) {
      suppliersMap.set(sName, { name: sName, market: sMarket, total: 0 });
    }
    suppliersMap.get(sName).total += net;
  });

  // 2. Update KPI Stat Cards
  const elTotal = document.getElementById('statAchatsTotal');
  const elLocal = document.getElementById('statAchatsLocal');
  const elEtranger = document.getElementById('statAchatsEtranger');
  const elCount = document.getElementById('statAchatsCount');

  if (elTotal) elTotal.textContent = formatFromDA(totalNetHT, true);
  if (elLocal) elLocal.textContent = formatFromDA(totalLocal, true);
  if (elEtranger) elEtranger.textContent = formatFromDA(totalEtranger, true);
  if (elCount) elCount.textContent = filtered.length.toLocaleString('fr-FR');

  // 3. Render Top Suppliers Pareto
  const sortedSuppliers = Array.from(suppliersMap.values()).sort((a, b) => b.total - a.total);
  renderAchatsSuppliersTable(sortedSuppliers, totalNetHT);

  // 4. Render Invoices Table
  renderAchatsInvoicesTable(filtered);
}

function renderAchatsSuppliersTable(suppliers, totalNetHT) {
  const tbody = document.querySelector('#tableSuppliersPage tbody');
  const badgeCount = document.getElementById('badgeSuppliersCount');
  if (badgeCount) badgeCount.textContent = `${suppliers.length} Fournisseurs`;
  if (!tbody) return;

  if (suppliers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#64748b;">Aucun fournisseur correspondant aux critères de recherche.</td></tr>`;
    return;
  }

  const top15 = suppliers.slice(0, 15);
  let html = '';
  top15.forEach((s, idx) => {
    const pct = totalNetHT > 0 ? (s.total / totalNetHT * 100).toFixed(2) : '0.00';
    const isLocal = s.market === 'Local';
    html += `
      <tr>
        <td class="font-mono text-center font-bold">${idx + 1}</td>
        <td><strong>${s.name}</strong></td>
        <td><span class="badge ${isLocal ? 'badge-emerald' : 'badge-sky'}">${s.market}</span></td>
        <td class="text-right font-mono font-bold">${formatFromDA(s.total)}</td>
        <td class="text-right font-mono">${pct} %</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function renderAchatsInvoicesTable(invoices) {
  const tbody = document.querySelector('#tableInvoicesPage tbody');
  const badgeCount = document.getElementById('badgeInvoicesFilterCount');
  if (badgeCount) badgeCount.textContent = `${invoices.length} factures trouvées`;
  if (!tbody) return;

  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Aucune facture trouvée pour ces filtres.</td></tr>`;
    return;
  }

  // Display first 100 matching invoices for high performance
  const displayRows = invoices.slice(0, 100);
  let html = '';
  displayRows.forEach(inv => {
    const isLocal = inv.isLocal;
    html += `
      <tr>
        <td class="font-mono"><strong>${inv.piece}</strong></td>
        <td class="font-mono text-slate">${inv.affectation || '—'}</td>
        <td>${inv.supplierName}</td>
        <td><span class="badge ${isLocal ? 'badge-emerald' : 'badge-sky'}">${isLocal ? 'Local' : 'Import'}</span></td>
        <td><span class="badge badge-purple">${inv.category || 'Non classé'}</span></td>
        <td class="text-right font-mono">${formatFromDA(inv.f41Amount)}</td>
        <td class="text-right font-mono font-bold">${formatFromDA(inv.netHT || inv.f41Amount)}</td>
      </tr>
    `;
  });

  if (invoices.length > 100) {
    html += `
      <tr style="background:#f8fafc; font-style:italic;">
        <td colspan="7" class="text-center" style="padding:10px; color:#64748b;">
          Affichage limité aux 100 premières factures sur ${invoices.length.toLocaleString('fr-FR')}. Utilisez la recherche ci-dessus pour affiner.
        </td>
      </tr>
    `;
  }

  tbody.innerHTML = html;
}

// ==========================================================================
// 6. PAGE 3: ACHATS CONSOMMÉS (SCF CLASSE 60 / BOAL 4000)
// ==========================================================================
async function loadConsommationPage() {
  try {
    const yearParam = AppState.selectedYear ? `&year=${AppState.selectedYear}` : '';
    const monthParam = (AppState.selectedMonth && AppState.selectedMonth !== 'ALL') ? `&month=${AppState.selectedMonth}` : '';
    const res = await fetch(`/api/reports/consommation?period=${AppState.period}${yearParam}${monthParam}`);
    const data = await res.json();
    AppState.consommationData = data;
    renderConsommationGLTable(data);
  } catch (err) {
    console.error('Failed to load consommation page data:', err);
  }
}

function renderConsommationGLTable(data) {
  const tbody = document.querySelector('#tableChargesGLPage tbody');
  if (!tbody) return;

  if (!data || !Array.isArray(data.charges) || data.charges.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:28px 16px; color:#64748b; font-style:italic;">
          Aucune charge enregistrée — En attente d'importation dans la base de données.
        </td>
      </tr>
    `;
    return;
  }

  const charges = data.charges;
  let totalSolde = 0;
  let totalMouvements = 0;
  let html = '';

  charges.forEach(c => {
    const solde = c.solde || 0;
    const mvt = (c.debit || 0) - (c.credit || 0);
    totalSolde += solde;
    totalMouvements += mvt;

    html += `
      <tr>
        <td class="font-mono font-bold">${c.boal}</td>
        <td class="font-mono text-sky font-bold">${c.dz || '—'}</td>
        <td>${c.desc || c.chartDesc || 'Compte de charge'}</td>
        <td class="text-right font-mono">${formatFromDA(mvt)}</td>
        <td class="text-right font-mono font-bold">${formatFromDA(solde)}</td>
      </tr>
    `;
  });

  html += `
    <tr class="total-row">
      <td colspan="3">TOTAL CHARGES D'EXPLOITATION (SCF 60)</td>
      <td class="text-right font-mono font-bold">${formatFromDA(totalMouvements)}</td>
      <td class="text-right font-mono font-bold">${formatFromDA(totalSolde)}</td>
    </tr>
  `;

  tbody.innerHTML = html;
}

// ==========================================================================
// 7. PAGE 4: SITUATION DES STOCKS (SCF CLASSE 3)
// ==========================================================================
async function loadStocksPage() {
  try {
    const yearParam = AppState.selectedYear ? `&year=${AppState.selectedYear}` : '';
    const monthParam = (AppState.selectedMonth && AppState.selectedMonth !== 'ALL') ? `&month=${AppState.selectedMonth}` : '';
    const res = await fetch(`/api/reports/stocks?period=${AppState.period}${yearParam}${monthParam}`);
    const data = await res.json();
    AppState.stocksData = data;
    renderExecutiveStocksTable(data);
    renderStocksGLTable(data);
  } catch (err) {
    console.error('Failed to load stocks page data:', err);
  }
}

function renderExecutiveStocksTable(data) {
  if (!data) return;
  const s = data.summaryTable || data;
  if (!s) return;

  const n1Label = s.n1Label || (AppState.period === 'SEPTEMBRE_2026' ? 'Sept- 2025' : 'Période N-1');
  const nLabel = s.nLabel || (AppState.period === 'SEPTEMBRE_2026' ? 'Sept-- 2026' : 'Période N');

  // 1. KPI Stats Banner
  const lblN1 = document.getElementById('lblStockKpiN1');
  const lblN = document.getElementById('lblStockKpiN');
  const statN1 = document.getElementById('statStockValN1');
  const statN = document.getElementById('statStockValN');
  const statDiff = document.getElementById('statStockValDiff');
  const statPct = document.getElementById('statStockValPct');
  const subN1 = document.getElementById('subStockKpiN1');
  const subN = document.getElementById('subStockKpiN');
  const badgePeriod = document.getElementById('badgeStocksPeriodLabel');
  const titleExec = document.getElementById('titleExecutiveStocksTable');

  if (lblN1) lblN1.textContent = `Stock (${n1Label})`;
  if (lblN) lblN.textContent = `Stock (${nLabel})`;
  if (subN1) subN1.textContent = `Clôture ${n1Label}`;
  if (subN) subN.textContent = `Inventaire net clôturé ${nLabel}`;
  if (badgePeriod) badgePeriod.textContent = nLabel;
  if (titleExec) titleExec.textContent = `Situation & Ventilation des Stocks (${n1Label} vs ${nLabel})`;

  if (statN1) statN1.textContent = formatFromKDA(s.totalN1 || 0, true);
  if (statN) statN.textContent = formatFromKDA(s.totalN || 0, true);
  if (statDiff) {
    const isDown = (s.diff || 0) < 0;
    statDiff.textContent = `${(s.diff || 0) > 0 ? '+' : ''}${formatFromKDA(s.diff || 0, true)}`;
    statDiff.style.color = isDown ? '#059669' : '#dc2626';
  }
  if (statPct) {
    const isDown = (s.pct || 0) < 0;
    statPct.innerHTML = `<span class="badge ${isDown ? 'badge-emerald' : 'badge-rose'}">${(s.pct || 0) > 0 ? '+' : ''}${s.pct || 0} %</span>`;
  }

  // 2. Table Column Headers
  const thN1 = document.getElementById('thExecStockN1');
  const thN = document.getElementById('thExecStockN');
  if (thN1) thN1.innerHTML = `${n1Label} (<span class="col-unit">${AppState.unit}</span>)`;
  if (thN) thN.innerHTML = `${nLabel} (<span class="col-unit">${AppState.unit}</span>)`;

  // 3. Table Rows
  const tbody = document.querySelector('#tableExecutiveStocks tbody');
  if (!tbody) return;

  if (!Array.isArray(s.items) || s.items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:28px 16px; color:#64748b; font-style:italic;">
          Aucun stock enregistré — En attente d'importation dans la base de données.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  s.items.forEach(item => {
    const isDown = item.diff < 0;
    const badgeClass = isDown ? 'badge-emerald' : 'badge-rose';
    html += `
      <tr>
        <td><strong>${escapeHtml(item.rubrique)}</strong></td>
        <td class="text-right font-mono">${formatFromKDA(item.n1)}</td>
        <td class="text-right font-mono font-bold">${formatFromKDA(item.n)}</td>
        <td class="text-right font-mono font-bold" style="color:${isDown ? '#059669' : '#dc2626'}">
          ${item.diff > 0 ? '+' : ''}${formatFromKDA(item.diff)}
        </td>
        <td class="text-right font-mono font-bold">
          <span class="badge ${badgeClass}">${item.pct > 0 ? '+' : ''}${item.pct} %</span>
        </td>
      </tr>
    `;
  });

  html += `
    <tr class="total-row">
      <td>TOTAL DES STOCKS NETS</td>
      <td class="text-right font-mono font-bold">${formatFromKDA(s.totalN1)}</td>
      <td class="text-right font-mono font-bold">${formatFromKDA(s.totalN)}</td>
      <td class="text-right font-mono font-bold" style="color:${s.diff < 0 ? '#059669' : '#dc2626'}">
        ${s.diff > 0 ? '+' : ''}${formatFromKDA(s.diff)}
      </td>
      <td class="text-right font-mono font-bold">
        <span class="badge ${s.pct < 0 ? 'badge-emerald' : 'badge-rose'}">${s.pct > 0 ? '+' : ''}${s.pct} %</span>
      </td>
    </tr>
  `;

  tbody.innerHTML = html;
}

function renderStocksGLTable(data) {
  const tbody = document.querySelector('#tableStocksGLPage tbody');
  if (!tbody) return;

  if (!data || !Array.isArray(data.stocks) || data.stocks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:28px 16px; color:#64748b; font-style:italic;">
          Aucun stock enregistré — En attente d'importation dans la base de données.
        </td>
      </tr>
    `;
    return;
  }

  const stocks = data.stocks;
  let totalReport = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  let totalSolde = 0;
  let html = '';

  stocks.forEach(s => {
    const report = s.report || 0;
    const debit = s.debit || 0;
    const credit = s.credit || 0;
    const solde = s.solde || 0;

    totalReport += report;
    totalDebit += debit;
    totalCredit += credit;
    totalSolde += solde;

    html += `
      <tr>
        <td class="font-mono font-bold">${s.boal}</td>
        <td class="font-mono text-emerald font-bold">${s.dz || '—'}</td>
        <td>${s.desc || s.chartDesc || 'Magasin / Stock'}</td>
        <td class="text-right font-mono">${formatFromDA(report)}</td>
        <td class="text-right font-mono text-emerald">${formatFromDA(debit)}</td>
        <td class="text-right font-mono text-rose">${formatFromDA(credit)}</td>
        <td class="text-right font-mono font-bold">${formatFromDA(solde)}</td>
      </tr>
    `;
  });

  html += `
    <tr class="total-row">
      <td colspan="3">TOTAL INVENTAIRE DES STOCKS (CLASSE 3)</td>
      <td class="text-right font-mono font-bold">${formatFromDA(totalReport)}</td>
      <td class="text-right font-mono font-bold">${formatFromDA(totalDebit)}</td>
      <td class="text-right font-mono font-bold">${formatFromDA(totalCredit)}</td>
      <td class="text-right font-mono font-bold">${formatFromDA(totalSolde)}</td>
    </tr>
  `;

  tbody.innerHTML = html;
}

// ==========================================================================
// 8. PAGE 5: DÉBOURS & DOUANE (173 / 178 / 1971)
// ==========================================================================
async function loadFiscalitePage() {
  try {
    const yearParam = AppState.selectedYear ? `?year=${AppState.selectedYear}` : '';
    const monthParam = (AppState.selectedMonth && AppState.selectedMonth !== 'ALL') ? `&month=${AppState.selectedMonth}` : '';
    const url = `/api/reports/fiscalite${yearParam ? yearParam + monthParam : (monthParam ? '?' + monthParam.slice(1) : '')}`;
    const res = await fetch(url);
    const data = await res.json();
    AppState.fiscaliteData = data;
    renderFiscaliteViews(data);
  } catch (err) {
    console.error('Failed to load fiscalite page data:', err);
  }
}

function renderFiscaliteViews(data) {
  const elDebours = document.getElementById('statFiscalDebours');
  const elTva = document.getElementById('statFiscalTVA');
  const elRetenue = document.getElementById('statFiscalRetenue');

  if (elDebours) elDebours.textContent = formatFromDA(data.totals?.totalDebours || 0, true);
  if (elTva) elTva.textContent = formatFromDA(data.totals?.totalTva || 0, true);
  if (elRetenue) elRetenue.textContent = formatFromDA(data.totals?.totalRetenue || 0, true);

  const tbody = document.querySelector('#tableFiscalBrokers tbody');
  if (!tbody) return;

  if (!Array.isArray(data.deboursBySupplier) || data.deboursBySupplier.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" style="text-align:center; padding:28px 16px; color:#64748b; font-style:italic;">
          Aucune opération de transit ou débours enregistrée — En attente d'importation dans la base de données.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  data.deboursBySupplier.forEach(b => {
    html += `
      <tr>
        <td><strong>${b.supplier}</strong></td>
        <td class="text-right font-mono font-bold">${formatFromDA(b.amount)}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// ==========================================================================
// 9. PAGE 6: PARAMÈTRES & DIRECT DATABASE IMPORT
// ==========================================================================
async function loadSettingsPage() {
  try {
    const res = await fetch('/api/reports/status');
    const data = await res.json();
    AppState.settingsStatus = data;
    renderDatabaseStatus(data.database);
  } catch (err) {
    console.error('Failed to load database status:', err);
  }
  // Load full import summaries, diff history, and reconciliation audit
  await loadImportPage();
}

function renderDatabaseStatus(db) {
  if (!db) return;
  const badge = document.getElementById('badgeSqlDbStatus');
  const instance = document.getElementById('statDbInstance');
  const suppliers = document.getElementById('statDbSuppliers');
  const balances = document.getElementById('statDbBalances');
  const chart = document.getElementById('statDbChart');
  const gl = document.getElementById('statDbGL');

  if (badge) {
    if (db.connected) {
      badge.className = 'badge badge-emerald';
      badge.textContent = `Connecté • ${db.database || 'SensusSAPDB'}`;
    } else {
      badge.className = 'badge badge-rose';
      badge.textContent = `Déconnecté • ${db.error || 'Erreur SQL'}`;
    }
  }

  if (instance) instance.textContent = db.server || 'localhost\\SQLEXPRESS';
  if (suppliers) {
    suppliers.textContent = (db.stats && db.stats.suppliersCount !== undefined)
      ? Number(db.stats.suppliersCount).toLocaleString('fr-FR')
      : '127';
  }
  if (balances && db.stats && db.stats.balancesCount !== undefined) {
    balances.textContent = Number(db.stats.balancesCount).toLocaleString('fr-FR');
  }
  if (chart && db.stats && db.stats.chartCount !== undefined) {
    chart.textContent = Number(db.stats.chartCount).toLocaleString('fr-FR');
  }
  const glVal = (db.stats && db.stats.glCount !== undefined) ? db.stats.glCount : (db.stats && db.stats.fbl3nCount !== undefined ? db.stats.fbl3nCount : null);
  if (gl && glVal !== null) {
    gl.textContent = Number(glVal).toLocaleString('fr-FR');
  }
}


function renderSettingsFilesTable(rawFilesObj) {
  const tbody = document.querySelector('#tableSettingsFiles tbody');
  if (!tbody || !rawFilesObj) return;

  const filesObj = rawFilesObj.files || rawFilesObj;

  const fileDefinitions = {
    chartOfAccounts: { role: "Table d'équivalence Plan Comptable Groupe BOAL (6000...) <-> Algérie SCF (300... / 600...)" },
    balance1026: { role: "Grand Livre SAP Octobre 2026 (RFSSLD00) : Soldes finaux et mouvements" },
    balance25: { role: "Grand Livre SAP N-1 2025 : Base comparative pour les stocks et charges" },
    f41: { role: "Journal des Factures Fournisseurs SAP F.41 : Pièces comptables réelles" },
    fbl3n: { role: "Postes non soldés fournisseurs SAP FBL3N : Rapprochement" },
    debours: { role: "Fichier d'apurement des débours et avances transitaires (17300015)" },
    retunie: { role: "Retenues à la source 5% prestataires de services étrangers (1971)" },
    tva: { role: "TVA déductible sur achats et importations (1787)" },
    mcba: { role: "Mouvements de trésorerie bancaire & rapprochements décaissements" }
  };

  let html = '';
  Object.keys(filesObj).forEach(key => {
    const f = filesObj[key];
    const def = fileDefinitions[key] || { role: "Données de gestion SAP" };
    const exists = f.exists;
    const count = f.count !== undefined ? `${f.count.toLocaleString('fr-FR')} enregistrements` : (exists ? 'Chargeable' : 'Non détecté');

    html += `
      <tr>
        <td class="font-mono"><strong>${f.name}</strong></td>
        <td style="color:#475569;">${def.role}</td>
        <td>
          <span class="badge ${exists ? 'badge-emerald' : 'badge-rose'}">
            ${exists ? '✓ Présent dans OS-appro' : '✗ Manquant'}
          </span>
        </td>
        <td class="font-mono">${count}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Utility debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ==========================================================================
// 8. RÉFÉRENTIEL FOURNISSEURS & RÈGLES DE FIXATION
// ==========================================================================
const RUBRIQUES_LIST = [
  { code: 'PD', label: 'PD — PIECES DETACHEES' },
  { code: 'MP', label: 'MP — MATIERE PREMIERE' },
  { code: 'MA', label: 'MA — MATIERE AUXILIAIRE' },
  { code: 'EQUIP', label: 'EQUIP — EQUIPEMENT' },
  { code: 'S', label: 'S — SERVICES' },
  { code: 'PR', label: 'PR — PIECES DE RECHANGE' },
  { code: 'TE', label: 'TE — TRAVAUX ENTREPRENEUR' },
  { code: 'GD', label: 'GD — COMPTEUR G D' },
  { code: 'Diver', label: 'Diver — DIVERS' }
];

function initSuppliersControls() {
  const searchInput = document.getElementById('supplierSearchInput');
  const clearBtn = document.getElementById('btnClearSupplierSearch');
  const refreshBtn = document.getElementById('btnRefreshSuppliers');
  const filterBtns = document.querySelectorAll('.filter-sup-btn');

  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      AppState.supplierSearch = e.target.value.trim().toLowerCase();
      applySuppliersFilter();
    }, 200));
  }

  if (clearBtn && searchInput) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      AppState.supplierSearch = '';
      applySuppliersFilter();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadSuppliersPage(true);
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => {
        b.classList.remove('btn-primary', 'active');
        b.classList.add('btn-outline-secondary');
      });
      btn.classList.remove('btn-outline-secondary');
      btn.classList.add('btn-primary', 'active');

      AppState.supplierFilter = btn.getAttribute('data-filter') || 'all';
      applySuppliersFilter();
    });
  });
}

async function loadSuppliersPage(forceRefresh = false) {
  const tbody = document.getElementById('suppliersTableBody');
  if (!tbody) return;

  if (tbody.children.length === 0 || forceRefresh) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:#64748b;">Chargement du référentiel fournisseurs...</td></tr>`;
  }

  try {
    const res = await fetch('/api/suppliers');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Erreur API');

    AppState.allSuppliers = data.suppliers || [];

    // Update KPIs
    const total = AppState.allSuppliers.length;
    const fixed = AppState.allSuppliers.filter(s => s.isFixed).length;
    const multi = total - fixed;

    const elTotal = document.getElementById('kpiTotalSuppliers');
    const elFixed = document.getElementById('kpiFixedSuppliers');
    const elMulti = document.getElementById('kpiMultiSuppliers');

    if (elTotal) elTotal.textContent = String(total);
    if (elFixed) elFixed.textContent = String(fixed);
    if (elMulti) elMulti.textContent = String(multi);

    applySuppliersFilter();
  } catch (err) {
    console.error('Error loading suppliers:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:#e11d48;">Erreur lors du chargement : ${err.message}</td></tr>`;
  }
}

function applySuppliersFilter() {
  const filter = AppState.supplierFilter;
  const search = AppState.supplierSearch;

  let filtered = AppState.allSuppliers || [];

  // 1. Text Search
  if (search) {
    filtered = filtered.filter(s => {
      const id = String(s.supplierId || '').toLowerCase();
      const name = String(s.supplierName || '').toLowerCase();
      return id.includes(search) || name.includes(search);
    });
  }

  // 2. Button filter
  if (filter === 'fixed') {
    filtered = filtered.filter(s => s.isFixed);
  } else if (filter === 'multi') {
    filtered = filtered.filter(s => !s.isFixed);
  } else if (filter.startsWith('cat-')) {
    const targetCat = filter.replace('cat-', '');
    filtered = filtered.filter(s => s.category === targetCat);
  }

  // Update badge
  const countBadge = document.getElementById('supplierCountBadge');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} tiers affiché(s)`;
  }

  renderSuppliersTable(filtered);
}

function renderSuppliersTable(suppliers) {
  const tbody = document.getElementById('suppliersTableBody');
  if (!tbody) return;

  if (!suppliers || suppliers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:#64748b;">Aucun fournisseur correspondant au filtre sélectionné.</td></tr>`;
    return;
  }

  let html = '';
  suppliers.forEach(s => {
    const id = s.supplierId;
    const name = s.supplierName || `FOURNISSEUR #${id}`;
    const isFixed = Boolean(s.isFixed);
    const category = s.category || 'Diver';
    const invCount = s.invoiceCount || 0;
    const volume = s.totalVolume || 0;
    const isSimonfond = id === '1380763' || name.toUpperCase().includes('SIMONFOND');

    // Options for category
    const catOptions = RUBRIQUES_LIST.map(r => `
      <option value="${r.code}" ${r.code === category ? 'selected' : ''}>${r.label}</option>
    `).join('');

    html += `
      <tr data-supplier-id="${id}" class="${isSimonfond ? 'row-strategic' : ''}">
        <td class="font-mono">
          <strong>${id}</strong>
          ${isSimonfond ? '<span class="badge badge-purple" style="font-size:10px; margin-left:4px;">Simonfond</span>' : ''}
        </td>
        <td style="font-weight:500;">
          ${name}
          ${s.currency && s.currency !== 'DZD' ? `<span class="badge badge-slate" style="font-size:10px; margin-left:6px;">${s.currency}</span>` : ''}
        </td>
        <td>
          <select class="form-control form-control-sm sup-mode-select" data-id="${id}" style="font-weight:600; ${isFixed ? 'color:#059669;' : 'color:#0284c7;'}">
            <option value="fixed" ${isFixed ? 'selected' : ''}>🔒 Catégorie Fixe</option>
            <option value="multi" ${!isFixed ? 'selected' : ''}>🔀 Multi-catégories</option>
          </select>
        </td>
        <td>
          <select class="form-control form-control-sm sup-cat-select" data-id="${id}" style="font-weight:600;">
            ${catOptions}
          </select>
        </td>
        <td style="text-align:center;" class="font-mono">${invCount}</td>
        <td style="text-align:right;" class="font-mono"><strong>${formatFromDA(volume, false)}</strong></td>
        <td style="text-align:center;">
          <span class="status-indicator" id="status-sup-${id}" style="font-size:11px; color:#10b981; font-weight:600;">✓ Actif</span>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // Attach reactive listeners to selects
  tbody.querySelectorAll('.sup-mode-select').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      const isFixed = e.target.value === 'fixed';
      e.target.style.color = isFixed ? '#059669' : '#0284c7';
      await saveSupplierChange(id, { isFixed });
    });
  });

  tbody.querySelectorAll('.sup-cat-select').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      const category = e.target.value;
      await saveSupplierChange(id, { category });
    });
  });
}

async function saveSupplierChange(supplierId, changes) {
  const statusEl = document.getElementById(`status-sup-${supplierId}`);
  if (statusEl) {
    statusEl.textContent = 'Enregistrement...';
    statusEl.style.color = '#f59e0b';
  }

  try {
    const res = await fetch(`/api/suppliers/${supplierId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes)
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Erreur sauvegarde');

    // Update local state
    const sup = AppState.allSuppliers.find(s => s.supplierId === supplierId);
    if (sup) {
      if (changes.category !== undefined) sup.category = changes.category;
      if (changes.isFixed !== undefined) sup.isFixed = changes.isFixed;
    }

    if (statusEl) {
      statusEl.textContent = changes.affectedInvoices > 0 ? `✓ ${changes.affectedInvoices} fact.` : '✓ Sauvegardé';
      statusEl.style.color = '#10b981';
      setTimeout(() => {
        if (statusEl) {
          statusEl.textContent = '✓ Actif';
          statusEl.style.color = '#10b981';
        }
      }, 2500);
    }

    // Invalidate cached reports so any navigation immediately recalculates
    AppState.doc9Data = null;
  } catch (err) {
    console.error('Error saving supplier change:', err);
    if (statusEl) {
      statusEl.textContent = '✗ Erreur';
      statusEl.style.color = '#e11d48';
    }
  }
}

// ==========================================================================
// 9. TABLEAU DES COMPTES DE RÉSULTATS (TCR — SCF ALGÉRIE)
// ==========================================================================
let areAllTcrAccountsExpanded = false;

function initTCRControls() {
  const refreshBtn = document.getElementById('btnRefreshTCR');
  const toggleBtn = document.getElementById('btnToggleTcrAccounts');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadTCRPage(true);
    });
  }

  // Source toggle (Balance vs GL)
  const sourceBtns = document.querySelectorAll('#tcrSourceToggle .source-toggle-btn');
  sourceBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const src = btn.getAttribute('data-source');
      if (src === AppState.tcrSource) return;
      AppState.tcrSource = src;
      sourceBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadTCRPage(true);
    });
  });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      areAllTcrAccountsExpanded = !areAllTcrAccountsExpanded;
      toggleBtn.innerHTML = areAllTcrAccountsExpanded
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg> Replier Tous les Comptes`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg> Déplier Tous les Comptes SAP`;

      document.querySelectorAll('.tcr-account-subrow').forEach(row => {
        row.style.display = areAllTcrAccountsExpanded ? 'table-row' : 'none';
      });
    });
  }
}

async function loadTCRPage(forceRefresh = false) {
  const tbody = document.getElementById('tcrTableBody');
  if (!tbody) return;

  const targetYear = AppState.selectedYear || '2026';
  const targetMonth = AppState.selectedMonth || 'ALL';
  const source = AppState.tcrSource || 'balance';

  if (AppState.tcrData && !forceRefresh && String(AppState.tcrData.yearN) === String(targetYear) && String(AppState.tcrData.month || 'ALL') === String(targetMonth) && AppState.tcrData.source === source) {
    renderTCRTable(AppState.tcrData);
    return;
  }

  const monthLabel = targetMonth !== 'ALL' ? ` — ${MONTH_NAMES[targetMonth] || targetMonth}` : '';
  const srcLabel = source === 'gl' ? 'Grand Livre (FBL3N)' : 'Balance (RFSSLD00)';
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:#64748b;">Génération du Tableau des Comptes de Résultats (TCR Exercice ${targetYear}${monthLabel} • Source : ${srcLabel})...</td></tr>`;

  try {
    const monthParam = (targetMonth && targetMonth !== 'ALL') ? `&month=${encodeURIComponent(targetMonth)}` : '';
    const res = await fetch(`/api/tcr?year=${encodeURIComponent(targetYear)}${monthParam}&source=${encodeURIComponent(source)}`);
    const json = await res.json();
    if (json.success === false) throw new Error(json.error || 'Erreur API');

    AppState.tcrData = json.tcr || json;
    AppState.tcrData.month = targetMonth;
    const effectiveSource = (json.tcr && (json.tcr.sourceUsed || json.tcr.source)) || source;
    AppState.tcrData.source = effectiveSource;
    if (json.tcr && json.tcr.sourceUsed) {
      AppState.tcrSource = json.tcr.sourceUsed;
    }
    renderTCRTable(AppState.tcrData);
  } catch (err) {
    console.error('Error loading TCR:', err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:#e11d48;">Erreur lors du calcul du TCR : ${err.message}</td></tr>`;
  }
}

function renderTCRTable(data) {
  if (!data) return;

  const hasN1 = (data.hasN1 !== undefined) ? Boolean(data.hasN1) : (data.yearN_1 !== null && data.yearN_1 !== undefined);
  const yearN = data.yearN || AppState.selectedYear || '2026';
  const yearN1 = data.yearN_1;
  const activeSource = data.source || AppState.tcrSource || 'balance';

  // Sync toggle buttons
  document.querySelectorAll('#tcrSourceToggle .source-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-source') === activeSource);
  });

  // 1. Update Unit Badge & Fiscal Year Badges
  const badgeUnit = document.getElementById('badgeTcrUnit');
  if (badgeUnit) badgeUnit.textContent = `Unité active : ${AppState.unit}`;

  const selectedMonth = AppState.selectedMonth;
  const monthTag = (selectedMonth && selectedMonth !== 'ALL') ? ` • ${MONTH_NAMES[selectedMonth] || selectedMonth}` : '';
  const srcBadge = activeSource === 'gl' ? ' • Source: 📖 Grand Livre' : ' • Source: ⚖️ Balance';

  const badgeFiscal = document.getElementById('badgeTcrFiscalYears');
  if (badgeFiscal) {
    badgeFiscal.innerHTML = hasN1
      ? `<span>Exercice ${yearN} (N) vs ${yearN1} (N-1)${monthTag}${srcBadge}</span>`
      : `<span>Exercice ${yearN} (N)${monthTag}${srcBadge}</span>`;
  }

  const elHeading = document.getElementById('tcrPageHeading');
  if (elHeading) {
    elHeading.textContent = `Tableau des Comptes de Résultats (TCR ${yearN}${monthTag ? ' — ' + monthTag.replace(/^ • /, '') : ''})`;
  }

  const elHeaderSub = document.getElementById('tcrHeaderSubtitle');
  if (elHeaderSub) {
    if (!data.hasData) {
      elHeaderSub.innerHTML = `<span style="color:#d97706; font-weight:700;">⚠️ Aucune écriture enregistrée en base pour le mois sélectionné — Soldes à 0,00 DA.</span>`;
    } else {
      const srcDesc = activeSource === 'gl' ? 'Grand Livre FBL3N (Écritures individuelles)' : 'Balance Générale RFSSLD00 (Soldes cumulés)';
      elHeaderSub.textContent = hasN1
        ? `Soldes Intermédiaires de Gestion (SIG) de SENSUS SPA : Production, Consommation, VA, EBE, Résultat Opérationnel et Résultat Net (Exercice ${yearN} vs ${yearN1}) • Source : ${srcDesc}.`
        : `Soldes Intermédiaires de Gestion (SIG) de SENSUS SPA : Production, Consommation, VA, EBE, Résultat Opérationnel et Résultat Net (Exercice ${yearN}) • Source : ${srcDesc}.`;
    }
  }

  const elTableSub = document.getElementById('tcrTableSubtitle');
  if (elTableSub) {
    const srcNote = activeSource === 'gl' ? 'Source: Grand Livre' : 'Source: Balance';
    elTableSub.innerHTML = hasN1
      ? `Société : <strong>SENSUS ALGERIE SPA</strong> | Comparatif Officiel : Exercice ${yearN} (N) vs Exercice ${yearN1} (N-1) [${srcNote}]`
      : `Société : <strong>SENSUS ALGERIE SPA</strong> | Données de Clôture : Exercice ${yearN} (N) [${srcNote}]`;
  }

  // Update Dynamic Table Headers & Column Visibility
  const thColN = document.getElementById('thTcrColN');
  if (thColN) {
    thColN.innerHTML = `Exercice ${yearN} (N)<br><span class="col-unit" style="font-size:10px; font-weight:normal;">${AppState.unit}</span>`;
  }

  const thRatioN = document.getElementById('thTcrRatioN');
  if (thRatioN) {
    thRatioN.innerHTML = `% CA (${yearN})`;
  }

  const thColN1 = document.getElementById('thTcrColN1');
  if (thColN1) {
    thColN1.style.display = hasN1 ? '' : 'none';
    if (hasN1) {
      thColN1.innerHTML = `Exercice ${yearN1} (N-1)<br><span class="col-unit" style="font-size:10px; font-weight:normal;">${AppState.unit}</span>`;
    }
  }

  const thDiff = document.getElementById('thTcrDiff');
  if (thDiff) {
    thDiff.style.display = hasN1 ? '' : 'none';
    if (hasN1) {
      thDiff.innerHTML = `Variation (Δ)<br><span class="col-unit" style="font-size:10px; font-weight:normal;">${AppState.unit}</span>`;
    }
  }

  const thPct = document.getElementById('thTcrPct');
  if (thPct) {
    thPct.style.display = hasN1 ? '' : 'none';
  }

  // 2. Update Executive KPIs
  const kpis = data.kpis || {};
  const elCA = document.getElementById('kpiTcrCA');
  const elCADiff = document.getElementById('kpiTcrCADiff');
  const elVA = document.getElementById('kpiTcrVA');
  const elVATaux = document.getElementById('kpiTcrVATaux');
  const elEBE = document.getElementById('kpiTcrEBE');
  const elEBEMarge = document.getElementById('kpiTcrEBEMarge');
  const elRN = document.getElementById('kpiTcrRN');
  const elRNMarge = document.getElementById('kpiTcrRNMarge');

  const lblCA = document.getElementById('lblKpiTcrCA');
  if (lblCA) lblCA.textContent = `Chiffre d'Affaires ${yearN} (70)`;

  const lblVA = document.getElementById('lblKpiTcrVA');
  if (lblVA) lblVA.textContent = `Valeur Ajoutée (VA ${yearN})`;

  const lblEBE = document.getElementById('lblKpiTcrEBE');
  if (lblEBE) lblEBE.textContent = `Excédent Brut Exploitation (${yearN})`;

  const lblRN = document.getElementById('lblKpiTcrRN');
  if (lblRN) lblRN.textContent = `Résultat Net de l'Exercice ${yearN}`;

  const valCAN = kpis.caN !== undefined ? kpis.caN : kpis.ca26;
  const valCAN1 = kpis.caN_1 !== undefined ? kpis.caN_1 : kpis.ca25;
  const valVAN = kpis.vaN !== undefined ? kpis.vaN : kpis.va26;
  const valEBEN = kpis.ebeN !== undefined ? kpis.ebeN : kpis.ebe26;
  const valRNN = kpis.resNetN !== undefined ? kpis.resNetN : kpis.resNet26;

  if (elCA) elCA.textContent = formatFromDA(valCAN, true);
  if (elCADiff) {
    if (hasN1 && valCAN1 !== null && valCAN1 !== undefined) {
      const sign = (kpis.caDiffPct || 0) >= 0 ? '+' : '';
      elCADiff.textContent = `vs ${yearN1} (${formatFromDA(valCAN1, false)}) : ${sign}${(kpis.caDiffPct || 0).toFixed(1)}%`;
    } else {
      elCADiff.textContent = `Exercice de clôture certifié`;
    }
  }

  if (elVA) elVA.textContent = formatFromDA(valVAN, true);
  if (elVATaux) {
    const tauxVA = kpis.tauxVAN !== undefined ? kpis.tauxVAN : (kpis.tauxVA26 || 0);
    elVATaux.textContent = `Taux de VA / Production : ${tauxVA.toFixed(1)}%`;
  }

  if (elEBE) elEBE.textContent = formatFromDA(valEBEN, true);
  if (elEBEMarge) {
    const margeEBE = kpis.margeEBEN !== undefined ? kpis.margeEBEN : (kpis.margeEBE26 || 0);
    elEBEMarge.textContent = `Marge EBE / CA : ${margeEBE.toFixed(1)}%`;
  }

  if (elRN) elRN.textContent = formatFromDA(valRNN, true);
  if (elRNMarge) {
    const margeNette = kpis.margeNetteN !== undefined ? kpis.margeNetteN : (kpis.margeNette26 || 0);
    elRNMarge.textContent = `Marge Nette / CA : ${margeNette.toFixed(1)}%`;
  }

  // 3. Render Table Rows
  const tbody = document.getElementById('tcrTableBody');
  if (!tbody) return;

  let html = '';

  (data.rows || []).forEach((row, idx) => {
    const isSig = row.type === 'sig' || row.type === 'sig-final';
    const isTotal = row.type === 'total';
    const hasAccounts = row.accounts && row.accounts.length > 0;

    let rowClass = '';
    let style = '';
    let refBadge = `<span class="font-mono text-muted">${row.ref}</span>`;

    if (row.type === 'sig-final') {
      rowClass = 'tcr-sig-final';
      style = 'background-color:#eff6ff; font-weight:700; border-top:2px solid #2563eb; border-bottom:3px double #1d4ed8; font-size:14px; color:#1e40af;';
      refBadge = `<span class="badge badge-purple font-mono" style="font-weight:700;">${row.ref}</span>`;
    } else if (row.type === 'sig') {
      rowClass = 'tcr-sig';
      style = 'background-color:#f8fafc; font-weight:700; border-top:1.5px solid #0284c7; border-bottom:1.5px solid #0284c7; color:#0f172a;';
      refBadge = `<span class="badge badge-sky font-mono" style="font-weight:700;">${row.ref}</span>`;
    } else if (row.type === 'sig-sec') {
      rowClass = 'tcr-sig-sec';
      style = 'background-color:#fcfcfc; font-weight:600; border-top:1px dashed #cbd5e1; border-bottom:1px solid #cbd5e1;';
      refBadge = `<span class="badge badge-slate font-mono">${row.ref}</span>`;
    } else if (isTotal) {
      rowClass = 'tcr-total';
      style = 'background-color:#f1f5f9; font-weight:700; border-top:1px solid #94a3b8; border-bottom:1px solid #94a3b8;';
      refBadge = `<span class="badge badge-emerald font-mono">${row.ref}</span>`;
    }

    // Format amounts using dynamic year properties (valN and valN_1)
    const valN = (row.valN !== undefined) ? row.valN : row.val26;
    const valN1 = (row.valN_1 !== undefined) ? row.valN_1 : row.val25;
    const strN = formatFromDA(valN, false);
    const strN1 = (hasN1 && valN1 !== null && valN1 !== undefined) ? formatFromDA(valN1, false) : '—';
    const diffVal = row.diff !== undefined ? row.diff : ((hasN1 && valN1 !== null) ? (valN - valN1) : null);
    const strDiff = diffVal !== null ? formatFromDA(diffVal, false) : '—';

    // Percentage evolution
    let strPct = '—';
    if (hasN1 && row.pct !== null && !isNaN(row.pct)) {
      const sign = row.pct > 0 ? '+' : '';
      const color = row.pct >= 0 ? '#059669' : '#e11d48';
      strPct = `<span style="color:${color}; font-weight:600;">${sign}${row.pct.toFixed(1)}%</span>`;
    }

    // Ratio CA
    const ratioCAN = row.ratioCAN !== undefined ? row.ratioCAN : (row.ratioCA26 !== undefined ? row.ratioCA26 : 0);
    const strRatioCA = Math.abs(ratioCAN) > 0 ? `${ratioCAN.toFixed(1)}%` : '—';

    // Accounts Toggle button
    let accountTrigger = '';
    if (hasAccounts) {
      accountTrigger = `
        <button class="btn btn-sm btn-outline-secondary tcr-expand-btn" data-target="tcr-acc-${idx}" style="font-size:10.5px; padding:2px 6px;">
          ${row.accountCount || row.accounts.length} cpt ▾
        </button>
      `;
    }

    if (hasN1) {
      html += `
        <tr class="${rowClass}" style="${style}">
          <td style="text-align:center;">${refBadge}</td>
          <td>
            <strong>${row.label}</strong>
          </td>
          <td style="text-align:right;" class="font-mono"><strong>${strN}</strong></td>
          <td style="text-align:right; font-size:12px; color:#64748b;" class="font-mono">${strRatioCA}</td>
          <td style="text-align:right;" class="font-mono">${strN1}</td>
          <td style="text-align:right;" class="font-mono">${strDiff}</td>
          <td style="text-align:right;" class="font-mono">${strPct}</td>
          <td style="text-align:center;">${accountTrigger}</td>
        </tr>
      `;
    } else {
      // Selected year only (no N-1 columns)
      html += `
        <tr class="${rowClass}" style="${style}">
          <td style="text-align:center;">${refBadge}</td>
          <td>
            <strong>${row.label}</strong>
          </td>
          <td style="text-align:right;" class="font-mono"><strong>${strN}</strong></td>
          <td style="text-align:right; font-size:12px; color:#64748b;" class="font-mono">${strRatioCA}</td>
          <td style="text-align:center;">${accountTrigger}</td>
        </tr>
      `;
    }

    // Detailed Account Sub-rows (collapsible)
    if (hasAccounts) {
      row.accounts.forEach(acc => {
        const accN = acc.valN !== undefined ? acc.valN : acc.val26;
        const accN1 = acc.valN_1 !== undefined ? acc.valN_1 : acc.val25;
        const accDiff = acc.diff !== undefined ? acc.diff : ((hasN1 && accN1 !== null) ? (accN - accN1) : null);

        if (hasN1) {
          html += `
            <tr class="tcr-account-subrow tcr-acc-${idx}" style="display:none; background-color:#fafafa; font-size:12px; border-left:3px solid #0ea5e9;">
              <td style="text-align:center; color:#94a3b8;" class="font-mono">${acc.boal}</td>
              <td style="padding-left:28px;">
                <span class="badge badge-slate" style="font-size:10px; margin-right:6px;">SCF ${acc.dz}</span>
                <span style="color:#334155;">${acc.desc || 'Sans libellé'}</span>
              </td>
              <td style="text-align:right;" class="font-mono text-muted">${formatFromDA(accN, false)}</td>
              <td style="text-align:right; color:#94a3b8;">—</td>
              <td style="text-align:right;" class="font-mono text-muted">${accN1 !== null && accN1 !== undefined ? formatFromDA(accN1, false) : '—'}</td>
              <td style="text-align:right;" class="font-mono text-muted">${accDiff !== null ? formatFromDA(accDiff, false) : '—'}</td>
              <td style="text-align:right; color:#94a3b8;">—</td>
              <td></td>
            </tr>
          `;
        } else {
          html += `
            <tr class="tcr-account-subrow tcr-acc-${idx}" style="display:none; background-color:#fafafa; font-size:12px; border-left:3px solid #0ea5e9;">
              <td style="text-align:center; color:#94a3b8;" class="font-mono">${acc.boal}</td>
              <td style="padding-left:28px;">
                <span class="badge badge-slate" style="font-size:10px; margin-right:6px;">SCF ${acc.dz}</span>
                <span style="color:#334155;">${acc.desc || 'Sans libellé'}</span>
              </td>
              <td style="text-align:right;" class="font-mono text-muted">${formatFromDA(accN, false)}</td>
              <td style="text-align:right; color:#94a3b8;">—</td>
              <td></td>
            </tr>
          `;
        }
      });
    }
  });

  tbody.innerHTML = html;

  // Attach individual expand triggers
  tbody.querySelectorAll('.tcr-expand-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetClass = btn.getAttribute('data-target');
      const rows = tbody.querySelectorAll(`.${targetClass}`);
      const isVisible = rows.length > 0 && rows[0].style.display !== 'none';
      rows.forEach(r => r.style.display = isVisible ? 'none' : 'table-row');
      btn.textContent = isVisible ? `${rows.length} cpt ▾` : `${rows.length} cpt ▴`;
    });
  });
}

// ==========================================================================
// 8. BILAN COMPTABLE (ACTIF & PASSIF — SCF ALGÉRIE)
// ==========================================================================
function initBilanControls() {
  const btnRefresh = document.getElementById('btnRefreshBilan');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadBilanPage(true);
    });
  }

  // Source toggle (Balance vs GL)
  const sourceBtns = document.querySelectorAll('#bilanSourceToggle .source-toggle-btn');
  sourceBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const src = btn.getAttribute('data-source');
      if (src === AppState.bilanSource) return;
      AppState.bilanSource = src;
      sourceBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadBilanPage(true);
    });
  });

  // Toggle all accounts
  const btnToggle = document.getElementById('btnToggleBilanAccounts');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const subrows = document.querySelectorAll('.bilan-account-subrow');
      if (subrows.length === 0) return;
      const anyHidden = Array.from(subrows).some(r => r.style.display === 'none');
      subrows.forEach(r => r.style.display = anyHidden ? 'table-row' : 'none');
      btnToggle.innerHTML = anyHidden
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg> Replier Tous les Comptes`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg> Déplier Tous les Comptes SAP`;

      document.querySelectorAll('.bilan-expand-btn').forEach(btn => {
        const count = btn.getAttribute('data-count') || '';
        btn.textContent = anyHidden ? `${count} cpt ▴` : `${count} cpt ▾`;
      });
    });
  }

  // Tab View Switcher (All / Actif / Passif)
  document.querySelectorAll('.bilan-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.bilan-tab-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
      document.querySelectorAll('.bilan-tab-btn').forEach(b => b.classList.add('btn-outline-secondary'));
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-outline-secondary');

      const view = btn.getAttribute('data-view');
      const panelActif = document.getElementById('panelActif');
      const panelPassif = document.getElementById('panelPassif');

      if (view === 'actif') {
        if (panelActif) panelActif.style.display = 'block';
        if (panelPassif) panelPassif.style.display = 'none';
      } else if (view === 'passif') {
        if (panelActif) panelActif.style.display = 'none';
        if (panelPassif) panelPassif.style.display = 'block';
      } else {
        if (panelActif) panelActif.style.display = 'block';
        if (panelPassif) panelPassif.style.display = 'block';
      }
    });
  });
}

async function loadBilanPage(forceReload = false) {
  const targetYear = AppState.selectedYear || '2026';
  const targetMonth = AppState.selectedMonth || 'ALL';
  const source = AppState.bilanSource || 'balance';

  if (AppState.bilanData && !forceReload && String(AppState.bilanData.yearN) === String(targetYear) && String(AppState.bilanData.month || 'ALL') === String(targetMonth) && AppState.bilanData.source === source) {
    renderBilanTables(AppState.bilanData);
    return;
  }

  const tbodyActif = document.getElementById('bilanActifTableBody');
  const tbodyPassif = document.getElementById('bilanPassifTableBody');
  const monthLabel = targetMonth !== 'ALL' ? ` — ${MONTH_NAMES[targetMonth] || targetMonth}` : '';
  const srcLabel = source === 'gl' ? 'Grand Livre (FBL3N)' : 'Balance (RFSSLD00)';
  if (tbodyActif) {
    tbodyActif.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:#64748b;">Chargement et calcul du Bilan Actif (Exercice ${targetYear}${monthLabel} • Source : ${srcLabel})...</td></tr>`;
  }
  if (tbodyPassif) {
    tbodyPassif.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:#64748b;">Chargement et calcul du Bilan Passif (Exercice ${targetYear}${monthLabel} • Source : ${srcLabel})...</td></tr>`;
  }

  try {
    const monthParam = (targetMonth && targetMonth !== 'ALL') ? `&month=${encodeURIComponent(targetMonth)}` : '';
    const res = await fetch(`/api/bilan?year=${encodeURIComponent(targetYear)}${monthParam}&source=${encodeURIComponent(source)}`);
    const json = await res.json();
    if (!json.success || !json.bilan) {
      throw new Error(json.error || 'Données du Bilan indisponibles');
    }

    AppState.bilanData = json.bilan;
    AppState.bilanData.month = targetMonth;
    const effectiveSource = (json.bilan && (json.bilan.sourceUsed || json.bilan.source)) || source;
    AppState.bilanData.source = effectiveSource;
    if (json.bilan && json.bilan.sourceUsed) {
      AppState.bilanSource = json.bilan.sourceUsed;
    }
    renderBilanTables(AppState.bilanData);
  } catch (err) {
    console.error('Error loading Bilan:', err);
    if (tbodyActif) tbodyActif.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:#e11d48;">Erreur : ${err.message}</td></tr>`;
    if (tbodyPassif) tbodyPassif.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:#e11d48;">Erreur : ${err.message}</td></tr>`;
  }
}

function renderBilanTables(data) {
  if (!data) return;

  const hasN1 = (data.hasN1 !== undefined) ? Boolean(data.hasN1) : (data.yearN_1 !== null && data.yearN_1 !== undefined);
  const yearN = data.yearN || AppState.selectedYear || '2026';
  const yearN1 = data.yearN_1;
  const activeSource = data.source || AppState.bilanSource || 'balance';

  // Sync toggle buttons
  document.querySelectorAll('#bilanSourceToggle .source-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-source') === activeSource);
  });

  // 1. Update Unit Badge & Fiscal Badges
  const badgeUnit = document.getElementById('badgeBilanUnit');
  if (badgeUnit) badgeUnit.textContent = `Unité active : ${AppState.unit}`;

  const selectedMonth = AppState.selectedMonth;
  const monthTag = (selectedMonth && selectedMonth !== 'ALL') ? ` • ${MONTH_NAMES[selectedMonth] || selectedMonth}` : '';
  const srcBadge = activeSource === 'gl' ? ' • Source: 📖 Grand Livre' : ' • Source: ⚖️ Balance';

  const badgeFiscal = document.getElementById('badgeBilanFiscalYears');
  if (badgeFiscal) {
    badgeFiscal.innerHTML = hasN1
      ? `<span>Exercice ${yearN} (N) vs ${yearN1} (N-1)${monthTag}${srcBadge}</span>`
      : `<span>Exercice ${yearN} (N)${monthTag}${srcBadge}</span>`;
  }

  const elHeading = document.getElementById('bilanPageHeading');
  if (elHeading) {
    elHeading.textContent = `Bilan Comptable (Actif & Passif — SCF Algérie ${yearN}${monthTag ? ' — ' + monthTag.replace(/^ • /, '') : ''})`;
  }

  const elHeaderSub = document.getElementById('bilanHeaderSubtitle');
  if (elHeaderSub) {
    if (!data.hasData) {
      elHeaderSub.innerHTML = `<span style="color:#d97706; font-weight:700;">⚠️ Aucune écriture enregistrée en base pour le mois sélectionné — Soldes à 0,00 DA.</span>`;
    } else {
      const srcDesc = activeSource === 'gl' ? 'Grand Livre FBL3N (Cumul à fin de période)' : 'Balance Générale RFSSLD00 (Soldes cumulés)';
      const periodText = (selectedMonth && selectedMonth !== 'ALL')
        ? `Cumul 01-${String(selectedMonth).padStart(2, '0')}/${yearN}`
        : `Exercice ${yearN}`;
      elHeaderSub.textContent = hasN1
        ? `Situation patrimoniale officielle (Série G nº2) • ${periodText} vs ${yearN1} (N-1) • Source : ${srcDesc}.`
        : `Situation patrimoniale officielle (Série G nº2) • ${periodText} (N) • Source : ${srcDesc}.`;
    }
  }

  // Update Dynamic Table Headers & Column Visibility
  const thActifBrut = document.getElementById('thBilanActifBrutN');
  if (thActifBrut) thActifBrut.innerHTML = `Brut (${yearN})<br><span class="col-unit" style="font-size:10px; font-weight:normal;">${AppState.unit}</span>`;

  const thActifNetN = document.getElementById('thBilanActifNetN');
  if (thActifNetN) thActifNetN.innerHTML = `Net ${yearN} (N)<br><span class="col-unit" style="font-size:10px; font-weight:normal;">${AppState.unit}</span>`;

  const thActifNetN1 = document.getElementById('thBilanActifNetN1');
  if (thActifNetN1) {
    thActifNetN1.style.display = hasN1 ? '' : 'none';
    if (hasN1) {
      thActifNetN1.innerHTML = `Net ${yearN1} (N-1)<br><span class="col-unit" style="font-size:10px; font-weight:normal;">${AppState.unit}</span>`;
    }
  }

  const thActifEvolPct = document.getElementById('thBilanActifEvolPct');
  if (thActifEvolPct) {
    thActifEvolPct.style.display = hasN1 ? '' : 'none';
  }

  const thPassifN = document.getElementById('thBilanPassifN');
  if (thPassifN) thPassifN.innerHTML = `Montant ${yearN} (N)<br><span class="col-unit" style="font-size:10px; font-weight:normal;">${AppState.unit}</span>`;

  const thPassifN1 = document.getElementById('thBilanPassifN1');
  if (thPassifN1) {
    thPassifN1.style.display = hasN1 ? '' : 'none';
    if (hasN1) {
      thPassifN1.innerHTML = `Montant ${yearN1} (N-1)<br><span class="col-unit" style="font-size:10px; font-weight:normal;">${AppState.unit}</span>`;
    }
  }

  const thPassifEvolPct = document.getElementById('thBilanPassifEvolPct');
  if (thPassifEvolPct) {
    thPassifEvolPct.style.display = hasN1 ? '' : 'none';
  }

  // 2. Update KPIs
  const kpis = data.kpis || {};
  const elActifNet = document.getElementById('kpiActifNet26');
  const elActifNet25Sub = document.getElementById('kpiActifNet25Sub');
  const elCapitaux = document.getElementById('kpiCapitauxPropres');
  const elCapitauxSub = document.getElementById('kpiCapitauxPropresSub');
  const elFRNG = document.getElementById('kpiFRNG');
  const elFRNGSub = document.getElementById('kpiFRNGSub');
  const elEquilibre = document.getElementById('kpiBilanEquilibre');
  const elDiff = document.getElementById('kpiBilanDiff');

  const lblActifNet = document.getElementById('lblKpiActifNet');
  if (lblActifNet) lblActifNet.textContent = `Total Actif Net (${yearN})`;

  const lblCapitaux = document.getElementById('lblKpiCapitaux');
  if (lblCapitaux) lblCapitaux.textContent = `Capitaux Propres (${yearN})`;

  const lblFRNG = document.getElementById('lblKpiFRNG');
  if (lblFRNG) lblFRNG.textContent = `Fonds de Roulement (FRNG ${yearN})`;

  const lblEquilibre = document.getElementById('lblKpiEquilibre');
  if (lblEquilibre) lblEquilibre.textContent = `Équilibre Actif / Passif (${yearN})`;

  const valActifNetN = kpis.totalActifNetN !== undefined ? kpis.totalActifNetN : kpis.totalActifNet26;
  const valActifNetN1 = kpis.totalActifNetN1 !== undefined ? kpis.totalActifNetN1 : kpis.totalActifNet25;
  const valCapitauxN = kpis.capitauxPropresN !== undefined ? kpis.capitauxPropresN : kpis.capitauxPropres26;
  const valCapitauxN1 = kpis.capitauxPropresN1 !== undefined ? kpis.capitauxPropresN1 : kpis.capitauxPropres25;
  const valFRNGN = kpis.frngN !== undefined ? kpis.frngN : kpis.frng26;
  const valFRNGN1 = kpis.frngN1 !== undefined ? kpis.frngN1 : kpis.frng25;
  const valPassifN = kpis.totalPassifN !== undefined ? kpis.totalPassifN : kpis.totalPassif26;

  if (elActifNet) elActifNet.textContent = formatFromDA(valActifNetN, true);
  if (elActifNet25Sub) {
    if (hasN1 && valActifNetN1 !== null && valActifNetN1 !== undefined) {
      const pct = ((valActifNetN - valActifNetN1) / Math.abs(valActifNetN1)) * 100;
      const sign = pct >= 0 ? '+' : '';
      elActifNet25Sub.textContent = `vs ${yearN1} (${formatFromDA(valActifNetN1, false)}) : ${sign}${pct.toFixed(1)}%`;
    } else {
      elActifNet25Sub.textContent = `Exercice de clôture certifié`;
    }
  }

  if (elCapitaux) elCapitaux.textContent = formatFromDA(valCapitauxN, true);
  if (elCapitauxSub) {
    elCapitauxSub.textContent = (hasN1 && valCapitauxN1 !== null && valCapitauxN1 !== undefined)
      ? `(${yearN1} : ${formatFromDA(valCapitauxN1, false)})`
      : `Ressources propres stables`;
  }

  if (elFRNG) elFRNG.textContent = formatFromDA(valFRNGN, true);
  if (elFRNGSub) {
    elFRNGSub.textContent = (hasN1 && valFRNGN1 !== null && valFRNGN1 !== undefined)
      ? `(${yearN1} : ${formatFromDA(valFRNGN1, false)})`
      : `Marge de sécurité nette`;
  }

  const diffCurrent = kpis.diffN !== undefined ? kpis.diffN : (kpis.diff25 || 0);
  if (elEquilibre) {
    const isEquilibre = Math.abs(diffCurrent) < 0.01;
    elEquilibre.textContent = isEquilibre ? 'Conforme 100% ✓' : 'Écart détecté';
    elEquilibre.style.color = isEquilibre ? '#059669' : '#e11d48';
  }
  if (elDiff) {
    elDiff.textContent = `Écart ${yearN} : ${formatFromDA(diffCurrent, true)}`;
  }

  const badgeActif = document.getElementById('badgeTotalActifBadge');
  if (badgeActif) badgeActif.textContent = `Actif Net ${yearN} : ${formatFromDA(valActifNetN, true)}`;

  const badgePassif = document.getElementById('badgeTotalPassifBadge');
  if (badgePassif) badgePassif.textContent = `Passif Total ${yearN} : ${formatFromDA(valPassifN, true)}`;

  // 3. Render ACTIF Table
  const tbodyActif = document.getElementById('bilanActifTableBody');
  if (tbodyActif && data.actif) {
    let htmlActif = '';
    let globalActifIdx = 0;

    const renderActifSection = (title, rows, totalRow) => {
      let sHtml = `
        <tr class="bilan-section-row">
          <td colspan="${hasN1 ? 8 : 6}" style="padding:8px 12px; font-size:13px; letter-spacing:0.3px;">
            ${title}
          </td>
        </tr>
      `;

      rows.forEach(r => {
        globalActifIdx++;
        const idx = globalActifIdx;
        const hasAccounts = r.accounts && r.accounts.length > 0;

        const brutN = r.brutN !== undefined ? r.brutN : r.brut26;
        const amortN = r.amortN !== undefined ? r.amortN : r.amort26;
        const netN = r.netN !== undefined ? r.netN : r.net26;
        const netN1 = r.netN_1 !== undefined ? r.netN_1 : r.net25;

        let strPct = '—';
        if (hasN1 && netN1 !== null && netN1 !== undefined && Math.abs(netN1) > 0) {
          const pct = ((netN - netN1) / Math.abs(netN1)) * 100;
          const sign = pct > 0 ? '+' : '';
          const pctColor = pct >= 0 ? '#059669' : '#e11d48';
          strPct = `<span style="color:${pctColor}; font-weight:600;">${sign}${pct.toFixed(1)}%</span>`;
        }

        let trigger = '';
        if (hasAccounts) {
          trigger = `
            <button class="btn btn-sm btn-outline-secondary bilan-expand-btn" data-count="${r.accounts.length}" data-target="b-act-${idx}" style="font-size:10.5px; padding:2px 6px;">
              ${r.accounts.length} cpt ▾
            </button>
          `;
        }

        if (hasN1) {
          sHtml += `
            <tr class="bilan-item-row">
              <td style="text-align:center;"><span class="font-mono text-muted" style="font-size:11px;">${r.code}</span></td>
              <td><strong>${r.label}</strong></td>
              <td style="text-align:right;" class="font-mono">${formatFromDA(brutN, false)}</td>
              <td style="text-align:right; color:#64748b;" class="font-mono">${formatFromDA(amortN, false)}</td>
              <td style="text-align:right; font-weight:700; color:#0284c7;" class="font-mono">${formatFromDA(netN, false)}</td>
              <td style="text-align:right;" class="font-mono">${netN1 !== null && netN1 !== undefined ? formatFromDA(netN1, false) : '—'}</td>
              <td style="text-align:right;" class="font-mono">${strPct}</td>
              <td style="text-align:center;">${trigger}</td>
            </tr>
          `;
        } else {
          sHtml += `
            <tr class="bilan-item-row">
              <td style="text-align:center;"><span class="font-mono text-muted" style="font-size:11px;">${r.code}</span></td>
              <td><strong>${r.label}</strong></td>
              <td style="text-align:right;" class="font-mono">${formatFromDA(brutN, false)}</td>
              <td style="text-align:right; color:#64748b;" class="font-mono">${formatFromDA(amortN, false)}</td>
              <td style="text-align:right; font-weight:700; color:#0284c7;" class="font-mono">${formatFromDA(netN, false)}</td>
              <td style="text-align:center;">${trigger}</td>
            </tr>
          `;
        }

        if (hasAccounts) {
          r.accounts.forEach(acc => {
            const accN = acc.valN !== undefined ? acc.valN : acc.val26;
            const accN1 = acc.valN_1 !== undefined ? acc.valN_1 : acc.val25;

            if (hasN1) {
              sHtml += `
                <tr class="bilan-account-subrow b-act-${idx}" style="display:none; background-color:#fafafa; font-size:12px; border-left:3px solid #0284c7;">
                  <td style="text-align:center; color:#94a3b8;" class="font-mono">${acc.boal}</td>
                  <td style="padding-left:24px;">
                    <span class="badge badge-slate" style="font-size:10px; margin-right:6px;">SCF ${acc.dz}</span>
                    <span style="color:#334155;">${acc.desc || 'Sans libellé'}</span>
                  </td>
                  <td style="text-align:right;" class="font-mono text-muted">${formatFromDA(accN, false)}</td>
                  <td style="text-align:right; color:#94a3b8;">—</td>
                  <td style="text-align:right;" class="font-mono text-muted">${formatFromDA(accN, false)}</td>
                  <td style="text-align:right;" class="font-mono text-muted">${accN1 !== null && accN1 !== undefined ? formatFromDA(accN1, false) : '—'}</td>
                  <td style="text-align:right; color:#94a3b8;">—</td>
                  <td></td>
                </tr>
              `;
            } else {
              sHtml += `
                <tr class="bilan-account-subrow b-act-${idx}" style="display:none; background-color:#fafafa; font-size:12px; border-left:3px solid #0284c7;">
                  <td style="text-align:center; color:#94a3b8;" class="font-mono">${acc.boal}</td>
                  <td style="padding-left:24px;">
                    <span class="badge badge-slate" style="font-size:10px; margin-right:6px;">SCF ${acc.dz}</span>
                    <span style="color:#334155;">${acc.desc || 'Sans libellé'}</span>
                  </td>
                  <td style="text-align:right;" class="font-mono text-muted">${formatFromDA(accN, false)}</td>
                  <td style="text-align:right; color:#94a3b8;">—</td>
                  <td style="text-align:right;" class="font-mono text-muted">${formatFromDA(accN, false)}</td>
                  <td></td>
                </tr>
              `;
            }
          });
        }
      });

      // Total of section
      if (totalRow) {
        const totBrutN = totalRow.brutN !== undefined ? totalRow.brutN : totalRow.brut26;
        const totAmortN = totalRow.amortN !== undefined ? totalRow.amortN : totalRow.amort26;
        const totNetN = totalRow.netN !== undefined ? totalRow.netN : totalRow.net26;
        const totNetN1 = totalRow.netN_1 !== undefined ? totalRow.netN_1 : totalRow.net25;

        if (hasN1) {
          const pctTot = (totNetN1 && Math.abs(totNetN1) > 0) ? ((totNetN - totNetN1) / Math.abs(totNetN1)) * 100 : 0;
          const signTot = pctTot > 0 ? '+' : '';
          const pctTotColor = pctTot >= 0 ? '#059669' : '#e11d48';

          sHtml += `
            <tr style="background-color:#f8fafc; font-weight:700; border-top:1.5px solid #0284c7; border-bottom:1.5px solid #0284c7;">
              <td style="text-align:center;"><span class="badge badge-sky font-mono">${totalRow.code}</span></td>
              <td><strong>${totalRow.label}</strong></td>
              <td style="text-align:right;" class="font-mono">${formatFromDA(totBrutN, false)}</td>
              <td style="text-align:right; color:#64748b;" class="font-mono">${formatFromDA(totAmortN, false)}</td>
              <td style="text-align:right; color:#0369a1;" class="font-mono">${formatFromDA(totNetN, false)}</td>
              <td style="text-align:right;" class="font-mono">${totNetN1 !== null && totNetN1 !== undefined ? formatFromDA(totNetN1, false) : '—'}</td>
              <td style="text-align:right;" class="font-mono"><span style="color:${pctTotColor}; font-weight:700;">${signTot}${pctTot.toFixed(1)}%</span></td>
              <td></td>
            </tr>
          `;
        } else {
          sHtml += `
            <tr style="background-color:#f8fafc; font-weight:700; border-top:1.5px solid #0284c7; border-bottom:1.5px solid #0284c7;">
              <td style="text-align:center;"><span class="badge badge-sky font-mono">${totalRow.code}</span></td>
              <td><strong>${totalRow.label}</strong></td>
              <td style="text-align:right;" class="font-mono">${formatFromDA(totBrutN, false)}</td>
              <td style="text-align:right; color:#64748b;" class="font-mono">${formatFromDA(totAmortN, false)}</td>
              <td style="text-align:right; color:#0369a1;" class="font-mono">${formatFromDA(totNetN, false)}</td>
              <td></td>
            </tr>
          `;
        }
      }

      return sHtml;
    };

    htmlActif += renderActifSection('ACTIFS NON COURANTS (Immobilisations & Actifs à Long Terme)', data.actif.nonCourant, data.actif.totalNonCourant);
    htmlActif += renderActifSection('ACTIFS COURANTS (Stocks, Créances, Trésorerie & Emplois Assimilés)', data.actif.courant, data.actif.totalCourant);

    // Grand Total Actif
    const totG = data.actif.totalGeneral;
    const gBrutN = totG.brutN !== undefined ? totG.brutN : totG.brut26;
    const gAmortN = totG.amortN !== undefined ? totG.amortN : totG.amort26;
    const gNetN = totG.netN !== undefined ? totG.netN : totG.net26;
    const gNetN1 = totG.netN_1 !== undefined ? totG.netN_1 : totG.net25;

    if (hasN1) {
      const pctG = (gNetN1 && Math.abs(gNetN1) > 0) ? ((gNetN - gNetN1) / Math.abs(gNetN1)) * 100 : 0;
      const signG = pctG > 0 ? '+' : '';
      const pctGColor = pctG >= 0 ? '#059669' : '#e11d48';

      htmlActif += `
        <tr class="bilan-grand-total-row">
          <td style="text-align:center;"><span class="badge badge-purple font-mono" style="font-weight:700;">TOTAL</span></td>
          <td>${totG.label}</td>
          <td style="text-align:right;" class="font-mono">${formatFromDA(gBrutN, false)}</td>
          <td style="text-align:right;" class="font-mono">${formatFromDA(gAmortN, false)}</td>
          <td style="text-align:right;" class="font-mono">${formatFromDA(gNetN, false)}</td>
          <td style="text-align:right;" class="font-mono">${gNetN1 !== null && gNetN1 !== undefined ? formatFromDA(gNetN1, false) : '—'}</td>
          <td style="text-align:right;" class="font-mono"><span style="color:${pctGColor};">${signG}${pctG.toFixed(1)}%</span></td>
          <td></td>
        </tr>
      `;
    } else {
      htmlActif += `
        <tr class="bilan-grand-total-row">
          <td style="text-align:center;"><span class="badge badge-purple font-mono" style="font-weight:700;">TOTAL</span></td>
          <td>${totG.label}</td>
          <td style="text-align:right;" class="font-mono">${formatFromDA(gBrutN, false)}</td>
          <td style="text-align:right;" class="font-mono">${formatFromDA(gAmortN, false)}</td>
          <td style="text-align:right;" class="font-mono">${formatFromDA(gNetN, false)}</td>
          <td></td>
        </tr>
      `;
    }

    tbodyActif.innerHTML = htmlActif;
  }

  // 4. Render PASSIF Table
  const tbodyPassif = document.getElementById('bilanPassifTableBody');
  if (tbodyPassif && data.passif) {
    let htmlPassif = '';
    let globalPassifIdx = 0;

    const renderPassifSection = (title, rows, totalRow, borderColor = '#16a34a', badgeClass = 'badge-emerald') => {
      let sHtml = `
        <tr class="bilan-section-row">
          <td colspan="${hasN1 ? 6 : 4}" style="padding:8px 12px; font-size:13px; letter-spacing:0.3px;">
            ${title}
          </td>
        </tr>
      `;

      rows.forEach(r => {
        globalPassifIdx++;
        const idx = globalPassifIdx;
        const hasAccounts = r.accounts && r.accounts.length > 0;

        const montantN = r.montantN !== undefined ? r.montantN : (r.netN !== undefined ? r.netN : r.net26);
        const montantN1 = r.montantN_1 !== undefined ? r.montantN_1 : (r.netN_1 !== undefined ? r.netN_1 : r.net25);

        let strPct = '—';
        if (hasN1 && montantN1 !== null && montantN1 !== undefined && Math.abs(montantN1) > 0) {
          const pct = ((montantN - montantN1) / Math.abs(montantN1)) * 100;
          const sign = pct > 0 ? '+' : '';
          const pctColor = pct >= 0 ? '#059669' : '#e11d48';
          strPct = `<span style="color:${pctColor}; font-weight:600;">${sign}${pct.toFixed(1)}%</span>`;
        }

        let trigger = '';
        if (hasAccounts) {
          trigger = `
            <button class="btn btn-sm btn-outline-secondary bilan-expand-btn" data-count="${r.accounts.length}" data-target="b-pas-${idx}" style="font-size:10.5px; padding:2px 6px;">
              ${r.accounts.length} cpt ▾
            </button>
          `;
        }

        if (hasN1) {
          sHtml += `
            <tr class="bilan-item-row">
              <td style="text-align:center;"><span class="font-mono text-muted" style="font-size:11px;">${r.code}</span></td>
              <td><strong>${r.label}</strong></td>
              <td style="text-align:right; font-weight:700; color:#15803d;" class="font-mono">${formatFromDA(montantN, false)}</td>
              <td style="text-align:right;" class="font-mono">${montantN1 !== null && montantN1 !== undefined ? formatFromDA(montantN1, false) : '—'}</td>
              <td style="text-align:right;" class="font-mono">${strPct}</td>
              <td style="text-align:center;">${trigger}</td>
            </tr>
          `;
        } else {
          sHtml += `
            <tr class="bilan-item-row">
              <td style="text-align:center;"><span class="font-mono text-muted" style="font-size:11px;">${r.code}</span></td>
              <td><strong>${r.label}</strong></td>
              <td style="text-align:right; font-weight:700; color:#15803d;" class="font-mono">${formatFromDA(montantN, false)}</td>
              <td style="text-align:center;">${trigger}</td>
            </tr>
          `;
        }

        if (hasAccounts) {
          r.accounts.forEach(acc => {
            const accN = acc.valN !== undefined ? acc.valN : acc.val26;
            const accN1 = acc.valN_1 !== undefined ? acc.valN_1 : acc.val25;

            if (hasN1) {
              sHtml += `
                <tr class="bilan-account-subrow b-pas-${idx}" style="display:none; background-color:#fafafa; font-size:12px; border-left:3px solid #16a34a;">
                  <td style="text-align:center; color:#94a3b8;" class="font-mono">${acc.boal}</td>
                  <td style="padding-left:24px;">
                    <span class="badge badge-slate" style="font-size:10px; margin-right:6px;">SCF ${acc.dz}</span>
                    <span style="color:#334155;">${acc.desc || 'Sans libellé'}</span>
                  </td>
                  <td style="text-align:right;" class="font-mono text-muted">${formatFromDA(accN, false)}</td>
                  <td style="text-align:right;" class="font-mono text-muted">${accN1 !== null && accN1 !== undefined ? formatFromDA(accN1, false) : '—'}</td>
                  <td style="text-align:right; color:#94a3b8;">—</td>
                  <td></td>
                </tr>
              `;
            } else {
              sHtml += `
                <tr class="bilan-account-subrow b-pas-${idx}" style="display:none; background-color:#fafafa; font-size:12px; border-left:3px solid #16a34a;">
                  <td style="text-align:center; color:#94a3b8;" class="font-mono">${acc.boal}</td>
                  <td style="padding-left:24px;">
                    <span class="badge badge-slate" style="font-size:10px; margin-right:6px;">SCF ${acc.dz}</span>
                    <span style="color:#334155;">${acc.desc || 'Sans libellé'}</span>
                  </td>
                  <td style="text-align:right;" class="font-mono text-muted">${formatFromDA(accN, false)}</td>
                  <td></td>
                </tr>
              `;
            }
          });
        }
      });

      // Total of section
      if (totalRow) {
        const totMontantN = totalRow.montantN !== undefined ? totalRow.montantN : totalRow.net26;
        const totMontantN1 = totalRow.montantN_1 !== undefined ? totalRow.montantN_1 : totalRow.net25;

        if (hasN1) {
          const pctTot = (totMontantN1 && Math.abs(totMontantN1) > 0) ? ((totMontantN - totMontantN1) / Math.abs(totMontantN1)) * 100 : 0;
          const signTot = pctTot > 0 ? '+' : '';
          const pctTotColor = pctTot >= 0 ? '#059669' : '#e11d48';

          sHtml += `
            <tr style="background-color:#f0fdf4; font-weight:700; border-top:1.5px solid ${borderColor}; border-bottom:1.5px solid ${borderColor};">
              <td style="text-align:center;"><span class="badge ${badgeClass} font-mono">${totalRow.code}</span></td>
              <td><strong>${totalRow.label}</strong></td>
              <td style="text-align:right; color:#15803d;" class="font-mono">${formatFromDA(totMontantN, false)}</td>
              <td style="text-align:right;" class="font-mono">${totMontantN1 !== null && totMontantN1 !== undefined ? formatFromDA(totMontantN1, false) : '—'}</td>
              <td style="text-align:right;" class="font-mono"><span style="color:${pctTotColor}; font-weight:700;">${signTot}${pctTot.toFixed(1)}%</span></td>
              <td></td>
            </tr>
          `;
        } else {
          sHtml += `
            <tr style="background-color:#f0fdf4; font-weight:700; border-top:1.5px solid ${borderColor}; border-bottom:1.5px solid ${borderColor};">
              <td style="text-align:center;"><span class="badge ${badgeClass} font-mono">${totalRow.code}</span></td>
              <td><strong>${totalRow.label}</strong></td>
              <td style="text-align:right; color:#15803d;" class="font-mono">${formatFromDA(totMontantN, false)}</td>
              <td></td>
            </tr>
          `;
        }
      }

      return sHtml;
    };

    htmlPassif += renderPassifSection('I. CAPITAUX PROPRES (Fonds Propres & Résultat Net)', data.passif.capitauxPropres, data.passif.totalCapitauxPropres, '#16a34a', 'badge-emerald');
    htmlPassif += renderPassifSection('II. PASSIFS NON COURANTS (Provisions à Long Terme)', data.passif.nonCourant, data.passif.totalNonCourant, '#0ea5e9', 'badge-sky');
    htmlPassif += renderPassifSection('III. PASSIFS COURANTS (Fournisseurs, Dettes Fiscales, Sociales & Avances Clients)', data.passif.courant, data.passif.totalCourant, '#8b5cf6', 'badge-purple');

    // Grand Total Passif
    const totGP = data.passif.totalGeneral;
    const gpMontantN = totGP.montantN !== undefined ? totGP.montantN : totGP.net26;
    const gpMontantN1 = totGP.montantN_1 !== undefined ? totGP.montantN_1 : totGP.net25;

    if (hasN1) {
      const pctGP = (gpMontantN1 && Math.abs(gpMontantN1) > 0) ? ((gpMontantN - gpMontantN1) / Math.abs(gpMontantN1)) * 100 : 0;
      const signGP = pctGP > 0 ? '+' : '';
      const pctGPColor = pctGP >= 0 ? '#059669' : '#e11d48';

      htmlPassif += `
        <tr style="background-color:#f0fdf4; font-weight:800; border-top:2.5px solid #16a34a; border-bottom:3px double #15803d; font-size:13.5px; color:#15803d;">
          <td style="text-align:center;"><span class="badge badge-emerald font-mono" style="font-weight:700;">TOTAL</span></td>
          <td>${totGP.label}</td>
          <td style="text-align:right;" class="font-mono">${formatFromDA(gpMontantN, false)}</td>
          <td style="text-align:right;" class="font-mono">${gpMontantN1 !== null && gpMontantN1 !== undefined ? formatFromDA(gpMontantN1, false) : '—'}</td>
          <td style="text-align:right;" class="font-mono"><span style="color:${pctGPColor};">${signGP}${pctGP.toFixed(1)}%</span></td>
          <td></td>
        </tr>
      `;
    } else {
      htmlPassif += `
        <tr style="background-color:#f0fdf4; font-weight:800; border-top:2.5px solid #16a34a; border-bottom:3px double #15803d; font-size:13.5px; color:#15803d;">
          <td style="text-align:center;"><span class="badge badge-emerald font-mono" style="font-weight:700;">TOTAL</span></td>
          <td>${totGP.label}</td>
          <td style="text-align:right;" class="font-mono">${formatFromDA(gpMontantN, false)}</td>
          <td></td>
        </tr>
      `;
    }

    tbodyPassif.innerHTML = htmlPassif;
  }

  // 5. Attach individual expand triggers across both tables
  document.querySelectorAll('.bilan-expand-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetClass = btn.getAttribute('data-target');
      const count = btn.getAttribute('data-count') || '';
      const rows = document.querySelectorAll(`.${targetClass}`);
      const isVisible = rows.length > 0 && rows[0].style.display !== 'none';
      rows.forEach(r => r.style.display = isVisible ? 'none' : 'table-row');
      btn.textContent = isVisible ? `${count} cpt ▾` : `${count} cpt ▴`;
    });
  });
}

// ==========================================================================
// 8b. TABLEAU DES FLUX DE TRÉSORERIE (TFT — SCF ALGÉRIE MÉTHODE DIRECTE)
// ==========================================================================
let currentTFTMode = 'monthly'; // 'monthly' (Grille 12 mois style Excel) or 'comparative' (N vs N-1)
let currentTFTSection = 'all';

/**
 * Enables smooth grab-and-swipe horizontal scrolling across any table container
 * Emulates native horizontal scrollbar grabbing anywhere inside the table body/header.
 */
function enableDragToScroll(container) {
  if (!container || container._hasDragToScroll) return;
  container._hasDragToScroll = true;

  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let velX = 0;
  let lastX = 0;
  let momentumId = null;
  let hasMoved = false;

  const cancelMomentum = () => {
    if (momentumId) {
      cancelAnimationFrame(momentumId);
      momentumId = null;
    }
  };

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Left mouse button only
    if (e.target.closest('button, select, input, a, textarea')) return;

    cancelMomentum();
    isDown = true;
    hasMoved = false;
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
    lastX = e.pageX;
    velX = 0;
  });

  window.addEventListener('mouseup', () => {
    if (!isDown) return;
    isDown = false;
    container.classList.remove('is-dragging');

    // Smooth inertia glide on fast release / swipe flick
    if (Math.abs(velX) > 2) {
      const stepMomentum = () => {
        velX *= 0.92;
        container.scrollLeft -= velX;
        if (Math.abs(velX) > 0.5) {
          momentumId = requestAnimationFrame(stepMomentum);
        } else {
          momentumId = null;
        }
      };
      momentumId = requestAnimationFrame(stepMomentum);
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.35; // Responsive scroll multiplier

    if (Math.abs(x - startX) > 4) {
      if (!hasMoved) {
        hasMoved = true;
        container.classList.add('is-dragging');
      }
      e.preventDefault();
      container.scrollLeft = scrollLeft - walk;
      velX = e.pageX - lastX;
      lastX = e.pageX;
    }
  });

  // Touch swipe support (Tablets / Laptops with touchscreen)
  let touchStartX = 0;
  let touchScrollLeft = 0;

  container.addEventListener('touchstart', (e) => {
    cancelMomentum();
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].pageX;
      touchScrollLeft = container.scrollLeft;
    }
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      const deltaX = (e.touches[0].pageX - touchStartX) * 1.25;
      container.scrollLeft = touchScrollLeft - deltaX;
    }
  }, { passive: true });
}

function initTFTControls() {
  const btnRefresh = document.getElementById('btnRefreshTFT');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadTFTPage(true);
    });
  }

  // Initialize grab-and-swipe horizontal scrolling
  const gridContainer = document.getElementById('tftGridContainer');
  if (gridContainer) {
    enableDragToScroll(gridContainer);
  }

  // Segmented Mode Controls (Grille 12 Mois vs Comparatif Annuel vs Graphiques)
  const btnMonthly = document.getElementById('btnTftModeMonthly');
  const btnComparative = document.getElementById('btnTftModeComparative');
  const btnCharts = document.getElementById('btnTftModeCharts');

  if (btnMonthly) {
    btnMonthly.addEventListener('click', () => {
      currentTFTMode = 'monthly';
      btnMonthly.classList.add('active');
      if (btnComparative) btnComparative.classList.remove('active');
      if (btnCharts) btnCharts.classList.remove('active');
      switchTFTViewMode();
      if (AppState.tftData) renderTFTTable(AppState.tftData);
    });
  }

  if (btnComparative) {
    btnComparative.addEventListener('click', () => {
      currentTFTMode = 'comparative';
      btnComparative.classList.add('active');
      if (btnMonthly) btnMonthly.classList.remove('active');
      if (btnCharts) btnCharts.classList.remove('active');
      switchTFTViewMode();
      if (AppState.tftData) renderTFTTable(AppState.tftData);
    });
  }

  if (btnCharts) {
    btnCharts.addEventListener('click', () => {
      currentTFTMode = 'charts';
      btnCharts.classList.add('active');
      if (btnMonthly) btnMonthly.classList.remove('active');
      if (btnComparative) btnComparative.classList.remove('active');
      switchTFTViewMode();
      if (AppState.tftData) {
        renderTFTCharts(AppState.tftData);
      } else {
        loadTFTPage();
      }
    });
  }
}

function switchTFTViewMode() {
  const tableCard = document.getElementById('tftTableCard');
  const chartsContainer = document.getElementById('tftChartsContainer');

  if (currentTFTMode === 'charts') {
    if (tableCard) tableCard.style.display = 'none';
    if (chartsContainer) chartsContainer.style.display = 'block';
    setTimeout(() => {
      Object.values(tftChartInstances).forEach(c => {
        if (c && typeof c.resize === 'function') c.resize();
      });
    }, 60);
  } else {
    if (tableCard) tableCard.style.display = 'block';
    if (chartsContainer) chartsContainer.style.display = 'none';
  }
}

function applyTFTSectionFilter() {
  const rows = document.querySelectorAll('.tft-row');
  rows.forEach(r => {
    const sec = r.getAttribute('data-section');
    if (currentTFTSection === 'all' || sec === currentTFTSection) {
      r.style.display = 'table-row';
    } else {
      r.style.display = 'none';
    }
  });
}

let tftChartInstances = {
  trajectory: null,
  opBreakdown: null,
  cashEvolution: null,
  structureABC: null
};

/**
 * Instantly calculates and populates executive treasury health diagnostic insights
 * Fully independent of Chart.js - executes synchronously with 0ms delay.
 */
function updateTFTHealthInsights(data) {
  if (!data) return;

  const rows = data.rows || [];
  const findRow = (note) => rows.find(r => String(r.note) === String(note));

  const row401 = findRow('401');
  const row402 = findRow('402');
  const row403 = findRow('403');
  const row404 = findRow('404');
  const row405 = findRow('405');
  const row408 = findRow('408');
  const row416 = findRow('416');
  const row422 = findRow('422');
  const row424 = findRow('424');
  const row425 = findRow('425');
  const row426 = findRow('426');

  const getMonths = (row, isAbs = false) => {
    if (!row || !Array.isArray(row.months)) return new Array(12).fill(0);
    return row.months.map(v => {
      const n = Number(v) || 0;
      return isAbs ? Math.abs(n) : n;
    });
  };

  const monthlyInflows = getMonths(row401).map(v => Math.max(0, v));
  const monthlySuppliers = getMonths(row402, true);
  const monthlySalaries = getMonths(row403, true);
  const monthlyFinance = getMonths(row404, true);
  const monthlyTaxes = getMonths(row405, true);

  const monthlyOutflows = monthlySuppliers.map((s, i) => s + monthlySalaries[i] + monthlyTaxes[i] + monthlyFinance[i]);
  const monthlyNetOp = getMonths(row408);
  const monthlyCashClose = getMonths(row426);

  const totInflow = row401 ? (row401.tot || row401.valN || 0) : monthlyInflows.reduce((a, b) => a + b, 0);
  const totSuppliers = row402 ? Math.abs(row402.tot || row402.valN || 0) : monthlySuppliers.reduce((a, b) => a + b, 0);
  const totSalaries = row403 ? Math.abs(row403.tot || row403.valN || 0) : monthlySalaries.reduce((a, b) => a + b, 0);
  const totTaxes = row405 ? Math.abs(row405.tot || row405.valN || 0) : monthlyTaxes.reduce((a, b) => a + b, 0);
  const totFinance = row404 ? Math.abs(row404.tot || row404.valN || 0) : monthlyFinance.reduce((a, b) => a + b, 0);
  const totOutflow = totSuppliers + totSalaries + totTaxes + totFinance;

  const tresoOuv = data.kpis ? (data.kpis.tresoOuv425 || 0) : (row425 ? (row425.tot || 0) : 0);
  const tresoClot = data.kpis ? (data.kpis.tresoClot426 || 0) : (row426 ? (row426.tot || 0) : 0);
  const varNet = data.kpis ? (data.kpis.varNet424 || 0) : (row424 ? (row424.tot || 0) : 0);

  // Runway & Health indicators
  const activeMonthsOutflows = monthlyOutflows.filter(v => v > 0);
  const avgMonthlyOutflow = activeMonthsOutflows.length > 0
    ? activeMonthsOutflows.reduce((a, b) => a + b, 0) / activeMonthsOutflows.length
    : (totOutflow / 12);
  const runwayMonths = avgMonthlyOutflow > 0 ? (tresoClot / avgMonthlyOutflow) : 0;
  const coverageRatio = totSuppliers > 0 ? (totInflow / totSuppliers) * 100 : 0;
  const fixedCostWeight = totOutflow > 0 ? ((totSalaries + totTaxes) / totOutflow) * 100 : 0;

  let bestMonthIdx = 0;
  let maxNetOp = -Infinity;
  monthlyNetOp.forEach((val, idx) => {
    if (val > maxNetOp && (monthlyInflows[idx] > 0 || monthlyOutflows[idx] > 0)) {
      maxNetOp = val;
      bestMonthIdx = idx;
    }
  });

  const MONTH_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const bestMonthName = MONTH_FULL[bestMonthIdx] || 'Septembre';
  const bestMonthInflow = monthlyInflows[bestMonthIdx] || 0;
  const bestMonthNet = monthlyNetOp[bestMonthIdx] || 0;

  // 1. Update KPI Highlights Banner
  const elRatio = document.getElementById('chartStatRatioRecPay');
  if (elRatio) {
    elRatio.textContent = coverageRatio > 0 ? `${coverageRatio.toFixed(1)} %` : '—';
  }

  const elWeightSalaries = document.getElementById('chartStatWeightSalaries');
  if (elWeightSalaries) {
    const weightSal = totOutflow > 0 ? (totSalaries / totOutflow) * 100 : 0;
    elWeightSalaries.textContent = weightSal > 0 ? `${weightSal.toFixed(1)} %` : '—';
  }

  const elAvgInflow = document.getElementById('chartStatAvgInflow');
  if (elAvgInflow) {
    const activeInflows = monthlyInflows.filter(v => v > 0);
    const avg = activeInflows.length > 0 ? totInflow / activeInflows.length : (totInflow / 12);
    elAvgInflow.textContent = formatFromDA(avg, true);
  }

  const elMinCash = document.getElementById('chartStatMinCash');
  if (elMinCash) {
    const nonZeroCash = monthlyCashClose.filter(v => Math.abs(v) > 0);
    const minC = nonZeroCash.length > 0 ? Math.min(...nonZeroCash) : tresoClot;
    elMinCash.textContent = formatFromDA(minC, true);
  }

  // 2. Update Badges
  const badgeAutonomie = document.getElementById('badgeInsightAutonomie');
  if (badgeAutonomie) {
    const healthBadge = runwayMonths >= 3 ? '🟢 Santé Solide' : (runwayMonths >= 2 ? '🟡 Vigilance' : '🔴 Tension');
    badgeAutonomie.textContent = `Autonomie : ${runwayMonths.toFixed(1)} Mois • ${healthBadge}`;
    badgeAutonomie.className = runwayMonths >= 3 ? 'badge badge-emerald' : (runwayMonths >= 2 ? 'badge badge-amber' : 'badge badge-rose');
  }

  const badgeEquilibre = document.getElementById('badgeInsightEquilibre');
  if (badgeEquilibre) {
    const isEq = data.kpis ? (data.kpis.equilibre || Math.abs(data.kpis.diffEquilibre || 0) < 1.0) : true;
    badgeEquilibre.innerHTML = isEq ? 'Équilibre Bilan : 0,00 DA ✓' : `Écart constaté : ${formatFromDA(data.kpis.diffEquilibre, true)}`;
    badgeEquilibre.className = isEq ? 'badge badge-emerald' : 'badge badge-rose';
  }

  const badgeSafety = document.getElementById('badgeChartSafetyStatus');
  if (badgeSafety) {
    badgeSafety.textContent = runwayMonths >= 3
      ? `Zone Sécurité Optimale • Runway : ${runwayMonths.toFixed(1)} Mois`
      : `Zone Vigilance • Runway : ${runwayMonths.toFixed(1)} Mois`;
    badgeSafety.className = runwayMonths >= 3 ? 'badge badge-emerald' : 'badge badge-amber';
  }

  const badgeCov = document.getElementById('badgeChartCoverageRatio');
  if (badgeCov) {
    badgeCov.textContent = `Couverture : ${coverageRatio.toFixed(1)} %`;
    badgeCov.className = coverageRatio >= 85 ? 'badge badge-sky' : 'badge badge-amber';
  }

  const badgeRigid = document.getElementById('badgeChartRigidityWeight');
  if (badgeRigid) {
    badgeRigid.textContent = `Engagements Fixes : ${fixedCostWeight.toFixed(1)} %`;
  }

  // 3. Update Executive Insights Diagnostic Texts
  const elInsightLiq = document.getElementById('insightTextLiquidite');
  if (elInsightLiq) {
    const yearN = data.yearN || AppState.selectedYear || '2026';
    const varSign = varNet >= 0 ? '+' : '';
    const safetyFloor = avgMonthlyOutflow * 3;
    const isAboveFloor = tresoClot >= safetyFloor;
    const bufferStatus = isAboveFloor ? '🟢 <strong>Santé Financière Excellente (Matelas Prudentiel Conforme)</strong>' : '🟡 <strong>Situation Prudentielle Sous Surveillance</strong>';
    elInsightLiq.innerHTML = `
      ${bufferStatus} : Au terme de l'exercice <strong>${yearN}</strong>, la trésorerie globale disponible s'élève à <strong>${formatFromDA(tresoClot, true)}</strong> (comptes bancaires BEA/BDL et caisse).
      Ce niveau de liquidité assure un matelas de sécurité de <strong>${runwayMonths.toFixed(1)} mois</strong> de décaissements opérationnels complets, restant confortablement supérieur au seuil prudentiel recommandé de 3 mois (<strong>${formatFromDA(safetyFloor, true)}</strong>).
      La variation globale nette s'établit à <strong>${varSign}${formatFromDA(varNet, true)}</strong>, partant d'une trésorerie d'ouverture de <strong>${formatFromDA(tresoOuv, true)}</strong>.
    `;
  }

  const elInsightOp = document.getElementById('insightTextOperationnel');
  if (elInsightOp) {
    const opStatus = bestMonthNet > 0 ? '🟢 <strong>Génération Opérationnelle Réactivée</strong>' : '🟡 <strong>Consommation BFR</strong>';
    elInsightOp.innerHTML = `
      ${opStatus} : Les encaissements clients (Note 401) totalisent <strong>${formatFromDA(totInflow, true)}</strong> sur l'exercice, assurant un taux de couverture de <strong>${coverageRatio.toFixed(1)} %</strong> des règlements fournisseurs d'exploitation.
      Le mois le plus performant en génération nette est <strong>${bestMonthName}</strong> (+${formatFromDA(bestMonthNet, true)} de flux net d'exploitation), porté par un pic de recouvrement de <strong>${formatFromDA(bestMonthInflow, true)}</strong> qui a permis de reconstituer les réserves de trésorerie après le creux du premier semestre.
    `;
  }

  const elInsightStruct = document.getElementById('insightTextStructure');
  if (elInsightStruct) {
    const partSuppliers = totOutflow > 0 ? ((totSuppliers / totOutflow) * 100).toFixed(1) : '0';
    const partSalaries = totOutflow > 0 ? ((totSalaries / totOutflow) * 100).toFixed(1) : '0';
    const fluxFinVal = Math.abs(data.kpis ? (data.kpis.fluxFinC || 0) : (row422 ? (row422.tot || 0) : 0));
    elInsightStruct.innerHTML = `
      <strong>Vulnérabilité & Degré de Rigidité</strong> : Les règlements fournisseurs représentent <strong>${partSuppliers} %</strong> des sorties d'exploitation (<strong>${formatFromDA(totSuppliers, true)}</strong>), constituant la part modulable du BFR.
      La part incompressible (masse salariale Note 403, échéance régulière du 13 au 15 de chaque mois, et cotisations sociales) absorbe <strong>${partSalaries} %</strong> des sorties (<strong>${formatFromDA(totSalaries, true)}</strong>).
      Les flux de financement (C) enregistrent des décaissements nets de <strong>-${formatFromDA(fluxFinVal, true)}</strong> (dividendes & variations de change).
    `;
  }
}

/**
 * Renders the 4 executive-grade Treasury Health charts using Chart.js
 */
function renderTFTCharts(data) {
  if (!data) return;

  // 1. Immediately populate text insights and KPIs (0ms latency)
  updateTFTHealthInsights(data);

  // 2. Check Chart.js availability
  const ChartLib = (typeof Chart !== 'undefined' ? Chart : (window.Chart || null));
  if (!ChartLib) {
    console.warn('[TFT] Chart.js library is loading, insights updated.');
    return;
  }

  const rows = data.rows || [];
  const findRow = (note) => rows.find(r => String(r.note) === String(note));

  const row401 = findRow('401');
  const row402 = findRow('402');
  const row403 = findRow('403');
  const row404 = findRow('404');
  const row405 = findRow('405');
  const row408 = findRow('408');
  const row416 = findRow('416');
  const row422 = findRow('422');
  const row424 = findRow('424');
  const row425 = findRow('425');
  const row426 = findRow('426');

  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

  const getMonths = (row, isAbs = false) => {
    if (!row || !Array.isArray(row.months)) return new Array(12).fill(0);
    return row.months.map(v => {
      const n = Number(v) || 0;
      return isAbs ? Math.abs(n) : n;
    });
  };

  const monthlyInflows = getMonths(row401).map(v => Math.max(0, v));
  const monthlySuppliers = getMonths(row402, true);
  const monthlySalaries = getMonths(row403, true);
  const monthlyFinance = getMonths(row404, true);
  const monthlyTaxes = getMonths(row405, true);

  const monthlyOutflows = monthlySuppliers.map((s, i) => s + monthlySalaries[i] + monthlyTaxes[i] + monthlyFinance[i]);
  const monthlyNetOp = getMonths(row408);
  const monthlyNetInv = getMonths(row416);
  const monthlyNetFin = getMonths(row422);
  const monthlyNetVar = getMonths(row424);
  const monthlyCashOpen = getMonths(row425);
  const monthlyCashClose = getMonths(row426);

  const totSuppliers = row402 ? Math.abs(row402.tot || row402.valN || 0) : monthlySuppliers.reduce((a, b) => a + b, 0);
  const totSalaries = row403 ? Math.abs(row403.tot || row403.valN || 0) : monthlySalaries.reduce((a, b) => a + b, 0);
  const totTaxes = row405 ? Math.abs(row405.tot || row405.valN || 0) : monthlyTaxes.reduce((a, b) => a + b, 0);
  const totFinance = row404 ? Math.abs(row404.tot || row404.valN || 0) : monthlyFinance.reduce((a, b) => a + b, 0);
  const totOutflow = totSuppliers + totSalaries + totTaxes + totFinance;

  const activeMonthsOutflows = monthlyOutflows.filter(v => v > 0);
  const avgMonthlyOutflow = activeMonthsOutflows.length > 0
    ? activeMonthsOutflows.reduce((a, b) => a + b, 0) / activeMonthsOutflows.length
    : (totOutflow / 12);

  // Unit converter
  const conv = (v) => {
    if (AppState.unit === 'MDA') return (v / 1000000);
    if (AppState.unit === 'KDA') return (v / 1000);
    return v;
  };

  const unitLabel = AppState.unit || 'DA';

  const tooltipCallback = {
    label: function (context) {
      let val = context.raw;
      let label = context.dataset.label || '';
      return ` ${label} : ${formatFromDA(AppState.unit === 'KDA' ? val * 1000 : (AppState.unit === 'MDA' ? val * 1000000 : val), true)}`;
    }
  };

  // --- CHART 1: TREASURY SOLVENCY & SAFETY BUFFER TRAJECTORY (Santé de la Trésorerie) ---
  const ctxCash = document.getElementById('chartTFTCashEvolution');
  if (ctxCash) {
    if (tftChartInstances.cashEvolution) tftChartInstances.cashEvolution.destroy();
    const ctx = ctxCash.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(5, 150, 105, 0.28)');
    gradient.addColorStop(1, 'rgba(5, 150, 105, 0.02)');

    const safetyBufferVal = conv(avgMonthlyOutflow * 3); // 3-month safety floor
    const alertFloorVal = conv(avgMonthlyOutflow * 1.5); // 1.5-month critical floor

    tftChartInstances.cashEvolution = new ChartLib(ctxCash, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Trésorerie Réelle de Clôture (Note 426)',
            data: monthlyCashClose.map(conv),
            borderColor: '#059669',
            backgroundColor: gradient,
            fill: true,
            borderWidth: 3,
            pointBackgroundColor: '#059669',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 4.5,
            tension: 0.25,
            order: 1
          },
          {
            label: 'Seuil Prudentiel de Sécurité (3 Mois de Charges)',
            data: new Array(12).fill(safetyBufferVal),
            borderColor: '#d97706',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 2
          },
          {
            label: 'Seuil d’Alerte Critique (1.5 Mois)',
            data: new Array(12).fill(alertFloorVal),
            borderColor: '#dc2626',
            borderDash: [3, 3],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            order: 3
          },
          {
            label: "Trésorerie d'Ouverture (Note 425)",
            data: monthlyCashOpen.map(conv),
            borderColor: '#64748b',
            borderDash: [4, 4],
            borderWidth: 1.5,
            pointRadius: 2.5,
            tension: 0.25,
            order: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, padding: 10, font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 } }
          },
          tooltip: {
            callbacks: {
              label: tooltipCallback.label,
              afterLabel: function (ctx) {
                if (ctx.datasetIndex === 0) {
                  const val = ctx.raw;
                  const realDA = AppState.unit === 'KDA' ? val * 1000 : (AppState.unit === 'MDA' ? val * 1000000 : val);
                  const rw = avgMonthlyOutflow > 0 ? (realDA / avgMonthlyOutflow) : 0;
                  const zone = rw >= 3 ? '🟢 Zone Saine (Matelas > 3 mois)' : (rw >= 1.5 ? '🟡 Zone Vigilance' : '🔴 Zone Critique');
                  return ` Autonomie de Réserve : ${rw.toFixed(1)} Mois • ${zone}`;
                }
                return '';
              }
            }
          }
        },
        scales: {
          y: {
            title: { display: true, text: `Solde (${unitLabel})`, font: { size: 11, weight: 600 } },
            grid: { color: '#f1f5f9' },
            ticks: { font: { family: 'JetBrains Mono', size: 10 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Plus Jakarta Sans', size: 11 } }
          }
        }
      }
    });
  }

  // --- CHART 2: CASH FLOW GENERATION & COVERAGE (Inflow vs Outflow & Net Op A) ---
  const ctxTraj = document.getElementById('chartTFTMonthlyTrajectory');
  if (ctxTraj) {
    if (tftChartInstances.trajectory) tftChartInstances.trajectory.destroy();

    // Color points according to positive / negative operating flow
    const pointColors = monthlyNetOp.map(v => v >= 0 ? '#059669' : '#e11d48');

    tftChartInstances.trajectory = new ChartLib(ctxTraj, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Encaissements Clients (401)',
            data: monthlyInflows.map(conv),
            backgroundColor: 'rgba(2, 132, 199, 0.85)',
            borderColor: '#0284c7',
            borderWidth: 1,
            borderRadius: 4,
            order: 2
          },
          {
            label: 'Décaissements Opérationnels (402 à 405)',
            data: monthlyOutflows.map(conv),
            backgroundColor: 'rgba(239, 68, 68, 0.78)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 4,
            order: 2
          },
          {
            label: "Flux Net d'Exploitation A (408)",
            data: monthlyNetOp.map(conv),
            type: 'line',
            borderColor: '#059669',
            backgroundColor: '#059669',
            borderWidth: 2.8,
            pointBackgroundColor: pointColors,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 4.5,
            tension: 0.25,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, padding: 10, font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 } }
          },
          tooltip: {
            callbacks: {
              label: tooltipCallback.label,
              afterBody: function (items) {
                if (!items || items.length === 0) return '';
                const mIdx = items[0].dataIndex;
                const inVal = monthlyInflows[mIdx] || 0;
                const outVal = monthlyOutflows[mIdx] || 0;
                const netVal = monthlyNetOp[mIdx] || 0;
                if (outVal > 0) {
                  const cov = ((inVal / outVal) * 100).toFixed(1);
                  const status = netVal >= 0 ? '🟢 Excédent d’Exploitation' : '🔴 Consommation Nette de Cash';
                  return `\n Couverture du mois : ${cov} %\n Statut : ${status}`;
                }
                return '';
              }
            }
          }
        },
        scales: {
          y: {
            title: { display: true, text: `Montant (${unitLabel})`, font: { size: 11, weight: 600 } },
            grid: { color: '#f1f5f9' },
            ticks: { font: { family: 'JetBrains Mono', size: 10 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Plus Jakarta Sans', size: 11 } }
          }
        }
      }
    });
  }

  // --- CHART 3: OUTFLOW RIGIDITY & BREAKDOWN ---
  const ctxOp = document.getElementById('chartTFTOpBreakdown');
  if (ctxOp) {
    if (tftChartInstances.opBreakdown) tftChartInstances.opBreakdown.destroy();

    const pctSuppliers = totOutflow > 0 ? ((totSuppliers / totOutflow) * 100).toFixed(1) : 0;
    const pctSalaries = totOutflow > 0 ? ((totSalaries / totOutflow) * 100).toFixed(1) : 0;
    const pctTaxes = totOutflow > 0 ? ((totTaxes / totOutflow) * 100).toFixed(1) : 0;
    const pctFinance = totOutflow > 0 ? ((totFinance / totOutflow) * 100).toFixed(1) : 0;

    tftChartInstances.opBreakdown = new ChartLib(ctxOp, {
      type: 'doughnut',
      data: {
        labels: [
          `Fournisseurs (402) • ${pctSuppliers}%`,
          `Personnel & CNAS/IRG (403) • ${pctSalaries}%`,
          `Impôts & Taxes (405) • ${pctTaxes}%`,
          `Frais Financiers (404) • ${pctFinance}%`
        ],
        datasets: [{
          data: [conv(totSuppliers), conv(totSalaries), conv(totTaxes), conv(totFinance)],
          backgroundColor: ['#0284c7', '#8b5cf6', '#f59e0b', '#ec4899'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 12, font: { family: 'Plus Jakarta Sans', size: 11, weight: 500 } }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const val = ctx.raw;
                const realDA = AppState.unit === 'KDA' ? val * 1000 : (AppState.unit === 'MDA' ? val * 1000000 : val);
                const pct = totOutflow > 0 ? ((realDA / totOutflow) * 100).toFixed(1) : 0;
                let comment = '';
                if (ctx.dataIndex === 1) comment = ' (Échéance 13-15 du mois • Incompressible)';
                else if (ctx.dataIndex === 0) comment = ' (Modulable selon BFR)';
                return ` ${ctx.label} : ${formatFromDA(realDA, true)} (${pct}%)${comment}`;
              }
            }
          }
        },
        cutout: '62%'
      }
    });
  }

  // --- CHART 4: NET FLOW STRUCTURE BY NATURE (A, B, C) ---
  const ctxABC = document.getElementById('chartTFTStructureABC');
  if (ctxABC) {
    if (tftChartInstances.structureABC) tftChartInstances.structureABC.destroy();
    tftChartInstances.structureABC = new ChartLib(ctxABC, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Exploitation (A)',
            data: monthlyNetOp.map(conv),
            backgroundColor: 'rgba(2, 132, 199, 0.85)',
            borderRadius: 3
          },
          {
            label: 'Investissement (B)',
            data: monthlyNetInv.map(conv),
            backgroundColor: 'rgba(139, 92, 246, 0.85)',
            borderRadius: 3
          },
          {
            label: 'Financement (C)',
            data: monthlyNetFin.map(conv),
            backgroundColor: 'rgba(245, 158, 11, 0.85)',
            borderRadius: 3
          },
          {
            label: 'Variation Nette (424)',
            data: monthlyNetVar.map(conv),
            type: 'line',
            borderColor: '#0f172a',
            borderWidth: 2.2,
            pointRadius: 3.5,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, padding: 10, font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 } }
          },
          tooltip: { callbacks: tooltipCallback }
        },
        scales: {
          y: {
            title: { display: true, text: `Flux Net (${unitLabel})`, font: { size: 11, weight: 600 } },
            grid: { color: '#f1f5f9' },
            ticks: { font: { family: 'JetBrains Mono', size: 10 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Plus Jakarta Sans', size: 11 } }
          }
        }
      }
    });
  }
}

async function loadTFTPage(forceReload = false) {
  const targetYear = AppState.selectedYear || '2025';
  const targetMonth = AppState.selectedMonth || 'ALL';

  if (AppState.tftData && !forceReload && String(AppState.tftData.yearN) === String(targetYear) && String(AppState.tftData.month || 'ALL') === String(targetMonth)) {
    updateTFTHealthInsights(AppState.tftData);
    switchTFTViewMode();
    if (currentTFTMode === 'charts') {
      renderTFTCharts(AppState.tftData);
    } else {
      renderTFTTable(AppState.tftData);
    }
    return;
  }

  const tbody = document.getElementById('tftTableBody');
  const thead = document.getElementById('tftTableHead');
  const monthLabel = targetMonth !== 'ALL' ? ` — ${MONTH_NAMES[targetMonth] || targetMonth}` : '';
  if (tbody) {
    const colSpan = currentTFTMode === 'monthly' ? 15 : 6;
    tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; padding:36px; color:#64748b;">Chargement et calcul du Tableau des Flux de Trésorerie (Exercice ${targetYear}${monthLabel})...</td></tr>`;
  }

  try {
    const monthParam = (targetMonth && targetMonth !== 'ALL') ? `&month=${encodeURIComponent(targetMonth)}` : '';
    const res = await fetch(`/api/tft?year=${encodeURIComponent(targetYear)}${monthParam}`);
    const json = await res.json();
    if (!json.success || !json.tft) {
      throw new Error(json.error || 'Données du TFT indisponibles');
    }

    AppState.tftData = json.tft;
    updateTFTHealthInsights(AppState.tftData);
    switchTFTViewMode();
    if (currentTFTMode === 'charts') {
      renderTFTCharts(AppState.tftData);
    } else {
      renderTFTTable(AppState.tftData);
    }
  } catch (err) {
    console.error('Error loading TFT:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding:36px; color:#e11d48;">Erreur : ${err.message}</td></tr>`;
  }
}

function renderTFTTable(data) {
  if (!data) return;
  updateTFTHealthInsights(data);

  const hasN1 = data.yearN_1 !== null && data.yearN_1 !== undefined;
  const yearN = data.yearN || AppState.selectedYear || '2025';
  const yearN1 = data.yearN_1;
  const selectedMonthNum = (AppState.selectedMonth && AppState.selectedMonth !== 'ALL') ? parseInt(AppState.selectedMonth, 10) : null;
  const monthTag = (selectedMonthNum !== null) ? ` • ${MONTH_NAMES[selectedMonthNum] || selectedMonthNum}` : '';

  // 1. Update Unit Badge & Fiscal Badges
  const badgeUnit = document.getElementById('badgeTFTUnit');
  if (badgeUnit) badgeUnit.textContent = `Unité active : ${AppState.unit}`;

  const badgeFiscal = document.getElementById('badgeTFTFiscalYears');
  if (badgeFiscal) {
    badgeFiscal.innerHTML = hasN1
      ? `<span>Exercice ${yearN} (N) vs ${yearN1} (N-1)${monthTag}</span>`
      : `<span>Exercice ${yearN} (N)${monthTag}</span>`;
  }

  const elHeading = document.getElementById('tftPageHeading');
  if (elHeading) {
    elHeading.textContent = `Tableau des Flux de Trésorerie (TFT — SCF Algérie ${yearN}${monthTag ? ' — ' + monthTag.replace(/^ • /, '') : ''})`;
  }

  const hasAnyData = data.rows && data.rows.some(r => (r.tot && Math.abs(r.tot) > 0) || (r.valN && Math.abs(r.valN) > 0) || (r.valN_1 && Math.abs(r.valN_1) > 0));
  const elSubtitle = document.getElementById('tftHeaderSubtitle');
  if (elSubtitle) {
    if (!hasAnyData) {
      elSubtitle.innerHTML = `<span style="color:#f59e0b; font-weight:600;">⚠️ Aucune donnée disponible — Formules de calcul supprimées (en attente des règles basées sur la Balance).</span>`;
    } else {
      elSubtitle.textContent = `Tableau des Flux de Trésorerie (Méthode Directe SCF Algérie) • Exercice ${yearN}`;
    }
  }

  // 2. Update KPI Cards
  const kpis = data.kpis || {};
  const elFluxOp = document.getElementById('kpiTFTFluxOpA');
  const elFluxOpSub = document.getElementById('kpiTFTFluxOpASub');
  const elFluxInv = document.getElementById('kpiTFTFluxInvB');
  const elFluxInvSub = document.getElementById('kpiTFTFluxInvBSub');
  const elFluxFin = document.getElementById('kpiTFTFluxFinC');
  const elFluxFinSub = document.getElementById('kpiTFTFluxFinCSub');
  const elVarNet = document.getElementById('kpiTFTVarNet');
  const elVarNetSub = document.getElementById('kpiTFTVarNetSub');
  const elCloture = document.getElementById('kpiTFTCloture');
  const elEquilibre = document.getElementById('kpiTFTEquilibreBadge');

  if (elFluxOp) elFluxOp.textContent = formatFromDA(kpis.fluxOpA, true);
  if (elFluxOpSub) elFluxOpSub.textContent = `Note 408 • Flux Net d'Exploitation (${yearN})`;

  if (elFluxInv) elFluxInv.textContent = formatFromDA(kpis.fluxInvB, true);
  if (elFluxInvSub) elFluxInvSub.textContent = `Note 416 • Immobilisations & Cautions (${yearN})`;

  if (elFluxFin) elFluxFin.textContent = formatFromDA(kpis.fluxFinC, true);
  if (elFluxFinSub) elFluxFinSub.textContent = `Note 422 • Dividendes & Trésorerie (${yearN})`;

  if (elVarNet) elVarNet.textContent = formatFromDA(kpis.varNet424, true);
  if (elVarNetSub) elVarNetSub.textContent = `Note 424 • Variation A + B + C (${yearN})`;

  if (elCloture) elCloture.textContent = formatFromDA(kpis.tresoClot426, true);
  if (elEquilibre) {
    if (kpis.equilibre) {
      elEquilibre.className = 'badge badge-emerald';
      elEquilibre.innerHTML = `Équilibré ✓ (0,00 DA)`;
    } else {
      elEquilibre.className = 'badge badge-rose';
      elEquilibre.innerHTML = `Écart : ${formatFromDA(kpis.diffEquilibre, true)}`;
    }
  }

  const elNotice = document.getElementById('tftFooterBalanceNotice');
  if (elNotice) {
    const isEq = kpis.equilibre || Math.abs(kpis.diffEquilibre || 0) < 1.0;
    elNotice.innerHTML = isEq
      ? `Recherche d'équilibre Trésorerie : <strong style="color:#059669;">Conforme SCF (Écart = 0,00 DA) ✓</strong>`
      : `Recherche d'équilibre Trésorerie : <strong style="color:#e11d48;">Écart constaté : ${formatFromDA(kpis.diffEquilibre, true)}</strong>`;
  }

  // 3. Render Table Headers based on Mode
  const thead = document.getElementById('tftTableHead');
  const tbody = document.getElementById('tftTableBody');
  if (!tbody || !thead) return;

  const MONTH_SHORT = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  if (currentTFTMode === 'monthly') {
    // 15-COLUMN MONTHLY GRID (LIKE THE EXCEL FILE)
    let thCols = `
      <tr style="background-color:#0f172a; color:#fff;">
        <th class="tft-sticky-note" style="width:72px; text-align:center;">Note SCF</th>
        <th class="tft-sticky-label" style="min-width:270px;">Flux de Trésorerie (Libellé Officiel SCF)</th>
    `;

    MONTH_SHORT.forEach((mName, idx) => {
      const isSel = (selectedMonthNum !== null && selectedMonthNum === (idx + 1));
      const colClass = isSel ? 'tft-col-month tft-active-col' : 'tft-col-month';
      let statusTag = '';
      if (yearN === '2026') {
        if (idx === 8) {
          statusTag = `<br><span style="font-size:9.5px; font-weight:normal; color:#34d399;">(Clôturé ✓)</span>`;
        } else if (idx < 8) {
          statusTag = `<br><span style="font-size:9.5px; font-weight:normal; color:#94a3b8;">(Clôturé)</span>`;
        } else if (idx === 9) {
          statusTag = `<br><span style="font-size:9.5px; font-weight:normal; color:#fbbf24;">(En cours)</span>`;
        } else {
          statusTag = `<br><span style="font-size:9.5px; font-weight:normal; color:#64748b;">(À venir)</span>`;
        }
      }
      thCols += `<th class="${colClass}" style="min-width:102px; text-align:right;">${mName}${isSel ? ' ★' : ''}${statusTag}</th>`;
    });

    thCols += `
        <th class="tft-col-tot" style="min-width:130px; text-align:right;">Total ${yearN}<br><span class="col-unit" style="font-size:10px; font-weight:normal;">${AppState.unit}</span></th>
      </tr>
    `;
    thead.innerHTML = thCols;

    // RENDER ROWS (12 MONTHS + ANNUAL TOTAL)
    let bodyHtml = '';
    data.rows.forEach(r => {
      const isHeader = r.type === 'header';
      const isTotal = r.type === 'total';
      const isSubtotal = r.type === 'subtotal';
      const isSig = r.type === 'sig' || r.type === 'sig-final';

      if (isHeader) {
        bodyHtml += `
          <tr class="tft-row tft-row-header" data-section="${r.section}">
            <td class="tft-sticky-note" style="text-align:center;"><span class="badge badge-sky font-mono" style="font-weight:700;">${r.note}</span></td>
            <td class="tft-sticky-label"><strong>${r.label}</strong></td>
            <td colspan="13" style="background-color:#0f172a; color:#94a3b8; font-size:11.5px; padding-left:14px;">${r.comment || ''}</td>
          </tr>
        `;
        return;
      }

      let rowClass = `tft-row tft-sec-${r.section}`;
      let badgeClass = 'badge-slate';
      let labelHtml = r.label;

      if (isTotal) {
        rowClass += ' tft-row-total';
        badgeClass = 'badge-purple';
        labelHtml = `<strong>${r.label}</strong>`;
      } else if (isSig) {
        rowClass += ' tft-row-sig';
        badgeClass = 'badge-emerald';
        labelHtml = `<strong>${r.label}</strong>`;
      } else if (isSubtotal) {
        rowClass += ' tft-row-subtotal';
        badgeClass = 'badge-sky';
        labelHtml = `<strong>${r.label}</strong>`;
      } else {
        rowClass += ' tft-row-item';
      }

      let rowCells = `
        <td class="tft-sticky-note" style="text-align:center;"><span class="badge ${badgeClass} font-mono" style="font-weight:700;">${r.note || '—'}</span></td>
        <td class="tft-sticky-label">${labelHtml}</td>
      `;

      // 12 Monthly cells
      const mArr = r.months || Array(12).fill(0);
      for (let m = 0; m < 12; m++) {
        const val = mArr[m];
        const isSel = (selectedMonthNum !== null && selectedMonthNum === (m + 1));
        const cellClass = isSel ? 'tft-col-month tft-active-col' : 'tft-col-month';

        let cellContent = '—';
        let numStyle = '';
        if (val !== null && val !== undefined) {
          if (Math.abs(val) < 0.001) {
            cellContent = '—';
          } else {
            cellContent = formatFromDA(val, false);
            if (val < 0) numStyle = 'color:#e11d48;';
          }
        }

        rowCells += `<td class="${cellClass}" style="${numStyle}">${cellContent}</td>`;
      }

      // 15th Column: Total
      const totVal = (r.tot !== null && r.tot !== undefined) ? r.tot : (r.valN || 0);
      let totContent = '—';
      let totStyle = '';
      if (Math.abs(totVal) > 0.001) {
        totContent = formatFromDA(totVal, false);
        if (totVal < 0) totStyle = 'color:#e11d48;';
      }

      rowCells += `<td class="tft-col-tot" style="${totStyle}">${totContent}</td>`;

      bodyHtml += `<tr class="${rowClass}" data-section="${r.section}">${rowCells}</tr>`;
    });

    tbody.innerHTML = bodyHtml;

  } else {
    // COMPARATIVE VIEW (N vs N-1)
    let theadHtml = `
      <tr style="background-color:#0f172a; color:#fff;">
        <th style="width:72px; text-align:center;">Note SCF</th>
        <th style="min-width:300px;">Flux de Trésorerie (Libellé Officiel SCF)</th>
        <th style="width:160px; text-align:right;">Montant ${yearN} (N)<br><span class="col-unit" style="font-size:10px; font-weight:normal;">${AppState.unit}</span></th>
    `;

    if (hasN1) {
      theadHtml += `
        <th style="width:160px; text-align:right;">Montant ${yearN1} (N-1)<br><span class="col-unit" style="font-size:10px; font-weight:normal;">${AppState.unit}</span></th>
        <th style="width:95px; text-align:right;">Évol. %</th>
      `;
    }

    theadHtml += `
        <th style="min-width:240px; text-align:left;">Observations & Réconciliation</th>
      </tr>
    `;
    thead.innerHTML = theadHtml;

    let bodyHtml = '';
    data.rows.forEach(r => {
      const isHeader = r.type === 'header';
      const isTotal = r.type === 'total';
      const isSubtotal = r.type === 'subtotal';
      const isSig = r.type === 'sig' || r.type === 'sig-final';

      if (isHeader) {
        const colSpan = hasN1 ? 6 : 4;
        bodyHtml += `
          <tr class="tft-row tft-row-header" data-section="${r.section}">
            <td style="text-align:center;"><span class="badge badge-sky font-mono" style="font-weight:700;">${r.note}</span></td>
            <td colspan="${colSpan - 1}" style="padding:10px 14px; letter-spacing:0.3px;">
              <strong>${r.label}</strong>
              <span style="font-size:11px; font-weight:normal; opacity:0.8; margin-left:10px;">${r.comment || ''}</span>
            </td>
          </tr>
        `;
        return;
      }

      let rowClass = `tft-row tft-sec-${r.section}`;
      let badgeClass = 'badge-slate';
      let labelHtml = r.label;

      if (isTotal) {
        rowClass += ' tft-row-total';
        badgeClass = 'badge-purple';
        labelHtml = `<strong>${r.label}</strong>`;
      } else if (isSig) {
        rowClass += ' tft-row-sig';
        badgeClass = 'badge-emerald';
        labelHtml = `<strong>${r.label}</strong>`;
      } else if (isSubtotal) {
        rowClass += ' tft-row-subtotal';
        badgeClass = 'badge-sky';
        labelHtml = `<strong>${r.label}</strong>`;
      } else {
        rowClass += ' tft-row-item';
      }

      const strN = formatFromDA(r.valN, false);
      const strN1 = (r.valN_1 !== null && r.valN_1 !== undefined) ? formatFromDA(r.valN_1, false) : '—';

      let evolHtml = '—';
      if (r.evolPct !== null && r.evolPct !== undefined) {
        const sign = r.evolPct > 0 ? '+' : '';
        const color = r.evolPct >= 0 ? '#059669' : '#e11d48';
        evolHtml = `<span style="color:${color}; font-weight:700;">${sign}${r.evolPct.toFixed(1)}%</span>`;
      }

      const commentHtml = r.comment ? `<span style="font-size:11.5px; color:#64748b;">${r.comment}</span>` : '—';

      if (hasN1) {
        bodyHtml += `
          <tr class="${rowClass}" data-section="${r.section}">
            <td style="text-align:center;"><span class="badge ${badgeClass} font-mono" style="font-weight:700;">${r.note || '—'}</span></td>
            <td>${labelHtml}</td>
            <td style="text-align:right;" class="font-mono"><strong>${strN}</strong></td>
            <td style="text-align:right;" class="font-mono">${strN1}</td>
            <td style="text-align:right;" class="font-mono">${evolHtml}</td>
            <td style="text-align:left;">${commentHtml}</td>
          </tr>
        `;
      } else {
        bodyHtml += `
          <tr class="${rowClass}" data-section="${r.section}">
            <td style="text-align:center;"><span class="badge ${badgeClass} font-mono" style="font-weight:700;">${r.note || '—'}</span></td>
            <td>${labelHtml}</td>
            <td style="text-align:right;" class="font-mono"><strong>${strN}</strong></td>
            <td style="text-align:left;">${commentHtml}</td>
          </tr>
        `;
      }
    });

    tbody.innerHTML = bodyHtml;
  }

  // 4. Re-apply section filter if active
  applyTFTSectionFilter();

  // 5. Ensure drag-to-scroll is active on the container
  enableDragToScroll(document.getElementById('tftGridContainer'));
}

// ==========================================================================
// 8. FBL3N GRAND LIVRE GÉNÉRAL & EXCEL IMPORT ENGINE
// ==========================================================================

const FBL3N_MONTH_NAMES = {
  1: '01 - Janvier',
  2: '02 - Février',
  3: '03 - Mars',
  4: '04 - Avril',
  5: '05 - Mai',
  6: '06 - Juin',
  7: '07 - Juillet',
  8: '08 - Août',
  9: '09 - Septembre',
  10: '10 - Octobre',
  11: '11 - Novembre',
  12: '12 - Décembre'
};

let fbl3nSelectedUploadFile = null;
let fbl3nSearchDebounceTimer = null;

function initFBL3NControls() {
  // Year Filter change
  const yearSelect = document.getElementById('fbl3nFilterYear');
  if (yearSelect) {
    yearSelect.addEventListener('change', (e) => {
      AppState.fbl3nFilters.year = e.target.value;
      if (e.target.value) {
        AppState.selectedYear = e.target.value;
        localStorage.setItem('sensus_year', AppState.selectedYear);
        populateYearSelects();
      }
      updateFBL3NMonthOptions(e.target.value);
      AppState.fbl3nFilters.month = '';
      AppState.fbl3nFilters.page = 1;
      fetchFBL3NData();
    });
  }

  // Month Filter change
  const monthSelect = document.getElementById('fbl3nFilterMonth');
  if (monthSelect) {
    monthSelect.addEventListener('change', (e) => {
      AppState.fbl3nFilters.month = e.target.value;
      AppState.fbl3nFilters.page = 1;
      fetchFBL3NData();
    });
  }

  // Account Filter change
  const accountSelect = document.getElementById('fbl3nFilterAccount');
  if (accountSelect) {
    accountSelect.addEventListener('change', (e) => {
      AppState.fbl3nFilters.account = e.target.value;
      AppState.fbl3nFilters.page = 1;
      fetchFBL3NData();
    });
  }

  // Doc Type Filter change
  const docTypeSelect = document.getElementById('fbl3nFilterDocType');
  if (docTypeSelect) {
    docTypeSelect.addEventListener('change', (e) => {
      AppState.fbl3nFilters.docType = e.target.value;
      AppState.fbl3nFilters.page = 1;
      fetchFBL3NData();
    });
  }

  // Quick Search input
  const searchInput = document.getElementById('fbl3nSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(fbl3nSearchDebounceTimer);
      fbl3nSearchDebounceTimer = setTimeout(() => {
        AppState.fbl3nFilters.search = e.target.value.trim();
        AppState.fbl3nFilters.page = 1;
        fetchFBL3NData();
      }, 400);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(fbl3nSearchDebounceTimer);
        AppState.fbl3nFilters.search = e.target.value.trim();
        AppState.fbl3nFilters.page = 1;
        fetchFBL3NData();
      }
    });
  }

  // Apply filters button
  const btnApply = document.getElementById('btnApplyFbl3nFilters');
  if (btnApply) {
    btnApply.addEventListener('click', () => {
      if (searchInput) AppState.fbl3nFilters.search = searchInput.value.trim();
      AppState.fbl3nFilters.page = 1;
      fetchFBL3NData();
    });
  }

  // Reset filters button
  const btnReset = document.getElementById('btnResetFbl3nFilters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      AppState.fbl3nFilters.year = '';
      AppState.fbl3nFilters.month = '';
      AppState.fbl3nFilters.account = '';
      AppState.fbl3nFilters.docType = '';
      AppState.fbl3nFilters.search = '';
      AppState.fbl3nFilters.page = 1;

      if (yearSelect) yearSelect.value = '';
      updateFBL3NMonthOptions('');
      if (monthSelect) monthSelect.value = '';
      if (accountSelect) accountSelect.value = '';
      if (docTypeSelect) docTypeSelect.value = '';
      if (searchInput) searchInput.value = '';

      fetchFBL3NData();
    });
  }

  // Limit per page select
  const limitSelect = document.getElementById('fbl3nLimitSelect');
  if (limitSelect) {
    limitSelect.addEventListener('change', (e) => {
      AppState.fbl3nFilters.limit = parseInt(e.target.value, 10) || 50;
      AppState.fbl3nFilters.page = 1;
      fetchFBL3NData();
    });
  }

  // Pagination Prev / Next
  const btnPrev = document.getElementById('btnFbl3nPrevPage');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (AppState.fbl3nFilters.page > 1) {
        AppState.fbl3nFilters.page--;
        fetchFBL3NData();
      }
    });
  }

  const btnNext = document.getElementById('btnFbl3nNextPage');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (AppState.fbl3nData && AppState.fbl3nData.stats) {
        const totalPages = Math.ceil(AppState.fbl3nData.stats.totalCount / AppState.fbl3nFilters.limit);
        if (AppState.fbl3nFilters.page < totalPages) {
          AppState.fbl3nFilters.page++;
          fetchFBL3NData();
        }
      }
    });
  }


  // Modal Open/Close
  const modal = document.getElementById('modalFbl3nUpload');
  const btnOpenModal = document.getElementById('btnOpenFbl3nUploadModal');
  const btnCloseModal = document.getElementById('btnCloseFbl3nModal');
  const backdropModal = document.getElementById('modalFbl3nBackdrop');
  const btnCancelUpload = document.getElementById('btnCancelFbl3nUpload');

  const openModal = () => {
    fbl3nSelectedUploadFile = null;
    const nameEl = document.getElementById('fbl3nSelectedFileName');
    if (nameEl) nameEl.textContent = 'Aucun fichier sélectionné';
    const statusEl = document.getElementById('fbl3nUploadStatus');
    if (statusEl) {
      statusEl.style.display = 'none';
      statusEl.textContent = '';
    }
    const fileInput = document.getElementById('fbl3nFileInput');
    if (fileInput) fileInput.value = '';
    if (modal) modal.style.display = 'flex';
  };

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (backdropModal) backdropModal.addEventListener('click', closeModal);
  if (btnCancelUpload) btnCancelUpload.addEventListener('click', closeModal);

  // File Drop Zone & Input
  const dropZone = document.getElementById('fbl3nDropZone');
  const fileInput = document.getElementById('fbl3nFileInput');
  const selectedName = document.getElementById('fbl3nSelectedFileName');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fbl3nSelectedUploadFile = e.dataTransfer.files[0];
        if (selectedName) selectedName.textContent = `Fichier prêt : ${fbl3nSelectedUploadFile.name} (${(fbl3nSelectedUploadFile.size / 1024).toFixed(1)} Ko)`;
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        fbl3nSelectedUploadFile = e.target.files[0];
        if (selectedName) selectedName.textContent = `Fichier prêt : ${fbl3nSelectedUploadFile.name} (${(fbl3nSelectedUploadFile.size / 1024).toFixed(1)} Ko)`;
      }
    });
  }

  // Submit Upload Button
  const btnSubmitUpload = document.getElementById('btnSubmitFbl3nUpload');
  if (btnSubmitUpload) {
    btnSubmitUpload.addEventListener('click', async () => {
      if (!fbl3nSelectedUploadFile) {
        alert('Veuillez sélectionner un fichier Excel (.xlsx ou .xls) à importer.');
        return;
      }

      const statusEl = document.getElementById('fbl3nUploadStatus');
      const selectedModeInput = document.querySelector('input[name="fbl3nImportMode"]:checked');
      const importMode = selectedModeInput ? selectedModeInput.value : 'month';
      const clearExisting = importMode === 'all';

      btnSubmitUpload.disabled = true;
      btnSubmitUpload.innerHTML = '⏳ Importation en cours...';

      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.background = '#e0f2fe';
        statusEl.style.color = '#0369a1';
        statusEl.style.border = '1px solid #7dd3fc';
        const modeDesc = importMode === 'month'
          ? 'Mise à jour mensuelle incrémentale en cours...'
          : (importMode === 'year' ? 'Remplacement annuel complet en cours...' : 'Réinitialisation et import en cours...');
        statusEl.textContent = `${modeDesc} Traitement SQL Server en cours, veuillez patienter.`;
      }

      try {
        const formData = new FormData();
        formData.append('file', fbl3nSelectedUploadFile);
        formData.append('importMode', importMode);
        formData.append('clearExisting', String(clearExisting));

        const res = await fetch('/api/fbl3n/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (data.success) {
          if (statusEl) {
            statusEl.style.background = '#dcfce7';
            statusEl.style.color = '#15803d';
            statusEl.style.border = '1px solid #86efac';
            const modeLabel = importMode === 'month' ? 'Mensuel Incrémental' : (importMode === 'year' ? 'Annuel' : 'Réinitialisation');
            const periodStr = data.periods && data.periods.length > 0 ? ` [${data.periods.join(', ')}]` : '';
            statusEl.textContent = `✅ Succès (${modeLabel}) : ${data.totalInserted.toLocaleString('fr-FR')} écritures enregistrées${periodStr} en ${data.durationSeconds}s.`;
          }
          setTimeout(async () => {
            closeModal();
            await loadAvailableYears();
            if (data.years && data.years.length > 0) {
              setSelectedYear(data.years[0]);
            }
            await loadFBL3NFilters();
            await loadFBL3NPage();
          }, 1400);
        } else {
          if (statusEl) {
            statusEl.style.background = '#fee2e2';
            statusEl.style.color = '#b91c1c';
            statusEl.style.border = '1px solid #fca5a5';
            statusEl.textContent = `❌ Erreur : ${data.error || 'Échec de l\'importation'}`;
          }
        }
      } catch (err) {
        if (statusEl) {
          statusEl.style.background = '#fee2e2';
          statusEl.style.color = '#b91c1c';
          statusEl.style.border = '1px solid #fca5a5';
          statusEl.textContent = `❌ Erreur de transmission : ${err.message}`;
        }
      } finally {
        btnSubmitUpload.disabled = false;
        btnSubmitUpload.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Lancer l'importation BDD
        `;
      }
    });
  }
}

async function loadFBL3NPage() {
  // Display of raw FBL3N data disabled per user request
  try {
    const res = await fetch('/api/fbl3n?limit=1');
    const data = await res.json();
    if (data.success && data.stats) {
      const badgeTotalCount = document.getElementById('badgeFbl3nTotalCount');
      if (badgeTotalCount) {
        badgeTotalCount.textContent = `${data.stats.totalCount.toLocaleString('fr-FR')} lignes`;
      }
    }
  } catch (err) {
    // Silent
  }
}

async function loadFBL3NFilters() {
  try {
    const res = await fetch('/api/fbl3n/filters');
    const data = await res.json();
    if (!data.success) return;

    AppState.fbl3nOptions = data;

    // 1. Populate Year select
    const yearSelect = document.getElementById('fbl3nFilterYear');
    if (yearSelect) {
      let html = '<option value="">Toutes les années (' + data.years.join(', ') + ')</option>';
      data.years.forEach(y => {
        html += `<option value="${y}" ${AppState.fbl3nFilters.year === String(y) ? 'selected' : ''}>${y}</option>`;
      });
      yearSelect.innerHTML = html;
    }

    // 2. Populate Month select
    updateFBL3NMonthOptions(AppState.fbl3nFilters.year);

    // 3. Populate Account select
    const accountSelect = document.getElementById('fbl3nFilterAccount');
    if (accountSelect) {
      let html = '<option value="">Tous les comptes</option>';
      data.accounts.forEach(acc => {
        const scfInfo = acc.scfAccount ? ` [SCF: ${acc.scfAccount}]` : '';
        const descInfo = acc.accountDesc ? ` - ${acc.accountDesc}` : '';
        html += `<option value="${acc.account}" ${AppState.fbl3nFilters.account === acc.account ? 'selected' : ''}>${acc.account}${scfInfo}${descInfo} (${acc.entryCount} l.)</option>`;
      });
      accountSelect.innerHTML = html;
    }

    // 4. Populate Doc Types
    const docTypeSelect = document.getElementById('fbl3nFilterDocType');
    if (docTypeSelect) {
      let html = '<option value="">Tous les types</option>';
      data.docTypes.forEach(dt => {
        html += `<option value="${dt.docType}" ${AppState.fbl3nFilters.docType === dt.docType ? 'selected' : ''}>${dt.docType} (${dt.count} l.)</option>`;
      });
      docTypeSelect.innerHTML = html;
    }

  } catch (err) {
    console.error('Error loading FBL3N filters:', err);
  }
}

function updateFBL3NMonthOptions(selectedYear) {
  const monthSelect = document.getElementById('fbl3nFilterMonth');
  if (!monthSelect || !AppState.fbl3nOptions) return;

  const periods = AppState.fbl3nOptions.periods || [];
  let filtered = periods;
  if (selectedYear) {
    filtered = periods.filter(p => String(p.year) === String(selectedYear));
  }

  // Deduplicate months in case multiple years are present
  const monthsMap = new Map();
  filtered.forEach(p => {
    const existing = monthsMap.get(p.month) || 0;
    monthsMap.set(p.month, existing + p.count);
  });

  let html = '<option value="">Tous les mois</option>';
  Array.from(monthsMap.keys()).sort((a, b) => a - b).forEach(m => {
    const name = FBL3N_MONTH_NAMES[m] || `Mois ${m}`;
    const count = monthsMap.get(m);
    html += `<option value="${m}" ${String(AppState.fbl3nFilters.month) === String(m) ? 'selected' : ''}>${name} (${count.toLocaleString('fr-FR')} éc.)</option>`;
  });
  monthSelect.innerHTML = html;
}

async function fetchFBL3NData() {
  // Disabled per user instruction: do not display data in FBL3N page
  return;
}

function renderFBL3NTable(data) {
  const tbody = document.getElementById('fbl3nTableBody');
  if (!tbody) return;

  if (!data || !data.rows || data.rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center; padding:40px; color:#64748b;">
          <div style="font-size:24px; margin-bottom:8px;">🔍</div>
          <div style="font-size:14px; font-weight:700; color:var(--navy);">Aucune écriture trouvée</div>
          <div style="font-size:12px; margin-top:4px;">Modifiez ou réinitialisez les critères de filtrage ci-dessus.</div>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  data.rows.forEach((row, idx) => {
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    const debitVal = row.amountLocal > 0 ? row.amountLocal : null;
    const creditVal = row.amountLocal < 0 ? Math.abs(row.amountLocal) : null;

    const debitFormatted = debitVal !== null ? formatFromDA(debitVal, false) : '—';
    const creditFormatted = creditVal !== null ? formatFromDA(creditVal, false) : '—';

    // Type badge color
    let typeBadgeClass = 'badge-slate';
    if (row.docType === 'AF') typeBadgeClass = 'badge-sky';
    else if (row.docType === 'RE') typeBadgeClass = 'badge-emerald';
    else if (row.docType === 'SA') typeBadgeClass = 'badge-purple';
    else if (row.docType === 'WE') typeBadgeClass = 'badge-amber';

    const accountLabel = row.accountDesc ? `<div style="font-size:11px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:170px;" title="${row.accountDesc}">${row.accountDesc}</div>` : '';
    const scfBadge = row.scfAccount ? `<span class="badge badge-slate" style="font-size:10px; padding:1px 4px; margin-left:4px;">SCF: ${row.scfAccount}</span>` : '';

    html += `
      <tr style="background-color:${bg};">
        <td style="font-size:11.5px; white-space:nowrap;" class="font-mono">${row.postingDate || '—'}</td>
        <td style="text-align:center;"><span class="badge badge-sky font-mono" style="font-size:11px;">${row.yearMonth || '—'}</span></td>
        <td style="font-weight:700;" class="font-mono text-navy">${row.docNumber || '—'}</td>
        <td style="text-align:center;"><span class="badge ${typeBadgeClass} font-mono">${row.docType || '—'}</span></td>
        <td>
          <div style="font-weight:700;" class="font-mono">${row.account}${scfBadge}</div>
          ${accountLabel}
        </td>
        <td style="font-size:11.5px;" class="font-mono text-slate">${row.counterpartyAccount || '—'}</td>
        <td style="font-size:11.5px;" class="font-mono text-slate">${row.supplierId || '—'}</td>
        <td style="font-size:11.5px; max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${row.textDesc || ''}">
          ${row.textDesc || '—'}
        </td>
        <td style="text-align:right; font-weight:700; color:#15803d;" class="font-mono">
          ${debitFormatted}
        </td>
        <td style="text-align:right; font-weight:700; color:#b91c1c;" class="font-mono">
          ${creditFormatted}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function updateFBL3NKPIs(stats) {
  if (!stats) return;

  const countEl = document.getElementById('kpiFbl3nFilteredCount');
  if (countEl) countEl.textContent = stats.totalCount.toLocaleString('fr-FR');

  const debitEl = document.getElementById('kpiFbl3nTotalDebit');
  if (debitEl) debitEl.textContent = formatFromDA(stats.totalDebit, true);

  const creditEl = document.getElementById('kpiFbl3nTotalCredit');
  if (creditEl) creditEl.textContent = formatFromDA(stats.totalCredit, true);

  const netEl = document.getElementById('kpiFbl3nNetBalance');
  if (netEl) netEl.textContent = formatFromDA(stats.netBalance, true);

  // Period subtitle
  const periodLabel = document.getElementById('kpiFbl3nPeriodLabel');
  if (periodLabel) {
    const { year, month } = AppState.fbl3nFilters;
    if (year && month) periodLabel.textContent = `${FBL3N_MONTH_NAMES[month] || 'Mois ' + month} ${year}`;
    else if (year) periodLabel.textContent = `Année complète ${year}`;
    else if (month) periodLabel.textContent = `${FBL3N_MONTH_NAMES[month] || 'Mois ' + month} (Toutes années)`;
    else periodLabel.textContent = `Toutes périodes confondues`;
  }

  // Balance status
  const balanceStatus = document.getElementById('kpiFbl3nBalanceStatus');
  if (balanceStatus) {
    const diff = Math.abs(stats.netBalance || 0);
    if (diff < 0.01) {
      balanceStatus.innerHTML = '<span class="text-emerald" style="font-weight:700;">Équilibré ✓ (0,00 DA)</span>';
    } else {
      balanceStatus.innerHTML = `<span class="text-rose" style="font-weight:700;">Écart : ${formatFromDA(diff, true)}</span>`;
    }
  }

  // Units sublabels
  const debitUnit = document.getElementById('kpiFbl3nDebitUnit');
  if (debitUnit) debitUnit.textContent = `Montant Débit en ${AppState.unit}`;

  const creditUnit = document.getElementById('kpiFbl3nCreditUnit');
  if (creditUnit) creditUnit.textContent = `Montant Crédit en ${AppState.unit}`;
}

// ==========================================================================
// 10. BALANCE GÉNÉRALE (SAP RFSSLD00) MANAGER & EXPLORER
// ==========================================================================

function initBalanceControls() {
  const selectPeriod = document.getElementById('selectBalancePeriod');
  if (selectPeriod) {
    selectPeriod.addEventListener('change', (e) => {
      AppState.selectedBalancePeriod = e.target.value;
      loadBalanceDataForPeriod(AppState.selectedBalancePeriod);
    });
  }


  // Upload custom balance file
  const btnUploadModal = document.getElementById('btnUploadBalanceModal');
  const inputFile = document.getElementById('inputBalanceFile');
  if (btnUploadModal && inputFile) {
    btnUploadModal.addEventListener('click', () => inputFile.click());

    inputFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('balanceFile', file);

      btnUploadModal.disabled = true;
      const origText = btnUploadModal.innerHTML;
      btnUploadModal.innerHTML = `<span class="spinner-sm"></span> Envoi...`;

      try {
        const res = await fetch('/api/balance/upload', {
          method: 'POST',
          body: formData
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Erreur lors du téléversement');

        alert(json.message);
        AppState.selectedBalancePeriod = json.periodKey;
        loadBalancePage(true);
      } catch (err) {
        alert(`Erreur téléversement : ${err.message}`);
      } finally {
        inputFile.value = '';
        btnUploadModal.disabled = false;
        btnUploadModal.innerHTML = origText;
      }
    });
  }

  // Refresh periods list
  const btnRefresh = document.getElementById('btnRefreshBalancePeriods');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => loadBalancePage(true));
  }

  // Class filter pills
  const pills = document.querySelectorAll('#page-balance .filter-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      AppState.balanceClassFilter = pill.getAttribute('data-class') || '';
      renderBalanceGrid(AppState.balanceData);
    });
  });

  // Search input
  const searchInput = document.getElementById('inputBalanceSearch');
  if (searchInput) {
    let debounceTimer = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        AppState.balanceSearch = e.target.value.trim().toLowerCase();
        renderBalanceGrid(AppState.balanceData);
      }, 200);
    });
  }

  // Export CSV
  const btnExport = document.getElementById('btnExportBalanceCSV');
  if (btnExport) {
    btnExport.addEventListener('click', () => exportBalanceCSV());
  }
}

async function loadBalancePage(forceRefresh = false) {
  try {
    const resPeriods = await fetch('/api/balance/periods');
    const jsonPeriods = await resPeriods.json();
    if (!jsonPeriods.success) throw new Error(jsonPeriods.error || 'Erreur périodes');

    AppState.balancePeriods = jsonPeriods.periods || [];
    renderBalancePeriodsCards(AppState.balancePeriods);

    const selectPeriod = document.getElementById('selectBalancePeriod');
    if (selectPeriod) {
      selectPeriod.innerHTML = AppState.balancePeriods.map(p => `
        <option value="${p.period_key}" ${p.period_key === AppState.selectedBalancePeriod ? 'selected' : ''}>
          Balance ${p.period_key} (${p.total_accounts} comptes • ${p.source_file || 'SAP'})
        </option>
      `).join('');

      if (!AppState.selectedBalancePeriod && AppState.balancePeriods.length > 0) {
        AppState.selectedBalancePeriod = AppState.balancePeriods[0].period_key;
        selectPeriod.value = AppState.selectedBalancePeriod;
      }
    }

    if (AppState.selectedBalancePeriod) {
      await loadBalanceDataForPeriod(AppState.selectedBalancePeriod);
    }
  } catch (err) {
    console.error('Error loading balance page:', err);
  }
}

async function loadBalanceDataForPeriod(periodKey) {
  const tbody = document.getElementById('balanceTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:#64748b;">Chargement des comptes de la balance ${periodKey}...</td></tr>`;
  }

  try {
    const res = await fetch(`/api/balance?period=${encodeURIComponent(periodKey)}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erreur lecture balance');

    AppState.balanceData = json.balances || [];
    const periodInfo = AppState.balancePeriods.find(p => p.period_key === periodKey);
    renderBalanceKPIs(AppState.balanceData, periodInfo);
    renderBalanceGrid(AppState.balanceData);
  } catch (err) {
    console.error('Error fetching balance data:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:#e11d48;">Erreur : ${err.message}</td></tr>`;
    }
  }
}

function renderBalanceKPIs(balances, periodInfo) {
  const kpiAccounts = document.getElementById('kpiBalAccounts');
  const kpiOpening = document.getElementById('kpiBalOpening');
  const kpiDebit = document.getElementById('kpiBalDebit');
  const kpiCredit = document.getElementById('kpiBalCredit');
  const kpiClosing = document.getElementById('kpiBalClosing');
  const kpiEquilibre = document.getElementById('kpiBalEquilibre');
  const kpiEquilibreSub = document.getElementById('kpiBalEquilibreSub');
  const iconEquilibre = document.getElementById('iconBalEquilibre');
  const kpiSourceFile = document.getElementById('kpiBalSourceFile');

  if (!balances || balances.length === 0) {
    if (kpiAccounts) kpiAccounts.textContent = '0';
    if (kpiOpening) kpiOpening.textContent = '—';
    if (kpiDebit) kpiDebit.textContent = '—';
    if (kpiCredit) kpiCredit.textContent = '—';
    if (kpiClosing) kpiClosing.textContent = '—';
    if (kpiEquilibre) kpiEquilibre.textContent = '—';
    return;
  }

  let totOpening = 0;
  let totDebit = 0;
  let totCredit = 0;
  let totClosing = 0;

  balances.forEach(b => {
    totOpening += Number(b.report_initial) || 0;
    totDebit += Number(b.debit) || 0;
    totCredit += Number(b.credit) || 0;
    totClosing += Number(b.solde) || 0;
  });

  const diff = Math.abs(totDebit - totCredit);
  const isBalanced = diff < 1.0;

  if (kpiAccounts) kpiAccounts.textContent = balances.length.toLocaleString('fr-FR');
  if (kpiOpening) kpiOpening.textContent = formatFromDA(totOpening, true);
  if (kpiDebit) kpiDebit.textContent = formatFromDA(totDebit, true);
  if (kpiCredit) kpiCredit.textContent = formatFromDA(totCredit, true);
  if (kpiClosing) kpiClosing.textContent = formatFromDA(totClosing, true);
  if (kpiSourceFile) kpiSourceFile.textContent = periodInfo?.source_file || 'Fichier SAP';

  if (kpiEquilibre) {
    kpiEquilibre.textContent = isBalanced ? '0,00 DA ✓' : `Écart : ${formatFromDA(diff, true)}`;
    kpiEquilibre.style.color = isBalanced ? '#059669' : '#dc2626';
  }
  if (kpiEquilibreSub) {
    kpiEquilibreSub.textContent = isBalanced ? 'Égalité Débit = Crédit' : 'Déséquilibre constaté';
    kpiEquilibreSub.style.color = isBalanced ? '#059669' : '#dc2626';
  }
  if (iconEquilibre) {
    iconEquilibre.style.background = isBalanced ? '#ecfdf5' : '#fef2f2';
    iconEquilibre.style.color = isBalanced ? '#059669' : '#dc2626';
  }
}

function renderBalancePeriodsCards(periods) {
  const container = document.getElementById('balancePeriodsList');
  if (!container) return;

  if (!periods || periods.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding:24px; text-align:center; color:#64748b; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px;">
        Aucune balance enregistrée en base de données. Utilisez le bouton <strong>1-Clic Sync OS-appro</strong> ou <strong>Téléverser Fichier</strong> ci-dessus.
      </div>
    `;
    return;
  }

  container.innerHTML = periods.map(p => {
    const isSelected = p.period_key === AppState.selectedBalancePeriod;
    const isEq = p.is_balanced;
    const dateStr = p.last_updated ? new Date(p.last_updated).toLocaleDateString('fr-FR') : '—';

    return `
      <div class="balance-period-card" style="background:#ffffff; border:1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'}; border-radius:8px; padding:14px; position:relative; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition:all 0.2s ease;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div>
            <span style="font-size:11px; font-weight:700; color:#2563eb; text-transform:uppercase; letter-spacing:0.5px;">Exercice / Période</span>
            <h4 style="margin:2px 0 0 0; font-size:16px; font-weight:800; color:#0f172a;">${p.period_key}</h4>
          </div>
          <span class="badge ${isEq ? 'badge-emerald' : 'badge-rose'}" style="font-size:11px;">
            ${isEq ? 'Équilibrée ✓' : 'Écart Débit/Crédit'}
          </span>
        </div>

        <div style="font-size:12px; color:#475569; margin-bottom:10px;">
          <div><strong>${p.total_accounts}</strong> comptes répertoriés</div>
          <div>Fichier : <code style="font-size:11px; background:#f1f5f9; padding:2px 4px; border-radius:4px;">${p.source_file || 'balance'}</code></div>
          <div>Total Flux : <strong>${formatFromDA(p.total_debit, true)}</strong></div>
          <div style="font-size:11px; color:#94a3b8; margin-top:2px;">Importé le ${dateStr}</div>
        </div>

        <div style="display:flex; gap:6px; justify-content:space-between; align-items:center;">
          <button class="btn btn-xs ${isSelected ? 'btn-primary' : 'btn-secondary'}" onclick="selectBalancePeriodDirect('${p.period_key}')" style="flex:1;">
            ${isSelected ? '● Période Active' : 'Afficher'}
          </button>
          <button class="btn btn-xs btn-outline-danger" onclick="deleteBalancePeriodDirect('${p.period_key}')" title="Supprimer cette balance" style="padding:4px 8px; color:#dc2626; border-color:#fca5a5;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.selectBalancePeriodDirect = function (periodKey) {
  AppState.selectedBalancePeriod = periodKey;
  const select = document.getElementById('selectBalancePeriod');
  if (select) select.value = periodKey;
  renderBalancePeriodsCards(AppState.balancePeriods);
  loadBalanceDataForPeriod(periodKey);
};

window.deleteBalancePeriodDirect = async function (periodKey) {
  if (!confirm(`Confirmez-vous la suppression de tous les comptes enregistrés pour la balance ${periodKey} ?`)) return;

  try {
    const res = await fetch(`/api/balance/${encodeURIComponent(periodKey)}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erreur suppression');

    alert(`Période ${periodKey} supprimée`);
    AppState.selectedBalancePeriod = '';
    loadBalancePage(true);
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
};

function renderBalanceGrid(balances) {
  const tbody = document.getElementById('balanceTableBody');
  const tfOpening = document.getElementById('tfBalOpening');
  const tfDebit = document.getElementById('tfBalDebit');
  const tfCredit = document.getElementById('tfBalCredit');
  const tfClosing = document.getElementById('tfBalClosing');
  const heading = document.getElementById('balTableHeading');

  if (!tbody) return;

  if (!balances || balances.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:#64748b;">Aucun compte dans cette balance.</td></tr>`;
    return;
  }

  const cls = AppState.balanceClassFilter;
  const q = AppState.balanceSearch;

  let filtered = balances;
  if (cls) {
    filtered = filtered.filter(b =>
      String(b.boal_account).startsWith(cls) || String(b.scf_account || '').startsWith(cls)
    );
  }

  if (q) {
    filtered = filtered.filter(b =>
      String(b.boal_account).includes(q) ||
      String(b.scf_account || '').includes(q) ||
      String(b.account_desc || '').toLowerCase().includes(q)
    );
  }

  if (heading) {
    const clsTxt = cls ? ` • Classe ${cls}` : '';
    const qTxt = q ? ` • Recherche: "${q}"` : '';
    heading.textContent = `Détail des Comptes de la Balance (${filtered.length} sur ${balances.length}${clsTxt}${qTxt})`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:#64748b;">Aucun compte ne correspond aux filtres appliqués.</td></tr>`;
    return;
  }

  let sumOpening = 0, sumDebit = 0, sumCredit = 0, sumClosing = 0;

  tbody.innerHTML = filtered.map((b, idx) => {
    const opening = Number(b.report_initial) || 0;
    const debit = Number(b.debit) || 0;
    const credit = Number(b.credit) || 0;
    const closing = Number(b.solde) || 0;

    sumOpening += opening;
    sumDebit += debit;
    sumCredit += credit;
    sumClosing += closing;

    const bg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
    const scfBadge = b.scf_account
      ? `<span class="badge badge-emerald" style="font-family:JetBrains Mono, monospace; font-size:10.5px;">${b.scf_account}</span>`
      : `<span style="color:#94a3b8; font-size:11px;">—</span>`;

    return `
      <tr style="background:${bg};">
        <td style="font-family:JetBrains Mono, monospace; font-weight:700; color:#0f172a;">${b.boal_account}</td>
        <td>${scfBadge}</td>
        <td style="font-weight:600; color:#1e293b;">${b.account_desc || ''}</td>
        <td style="text-align:right; font-family:JetBrains Mono, monospace;">${formatFromDA(opening, true)}</td>
        <td style="text-align:right; font-family:JetBrains Mono, monospace; color:#2563eb; font-weight:600;">${debit > 0 ? formatFromDA(debit, true) : '—'}</td>
        <td style="text-align:right; font-family:JetBrains Mono, monospace; color:#dc2626; font-weight:600;">${credit > 0 ? formatFromDA(credit, true) : '—'}</td>
        <td style="text-align:right; font-family:JetBrains Mono, monospace; font-weight:700; color:${closing < 0 ? '#dc2626' : '#0f172a'};">${formatFromDA(closing, true)}</td>
      </tr>
    `;
  }).join('');

  if (tfOpening) tfOpening.textContent = formatFromDA(sumOpening, true);
  if (tfDebit) tfDebit.textContent = formatFromDA(sumDebit, true);
  if (tfCredit) tfCredit.textContent = formatFromDA(sumCredit, true);
  if (tfClosing) tfClosing.textContent = formatFromDA(sumClosing, true);
}

function exportBalanceCSV() {
  if (!AppState.balanceData || AppState.balanceData.length === 0) {
    alert('Aucune donnée à exporter');
    return;
  }

  const period = AppState.selectedBalancePeriod || 'balance';
  const headers = ['Compte_BOAL', 'Compte_SCF', 'Designation', 'Report_Initial_DA', 'Debit_DA', 'Credit_DA', 'Solde_Cumule_DA'];
  const rows = AppState.balanceData.map(b => [
    `"${b.boal_account}"`,
    `"${b.scf_account || ''}"`,
    `"${(b.account_desc || '').replace(/"/g, '""')}"`,
    (Number(b.report_initial) || 0).toFixed(2),
    (Number(b.debit) || 0).toFixed(2),
    (Number(b.credit) || 0).toFixed(2),
    (Number(b.solde) || 0).toFixed(2)
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Balance_Generale_${period}_SENSUS.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================================================
// 12. SIDEBAR TOGGLE & MINIMIZER TO THE LEFT
// ==========================================================================
function initSidebarToggle() {
  const toggleBtn = document.getElementById('btnToggleSidebar');
  const layout = document.querySelector('.app-layout');
  if (!toggleBtn || !layout) return;

  // Restore saved state
  const isCollapsed = localStorage.getItem('sensus_sidebar_collapsed') === 'true';
  if (isCollapsed) {
    layout.classList.add('sidebar-collapsed');
  }

  toggleBtn.addEventListener('click', () => {
    const collapsed = layout.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sensus_sidebar_collapsed', collapsed ? 'true' : 'false');
  });
}

// ==========================================================================
// 13. IMPORT & RECONCILIATION CONTROLLER (GL vs BALANCE)
// ==========================================================================
const ImportState = {
  reconciliationData: null,
  activeFilter: 'all',
  searchQuery: '',
  fbl3nMode: 'single',
  fbl3nFiles: [],
  balanceMode: 'single',
  balanceFiles: []
};

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function initImportPage() {
  const tabFbl3n = document.getElementById('tabImportFBL3N');
  const tabBalance = document.getElementById('tabImportBalance');
  const panelFbl3n = document.getElementById('panelImportFBL3N');
  const panelBalance = document.getElementById('panelImportBalance');

  if (tabFbl3n && tabBalance && panelFbl3n && panelBalance) {
    tabFbl3n.addEventListener('click', () => {
      panelFbl3n.style.display = 'block';
      panelBalance.style.display = 'none';
      tabFbl3n.className = 'btn btn-primary btn-sm';
      tabFbl3n.style.border = '';
      tabFbl3n.style.background = '';
      tabBalance.className = 'btn btn-outline btn-sm';
      tabBalance.style.border = 'none';
      tabBalance.style.background = 'transparent';
    });
    tabBalance.addEventListener('click', () => {
      panelFbl3n.style.display = 'none';
      panelBalance.style.display = 'block';
      tabBalance.className = 'btn btn-emerald btn-sm';
      tabBalance.style.border = '';
      tabBalance.style.background = '';
      tabFbl3n.className = 'btn btn-outline btn-sm';
      tabFbl3n.style.border = 'none';
      tabFbl3n.style.background = 'transparent';
    });
  }

  const fileInputFbl3n = document.getElementById('fileInputFBL3N') as HTMLInputElement | null;
  const btnUploadFbl3n = document.getElementById('btnUploadFBL3N') as HTMLButtonElement | null;
  const fbl3nFeedback = document.getElementById('fbl3nUploadFeedback');

  if (fileInputFbl3n && btnUploadFbl3n) {
    fileInputFbl3n.addEventListener('change', () => {
      const hasFiles = Boolean(fileInputFbl3n.files && fileInputFbl3n.files.length > 0);
      btnUploadFbl3n.disabled = !hasFiles;
      if (fbl3nFeedback) fbl3nFeedback.textContent = '';
    });

    btnUploadFbl3n.addEventListener('click', async () => {
      if (!fileInputFbl3n.files || fileInputFbl3n.files.length === 0) return;
      const files = Array.from(fileInputFbl3n.files);
      btnUploadFbl3n.disabled = true;
      const txtEl = document.getElementById('btnTextUploadFBL3N');
      if (txtEl) txtEl.textContent = 'Importation...';
      if (fbl3nFeedback) fbl3nFeedback.textContent = '';

      try {
        const formData = new FormData();
        files.forEach((f) => formData.append('files', f));
        formData.append('importMode', 'month');
        const res = await fetch('/api/upload/fbl3n', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          fileInputFbl3n.value = '';
          if (fbl3nFeedback) {
            fbl3nFeedback.style.color = '#059669';
            fbl3nFeedback.textContent = `✓ ${Number(data.totalInserted || 0).toLocaleString('fr-FR')} écritures importées.`;
          }
          await loadImportSummary();
          await loadAvailableYears();
        } else {
          if (fbl3nFeedback) {
            fbl3nFeedback.style.color = '#e11d48';
            fbl3nFeedback.textContent = data.error || "Erreur lors de l'importation.";
          }
        }
      } catch (err) {
        if (fbl3nFeedback) {
          fbl3nFeedback.style.color = '#e11d48';
          fbl3nFeedback.textContent = err.message || 'Erreur réseau.';
        }
      } finally {
        if (txtEl) txtEl.textContent = 'Importer';
        btnUploadFbl3n.disabled = !(fileInputFbl3n.files && fileInputFbl3n.files.length > 0);
      }
    });
  }

  const fileInputBal = document.getElementById('fileInputBalance') as HTMLInputElement | null;
  const btnUploadBal = document.getElementById('btnUploadBalance') as HTMLButtonElement | null;
  const balFeedback = document.getElementById('balanceUploadFeedback');

  if (fileInputBal && btnUploadBal) {
    fileInputBal.addEventListener('change', () => {
      const hasFiles = Boolean(fileInputBal.files && fileInputBal.files.length > 0);
      btnUploadBal.disabled = !hasFiles;
      if (balFeedback) balFeedback.textContent = '';
    });

    btnUploadBal.addEventListener('click', async () => {
      if (!fileInputBal.files || fileInputBal.files.length === 0) return;
      const files = Array.from(fileInputBal.files);
      btnUploadBal.disabled = true;
      const txtEl = document.getElementById('btnTextUploadBalance');
      if (txtEl) txtEl.textContent = 'Importation...';
      if (balFeedback) balFeedback.textContent = '';

      try {
        const formData = new FormData();
        files.forEach((f) => formData.append('files', f));
        const res = await fetch('/api/upload/balance', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          fileInputBal.value = '';
          if (balFeedback) {
            balFeedback.style.color = '#059669';
            balFeedback.textContent = `✓ ${Number(data.totalInserted || 0).toLocaleString('fr-FR')} comptes importés.`;
          }
          await loadImportSummary();
          await loadAvailableYears();
        } else {
          if (balFeedback) {
            balFeedback.style.color = '#e11d48';
            balFeedback.textContent = data.error || "Erreur lors de l'importation.";
          }
        }
      } catch (err) {
        if (balFeedback) {
          balFeedback.style.color = '#e11d48';
          balFeedback.textContent = err.message || 'Erreur réseau.';
        }
      } finally {
        if (txtEl) txtEl.textContent = 'Importer';
        btnUploadBal.disabled = !(fileInputBal.files && fileInputBal.files.length > 0);
      }
    });
  }

  return;
  // Legacy reconciliation controls below (no-op)
  const btnLaunchReconcile = document.getElementById('btnLaunchReconciliation');
  const wrapReconcileResults = document.getElementById('wrapReconciliationResults');
  const btnHideReconcile = document.getElementById('btnHideReconciliation');
  const yrSelect = document.getElementById('reconcileSelectYear');
  const moSelect = document.getElementById('reconcileSelectMonth');
  const btnRefresh = document.getElementById('btnRefreshReconciliation');

  if (btnLaunchReconcile && wrapReconcileResults) {
    btnLaunchReconcile.addEventListener('click', async () => {
      wrapReconcileResults.style.display = 'block';
      btnLaunchReconcile.textContent = '⏳ Calcul du rapprochement...';
      await loadReconciliationAudit(true);
      btnLaunchReconcile.textContent = '🔄 Réactualiser le Rapprochement';
    });
  }

  if (btnHideReconcile && wrapReconcileResults) {
    btnHideReconcile.addEventListener('click', () => {
      wrapReconcileResults.style.display = 'none';
      if (btnLaunchReconcile) btnLaunchReconcile.textContent = '🔍 Lancer le Contrôle de Concordance';
    });
  }

  if (yrSelect) {
    yrSelect.addEventListener('change', () => {
      if (wrapReconcileResults && wrapReconcileResults.style.display !== 'none') {
        loadReconciliationAudit();
      }
    });
  }

  if (moSelect) {
    moSelect.addEventListener('change', () => {
      if (wrapReconcileResults && wrapReconcileResults.style.display !== 'none') {
        loadReconciliationAudit();
      }
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      if (wrapReconcileResults) wrapReconcileResults.style.display = 'block';
      loadReconciliationAudit(true);
    });
  }

  // Delete GL period handler
  const btnDeleteGL = document.getElementById('btnDeleteGLPeriod');
  if (btnDeleteGL) {
    btnDeleteGL.addEventListener('click', async () => {
      const sel = document.getElementById('selectDeleteGLPeriod')?.value;
      if (!sel) return;

      const payload: Record<string, any> = { target: 'fbl3n' };
      let confirmMsg = '';

      if (sel === 'ALL') {
        confirmMsg = '⚠️ ATTENTION : Êtes-vous sûr de vouloir supprimer TOUTES les écritures Grand Livre (FBL3N) de la base ?';
      } else {
        const [mo, yr] = sel.split('/');
        payload.year = yr;
        payload.month = mo;
        confirmMsg = `Êtes-vous sûr de vouloir supprimer les écritures Grand Livre du mois ${sel} ?`;
      }

      if (!confirm(confirmMsg)) return;

      try {
        btnDeleteGL.disabled = true;
        btnDeleteGL.textContent = 'Suppression...';
        const res = await fetch('/api/import/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Erreur lors de la suppression');
        alert(`✅ ${data.message}`);
        await loadSettingsPage();
      } catch (err) {
        alert(`❌ Erreur : ${err.message}`);
      } finally {
        btnDeleteGL.disabled = false;
        btnDeleteGL.textContent = 'Supprimer GL';
      }
    });
  }

  // Targeted Month Delete handler (Import page)
  const btnCustomDel = document.getElementById('btnCustomDeleteMonth');
  if (btnCustomDel) {
    btnCustomDel.addEventListener('click', async () => {
      const yr = document.getElementById('selectCustomDeleteYear')?.value || 2026;
      const mo = document.getElementById('selectCustomDeleteMonth')?.value || 1;
      const moPad = String(mo).padStart(2, '0');
      if (!confirm(`⚠️ Confirmez-vous la suppression des écritures Grand Livre (FBL3N) du mois ${moPad}/${yr} ?\n\nCe mois sera réinitialisé à 0.`)) return;
      try {
        btnCustomDel.disabled = true;
        btnCustomDel.textContent = 'Suppression...';
        const res = await fetch('/api/import/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: 'fbl3n', year: yr, month: mo })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Erreur lors de la suppression');
        alert(`✅ ${data.message}`);
        await loadSettingsPage();
      } catch (err) {
        alert(`❌ Erreur : ${err.message}`);
      } finally {
        btnCustomDel.disabled = false;
        btnCustomDel.textContent = '🗑️ Vider ce mois';
      }
    });
  }

  // Quick Month Delete from Bilan Control Bar
  const btnDeleteBilanMo = document.getElementById('btnDeleteBilanMonth');
  if (btnDeleteBilanMo) {
    btnDeleteBilanMo.addEventListener('click', async () => {
      const yr = document.getElementById('selectBilanYear')?.value || AppState.selectedYear || 2026;
      const mo = document.getElementById('selectBilanMonth')?.value || AppState.selectedMonth;
      if (!mo || mo === 'ALL') return;
      const moPad = String(mo).padStart(2, '0');
      if (!confirm(`⚠️ Supprimer toutes les écritures FBL3N du mois ${moPad}/${yr} ?\n\nCe mois affichera 0,00 DA dans le Bilan.`)) return;
      try {
        btnDeleteBilanMo.disabled = true;
        btnDeleteBilanMo.textContent = 'Vérification...';
        const res = await fetch('/api/import/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: 'fbl3n', year: yr, month: mo })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Erreur suppression');
        alert(`✅ ${data.message}`);
        AppState.bilanData = null;
        loadBilanPage(true);
      } catch (e) {
        alert(`❌ Erreur : ${e.message}`);
      } finally {
        btnDeleteBilanMo.disabled = false;
        btnDeleteBilanMo.textContent = `🗑️ Vider M${AppState.selectedMonth}`;
      }
    });
  }

  // Quick Month Delete from TCR Control Bar
  const btnDeleteTCRMo = document.getElementById('btnDeleteTCRMonth');
  if (btnDeleteTCRMo) {
    btnDeleteTCRMo.addEventListener('click', async () => {
      const yr = document.getElementById('selectTCRYear')?.value || AppState.selectedYear || 2026;
      const mo = document.getElementById('selectTCRMonth')?.value || AppState.selectedMonth;
      if (!mo || mo === 'ALL') return;
      const moPad = String(mo).padStart(2, '0');
      if (!confirm(`⚠️ Supprimer toutes les écritures FBL3N du mois ${moPad}/${yr} ?\n\nCe mois affichera 0,00 DA dans le TCR.`)) return;
      try {
        btnDeleteTCRMo.disabled = true;
        btnDeleteTCRMo.textContent = 'Vérification...';
        const res = await fetch('/api/import/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: 'fbl3n', year: yr, month: mo })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Erreur suppression');
        alert(`✅ ${data.message}`);
        AppState.tcrData = null;
        loadTCRPage(true);
      } catch (e) {
        alert(`❌ Erreur : ${e.message}`);
      } finally {
        btnDeleteTCRMo.disabled = false;
        btnDeleteTCRMo.textContent = `🗑️ Vider M${AppState.selectedMonth}`;
      }
    });
  }

  // Delete Balance period handler
  const btnDeleteBal = document.getElementById('btnDeleteBalancePeriod');
  if (btnDeleteBal) {
    btnDeleteBal.addEventListener('click', async () => {
      const sel = document.getElementById('selectDeleteBalancePeriod')?.value;
      if (!sel) return;

      const payload: Record<string, any> = { target: 'balance' };
      let confirmMsg = '';

      if (sel === 'ALL') {
        confirmMsg = '⚠️ ATTENTION : Êtes-vous sûr de vouloir supprimer TOUTES les Balances Générales de la base ?';
      } else {
        payload.periodKey = sel;
        confirmMsg = `Êtes-vous sûr de vouloir supprimer la Balance de la période ${sel} ?`;
      }

      if (!confirm(confirmMsg)) return;

      try {
        btnDeleteBal.disabled = true;
        btnDeleteBal.textContent = 'Suppression...';
        const res = await fetch('/api/import/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Erreur lors de la suppression');
        alert(`✅ ${data.message}`);
        await loadSettingsPage();
      } catch (err) {
        alert(`❌ Erreur : ${err.message}`);
      } finally {
        btnDeleteBal.disabled = false;
        btnDeleteBal.textContent = 'Supprimer Balance';
      }
    });
  }

  // Full reset (GL + Balances) handler
  const btnResetAll = document.getElementById('btnResetAllImports');
  if (btnResetAll) {
    btnResetAll.addEventListener('click', async () => {
      const confirmed = confirm('⚠️ SUPPRESSION TOTALE : Êtes-vous sûr de vouloir vider toutes les données importées (Grand Livre FBL3N et Balances Générales) ?\n\nNote : Le Plan Comptable (975 comptes) et le Référentiel Fournisseurs (127) seront conservés.');
      if (!confirmed) return;

      try {
        btnResetAll.disabled = true;
        btnResetAll.textContent = 'Réinitialisation...';
        const res = await fetch('/api/import/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: 'all' })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Erreur lors de la réinitialisation');
        alert(`✅ ${data.message}`);
        await loadSettingsPage();
      } catch (err) {
        alert(`❌ Erreur : ${err.message}`);
      } finally {
        btnResetAll.disabled = false;
        btnResetAll.textContent = '🗑️ Vider Tout (GL + Balances)';
      }
    });
  }

  // Mode Switchers: FBL3N (Single vs Multi)
  const btnModeFbl3nSingle = document.getElementById('btnModeFbl3nSingle');
  const btnModeFbl3nMulti = document.getElementById('btnModeFbl3nMulti');
  const inputFBL3N = document.getElementById('fileInputFBL3N');
  const dropzoneFBL3N = document.getElementById('dropzoneFBL3N');
  const dropzoneTextFBL3N = document.getElementById('dropzoneTextFBL3N');
  const dropzoneHintFBL3N = document.getElementById('dropzoneHintFBL3N');
  const btnUploadFBL3N = document.getElementById('btnUploadFBL3N');
  const btnTextUploadFBL3N = document.getElementById('btnTextUploadFBL3N');

  if (btnModeFbl3nSingle && btnModeFbl3nMulti) {
    btnModeFbl3nSingle.addEventListener('click', () => {
      btnModeFbl3nSingle.classList.add('active');
      btnModeFbl3nMulti.classList.remove('active');
      ImportState.fbl3nMode = 'single';
      if (inputFBL3N) inputFBL3N.removeAttribute('multiple');
      if (dropzoneTextFBL3N) dropzoneTextFBL3N.innerHTML = '<strong>Cliquez pour choisir</strong> ou glissez-déposez le fichier Excel FBL3N';
      if (dropzoneHintFBL3N) dropzoneHintFBL3N.textContent = 'Fichier unique .xlsx ou .xls (ex: FBL3N_Avril.xlsx)';
      ImportState.fbl3nFiles = ImportState.fbl3nFiles.slice(0, 1);
      renderQueueFBL3N();
    });

    btnModeFbl3nMulti.addEventListener('click', () => {
      btnModeFbl3nMulti.classList.add('active');
      btnModeFbl3nSingle.classList.remove('active');
      ImportState.fbl3nMode = 'multi';
      if (inputFBL3N) inputFBL3N.setAttribute('multiple', 'multiple');
      if (dropzoneTextFBL3N) dropzoneTextFBL3N.innerHTML = '<strong>Sélectionnez plusieurs fichiers</strong> ou glissez-déposez votre lot FBL3N';
      if (dropzoneHintFBL3N) dropzoneHintFBL3N.textContent = 'Sélectionnez plusieurs mois (ex: Janvier, Février, Mars...)';
      renderQueueFBL3N();
    });
  }

  // FBL3N Dropzone
  if (dropzoneFBL3N && inputFBL3N) {
    dropzoneFBL3N.addEventListener('click', () => inputFBL3N.click());

    dropzoneFBL3N.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneFBL3N.classList.add('dragover');
    });
    dropzoneFBL3N.addEventListener('dragleave', () => {
      dropzoneFBL3N.classList.remove('dragover');
    });
    dropzoneFBL3N.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneFBL3N.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFilesToFBL3NQueue(Array.from(e.dataTransfer.files));
      }
    });

    inputFBL3N.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        addFilesToFBL3NQueue(Array.from(e.target.files));
      }
    });
  }

  // Clear FBL3N queue
  const btnClearQueueFBL3N = document.getElementById('btnClearQueueFBL3N');
  if (btnClearQueueFBL3N) {
    btnClearQueueFBL3N.addEventListener('click', () => {
      ImportState.fbl3nFiles = [];
      if (inputFBL3N) inputFBL3N.value = '';
      renderQueueFBL3N();
    });
  }

  // Process FBL3N Upload
  if (btnUploadFBL3N) {
    btnUploadFBL3N.addEventListener('click', () => {
      if (ImportState.fbl3nFiles.length > 0) {
        uploadFBL3NBatch(ImportState.fbl3nFiles);
      }
    });
  }

  // Mode Switchers: Balance (Single vs Multi)
  const btnModeBalanceSingle = document.getElementById('btnModeBalanceSingle');
  const btnModeBalanceMulti = document.getElementById('btnModeBalanceMulti');
  const inputBalance = document.getElementById('fileInputBalance');
  const dropzoneBalance = document.getElementById('dropzoneBalance');
  const dropzoneTextBalance = document.getElementById('dropzoneTextBalance');
  const dropzoneHintBalance = document.getElementById('dropzoneHintBalance');
  const btnUploadBalance = document.getElementById('btnUploadBalance');
  const btnTextUploadBalance = document.getElementById('btnTextUploadBalance');
  const wrapPeriodOverride = document.getElementById('wrapBalancePeriodOverride');

  if (btnModeBalanceSingle && btnModeBalanceMulti) {
    btnModeBalanceSingle.addEventListener('click', () => {
      btnModeBalanceSingle.classList.add('active');
      btnModeBalanceMulti.classList.remove('active');
      ImportState.balanceMode = 'single';
      if (inputBalance) inputBalance.removeAttribute('multiple');
      if (dropzoneTextBalance) dropzoneTextBalance.innerHTML = '<strong>Cliquez pour choisir</strong> ou glissez-déposez le fichier Balance Excel';
      if (dropzoneHintBalance) dropzoneHintBalance.textContent = 'Fichier unique .xls ou .xlsx (ex: balance 102026.xls)';
      if (wrapPeriodOverride) wrapPeriodOverride.style.display = 'flex';
      ImportState.balanceFiles = ImportState.balanceFiles.slice(0, 1);
      renderQueueBalance();
    });

    btnModeBalanceMulti.addEventListener('click', () => {
      btnModeBalanceMulti.classList.add('active');
      btnModeBalanceSingle.classList.remove('active');
      ImportState.balanceMode = 'multi';
      if (inputBalance) inputBalance.setAttribute('multiple', 'multiple');
      if (dropzoneTextBalance) dropzoneTextBalance.innerHTML = '<strong>Sélectionnez plusieurs fichiers</strong> ou glissez-déposez vos balances';
      if (dropzoneHintBalance) dropzoneHintBalance.textContent = 'Sélectionnez plusieurs périodes (ex: balance 25.xls, balance 102026.xls...)';
      if (wrapPeriodOverride) wrapPeriodOverride.style.display = 'none';
      renderQueueBalance();
    });
  }

  // Balance Dropzone
  if (dropzoneBalance && inputBalance) {
    dropzoneBalance.addEventListener('click', () => inputBalance.click());

    dropzoneBalance.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneBalance.classList.add('dragover');
    });
    dropzoneBalance.addEventListener('dragleave', () => {
      dropzoneBalance.classList.remove('dragover');
    });
    dropzoneBalance.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneBalance.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFilesToBalanceQueue(Array.from(e.dataTransfer.files));
      }
    });

    inputBalance.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        addFilesToBalanceQueue(Array.from(e.target.files));
      }
    });
  }

  // Clear Balance queue
  const btnClearQueueBalance = document.getElementById('btnClearQueueBalance');
  if (btnClearQueueBalance) {
    btnClearQueueBalance.addEventListener('click', () => {
      ImportState.balanceFiles = [];
      if (inputBalance) inputBalance.value = '';
      renderQueueBalance();
    });
  }

  // Process Balance Upload
  if (btnUploadBalance) {
    btnUploadBalance.addEventListener('click', () => {
      if (ImportState.balanceFiles.length > 0) {
        const periodKey = document.getElementById('inputBalancePeriodOverride')?.value?.trim() || null;
        uploadBalanceBatch(ImportState.balanceFiles, periodKey);
      }
    });
  }

  // Reconciliation filter tabs
  document.querySelectorAll('.tab-btn[data-reconcile-filter]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn[data-reconcile-filter]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      ImportState.activeFilter = e.currentTarget.getAttribute('data-reconcile-filter') || 'all';
      renderReconciliationRows();
    });
  });

  // Search input
  const searchInput = document.getElementById('inputSearchReconciliation');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      ImportState.searchQuery = e.target.value.toLowerCase().trim();
      renderReconciliationRows();
    });
  }
}

function addFilesToFBL3NQueue(newFiles) {
  if (ImportState.fbl3nMode === 'single') {
    ImportState.fbl3nFiles = [newFiles[0]];
  } else {
    // Append unique files by name
    const existingNames = new Set(ImportState.fbl3nFiles.map(f => f.name));
    newFiles.forEach(f => {
      if (!existingNames.has(f.name)) ImportState.fbl3nFiles.push(f);
    });
  }
  renderQueueFBL3N();
}

function removeFileFromFBL3NQueue(index) {
  ImportState.fbl3nFiles.splice(index, 1);
  renderQueueFBL3N();
}

function renderQueueFBL3N() {
  const queueWrap = document.getElementById('queueFBL3N');
  const queueList = document.getElementById('queueListFBL3N');
  const queueCount = document.getElementById('queueCountFBL3N');
  const btnUpload = document.getElementById('btnUploadFBL3N');
  const btnText = document.getElementById('btnTextUploadFBL3N');

  const files = ImportState.fbl3nFiles;
  if (!queueWrap || !queueList) return;

  if (files.length === 0) {
    queueWrap.style.display = 'none';
    if (btnUpload) btnUpload.disabled = true;
    if (btnText) btnText.textContent = "Lancer l'Importation GL";
    return;
  }

  queueWrap.style.display = 'block';
  if (queueCount) queueCount.textContent = String(files.length);
  if (btnUpload) btnUpload.disabled = false;
  if (btnText) {
    btnText.textContent = files.length > 1
      ? `Importer ces ${files.length} fichiers GL (Batch)`
      : `Importer ce fichier GL (${files[0].name})`;
  }

  queueList.innerHTML = files.map((f, i) => `
    <div class="queue-item">
      <div class="queue-item-info">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span class="queue-item-name" title="${f.name}">${f.name}</span>
        <span class="queue-item-size">${formatFileSize(f.size)}</span>
      </div>
      <button type="button" class="queue-item-remove" onclick="removeFileFromFBL3NQueue(${i})" title="Retirer ce fichier">✕</button>
    </div>
  `).join('');
}

function addFilesToBalanceQueue(newFiles) {
  if (ImportState.balanceMode === 'single') {
    ImportState.balanceFiles = [newFiles[0]];
  } else {
    const existingNames = new Set(ImportState.balanceFiles.map(f => f.name));
    newFiles.forEach(f => {
      if (!existingNames.has(f.name)) ImportState.balanceFiles.push(f);
    });
  }
  renderQueueBalance();
}

function removeFileFromBalanceQueue(index) {
  ImportState.balanceFiles.splice(index, 1);
  renderQueueBalance();
}

function renderQueueBalance() {
  const queueWrap = document.getElementById('queueBalance');
  const queueList = document.getElementById('queueListBalance');
  const queueCount = document.getElementById('queueCountBalance');
  const btnUpload = document.getElementById('btnUploadBalance');
  const btnText = document.getElementById('btnTextUploadBalance');

  const files = ImportState.balanceFiles;
  if (!queueWrap || !queueList) return;

  if (files.length === 0) {
    queueWrap.style.display = 'none';
    if (btnUpload) btnUpload.disabled = true;
    if (btnText) btnText.textContent = "Lancer l'Importation Balances";
    return;
  }

  queueWrap.style.display = 'block';
  if (queueCount) queueCount.textContent = String(files.length);
  if (btnUpload) btnUpload.disabled = false;
  if (btnText) {
    btnText.textContent = files.length > 1
      ? `Importer ces ${files.length} fichiers Balance (Batch)`
      : `Importer cette Balance (${files[0].name})`;
  }

  queueList.innerHTML = files.map((f, i) => `
    <div class="queue-item">
      <div class="queue-item-info">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M12 3v18"/><path d="m3 7 9-4 9 4"/><path d="m3 17 9 4 9-4"/></svg>
        <span class="queue-item-name" title="${f.name}">${f.name}</span>
        <span class="queue-item-size">${formatFileSize(f.size)}</span>
      </div>
      <button type="button" class="queue-item-remove" onclick="removeFileFromBalanceQueue(${i})" title="Retirer ce fichier">✕</button>
    </div>
  `).join('');
}

// Global window exposure for inline onclick handlers
window.removeFileFromFBL3NQueue = removeFileFromFBL3NQueue;
window.removeFileFromBalanceQueue = removeFileFromBalanceQueue;

// Upload batch handlers
async function uploadFBL3NBatch(files) {
  const btn = document.getElementById('btnUploadFBL3N');
  const btnText = document.getElementById('btnTextUploadFBL3N');
  if (btn) {
    btn.disabled = true;
    if (btnText) btnText.textContent = `⏳ Importation de ${files.length} fichier(s) en cours...`;
  }

  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('importMode', 'month');

  try {
    const res = await fetch('/api/upload/fbl3n', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error || 'Erreur lors du téléversement FBL3N');
    }

    let msg = `✅ Importation FBL3N réussie !\n• ${result.filesCount} fichier(s) traité(s)\n• ${result.totalInserted.toLocaleString('fr-FR')} écritures insérées / remplacées.`;
    if (result.diffs && result.diffs.length > 0) {
      msg += `\n\n📌 Remplacements & Écarts Détectés :\n` + result.diffs.map(d =>
        `Période ${d.periodLabel} : ${d.action} (${d.diffCount >= 0 ? '+' : ''}${d.diffCount} lignes, écart net: ${d.diffSum} DA)`
      ).join('\n');
    }
    alert(msg);

    ImportState.fbl3nFiles = [];
    renderQueueFBL3N();
    await loadImportPage();
  } catch (err) {
    console.error('FBL3N upload error:', err);
    alert(`❌ Erreur d'importation FBL3N : ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      renderQueueFBL3N();
    }
  }
}

async function uploadBalanceBatch(files, periodOverride = null) {
  const btn = document.getElementById('btnUploadBalance');
  const btnText = document.getElementById('btnTextUploadBalance');
  if (btn) {
    btn.disabled = true;
    if (btnText) btnText.textContent = `⏳ Importation de ${files.length} fichier(s) en cours...`;
  }

  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  if (periodOverride) formData.append('periodKey', periodOverride);

  try {
    const res = await fetch('/api/upload/balance', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error || 'Erreur lors du téléversement Balance');
    }

    let msg = `✅ Importation Balances réussie !\n• ${result.filesCount} fichier(s) traité(s)\n• ${result.totalInserted.toLocaleString('fr-FR')} comptes enregistrés / mis à jour.`;
    if (result.diffs && result.diffs.length > 0) {
      msg += `\n\n📌 Remplacements & Variations Détectées :\n` + result.diffs.map(d =>
        `Période ${d.periodKey} : ${d.action} (${d.diffAccounts >= 0 ? '+' : ''}${d.diffAccounts} comptes, écart solde: ${d.diffSolde} DA)`
      ).join('\n');
    }
    alert(msg);

    ImportState.balanceFiles = [];
    renderQueueBalance();
    await loadImportPage();
  } catch (err) {
    console.error('Balance upload error:', err);
    alert(`❌ Erreur d'importation Balances : ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      renderQueueBalance();
    }
  }
}

async function loadImportPage() {
  await Promise.all([
    loadImportSummary(),
    loadDiffHistory()
  ]);
}

async function loadImportSummary() {
  try {
    const res = await fetch('/api/import/summary');
    const data = await res.json();
    if (data.success) {
      // 1. Uploaded FBL3N Months List (01-2025, 02-2025, ...)
      const listGL = document.getElementById('listUploadedGLMonths');
      const countGL = document.getElementById('countUploadedGLMonths');
      if (Array.isArray(data.glPeriods)) {
        if (countGL) {
          countGL.textContent = `${data.glPeriods.length} mois`;
        }
        if (listGL) {
          if (data.glPeriods.length === 0) {
            listGL.innerHTML = '<div style="color: #64748b; font-size: 13px; text-align: center; padding: 16px;">Aucun mois importé.</div>';
          } else {
            listGL.innerHTML = data.glPeriods.map((p: any) => {
              const moStr = String(p.fiscal_month).padStart(2, '0');
              const yrStr = String(p.fiscal_year);
              const label = `${moStr}-${yrStr}`;
              const cnt = Number(p.count || 0).toLocaleString('fr-FR');
              return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border: 1px solid var(--border-light); border-radius: 8px; background: var(--slate-light);">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="font-mono" style="font-weight: 700; font-size: 13.5px; color: var(--navy);">${label}</span>
                    <span style="font-size: 12px; color: var(--slate);">${cnt} écritures</span>
                  </div>
                  <button type="button" class="btn btn-outline-danger btn-sm btn-delete-gl-month" data-year="${yrStr}" data-month="${p.fiscal_month}" style="padding: 4px 10px; font-size: 11.5px; font-weight: 600;">
                    Supprimer
                  </button>
                </div>
              `;
            }).join('');

            listGL.querySelectorAll('.btn-delete-gl-month').forEach(btn => {
              btn.addEventListener('click', async () => {
                const yr = btn.getAttribute('data-year');
                const mo = btn.getAttribute('data-month');
                const label = `${String(mo).padStart(2, '0')}-${yr}`;
                if (!confirm(`Supprimer les écritures FBL3N du mois ${label} ?`)) return;
                (btn as HTMLButtonElement).disabled = true;
                try {
                  const delRes = await fetch('/api/import/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target: 'fbl3n', year: yr, month: mo })
                  });
                  const delData = await delRes.json();
                  if (delData.success) {
                    await loadImportSummary();
                    await loadAvailableYears();
                  } else {
                    alert(delData.error || 'Erreur lors de la suppression');
                  }
                } finally {
                  (btn as HTMLButtonElement).disabled = false;
                }
              });
            });
          }
        }
      }

      // 2. Uploaded Balance Periods List
      const listBal = document.getElementById('listUploadedBalPeriods');
      const countBal = document.getElementById('countUploadedBalPeriods');
      if (Array.isArray(data.balPeriods)) {
        if (countBal) {
          countBal.textContent = `${data.balPeriods.length} période${data.balPeriods.length > 1 ? 's' : ''}`;
        }
        if (listBal) {
          if (data.balPeriods.length === 0) {
            listBal.innerHTML = '<div style="color: #64748b; font-size: 13px; text-align: center; padding: 16px;">Aucune balance importée.</div>';
          } else {
            listBal.innerHTML = data.balPeriods.map((p: any) => {
              const cnt = Number(p.accounts_count || 0).toLocaleString('fr-FR');
              return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border: 1px solid var(--border-light); border-radius: 8px; background: var(--slate-light);">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="font-mono" style="font-weight: 700; font-size: 13.5px; color: var(--navy);">${p.period_key}</span>
                    <span style="font-size: 12px; color: var(--slate);">${cnt} comptes</span>
                  </div>
                  <button type="button" class="btn btn-outline-danger btn-sm btn-delete-bal-period" data-period="${p.period_key}" style="padding: 4px 10px; font-size: 11.5px; font-weight: 600;">
                    Supprimer
                  </button>
                </div>
              `;
            }).join('');

            listBal.querySelectorAll('.btn-delete-bal-period').forEach(btn => {
              btn.addEventListener('click', async () => {
                const pk = btn.getAttribute('data-period');
                if (!confirm(`Supprimer la balance de la période ${pk} ?`)) return;
                (btn as HTMLButtonElement).disabled = true;
                try {
                  const delRes = await fetch('/api/import/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target: 'balance', periodKey: pk })
                  });
                  const delData = await delRes.json();
                  if (delData.success) {
                    await loadImportSummary();
                    await loadAvailableYears();
                  } else {
                    alert(delData.error || 'Erreur lors de la suppression');
                  }
                } finally {
                  (btn as HTMLButtonElement).disabled = false;
                }
              });
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Import summary load error:', err);
  }
}

async function loadDiffHistory() {
  try {
    const res = await fetch('/api/import/history');
    const data = await res.json();
    if (data.success) {
      renderDiffHistoryUI(data.history || []);
    }
  } catch (err) {
    console.warn('Diff history error:', err);
  }
}

function renderDiffHistoryUI(historyList) {
  const feed = document.getElementById('feedDiffAlerts');
  const countTag = document.getElementById('tagDiffAlertsCount');
  if (!feed) return;

  if (!Array.isArray(historyList) || historyList.length === 0) {
    feed.innerHTML = `
      <div class="feed-empty-state">
        Aucun remplacement récent enregistré. Les modifications entre deux chargements d'un même mois s'afficheront ici.
      </div>
    `;
    if (countTag) countTag.textContent = '0 alerte';
    return;
  }

  if (countTag) {
    countTag.textContent = `${historyList.length} notification${historyList.length > 1 ? 's' : ''}`;
  }

  feed.innerHTML = historyList.map(h => {
    let typeClass = 'diff-info';
    let iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

    if (h.type === 'WARNING') {
      typeClass = 'diff-warning';
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else if (h.type === 'SUCCESS') {
      typeClass = 'diff-success';
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    }

    const timeStr = h.timestamp ? new Date(h.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

    return `
      <div class="diff-item-card ${typeClass}">
        <div style="margin-top:2px;">${iconSvg}</div>
        <div class="diff-item-content">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="diff-item-title">${h.title || 'Notification Import'}</div>
            <span style="font-size:10.5px; color:#94a3b8; font-family:var(--font-mono);">${timeStr}</span>
          </div>
          <div class="diff-item-msg">${h.message || ''}</div>
        </div>
      </div>
    `;
  }).join('');
}

async function loadReconciliationAudit(forceRefresh = false) {
  const yr = document.getElementById('reconcileSelectYear')?.value || AppState.selectedYear || '2026';
  const mo = document.getElementById('reconcileSelectMonth')?.value || '10';

  const tbody = document.getElementById('tbodyReconciliation');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:32px; color:#64748b;">
          <div style="display:inline-flex; align-items:center; gap:8px;">
            <span class="status-pulse-dot" style="background:#0284c7;"></span>
            <span>Calcul du rapprochement comptable en cours...</span>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetch(`/api/reconciliation?year=${yr}&month=${mo}`);
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Erreur lors du calcul du rapprochement');
    }

    ImportState.reconciliationData = data;
    renderReconciliationSummary(data);
    renderReconciliationRows();

    const sideBadge = document.getElementById('sidebarReconcileBadge');
    if (sideBadge) {
      if (data.mismatchedCount > 0) {
        sideBadge.style.display = 'inline-block';
        sideBadge.textContent = `${data.mismatchedCount} écart${data.mismatchedCount > 1 ? 's' : ''}`;
        sideBadge.className = 'nav-badge-pill badge-danger';
      } else {
        sideBadge.style.display = 'inline-block';
        sideBadge.textContent = '0 écart';
        sideBadge.className = 'nav-badge-pill badge-success';
      }
    }
  } catch (err) {
    console.error('Reconciliation load error:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:32px; color:#ef4444;">
            Erreur de rapprochement : ${err.message}
          </td>
        </tr>
      `;
    }
  }
}

function renderReconciliationSummary(data) {
  const badgeEl = document.getElementById('badgeGlobalReconciliation');
  const textEl = document.getElementById('textGlobalReconcileStatus');

  if (badgeEl && textEl) {
    if (data.reconciled) {
      badgeEl.className = 'reconcile-status-badge status-match';
      textEl.textContent = 'CONCORDANCE COMPTABLE PARFAITE (0.00 DZD)';
    } else {
      badgeEl.className = 'reconcile-status-badge status-mismatch';
      textEl.textContent = `DIVERGENCE DÉTECTÉE : ${data.mismatchedCount} COMPTE(S) EN ÉCART (${formatFromDA(data.totalDiscrepancy, true)})`;
    }
  }

  const kpiGLNet = document.getElementById('kpiGLNet');
  const kpiGLDebCred = document.getElementById('kpiGLDebCred');
  const kpiBalNet = document.getElementById('kpiBalNet');
  const kpiBalDebCred = document.getElementById('kpiBalDebCred');
  const kpiNetDiscrepancy = document.getElementById('kpiNetDiscrepancy');
  const kpiAccountsRatio = document.getElementById('kpiAccountsRatio');
  const kpiAccountsDetail = document.getElementById('kpiAccountsDetail');

  if (kpiGLNet) kpiGLNet.textContent = formatFromDA(data.totalGLNet, true);
  if (kpiGLDebCred) kpiGLDebCred.textContent = `Débit: ${formatFromDA(data.totalGLDebit)} | Crédit: ${formatFromDA(data.totalGLCredit)}`;

  if (kpiBalNet) kpiBalNet.textContent = formatFromDA(data.totalBalNet, true);
  if (kpiBalDebCred) kpiBalDebCred.textContent = `Débit: ${formatFromDA(data.totalBalDebit)} | Crédit: ${formatFromDA(data.totalBalCredit)}`;

  if (kpiNetDiscrepancy) {
    kpiNetDiscrepancy.textContent = formatFromDA(data.totalDiscrepancy, true);
    kpiNetDiscrepancy.style.color = data.totalDiscrepancy > 1 ? '#ef4444' : '#059669';
  }

  if (kpiAccountsRatio) kpiAccountsRatio.textContent = `${data.matchedCount} / ${data.totalAccounts}`;
  if (kpiAccountsDetail) kpiAccountsDetail.textContent = `${data.mismatchedCount} comptes avec différence détectée`;

  const cAll = document.getElementById('countTabAll');
  const cMis = document.getElementById('countTabMismatch');
  const cMat = document.getElementById('countTabMatch');

  if (cAll) cAll.textContent = String(data.totalAccounts || 0);
  if (cMis) cMis.textContent = String(data.mismatchedCount || 0);
  if (cMat) cMat.textContent = String(data.matchedCount || 0);
}

function renderReconciliationRows() {
  const tbody = document.getElementById('tbodyReconciliation');
  if (!tbody || !ImportState.reconciliationData) return;

  const accounts = ImportState.reconciliationData.accounts || [];

  const filtered = accounts.filter(acc => {
    if (ImportState.activeFilter === 'mismatch' && acc.isMatch) return false;
    if (ImportState.activeFilter === 'match' && !acc.isMatch) return false;

    if (ImportState.searchQuery) {
      const q = ImportState.searchQuery;
      const bMatch = (acc.boal || '').toLowerCase().includes(q);
      const sMatch = (acc.scf || '').toLowerCase().includes(q);
      const dMatch = (acc.desc || '').toLowerCase().includes(q);
      if (!bMatch && !sMatch && !dMatch) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:32px; color:#94a3b8;">
          Aucun compte ne correspond aux critères de filtre sélectionnés.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(acc => {
    const isMismatch = !acc.isMatch;
    const rowClass = isMismatch ? 'row-mismatch' : '';
    const badgeHtml = isMismatch
      ? `<span class="badge-mismatch">ÉCART</span>`
      : `<span class="badge-match">CONFORME</span>`;

    const diffFormatted = isMismatch
      ? `<strong style="color:#dc2626;">${acc.diffNet > 0 ? '+' : ''}${formatFromDA(acc.diffNet)}</strong>`
      : `<span style="color:#059669;">0,00</span>`;

    return `
      <tr class="${rowClass}">
        <td><strong style="color:var(--navy); font-family:var(--font-mono);">${acc.boal}</strong></td>
        <td><span style="font-family:var(--font-mono); color:#475569;">${acc.scf || '—'}</span></td>
        <td>
          <div style="font-weight:600; color:#1e293b;">${acc.desc || 'Sans libellé'}</div>
          ${!acc.inGL ? '<span style="font-size:10px; color:#94a3b8;">(Présent en Balance uniquement)</span>' : ''}
          ${!acc.inBalance ? '<span style="font-size:10px; color:#d97706;">(Présent en FBL3N uniquement)</span>' : ''}
        </td>
        <td class="num-col"><strong>${formatFromDA(acc.glNet)}</strong></td>
        <td class="num-col"><strong>${formatFromDA(acc.balNetMvt)}</strong></td>
        <td class="num-col">${diffFormatted}</td>
        <td style="text-align:center;">${badgeHtml}</td>
        <td style="text-align:center;">
          <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:11px;" onclick="drilldownAccountGL('${acc.boal}')" title="Voir les écritures dans FBL3N">
            GL
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function drilldownAccountGL(boalAccount) {
  if (!boalAccount) return;
  AppState.fbl3nFilters.account = boalAccount;
  AppState.fbl3nFilters.page = 1;
  const accInput = document.getElementById('filterFbl3nAccount');
  if (accInput) accInput.value = boalAccount;

  navigateToPage('page-fbl3n', true);
  fetchFBL3NData();
}

window.drilldownAccountGL = drilldownAccountGL;

// ==========================================================================
// UI/UX PRO MAX - THEME INITIALIZATION & SWITCHER
// ==========================================================================
function initThemeEngine() {
  const savedTheme = localStorage.getItem('sensus_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcons(savedTheme);

  const toggleBtn = document.getElementById('btnToggleTheme');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('sensus_theme', next);
      updateThemeIcons(next);
    });
  }
}

function updateThemeIcons(theme) {
  const sunIcon = document.getElementById('themeIconSun');
  const moonIcon = document.getElementById('themeIconMoon');
  if (sunIcon && moonIcon) {
    if (theme === 'dark') {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    } else {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeEngine);
} else {
  initThemeEngine();
}





