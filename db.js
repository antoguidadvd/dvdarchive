const SUPABASE_URL = 'https://gzunurpoyaxcgfrkqivo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dW51cnBveWF4Y2dmcmtxaXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDA3ODgsImV4cCI6MjA5MzgxNjc4OH0.gn_70nB26fc25bu6AcGhnKzwn8cqTKtVx-QvV76F024';  

const TABLE = 'dvd';

/* ─── Helper fetch ───────────────────────────────────────── */
async function _sbFetch(path, options = {}) {
  const url    = `${SUPABASE_URL}/rest/v1/${path}`;
  const prefer = options._prefer || 'return=representation';
  delete options._prefer;

  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        prefer,
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return [];
  const data = await res.json();
  if (!res.ok) { console.error('[DB]', data); throw new Error(data.message || 'Errore Supabase'); }
  return data;
}

/* ─── Mapping DB ↔ App ───────────────────────────────────── */
function _toApp(row) {
  if (!row) return null;

  // Creiamo un set per evitare duplicati fin da subito
  let nomiCollane = new Set();

  // 1. Controlliamo il vecchio campo singolare (testo semplice)
  if (row.collana) {
    nomiCollane.add(row.collana.trim());
  }

  // 2. Controlliamo il nuovo campo plurale (array o JSON)
  if (Array.isArray(row.collane)) {
    row.collane.forEach(c => c && nomiCollane.add(c.trim()));
  } else if (row.collane) {
    try {
      const parsed = JSON.parse(row.collane);
      if (Array.isArray(parsed)) {
        parsed.forEach(c => c && nomiCollane.add(c.trim()));
      } else {
        nomiCollane.add(row.collane.trim());
      }
    } catch {
      nomiCollane.add(row.collane.trim());
    }
  }

  // Convertiamo il Set in un array pulito
  const collaneFinali = [...nomiCollane].filter(Boolean);

  return {
    id:        String(row.id),
    titolo:    row.titolo     || '',
    regista:   row.regista    || '',
    anno:      row.anno       || null,
    durata:    row.durata     || null,
    formato:   row.formato    || null,
    regione:   row.regione    || null,
    // Un DVD è considerato "in collana" se ha il flag attivo OPPURE se ha almeno un nome trovato
    isCollana: row.is_collana || collaneFinali.length > 0,
    collane:   collaneFinali,
    note:      row.note       || null,
    createdAt: row.created_at || null,
  };
}

function _toDB(dvd) {
  const collane = Array.isArray(dvd.collane) ? dvd.collane.filter(Boolean) : [];
  return {
    titolo:     dvd.titolo    || null,
    regista:    dvd.regista   || null,
    anno:       dvd.anno      || null,
    durata:     dvd.durata    || null,
    formato:    dvd.formato   || null,
    regione:    dvd.regione   || null,
    is_collana: dvd.isCollana || false,
    collane:    collane,        // array salvato come JSONB / text[]
    collana:    collane[0] || null, // manteniamo retrocompat colonna legacy
    note:       dvd.note      || null,
  };
}

/* ─── API pubblica ───────────────────────────────────────── */
const DB = {

  async getAll() {
    const rows = await _sbFetch(`${TABLE}?select=*&order=titolo.asc`);
    return rows.map(_toApp);
  },

  async getById(id) {
    const rows = await _sbFetch(`${TABLE}?id=eq.${id}&select=*`);
    return rows.length ? _toApp(rows[0]) : null;
  },

  async add(dvdData) {
    const rows = await _sbFetch(TABLE, {
      method: 'POST',
      body:   JSON.stringify(_toDB(dvdData)),
    });
    return _toApp(Array.isArray(rows) ? rows[0] : rows);
  },

  async update(id, updates) {
    const rows = await _sbFetch(`${TABLE}?id=eq.${id}`, {
      method: 'PATCH',
      body:   JSON.stringify(_toDB(updates)),
    });
    return _toApp(Array.isArray(rows) ? rows[0] : rows);
  },

  async remove(id) {
    await _sbFetch(`${TABLE}?id=eq.${id}`, {
      method:  'DELETE',
      _prefer: 'return=minimal',
    });
  },

  async count() {
    const rows = await _sbFetch(`${TABLE}?select=id`);
    return rows.length;
  },

};