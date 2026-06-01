const tg = window.Telegram.WebApp;
tg.expand(); tg.ready();

let jwtToken = null;

async function init() {
    try {
        const res = await fetch(`/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) });
        const data = await res.json();
        jwtToken = data.token;
        loadData();
    } catch (e) { tg.showAlert("Not Authorized."); tg.close(); }
}

function formatBytes(bytes) {
    if(bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'], i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function loadData() {
    const res = await fetch('/api/admin/data', { headers: { 'Authorization': `Bearer ${jwtToken}` } });
    if(!res.ok) return tg.close();
    const data = await res.json();
    
    document.getElementById('s-users').innerText = data.total_users;
    document.getElementById('s-storage').innerText = formatBytes(data.total_used);
    
    const list = document.getElementById('user-list');
    list.innerHTML = '';
    data.users.forEach(u => {
        const pct = Math.min((u.storage_used / u.storage_limit) * 100, 100).toFixed(1);
        list.innerHTML += `
            <div class="p-3 text-sm flex justify-between items-center cursor-pointer active:bg-gray-50" onclick="document.getElementById('g-id').value='${u.tg_id}'">
                <div>
                    <div class="font-bold font-mono text-blue-600">${u.tg_id}</div>
                    <div class="text-xs text-gray-500">${u.username || 'No Username'}</div>
                </div>
                <div class="text-right">
                    <div class="font-bold text-gray-800">${formatBytes(u.storage_used)} / ${formatBytes(u.storage_limit)}</div>
                    <div class="text-xs ${pct > 90 ? 'text-red-500' : 'text-green-500'} font-bold">${pct}% Used</div>
                </div>
            </div>
        `;
    });
}

document.getElementById('btn-grant').onclick = async () => {
    const id = document.getElementById('g-id').value;
    const gb = document.getElementById('g-gb').value;
    if(!id) return tg.showAlert("Enter User ID");
    
    tg.MainButton.setText("Granting...").show().showProgress();
    const res = await fetch('/api/admin/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
        body: JSON.stringify({ tg_id: parseInt(id), gb: parseInt(gb) })
    });
    tg.MainButton.hide();
    
    if(res.ok) { tg.showAlert(`✅ Granted ${gb}GB to ${id} and notified them!`); document.getElementById('g-id').value = ''; loadData(); }
    else { tg.showAlert("❌ User not found or error occurred."); }
};

init();
