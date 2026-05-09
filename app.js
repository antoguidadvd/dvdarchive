/* ═══════════════════════════════════════════════════════════
   app.js — DVD Collection
   Dipende da: auth.js · db.js (Supabase async)
═══════════════════════════════════════════════════════════ */

// ── Auth guard ──────────────────────────────────────────────
if (!sessionStorage.getItem('dvd_auth')) {
  window.location.href = 'index.html';
}

/* ═══════════════════════════════════════════════════════════
   STATO
═══════════════════════════════════════════════════════════ */
const state = {
  all:       [],
  filtered:  [],
  sortCol:   'titolo',
  sortDir:   'asc',
  editingId: null,
  deleteId:  null,
  loading:   false,
};

/* ═══════════════════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const els = {
  tableBody:      $('tableBody'),
  cardsGrid:      $('cardsGrid'),
  emptyState:     $('emptyState'),
  statTotal:      $('statTotal'),
  statFiltered:   $('statFiltered'),
  rcTotal:        $('rcTotal'),
  rcFiltered:     $('rcFiltered'),
  sortInfo:       $('sortInfo'),
  fSearch:        $('fSearch'),
  fRegista:       $('fRegista'),
  fAnno:          $('fAnno'),
  fFormato:       $('fFormato'),
  fRegione:       $('fRegione'),
  fCollana:       $('fCollana'),
  btnReset:       $('btnReset'),
  btnAdd:         $('btnAdd'),
  btnLogout:      $('btnLogout'),
  modalOverlay:   $('modalOverlay'),
  modalTitle:     $('modalTitle'),
  modalClose:     $('modalClose'),
  btnCancel:      $('btnCancel'),
  btnSave:        $('btnSave'),
  fTitolo:        $('fTitolo'),
  fRegista2:      $('fRegista2'),
  fAnno2:         $('fAnno2'),
  fDurata:        $('fDurata'),
  fFormato2:      $('fFormato2'),
  fRegione2:      $('fRegione2'),
  fIsCollana:     $('fIsCollana'),
  collanaField:   $('collanaField'),
  fCollana2:      $('fCollana2'),
  fNote:          $('fNote'),
  confirmOverlay: $('confirmOverlay'),
  confirmTitle:   $('confirmTitle'),
  confirmCancel:  $('confirmCancel'),
  confirmDel:     $('confirmDel'),
  toast:          $('toast'),
};

/* ═══════════════════════════════════════════════════════════
   LOADING
═══════════════════════════════════════════════════════════ */
function setLoading(on) {
  state.loading = on;
  if (els.btnAdd)  els.btnAdd.disabled  = on;
  if (els.btnSave) els.btnSave.disabled = on;
  if (on) els.btnSave.textContent = 'Salvataggio…';
  else    els.btnSave.textContent = 'SALVA';
}

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
async function init() {
  setDbStatus('connecting');
  try {
    state.all = await DB.getAll();
    setDbStatus('ok');
    rebuildFilterOptions();
    applyFiltersAndRender();
    bindEvents();
  } catch (e) {
    setDbStatus('error');
    console.error(e);
  }
}

function setDbStatus(status) {
  let el = document.getElementById('dbStatus');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dbStatus';
    el.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:0.72rem;color:var(--text2);background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:5px 10px;flex-shrink:0;';
    const btnAdd = document.getElementById('btnAdd');
    btnAdd.parentNode.insertBefore(el, btnAdd);
  }
  const colors = { ok:'#3ecf8e', error:'#e05252', connecting:'#f5c842' };
  const labels = { ok:'DB connesso', error:'DB non raggiungibile', connecting:'Connessione…' };
  const anim   = status === 'connecting' ? 'animation:pulse 1s infinite;' : '';
  el.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${colors[status]};${anim}"></span>${labels[status]}`;
  if (!document.getElementById('dbStatusStyle')) {
    const s = document.createElement('style');
    s.id = 'dbStatusStyle';
    s.textContent = '@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}';
    document.head.appendChild(s);
  }
}

/* ═══════════════════════════════════════════════════════════
   FILTER OPTIONS
═══════════════════════════════════════════════════════════ */
function rebuildFilterOptions() {
  const dvds = state.all;
  const registi = [...new Set(dvds.map(d => d.regista).filter(Boolean))].sort();
  const anni    = [...new Set(dvds.map(d => d.anno).filter(Boolean))].sort((a,b) => b - a);
  const regioni = [...new Set(dvds.map(d => d.regione).filter(Boolean))].sort();
  populateSelect(els.fRegista, registi);
  populateSelect(els.fAnno,    anni);
  populateSelect(els.fRegione, regioni);
}

function populateSelect(sel, values) {
  const current = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    sel.appendChild(opt);
  });
  if (values.includes(current)) sel.value = current;
}

/* ═══════════════════════════════════════════════════════════
   FILTRI + SORT + RENDER
═══════════════════════════════════════════════════════════ */
function applyFiltersAndRender() {
  const search  = els.fSearch.value.trim().toLowerCase();
  const regista = els.fRegista.value;
  const anno    = els.fAnno.value;
  const formato = els.fFormato.value;
  const regione = els.fRegione.value;
  const collana = els.fCollana.value;

  state.filtered = state.all.filter(d => {
    if (search  && !`${d.titolo} ${d.regista} ${d.note}`.toLowerCase().includes(search)) return false;
    if (regista && d.regista !== regista) return false;
    if (anno    && String(d.anno) !== anno) return false;
    if (formato && d.formato !== formato) return false;
    if (regione && d.regione !== regione) return false;
    if (collana === 'si' && !d.isCollana) return false;
    if (collana === 'no' && d.isCollana)  return false;
    return true;
  });

  const col = state.sortCol;
  const dir = state.sortDir === 'asc' ? 1 : -1;
  state.filtered.sort((a, b) => {
    let va = a[col] ?? '';
    let vb = b[col] ?? '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return -1 * dir;
    if (va > vb) return  1 * dir;
    return 0;
  });

  updateStats();
  renderTable();
  renderCards();
  updateSortHeaders();
}

/* ═══════════════════════════════════════════════════════════
   STATS
═══════════════════════════════════════════════════════════ */
function updateStats() {
  const t = state.all.length;
  const f = state.filtered.length;
  els.statTotal.textContent    = t;
  els.statFiltered.textContent = f;
  els.rcTotal.textContent      = t;
  els.rcFiltered.textContent   = f;
}

/* ═══════════════════════════════════════════════════════════
   RENDER TABLE
═══════════════════════════════════════════════════════════ */
function renderTable() {
  const tbody = els.tableBody;
  tbody.innerHTML = '';

  if (state.filtered.length === 0) {
    els.emptyState.style.display = 'block';
    return;
  }
  els.emptyState.style.display = 'none';

  state.filtered.forEach(dvd => {
    const tr = document.createElement('tr');
    tr.dataset.id = dvd.id;
    tr.innerHTML = `
      <td class="col-titolo">${escHtml(dvd.titolo)}</td>
      <td class="col-regista">${escHtml(dvd.regista || '—')}</td>
      <td class="col-anno">${dvd.anno || '—'}</td>
      <td class="col-durata">${dvd.durata ? dvd.durata + ' min' : '—'}</td>
      <td class="col-formato">${formatoBadge(dvd.formato)}</td>
      <td class="col-regione">${regioneBadge(dvd.regione)}</td>
      <td class="col-collana">${collanaCella(dvd)}</td>
      <td class="col-actions">
        <div class="row-actions">
          <button class="btn-edit" data-id="${dvd.id}" title="Modifica">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-del" data-id="${dvd.id}" title="Elimina">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ═══════════════════════════════════════════════════════════
   RENDER CARDS (tablet / mobile)
═══════════════════════════════════════════════════════════ */
function renderCards() {
  const grid = els.cardsGrid;
  grid.innerHTML = '';

  if (state.filtered.length === 0) return;

  state.filtered.forEach((dvd, i) => {
    const card = document.createElement('div');
    card.className = 'dvd-card';
    card.style.animationDelay = `${Math.min(i * 25, 300)}ms`;
    card.dataset.id = dvd.id;
    // data-formato drives the colored top-border via CSS
    card.dataset.formato = formatoClass(dvd.formato);

    // Meta tags
    const tags = [];
    if (dvd.anno)    tags.push(`<span class="card-tag">${dvd.anno}</span>`);
    if (dvd.durata)  tags.push(`<span class="card-tag">${dvd.durata} min</span>`);
    if (dvd.formato) tags.push(`<span class="card-tag ${formatoClass(dvd.formato)}">${escHtml(dvd.formato)}</span>`);
    if (dvd.regione) tags.push(`<span class="card-tag accent">${escHtml(dvd.regione)}</span>`);
    if (dvd.isCollana) tags.push(`<span class="card-tag green">Collana</span>`);

    // Extra info (collana name + note)
    let extraHtml = '';
    if ((dvd.isCollana && dvd.collana) || dvd.note) {
      const rows = [];
      if (dvd.isCollana && dvd.collana) {
        rows.push(`<div class="card-collana"><span style="opacity:.5;font-size:.9em">📦</span> ${escHtml(dvd.collana)}</div>`);
      }
      if (dvd.note) {
        rows.push(`<div class="card-note">${escHtml(dvd.note)}</div>`);
      }
      extraHtml = `<div class="card-extra">${rows.join('')}</div>`;
    }

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-top">
          <div class="card-title-block">
            <div class="card-title">${escHtml(dvd.titolo)}</div>
            <div class="card-regista">${escHtml(dvd.regista || '—')}</div>
          </div>
          <div class="card-actions">
            <button class="btn-edit" data-id="${dvd.id}" title="Modifica">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-del" data-id="${dvd.id}" title="Elimina">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="card-meta">${tags.join('')}</div>
      </div>
      ${extraHtml}
    `;

    grid.appendChild(card);
  });
}

/* ═══════════════════════════════════════════════════════════
   SORT HEADERS
═══════════════════════════════════════════════════════════ */
function updateSortHeaders() {
  document.querySelectorAll('th[data-col]').forEach(th => {
    th.classList.remove('sorted');
    const arrow = th.querySelector('.sort-arrow');
    if (th.dataset.col === state.sortCol) {
      th.classList.add('sorted');
      if (arrow) arrow.textContent = state.sortDir === 'asc' ? '↑' : '↓';
    } else {
      if (arrow) arrow.textContent = '↕';
    }
  });
  const labels = { titolo:'Titolo', regista:'Regista', anno:'Anno', durata:'Durata', formato:'Formato', regione:'Regione', collana:'Collana' };
  els.sortInfo.textContent = `Ordinati per: ${labels[state.sortCol] || state.sortCol} ${state.sortDir === 'asc' ? '↑' : '↓'}`;
}

/* ═══════════════════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════════════════ */
function openModal(dvd = null) {
  state.editingId = dvd ? dvd.id : null;
  els.modalTitle.textContent = dvd ? 'MODIFICA DVD' : 'AGGIUNGI DVD';
  els.fTitolo.value      = dvd?.titolo   || '';
  els.fRegista2.value    = dvd?.regista  || '';
  els.fAnno2.value       = dvd?.anno     || '';
  els.fDurata.value      = dvd?.durata   || '';
  els.fFormato2.value    = dvd?.formato  || '';
  els.fRegione2.value    = dvd?.regione  || '';
  els.fIsCollana.checked = dvd?.isCollana || false;
  els.fCollana2.value    = dvd?.collana  || '';
  els.fNote.value        = dvd?.note     || '';
  els.collanaField.style.display = els.fIsCollana.checked ? 'flex' : 'none';
  els.btnSave.textContent = 'SALVA';
  els.modalOverlay.classList.add('open');
  setTimeout(() => els.fTitolo.focus(), 100);
}

function closeModal() {
  els.modalOverlay.classList.remove('open');
  state.editingId = null;
}

/* ═══════════════════════════════════════════════════════════
   SALVA
═══════════════════════════════════════════════════════════ */
async function saveDvd() {
  const titolo = els.fTitolo.value.trim();
  if (!titolo) { showToast('Il titolo è obbligatorio.', true); els.fTitolo.focus(); return; }

  const dvd = {
    titolo,
    regista:   els.fRegista2.value.trim(),
    anno:      parseInt(els.fAnno2.value)  || null,
    durata:    parseInt(els.fDurata.value) || null,
    formato:   els.fFormato2.value  || null,
    regione:   els.fRegione2.value  || null,
    isCollana: els.fIsCollana.checked,
    collana:   els.fIsCollana.checked ? els.fCollana2.value.trim() : null,
    note:      els.fNote.value.trim() || null,
  };

  setLoading(true);
  try {
    if (state.editingId) {
      await DB.update(state.editingId, dvd);
      showToast(`"${titolo}" aggiornato.`);
    } else {
      await DB.add(dvd);
      showToast(`"${titolo}" aggiunto alla collezione.`);
    }
    closeModal();
    state.all = await DB.getAll();
    rebuildFilterOptions();
    applyFiltersAndRender();
  } catch (e) {
    showToast('Errore salvataggio. Riprova.', true);
    console.error(e);
  } finally {
    setLoading(false);
  }
}

/* ═══════════════════════════════════════════════════════════
   CONFIRM DELETE
═══════════════════════════════════════════════════════════ */
function openConfirm(id) {
  const dvd = state.all.find(d => String(d.id) === String(id));
  if (!dvd) return;
  state.deleteId = id;
  els.confirmTitle.textContent = dvd.titolo;
  els.confirmOverlay.classList.add('open');
}

function closeConfirm() {
  els.confirmOverlay.classList.remove('open');
  state.deleteId = null;
}

async function deleteDvd() {
  const dvd = state.all.find(d => String(d.id) === String(state.deleteId));
  if (!dvd) return;
  try {
    await DB.remove(state.deleteId);
    showToast(`"${dvd.titolo}" eliminato.`);
    closeConfirm();
    state.all = await DB.getAll();
    rebuildFilterOptions();
    applyFiltersAndRender();
  } catch (e) {
    showToast('Errore eliminazione. Riprova.', true);
    console.error(e);
  }
}

/* ═══════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════ */
let toastTimer = null;
function showToast(msg, isError = false) {
  const t = els.toast;
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function formatoBadge(formato) {
  if (!formato) return '<span style="color:var(--muted)">—</span>';
  return `<span class="badge ${formatoClass(formato)}">${escHtml(formato)}</span>`;
}

function formatoClass(formato) {
  if (!formato) return 'default';
  const f = formato.toLowerCase();
  if (f.includes('blu')) return 'blu-ray';
  if (f.includes('4k') || f.includes('uhd')) return 'uhd';
  if (f === 'dvd') return 'dvd';
  if (f === 'vhs') return 'vhs';
  if (f.includes('laser')) return 'laserdisc';
  return 'default';
}

function regioneBadge(regione) {
  if (!regione) return '<span style="color:var(--muted)">—</span>';
  return `<span class="badge-reg">${escHtml(regione)}</span>`;
}

function collanaCella(dvd) {
  if (!dvd.isCollana) return '<span style="color:var(--muted)">—</span>';
  return dvd.collana
    ? `<span class="badge-coll">Collana</span><span class="collana-name">${escHtml(dvd.collana)}</span>`
    : `<span class="badge-coll">Collana</span>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ═══════════════════════════════════════════════════════════
   EVENTS
═══════════════════════════════════════════════════════════ */
function bindEvents() {
  els.btnAdd.addEventListener('click', () => openModal());
  els.btnLogout?.addEventListener('click', () => {
    sessionStorage.removeItem('dvd_auth');
    window.location.href = 'index.html';
  });

  [els.fSearch, els.fRegista, els.fAnno, els.fFormato, els.fRegione, els.fCollana]
    .forEach(el => el.addEventListener('input',  applyFiltersAndRender));
  [els.fRegista, els.fAnno, els.fFormato, els.fRegione, els.fCollana]
    .forEach(el => el.addEventListener('change', applyFiltersAndRender));

  els.btnReset.addEventListener('click', () => {
    els.fSearch.value = els.fRegista.value = els.fAnno.value = '';
    els.fFormato.value = els.fRegione.value = els.fCollana.value = '';
    applyFiltersAndRender();
  });

  document.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      state.sortDir = state.sortCol === col ? (state.sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
      state.sortCol = col;
      applyFiltersAndRender();
    });
  });

  function handleActionClick(e) {
    const editBtn = e.target.closest('.btn-edit');
    const delBtn  = e.target.closest('.btn-del');
    if (editBtn) {
      const dvd = state.all.find(d => String(d.id) === editBtn.dataset.id);
      if (dvd) openModal(dvd);
    }
    if (delBtn) openConfirm(delBtn.dataset.id);
  }
  els.tableBody.addEventListener('click', handleActionClick);
  els.cardsGrid.addEventListener('click', handleActionClick);

  els.modalClose.addEventListener('click', closeModal);
  els.btnCancel.addEventListener('click',  closeModal);
  els.btnSave.addEventListener('click',    saveDvd);
  els.modalOverlay.addEventListener('click', e => { if (e.target === els.modalOverlay) closeModal(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (els.confirmOverlay.classList.contains('open')) closeConfirm();
      else if (els.modalOverlay.classList.contains('open')) closeModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openModal(); }
  });

  els.fIsCollana.addEventListener('change', () => {
    els.collanaField.style.display = els.fIsCollana.checked ? 'flex' : 'none';
    if (!els.fIsCollana.checked) els.fCollana2.value = '';
  });

  [els.fTitolo, els.fRegista2, els.fAnno2, els.fDurata, els.fRegione2, els.fCollana2].forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') saveDvd(); });
  });

  els.confirmCancel.addEventListener('click', closeConfirm);
  els.confirmDel.addEventListener('click',    deleteDvd);
  els.confirmOverlay.addEventListener('click', e => { if (e.target === els.confirmOverlay) closeConfirm(); });
}

/* ═══════════════════════════════════════════════════════════
   START
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);