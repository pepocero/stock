/**
 * Stock Recambios - Frontend
 * Panel de gestión de inventario
 */

const API_BASE = '/api';
const STOCK_BAJO_UMBRAL = 5;
const APP_VERSION = '1.1.19';
const VERSION_STORAGE_KEY = 'stock_app_version';

let fabricantesList = [];
let utilizadosData = [];
let pendientesData = [];
let billeterosData = [];
let recuperadosData = [];
let deferredInstallPrompt = null;
let backHandler = null;
let lastBackPressAt = 0;

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
    stored = 'light';
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
  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = data?.error || `Error ${res.status}`;
    throw new Error(err);
  }
  return data;
}

// =============================================================================
// PWA / Versión
// =============================================================================

function initVersion() {
  const versionEl = document.getElementById('app-version');
  if (versionEl) {
    versionEl.textContent = `v${APP_VERSION}`;
  }
  try {
    const stored = localStorage.getItem(VERSION_STORAGE_KEY);
    if (stored && stored !== APP_VERSION) {
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
      showFeedback(`Nueva versión cargada (${APP_VERSION})`, 'success');
    } else if (!stored) {
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
}

function initPWA() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js').catch(() => {});

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('btn-instalar-app');
    if (btn) btn.classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('btn-instalar-app');
    if (btn) btn.classList.add('hidden');
    showFeedback('Aplicación instalada correctamente', 'success');
  });
}

async function handleInstalarApp() {
  if (!deferredInstallPrompt) {
    showFeedback('La instalación no está disponible en este dispositivo', 'error');
    return;
  }
  deferredInstallPrompt.prompt();
  try {
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      const btn = document.getElementById('btn-instalar-app');
      if (btn) btn.classList.add('hidden');
    }
  } finally {
    deferredInstallPrompt = null;
  }
}

function isStandalonePWA() {
  return (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: minimal-ui)').matches)) ||
    (window.navigator && window.navigator.standalone);
}

function pushHistoryState(state) {
  if (typeof history === 'undefined' || !history.pushState) return;
  try {
    history.pushState(state, document.title, location.href);
  } catch {}
}

function handlePopState(event) {
  const state = event && event.state;
  if (state && state.panel === 'detalle' && state.id != null) {
    try {
      openDetalle(Number(state.id), false);
    } catch (err) {
      showDetallePanel(false);
    }
    return;
  }
  if (state && state.panel === 'editar' && state.id != null) {
    try {
      openEditar(Number(state.id), false);
    } catch (err) {
      showEditarPanel(false);
    }
    return;
  }
  showDetallePanel(false);
  showEditarPanel(false);
  if (isStandalonePWA()) {
    const now = Date.now();
    if (now - lastBackPressAt < 1000) {
      window.removeEventListener('popstate', backHandler);
      backHandler = null;
      lastBackPressAt = 0;
      history.back();
      return;
    }
    lastBackPressAt = now;
    showFeedback('Pulsa 2 veces para cerrar la app', 'error');
    try {
      if (history.pushState) {
        history.pushState({ root: true }, document.title, location.href);
      }
    } catch {}
  }
}

function setupBackButtonHistory() {
  if (backHandler) return;
  if (typeof history === 'undefined' || !history.replaceState || !history.pushState) return;
  try {
    history.replaceState({ root: true }, document.title, location.href);
    history.pushState({ root: true }, document.title, location.href);
  } catch {
    return;
  }
  backHandler = handlePopState;
  window.addEventListener('popstate', backHandler);
}

function initBackButtonBehavior() {
  if (window.self !== window.top) return;

  function setupOnFirstInteraction() {
    setupBackButtonHistory();
  }

  if (isStandalonePWA()) {
    document.addEventListener('click', setupOnFirstInteraction, { once: true, passive: true });
    document.addEventListener('touchstart', setupOnFirstInteraction, { once: true, passive: true });
    document.addEventListener('scroll', setupOnFirstInteraction, { once: true, passive: true });
  } else {
    window.addEventListener('popstate', handlePopState);
  }
}

// =============================================================================
// Vistas
// =============================================================================

const VIEW_TITLES = {
  listado: 'Listado',
  nuevo: 'Nuevo recambio',
  importar: 'Importar',
  fabricantes: 'Fabricantes',
  utilizados: 'Recambios Utilizados',
  pendientes: 'Pendientes',
  billeteros: 'Billeteros',
  campos: 'Campos adicionales'
};

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const view = document.getElementById(`view-${viewId}`);
  const tab = document.querySelector(`[data-view="${viewId}"]`);
  if (view) view.classList.add('active');
  if (tab) tab.classList.add('active');
  const titleEl = document.getElementById('content-title');
  if (titleEl) titleEl.textContent = VIEW_TITLES[viewId] || viewId;
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
  const sortVal = document.getElementById('filter-sort')?.value || 'nombre-asc';
  const [sortBy, sortOrder] = sortVal.split('-');
  const params = new URLSearchParams();
  if (fabricante) params.set('fabricante', fabricante);
  if (search) params.set('search', search);
  params.set('sortBy', sortBy);
  params.set('sortOrder', sortOrder);

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
        <td>${escapeHtml(r.codigo)}</td>
        <td>${escapeHtml(r.alias || '')}</td>
        <td>${escapeHtml(r.nombre)}</td>
        <td>${escapeHtml(r.fabricante)}</td>
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

async function submitNuevo(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const data = {
    codigo: document.getElementById('nuevo-codigo').value.trim(),
    nombre: document.getElementById('nuevo-nombre').value.trim(),
    fabricante: document.getElementById('nuevo-fabricante').value,
    alias: document.getElementById('nuevo-alias').value.trim() || '',
    cantidad: parseInt(document.getElementById('nuevo-cantidad').value) || 0
  };

  try {
    await api('/recambios', { method: 'POST', body: data });
    showFeedback('Recambio creado correctamente', 'success');
    e.target.reset();
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

async function openDetalle(id, pushState = true) {
  try {
    const recambio = await api(`/recambios/${id}`);
    const infoEl = document.getElementById('detalle-info');
    const stockBajo = recambio.cantidad < STOCK_BAJO_UMBRAL;

    const hoy = new Date().toISOString().slice(0, 10);
    document.getElementById('detalle-fecha-utilizado').value = hoy;
    document.getElementById('detalle-cantidad-utilizado').value = '1';
    const usadoCheck = document.getElementById('detalle-usado');
    if (usadoCheck) usadoCheck.checked = false;

    infoEl.innerHTML = `
      <div class="detalle-section-title">Datos del recambio</div>
      <div class="detalle-item">
        <span class="detalle-label">Código</span>
        <span class="detalle-value">${escapeHtml(recambio.codigo)}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Nombre</span>
        <span class="detalle-value">${escapeHtml(recambio.nombre) || '—'}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Fabricante</span>
        <span class="detalle-value">${escapeHtml(recambio.fabricante)}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Alias</span>
        <span class="detalle-value ${!recambio.alias ? 'empty' : ''}">${escapeHtml(recambio.alias) || '—'}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Stock</span>
        <span class="detalle-value"><span class="badge-stock ${stockBajo ? 'badge-stock-bajo' : ''}" id="detalle-stock-badge">${recambio.cantidad}</span></span>
      </div>
    `;

    document.getElementById('btn-editar-desde-detalle').dataset.id = recambio.id;
    document.getElementById('btn-eliminar-desde-detalle').dataset.id = recambio.id;
    document.getElementById('btn-check-utilizado').dataset.id = recambio.id;
    showDetallePanel(true);
    if (pushState !== false) pushHistoryState({ panel: 'detalle', id: recambio.id });
  } catch (err) {
    showFeedback(err.message, 'error');
  }
}

function fechaToYYYYMMDD(val) {
  if (!val || typeof val !== 'string') return new Date().toISOString().slice(0, 10);
  const trimmed = val.trim();
  if (!trimmed) return new Date().toISOString().slice(0, 10);
  const matchDDMM = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (matchDDMM) {
    const [, d, m, y] = matchDDMM;
    const pad = n => String(n).padStart(2, '0');
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  const matchYYYY = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (matchYYYY) return trimmed;
  return new Date().toISOString().slice(0, 10);
}

async function registrarUtilizado() {
  const id = document.getElementById('btn-check-utilizado').dataset.id;
  if (!id) return;
  const fechaInput = document.getElementById('detalle-fecha-utilizado').value;
  const fecha = fechaToYYYYMMDD(fechaInput);
  const cantidad = parseInt(document.getElementById('detalle-cantidad-utilizado').value) || 1;
  if (cantidad < 1) {
    showFeedback('Selecciona una cantidad mayor a 0', 'error');
    return;
  }
  const stockActual = parseInt(document.getElementById('detalle-stock-badge')?.textContent, 10) || 0;
  if (stockActual < cantidad) {
    showFeedback(`Stock insuficiente. Disponible: ${stockActual}`, 'error');
    return;
  }
  const usado = document.getElementById('detalle-usado')?.checked || false;
  try {
    await api(`/recambios/${id}/utilizar`, { method: 'POST', body: { fecha, cantidad, usado } });
    const msg = cantidad === 1 ? 'El stock se ha disminuido en 1 unidad.' : `El stock se ha disminuido en ${cantidad} unidades.`;
    showModalNotificacion('Recambio Utilizado', msg);
    const recambio = await api(`/recambios/${id}`);
    const badge = document.getElementById('detalle-stock-badge');
    if (badge) badge.textContent = recambio.cantidad;
    badge?.classList.toggle('badge-stock-bajo', recambio.cantidad < STOCK_BAJO_UMBRAL);
    loadRecambios();
    loadUtilizados();
  } catch (err) {
    showFeedback(err.message, 'error');
  }
}

async function registrarRecuperado() {
  const id = document.getElementById('btn-check-recuperado').dataset.id;
  if (!id) return;
  const fechaInput = document.getElementById('detalle-fecha-recuperado').value;
  const fecha = fechaToYYYYMMDD(fechaInput);
  const cantidad = parseInt(document.getElementById('detalle-cantidad-recuperado').value) || 1;
  if (cantidad < 1) {
    showFeedback('Selecciona una cantidad mayor a 0', 'error');
    return;
  }
  try {
    await api(`/recambios/${id}/recuperar`, { method: 'POST', body: { fecha, cantidad } });
    const msg = cantidad === 1 ? 'El stock se ha aumentado en 1 unidad.' : `El stock se ha aumentado en ${cantidad} unidades.`;
    showModalNotificacion('Recambio Recuperado', msg);
    const recambio = await api(`/recambios/${id}`);
    const badge = document.getElementById('detalle-stock-badge');
    if (badge) badge.textContent = recambio.cantidad;
    badge?.classList.toggle('badge-stock-bajo', recambio.cantidad < STOCK_BAJO_UMBRAL);
    loadRecambios();
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

async function openEditar(id, pushState = true) {
  try {
    const recambio = await api(`/recambios/${id}`);
    document.getElementById('editar-id').value = recambio.id;
    document.getElementById('editar-codigo').value = recambio.codigo;
    document.getElementById('editar-nombre').value = recambio.nombre || '';
    document.getElementById('editar-fabricante').value = recambio.fabricante;
    document.getElementById('editar-alias').value = recambio.alias || '';
    const cantidad = Math.max(0, parseInt(recambio.cantidad) || 0);
    const cantidadSelect = document.getElementById('editar-cantidad');
    cantidadSelect.value = String(Math.min(20, cantidad));

    updateStockBajoBadge(parseInt(cantidadSelect.value) || 0);
    showEditarPanel(true);
    if (pushState !== false) pushHistoryState({ panel: 'editar', id: recambio.id });
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
    codigo: document.getElementById('editar-codigo').value.trim(),
    nombre: document.getElementById('editar-nombre').value.trim(),
    fabricante: document.getElementById('editar-fabricante').value,
    alias: document.getElementById('editar-alias').value.trim() || '',
    cantidad: Math.max(0, parseInt(document.getElementById('editar-cantidad').value) || 0)
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

function formatDateDDMMYYYY(fechaStr) {
  if (!fechaStr) return '';
  const [y, m, d] = String(fechaStr).split(/[-/]/);
  if (!y || !m || !d) return fechaStr;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d)}/${pad(m)}/${y}`;
}

function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showFeedback(msg, type) {
  const existing = document.querySelector('.toast-msg');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `toast-msg toast-${type === 'success' ? 'success' : 'error'}`;
  el.textContent = msg;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  document.body.appendChild(el);
  el.offsetHeight;
  el.classList.add('toast-visible');
  setTimeout(() => {
    el.classList.remove('toast-visible');
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function showModalNotificacion(titulo, mensaje) {
  const overlay = document.getElementById('modal-notificacion');
  const tituloEl = overlay.querySelector('.modal-notificacion-titulo');
  const mensajeEl = overlay.querySelector('.modal-notificacion-mensaje');
  if (!overlay || !tituloEl || !mensajeEl) return;
  tituloEl.textContent = titulo;
  mensajeEl.textContent = mensaje;
  overlay.classList.remove('hidden');
  overlay.querySelector('#btn-cerrar-modal-notificacion')?.focus();
}

function closeModalNotificacion() {
  const overlay = document.getElementById('modal-notificacion');
  if (overlay) overlay.classList.add('hidden');
}

function showModalUtilizadoDetalle(item) {
  const overlay = document.getElementById('modal-utilizado-detalle');
  const content = document.getElementById('modal-utilizado-detalle-content');
  if (!overlay || !content) return;
  const recup = item.recuperado || 'Pendiente';
  const fecharecup = item.fecharecup ? formatDateDDMMYYYY(item.fecharecup) : '—';
  content.innerHTML = `
    <div class="modal-utilizado-item">
      <span class="modal-utilizado-label">Fecha</span>
      <span class="modal-utilizado-value">${escapeHtml(formatDateDDMMYYYY(item.fecha))}</span>
    </div>
    <div class="modal-utilizado-item">
      <span class="modal-utilizado-label">Código</span>
      <span class="modal-utilizado-value">${escapeHtml(item.codigo)}</span>
    </div>
    <div class="modal-utilizado-item">
      <span class="modal-utilizado-label">Nombre</span>
      <span class="modal-utilizado-value">${escapeHtml(item.nombre || '—')}</span>
    </div>
    <div class="modal-utilizado-item">
      <span class="modal-utilizado-label">Alias</span>
      <span class="modal-utilizado-value">${escapeHtml(item.alias || '—')}</span>
    </div>
    <div class="modal-utilizado-item">
      <span class="modal-utilizado-label">Cantidad</span>
      <span class="modal-utilizado-value">${item.cantidad}</span>
    </div>
    <div class="modal-utilizado-item">
      <span class="modal-utilizado-label">Recuperado</span>
      <select class="select-recuperado modal-utilizado-select" data-id="${item.id}" title="Estado de recuperación">
        <option value="Pendiente" ${recup === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
        <option value="Recuperado" ${recup === 'Recuperado' ? 'selected' : ''}>Recuperado</option>
        <option value="Eliminar">Eliminar</option>
      </select>
    </div>
    <div class="modal-utilizado-item">
      <span class="modal-utilizado-label">Fecha Recup.</span>
      <span class="modal-utilizado-value" id="modal-utilizado-fecharecup">${escapeHtml(fecharecup)}</span>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.querySelector('#btn-cerrar-modal-utilizado')?.focus();

  const sel = content.querySelector('.select-recuperado.modal-utilizado-select');
  if (sel) {
    sel.addEventListener('change', async (e) => {
      const valor = e.target.value;
      const prevVal = utilizadosData.find(u => u.id === item.id)?.recuperado || 'Pendiente';

      if (valor === 'Eliminar') {
        if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) {
          e.target.value = prevVal;
          return;
        }
        try {
          await api(`/utilizados/${item.id}`, { method: 'DELETE' });
          utilizadosData = utilizadosData.filter(u => u.id !== item.id);
          showFeedback('Registro eliminado', 'success');
          closeModalUtilizadoDetalle();
          removeUtilizadoRowFromDOM(item.id);
        } catch (err) {
          showFeedback(err.message, 'error');
          e.target.value = prevVal;
        }
        return;
      }

      try {
        await api(`/utilizados/${item.id}`, { method: 'PATCH', body: { recuperado: valor } });
        const u = utilizadosData.find(u => u.id === item.id);
        if (u) {
          u.recuperado = valor;
          u.fecharecup = valor === 'Recuperado' ? new Date().toISOString().slice(0, 10) : null;
        }
        const fecharecupEl = document.getElementById('modal-utilizado-fecharecup');
        if (fecharecupEl) fecharecupEl.textContent = valor === 'Recuperado' ? formatDateDDMMYYYY(new Date().toISOString().slice(0, 10)) : '—';
        showFeedback(valor === 'Recuperado' ? 'Marcado como Recuperado' : 'Marcado como Pendiente', 'success');
        const row = document.querySelector(`#utilizados-list tr[data-id="${item.id}"]`);
        if (row) {
          const tc = row.querySelector('td:last-child');
          if (tc) tc.textContent = valor === 'Recuperado' ? formatDateDDMMYYYY(new Date().toISOString().slice(0, 10)) : '-';
          const rowSel = row.querySelector('.select-recuperado');
          if (rowSel) rowSel.value = valor;
        }
      } catch (err) {
        showFeedback(err.message, 'error');
        e.target.value = prevVal;
      }
    });
  }
}

function closeModalUtilizadoDetalle() {
  const overlay = document.getElementById('modal-utilizado-detalle');
  if (overlay) overlay.classList.add('hidden');
}

const BILLETERO_SELECT_OPTS = [{ v: '', l: '--' }, { v: 'Lithos', l: 'Lithos' }, { v: 'NV9', l: 'NV9' }, { v: 'BT11', l: 'BT11' }, { v: 'BT10', l: 'BT10' }];

function showModalBilleteroDetalle(item) {
  const overlay = document.getElementById('modal-billetero-detalle');
  const content = document.getElementById('modal-billetero-detalle-content');
  if (!overlay || !content) return;
  const selBilletero = (key) => BILLETERO_SELECT_OPTS.map(o => `<option value="${o.v}" ${(item[key] || '') === o.v ? 'selected' : ''}>${escapeHtml(o.l)}</option>`).join('');
  const selRecup = BILLETERO_RECUPERADO_OPTS.map(o => `<option value="${o.v}" ${(item.recuperado || '') === o.v ? 'selected' : ''}>${escapeHtml(o.l)}</option>`).join('');
  const selPend = BILLETERO_PENDIENTE_OPTS.map(o => `<option value="${o.v}" ${(item.pendiente || '') === o.v ? 'selected' : ''}>${escapeHtml(o.l)}</option>`).join('');
  content.innerHTML = `
    <form id="form-billetero-detalle" class="modal-billetero-form">
      <div class="modal-utilizado-item">
        <label class="modal-utilizado-label" for="modal-billetero-fecha">Fecha</label>
        <input type="date" id="modal-billetero-fecha" class="modal-billetero-input" value="${escapeHtml(item.fecha || '')}">
      </div>
      <div class="modal-utilizado-item">
        <label class="modal-utilizado-label" for="modal-billetero-bar">Bar</label>
        <textarea id="modal-billetero-bar" class="modal-billetero-input modal-billetero-textarea" rows="2">${escapeHtml(item.bar || '')}</textarea>
      </div>
      <div class="modal-utilizado-item">
        <label class="modal-utilizado-label" for="modal-billetero-retirado">Billetero Retirado</label>
        <select id="modal-billetero-retirado" class="modal-billetero-input modal-billetero-select">${selBilletero('billetero_retirado')}</select>
      </div>
      <div class="modal-utilizado-item">
        <label class="modal-utilizado-label" for="modal-billetero-serie-retirado">Serie Retirado</label>
        <input type="text" id="modal-billetero-serie-retirado" class="modal-billetero-input" value="${escapeHtml(item.serie_retirado || '')}">
      </div>
      <div class="modal-utilizado-item">
        <label class="modal-utilizado-label" for="modal-billetero-suplente">Billetero Suplente</label>
        <select id="modal-billetero-suplente" class="modal-billetero-input modal-billetero-select">${selBilletero('billetero_suplente')}</select>
      </div>
      <div class="modal-utilizado-item">
        <label class="modal-utilizado-label" for="modal-billetero-serie-suplente">Serie Suplente</label>
        <input type="text" id="modal-billetero-serie-suplente" class="modal-billetero-input" value="${escapeHtml(item.serie_suplente || '')}">
      </div>
      <div class="modal-utilizado-item">
        <label class="modal-utilizado-label" for="modal-billetero-recuperado">Recuperado</label>
        <select id="modal-billetero-recuperado" class="modal-billetero-input modal-billetero-select">${selRecup}</select>
      </div>
      <div class="modal-utilizado-item">
        <label class="modal-utilizado-label" for="modal-billetero-pendiente">Pendiente</label>
        <select id="modal-billetero-pendiente" class="modal-billetero-input modal-billetero-select">${selPend}</select>
      </div>
      <div class="modal-utilizado-item">
        <label class="modal-utilizado-label" for="modal-billetero-otro">Otro Billetero</label>
        <select id="modal-billetero-otro" class="modal-billetero-input modal-billetero-select">${selBilletero('otro_billetero')}</select>
      </div>
      <div class="modal-utilizado-item">
        <label class="modal-utilizado-label" for="modal-billetero-serie-otro">Serie Otro</label>
        <input type="text" id="modal-billetero-serie-otro" class="modal-billetero-input" value="${escapeHtml(item.serie_otro || '')}">
      </div>
      <div class="modal-billetero-actions">
        <button type="submit" class="btn btn-danger">Guardar</button>
      </div>
    </form>
  `;
  overlay.classList.remove('hidden');
  overlay.querySelector('#modal-billetero-fecha')?.focus();

  content.querySelector('#form-billetero-detalle').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fecha = document.getElementById('modal-billetero-fecha').value?.trim();
    if (!fecha) {
      showFeedback('La fecha es obligatoria', 'error');
      return;
    }
    const payload = {
      fecha,
      bar: document.getElementById('modal-billetero-bar').value?.trim() || null,
      billetero_retirado: document.getElementById('modal-billetero-retirado').value || null,
      serie_retirado: document.getElementById('modal-billetero-serie-retirado').value?.trim() || null,
      billetero_suplente: document.getElementById('modal-billetero-suplente').value || null,
      serie_suplente: document.getElementById('modal-billetero-serie-suplente').value?.trim() || null,
      recuperado: document.getElementById('modal-billetero-recuperado').value || null,
      pendiente: document.getElementById('modal-billetero-pendiente').value || null,
      otro_billetero: document.getElementById('modal-billetero-otro').value || null,
      serie_otro: document.getElementById('modal-billetero-serie-otro').value?.trim() || null
    };
    try {
      await api(`/billeteros/${item.id}`, { method: 'PATCH', body: payload });
      const b = billeterosData.find(x => x.id === item.id);
      if (b) Object.assign(b, payload);
      renderBilleterosView(billeterosData);
      showFeedback('Cambios guardados', 'success');
    } catch (err) {
      showFeedback(err.message || 'Error al guardar', 'error');
    }
  });
}

function closeModalBilleteroDetalle() {
  const overlay = document.getElementById('modal-billetero-detalle');
  if (overlay) overlay.classList.add('hidden');
}

// =============================================================================
// Fabricantes
// =============================================================================

function populateFabricanteSelects() {
  const options = fabricantesList.map(f => `<option value="${escapeHtml(f.nombre)}">${escapeHtml(f.nombre)}</option>`).join('');
  const filterSelect = document.getElementById('filter-fabricante');
  if (filterSelect) {
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">Todos los fabricantes</option>' + options;
    if (fabricantesList.some(f => f.nombre === currentVal)) filterSelect.value = currentVal;
  }
  const nuevoSelect = document.getElementById('nuevo-fabricante');
  if (nuevoSelect) {
    nuevoSelect.innerHTML = '<option value="">Seleccionar...</option>' + options;
  }
  const editarSelect = document.getElementById('editar-fabricante');
  if (editarSelect) {
    const currentVal = editarSelect.value;
    editarSelect.innerHTML = options;
    if (fabricantesList.some(f => f.nombre === currentVal)) editarSelect.value = currentVal;
  }
}

async function loadFabricantesView() {
  const container = document.getElementById('fabricantes-lista');
  if (!fabricantesList.length) {
    container.innerHTML = '<p class="empty-state">No hay fabricantes. Añade el primero abajo.</p>';
    return;
  }

  container.innerHTML = fabricantesList.map(f => `
    <div class="campo-item" data-id="${f.id}">
      <input type="text" value="${escapeHtml(f.nombre)}" data-fabricante-id="${f.id}" placeholder="Nombre del fabricante">
      <button type="button" class="btn-sm btn-edit btn-save-fabricante" data-id="${f.id}">Guardar</button>
      <button type="button" class="btn-sm btn-danger btn-delete-fabricante" data-id="${f.id}" title="Eliminar">🗑</button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-save-fabricante').forEach(btn => {
    btn.addEventListener('click', () => saveFabricanteNombre(parseInt(btn.dataset.id)));
  });
  container.querySelectorAll('.btn-delete-fabricante').forEach(btn => {
    btn.addEventListener('click', () => deleteFabricante(parseInt(btn.dataset.id)));
  });
  container.querySelectorAll('.campo-item input').forEach(inp => {
    inp.addEventListener('keypress', e => {
      if (e.key === 'Enter') saveFabricanteNombre(parseInt(inp.dataset.fabricanteId));
    });
  });
}

async function saveFabricanteNombre(id) {
  const item = document.querySelector(`#fabricantes-lista .campo-item[data-id="${id}"]`);
  const input = item?.querySelector('input');
  if (!input) return;
  const nuevoNombre = input.value.trim();
  if (!nuevoNombre) {
    showFeedback('El nombre no puede estar vacío', 'error');
    return;
  }
  try {
    await api(`/fabricantes/${id}`, { method: 'PUT', body: { nombre: nuevoNombre } });
    showFeedback('Fabricante actualizado', 'success');
    await refreshFabricantes();
  } catch (err) {
    showFeedback(err.message, 'error');
  }
}

async function deleteFabricante(id) {
  if (!confirm('¿Eliminar este fabricante? Los recambios con este fabricante quedarán con un valor no válido.')) return;
  try {
    await api(`/fabricantes/${id}`, { method: 'DELETE' });
    showFeedback('Fabricante eliminado', 'success');
    await refreshFabricantes();
  } catch (err) {
    showFeedback(err.message, 'error');
  }
}

async function addFabricante() {
  const input = document.getElementById('nuevo-fabricante-nombre');
  const nombre = input.value.trim();
  if (!nombre) {
    showFeedback('Escribe el nombre del fabricante', 'error');
    return;
  }
  try {
    await api('/fabricantes', { method: 'POST', body: { nombre } });
    showFeedback('Fabricante añadido', 'success');
    input.value = '';
    await refreshFabricantes();
  } catch (err) {
    showFeedback(err.message, 'error');
  }
}

async function refreshFabricantes() {
  fabricantesList = await api('/fabricantes');
  populateFabricanteSelects();
  loadFabricantesView();
  loadRecambios();
  const editarPanel = document.getElementById('view-editar');
  if (editarPanel?.classList.contains('active')) {
    const id = document.getElementById('editar-id')?.value;
    if (id) openEditar(parseInt(id));
  }
}

// =============================================================================
// Importar
// =============================================================================

const IMPORT_FIELDS = [
  { key: 'codigo', label: 'Código' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'fabricante', label: 'Fabricante' },
  { key: 'alias', label: 'Alias' },
  { key: 'cantidad', label: 'Stock' }
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
  const replaceMode = document.querySelector('input[name="import-mode"]:checked')?.value === 'replace';
  if (replaceMode && !confirm(
    '¿Estás seguro? Se eliminarán TODOS los recambios de la base de datos y solo quedarán los del archivo importado. Esta acción no se puede deshacer.\n\n¿Continuar?'
  )) {
    return;
  }
  const btn = document.getElementById('btn-importar');
  btn.disabled = true;
  try {
    const result = await api('/recambios/import', { method: 'POST', body: { items, replace: replaceMode } });
    const resultEl = document.getElementById('import-result');
    resultEl.classList.remove('hidden');
    let html = `<p><strong>Importación completada:</strong> ${result.created} creados, ${result.skipped} omitidos.`;
    if (result.deleted > 0) {
      html += ` ${result.deleted} recambios eliminados (modo sobrescribir).`;
    }
    html += '</p>';
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
  const appendRadio = document.querySelector('input[name="import-mode"][value="append"]');
  if (appendRadio) appendRadio.checked = true;
  document.getElementById('import-replace-warning')?.classList.add('hidden');
}

// =============================================================================
// Recambios Utilizados y Recuperados
// =============================================================================

function groupByDate(items) {
  const groups = {};
  for (const item of items) {
    const fecha = item.fecha || '';
    if (!groups[fecha]) groups[fecha] = [];
    groups[fecha].push(item);
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

function renderRegistrosPorFecha(containerId, items, tipo, titulo, expandAll = false) {
  const container = document.getElementById(containerId);
  if (!items.length) {
    container.innerHTML = '<p class="empty-state">No hay registros.</p>';
    return;
  }

  const groups = groupByDate(items);
  container.innerHTML = groups.map(([fecha, registros]) => {
    const fechaId = fecha.replace(/-/g, '');
    const fechaLabel = formatDateDDMMYYYY(fecha);
    const rows = registros.map(r => {
      const recup = r.recuperado || 'Pendiente';
      const fecharecup = r.fecharecup ? formatDateDDMMYYYY(r.fecharecup) : '-';
      return `
      <tr class="registro-utilizado-row" data-id="${r.id}" tabindex="0" role="button">
        <td>${escapeHtml(formatDateDDMMYYYY(r.fecha))}</td>
        <td>${escapeHtml(r.codigo)}</td>
        <td>${escapeHtml(r.nombre || '')}</td>
        ${tipo === 'utilizados' ? `<td>${escapeHtml(r.alias || '')}</td>` : ''}
        <td>${r.cantidad}</td>
        <td onclick="event.stopPropagation()">
          <select class="select-recuperado" data-id="${r.id}" title="Estado de recuperación">
            <option value="Pendiente" ${recup === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="Recuperado" ${recup === 'Recuperado' ? 'selected' : ''}>Recuperado</option>
            <option value="Eliminar">Eliminar</option>
          </select>
        </td>
        <td>${escapeHtml(fecharecup)}</td>
      </tr>
    `;
    }).join('');
    const thead = tipo === 'utilizados'
      ? '<thead><tr><th>Fecha</th><th>Código</th><th>Nombre</th><th>Alias</th><th>Cantidad</th><th>Recuperado</th><th>Fecha Recup.</th></tr></thead>'
      : '<thead><tr><th>Fecha</th><th>Código</th><th>Nombre</th><th>Cantidad</th><th>Recuperado</th><th>Fecha Recup.</th></tr></thead>';
    return `
      <div class="registro-fecha-group" data-fecha="${fecha}">
        <div class="registro-fecha-header" data-fecha="${fecha}" role="button" tabindex="0">
          <div class="registro-fecha-header-main">
            <span class="registro-fecha-toggle">${expandAll ? '▼' : '▶'}</span>
            <span class="registro-fecha-label">${escapeHtml(fechaLabel)}</span>
            <div class="registro-fecha-actions">
              ${tipo === 'utilizados' ? `<span class="registro-fecha-checkbox-wrap hidden"><input type="checkbox" class="registro-fecha-checkbox" data-fecha="${fecha}" data-tipo="${tipo}" onclick="event.stopPropagation()"></span>` : `<input type="checkbox" class="registro-fecha-checkbox" data-fecha="${fecha}" data-tipo="${tipo}" onclick="event.stopPropagation()">`}
              <div class="exportar-dropdown-wrapper">
                <button type="button" class="btn btn-sm btn-secondary btn-exportar-fecha" data-fecha="${fecha}" data-tipo="${tipo}">Exportar</button>
              </div>
            </div>
          </div>
        </div>
        <div class="registro-fecha-body" id="${tipo}-body-${fechaId}" style="${expandAll ? 'display:block' : 'display:none'}">
          ${tipo === 'utilizados' ? `<div class="registro-fecha-pendientes-row" onclick="event.stopPropagation()"><span class="registro-check-label">Pendientes</span><input type="checkbox" class="registro-fecha-checkbox-pendientes" data-fecha="${fecha}" data-tipo="${tipo}" data-solo-pendientes="true" title="Solo pendientes"></div>` : ''}
          <div class="table-container registro-table-wrap">
            <table class="data-table registro-table">
              ${thead}
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.registro-fecha-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.registro-fecha-actions')) return;
      const fecha = header.dataset.fecha;
      const fechaId = fecha.replace(/-/g, '');
      const body = document.getElementById(`${tipo}-body-${fechaId}`);
      const toggle = header.querySelector('.registro-fecha-toggle');
      if (body.style.display === 'none') {
        body.style.display = 'block';
        toggle.textContent = '▼';
      } else {
        body.style.display = 'none';
        toggle.textContent = '▶';
      }
    });
  });

  container.querySelectorAll('.exportar-dropdown-wrapper').forEach(wrapper => {
    const btn = wrapper.querySelector('.btn-exportar-fecha');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeExportarPortal();
      const fecha = btn.dataset.fecha;
      const itemsFecha = items.filter(i => i.fecha === fecha);
      showExportarPortal(btn, () => exportarRegistrosExcel(titulo, itemsFecha, 'utilizados'), () => exportarRegistrosImagen(titulo, itemsFecha, 'utilizados'));
    });
  });

  container.querySelectorAll('.registro-fecha-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked) {
        const pendientes = e.target.closest('.registro-fecha-group')?.querySelector('.registro-fecha-checkbox-pendientes');
        if (pendientes?.checked) pendientes.checked = false;
      }
      updateExportarSeleccionadosBtn(tipo);
    });
  });
  container.querySelectorAll('.registro-fecha-checkbox-pendientes').forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked) {
        const other = e.target.closest('.registro-fecha-group')?.querySelector('.registro-fecha-checkbox');
        if (other?.checked) other.checked = false;
      }
      updateExportarSeleccionadosBtn(tipo);
    });
  });

  if (tipo === 'utilizados') {
    const checkSeleccionarVarios = document.getElementById('check-seleccionar-varios-dias');
    container.querySelectorAll('.registro-fecha-checkbox-wrap').forEach(wrap => {
      wrap.classList.toggle('hidden', !checkSeleccionarVarios?.checked);
    });
  }

  container.querySelectorAll('.registro-utilizado-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.select-recuperado')) return;
      const id = parseInt(row.dataset.id);
      const item = items.find(i => i.id === id);
      if (!item) return;
      showModalUtilizadoDetalle(item);
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!e.target.closest('.select-recuperado')) row.click();
      }
    });
  });

  container.querySelectorAll('.select-recuperado').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const id = parseInt(e.target.dataset.id);
      const valor = e.target.value;
      const prevVal = utilizadosData.find(u => u.id === id)?.recuperado || 'Pendiente';

      if (valor === 'Eliminar') {
        if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) {
          e.target.value = prevVal;
          return;
        }
        try {
          await api(`/utilizados/${id}`, { method: 'DELETE' });
          utilizadosData = utilizadosData.filter(u => u.id !== id);
          showFeedback('Registro eliminado', 'success');
          removeUtilizadoRowFromDOM(id);
        } catch (err) {
          showFeedback(err.message, 'error');
          e.target.value = prevVal;
        }
        return;
      }

      try {
        await api(`/utilizados/${id}`, { method: 'PATCH', body: { recuperado: valor } });
        const item = utilizadosData.find(u => u.id === id);
        if (item) {
          item.recuperado = valor;
          item.fecharecup = valor === 'Recuperado' ? new Date().toISOString().slice(0, 10) : null;
        }
        showFeedback(valor === 'Recuperado' ? 'Marcado como Recuperado' : 'Marcado como Pendiente', 'success');
        const row = container.querySelector(`tr[data-id="${id}"]`);
        if (row) {
          const fecharecupCell = row.querySelector('td:last-child');
          if (fecharecupCell) {
            fecharecupCell.textContent = item?.fecharecup ? formatDateDDMMYYYY(item.fecharecup) : '-';
          }
        }
      } catch (err) {
        showFeedback(err.message, 'error');
        e.target.value = prevVal;
      }
    });
  });
}

function closeExportarPortal() {
  document.getElementById('exportar-dropdown-portal')?.remove();
}

function showExportarPortal(anchorEl, onExcel, onImagen) {
  closeExportarPortal();
  const rect = anchorEl.getBoundingClientRect();
  const menuH = 90;
  const showAbove = rect.bottom + menuH > window.innerHeight - 20 && rect.top > menuH;
  const menu = document.createElement('div');
  menu.id = 'exportar-dropdown-portal';
  menu.className = 'exportar-dropdown-portal';
  menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 136))}px`;
  menu.style.top = showAbove ? `${rect.top - menuH - 4}px` : `${rect.bottom + 4}px`;

  const close = () => {
    menu.remove();
    document.removeEventListener('click', clickOutside);
  };

  const clickOutside = (e) => {
    if (!menu.contains(e.target) && !anchorEl.contains(e.target)) close();
  };

  menu.innerHTML = `
    <button type="button" class="exportar-option" data-format="excel">Excel</button>
    <button type="button" class="exportar-option" data-format="imagen">Imagen</button>
  `;

  menu.querySelector('[data-format="excel"]').addEventListener('click', (e) => {
    e.stopPropagation();
    onExcel();
    close();
  });
  menu.querySelector('[data-format="imagen"]').addEventListener('click', (e) => {
    e.stopPropagation();
    onImagen();
    close();
  });

  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', clickOutside), 0);
}

function removeUtilizadoRowFromDOM(id) {
  const container = document.getElementById('utilizados-list');
  if (!container) return;
  const row = container.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;
  const group = row.closest('.registro-fecha-group');
  row.remove();
  if (!group) return;
  const tbody = group.querySelector('tbody');
  const remaining = tbody ? tbody.querySelectorAll('tr').length : 0;
  if (remaining <= 0) {
    group.remove();
    if (!container.querySelector('.registro-fecha-group')) {
      container.innerHTML = '<p class="empty-state">No hay registros.</p>';
    }
  } else {
    const countEl = group.querySelector('.registro-fecha-count');
    if (countEl) {
      countEl.textContent = `(${remaining} registro${remaining !== 1 ? 's' : ''})`;
    }
  }
}

function updateExportarSeleccionadosBtn(tipo) {
  const checkedAll = document.querySelectorAll(`.registro-fecha-checkbox[data-tipo="${tipo}"]:checked`);
  const checkedPendientes = document.querySelectorAll(`.registro-fecha-checkbox-pendientes[data-tipo="${tipo}"]:checked`);
  const visibleExport = checkedAll.length > 0 || checkedPendientes.length > 0;
  const visibleBorrar = checkedAll.length > 0;
  const btnExportar = document.getElementById(`btn-exportar-${tipo}-seleccionados`);
  const btnBorrar = document.getElementById(`btn-borrar-${tipo}-seleccionados`);
  const wrapperExportar = btnExportar?.closest('.exportar-dropdown-wrapper');
  if (wrapperExportar || btnExportar) {
    const el = wrapperExportar || btnExportar;
    if (visibleExport) {
      el.classList.remove('hidden');
      const total = checkedAll.length + checkedPendientes.length;
      if (btnExportar) btnExportar.textContent = `Exportar seleccionados (${total})`;
    } else {
      el.classList.add('hidden');
    }
  }
  if (btnBorrar) {
    if (visibleBorrar) {
      btnBorrar.classList.remove('hidden');
      btnBorrar.textContent = `Borrar seleccionados (${checkedAll.length})`;
    } else {
      btnBorrar.classList.add('hidden');
    }
  }
}

async function exportarRegistrosImagen(titulo, items, tipo = '') {
  if (!items.length) {
    showFeedback('No hay datos para exportar', 'error');
    return;
  }
  if (typeof html2canvas === 'undefined') {
    showFeedback('Librería de captura no cargada', 'error');
    return;
  }
  const isDark = document.body.classList.contains('theme-dark');
  const bg = isDark ? '#1a1d23' : '#fff';
  const text = isDark ? '#e8eaed' : '#1f2933';
  const headerBg = isDark ? '#2d3139' : '#e2e8f0';
  const border = isDark ? '#3d424d' : '#ccc';
  const borderHeader = isDark ? '#3d424d' : '#333';

  const isBilleteros = tipo === 'billeteros';
  const headers = isBilleteros
    ? ['Fecha', 'Bar', 'Billetero Retirado', 'Serie Retirado', 'Billetero Suplente', 'Serie Suplente', 'Recuperado', 'Pendiente', 'Otro Billetero', 'Serie Otro']
    : ['Fecha', 'Código', 'Nombre', 'Alias', 'Cantidad', 'Recuperado', 'Fecha Recup.'];
  const rows = isBilleteros
    ? items.map(i => [
        formatDateDDMMYYYY(i.fecha),
        i.bar || '',
        i.billetero_retirado || '',
        i.serie_retirado || '',
        i.billetero_suplente || '',
        i.serie_suplente || '',
        i.recuperado || '',
        i.pendiente || '',
        i.otro_billetero || '',
        i.serie_otro || ''
      ])
    : items.map(i => [
        formatDateDDMMYYYY(i.fecha),
        i.codigo,
        i.nombre || '',
        i.alias || '',
        i.cantidad,
        i.recuperado || 'Pendiente',
        i.fecharecup ? formatDateDDMMYYYY(i.fecharecup) : ''
      ]);
  const tableHtml = `
    <div class="exportar-imagen-temp" style="position:fixed;left:-9999px;top:0;background:${bg};color:${text};padding:1rem;font-family:sans-serif;font-size:14px;border-collapse:collapse;">
      <h3 style="margin:0 0 1rem;font-size:1.1rem;color:${text};">${escapeHtml(titulo)}</h3>
      <table style="border-collapse:collapse;width:100%;color:${text};">
        <thead>
          <tr>
            ${headers.map(h => `<th style="border:1px solid ${borderHeader};padding:6px 10px;text-align:left;background:${headerBg};color:${text};font-weight:600;">${escapeHtml(h)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              ${r.map(c => `<td style="border:1px solid ${border};padding:6px 10px;color:${text};">${escapeHtml(String(c))}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  const wrap = document.createElement('div');
  wrap.innerHTML = tableHtml;
  const tempEl = wrap.firstElementChild;
  document.body.appendChild(tempEl);

  try {
    const canvas = await html2canvas(tempEl, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: isDark ? '#1a1d23' : '#ffffff'
    });
    document.body.removeChild(tempEl);

    const filename = `${titulo.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`;
    canvas.toBlob(async (blob) => {
      if (!blob) {
        showFeedback('Error al generar imagen', 'error');
        return;
      }
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: titulo,
            files: [file]
          });
          showFeedback('Listo para compartir', 'success');
        } catch (err) {
          if (err.name !== 'AbortError') {
            descargarBlob(blob, filename);
            showFeedback('Imagen descargada (compartir no disponible)', 'success');
          }
        }
      } else {
        descargarBlob(blob, filename);
        showFeedback('Imagen descargada', 'success');
      }
    }, 'image/png', 1);
  } catch (err) {
    document.body.contains(tempEl) && document.body.removeChild(tempEl);
    showFeedback(err?.message || 'Error al generar imagen', 'error');
  }
}

function descargarBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportarRegistrosExcel(titulo, items, tipo = '') {
  if (typeof XLSX === 'undefined') {
    showFeedback('Librería Excel no cargada', 'error');
    return;
  }
  if (!items.length) {
    showFeedback('No hay datos para exportar', 'error');
    return;
  }
  const isUtilizados = tipo === 'utilizados';
  const isBilleteros = tipo === 'billeteros';
  let headers, rows;
  if (isBilleteros) {
    headers = ['Fecha', 'Bar', 'Billetero Retirado', 'Serie Retirado', 'Billetero Suplente', 'Serie Suplente', 'Recuperado', 'Pendiente', 'Otro Billetero', 'Serie Otro'];
    rows = items.map(i => [
      formatDateDDMMYYYY(i.fecha),
      i.bar || '',
      i.billetero_retirado || '',
      i.serie_retirado || '',
      i.billetero_suplente || '',
      i.serie_suplente || '',
      i.recuperado || '',
      i.pendiente || '',
      i.otro_billetero || '',
      i.serie_otro || ''
    ]);
  } else if (isUtilizados) {
    headers = ['Fecha', 'Codigo', 'Nombre', 'Alias', 'Cantidad', 'Recuperado', 'Fecha Recup.'];
    rows = items.map(i => [formatDateDDMMYYYY(i.fecha), i.codigo, i.nombre || '', i.alias || '', i.cantidad, i.recuperado || 'Pendiente', i.fecharecup ? formatDateDDMMYYYY(i.fecharecup) : '']);
  } else {
    headers = ['Fecha', 'Codigo', 'Nombre', 'Alias', 'Cantidad'];
    rows = items.map(i => [formatDateDDMMYYYY(i.fecha), i.codigo, i.nombre || '', i.alias || '', i.cantidad]);
  }
  const data = [[titulo], headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  const filename = `${titulo.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  showFeedback('Exportado correctamente', 'success');
}

function filterUtilizadosPorBusqueda(items, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) return items;
  const term = searchTerm.trim().toLowerCase();
  return items.filter(r => {
    const fechaDDMM = formatDateDDMMYYYY(r.fecha).toLowerCase();
    const fechaYYYY = (r.fecha || '').toLowerCase();
    const nombre = (r.nombre || '').toLowerCase();
    const codigo = (r.codigo || '').toLowerCase();
    return fechaDDMM.includes(term) || fechaYYYY.includes(term) || nombre.includes(term) || codigo.includes(term);
  });
}

function renderUtilizadosView() {
  const searchTerm = document.getElementById('filter-utilizados')?.value?.trim() || '';
  const filtered = filterUtilizadosPorBusqueda(utilizadosData, searchTerm);
  const expandAll = searchTerm.length > 0;
  renderRegistrosPorFecha('utilizados-list', filtered, 'utilizados', 'Recambios Utilizados', expandAll);
  updateExportarSeleccionadosBtn('utilizados');
}

function buildPendientesUrl() {
  const fecha = document.getElementById('pendientes-fecha')?.value?.trim();
  const fechaDesde = document.getElementById('pendientes-fecha-desde')?.value?.trim();
  const fechaHasta = document.getElementById('pendientes-fecha-hasta')?.value?.trim();
  const params = new URLSearchParams();
  params.set('recuperado', 'Pendiente');
  if (fecha) params.set('fecha', fecha);
  if (fechaDesde) params.set('fechaDesde', fechaDesde);
  if (fechaHasta) params.set('fechaHasta', fechaHasta);
  return `/utilizados?${params.toString()}`;
}

function renderPendientesView(items) {
  const container = document.getElementById('pendientes-list');
  if (!container) return;
  const btnExportar = document.getElementById('btn-exportar-pendientes');
  if (items.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay registros pendientes con los filtros seleccionados.</p>';
    if (btnExportar) btnExportar.classList.add('hidden');
    return;
  }
  const headers = ['Fecha', 'Código', 'Nombre', 'Cantidad'];
  const rows = items.map(r => `
    <tr>
      <td>${escapeHtml(formatDateDDMMYYYY(r.fecha))}</td>
      <td>${escapeHtml(r.codigo)}</td>
      <td>${escapeHtml(r.nombre || '')}</td>
      <td>${r.cantidad}</td>
    </tr>
  `).join('');
  container.innerHTML = `
    <div class="table-container registro-table-wrap">
      <table class="data-table registro-table">
        <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  if (btnExportar) {
    btnExportar.classList.remove('hidden');
    btnExportar.textContent = `Exportar (${items.length})`;
  }
}

async function loadPendientesView() {
  const container = document.getElementById('pendientes-list');
  container.innerHTML = '<p class="loading">Cargando...</p>';
  try {
    pendientesData = await api(buildPendientesUrl());
    renderPendientesView(pendientesData);
  } catch (err) {
    container.innerHTML = `<p class="error-msg">${escapeHtml(err.message)}</p>`;
    document.getElementById('btn-exportar-pendientes')?.classList.add('hidden');
  }
}

function buildBilleterosUrl() {
  const fecha = document.getElementById('billeteros-fecha')?.value?.trim();
  const fechaDesde = document.getElementById('billeteros-fecha-desde')?.value?.trim();
  const fechaHasta = document.getElementById('billeteros-fecha-hasta')?.value?.trim();
  const params = new URLSearchParams();
  if (fecha) params.set('fecha', fecha);
  if (fechaDesde) params.set('fechaDesde', fechaDesde);
  if (fechaHasta) params.set('fechaHasta', fechaHasta);
  const qs = params.toString();
  return `/billeteros${qs ? '?' + qs : ''}`;
}

const BILLETERO_RECUPERADO_OPTS = [{ v: '', l: '--' }, { v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }];
const BILLETERO_PENDIENTE_OPTS = [{ v: '', l: '--' }, { v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }];

function renderBilleterosView(items) {
  const container = document.getElementById('billeteros-list');
  if (!container) return;
  const btnExportar = document.getElementById('btn-exportar-billeteros');
  if (items.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay registros con los filtros seleccionados.</p>';
    if (btnExportar) btnExportar.classList.add('hidden');
    return;
  }
  const headers = ['Fecha', 'Bar', 'Billetero Retirado', 'Serie Retirado', 'Billetero Suplente', 'Serie Suplente', 'Recuperado', 'Pendiente', 'Otro Billetero', 'Serie Otro', ''];
  const rows = items.map(b => {
    const selRecup = `<select class="select-billetero" data-id="${b.id}" data-field="recuperado" data-value="${escapeHtml(b.recuperado || '')}">${BILLETERO_RECUPERADO_OPTS.map(o => `<option value="${o.v}" ${(b.recuperado || '') === o.v ? 'selected' : ''}>${escapeHtml(o.l)}</option>`).join('')}</select>`;
    const selPend = `<select class="select-billetero" data-id="${b.id}" data-field="pendiente" data-value="${escapeHtml(b.pendiente || '')}">${BILLETERO_PENDIENTE_OPTS.map(o => `<option value="${o.v}" ${(b.pendiente || '') === o.v ? 'selected' : ''}>${escapeHtml(o.l)}</option>`).join('')}</select>`;
    return `
      <tr class="registro-billetero-row" data-id="${b.id}" tabindex="0" role="button">
        <td>${escapeHtml(formatDateDDMMYYYY(b.fecha))}</td>
        <td>${escapeHtml(b.bar || '')}</td>
        <td>${escapeHtml(b.billetero_retirado || '')}</td>
        <td>${escapeHtml(b.serie_retirado || '')}</td>
        <td>${escapeHtml(b.billetero_suplente || '')}</td>
        <td>${escapeHtml(b.serie_suplente || '')}</td>
        <td class="cell-select">${selRecup}</td>
        <td class="cell-select">${selPend}</td>
        <td>${escapeHtml(b.otro_billetero || '')}</td>
        <td>${escapeHtml(b.serie_otro || '')}</td>
        <td class="cell-actions"><button type="button" class="btn-icon btn-trash" data-id="${b.id}" title="Eliminar">🗑</button></td>
      </tr>
    `;
  }).join('');
  container.innerHTML = `
    <div class="table-container registro-table-wrap">
      <table class="data-table registro-table billeteros-table">
        <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  if (btnExportar) {
    btnExportar.classList.remove('hidden');
    btnExportar.textContent = `Exportar (${items.length})`;
  }
  container.querySelectorAll('.registro-billetero-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.select-billetero') || e.target.closest('.btn-trash')) return;
      const id = parseInt(row.dataset.id);
      const item = billeterosData.find(b => b.id === id);
      if (item) showModalBilleteroDetalle(item);
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!e.target.closest('.select-billetero') && !e.target.closest('.btn-trash')) row.click();
      }
    });
  });

  container.querySelectorAll('.btn-trash').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      if (!confirm('¿Eliminar este registro de billeteros? Esta acción no se puede deshacer.')) return;
      try {
        await api(`/billeteros/${id}`, { method: 'DELETE' });
        billeterosData = billeterosData.filter(b => b.id !== id);
        renderBilleterosView(billeterosData);
        showFeedback('Registro eliminado', 'success');
      } catch (err) {
        showFeedback(err.message || 'Error al eliminar', 'error');
      }
    });
  });

  container.querySelectorAll('.select-billetero').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const target = e.target;
      const id = parseInt(target.dataset.id);
      const field = target.dataset.field;
      const prevValue = target.dataset.value ?? '';
      const value = target.value;
      try {
        await api(`/billeteros/${id}`, { method: 'PATCH', body: JSON.stringify({ [field]: value }) });
        target.dataset.value = value;
        const item = billeterosData.find(b => b.id === id);
        if (item) item[field] = value;
        showFeedback('Actualizado', 'success');
      } catch (err) {
        showFeedback(err.message || 'Error al actualizar', 'error');
        target.value = prevValue;
      }
    });
  });
}

async function loadBilleterosView() {
  const container = document.getElementById('billeteros-list');
  container.innerHTML = '<p class="loading">Cargando...</p>';
  try {
    billeterosData = await api(buildBilleterosUrl());
    renderBilleterosView(billeterosData);
  } catch (err) {
    container.innerHTML = `<p class="error-msg">${escapeHtml(err.message)}</p>`;
    document.getElementById('btn-exportar-billeteros')?.classList.add('hidden');
  }
}

async function submitBilletero(e) {
  e.preventDefault();
  const fecha = document.getElementById('billetero-fecha').value?.trim();
  const bar = document.getElementById('billetero-bar').value?.trim();
  const billetero_retirado = document.getElementById('billetero-retirado').value?.trim();
  const serie_retirado = document.getElementById('billetero-serie-retirado').value?.trim();
  const billetero_suplente = document.getElementById('billetero-suplente').value?.trim();
  const serie_suplente = document.getElementById('billetero-serie-suplente').value?.trim();
  const recuperado = document.getElementById('billetero-recuperado').value;
  const pendiente = document.getElementById('billetero-pendiente').value;
  const otro_billetero = document.getElementById('billetero-otro').value?.trim();
  const serie_otro = document.getElementById('billetero-serie-otro').value?.trim();
  if (!fecha) {
    showFeedback('La fecha es obligatoria', 'error');
    return;
  }
  try {
    await api('/billeteros', {
      method: 'POST',
      body: JSON.stringify({
        fecha,
        bar: bar || null,
        billetero_retirado: billetero_retirado || null,
        serie_retirado: serie_retirado || null,
        billetero_suplente: billetero_suplente || null,
        serie_suplente: serie_suplente || null,
        recuperado: recuperado || null,
        pendiente: pendiente || null,
        otro_billetero: otro_billetero || null,
        serie_otro: serie_otro || null
      })
    });
    showFeedback('Registro guardado', 'success');
    document.getElementById('form-billetero').reset();
    document.getElementById('billetero-fecha').value = new Date().toISOString().slice(0, 10);
    loadBilleterosView();
  } catch (err) {
    showFeedback(err.message || 'Error al guardar', 'error');
  }
}

async function loadUtilizados() {
  const container = document.getElementById('utilizados-list');
  container.innerHTML = '<p class="loading">Cargando...</p>';
  try {
    utilizadosData = await api('/utilizados');
    renderUtilizadosView();
  } catch (err) {
    container.innerHTML = `<p class="error-msg">${escapeHtml(err.message)}</p>`;
  }
}

function exportarUtilizadosSeleccionados() {
  const checked = document.querySelectorAll('.registro-fecha-checkbox[data-tipo="utilizados"]:checked');
  const fechas = new Set(Array.from(checked).map(cb => cb.dataset.fecha));
  if (!fechas.size) return;
  const searchTerm = document.getElementById('filter-utilizados')?.value?.trim() || '';
  const filtered = filterUtilizadosPorBusqueda(utilizadosData, searchTerm);
  const items = filtered.filter(i => fechas.has(i.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.created_at?.localeCompare(b.created_at));
  exportarRegistrosExcel('Recambios Utilizados', items, 'utilizados');
}

async function borrarUtilizadosSeleccionados() {
  const checked = document.querySelectorAll('.registro-fecha-checkbox[data-tipo="utilizados"]:checked');
  const fechas = Array.from(new Set(Array.from(checked).map(cb => cb.dataset.fecha)));
  if (!fechas.length) return;
  if (!confirm(`¿Borrar ${fechas.length} día(s) de recambios utilizados? Esta acción no se puede deshacer.`)) return;
  try {
    await api('/utilizados/batch-delete', { method: 'POST', body: JSON.stringify({ fechas }) });
    showFeedback('Registros borrados correctamente', 'success');
    loadUtilizados();
  } catch (err) {
    showFeedback(err.message || 'Error al borrar', 'error');
  }
}

async function borrarRecuperadosSeleccionados() {
  const checked = document.querySelectorAll('.registro-fecha-checkbox[data-tipo="recuperados"]:checked');
  const fechas = Array.from(new Set(Array.from(checked).map(cb => cb.dataset.fecha)));
  if (!fechas.length) return;
  if (!confirm(`¿Borrar ${fechas.length} día(s) de recambios recuperados? Esta acción no se puede deshacer.`)) return;
  try {
    await api('/recuperados/batch-delete', { method: 'POST', body: { fechas } });
    showFeedback('Registros borrados correctamente', 'success');
    loadRecuperados();
  } catch (err) {
    showFeedback(err.message || 'Error al borrar', 'error');
  }
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
    fabricantesList = await api('/fabricantes');
  } catch {
    fabricantesList = [];
  }

  populateFabricanteSelects();
  loadRecambios();

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      showView(tab.dataset.view);
      if (tab.dataset.view === 'fabricantes') loadFabricantesView();
      if (tab.dataset.view === 'utilizados') loadUtilizados();
      if (tab.dataset.view === 'pendientes') loadPendientesView();
      if (tab.dataset.view === 'billeteros') {
        const fechaInput = document.getElementById('billetero-fecha');
        if (fechaInput && !fechaInput.value) fechaInput.value = new Date().toISOString().slice(0, 10);
        loadBilleterosView();
      }
    });
  });

  const btnExportarSel = document.getElementById('btn-exportar-utilizados-seleccionados');
  if (btnExportarSel) {
    btnExportarSel.addEventListener('click', (e) => {
      e.stopPropagation();
      const getItems = () => {
        const checkedAll = document.querySelectorAll('.registro-fecha-checkbox[data-tipo="utilizados"]:checked');
        const checkedPendientes = document.querySelectorAll('.registro-fecha-checkbox-pendientes[data-tipo="utilizados"]:checked');
        const searchTerm = document.getElementById('filter-utilizados')?.value?.trim() || '';
        const filtered = filterUtilizadosPorBusqueda(utilizadosData, searchTerm);
        const seen = new Set();
        const items = [];
        for (const cb of checkedAll) {
          const fecha = cb.dataset.fecha;
          filtered.filter(i => i.fecha === fecha).forEach(i => {
            if (!seen.has(i.id)) { seen.add(i.id); items.push(i); }
          });
        }
        for (const cb of checkedPendientes) {
          const fecha = cb.dataset.fecha;
          filtered.filter(i => i.fecha === fecha && (i.recuperado || 'Pendiente') === 'Pendiente').forEach(i => {
            if (!seen.has(i.id)) { seen.add(i.id); items.push(i); }
          });
        }
        return items.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.created_at?.localeCompare(b.created_at));
      };
      const items = getItems();
      if (!items.length) return;
      showExportarPortal(
        btnExportarSel,
        () => exportarRegistrosExcel('Recambios Utilizados', items, 'utilizados'),
        () => exportarRegistrosImagen('Recambios Utilizados', items, 'utilizados')
      );
    });
  }
  document.getElementById('btn-borrar-utilizados-seleccionados')?.addEventListener('click', borrarUtilizadosSeleccionados);

  const checkSeleccionarVarios = document.getElementById('check-seleccionar-varios-dias');
  if (checkSeleccionarVarios) {
    checkSeleccionarVarios.addEventListener('change', () => {
      const wraps = document.querySelectorAll('#utilizados-list .registro-fecha-checkbox-wrap');
      wraps.forEach(wrap => wrap.classList.toggle('hidden', !checkSeleccionarVarios.checked));
      if (!checkSeleccionarVarios.checked) {
        document.querySelectorAll('#utilizados-list .registro-fecha-checkbox:checked').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('#utilizados-list .registro-fecha-checkbox-pendientes:checked').forEach(cb => { cb.checked = false; });
        updateExportarSeleccionadosBtn('utilizados');
      }
    });
  }

  const filterUtilizados = document.getElementById('filter-utilizados');
  if (filterUtilizados) {
    let utilizadosSearchDebounce;
    filterUtilizados.addEventListener('input', () => {
      clearTimeout(utilizadosSearchDebounce);
      utilizadosSearchDebounce = setTimeout(renderUtilizadosView, 150);
    });
    filterUtilizados.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        renderUtilizadosView();
      }
    });
  }

  document.getElementById('btn-pendientes-buscar')?.addEventListener('click', loadPendientesView);
  document.getElementById('btn-pendientes-limpiar')?.addEventListener('click', () => {
    document.getElementById('pendientes-fecha').value = '';
    document.getElementById('pendientes-fecha-desde').value = '';
    document.getElementById('pendientes-fecha-hasta').value = '';
    pendientesData = [];
    renderPendientesView([]);
    document.getElementById('btn-exportar-pendientes')?.classList.add('hidden');
  });
  const btnExportarPendientes = document.getElementById('btn-exportar-pendientes');
  if (btnExportarPendientes) {
    btnExportarPendientes.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!pendientesData.length) return;
      showExportarPortal(
        btnExportarPendientes,
        () => exportarRegistrosExcel('Recambios Pendientes', pendientesData, 'utilizados'),
        () => exportarRegistrosImagen('Recambios Pendientes', pendientesData, 'utilizados')
      );
    });
  }

  document.getElementById('form-billetero')?.addEventListener('submit', submitBilletero);
  document.getElementById('btn-billeteros-buscar')?.addEventListener('click', loadBilleterosView);
  document.getElementById('btn-billeteros-limpiar')?.addEventListener('click', () => {
    document.getElementById('billeteros-fecha').value = '';
    document.getElementById('billeteros-fecha-desde').value = '';
    document.getElementById('billeteros-fecha-hasta').value = '';
    billeterosData = [];
    renderBilleterosView([]);
    document.getElementById('btn-exportar-billeteros')?.classList.add('hidden');
  });
  const btnExportarBilleteros = document.getElementById('btn-exportar-billeteros');
  if (btnExportarBilleteros) {
    btnExportarBilleteros.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!billeterosData.length) return;
      showExportarPortal(
        btnExportarBilleteros,
        () => exportarRegistrosExcel('Billeteros', billeterosData, 'billeteros'),
        () => exportarRegistrosImagen('Billeteros', billeterosData, 'billeteros')
      );
    });
  }

  const importFileInput = document.getElementById('import-file');
  const btnSelectFile = document.getElementById('btn-select-file');
  if (btnSelectFile && importFileInput) {
    btnSelectFile.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', handleImportFileSelect);
  }
  document.getElementById('btn-importar')?.addEventListener('click', doImport);
  document.getElementById('btn-import-reset')?.addEventListener('click', resetImport);
  document.querySelectorAll('input[name="import-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const warning = document.getElementById('import-replace-warning');
      if (warning) warning.classList.toggle('hidden', radio.value !== 'replace');
    });
  });

  document.getElementById('btn-add-fabricante')?.addEventListener('click', addFabricante);

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

  document.getElementById('btn-cerrar-modal-notificacion')?.addEventListener('click', closeModalNotificacion);
  document.getElementById('modal-notificacion')?.addEventListener('click', e => {
    if (e.target.id === 'modal-notificacion') closeModalNotificacion();
  });
  document.getElementById('btn-cerrar-modal-utilizado')?.addEventListener('click', closeModalUtilizadoDetalle);
  document.getElementById('modal-utilizado-detalle')?.addEventListener('click', e => {
    if (e.target.id === 'modal-utilizado-detalle') closeModalUtilizadoDetalle();
  });
  document.getElementById('btn-cerrar-modal-billetero')?.addEventListener('click', closeModalBilleteroDetalle);
  document.getElementById('modal-billetero-detalle')?.addEventListener('click', e => {
    if (e.target.id === 'modal-billetero-detalle') closeModalBilleteroDetalle();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const modalNotif = document.getElementById('modal-notificacion');
      const modalUtil = document.getElementById('modal-utilizado-detalle');
      const modalBilletero = document.getElementById('modal-billetero-detalle');
      if (modalBilletero && !modalBilletero.classList.contains('hidden')) closeModalBilleteroDetalle();
      else if (modalUtil && !modalUtil.classList.contains('hidden')) closeModalUtilizadoDetalle();
      else if (modalNotif && !modalNotif.classList.contains('hidden')) closeModalNotificacion();
    }
  });

  document.getElementById('btn-editar-desde-detalle').addEventListener('click', () => {
    const id = document.getElementById('btn-editar-desde-detalle').dataset.id;
    if (id) {
      showDetallePanel(false);
      openEditar(parseInt(id));
    }
  });

  document.getElementById('btn-eliminar-desde-detalle').addEventListener('click', eliminarRecambioDesdeDetalle);
  document.getElementById('btn-check-utilizado').addEventListener('click', registrarUtilizado);

  document.getElementById('btn-eliminar-seleccionados')?.addEventListener('click', eliminarSeleccionados);

  const btnCancelarEditar = document.getElementById('btn-cancelar-editar');
  if (btnCancelarEditar) {
    btnCancelarEditar.addEventListener('click', () => showEditarPanel(false));
  }

  document.getElementById('editar-cantidad').addEventListener('change', e => {
    updateStockBajoBadge(parseInt(e.target.value) || 0);
  });

  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const btnBurger = document.getElementById('btn-menu-toggle');
  function setSidebarOpen(open) {
    if (!sidebar) return;
    if (open) {
      sidebar.classList.add('sidebar-open');
      if (sidebarBackdrop) sidebarBackdrop.classList.remove('hidden');
    } else {
      sidebar.classList.remove('sidebar-open');
      if (sidebarBackdrop) sidebarBackdrop.classList.add('hidden');
    }
  }
  if (btnBurger && sidebar) {
    btnBurger.addEventListener('click', () => setSidebarOpen(true));
  }
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => setSidebarOpen(false));
  }
  document.querySelectorAll('.sidebar-nav .tab').forEach(btn => {
    btn.addEventListener('click', () => setSidebarOpen(false));
  });

  document.getElementById('btn-instalar-app')?.addEventListener('click', handleInstalarApp);
}

initTheme();
initVersion();
initPWA();
initBackButtonBehavior();
init();
