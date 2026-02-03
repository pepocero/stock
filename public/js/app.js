/**
 * Stock Recambios - Frontend
 * Panel de gestión de inventario
 */

const API_BASE = '/api';
const STOCK_BAJO_UMBRAL = 5;

let customFieldsDefinitions = [];

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
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Cargando...</td></tr>';

  try {
    const recambios = await api(`/recambios?${params}`);
    renderTable(recambios, tbody);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="error-msg">${err.message}</td></tr>`;
  }
}

function renderTable(recambios, tbody) {
  if (!recambios.length) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="empty-state">
        <p>No hay recambios. Añade el primero desde "Nuevo recambio".</p>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = recambios.map(r => {
    const stockBajo = r.cantidad < STOCK_BAJO_UMBRAL;
    const cantidadClass = stockBajo ? 'cantidad-stock-bajo' : '';
    return `
      <tr>
        <td>${escapeHtml(r.fabricante)}</td>
        <td>${escapeHtml(r.codigo_interno)}</td>
        <td>${escapeHtml(r.nombre_tecnico)}</td>
        <td>${escapeHtml(r.alias)}</td>
        <td class="col-cantidad ${cantidadClass}">${r.cantidad}</td>
        <td class="btn-cell">
          <button class="btn-sm btn-edit" data-id="${r.id}">Editar</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditar(parseInt(btn.dataset.id)));
  });
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

  document.getElementById('btn-add-campo').addEventListener('click', addNuevoCampo);

  document.getElementById('form-nuevo').addEventListener('submit', submitNuevo);
  document.getElementById('form-editar').addEventListener('submit', submitEditar);

  document.getElementById('btn-buscar').addEventListener('click', loadRecambios);
  document.getElementById('filter-search').addEventListener('keypress', e => {
    if (e.key === 'Enter') loadRecambios();
  });

  document.getElementById('btn-cerrar-editar').addEventListener('click', () => showEditarPanel(false));

  document.getElementById('editar-cantidad').addEventListener('input', e => {
    updateStockBajoBadge(parseInt(e.target.value) || 0);
  });
}

init();
