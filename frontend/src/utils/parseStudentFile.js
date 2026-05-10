import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const REQUIRED_FIELDS = ['id', 'name', 'department'];
const OPTIONAL_FIELDS = ['photo'];
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

const FIELD_ALIASES = {
  id: ['id', 'student_id', 'student id', 'studentid'],
  name: ['name', 'full_name', 'full name', 'fullname'],
  department: ['department'],
  photo: ['photo'],
};

export function usernameFromStudentId(studentId) {
  return String(studentId || '').trim().replace(/\//g, '');
}

/**
 * Normalizes a header row by mapping each key to its lowercase equivalent.
 * Returns a mapping from lowercase field name -> original key in the row object.
 */
function buildHeaderMap(keys) {
  const map = {};
  for (const key of keys) {
    map[key.toLowerCase().trim()] = key;
  }
  return map;
}

/**
 * Maps a raw row object (with arbitrary-case keys) to a normalized StudentRow.
 * Returns null if any required field is missing or empty.
 */
function normalizeRow(rawRow) {
  const headerMap = buildHeaderMap(Object.keys(rawRow));
  const row = {};

  for (const field of ALL_FIELDS) {
    const originalKey = FIELD_ALIASES[field]
      .map((alias) => headerMap[alias])
      .find((key) => key !== undefined);
    const value = originalKey !== undefined ? String(rawRow[originalKey] ?? '').trim() : '';
    row[field] = value || null;
  }

  const missingRequired = REQUIRED_FIELDS.some((f) => !row[f]);
  if (missingRequired) return null;

  return {
    ...row,
    student_id: row.id,
    full_name: row.name,
    username: usernameFromStudentId(row.id),
  };
}

/**
 * Parses a CSV file using PapaParse.
 * @param {File} file
 * @returns {Promise<{ rows: object[], skipped: number }>}
 */
function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const rows = [];
        let skipped = 0;
        for (const raw of results.data) {
          const normalized = normalizeRow(raw);
          if (normalized) {
            rows.push(normalized);
          } else {
            skipped++;
          }
        }
        resolve({ rows, skipped });
      },
      error(err) {
        reject(err);
      },
    });
  });
}

/**
 * Parses an Excel (.xlsx) file using SheetJS.
 * @param {File} file
 * @returns {Promise<{ rows: object[], skipped: number }>}
 */
function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        const rows = [];
        let skipped = 0;
        for (const raw of rawRows) {
          const normalized = normalizeRow(raw);
          if (normalized) {
            rows.push(normalized);
          } else {
            skipped++;
          }
        }
        resolve({ rows, skipped });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses a .csv or .xlsx file and returns valid student rows plus a skipped count.
 * Rows missing any required field (student_id/id, full_name/name, department) are skipped.
 *
 * @param {File} file
 * @returns {Promise<{ rows: Array<{ id: string, student_id: string, username: string, name: string, full_name: string, department: string, photo: string|null }>, skipped: number }>}
 */
export async function parseFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    return parseCSV(file);
  } else if (name.endsWith('.xlsx')) {
    return parseXLSX(file);
  } else {
    throw new Error('Unsupported file type. Only .csv and .xlsx files are supported.');
  }
}
