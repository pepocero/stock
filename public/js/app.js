/**
 * Stock Recambios - Frontend
 * Panel de gestión de inventario
 */

const API_BASE = '/api';
const STOCK_BAJO_UMBRAL = 5;

let customFieldsDefinitions = [];

// =============================================================================
// Tema (oscuro / claro)
// =============================================================================

const THEME_STORAGE_KEY = 'stock_theme';
const SORT_STORAGE_KEY = 'stock_sort';

function applyTheme(theme) {
  const body = document.body;
  body.classList.remove('theme-light', 'theme-dark');
  body.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark');

  const btnLight = document.getElementById('btn-theme-light');
  const btnDark = document.getElementById('btn-theme-dark');
  if (btnLight && btnDark) {
    btnLight.classList.toggle('theme-active', theme === 'light');
    btnDark.classList.toggle('theme-active', theme !== 'light');
  }
}

function initTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    stored = null;
  }

  if (stored !== 'light' && stored !== 'dark') {
    const prefersDark = window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    stored = prefersDark ? 'dark' : 'light';
  }

  applyTheme(stored);

  const btnLight = document.getElementById('btn-theme-light');
  const btnDark = document.getElementById('btn-theme-dark');

  if (btnLight) {
    btnLight.addEventListener('click', () => {
      applyTheme('light');
      try { localStorage.setItem(THEME_STORAGE_KEY, 'light'); } catch {}
    });
  }

  if (btnDark) {
    btnDark.addEventListener('click', () => {
      applyTheme('dark');
      try { localStorage.setItem(THEME_STORAGE_KEY, 'dark'); } catch {}
    });
  }
}

// =============================================================================
// API
// =============================================================================

async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  };
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(url, config);
  const data = res.ok ? await res.json().catch(() => ({})) : null;
  if (!res.ok) {
    const err = data?.error || `Error ${res.status}`;
    throw new Error(err);
  }
  return data;
}

// =============================================================================
// Vistas
// =============================================================================

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const view = document.getElementById(`view-${viewId}`);
  const tab = document.querySelector(`[data-view="${viewId}"]`);
  if (view) view.classList.add('active');
  if (tab) tab.classList.add('active');
}

function showEditarPanel(show = true) {
  const panel = document.getElementById('view-editar');
  if (show) {
    panel.classList.add('active');
  } else {
    panel.classList.remove('active');
  }
}

function showDetallePanel(show = true) {
  const panel = document.getElementById('view-detalle');
  if (show) {
    panel.classList.add('active');
  } else {
    panel.classList.remove('active');
  }
}

// =============================================================================
// Listado
// =============================================================================

async function loadRecambios() {
  const fabricante = document.getElementById('filter-fabricante').value;
  const search = document.getElementById('filter-search').value.trim();
  const params = new URLSearchParams();
  if (fabricante) params.set('fabricante', fabricante);
  if (search) params.set('search', search);

  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="loading">Cargando...</td></tr>';

  try {
    const recambios = await api(`/recambios?${params}`);
    renderTable(recambios, tbody);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="error-msg">${err.message}</td></tr>`;
  }
}

function renderTable(recambios, tbody) {
  if (!recambios.length) {
    tbody.innerHTML = `
      <tr><td colspan="7" class="empty-state">
        <p>No hay recambios. Añade el primero desde "Nuevo recambio".</p>
      </td></tr>
    `;
    document.getElementById('btn-eliminar-seleccionados')?.classList.add('hidden');
    const selectAll = document.getElementById('select-all-recambios');
    if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; }
    return;
  }

  tbody.innerHTML = recambios.map(r => {
    const stockBajo = r.cantidad < STOCK_BAJO_UMBRAL;
    const badgeClass = stockBajo ? 'badge-stock badge-stock-bajo' : 'badge-stock';
    return `
      <tr class="recambio-row" data-id="${r.id}" tabindex="0" role="button">
        <td class="col-checkbox" onclick="event.stopPropagation()">
          <input type="checkbox" class="recambio-checkbox" data-id="${r.id}" aria-label="Seleccionar recambio ${r.id}">
        </td>
        <td>${escapeHtml(r.fabricante)}</td>
        <td>${escapeHtml(r.codigo_interno)}</td>
        <td>${escapeHtml(r.nombre_tecnico)}</td>
        <td>${escapeHtml(r.alias)}</td>
        <td class="col-cantidad"><span class="${badgeClass}">${r.cantidad}</span></td>
        <td></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.recambio-row').forEach(row => {
    const id = parseInt(row.dataset.id);
    const handler = (e) => {
      if (e.target.closest('input[type="checkbox"]') || e.target.closest('button')) return;
      openDetalle(id);
    };
    row.addEventListener('click', handler);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!e.target.closest('input[type="checkbox"]')) openDetalle(id);
      }
    });
  });

  tbody.querySelectorAll('.recambio-checkbox').forEach(cb => {
    cb.addEventListener('change', updateEliminarSeleccionadosBtn);
  });
  const selectAll = document.getElementById('select-all-recambios');
  if (selectAll) {
    selectAll.onchange = (e) => {
      tbody.querySelectorAll('.recambio-checkbox').forEach(cb => { cb.checked = e.target.checked; });
      updateEliminarSeleccionadosBtn();
    };
  }
  updateEliminarSeleccionadosBtn();
}

function updateEliminarSeleccionadosBtn() {
  const btn = document.getElementById('btn-eliminar-seleccionados');
  const checked = document.querySelectorAll('.recambio-checkbox:checked');
  if (btn) {
    if (checked.length > 0) {
      btn.classList.remove('hidden');
      btn.textContent = `Eliminar seleccionados (${checked.length})`;
    } else {
      btn.classList.add('hidden');
    }
  }
  const selectAll = document.getElementById('select-all-recambios');
  if (selectAll) {
    const total = document.querySelectorAll('.recambio-checkbox').length;
    selectAll.checked = total > 0 && checked.length === total;
    selectAll.indeterminate = checked.length > 0 && checked.length < total;
  }
}

async function eliminarSeleccionados() {
  const checked = document.querySelectorAll('.recambio-checkbox:checked');
  const ids = Array.from(checked).map(cb => parseInt(cb.dataset.id, 10)).filter(id => !isNaN(id));
  if (!ids.length) return;
  if (!confirm(`¿Eliminar ${ids.length} recambio(s)? Esta acción no se puede deshacer.`)) return;

  try {
    const result = await api('/recambios/batch-delete', { method: 'POST', body: { ids } });
    showFeedback(`${result.deleted} recambio(s) eliminado(s)`, 'success');
    loadRecambios();
  } catch (err) {
    showFeedback(err.message, 'error');
  }
}

// =============================================================================
// Formulario nuevo
// =============================================================================

async function loadCustomFieldsForForm(containerId, values = {}) {
  const container = document.getElementById(containerId);
  if (!customFieldsDefinitions.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<h4 style="margin:0 0 0.75rem; font-size:0.95rem; color:var(--text-muted)">Campos personalizados</h4>';
  for (const def of customFieldsDefinitions) {
    const val = values[def.field_key]?.value ?? '';
    const div = document.createElement('div');
    div.className = 'field';
    let input = '';
    if (def.field_type === 'boolean') {
      input = `<input type="checkbox" id="cf-${containerId}-${def.field_key}" data-field="${def.field_key}" ${val ? 'checked' : ''}>`;
    } else {
      const type = def.field_type === 'number' ? 'number' : def.field_type === 'date' ? 'date' : 'text';
      input = `<input type="${type}" id="cf-${containerId}-${def.field_key}" data-field="${def.field_key}" value="${escapeHtml(val)}" placeholder="${escapeHtml(def.field_label)}">`;
    }
    div.innerHTML = `<label for="cf-${containerId}-${def.field_key}">${escapeHtml(def.field_label)}</label>${input}`;
    container.appendChild(div);
  }
}

function getCustomFieldsFromForm(containerId) {
  const inputs = document.querySelectorAll(`#${containerId} [data-field]`);
  const obj = {};
  inputs.forEach(inp => {
    const key = inp.dataset.field;
    const val = inp.type === 'checkbox' ? (inp.checked ? '1' : '0') : inp.value;
    obj[key] = val;
  });
  return obj;
}

async function submitNuevo(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const data = {
    fabricante: document.getElementById('nuevo-fabricante').value,
    codigo_interno: document.getElementById('nuevo-codigo-interno').value.trim(),
    codigo_fabricante: document.getElementById('nuevo-codigo-fabricante').value.trim(),
    nombre_tecnico: document.getElementById('nuevo-nombre-tecnico').value.trim(),
    alias: document.getElementById('nuevo-alias').value.trim(),
    cantidad: parseInt(document.getElementById('nuevo-cantidad').value) || 0,
    observaciones: document.getElementById('nuevo-observaciones').value.trim() || null,
    custom_fields: getCustomFieldsFromForm('nuevo-custom-fields')
  };

  try {
    await api('/recambios', { method: 'POST', body: data });
    showFeedback('Recambio creado correctamente', 'success');
    e.target.reset();
    loadCustomFieldsForForm('nuevo-custom-fields');
    loadRecambios();
    showView('listado');
  } catch (err) {
    showFeedback(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// =============================================================================
// Detalle
// =============================================================================

async function openDetalle(id) {
  try {
    const recambio = await api(`/recambios/${id}`);
    const container = document.getElementById('detalle-content');
    const stockBajo = recambio.cantidad < STOCK_BAJO_UMBRAL;

    let customHtml = '';
    if (customFieldsDefinitions.length > 0) {
      customHtml = '<div class="detalle-section-title">Campos adicionales</div>';
      for (const def of customFieldsDefinitions) {
        const obj = recambio.custom_fields?.[def.field_key];
        const label = def.field_label;
        let val = obj?.value ?? '';
        if (def.field_type === 'boolean') val = val === '1' || val === true ? 'Sí' : 'No';
        customHtml += `
          <div class="detalle-item">
            <span class="detalle-label">${escapeHtml(label)}</span>
            <span class="detalle-value ${!val ? 'empty' : ''}">${escapeHtml(String(val)) || '—'}</span>
          </div>`;
      }
    }

    container.innerHTML = `
      <div class="detalle-item">
        <span class="detalle-label">Fabricante</span>
        <span class="detalle-value">${escapeHtml(recambio.fabricante)}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Código interno</span>
        <span class="detalle-value">${escapeHtml(recambio.codigo_interno)}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Código fabricante</span>
        <span class="detalle-value ${!recambio.codigo_fabricante ? 'empty' : ''}">${escapeHtml(recambio.codigo_fabricante) || '—'}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Nombre técnico</span>
        <span class="detalle-value ${!recambio.nombre_tecnico ? 'empty' : ''}">${escapeHtml(recambio.nombre_tecnico) || '—'}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Alias</span>
        <span class="detalle-value ${!recambio.alias ? 'empty' : ''}">${escapeHtml(recambio.alias) || '—'}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Stock</span>
        <span class="detalle-value"><span class="badge-stock ${stockBajo ? 'badge-stock-bajo' : ''}">${recambio.cantidad}</span></span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Observaciones</span>
        <span class="detalle-value ${!recambio.observaciones ? 'empty' : ''}">${escapeHtml(recambio.observaciones) || '—'}</span>
      </div>
      ${customHtml}
    `;

    document.getElementById('btn-editar-desde-detalle').dataset.id = recambio.id;
    document.getElementById('btn-eliminar-desde-detalle').dataset.id = recambio.id;
    showDetallePanel(true);
  } catch (err) {
    showFeedback(err.message, 'error');
  }
}

async function eliminarRecambioDesdeDetalle() {
  const id = document.getElementById('btn-eliminar-desde-detalle').dataset.id;
  if (!id) return;
  if (!confirm('¿Eliminar este recambio? Esta acción no se puede deshacer.')) return;

  try {
    await api(`/recambios/${id}`, { method: 'DELETE' });
    showFeedback('Recambio eliminado', 'success');
    showDetallePanel(false);
    loadRecambios();
  } catch (err) {
    showFeedback(err.message, 'error');
  }
}

// =============================================================================
// Editar
// =============================================================================

async function openEditar(id) {
  try {
    const recambio = await api(`/recambios/${id}`);
    document.getElementById('editar-id').value = recambio.id;
    document.getElementById('editar-fabricante').value = recambio.fabricante;
    document.getElementById('editar-codigo-interno').value = recambio.codigo_interno;
    document.getElementById('editar-codigo-fabricante').value = recambio.codigo_fabricante || '';
    document.getElementById('editar-nombre-tecnico').value = recambio.nombre_tecnico || '';
    document.getElementById('editar-alias').value = recambio.alias || '';
    document.getElementById('editar-cantidad').value = recambio.cantidad;
    document.getElementById('editar-observaciones').value = recambio.observaciones || '';

    const customValues = {};
    for (const [k, v] of Object.entries(recambio.custom_fields || {})) {
      customValues[k] = v;
    }
    await loadCustomFieldsForForm('editar-custom-fields', customValues);

    updateStockBajoBadge(recambio.cantidad);
    showEditarPanel(true);
  } catch (err) {
    showFeedback(err.message, 'error');
  }
}

function updateStockBajoBadge(cantidad) {
  const badge = document.getElementById('stock-bajo-badge');
  if (cantidad < STOCK_BAJO_UMBRAL) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

async function submitEditar(e) {
  e.preventDefault();
  const id = document.getElementById('editar-id').value;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const data = {
    fabricante: document.getElementById('editar-fabricante').value,
    codigo_interno: document.getElementById('editar-codigo-interno').value.trim(),
    codigo_fabricante: document.getElementById('editar-codigo-fabricante').value.trim(),
    nombre_tecnico: document.getElementById('editar-nombre-tecnico').value.trim(),
    alias: document.getElementById('editar-alias').value.trim(),
    cantidad: parseInt(document.getElementById('editar-cantidad').value) || 0,
    observaciones: document.getElementById('editar-observaciones').value.trim() || null,
    custom_fields: getCustomFieldsFromForm('editar-custom-fields')
  };

  try {
    await api(`/recambios/${id}`, { method: 'PUT', body: data });
    showFeedback('Recambio actualizado', 'success');
    showEditarPanel(false);
    loadRecambios();
  } catch (err) {
    showFeedback(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// =============================================================================
// Utilidades
// =============================================================================

function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showFeedback(msg, type) {
  const existing = document.querySelector('.feedback-msg');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `feedback-msg ${type === 'success' ? 'success-msg' : 'error-msg'}`;
  el.textContent = msg;
  document.querySelector('.content').insertBefore(el, document.querySelector('.content').firstChild);
  setTimeout(() => el.remove(), 4000);
}

// =============================================================================
// Campos adicionales (editar nombres)
// =============================================================================

async function loadCamposView() {
  const container = document.getElementById('campos-lista');
  if (!customFieldsDefinitions.length) {
    container.innerHTML = '<p class="empty-state">No hay campos adicionales. Añade el primero abajo.</p>';
    return;
  }

  container.innerHTML = customFieldsDefinitions.map(def => `
    <div class="campo-item" data-id="${def.id}">
      <input type="text" value="${escapeHtml(def.field_label)}" data-field-id="${def.id}" placeholder="Nombre del campo">
      <button type="button" class="btn-sm btn-edit btn-save-campo" data-id="${def.id}">Guardar</button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-save-campo').forEach(btn => {
    btn.addEventListener('click', () => saveCampoNombre(parseInt(btn.dataset.id)));
  });
  container.querySelectorAll('.campo-item input').forEach(inp => {
    inp.addEventListener('keypress', e => {
      if (e.key === 'Enter') saveCampoNombre(parseInt(inp.dataset.fieldId));
    });
  });
}

async function saveCampoNombre(id) {
  const item = document.querySelector(`.campo-item[data-id="${id}"]`);
  const input = item?.querySelector('input');
  if (!input) return;
  const nuevoNombre = input.value.trim();
  if (!nuevoNombre) {
    showFeedback('El nombre no puede estar vacío', 'error');
    return;
  }
  try {
    await api(`/custom-fields/${id}`, { method: 'PUT', body: { field_label: nuevoNombre } });
    showFeedback('Nombre actualizado', 'success');
    await refreshCustomFields();
  } catch (err) {
    showFeedback(err.message, 'error');
  }
}

async function addNuevoCampo() {
  const input = document.getElementById('nuevo-campo-nombre');
  const nombre = input.value.trim();
  if (!nombre) {
    showFeedback('Escribe el nombre del campo', 'error');
    return;
  }
  const fieldKey = nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (!fieldKey) {
    showFeedback('El nombre debe contener letras o números', 'error');
    return;
  }
  try {
    await api('/custom-fields', {
      method: 'POST',
      body: { field_key: fieldKey, field_label: nombre }
    });
    showFeedback('Campo añadido', 'success');
    input.value = '';
    await refreshCustomFields();
  } catch (err) {
    showFeedback(err.message, 'error');
  }
}

async function refreshCustomFields() {
  customFieldsDefinitions = await api('/custom-fields');
  loadCustomFieldsForForm('nuevo-custom-fields');
  loadCamposView();
  const editarPanel = document.getElementById('view-editar');
  if (editarPanel.classList.contains('active')) {
    const id = document.getElementById('editar-id').value;
    if (id) openEditar(parseInt(id));
  }
}

// =============================================================================
// Importar
// =============================================================================

const IMPORT_FIELDS = [
  { key: 'fabricante', label: 'Fabricante' },
  { key: 'codigo_interno', label: 'Código interno' },
  { key: 'codigo_fabricante', label: 'Código fabricante' },
  { key: 'nombre_tecnico', label: 'Nombre técnico' },
  { key: 'alias', label: 'Alias' },
  { key: 'cantidad', label: 'Stock' },
  { key: 'observaciones', label: 'Observaciones' }
];

let importData = { headers: [], rows: [], mapping: {} };

function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  const delim = text.includes(';') ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (current.trim() || lines.length > 0) {
        lines.push(parseCSVLine(current, delim));
        current = '';
      }
    } else if ((c === delim) && !inQuotes) {
      current += '\0';
    } else {
      current += c;
    }
  }
  if (current.trim() || lines.length > 0) {
    lines.push(parseCSVLine(current, delim));
  }
  return lines;
}

function parseCSVLine(line, delim) {
  const cells = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === '\0') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += c;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function parseXLSX(arrayBuffer) {
  if (typeof XLSX === 'undefined') throw new Error('Librería XLSX no cargada');
  const wb = XLSX.read(arrayBuffer, { type: 'array', raw: true });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
  return data.map(row => Array.isArray(row) ? row.map(c => c != null ? String(c) : '') : []);
}

function parseFile(file) {
  return new Promise((resolve, reject) => {
    const ext = (file.name || '').toLowerCase();
    const isCSV = ext.endsWith('.csv');
    const isXLSX = ext.endsWith('.xlsx') || ext.endsWith('.xls');
    if (!isCSV && !isXLSX) {
      reject(new Error('Formato no soportado. Usa CSV o Excel (.xlsx)'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let rows;
        if (isCSV) {
          const text = new TextDecoder('utf-8').decode(e.target.result);
          rows = parseCSV(text);
        } else {
          rows = parseXLSX(e.target.result);
        }
        if (!rows.length) {
          reject(new Error('El archivo está vacío'));
          return;
        }
        const headers = rows[0].map((h, i) => String(h || '').trim() || `Columna ${i + 1}`);
        const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim()));
        resolve({ headers, rows: dataRows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    if (isCSV) reader.readAsText(file, 'UTF-8');
    else reader.readAsArrayBuffer(file);
  });
}

function buildMappingUI() {
  const container = document.getElementById('import-mapping-fields');
  container.innerHTML = IMPORT_FIELDS.map(f => `
    <div class="import-mapping-row">
      <label for="map-${f.key}">${f.label}</label>
      <select id="map-${f.key}" data-field="${f.key}">
        <option value="">-- No importar --</option>
        ${importData.headers.map((h, i) => `<option value="${i}">${escapeHtml(h)}</option>`).join('')}
      </select>
    </div>
  `).join('');
}

function buildPreview() {
  const thead = document.getElementById('import-preview-thead');
  const tbody = document.getElementById('import-preview-tbody');
  const mapping = {};
  IMPORT_FIELDS.forEach(f => {
    const sel = document.getElementById(`map-${f.key}`);
    if (sel && sel.value !== '') mapping[f.key] = parseInt(sel.value, 10);
  });
  const cols = IMPORT_FIELDS.filter(f => mapping[f.key] !== undefined).map(f => ({ key: f.key, label: f.label, idx: mapping[f.key] }));
  thead.innerHTML = `<tr>${cols.map(c => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr>`;
  const previewRows = importData.rows.slice(0, 5);
  tbody.innerHTML = previewRows.map(row => `
    <tr>${cols.map(c => `<td>${escapeHtml(String(row[c.idx] ?? ''))}</td>`).join('')}</tr>
  `).join('');
}

function getMapping() {
  const mapping = {};
  IMPORT_FIELDS.forEach(f => {
    const sel = document.getElementById(`map-${f.key}`);
    if (sel && sel.value !== '') mapping[f.key] = parseInt(sel.value, 10);
  });
  return mapping;
}

function buildImportItems() {
  const mapping = getMapping();
  return importData.rows.map(row => {
    const item = {};
    for (const [field, colIdx] of Object.entries(mapping)) {
      item[field] = row[colIdx] != null ? String(row[colIdx]).trim() : '';
    }
    return item;
  });
}

async function doImport() {
  const mapping = getMapping();
  if (Object.keys(mapping).length === 0) {
    showFeedback('Debes seleccionar al menos un campo para importar', 'error');
    return;
  }
  const items = buildImportItems();
  if (!items.length) {
    showFeedback('No hay filas para importar', 'error');
    return;
  }
  const btn = document.getElementById('btn-importar');
  btn.disabled = true;
  try {
    const result = await api('/recambios/import', { method: 'POST', body: { items } });
    const resultEl = document.getElementById('import-result');
    resultEl.classList.remove('hidden');
    let html = `<p><strong>Importación completada:</strong> ${result.created} creados, ${result.skipped} omitidos.</p>`;
    if (result.errors && result.errors.length > 0) {
      html += '<details><summary>Ver errores</summary><ul>';
      result.errors.slice(0, 20).forEach(e => {
        html += `<li>Fila ${e.row}: ${escapeHtml(e.msg)}</li>`;
      });
      if (result.errors.length > 20) html += `<li>... y ${result.errors.length - 20} más</li>`;
      html += '</ul></details>';
    }
    resultEl.innerHTML = html;
    resultEl.className = 'import-result ' + (result.created > 0 ? 'success-msg' : result.errors?.length ? 'error-msg' : 'success-msg');
    showFeedback(`${result.created} recambios importados`, 'success');
    loadRecambios();
    resetImport();
  } catch (err) {
    showFeedback(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function resetImport() {
  importData = { headers: [], rows: [], mapping: {} };
  document.getElementById('import-file').value = '';
  document.getElementById('import-filename').textContent = '';
  document.getElementById('import-mapping').classList.add('hidden');
  document.getElementById('import-result').classList.add('hidden');
}

function handleImportFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  resetImport();
  parseFile(file).then(({ headers, rows }) => {
    importData = { headers, rows, mapping: {} };
    document.getElementById('import-filename').textContent = file.name;
    document.getElementById('import-mapping').classList.remove('hidden');
    buildMappingUI();
    IMPORT_FIELDS.forEach(f => {
      const sel = document.getElementById(`map-${f.key}`);
      if (sel) {
        const idx = headers.findIndex(h => {
          const hl = String(h).toLowerCase();
          const kl = f.key.replace(/_/g, ' ').toLowerCase();
          return hl.includes(kl) || kl.includes(hl);
        });
        if (idx >= 0) sel.value = String(idx);
        sel.addEventListener('change', buildPreview);
      }
    });
    buildPreview();
  }).catch(err => {
    showFeedback(err.message, 'error');
  });
}

// =============================================================================
// Init
// =============================================================================

async function init() {
  try {
    customFieldsDefinitions = await api('/custom-fields');
  } catch {
    customFieldsDefinitions = [];
  }

  loadCustomFieldsForForm('nuevo-custom-fields');
  loadRecambios();
  loadCamposView();

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      showView(tab.dataset.view);
      if (tab.dataset.view === 'campos') loadCamposView();
    });
  });

  const importFileInput = document.getElementById('import-file');
  const btnSelectFile = document.getElementById('btn-select-file');
  if (btnSelectFile && importFileInput) {
    btnSelectFile.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', handleImportFileSelect);
  }
  document.getElementById('btn-importar')?.addEventListener('click', doImport);
  document.getElementById('btn-import-reset')?.addEventListener('click', resetImport);

  document.getElementById('btn-add-campo').addEventListener('click', addNuevoCampo);

  document.getElementById('form-nuevo').addEventListener('submit', submitNuevo);
  document.getElementById('form-editar').addEventListener('submit', submitEditar);

  document.getElementById('btn-buscar').addEventListener('click', loadRecambios);

  let searchDebounceTimer;
  document.getElementById('filter-search').addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    const searchInput = document.getElementById('filter-search');
    if (!searchInput.value.trim()) {
      loadRecambios();
    } else {
      searchDebounceTimer = setTimeout(loadRecambios, 150);
    }
  });
  document.getElementById('filter-search').addEventListener('keypress', e => {
    if (e.key === 'Enter') loadRecambios();
  });

  document.getElementById('filter-fabricante').addEventListener('change', loadRecambios);

  const filterSort = document.getElementById('filter-sort');
  try {
    const storedSort = localStorage.getItem(SORT_STORAGE_KEY);
    if (storedSort && filterSort.querySelector(`option[value="${storedSort}"]`)) {
      filterSort.value = storedSort;
    }
  } catch {}
  filterSort.addEventListener('change', () => {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, filterSort.value);
    } catch {}
    loadRecambios();
  });

  document.getElementById('btn-cerrar-editar').addEventListener('click', () => showEditarPanel(false));

  document.getElementById('btn-cerrar-detalle').addEventListener('click', () => showDetallePanel(false));
  document.getElementById('btn-cerrar-detalle-abajo').addEventListener('click', () => showDetallePanel(false));

  document.getElementById('btn-editar-desde-detalle').addEventListener('click', () => {
    const id = document.getElementById('btn-editar-desde-detalle').dataset.id;
    if (id) {
      showDetallePanel(false);
      openEditar(parseInt(id));
    }
  });

  document.getElementById('btn-eliminar-desde-detalle').addEventListener('click', eliminarRecambioDesdeDetalle);

  document.getElementById('btn-eliminar-seleccionados')?.addEventListener('click', eliminarSeleccionados);

  const btnCancelarEditar = document.getElementById('btn-cancelar-editar');
  if (btnCancelarEditar) {
    btnCancelarEditar.addEventListener('click', () => showEditarPanel(false));
  }

  document.getElementById('editar-cantidad').addEventListener('input', e => {
    updateStockBajoBadge(parseInt(e.target.value) || 0);
  });
}

initTheme();
init();
