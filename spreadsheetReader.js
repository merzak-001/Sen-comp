const fs = require('fs');
const readline = require('readline');
const XLSX = require('xlsx');

/**
 * Universal spreadsheet reader for SAP exports:
 * - Genuine XLSX (PK zip format)
 * - Genuine XLS (BIFF8 / OLE2 compound document)
 * - SAP ALV MHTML exports (multipart/related with HTML table, saved as .xls or .xlsx)
 * - SAP ALV HTML exports (HTML table with x:str / x:num tags)
 */
class SpreadsheetReader {
  /**
   * Checks if file starts with ZIP (PK..) or OLE2 (\xD0\xCF..) signature
   */
  static isZipOrOle2(filePath) {
    try {
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(8);
      fs.readSync(fd, buf, 0, 8, 0);
      fs.closeSync(fd);
      const isZip = buf[0] === 0x50 && buf[1] === 0x4B; // PK..
      const isOle2 = buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0;
      return isZip || isOle2;
    } catch (e) {
      return false;
    }
  }

  /**
   * Checks if buffer starts with ZIP (PK..) or OLE2 (\xD0\xCF..) signature
   */
  static isZipOrOle2Buffer(buf) {
    if (!buf || buf.length < 4) return false;
    const isZip = buf[0] === 0x50 && buf[1] === 0x4B;
    const isOle2 = buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0;
    return isZip || isOle2;
  }

  /**
   * Ultra-fast streaming parser for SAP ALV MHTML / HTML tables.
   * Handles files of any size (up to 100MB+) in a few hundred milliseconds with minimal memory.
   */
  static parseHtmlOrMhtmlFile(filePath) {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 128 * 1024 });
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      let headers = null;
      let inRow = false;
      let currentRowCells = [];
      const rows = [];

      rl.on('line', (line) => {
        let remaining = line;
        while (remaining.length > 0) {
          if (!inRow) {
            const trStart = remaining.indexOf('<tr');
            if (trStart === -1) break;
            inRow = true;
            currentRowCells = [];
            remaining = remaining.substring(trStart + 3);
          }

          const trEnd = remaining.indexOf('</tr>');
          const segment = trEnd !== -1 ? remaining.substring(0, trEnd) : remaining;

          const tdRegex = /<td\b([^>]*)>(.*?)<\/td>/gi;
          let match;
          while ((match = tdRegex.exec(segment)) !== null) {
            const attrs = match[1];
            let content = match[2];

            let val = '';
            const strMatch = attrs.match(/x:str="([^"]*)"/);
            const numMatch = attrs.match(/x:num="([^"]*)"/);

            if (strMatch) {
              val = strMatch[1];
            } else if (numMatch) {
              val = numMatch[1];
            } else {
              val = content
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/&quot;/gi, '"')
                .trim();
            }
            currentRowCells.push(val);
          }

          if (trEnd !== -1) {
            inRow = false;
            remaining = remaining.substring(trEnd + 5);

            if (currentRowCells.length > 0) {
              if (!headers) {
                // First non-empty row defines table headers
                headers = currentRowCells.map(h => h.trim());
              } else {
                const rowObj = {};
                for (let i = 0; i < headers.length; i++) {
                  rowObj[headers[i]] = currentRowCells[i] !== undefined ? currentRowCells[i] : '';
                }
                rows.push(rowObj);
              }
            }
          } else {
            break;
          }
        }
      });

      rl.on('close', () => {
        resolve({ headers: headers || [], rows });
      });

      rl.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Ultra-fast streaming parser returning raw rows as arrays of cell values
   */
  static parseHtmlOrMhtmlFileAsArrays(filePath) {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 128 * 1024 });
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      let inRow = false;
      let currentRowCells = [];
      const rows = [];

      rl.on('line', (line) => {
        let remaining = line;
        while (remaining.length > 0) {
          if (!inRow) {
            const trStart = remaining.indexOf('<tr');
            if (trStart === -1) break;
            inRow = true;
            currentRowCells = [];
            remaining = remaining.substring(trStart + 3);
          }

          const trEnd = remaining.indexOf('</tr>');
          const segment = trEnd !== -1 ? remaining.substring(0, trEnd) : remaining;

          const tdRegex = /<td\b([^>]*)>(.*?)<\/td>/gi;
          let match;
          while ((match = tdRegex.exec(segment)) !== null) {
            const attrs = match[1];
            let content = match[2];

            let val = '';
            const strMatch = attrs.match(/x:str="([^"]*)"/);
            const numMatch = attrs.match(/x:num="([^"]*)"/);

            if (strMatch) {
              val = strMatch[1];
            } else if (numMatch) {
              val = numMatch[1];
            } else {
              val = content
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/&quot;/gi, '"')
                .trim();
            }
            currentRowCells.push(val);
          }

          if (trEnd !== -1) {
            inRow = false;
            remaining = remaining.substring(trEnd + 5);
            if (currentRowCells.length > 0) {
              rows.push(currentRowCells);
            }
          } else {
            break;
          }
        }
      });

      rl.on('close', () => resolve(rows));
      rl.on('error', reject);
    });
  }

  /**
   * Reads any spreadsheet file (XLSX, XLS, MHTML, HTML) as object rows:
   * { headers: string[], rows: object[] }
   */
  static async readSpreadsheet(source, options = {}) {
    if (Buffer.isBuffer(source)) {
      if (this.isZipOrOle2Buffer(source)) {
        const wb = XLSX.read(source, { type: 'buffer', cellFormula: false });
        const sheetName = wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        return { headers, rows };
      } else {
        const tempPath = path.join(__dirname, 'uploads', `temp_${Date.now()}_${Math.random().toString(36).substring(2)}.tmp`);
        fs.writeFileSync(tempPath, source);
        try {
          return await this.parseHtmlOrMhtmlFile(tempPath);
        } finally {
          try { fs.unlinkSync(tempPath); } catch (e) {}
        }
      }
    }

    if (typeof source === 'string') {
      if (!fs.existsSync(source)) {
        throw new Error(`Fichier introuvable : ${source}`);
      }

      if (this.isZipOrOle2(source)) {
        const wb = XLSX.readFile(source, { cellFormula: false });
        const sheetName = wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        return { headers, rows };
      } else {
        return await this.parseHtmlOrMhtmlFile(source);
      }
    }

    throw new Error('Source de fichier non supportée.');
  }

  /**
   * Reads any spreadsheet file as arrays of rows: string[][]
   */
  static async readSpreadsheetAsArrays(source) {
    if (typeof source === 'string') {
      if (!fs.existsSync(source)) {
        throw new Error(`Fichier introuvable : ${source}`);
      }
      if (this.isZipOrOle2(source)) {
        const wb = XLSX.readFile(source, { cellFormula: false });
        const sheetName = wb.SheetNames[0];
        return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
      } else {
        return await this.parseHtmlOrMhtmlFileAsArrays(source);
      }
    }
    throw new Error('Source de fichier non supportée.');
  }
}

module.exports = SpreadsheetReader;
