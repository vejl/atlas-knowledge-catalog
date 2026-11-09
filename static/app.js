/* Atlas uses a small amount of browser JavaScript; the server owns all data rules. */
import { setupDictation } from './dictation.mjs?v=editor-10';
import { setupTextEditor } from './text-history.mjs?v=editor-10';
import {DEMO_MODE, demoRequest, resetDemo} from './browser-demo.mjs';
const paths = {
  catalog: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/><rect x="14" y="15" width="7" height="6" rx="1.5"/>',
  check: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 14l3 3 5-5"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4M18 4h4"/>',
  document: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/>',
  dataset: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',
  report: '<path d="M4 3v18h17M9 16v-5M14 16V7M19 16v-8"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  link: '<path d="m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(0 0) scale(.9)"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  undo: '<path d="m8 3-5 5 5 5M3 8h11a7 7 0 0 1 0 14"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.document}</svg>`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main = document.querySelector('main');
const dialog = document.querySelector('#resource-dialog');
const state = { page: 'catalog', resources: [], all: [], tags: [], type: '', tag: '', query: '', status: {}, drafts: [], requestId: '', searchVersion: 0 };
let toastTimer;
let dictation;
let requestEditor;

async function api(path, options = {}) {
  if (DEMO_MODE) return demoRequest(path, options);
  let response;
  try { response = await fetch(path, options); }
  catch (error) { throw new Error('Atlas could not reach the local server. Check that it is running, then try again.'); }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The server returned an unexpected response. Please try again.');
  }
  const body = await response.json();
  if (!response.ok) {
    const detail = Array.isArray(body.detail) ? body.detail.map(e => `${e.loc.slice(1).join('.')}: ${e.msg}`).join('; ') : body.detail;
    throw new Error(detail || 'The request could not be completed.');
  }
  return body;
}
function jsonOptions(method, body) { return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
function toast(message, tone = 'success') {
  const box = document.querySelector('#toast'); box.textContent = message; box.dataset.tone = tone; box.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { box.hidden = true; }, 4500);
}
function errorBox(message) { return `<div class="error-box" role="alert">${esc(message)}</div>`; }
let fieldErrorNumber = 0;
function clearFieldError(field) {
  const id = field.dataset.errorId;
  if (!id) return;
  document.getElementById(id)?.remove();
  const descriptions = (field.getAttribute('aria-describedby') || '').split(' ').filter(value => value && value !== id);
  if (descriptions.length) field.setAttribute('aria-describedby', descriptions.join(' '));
  else field.removeAttribute('aria-describedby');
  field.removeAttribute('aria-invalid'); delete field.dataset.errorId;
}
function validateForm(form) {
  let firstInvalid;
  for (const field of form.querySelectorAll('input, select, textarea')) {
    clearFieldError(field);
    const draft = field.closest('[data-draft]');
    if (!field.willValidate || (draft && !draft.querySelector('input[type="checkbox"]').checked)) continue;
    let message = '';
    if (field.validity.valueMissing || (field.required && !field.value.trim())) {
      message = field.tagName === 'SELECT' ? 'Choose an option.' : 'Enter a value for this field.';
    } else if (field.validity.typeMismatch && field.type === 'url') {
      message = 'Enter a complete URL, for example https://example.com.';
    } else if (field.validity.badInput || (field.type === 'date' && !field.validity.valid)) {
      message = 'Enter a valid date.';
    } else if (!field.validity.valid) {
      message = field.validationMessage;
    }
    if (!message) continue;
    const id = `field-error-${++fieldErrorNumber}`;
    const hint = document.createElement('span'); hint.id = id; hint.className = 'field-error'; hint.textContent = message;
    field.insertAdjacentElement('afterend', hint);
    field.dataset.errorId = id; field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), id].filter(Boolean).join(' '));
    firstInvalid ||= field;
  }
  firstInvalid?.focus();
  return !firstInvalid;
}
// Keep constraint checks, but present errors in Atlas instead of browser bubbles.
document.addEventListener('submit', event => {
  if (!validateForm(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
document.addEventListener('input', event => clearFieldError(event.target));
document.addEventListener('change', event => clearFieldError(event.target));
function initials(name) { return name.split(/\s+/).slice(0, 2).map(x => x[0]).join(''); }
function dateLabel(date) { return date ? new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}) : 'Not reviewed'; }
function typeBadge(type) { return `<span class="badge ${esc(type)}">${esc(type)}</span>`; }
function tagsHTML(tags) { return tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join(''); }
function safeLink(url, label) { return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label || url)} ↗</a>` : '<span class="muted">Not provided</span>'; }

async function refresh() {
  [state.all, state.tags, state.status] = await Promise.all([api('/api/resources'), api('/api/tags'), api('/api/status')]);
  document.querySelector('#nav-count').textContent = state.status.resources;
}
function pageHead(eyebrow, title, subtitle, action = '') {
  return `<div class="page-head"><div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`;
}
function statsHTML() {
  const reviewed = state.all.filter(r => r.owner && r.reviewed_on).length;
  return `<section class="stats" aria-label="Catalogue summary">${[
    ['Total resources', state.all.length, 'One shared source of context', 'catalog'],
    ['Datasets', state.all.filter(r => r.type === 'dataset').length, 'Data with a little more meaning', 'dataset'],
    ['Connections', state.status.relations, 'Links between what you know', 'link'],
    ['Metadata complete', `${reviewed}/${state.all.length}`, 'Owner and review date provided', 'shield'],
  ].map(([label,value,note,symbol]) => `<div class="stat"><span class="stat-icon">${icon(symbol)}</span><div class="stat-label">${label}</div><div class="stat-number">${value}</div><small>${note}</small></div>`).join('')}</section>`;
}

function renderCatalog() {
  main.innerHTML = pageHead('KNOWLEDGE, CONNECTED', 'Knowledge catalogue', 'Find the right resource. Understand the context. Keep your team on the same page.', `<button class="button primary" id="new-resource">${icon('plus')}Add resource</button>`) +
    statsHTML() + `<section class="catalogue-panel" aria-label="Resources">
      <div class="panel-toolbar"><div class="tabs" role="group" aria-label="Filter resource type">${[['','All resources'],['document','Documents'],['dataset','Datasets'],['report','Reports']].map(([value,label]) => `<button class="tab ${state.type === value ? 'active' : ''}" data-type="${value}" aria-pressed="${state.type === value}">${label}<span class="tab-count">${state.all.filter(r => !value || r.type === value).length}</span></button>`).join('')}</div><span class="resource-count">Your team's shared library</span></div>
      <div class="filterbar"><div class="searchbox">${icon('search')}<input class="input" id="catalog-search" aria-label="Search resources" placeholder="Search by name or description…" value="${esc(state.query)}" maxlength="180"></div><select id="tag-filter" class="tag-select" aria-label="Filter by tag"><option value="">All tags</option>${state.tags.map(tag => `<option ${tag === state.tag ? 'selected' : ''} value="${esc(tag)}">${esc(tag)}</option>`).join('')}</select></div>
      <div id="resource-results"></div></section>
      <div class="insight">${icon('link')}<div><strong>Knowledge is better connected.</strong><p>Link a dataset to its guide, or a report to its source. Give the next person the full picture.</p></div><a href="#ai">Try the AI assistant ↗</a></div>`;
  main.querySelector('#new-resource').onclick = () => resourceForm();
  main.querySelectorAll('[data-type]').forEach(button => { button.onclick = () => { state.type = button.dataset.type; renderCatalog(); loadResources(); }; });
  let searchTimer;
  main.querySelector('#catalog-search').oninput = (event) => {
    state.query = event.target.value;
    clearTimeout(searchTimer); searchTimer = setTimeout(loadResources, 180);
  };
  main.querySelector('#tag-filter').onchange = (event) => { state.tag = event.target.value; loadResources(); };
}
async function loadResources() {
  const version = ++state.searchVersion;
  try {
    const params = new URLSearchParams({q:state.query,type:state.type,tag:state.tag});
    const resources = await api('/api/resources?' + params);
    if (version !== state.searchVersion || state.page !== 'catalog') return;
    state.resources = resources;
    const container = main.querySelector('#resource-results');
    if (!container) return;
    container.innerHTML = resources.length ? `<div class="table-scroll"><table class="resource-table"><thead><tr><th>RESOURCE NAME</th><th>TYPE</th><th class="hide-small">OWNER</th><th class="hide-medium">TAGS</th><th class="hide-small">LAST REVIEWED</th></tr></thead><tbody>${resources.map(r => `<tr><td><div class="resource-name"><span class="type-icon ${esc(r.type)}">${icon(r.type)}</span><div><button data-open="${r.id}">${esc(r.title)}</button><small>${esc(r.description || 'Add a description to give this resource context.')}</small></div></div></td><td>${typeBadge(r.type)}</td><td class="hide-small"><span class="owner">${r.owner ? `<span class="owner-avatar">${esc(initials(r.owner))}</span>${esc(r.owner)}` : '<span class="muted">Unassigned</span>'}</span></td><td class="hide-medium">${tagsHTML(r.tags.slice(0,2))}</td><td class="hide-small"><span class="date">${dateLabel(r.reviewed_on)}</span></td></tr>`).join('')}</tbody></table></div><div class="table-footer"><span>Showing ${resources.length} of ${state.all.length} resources</span><span>${icon('shield')}${DEMO_MODE ? 'Saved in this browser' : 'Stored locally in SQLite'}</span></div>` : `<div class="empty">${icon('search')}<strong>No resources found</strong><p>Try another search or tag, or add a resource to the catalogue.</p></div>`;
    container.querySelectorAll('[data-open]').forEach(button => { button.onclick = () => showDetail(Number(button.dataset.open)); });
  } catch (error) { if (state.page === 'catalog') main.querySelector('#resource-results').innerHTML = errorBox(error.message); }
}

function openDialog(content) {
  document.querySelector('#dialog-content').innerHTML = content;
  if (!dialog.open) dialog.showModal();
  dialog.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => dialog.close(); });
}
function dialogHead(eyebrow, title) { return `<div class="dialog-head"><div><div class="eyebrow">${eyebrow}</div><h2 id="dialog-title">${esc(title)}</h2></div><button class="close-button" data-close aria-label="Close dialog">${icon('close')}</button></div>`; }

async function showDetail(id) {
  try {
    const r = await api('/api/resources/' + id);
    openDialog(dialogHead('RESOURCE / ' + r.type.toUpperCase(), r.title) + `<div class="dialog-body">${typeBadge(r.type)}<p class="detail-description">${esc(r.description || 'No description yet.')}</p><div>${tagsHTML(r.tags)}</div><dl class="metadata-grid"><div><dt>Owner</dt><dd>${esc(r.owner || 'Unassigned')}</dd></div><div><dt>Last reviewed</dt><dd>${dateLabel(r.reviewed_on)}</dd></div><div><dt>Source link</dt><dd>${safeLink(r.url)}</dd></div><div><dt>Resource ID</dt><dd>ATL-${String(r.id).padStart(3,'0')}</dd></div></dl><h3>Connections <span class="muted">(${r.relations.length})</span></h3><div class="link-list">${r.relations.length ? r.relations.map(l => `<div class="link-item">${icon('link')}<span>${l.source_id === id ? esc(l.kind) : 'Incoming: ' + esc(l.kind)}</span><button class="text-button" data-linked="${l.source_id === id ? l.target_id : l.source_id}">${esc(l.source_id === id ? l.target_title : l.source_title)}</button></div>`).join('') : '<p class="small-note muted">No connections yet. Link this resource to its documentation, source or related work.</p>'}</div><h3>Add a connection</h3><form novalidate id="relation-form" class="relation-form"><select name="kind" aria-label="Relationship type"><option>describes</option><option>derived from</option><option>related to</option></select><select name="target_id" required aria-label="Target resource"><option value="">Choose a resource…</option>${state.all.filter(x => x.id !== id).map(x => `<option value="${x.id}">${esc(x.title)}</option>`).join('')}</select><button class="button" type="submit">Add link</button></form><div id="relation-error"></div><div class="dialog-actions"><button class="button" data-close>Close</button><button class="button primary" id="edit-resource">Edit resource</button></div></div>`);
    dialog.querySelectorAll('[data-linked]').forEach(b => { b.onclick = () => showDetail(Number(b.dataset.linked)); });
    dialog.querySelector('#edit-resource').onclick = () => resourceForm(r);
    dialog.querySelector('#relation-form').onsubmit = async (event) => {
      event.preventDefault(); const form = event.target; const submit = form.querySelector('button'); submit.disabled = true;
      try {
        await api(`/api/resources/${id}/relations`, jsonOptions('POST', {target_id:Number(form.elements.target_id.value),kind:form.elements.kind.value}));
        await refresh(); await showDetail(id); toast('Connection added.');
      } catch (error) { dialog.querySelector('#relation-error').innerHTML = errorBox(error.message); submit.disabled = false; }
    };
  } catch (error) { toast(error.message, 'error'); }
}
function resourceForm(resource = {}) {
  const r = {title:'',type:'document',description:'',owner:'',url:'',reviewed_on:'',tags:[],...resource};
  openDialog(dialogHead('KEEP KNOWLEDGE USEFUL', r.id ? 'Edit resource' : 'Add a resource') + `<form novalidate id="resource-form" class="dialog-body"><div class="form-field"><label for="form-title">Name *</label><input class="input" id="form-title" name="title" value="${esc(r.title)}" required maxlength="180" placeholder="e.g. Volunteer registration guide"></div><div class="field-row"><div class="form-field"><label for="form-type">Resource type *</label><select id="form-type" name="type">${['document','dataset','report'].map(t => `<option ${t === r.type ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="form-field"><label for="form-owner">Owner</label><input class="input" id="form-owner" name="owner" maxlength="120" value="${esc(r.owner)}" placeholder="Who is responsible?"></div></div><div class="form-field"><label for="form-description">Description</label><textarea id="form-description" name="description" maxlength="4000" placeholder="What is this resource for?">${esc(r.description)}</textarea></div><div class="field-row"><div class="form-field"><label for="form-date">Last reviewed</label><input id="form-date" name="reviewed_on" type="date" value="${esc(r.reviewed_on || '')}"></div><div class="form-field"><label for="form-url">Source URL</label><input class="input" id="form-url" name="url" type="url" maxlength="1000" value="${esc(r.url)}" placeholder="https://…"></div></div><div class="form-field"><label for="form-tags">Tags · separate with commas</label><input class="input" id="form-tags" name="tags" value="${esc(r.tags.join(', '))}" placeholder="events, onboarding"></div><div id="form-error"></div><div class="dialog-actions"><button class="button" type="button" data-close>Cancel</button><button class="button primary" type="submit">${r.id ? 'Save changes' : 'Add resource'}</button></div></form>`);
  dialog.querySelector('#resource-form').onsubmit = async (event) => {
    event.preventDefault(); const form = event.target; const button = form.querySelector('[type=submit]'); button.disabled = true;
    const data = Object.fromEntries(new FormData(form));
    data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean); data.reviewed_on = data.reviewed_on || null;
    try {
      await api('/api/resources' + (r.id ? '/' + r.id : ''), jsonOptions(r.id ? 'PUT' : 'POST', data));
      dialog.close(); await refresh();
      if (state.page === 'catalog') { renderCatalog(); await loadResources(); }
      toast(r.id ? 'Resource updated.' : 'Resource added to the catalogue.');
    } catch (error) { dialog.querySelector('#form-error').innerHTML = errorBox(error.message); button.disabled = false; }
  };
}

function renderCSV() {
  main.innerHTML = pageHead('CONFIDENCE STARTS WITH CLEAN DATA', 'CSV quality check', 'Catch the small inconsistencies before they become someone else’s problem.') + `<div class="page-grid"><section class="card"><div class="card-heading">${icon('check')}<h2>Check your event data</h2></div><p>Upload an event CSV to check its structure and values. Your file is analysed locally and is not saved or sent to AI.</p><div class="dropzone" id="dropzone">${icon('upload')}<strong>Drop your CSV here</strong><p>UTF-8 · comma or semicolon · up to 2 MB</p><div class="file-picker"><input type="file" id="csv-file" accept=".csv,text/csv" hidden><button class="button" type="button" id="choose-csv">Choose CSV file</button><span class="file-name" id="csv-filename" role="status">No file selected</span></div></div><div class="sample-links"><a href="/samples/events-valid.csv" download>↓ Valid sample</a><a href="/samples/events-errors.csv" download>↓ Sample with errors</a><a href="/samples/events-semicolon.csv" download>↓ Semicolon sample</a></div><div id="csv-error"></div></section><aside class="card"><div class="eyebrow">THE EXPECTED SHAPE</div><h2>Five columns. Clear rules.</h2><table class="schema-table"><tbody><tr><td>event_id</td><td>Required & unique</td></tr><tr><td>title</td><td>Required text</td></tr><tr><td>event_date</td><td>YYYY-MM-DD</td></tr><tr><td>capacity</td><td>Whole number ≥ 0</td></tr><tr><td>registered</td><td>Whole number ≥ 0</td></tr></tbody></table><p class="small-note">Registrations above capacity are flagged as a warning. Missing values, duplicate IDs and invalid dates are errors. Row numbers refer to physical lines, including the header.</p></aside></div><div id="csv-results" class="results" aria-live="polite"></div>`;
  main.querySelector('#choose-csv').onclick = () => main.querySelector('#csv-file').click();
  main.querySelector('#csv-file').onchange = (event) => { if (event.target.files[0]) checkFile(event.target.files[0]); event.target.value = '';  };
  const dropzone = main.querySelector('#dropzone');
  dropzone.ondragover = (event) => { event.preventDefault(); dropzone.classList.add('dragging'); };
  dropzone.ondragleave = () => dropzone.classList.remove('dragging');
  dropzone.ondrop = (event) => { event.preventDefault(); dropzone.classList.remove('dragging'); if (event.dataTransfer.files[0]) checkFile(event.dataTransfer.files[0]); };
}
async function checkFile(file) {
  const errorEl = main.querySelector('#csv-error'); const results = main.querySelector('#csv-results');
  main.querySelector('#csv-filename').textContent = file.name;
  errorEl.innerHTML = ''; results.innerHTML = '<div class="loading"><span class="spinner"></span>Checking your file…</div>';
  try {
    if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Choose a CSV file (.csv). You can download a sample below.');
    if (file.size > 2 * 1024 * 1024) throw new Error('The file exceeds the 2 MB limit.');
    const data = new FormData(); data.append('file', file);
    const result = await api('/api/csv/check', {method:'POST',body:data});
    if (state.page !== 'csv') return;
    results.innerHTML = `<section class="card"><div class="results-head"><div><div class="eyebrow">${esc(file.name)}</div><h2>${result.rows} rows checked</h2></div><div class="result-pills"><span class="pill ${result.errors ? 'error' : ''}">${result.errors} errors</span><span class="pill ${result.warnings ? 'warning' : ''}">${result.warnings} warning${result.warnings === 1 ? '' : 's'}</span></div></div>${result.issues.length ? `<div class="table-scroll"><table class="issue-table"><thead><tr><th>LINE</th><th>COLUMN</th><th>LEVEL</th><th>WHAT TO CHECK</th></tr></thead><tbody>${result.issues.map(i => `<tr><td>${i.row}</td><td>${esc(i.column)}</td><td><span class="pill ${i.severity}">${esc(i.severity)}</span></td><td>${esc(i.message)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="success-state">✓ Everything looks consistent. No issues were found for the rules in this check.</div>`}<p class="small-note">Delimiter detected: ${result.delimiter === ';' ? 'semicolon' : 'comma'}. The original data has not been changed.</p></section>`;
  } catch (error) { results.innerHTML = ''; errorEl.innerHTML = errorBox(error.message); }
}

function renderAI() {
  state.drafts = [];
  main.innerHTML = pageHead('A HELPING HAND, WITH YOU IN CONTROL', 'AI assistant', 'Turn scattered notes into useful catalogue entries. Review every suggestion before saving.', `<span class="ai-badge ${state.status.ai_configured ? '' : 'off'}"><span class="status-dot"></span>${DEMO_MODE ? 'Prepared examples' : state.status.ai_configured ? 'Key configured' : 'Setup needed'}</span>`) + `<div class="ai-grid"><section class="card"><div class="card-heading">${icon('spark')}<h2>From notes to knowledge</h2></div><p>Ask about the catalogue, or paste source text to prepare new resources and suggest connections.</p>${!state.status.ai_configured ? '<div class="error-box">Add AI_API_KEY to your local .env file and restart Atlas. See README → AI setup. The catalogue and CSV checks work without a key.</div>' : ''}<form novalidate id="ai-form">${DEMO_MODE ? '<div class="demo-ai-note"><strong>Prepared scenarios, no live AI.</strong><p>The selected scenario determines the example; your request text is not analysed.</p><label for="demo-scenario">Example scenario</label><select id="demo-scenario"><option value="proposal">Draft and human review</option><option value="refusal">Off-topic refusal</option><option value="answer">Metadata explanation</option></select></div>' : ''}<label class="field-label" for="ai-text">YOUR REQUEST OR SOURCE TEXT</label><textarea class="ai-text" id="ai-text" maxlength="12000" required placeholder="Add a document called Volunteer onboarding FAQ. It is owned by Petra Novak and explains volunteer registration…"></textarea><div class="request-edit-tools"><button class="text-button" id="clear-request" type="button">${icon('trash')}Clear</button><button class="text-button" id="undo-request" type="button">${icon('undo')}Undo</button><span>Ctrl+Z · Ctrl+Shift+Z</span></div><div class="ai-actions"><button class="text-button" type="button" id="load-example">Use an example request ↗</button><div class="ai-submit-actions"><button class="button dictation-button" type="button" id="dictate" aria-label="Start dictation" aria-pressed="false" aria-describedby="dictation-privacy"><span class="dictation-mic" aria-hidden="true">${icon('mic')}</span><svg class="dictation-wave" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="9" width="2.5" height="6" rx="1.25"/><rect x="6.5" y="5" width="2.5" height="14" rx="1.25"/><rect x="11" y="2" width="2.5" height="20" rx="1.25"/><rect x="15.5" y="6" width="2.5" height="12" rx="1.25"/><rect x="20" y="9" width="2.5" height="6" rx="1.25"/></svg><span data-dictation-label>Dictate</span></button><button class="button primary" type="submit" id="ask-ai">${icon('spark')}${DEMO_MODE ? 'Show example' : 'Ask Atlas'}</button></div></div><div class="dictation-settings"><label for="dictation-language">Dictation language</label><select id="dictation-language"><option value="sk-SK">Slovenčina</option><option value="cs-CZ">Čeština</option><option value="en-GB">English</option></select></div><p class="dictation-status" id="dictation-status" role="status" aria-live="polite"></p><p class="small-note muted" id="dictation-privacy">Dictation uses your browser’s speech service, which may send audio to its provider. It only fills this field; Ask Atlas sends the request.</p></form><div class="field-guide" aria-label="Catalogue fields"><p>Catalogue fields <span>* Required · other fields optional</span></p><div class="field-chips"><span class="field-chip required">Name *</span><span class="field-chip required">Type *</span><span class="field-chip">Owner</span><span class="field-chip">Description</span><span class="field-chip">Reviewed</span><span class="extra-fields" id="extra-fields" hidden><span class="field-chip">URL</span><span class="field-chip">Tags</span><span class="field-chip">Connections</span></span><button class="field-more" id="toggle-fields" type="button" aria-label="Show all catalogue fields" aria-expanded="false" aria-controls="extra-fields">${icon('more')}</button></div><p class="field-guide-note">Type: document, dataset or report. Reviewed means the last review date, not the event date. Leave unknown optional details blank.</p></div><div id="ai-error"></div><p class="ai-disclaimer">${DEMO_MODE ? 'No request or catalogue data is sent to a model in this demo. Download the full app to use your own AI provider.' : `Your request and brief catalogue context are sent to your configured AI provider. Model: ${esc(state.status.model)}. Suggestions can be wrong.`}</p><div class="scope-box"><h3>A focused assistant</h3><p>Atlas helps with catalogue records, metadata, connections and event CSV rules. Unrelated requests are declined through a basic system prompt. You approve every write.</p><div class="scope-tags">${tagsHTML(['catalogue','metadata','csv quality'])}</div></div></section><section class="card" id="ai-output" aria-live="polite"><div class="eyebrow">REVIEW BEFORE YOU SAVE</div><h2>Your suggestions will appear here</h2><div class="empty">${icon('document')}<strong>A draft, not a database change.</strong><p>Atlas proposes the structure.<br>You add the judgement.</p></div></section></div>`;
  main.querySelector('#toggle-fields').onclick = event => {
    const button = event.currentTarget; const expanded = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(expanded)); button.setAttribute('aria-label', expanded ? 'Show fewer catalogue fields' : 'Show all catalogue fields');
    main.querySelector('#extra-fields').hidden = !expanded;
  };
  requestEditor = setupTextEditor({textarea:main.querySelector('#ai-text'), clear:main.querySelector('#clear-request'), undo:main.querySelector('#undo-request')});
  let speechGroup;
  dictation = setupDictation({onSessionStart:() => { speechGroup = Symbol('dictation'); }, onStateChange:() => requestEditor.refresh(), writeText:value => requestEditor.replace(value, {group:speechGroup}), textarea:main.querySelector('#ai-text'), button:main.querySelector('#dictate'), language:main.querySelector('#dictation-language'), status:main.querySelector('#dictation-status'), submit:main.querySelector('#ask-ai'), example:main.querySelector('#load-example')});
  if (DEMO_MODE) {
    main.querySelector('#ai-text').required = false;
    main.querySelector('#dictation-privacy').textContent = 'Dictation uses your browser’s speech service, which may send audio to its provider. This demo only fills the text field; no catalogue AI model is called.';
    main.querySelector('.scope-box p').textContent = 'The full app uses a basic system prompt to keep the assistant focused on catalogue records and CSV rules. This demo shows prepared scenarios. You approve every write.';
    main.querySelector('#demo-scenario').onchange = () => {
      const examples = {proposal:'Add a volunteer onboarding FAQ owned by Petra Novak.',refusal:'Give me a pancake recipe.',answer:'What is catalogue metadata?'};
      requestEditor.replace(examples[main.querySelector('#demo-scenario').value]);
    };
  }
  main.querySelector('#load-example').onclick = async () => {
    try { const response = await fetch('/samples/ai-source.txt'); if (!response.ok) throw new Error('Sample unavailable.'); requestEditor.replace(await response.text()); }
    catch (error) { toast('Could not load the sample request.', 'error'); }
  };
  main.querySelector('#ai-form').onsubmit = async (event) => {
    event.preventDefault(); const button = main.querySelector('#ask-ai'); const errorEl = main.querySelector('#ai-error'); const output = main.querySelector('#ai-output');
    button.disabled = true; main.querySelector('#dictate').disabled = true; errorEl.innerHTML = ''; state.drafts = [];
    output.innerHTML = '<div class="loading"><span class="spinner"></span>Preparing a response…<p class="small-note">Shared university models may take a little time.</p></div>';
    try {
      const result = await api('/api/ai/proposals', jsonOptions('POST',{text:main.querySelector('#ai-text').value,...(DEMO_MODE ? {demo_scenario:main.querySelector('#demo-scenario').value} : {})}));
      if (state.page !== 'ai') return;
      state.drafts = result.records; state.requestId = crypto.randomUUID(); renderAIResult(result);
    } catch (error) { if (state.page === 'ai') { errorEl.innerHTML = errorBox(error.message); output.innerHTML = '<div class="empty"><strong>Nothing was saved.</strong><p>Check the message and try again when ready.</p></div>'; } }
    finally { button.disabled = false; if (state.page === 'ai') main.querySelector('#dictate').disabled = !dictation?.supported; }
  };
}
function renderAIResult(result) {
  const output = main.querySelector('#ai-output');
  output.innerHTML = `<div class="eyebrow">${result.kind === 'proposal' ? 'REVIEW BEFORE YOU SAVE' : 'ATLAS RESPONSE'}</div><div class="assistant-message ${result.kind === 'refusal' ? 'refusal' : ''}">${esc(result.message)}</div>${result.kind === 'proposal' ? `<form novalidate id="draft-form">${result.records.map((r,i) => `<section class="draft" data-draft="${i}"><label class="draft-header"><input type="checkbox" name="include-${i}" checked> Draft ${i+1} ${typeBadge(r.type)}</label><label>Name *<input class="input" name="title" value="${esc(r.title)}" maxlength="180" required></label><div class="field-row"><label>Type<select name="type">${['document','dataset','report'].map(t=>`<option ${t===r.type?'selected':''}>${t}</option>`).join('')}</select></label><label>Owner<input class="input" name="owner" value="${esc(r.owner)}" maxlength="120" placeholder="Unknown — leave empty"></label></div><label>Description<textarea name="description" maxlength="4000">${esc(r.description)}</textarea></label><div class="field-row"><label>Reviewed<input type="date" name="reviewed_on" value="${esc(r.reviewed_on || '')}"></label><label>URL<input class="input" type="url" name="url" value="${esc(r.url)}" maxlength="1000"></label></div><label>Tags<input class="input" name="tags" value="${esc(r.tags.join(', '))}"></label>${r.duplicates.length ? `<div class="duplicate-warning">A matching title already exists: ${r.duplicates.map(d=>esc(d.title)).join(', ')}. Review this possible duplicate before saving.</div>` : ''}${!r.owner || !r.reviewed_on ? '<p class="small-note muted">Some metadata is missing. Add it if you know it, or keep it empty.</p>' : ''}${r.relations.map((link,j) => `<div class="proposed-link"><label><input type="checkbox" name="link-${j}" checked><span>${esc(link.kind)} → ${esc(state.all.find(x=>x.id===link.target_id)?.title || 'Resource ' + link.target_id)}<br>${esc(link.reason)}</span></label></div>`).join('')}</section>`).join('')}<div id="confirm-error"></div><button class="button primary save-proposals" type="submit">Review complete · Save selected drafts</button><p class="small-note">Saving creates catalogue resources, not rows in the original CSV.</p></form>` : ''}`;
  const form = output.querySelector('#draft-form');
  if (form) form.onsubmit = async (event) => {
    event.preventDefault(); const button = form.querySelector('[type=submit]'); button.disabled = true;
    const records = [...form.querySelectorAll('[data-draft]')].filter(section => section.querySelector('[type=checkbox]').checked).map(section => {
      const original = state.drafts[Number(section.dataset.draft)];
      const field = name => section.querySelector(`[name="${name}"]`).value;
      return {title:field('title'),type:field('type'),description:field('description'),owner:field('owner'),url:field('url'),reviewed_on:field('reviewed_on') || null,tags:field('tags').split(',').map(t=>t.trim()).filter(Boolean),relations:original.relations.filter((link,j)=>section.querySelector(`[name="link-${j}"]`).checked)};
    });
    try {
      if (!records.length) throw new Error('Select at least one draft to save.');
      const saved = await api('/api/ai/confirm', jsonOptions('POST',{request_id:state.requestId,records}));
      await refresh(); output.innerHTML = `<div class="eyebrow">REVIEWED AND SAVED</div><h2>${saved.resource_ids.length} resource${saved.resource_ids.length === 1 ? '' : 's'} added</h2><div class="success-state">✓ Your approved drafts are now in the catalogue.</div><p class="small-note">You can edit metadata and add connections from the resource detail.</p><a href="#catalog" class="button">Open catalogue ${icon('arrow')}</a>`;
      toast('Approved resources saved.');
    } catch (error) { output.querySelector('#confirm-error').innerHTML = errorBox(error.message); button.disabled = false; }
  };
}

async function navigate() {
  dictation?.dispose(); dictation = null;
  requestEditor?.dispose(); requestEditor = null;
  const page = location.hash.slice(1);
  state.page = page || 'catalog';
  document.querySelectorAll('[data-page]').forEach(a => { a.classList.toggle('active', a.dataset.page === state.page); if (a.dataset.page === state.page) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  document.querySelector('#breadcrumb-current').textContent = {catalog:'Catalogue',csv:'CSV check',ai:'AI assistant'}[state.page] || 'Page not found';
  if (!['catalog','csv','ai'].includes(state.page)) {
    main.innerHTML = '<section class="not-found"><span class="error-code" aria-label="Error 404">404</span><h1>Page not found.</h1><p>This view is not part of Atlas. Return to your workspace to continue.</p><a class="button primary" href="#catalog">Open catalogue</a></section>';
    return;
  }
  main.innerHTML = '<div class="loading"><span class="spinner"></span>Loading your workspace…</div>';
  try {
    await refresh();
    if (state.page === 'catalog') { renderCatalog(); await loadResources(); }
    else if (state.page === 'csv') renderCSV();
    else renderAI();
  } catch (error) { main.innerHTML = errorBox(error.message) + `<p class="small-note">${DEMO_MODE ? 'Try reloading the page, or use Reset demo to restore the sample data.' : 'Make sure the local Atlas server is running, then reload this page.'}</p>`; }
}
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
window.addEventListener('hashchange', navigate);
navigate();

if (DEMO_MODE) {
  document.querySelector('.local-status').innerHTML = '<span class="status-dot"></span><span>Browser demo<small>Changes stay in this browser</small></span>';
  document.querySelector('.main-footer').lastElementChild.textContent = 'Browser demo · Full Python app available to download';
  const banner = document.createElement('aside'); banner.className = 'demo-banner';
  banner.innerHTML = '<div><strong>Browser demo</strong><span>Try the catalogue and CSV checks. AI uses prepared examples.</span></div><div class="demo-banner-actions"><a class="button primary" href="/downloads/atlas-source.zip" download>Download full app</a><button class="button" id="reset-demo" type="button">Reset demo</button></div><div id="reset-confirm" class="reset-confirm" hidden><span>Restore the sample data? This clears only this browser’s demo changes.</span><button class="button" type="button" id="confirm-reset">Reset this demo</button><button class="text-button" type="button" id="cancel-reset">Cancel</button></div>';
  document.querySelector('.topbar').after(banner);
  banner.querySelector('#reset-demo').onclick = () => { banner.querySelector('#reset-confirm').hidden = false; };
  banner.querySelector('#cancel-reset').onclick = () => { banner.querySelector('#reset-confirm').hidden = true; };
  banner.querySelector('#confirm-reset').onclick = () => { try { resetDemo(); } catch (error) { toast(error.message,'error'); } };
}
