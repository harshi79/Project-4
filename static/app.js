const tg = window.Telegram.WebApp;
tg.expand(); tg.ready();

let jwtToken = null, currentFolderId = null, passcodeBuffer = "";
let selectMode = false, selectedFiles = new Set(), selectedFolders = new Set();
let rawFolders = [], rawFiles = [];
const API_BASE = '/api';

async function init() {
    try {
        const res = await fetch(`${API_BASE}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) });
        const data = await res.json();
        jwtToken = data.token;
        document.getElementById('loading-screen').classList.add('hidden');
        if (data.has_passcode) showLockScreen();
        else { document.getElementById('app').classList.remove('hidden'); await updateStorage(); loadFolder(null); }
    } catch (e) { tg.showAlert("Auth error."); }
}

function showLockScreen() {
    document.getElementById('lock-screen').classList.remove('hidden');
    const numpad = document.getElementById('numpad');
    numpad.innerHTML = '';
    [1,2,3,4,5,6,7,8,9,'',0,'⌫'].forEach(num => {
        const btn = document.createElement('div');
        if (num === '') { numpad.appendChild(btn); return; }
        btn.className = 'w-16 h-16 rounded-full flex items-center justify-center bg-[var(--tg-theme-secondary-bg-color)] active:bg-[var(--tg-theme-hint-color)] mx-auto cursor-pointer';
        btn.innerText = num; btn.onclick = () => handleNumpad(num); numpad.appendChild(btn);
    });
}
async function handleNumpad(val) {
    if (val === '⌫') passcodeBuffer = passcodeBuffer.slice(0, -1);
    else if (passcodeBuffer.length < 4) passcodeBuffer += val;
    updatePasscodeUI();
    if (passcodeBuffer.length === 4) {
        try {
            const res = await fetch(`${API_BASE}/lock/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, body: JSON.stringify({ passcode: passcodeBuffer }) });
            if (res.ok) {
                const data = await res.json(); jwtToken = data.token;
                document.getElementById('lock-screen').classList.add('hidden');
                document.getElementById('app').classList.remove('hidden');
                await updateStorage(); loadFolder(null);
            } else { tg.HapticFeedback.notificationOccurred('error'); passcodeBuffer = ""; updatePasscodeUI(); }
        } catch(e) { passcodeBuffer = ""; updatePasscodeUI(); }
    }
}
function updatePasscodeUI() {
    const dots = document.getElementById('passcode-dots').children;
    for (let i = 0; i < 4; i++) {
        if (i < passcodeBuffer.length) dots[i].classList.add('bg-[var(--tg-theme-button-color)]', 'opacity-100');
        else dots[i].classList.remove('bg-[var(--tg-theme-button-color)]', 'opacity-100');
    }
}

async function api(path, options = {}) {
    options.headers = { ...options.headers, 'Authorization': `Bearer ${jwtToken}` };
    const res = await fetch(`${API_BASE}${path}`, options);
    if (!res.ok) throw new Error(); return res.json();
}

function formatBytes(bytes) {
    if(bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'], i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
function getIconForMime(mime) {
    if(mime.startsWith('image/')) return 'ph-image';
    if(mime.startsWith('video/')) return 'ph-video-camera';
    if(mime.startsWith('audio/')) return 'ph-music-notes';
    return 'ph-file';
}

async function updateStorage() {
    const data = await api('/user');
    const pct = Math.min((data.storage_used / data.storage_limit) * 100, 100);
    document.getElementById('storage-bar').style.width = `${pct}%`;
    document.getElementById('storage-text').innerText = `${formatBytes(data.storage_used)} / ${formatBytes(data.storage_limit)}`;
}
document.getElementById('btn-store').onclick = () => document.getElementById('store-modal').classList.remove('hidden');

async function loadFolder(folderId) {
    currentFolderId = folderId;
    document.getElementById('vault-content').innerHTML = `<div class="flex justify-center items-center h-40"><i class="ph ph-spinner animate-spin text-4xl text-[var(--tg-theme-button-color)]"></i></div>`;
    const data = await api(`/vault${folderId ? '?folder_id='+folderId : ''}`);
    rawFolders = data.folders; rawFiles = data.files;
    
    const bc = document.getElementById('breadcrumbs');
    bc.innerHTML = `<div class="cursor-pointer font-bold ${data.breadcrumbs.length===0?'text-[var(--tg-theme-text-color)]':'text-[var(--tg-theme-button-color)]'}" onclick="loadFolder(null)"><i class="ph ph-house text-lg"></i> Root</div>`;
    data.breadcrumbs.forEach((b, i) => {
        bc.innerHTML += `<i class="ph ph-caret-right text-[var(--tg-theme-hint-color)] mx-1"></i>`;
        bc.innerHTML += `<div class="cursor-pointer ${i===data.breadcrumbs.length-1?'text-[var(--tg-theme-text-color)] font-bold':'text-[var(--tg-theme-button-color)]'}" onclick="loadFolder('${b.id}')">${b.name}</div>`;
    });
    renderContent();
}

function renderContent() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const sortMode = document.getElementById('sort-select').value;
    let fld = rawFolders.filter(f => f.name.toLowerCase().includes(query));
    let fil = rawFiles.filter(f => f.name.toLowerCase().includes(query));
    
    const sorter = (a, b) => {
        if(sortMode === 'name') return a.name.localeCompare(b.name);
        if(sortMode === 'size') return (b.size || 0) - (a.size || 0);
        return new Date(b.created_at) - new Date(a.created_at);
    };
    fld.sort(sorter); fil.sort(sorter);

    const container = document.getElementById('vault-content');
    container.innerHTML = `<div class="grid grid-cols-2 gap-4"></div>`;
    const grid = container.firstChild;

    fld.forEach(f => {
        const el = document.createElement('div');
        el.className = 'bg-[var(--tg-theme-bg-color)] rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer shadow-sm relative text-center transition-all duration-200';
        el.innerHTML = `<div class="checkbox-indicator absolute top-2 right-2 pointer-events-none"></div><i class="ph ph-folder-fill text-5xl text-[var(--tg-theme-button-color)] mb-2"></i><span class="text-xs font-medium line-clamp-2 pointer-events-none">${f.name}</span>`;
        el.onclick = () => selectMode ? toggleSelection('folder', f.id, el) : loadFolder(f.id);
        bindContextMenu(el, 'folder', f.id, f.name);
        grid.appendChild(el);
    });

    fil.forEach(f => {
        const el = document.createElement('div');
        el.className = 'bg-[var(--tg-theme-bg-color)] rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer shadow-sm relative text-center transition-all duration-200';
        el.innerHTML = `<div class="checkbox-indicator absolute top-2 right-2 pointer-events-none"></div><i class="ph ${getIconForMime(f.mime_type)} text-5xl text-gray-400 mb-2 pointer-events-none"></i><span class="text-xs font-medium line-clamp-2 pointer-events-none">${f.name}</span><span class="text-[10px] text-[var(--tg-theme-hint-color)] mt-1 pointer-events-none">${formatBytes(f.size)}</span>`;
        el.onclick = () => {
            if(selectMode) return toggleSelection('file', f.id, el);
            if(f.mime_type.startsWith('image/')) {
                document.getElementById('iv-img').src = `${window.location.origin}${API_BASE}/files/download/${f.id}?token=${jwtToken}`;
                document.getElementById('iv-name').innerText = f.name; 
                document.getElementById('iv-export').onclick = () => exportItems([f.id], []); 
                document.getElementById('image-viewer').classList.remove('hidden');
            } else if(f.mime_type.startsWith('audio/')) {
                const au = document.getElementById('ap-audio'); au.src = `${window.location.origin}${API_BASE}/files/download/${f.id}?token=${jwtToken}`; au.play(); 
                document.getElementById('ap-name').innerText = f.name; document.getElementById('audio-player').classList.remove('hidden');
            } else exportItems([f.id], []);
        };
        bindContextMenu(el, 'file', f.id, f.name);
        grid.appendChild(el);
    });
}

document.getElementById('search-input').onkeyup = renderContent;
document.getElementById('sort-select').onchange = renderContent;
function closeViewer() { document.getElementById('image-viewer').classList.add('hidden'); document.getElementById('iv-img').src = ''; }
function closeAudio() { document.getElementById('audio-player').classList.add('hidden'); document.getElementById('ap-audio').pause(); }

let longPressTimer;
function bindContextMenu(el, type, id, name) {
    const bind = (e) => {
        e.preventDefault(); tg.HapticFeedback.impactOccurred('medium');
        const menu = document.getElementById('context-menu');
        menu.style.left = `${Math.min(e.pageX||e.touches[0].pageX, window.innerWidth-170)}px`;
        menu.style.top = `${Math.min(e.pageY||e.touches[0].pageY, window.innerHeight-150)}px`;
        menu.classList.remove('hidden');
        document.getElementById('ctx-export').onclick = () => { menu.classList.add('hidden'); exportItems(type==='file'?[id]:[], type==='folder'?[id]:[]); };
        document.getElementById('ctx-delete').onclick = async () => { menu.classList.add('hidden'); tg.showConfirm("Delete?", async(ok)=>{ if(ok){ await api(type==='folder'?`/folders/${id}`:`/files/${id}`,{method:'DELETE'}); updateStorage(); loadFolder(currentFolderId); } }); };
        document.getElementById('ctx-rename').onclick = () => { menu.classList.add('hidden'); const nn = prompt("New name:", name); if(nn) api(`/rename/${type}/${id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:nn})}).then(()=>loadFolder(currentFolderId)); };
    };
    el.oncontextmenu = bind;
    el.addEventListener('touchstart', (e) => { if(!selectMode) longPressTimer = setTimeout(()=>{ bind(e); toggleSelection(type,id,el); }, 500); });
    el.addEventListener('touchend', () => clearTimeout(longPressTimer));
    el.addEventListener('touchmove', () => clearTimeout(longPressTimer));
}
document.addEventListener('click', (e) => { if(!e.target.closest('#context-menu')) document.getElementById('context-menu').classList.add('hidden'); });

function toggleSelection(type, id, el) {
    if (!selectMode) { 
        selectMode = true; 
        document.getElementById('main-header').classList.add('hidden');
        document.getElementById('select-header').classList.remove('hidden');
        document.getElementById('selection-bar').classList.remove('hidden');
        setTimeout(() => document.getElementById('selection-bar').classList.remove('translate-y-full'), 10);
        document.getElementById('fab-container').classList.add('translate-y-40'); 
    }
    const set = type === 'folder' ? selectedFolders : selectedFiles;
    if (set.has(id)) { 
        set.delete(id); el.classList.remove('ring-2', 'ring-[var(--tg-theme-button-color)]'); el.querySelector('.checkbox-indicator').innerHTML = ''; 
    } else { 
        set.add(id); el.classList.add('ring-2', 'ring-[var(--tg-theme-button-color)]'); el.querySelector('.checkbox-indicator').innerHTML = '<i class="ph ph-check-circle text-2xl text-[var(--tg-theme-button-color)] bg-white rounded-full"></i>'; 
    }
    document.getElementById('selected-count').innerText = selectedFiles.size + selectedFolders.size;
    if (selectedFiles.size===0 && selectedFolders.size===0) cancelSelection();
}
function cancelSelection() { 
    selectMode = false; selectedFiles.clear(); selectedFolders.clear(); 
    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('select-header').classList.add('hidden');
    document.getElementById('selection-bar').classList.add('translate-y-full'); 
    setTimeout(()=>document.getElementById('selection-bar').classList.add('hidden'), 300); 
    document.getElementById('fab-container').classList.remove('translate-y-40'); 
    document.querySelectorAll('.ring-2').forEach(el => { el.classList.remove('ring-2', 'ring-[var(--tg-theme-button-color)]'); el.querySelector('.checkbox-indicator').innerHTML = ''; });
}

// NATIVE EXPORT SYSTEM (Send to Chat)
async function exportItems(fileIds, folderIds) {
    if (fileIds.length === 0 && folderIds.length === 0) return;
    tg.showAlert("✅ Items are being sent to your Telegram Chat! Check your messages.");
    closeViewer(); closeAudio(); cancelSelection();
    await api('/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_ids: fileIds, folder_ids: folderIds })
    });
}

document.getElementById('btn-export').onclick = () => exportItems(Array.from(selectedFiles), Array.from(selectedFolders));

// MOVE SYSTEM
let allFoldersCache = [], targetMoveFolder = null;
document.getElementById('btn-move').onclick = async () => {
    tg.MainButton.setText("Loading...").show().showProgress();
    allFoldersCache = await api('/folders/all');
    tg.MainButton.hide(); renderMoveModal();
    document.getElementById('move-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('move-modal-content').classList.remove('translate-y-full'), 10);
};
function renderMoveModal() {
    const list = document.getElementById('move-folder-list');
    list.innerHTML = `<div class="p-4 mb-2 rounded-xl flex items-center gap-3 cursor-pointer ${targetMoveFolder === null ? 'bg-[var(--tg-theme-button-color)] text-white shadow' : 'bg-gray-100 text-gray-800'}" onclick="setTargetMoveFolder(null)"><i class="ph ph-house text-2xl"></i><span class="font-bold">Root Directory</span></div>`;
    allFoldersCache.forEach(f => {
        if(selectedFolders.has(f.id)) return;
        const isSelected = targetMoveFolder === f.id;
        list.innerHTML += `<div class="p-4 mb-2 rounded-xl flex items-center gap-3 cursor-pointer ${isSelected ? 'bg-[var(--tg-theme-button-color)] text-white shadow' : 'bg-gray-100 text-gray-800'}" onclick="setTargetMoveFolder('${f.id}')"><i class="ph ph-folder-fill text-2xl text-[var(--tg-theme-button-color)]"></i><span class="font-bold">${f.name}</span></div>`;
    });
}
function setTargetMoveFolder(id) { targetMoveFolder = id; renderMoveModal(); }
function closeMoveModal() { document.getElementById('move-modal-content').classList.add('translate-y-full'); setTimeout(() => document.getElementById('move-modal').classList.add('hidden'), 300); }

document.getElementById('btn-confirm-move').onclick = async () => {
    closeMoveModal(); tg.MainButton.setText("Moving...").show().showProgress();
    await api('/move', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ target_folder: targetMoveFolder, file_ids: Array.from(selectedFiles), folder_ids: Array.from(selectedFolders) }) });
    tg.MainButton.hide(); cancelSelection(); loadFolder(currentFolderId);
};

// UPLOADS & ACTIONS
document.getElementById('btn-bulk-delete').onclick = () => { tg.showConfirm(`Delete items?`, async (ok) => { if(ok) { await api('/bulk/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ file_ids: Array.from(selectedFiles), folder_ids: Array.from(selectedFolders) }) }); updateStorage(); cancelSelection(); loadFolder(currentFolderId); } }); };
document.getElementById('btn-create-folder').onclick = () => { const name = prompt("Folder Name:"); if(name) api('/folders', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, parent_id:currentFolderId})}).then(()=>loadFolder(currentFolderId)); };
document.getElementById('file-input').onchange = async (e) => {
    const files = e.target.files; if(!files.length) return;
    for(let f of files) if(f.size > 40*1024*1024) { tg.showAlert(`❌ "${f.name}" is over 40MB.`); return e.target.value=''; }
    tg.MainButton.setText("Uploading...").show().showProgress();
    for(let f of files) { const fd = new FormData(); fd.append('file', f); if(currentFolderId) fd.append('folder_id', currentFolderId); await fetch(`${API_BASE}/files/upload`, {method:'POST', headers:{'Authorization':`Bearer ${jwtToken}`}, body:fd}); }
    tg.MainButton.hide(); updateStorage(); loadFolder(currentFolderId); e.target.value='';
};
init();
