import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Papa from 'papaparse';
import { parseFile } from './parseStudentFile.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a File object from a CSV string */
function csvFile(content, name = 'students.csv') {
  return new File([content], name, { type: 'text/csv' });
}

/** Arbitrary for a non-empty, non-whitespace string (safe for CSV cells).
 * Values are trimmed by the parser, so we exclude leading/trailing whitespace
 * to keep expected == actual comparisons straightforward. */
const safeStringArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter(
    (s) =>
      s.trim().length > 0 &&
      s === s.trim() &&
      !s.includes(',') &&
      !s.includes('\n') &&
      !s.includes('"')
  );

/** Arbitrary for a valid student row object */
const validRowArb = fc.record({
  id: safeStringArb,
  name: safeStringArb,
  department: safeStringArb,
});

/** Arbitrary for a valid student row with an optional photo field */
const validRowWithPhotoArb = fc.record({
  id: safeStringArb,
  name: safeStringArb,
  department: safeStringArb,
  photo: fc.oneof(fc.constant(''), safeStringArb),
});

/** Convert an array of row objects to a CSV string with a header row */
function rowsToCSV(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => row[h] ?? '').join(','));
  }
  return lines.join('\n');
}

/** Shuffle an array (returns a new array) */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Property 5: File parser maps header columns to correct fields
// **Feature: admin-student-management, Property 5: File parser maps header columns to correct fields**
// ---------------------------------------------------------------------------
describe('parseFile', () => {
  it('Property 5: maps header columns to correct fields regardless of column order', async () => {
    // **Feature: admin-student-management, Property 5: File parser maps header columns to correct fields**
    // **Validates: Requirements 4.4**
    await fc.assert(
      fc.asyncProperty(fc.array(validRowArb, { minLength: 1, maxLength: 10 }), async (inputRows) => {
        // Shuffle column order to verify case-insensitive header mapping
        const headers = shuffle(['id', 'name', 'department']);
        const lines = [headers.join(',')];
        for (const row of inputRows) {
          lines.push(headers.map((h) => row[h]).join(','));
        }
        const csv = lines.join('\n');
        const file = csvFile(csv);

        const { rows } = await parseFile(file);

        expect(rows).toHaveLength(inputRows.length);
        for (let i = 0; i < inputRows.length; i++) {
          expect(rows[i].id).toBe(inputRows[i].id);
          expect(rows[i].student_id).toBe(inputRows[i].id);
          expect(rows[i].username).toBe(inputRows[i].id.replace(/\//g, ''));
          expect(rows[i].name).toBe(inputRows[i].name);
          expect(rows[i].full_name).toBe(inputRows[i].name);
          expect(rows[i].department).toBe(inputRows[i].department);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ---------------------------------------------------------------------------
  // Property 6: File parser skips rows with missing required fields
  // **Feature: admin-student-management, Property 6: File parser skips rows with missing required fields**
  // ---------------------------------------------------------------------------
  it('Property 6: skips rows with missing required fields and counts them', async () => {
    // **Feature: admin-student-management, Property 6: File parser skips rows with missing required fields**
    // **Validates: Requirements 4.5**
    await fc.assert(
      fc.asyncProperty(
        fc.array(validRowArb, { minLength: 0, maxLength: 8 }),
        fc.array(
          fc.record({
            id: fc.oneof(fc.constant(''), safeStringArb),
            name: fc.oneof(fc.constant(''), safeStringArb),
            department: fc.oneof(fc.constant(''), safeStringArb),
          }).filter((r) => {
            // At least one required field must be empty to make the row invalid
            return !r.id.trim() || !r.name.trim() || !r.department.trim();
          }),
          { minLength: 0, maxLength: 5 }
        ),
        async (validRows, invalidRows) => {
          const allRows = [...validRows, ...invalidRows];
          if (allRows.length === 0) return; // skip trivial case

          const headers = ['id', 'name', 'department'];
          const lines = [headers.join(',')];
          for (const row of allRows) {
            lines.push(headers.map((h) => row[h] ?? '').join(','));
          }
          const csv = lines.join('\n');
          const file = csvFile(csv);

          const { rows, skipped } = await parseFile(file);

          // Valid rows should all be present
          expect(rows).toHaveLength(validRows.length);
          // Skipped count should equal the number of invalid rows
          expect(skipped).toBe(invalidRows.length);
          // Total should equal input
          expect(rows.length + skipped).toBe(allRows.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
