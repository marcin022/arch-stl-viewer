const $ = id => document.getElementById(id);
function savedLayout() { try { return localStorage.getItem('stl-viewer-layout'); } catch { return null; } }
const state = { root: null, selected: null, mesh: null, yaw: -.65, pitch: .5, zoom: 1, dragging: false,
  layout: savedLayout() === 'grid' ? 'grid' : 'list', gridPath: null };
let toastTimer;
const thumbnailCache = new Map();
let gridGeneration = 0, thumbnailQueue = [], activeThumbnails = 0, thumbnailObserver;
let clipboardItem = null, contextTarget = null, renameTarget = null;

async function api(url, body) {
  const options = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Stl-Viewer': '1', 'X-Stl-Language': language }, body: JSON.stringify(body) };
  const response = await fetch(url, options);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw Error(localizeServerError(result.error) || t('httpError', { status: response.status }));
  }
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : response.arrayBuffer();
}
function notify(message, error = false) {
  const box = $('toast'); box.textContent = message; box.classList.toggle('error', error); box.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.add('hidden'), 4500);
}
async function run(task) { try { await task(); } catch (e) { notify(e.message, true); } }
function clearModel() {
  viewer.clear();
  state.selected = state.mesh = null;
  state.selectedRow = state.selectedItem = null;
  $('modelName').textContent = t('chooseModel'); $('modelPath').textContent = '';
  $('emptyState').classList.remove('hidden');
  for (const id of ['fileActions', 'viewControls', 'viewHint', 'modelFooter']) $(id).classList.add('hidden');
  render();
}

async function loadState() {
  const data = await api('/api/state');
  if (data.language !== language) { setLanguage(data.language); refreshLanguage(); }
  if (state.root && state.root !== data.root) clipboardItem = null;
  state.root = data.root;
  state.gridPath = data.root;
  $('libraryName').textContent = data.root ? data.root.split(/[\\/]/).filter(Boolean).at(-1) || '/' : t('noLibrary');
  $('fileCount').textContent = data.root || t('chooseFolderHint');
  setSlicers(data.slicers);
  await refresh();
}
function setSlicers(slicers) {
  const select = $('slicerSelect');
  const selected = select.value;
  select.replaceChildren(new Option(t('chooseSlicer'), ''));
  for (const slicer of slicers) select.add(new Option(slicer.name, slicer.id));
  if ([...select.options].some(o => o.value === selected)) select.value = selected;
}
async function refresh() {
  hideContextMenu();
  if (state.layout === 'grid') return renderGrid();
  $('tree').replaceChildren();
  if (state.root) await fillFolder(state.root, $('tree'));
}
async function fillFolder(path, container) {
  const items = await api('/api/list?path=' + encodeURIComponent(path));
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'tree-row'; empty.textContent = t('noFiles');
    container.append(empty);
  }
  for (const item of items) {
    const row = document.createElement('button');
    row.className = 'tree-row model-entry ' + (item.folder ? 'folder' : 'file') + (item.path === state.selected ? ' active' : '') + (clipboardItem?.move && clipboardItem.path === item.path ? ' cut-pending' : '');
    const chev = document.createElement('span'); chev.className = 'chevron'; chev.textContent = item.folder ? '▸' : '';
    const icon = document.createElement('span'); icon.className = 'icon'; icon.textContent = item.folder ? '▣' : '◇';
    const label = document.createElement('span'); label.className = 'label'; label.textContent = item.name;
    row.append(chev, icon, label); row.title = item.path; row.entryData = item;
    row.addEventListener('contextmenu', event => showContextMenu(event, item, row));
    container.append(row);
    if (item.folder) {
      const children = document.createElement('div'); children.className = 'tree-children hidden';
      children.dataset.folderPath = item.path; container.append(children);
      row.onclick = () => run(async () => {
        const opening = children.classList.contains('hidden');
        children.classList.toggle('hidden'); chev.textContent = opening ? '▾' : '▸';
        if (opening && !children.dataset.loaded) { await fillFolder(item.path, children); children.dataset.loaded = '1'; }
      });
    } else {
      row.onclick = () => run(() => chooseModel(item, row));
    }
  }
}

function setLayout(layout, reload = true) {
  state.layout = layout;
  try { localStorage.setItem('stl-viewer-layout', layout); } catch { }
  $('listView').setAttribute('aria-pressed', String(layout === 'list'));
  $('gridView').setAttribute('aria-pressed', String(layout === 'grid'));
  $('tree').classList.toggle('hidden', layout !== 'list');
  $('grid').classList.toggle('hidden', layout !== 'grid');
  $('gridNavigation').classList.toggle('hidden', layout !== 'grid');
  document.querySelector('.sidebar').classList.toggle('grid-mode', layout === 'grid');
  if (layout !== 'grid') { gridGeneration++; thumbnailObserver?.disconnect(); thumbnailQueue = []; }
  if (reload) run(refresh);
}

function enqueueThumbnail(task) {
  thumbnailQueue.push(task);
  pumpThumbnails();
}
function pumpThumbnails() {
  while (activeThumbnails < 2 && thumbnailQueue.length) {
    const task = thumbnailQueue.shift();
    activeThumbnails++;
    Promise.resolve().then(task).catch(() => {}).finally(() => {
      activeThumbnails--;
      setTimeout(pumpThumbnails, 0);
    });
  }
}
async function thumbnailFor(path) {
  if (thumbnailCache.has(path)) return thumbnailCache.get(path);
  const pending = (async () => stlThumbnail(await api('/api/model?path=' + encodeURIComponent(path))))();
  thumbnailCache.set(path, pending);
  if (thumbnailCache.size > 80) thumbnailCache.delete(thumbnailCache.keys().next().value);
  try { return await pending; }
  catch (error) { thumbnailCache.delete(path); throw error; }
}
async function fillGridPreview(item, preview, generation) {
  if (item.folder) {
    const samples = await api('/api/folder-samples?path=' + encodeURIComponent(item.path));
    if (generation !== gridGeneration || !preview.isConnected) return;
    for (let i = 0; i < samples.length && i < 4; i++) {
      let src;
      try { src = await thumbnailFor(samples[i]); } catch { continue; }
      if (generation !== gridGeneration || !preview.isConnected) return;
      const img = document.createElement('img'); img.src = src; img.alt = '';
      preview.children[i].replaceChildren(img);
    }
  } else {
    const src = await thumbnailFor(item.path);
    if (generation !== gridGeneration || !preview.isConnected) return;
    const img = document.createElement('img'); img.src = src; img.alt = '';
    preview.replaceChildren(img);
  }
}
async function renderGrid() {
  const generation = ++gridGeneration;
  thumbnailObserver?.disconnect(); thumbnailQueue = [];
  const grid = $('grid'); grid.replaceChildren();
  if (!state.root) { $('gridLocation').textContent = t('chooseLibrary'); return; }
  const path = state.gridPath || state.root;
  $('gridLocation').textContent = path === state.root ? t('allModels') : path.split(/[\\/]/).filter(Boolean).at(-1);
  $('gridLocation').title = path;
  $('gridBack').disabled = path === state.root;
  const items = await api('/api/list?path=' + encodeURIComponent(path));
  if (generation !== gridGeneration || state.layout !== 'grid') return;
  if (!items.length) {
    const empty = document.createElement('div'); empty.className = 'grid-empty';
    empty.textContent = t('emptyGrid'); grid.append(empty);
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const { item, preview } = entry.target.gridData;
      enqueueThumbnail(() => fillGridPreview(item, preview, generation));
    }
  }, { root: grid, rootMargin: '160px' });
  thumbnailObserver = observer;
  for (const item of items) {
    const card = document.createElement('button');
    card.className = 'grid-card model-entry ' + (item.folder ? 'folder' : 'file') + (item.path === state.selected ? ' active' : '') + (clipboardItem?.move && clipboardItem.path === item.path ? ' cut-pending' : '');
    card.title = item.path; card.entryData = item;
    card.addEventListener('contextmenu', event => showContextMenu(event, item, card));
    const preview = document.createElement('div');
    preview.className = 'grid-preview loading';
    if (item.folder) {
      for (let i = 0; i < 4; i++) {
        const cell = document.createElement('span'); cell.className = 'folder-cell'; cell.textContent = '◇';
        preview.append(cell);
      }
      card.onclick = () => run(async () => { state.gridPath = item.path; await renderGrid(); });
    } else {
      preview.textContent = '◇';
      card.onclick = () => run(() => chooseModel(item, card));
    }
    const label = document.createElement('span'); label.className = 'label'; label.textContent = item.name;
    card.append(preview, label); grid.append(card);
    card.gridData = { item, preview };
    observer.observe(card);
  }
}

$('listView').onclick = () => setLayout('list');
$('gridView').onclick = () => setLayout('grid');
$('gridBack').onclick = () => run(async () => {
  if (!state.root || state.gridPath === state.root) return;
  state.gridPath = state.gridPath.slice(0, state.gridPath.lastIndexOf(state.gridPath.includes('\\') ? '\\' : '/')) || state.root;
  if (!state.gridPath.startsWith(state.root)) state.gridPath = state.root;
  await renderGrid();
});
function parentFolder(path) {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return path.slice(0, slash) || state.root;
}
function withinPath(parent, path) {
  return path === parent || path.startsWith(parent + (parent.includes('\\') ? '\\' : '/'));
}
function replacePath(oldPath, oldParent, newParent) {
  return withinPath(oldParent, oldPath) ? newParent + oldPath.slice(oldParent.length) : oldPath;
}
function hideContextMenu() { $('contextMenu').classList.add('hidden'); }
function showContextMenu(event, item = null, row = null, destination = null) {
  event.preventDefault(); event.stopPropagation();
  contextTarget = { item, row, destination };
  const menu = $('contextMenu');
  for (const action of ['rename', 'copy', 'cut', 'delete'])
    menu.querySelector(`[data-action="${action}"]`).disabled = !item;
  menu.querySelector('[data-action="paste"]').disabled = !clipboardItem || !state.root;
  menu.classList.remove('hidden');
  menu.style.left = Math.max(6, Math.min(event.clientX, innerWidth - menu.offsetWidth - 6)) + 'px';
  menu.style.top = Math.max(6, Math.min(event.clientY, innerHeight - menu.offsetHeight - 6)) + 'px';
}
function setClipboard(item, move) {
  clipboardItem = { path: item.path, name: item.name, folder: item.folder, move };
  document.querySelectorAll('.model-entry.cut-pending').forEach(row => row.classList.remove('cut-pending'));
  if (move) document.querySelectorAll('.model-entry').forEach(row => {
    if (row.title === item.path) row.classList.add('cut-pending');
  });
  notify(t('clipboardHint', { action: t(move ? 'cutDone' : 'copied'), name: item.name }));
}
function pasteDestination(item, destination) {
  if (item?.folder) return item.path;
  if (item) return parentFolder(item.path);
  return destination || (state.layout === 'grid' ? state.gridPath : state.root);
}
async function pasteEntry(destination) {
  if (!clipboardItem) return;
  const source = clipboardItem;
  const result = await api('/api/paste', { path: source.path, destination, move: source.move });
  if (source.move) {
    clipboardItem = null;
    if (result.path !== source.path && state.selected && withinPath(source.path, state.selected)) clearModel();
    if (source.folder && state.gridPath && withinPath(source.path, state.gridPath))
      state.gridPath = replacePath(state.gridPath, source.path, result.path);
  }
  await refresh();
  notify(t('pastedTo', { action: t(source.move ? 'moved' : 'copied'), path: result.path }));
}
function startRename(item, row) {
  if (!item) return;
  renameTarget = { item, row };
  $('renameTitle').textContent = t(item.folder ? 'renameFolder' : 'renameModel');
  $('renameHint').textContent = t(item.folder ? 'renameFolderHint' : 'renameHint');
  $('renameSuffix').classList.toggle('hidden', item.folder);
  $('newFileName').value = item.folder ? item.name : item.name.replace(/\.stl$/i, '');
  $('renameDialog').showModal();
  $('newFileName').focus(); $('newFileName').select();
}
async function trashEntry(item) {
  if (!item || !confirm(t('confirmTrash', { type: t(item.folder ? 'folder' : 'model'), name: item.name }))) return;
  const view = state.layout === 'grid' ? $('grid') : $('tree');
  const scrollTop = view.scrollTop;
  const rows = [...view.querySelectorAll('.model-entry')].filter(row =>
    state.layout === 'grid' || !row.closest('.tree-children.hidden'));
  const deletedIndex = rows.findIndex(row => row.entryData.path === item.path);
  const candidateRows = deletedIndex < 0 ? [] : [
    ...rows.slice(deletedIndex + 1), ...rows.slice(0, deletedIndex).reverse()
  ].filter(row => !row.entryData.folder && !withinPath(item.path, row.entryData.path));
  const selectionDeleted = !!state.selected && withinPath(item.path, state.selected);
  await api('/api/trash', { path: item.path });
  if (clipboardItem && withinPath(item.path, clipboardItem.path)) clipboardItem = null;
  for (const path of thumbnailCache.keys())
    if (withinPath(item.path, path)) thumbnailCache.delete(path);
  for (const row of [...view.querySelectorAll('.model-entry')]) {
    if (!withinPath(item.path, row.entryData.path)) continue;
    if (row.classList.contains('folder') && row.nextElementSibling?.classList.contains('tree-children'))
      row.nextElementSibling.remove();
    row.remove();
  }
  if (state.gridPath && withinPath(item.path, state.gridPath)) {
    state.gridPath = parentFolder(item.path);
    if (state.layout === 'grid') await renderGrid();
  } else if (state.layout === 'grid' && !view.querySelector('.model-entry')) {
    const empty = document.createElement('div'); empty.className = 'grid-empty';
    empty.textContent = t('emptyGrid'); view.append(empty);
  }
  view.scrollTop = scrollTop;
  if (selectionDeleted) {
    const next = candidateRows.find(row => row.isConnected);
    if (next) await chooseModel(next.entryData, next);
    else {
      // The selected model can be outside the currently displayed folder.
      const siblings = await api('/api/list?path=' + encodeURIComponent(parentFolder(item.path)));
      const files = siblings.filter(entry => !entry.folder);
      const index = files.findIndex(entry => entry.name.localeCompare(item.name, undefined, { sensitivity: 'base' }) > 0);
      const fallback = item.folder ? files[0] : files[index < 0 ? files.length - 1 : index];
      const fallbackRow = fallback && [...view.querySelectorAll('.model-entry')]
        .find(row => row.entryData.path === fallback.path);
      if (fallback) await chooseModel(fallback, fallbackRow || null);
      else clearModel();
    }
  }
  view.scrollTop = scrollTop;
  notify(t('movedToTrash'));
}
$('tree').addEventListener('contextmenu', event => {
  if (!event.target.closest('.model-entry'))
    showContextMenu(event, null, null, event.target.closest('.tree-children')?.dataset.folderPath || state.root);
});
$('grid').addEventListener('contextmenu', event => {
  if (!event.target.closest('.model-entry')) showContextMenu(event, null, null, state.gridPath);
});
$('contextMenu').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  event.stopPropagation();
  const action = button.dataset.action, target = contextTarget;
  hideContextMenu();
  run(async () => {
    if (action === 'rename') startRename(target.item, target.row);
    else if (action === 'copy') setClipboard(target.item, false);
    else if (action === 'cut') setClipboard(target.item, true);
    else if (action === 'paste') await pasteEntry(pasteDestination(target.item, target.destination));
    else if (action === 'delete') await trashEntry(target.item);
  });
});
document.addEventListener('click', event => { if (!$('contextMenu').contains(event.target)) hideContextMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') hideContextMenu(); });
document.querySelector('.sidebar').addEventListener('scroll', hideContextMenu, true);
async function chooseModel(item, row) {
  $('modelName').textContent = t('loadingModel');
  await new Promise(resolve => requestAnimationFrame(resolve));
  let mesh;
  try {
    const data = await api('/api/model?path=' + encodeURIComponent(item.path));
    mesh = viewer.load(data);
  } catch (error) {
    clearModel();
    throw error;
  }
  state.selected = item.path; state.mesh = mesh; state.yaw = -.65; state.pitch = .5; state.zoom = 1;
  state.selectedRow = row; state.selectedItem = item;
  document.querySelectorAll('.model-entry.active').forEach(x => x.classList.remove('active'));
  row?.classList.add('active');
  $('modelName').textContent = item.name;
  $('modelPath').textContent = item.path;
  $('dimensions').textContent = mesh.size.map(n => formatNumber(n)).join(' × ') + ' mm';
  $('triangles').textContent = mesh.count.toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US');
  $('format').textContent = t(mesh.format);
  for (const id of ['fileActions', 'viewControls', 'viewHint', 'modelFooter']) $(id).classList.remove('hidden');
  $('emptyState').classList.add('hidden');
  render();
}
function formatNumber(n) { return Number(n.toFixed(2)).toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US'); }

const canvas = $('viewer'), viewer = new StlPreview(canvas);
function render() { viewer.render(state); } 
let lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', e => { if (!state.mesh) return; state.dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!state.dragging) return;
  state.yaw += (e.clientX - lastX) * .008;
  state.pitch = Math.max(-1.55, Math.min(1.55, state.pitch + (e.clientY - lastY) * .008));
  lastX = e.clientX; lastY = e.clientY; render();
});
canvas.addEventListener('pointerup', () => state.dragging = false);
canvas.addEventListener('wheel', e => { if (!state.mesh) return; e.preventDefault(); state.zoom = Math.max(.2, Math.min(8, state.zoom * (e.deltaY > 0 ? .9 : 1.1))); render(); }, { passive: false });
new ResizeObserver(() => render()).observe(canvas);
$('resetView').onclick = () => { state.yaw = -.65; state.pitch = .5; state.zoom = 1; render(); };
$('zoomIn').onclick = () => { state.zoom = Math.min(8, state.zoom * 1.25); render(); };
$('zoomOut').onclick = () => { state.zoom = Math.max(.2, state.zoom / 1.25); render(); };

async function chooseLibrary() {
  try {
    const result = await api('/api/choose-library', {});
    if (result) { clearModel(); await loadState(); return; }
  } catch (e) { notify(t('folderPickerUnavailable'), true); }
  $('libraryPath').value = state.root || '';
  $('pathDialog').showModal();
}
$('chooseLibrary').onclick = chooseLibrary; $('emptyChoose').onclick = chooseLibrary;
$('pathDialog').addEventListener('close', () => run(async () => {
  if ($('pathDialog').returnValue !== 'save') return;
  await api('/api/library', { path: $('libraryPath').value });
  clearModel(); await loadState();
}));
$('refresh').onclick = () => run(refresh);
$('renameButton').onclick = () => startRename(state.selectedItem, state.selectedRow);
$('renameDialog').addEventListener('close', () => run(async () => {
  const target = renameTarget; renameTarget = null;
  if ($('renameDialog').returnValue !== 'save' || !target) return;
  const oldPath = target.item.path;
  const result = await api('/api/rename', { path: oldPath, newName: $('newFileName').value });
  const newName = result.path.split(/[\\/]/).at(-1);
  if (clipboardItem && withinPath(oldPath, clipboardItem.path)) {
    if (clipboardItem.path === oldPath) clipboardItem.name = newName;
    clipboardItem.path = replacePath(clipboardItem.path, oldPath, result.path);
  }
  if (state.gridPath && withinPath(oldPath, state.gridPath))
    state.gridPath = replacePath(state.gridPath, oldPath, result.path);
  if (state.selected && withinPath(oldPath, state.selected)) {
    state.selected = replacePath(state.selected, oldPath, result.path);
    if (state.selectedItem) {
      state.selectedItem.path = state.selected;
      if (!target.item.folder) state.selectedItem.name = newName;
    }
    $('modelName').textContent = state.selectedItem?.name || newName;
    $('modelPath').textContent = state.selected;
  }
  await refresh();
  notify(t('renamed', { type: t(target.item.folder ? 'folderType' : 'modelType') }));
}));
$('copyButton').onclick = () => run(async () => {
  if (!state.selected) return;
  let result;
  try { result = await api('/api/copy', { path: state.selected }); }
  catch {
    const destination = prompt(t('copyDestination'));
    if (!destination) return;
    result = await api('/api/copy', { path: state.selected, destination });
  }
  if (result) notify(t('copiedTo', { path: result.path }));
});
$('trashButton').onclick = () => run(() => trashEntry(state.selectedItem));
$('addSlicer').onclick = () => { $('slicerPath').value = ''; $('slicerDialog').showModal(); };
$('slicerDialog').addEventListener('close', () => run(async () => {
  if ($('slicerDialog').returnValue !== 'save') return;
  setSlicers(await api('/api/custom-slicer', { path: $('slicerPath').value }));
  notify(t('slicerAdded'));
}));
$('openSlicer').onclick = () => run(async () => {
  if (!state.selected) return;
  if (!$('slicerSelect').value) throw Error(t('chooseSlicerError'));
  await api('/api/slicer', { path: state.selected, slicerId: $('slicerSelect').value });
  notify(t('slicerStarted'));
});
function refreshLanguage() {
  applyLanguage();
  if (!state.root) {
    $('libraryName').textContent = t('noLibrary');
    $('fileCount').textContent = t('chooseFolderHint');
  }
  if (!state.selected) $('modelName').textContent = t('chooseModel');
  if (state.mesh) {
    $('dimensions').textContent = state.mesh.size.map(n => formatNumber(n)).join(' × ') + ' mm';
    $('triangles').textContent = state.mesh.count.toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US');
    $('format').textContent = t(state.mesh.format);
  }
  if (!$('renameDialog').open) {
    $('renameTitle').textContent = t('renameModel');
    $('renameHint').textContent = t('renameHint');
  } else if (renameTarget) {
    $('renameTitle').textContent = t(renameTarget.item.folder ? 'renameFolder' : 'renameModel');
    $('renameHint').textContent = t(renameTarget.item.folder ? 'renameFolderHint' : 'renameHint');
  }
  const selectedSlicer = $('slicerSelect').value;
  $('slicerSelect').options[0].textContent = t('chooseSlicer');
  $('slicerSelect').value = selectedSlicer;
  for (const row of $('tree').querySelectorAll('.tree-row:not(.model-entry)')) row.textContent = t('noFiles');
  for (const row of $('grid').querySelectorAll('.grid-empty')) row.textContent = t('emptyGrid');
  if (state.layout === 'grid') $('gridLocation').textContent = !state.root ? t('chooseLibrary') :
    state.gridPath === state.root ? t('allModels') : state.gridPath?.split(/[\\/]/).filter(Boolean).at(-1) || '';
}
$('languageButton').onclick = () => run(async () => {
  const next = language === 'en' ? 'pl' : 'en';
  await api('/api/language', { language: next });
  setLanguage(next);
  refreshLanguage();
});
refreshLanguage();
setLayout(state.layout, false);
run(loadState);
