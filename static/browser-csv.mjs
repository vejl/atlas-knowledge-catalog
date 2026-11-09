/* Browser counterpart of the event CSV checks, used only by the static demo. */
export const COLUMNS = ['event_id', 'title', 'event_date', 'capacity', 'registered'];
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function parse(text, delimiter) {
  const records = []; let cells = [], cell = '', quoted = false, closed = false, line = 1;
  const endCell = () => { cells.push(cell); cell = ''; closed = false; };
  const endRow = () => { endCell(); records.push({values: cells, line}); cells = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else { cell += ch; if (ch === '\n' || (ch === '\r' && text[i + 1] !== '\n')) line++; }
    } else if (ch === delimiter) endCell();
    else if (ch === '\n' || ch === '\r') {
      endRow(); if (ch === '\r' && text[i + 1] === '\n') i++; line++;
    } else if (closed) throw new Error(`Malformed CSV near line ${line}; check quoting and delimiters.`);
    else if (ch === '"' && !cell) quoted = true;
    else cell += ch;
  }
  if (quoted) throw new Error(`Malformed CSV near line ${line}; check quoting and delimiters.`);
  if (cell || cells.length || closed) endRow();
  return records;
}
export function checkBrowserCSV(content) {
  if (content.byteLength > 2 * 1024 * 1024) throw new Error('The file exceeds the 2 MB limit.');
  let text;
  try { text = new TextDecoder('utf-8', {fatal: true}).decode(content); }
  catch { throw new Error('Save the file as UTF-8 CSV before uploading it.'); }
  if (!text.trim()) throw new Error('The CSV file is empty.');
  // Column names are known: choose the candidate containing more required header fields.
  const candidates = [',', ';'].map(delimiter => {
    try { const header = parse(text.split(/\r?\n/,1)[0], delimiter)[0]?.values || []; return {delimiter, score: header.filter(v => COLUMNS.includes(v)).length}; }
    catch (error) { return {delimiter, error, score: -1}; }
  }).sort((a, b) => b.score - a.score);
  const candidate = candidates[0]; if (candidate.error) throw candidate.error;
  const {delimiter} = candidate; const records=parse(text,delimiter); const header = records.shift()?.values || [];
  if (new Set(header).size !== header.length) throw new Error('The header contains duplicate column names.');
  const issues = []; let rows = 0;
  const issue = (row, column, message, severity = 'error') => issues.push({row, column, message, severity});
  const result = () => ({rows, delimiter, issues, errors: issues.filter(i => i.severity === 'error').length, warnings: issues.filter(i => i.severity === 'warning').length});
  for (const name of COLUMNS) if (!header.includes(name)) issue(1, name, 'Required column is missing.');
  if (issues.length) return result();
  const seen = new Map();
  for (const {values, line} of records) {
    if (values.every(v => !v.trim())) continue;
    rows++;
    if (values.length !== header.length) { issue(line, '(row)', 'Field count does not match the header.'); continue; }
    const row = Object.fromEntries(header.map((name, i) => [name, values[i].trim()]));
    for (const name of COLUMNS) if (!row[name]) issue(line, name, 'A value is required.');
    if (row.event_id) {
      if (seen.has(row.event_id)) issue(line, 'event_id', `Duplicate ID; first seen on line ${seen.get(row.event_id)}.`);
      else seen.set(row.event_id, line);
    }
    if (row.event_date && !validDate(row.event_date)) issue(line, 'event_date', 'Use a real calendar date in YYYY-MM-DD format.');
    const numbers = {};
    for (const name of ['capacity', 'registered']) {
      if (!row[name]) continue;
      if (!/^[0-9]{1,12}$/.test(row[name])) issue(line, name, 'Use a non-negative whole number (at most 12 digits).');
      else numbers[name] = Number(row[name]);
    }
    if (numbers.registered > numbers.capacity) issue(line, 'registered', 'Registrations exceed the event capacity.', 'warning');
  }
  return result();
}
