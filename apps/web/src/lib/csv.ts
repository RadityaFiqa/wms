/**
 * Simple and robust CSV parser that handles quotes, commas, and multiline text.
 */
export function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      row.push(cell.trim());
      if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
        result.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.trim());
    result.push(row);
  }

  return result;
}

export interface CSVRowData {
  productName: string;
  sku: string;
  lot: string;
  shelfLife: number;
  expiredDate: string | null;
  placementDate: string;
  locationName: string;
  quantity: number;
  quantum: number;
  uom: string;
  spraying: string | null;
  fumigasi: string | null;
  fogging: string | null;
  keterangan: string | null;
}

/**
 * Validates and maps raw CSV table into structured objects.
 */
export function validateAndMapCSV(csvRows: string[][]): {
  validRows: CSVRowData[];
  errors: string[];
} {
  const errors: string[] = [];
  const validRows: CSVRowData[] = [];

  if (csvRows.length < 2) {
    return { validRows, errors: ['File CSV kosong atau tidak memiliki data.'] };
  }

  // Define expected headers (lowercased for flexibility)
  const expectedHeaders = [
    'no',
    'produk',
    'sku',
    'lot',
    'umur simpan', // or 'umur simpan (bulan)'
    'expired date', // or 'expired date / best before'
    'tanggal penempatan',
    'lokasi',
    'kuantitas',
    'kuantum',
    'uom',
    'spraying',
    'fumigasi',
    'fogging',
    'keterangan',
  ];

  const headers = csvRows[0].map((h) => h.toLowerCase());

  // Helper to find column index by header keyword
  const getColIndex = (keyword: string) => {
    return headers.findIndex((h) => h.includes(keyword));
  };

  const idxNo = getColIndex('no');
  const idxProduk = getColIndex('produk');
  const idxSku = getColIndex('sku');
  const idxLot = getColIndex('lot');
  const idxUmur = getColIndex('umur simpan');
  const idxExp = getColIndex('expired date') !== -1 ? getColIndex('expired date') : getColIndex('best before');
  const idxPenempatan = getColIndex('tanggal penempatan');
  const idxLokasi = getColIndex('lokasi');
  const idxKuantitas = getColIndex('kuantitas');
  const idxKuantum = getColIndex('kuantum');
  const idxUom = getColIndex('uom');
  const idxSpraying = getColIndex('spraying');
  const idxFumigasi = getColIndex('fumigasi');
  const idxFogging = getColIndex('fogging');
  const idxKet = getColIndex('keterangan');

  // Verify necessary columns exist
  const missingColumns: string[] = [];
  if (idxProduk === -1) missingColumns.push('Produk');
  if (idxSku === -1) missingColumns.push('SKU');
  if (idxLot === -1) missingColumns.push('Lot');
  if (idxPenempatan === -1) missingColumns.push('Tanggal Penempatan');
  if (idxLokasi === -1) missingColumns.push('Lokasi');
  if (idxKuantitas === -1) missingColumns.push('Kuantitas');
  if (idxKuantum === -1) missingColumns.push('Kuantum');
  if (idxUom === -1) missingColumns.push('UoM');

  if (missingColumns.length > 0) {
    return {
      validRows,
      errors: [`Format kolom CSV tidak valid. Kolom berikut hilang: ${missingColumns.join(', ')}`],
    };
  }

  // Parse rows (skip header row)
  for (let r = 1; r < csvRows.length; r++) {
    const row = csvRows[r];
    // Skip empty lines
    if (row.length === 0 || (row.length === 1 && row[0] === '')) {
      continue;
    }

    const rowNum = r + 1; // 1-indexed human row number

    // Extract values
    const productName = row[idxProduk] || '';
    const sku = row[idxSku] || '';
    const lot = row[idxLot] || '';
    const locationName = row[idxLokasi] || '';
    const uom = row[idxUom] || '';

    // Validate required text fields
    if (!productName) errors.push(`Baris ${rowNum}: Nama Produk wajib diisi.`);
    if (!sku) errors.push(`Baris ${rowNum}: SKU wajib diisi.`);
    if (!lot) errors.push(`Baris ${rowNum}: Lot wajib diisi.`);
    if (!locationName) errors.push(`Baris ${rowNum}: Lokasi wajib diisi.`);
    if (!uom) errors.push(`Baris ${rowNum}: UoM wajib diisi.`);

    // Parse shelfLife (Umur Simpan)
    const shelfLifeStr = idxUmur !== -1 ? row[idxUmur] : '0';
    const shelfLife = parseInt(shelfLifeStr.replace(/[^\d]/g, ''), 10) || 0;

    // Parse and validate numbers
    const cleanNumber = (val: string) => {
      if (!val) return 0;
      // remove thousand separators (dots or commas)
      const cleaned = val.replace(/,/g, '');
      return parseFloat(cleaned) || 0;
    };

    const quantity = cleanNumber(row[idxKuantitas]);
    const quantum = cleanNumber(row[idxKuantum]);

    if (isNaN(quantity) || quantity < 0) {
      errors.push(`Baris ${rowNum}: Kuantitas tidak valid (${row[idxKuantitas]}).`);
    }
    if (isNaN(quantum) || quantum < 0) {
      errors.push(`Baris ${rowNum}: Kuantum tidak valid (${row[idxKuantum]}).`);
    }

    // Parse and validate Dates
    const placementDateStr = row[idxPenempatan] || '';
    const placementDate = parseFormattedDate(placementDateStr);
    if (!placementDate) {
      errors.push(`Baris ${rowNum}: Tanggal Penempatan tidak valid atau kosong (${placementDateStr}). Gunakan format DD MMM YYYY (contoh: 06 March 2026 atau 06 Mar 2026).`);
    }

    const expiredDateStr = idxExp !== -1 ? row[idxExp] : '';
    let expiredDate: string | null = null;
    if (expiredDateStr && expiredDateStr !== '-' && expiredDateStr !== '0') {
      const parsedExp = parseFormattedDate(expiredDateStr);
      if (!parsedExp) {
        errors.push(`Baris ${rowNum}: Expired Date tidak valid (${expiredDateStr}).`);
      } else {
        expiredDate = parsedExp;
      }
    }

    // Spraying, Fumigasi, Fogging (Dates or "-")
    const cleanTreatmentDate = (val: string | undefined) => {
      if (!val || val === '-' || val === '0') return null;
      const parsed = parseFormattedDate(val);
      return parsed ? parsed : val; // Return formatted ISO string if parsed, otherwise original string
    };

    const spraying = idxSpraying !== -1 ? cleanTreatmentDate(row[idxSpraying]) : null;
    const fumigasi = idxFumigasi !== -1 ? cleanTreatmentDate(row[idxFumigasi]) : null;
    const fogging = idxFogging !== -1 ? cleanTreatmentDate(row[idxFogging]) : null;
    const keterangan = idxKet !== -1 ? row[idxKet] || null : null;

    if (errors.length === 0) {
      validRows.push({
        productName,
        sku,
        lot,
        shelfLife,
        expiredDate,
        placementDate: placementDate || '',
        locationName,
        quantity,
        quantum,
        uom,
        spraying,
        fumigasi,
        fogging,
        keterangan,
      });
    }
  }

  return { validRows: errors.length === 0 ? validRows : [], errors };
}

/**
 * Parses date strings in formats like "6 March 2026", "06 Mar 2026", "2026-03-06"
 * and returns standard ISO date string (YYYY-MM-DD) or null if invalid.
 */
function parseFormattedDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (trimmed === '-' || trimmed === '') return null;

  // Try standard parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  // Indonesian month helper
  const monthsInd = {
    jan: 0, januari: 0,
    feb: 1, februari: 1,
    mar: 2, maret: 2,
    apr: 3, april: 3,
    mei: 4,
    jun: 5, juni: 5,
    jul: 6, juli: 6,
    agt: 7, agustus: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9,
    nov: 10, november: 10,
    des: 11, desember: 11,
  };

  // Try parsing custom format "dd Mon yyyy" or "dd Month yyyy"
  const parts = trimmed.split(/\s+/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].toLowerCase();
    const year = parseInt(parts[2], 10);

    let month = -1;
    // Check English months
    const engDate = new Date(`${monthStr} 1, 2000`);
    if (!isNaN(engDate.getTime())) {
      month = engDate.getMonth();
    } else {
      // Check Indonesian months
      month = monthsInd[monthStr as keyof typeof monthsInd] ?? -1;
    }

    if (day > 0 && day <= 31 && month >= 0 && year > 1900) {
      const parsedDate = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }
    }
  }

  return null;
}
