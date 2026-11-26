---
name: scf-algerie-sap
description: Official Algerian SCF (Système Comptable Financier) & SAP FI/CO (FBL3N, RFSSLD00) rules for SENSUS ALGERIE SPA. Enforces BOAL-to-SCF mapping, TCR (Compte de Résultat), Bilan (Actif & Passif), cumulative balance sheet logic, and period filtering.
---

# SCF Algérie & SAP FI/CO Accounting Rules (SENSUS ALGERIE SPA)

## 1. Sign Conventions in SAP Exports (`FBL3N` & `RFSSLD00`)
- **Debit** = Positive (`+`)
- **Credit** = Negative (`-`)

## 2. TCR (Tableau des Comptes de Résultats — SCF Algérie)
- **Class 7 (Revenues / Produits)**: Always **`val = -solde`** (Credits become positive, Debits/rebates/reversals like `709` become negative). Covers `70`, `72`, `73`, `74`, `75`, `76`, `78`.
- **Class 6 (Expenses / Charges)**: Always **`val = +solde`** (Debits remain positive, Credits/rebates/reversals become negative). Covers `60`, `61/62`, `63`, `64`, `65`, `66`, `68`, `69`.
- **SIG Formulas**:
  1. `I. Production de l'exercice` = `70 + 72 + 73 + 74`
  2. `II. Consommation de l'exercice` = `60 + 61/62`
  3. `1. Valeur Ajoutée (VA)` = `I - II`
  4. `2. EBE` = `VA - 63 - 64`
  5. `3. Résultat Opérationnel (RO)` = `EBE + 75 - 65 + 78 - 68`
  6. `4. Résultat Financier (RF)` = `76 - 66`
  7. `5. Résultat Courant Avant Impôts (RCAI)` = `RO + RF`
  8. `6. Résultat Net (RN)` = `RCAI - 69`
- **Dynamic N vs N-1 Comparison**:
  - Only compare against year `N-1` when `N-1` has actual non-zero **Class 6 or Class 7** records for the same period/mode. Never compare against `0,00 DA` when `N-1` only has Balance Sheet entries or no data.

## 3. Bilan (Actif & Passif — SCF Algérie)
- **Cumulative Nature**: A Balance Sheet (Bilan) is a **cumulative** snapshot from `01/YYYY` up to the selected month `MM/YYYY` (including `report_initial` opening balances where present), NOT a single-month movement.
  - When `month = MM` is selected on `gl` (`FBL3NLineItems`), Bilan accounts (`1..5`) MUST sum `report_initial + SUM(movements where fiscal_month <= MM)`, and `Résultat net de l'exercice (12)` MUST equal cumulative `RN` from `01..MM`!
- **Actif**:
  - **Actif Non Courant**: `20` (net of `280`), `21` (net of `281`), `23` (Immob. en cours), `26` (Titres), `27` (Prêts/actifs fin. NC), `133` (Impôts différés actif).
  - **Actif Courant**: `3` (net of `39`), `411/413/418` + debit `419` (net of `49`), `409` / debit `401/404/408` (Fournisseurs débiteurs), `44` debit balances (`444`, `445`, `448`, `442`), `486` & other debit `46/47` (`467`, `468`, `47`), `51`/`53`/`54` (Trésorerie & Accréditifs `542` positive).
- **Passif**:
  - **Capitaux Propres**: `101` (Capital), `106`/`11` (Primes, réserves & report à nouveau), `12` (Résultat net de l'exercice = `RN` from cumulative TCR).
  - **Passifs Non Courants**: `15` (Provisions), `16`/`17` (Emprunts & dettes financières), `134` (Impôts différés passif).
  - **Passifs Courants**: `401/404/408` credit balances (Fournisseurs), `44` credit balances (Dettes fiscales `442/444/445/447`), `419` (Clients créditeurs), `42/43/45/46/47/487` credit balances (Personnel, Sécu, Dividendes, Autres créditeurs), `519` or credit bank balances (`51` negative -> Concours bancaires courants).
- **Fundamental Accounting Equation**: When full cumulative data (opening balances + movements) is present, `Total Actif Net == Total Passif`.

## 4. Period & Month Filtering
- SAP `FBL3N` entries belong to `fiscal_year` and `fiscal_month` derived from `Année/Mois` / `Période comptable` / `Date comptable` (`posting_date`).
- For **TCR**, filtering by month `MM` shows either the single-month P&L (`MM`) or cumulative (`ALL`), and when a month has no data, all amounts are `0,00 DA` with `hasData: false`.
- For **Bilan**, filtering by month `MM` shows the **cumulative** financial position at the end of month `MM` (`fiscal_month <= MM`).
