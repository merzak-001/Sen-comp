const fs = require('fs');
const XLSX = require('xlsx');

function excelDateToISO(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    const utcDays = Math.floor(val - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    const frMatch = val.match(/^(\d{2})[./-](\d{2})[./-](\d{4})/);
    if (frMatch) return `${frMatch[3]}-${frMatch[2]}-${frMatch[1]}`;
  }
  return String(val);
}

/**
 * Parse F.41 Excel or MHTML
 */
function parseF41(filePathOrBuffer) {
  let workbook;
  if (typeof filePathOrBuffer === 'string') {
    workbook = XLSX.readFile(filePathOrBuffer);
  } else {
    workbook = XLSX.read(filePathOrBuffer, { type: 'buffer' });
  }

  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const invoices = [];

  rows.forEach(r => {
    const docType = String(r['Type de pièce'] || '').trim().toUpperCase();
    // Filter only invoice and credit note items (KR, RE, KG, KA if applicable)
    // Focus on KR and RE for expenses
    if (docType !== 'KR' && docType !== 'RE' && docType !== 'KG') return;

    const piece = String(r['Nº pièce'] || '').trim();
    if (!piece) return;

    const postingKey = String(r['Clé comptabilisation'] || '').trim();
    const rawAmount = Number(r['Montant débit/crédit']) || 0;
    
    // In F.41:
    // Posting Key 31 (KR/RE standard) -> negative amount in F.41 -> represents standard expense (+)
    // Posting Key 21 (RE storno / KG avoir) -> positive amount in F.41 -> represents cancellation / credit note (-)
    const expenseAmount = -rawAmount;

    const dateComptable = excelDateToISO(r['Date comptable']);
    const datePiece = excelDateToISO(r['Date pièce']);

    let year = '2026';
    let month = '01';
    if (dateComptable) {
      const parts = dateComptable.split('-');
      if (parts.length >= 2) {
        year = parts[0];
        month = parts[1];
      }
    }

    const currency = String(r['Devise'] || r['Devise_1'] || 'DZD').trim().toUpperCase();
    const isLocal = currency === 'DZD';
    const supplierId = String(r['Fournisseur'] || '').trim();
    const supplierName = String(r['Nom 1'] || 'FOURNISSEUR INCONNU').trim();
    const affectation = String(r['Affectation'] || '').trim();

    const rawForeignAmount = r['Montant dev. étrangère'] !== undefined ? parseFloat(r['Montant dev. étrangère']) : null;
    const foreignAmount = (rawForeignAmount !== null && !isNaN(rawForeignAmount)) ? -rawForeignAmount : null;

    invoices.push({
      piece,
      docType,
      postingKey,
      datePiece,
      dateComptable,
      year,
      month,
      yearMonth: `${year}-${month}`,
      currency,
      isLocal,
      supplierId,
      supplierName,
      affectation,
      foreignAmount,
      f41Amount: expenseAmount // Positive for standard invoice, negative for cancellation
    });
  });

  return invoices;
}

/**
 * Fast streaming / regex parser for FBL3N MHTML or Excel file
 */
function parseFBL3N(filePathOrBuffer) {
  let content = '';
  if (typeof filePathOrBuffer === 'string') {
    content = fs.readFileSync(filePathOrBuffer, 'utf8');
  } else {
    content = filePathOrBuffer.toString('utf8');
  }

  const pieceMap = new Map();

  // If it's an MHTML / HTML file
  if (content.includes('<html') || content.includes('<table') || content.includes('MIME-Version')) {
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    let trMatch;
    let headerFound = false;

    while ((trMatch = trRegex.exec(content)) !== null) {
      const rowHtml = trMatch[1];
      const cells = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
      }

      if (cells.length < 5) continue;

      if (!headerFound) {
        if (cells.includes('Nº pièce') && cells.includes('Compte')) {
          headerFound = true;
        }
        continue;
      }

      const compte = String(cells[2] || '').trim();
      const piece = String(cells[3] || '').trim();
      const rawAmount = (cells[14] || '').replace(/\s/g, '').replace(',', '.');
      const amount = parseFloat(rawAmount) || 0;

      if (!piece) continue;

      if (!pieceMap.has(piece)) {
        pieceMap.set(piece, {
          debours: 0,
          retunie: 0,
          tva: 0,
          glAccounts: []
        });
      }

      const entry = pieceMap.get(piece);
      if (!entry.glAccounts.includes(compte)) {
        entry.glAccounts.push(compte);
      }

      // 1. Débours on account 17300015 (take positive debits / KR debours)
      if (compte === '17300015') {
        if (amount > 0) entry.debours += amount;
      }
      // 2. Retenue on account 19710001 (recorded as credit 50 / negative amount)
      else if (compte === '19710001') {
        entry.retunie += Math.abs(amount);
      }
      // 3. TVA Récupérable on accounts 17870302 (biens/matières) or 17870303 (prestations/services)
      else if (compte === '17870302' || compte === '17870303') {
        entry.tva += amount;
      }
    }
  } else {
    // Fallback if provided as binary .xlsx
    const wb = XLSX.read(filePathOrBuffer);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    rows.forEach(r => {
      const piece = String(r['Nº pièce'] || '').trim();
      const compte = String(r['Compte'] || '').trim();
      const amount = Number(r['Montant en devise interne']) || 0;
      if (!piece) return;

      if (!pieceMap.has(piece)) {
        pieceMap.set(piece, { debours: 0, retunie: 0, tva: 0, glAccounts: [] });
      }
      const entry = pieceMap.get(piece);
      if (!entry.glAccounts.includes(compte)) entry.glAccounts.push(compte);

      if (compte === '17300015' && amount > 0) entry.debours += amount;
      else if (compte === '19710001') entry.retunie += Math.abs(amount);
      else if (compte === '17870302' || compte === '17870303') entry.tva += amount;
    });
  }

  return pieceMap;
}

module.exports = {
  parseF41,
  parseFBL3N
};
