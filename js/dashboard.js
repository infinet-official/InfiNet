/* ============================================================
   InfiNet (I/NET) — Dashboard Script
   Personal cabinet: Home, Shop, Inventory, Bank, Reports, Stats
   Full Live Dynamic Sync with ZeroX-Server accounts.db Database
   ============================================================ */

// API Configuration (Auto-switches to secure HTTPS for GitHub Pages)
const API_BASE = (window.location.protocol === 'https:' || window.location.hostname.includes('github.io'))
    ? 'https://82.148.243.178.sslip.io/api'
    : 'https://82.148.243.178.sslip.io/api';

/* ---- Category icon map ---- */
const CAT_ICONS = {
    vip:          'fa-crown',
    hats:         'fa-hat-wizard',
    cosmetics:    'fa-sun',
    death:        'fa-skull',
    weapons:      'fa-crosshairs',
    spawn:        'fa-bolt',
    effects:      'fa-magic',
    custom_guns:  'fa-gun',
    all:          'fa-store'
};

/* ---- State ---- */
let currentUser     = null;
let userToken       = null;
let shopItemsCache  = [];
let serverDataCache = [];

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    // Auth guard — must be logged in with a valid server token
    currentUser = JSON.parse(localStorage.getItem('infinet_user') || 'null');
    userToken   = localStorage.getItem('infinet_token') || null;

    if (!currentUser || !currentUser.username || !userToken || userToken === 'local_jwt_demo') {
        localStorage.removeItem('infinet_user');
        localStorage.removeItem('infinet_token');
        window.location.href = 'index.html';
        return;
    }

    // Start particles
    initDashParticles();

    // Initial render from local cache
    populateSidebar();
    populateHome();

    // Check URL hash for deep-link (e.g. dashboard.html#shop)
    const hash = window.location.hash.replace('#', '');
    if (['shop', 'inventory', 'bank', 'reports', 'mod-reports', 'stats'].includes(hash)) {
        const btn = document.querySelector(`.dash-nav-item[data-tab="${hash}"]`);
        showTab(hash, btn);
    }

    // IMMEDIATE LIVE SYNC with database (accounts.db)
    await syncProfileWithServer();

    // DYNAMIC POLLING: re-sync with game server every 3 seconds (real-time balance, items, reports)
    setInterval(async () => {
        await syncProfileWithServer();
        const activeTab = document.querySelector('.dash-tab.active')?.id;
        if (activeTab === 'tab-reports') {
            loadMyReports();
        } else if (activeTab === 'tab-mod-reports') {
            fetchModReports();
        }
    }, 3000);

    // Load server status (DDNet master API)
    fetchServerData().then(() => {
        renderHomeMiniServers();
    });
    setInterval(async () => {
        await fetchServerData();
        renderHomeMiniServers();
    }, 10000);

    // Pre-load shop
    fetchShopItems();

    // Reports history
    loadMyReports();

    // Bind report form
    initDashReportForm();
});

/* ============================================================
   LIVE SYNC WITH DATABASE (accounts.db)
   ============================================================ */
async function syncProfileWithServer() {
    if (!currentUser || !currentUser.username) return;

    try {
        const username = currentUser.username;
        const headers = { 'X-Username': username };
        if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

        const resp = await fetch(`${API_BASE}/user/profile?username=${encodeURIComponent(username)}`, {
            headers
        });

        if (resp.status === 401 || resp.status === 403) {
            localStorage.removeItem('infinet_user');
            localStorage.removeItem('infinet_token');
            alert('Сессия недействительна или завершена. Пожалуйста, выполните вход снова.');
            window.location.href = 'index.html';
            return;
        }

        if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.user) {
                const oldBal = Number(currentUser.money ?? currentUser.balance ?? 0);
                const newBal = Number(data.user.money ?? data.user.balance ?? 0);

                currentUser = {
                    ...currentUser,
                    ...data.user,
                    inventory: data.inventory || []
                };
                localStorage.setItem('infinet_user', JSON.stringify(currentUser));

                // Re-render UI
                populateSidebar();
                populateHome();
                renderInventory();
                updateBankBalance();
                setText('shopMoneyDisp', formatNumber(newBal));

                if (oldBal !== newBal && oldBal !== 0) {
                    highlightBalanceChange();
                }
            }
        }
    } catch (e) {
        console.log('Dynamic sync fallback:', e);
    }
}

function highlightBalanceChange() {
    const el = document.getElementById('sideMoney');
    if (el) {
        el.style.transition = 'color 0.3s, transform 0.3s';
        el.style.color = 'var(--ok)';
        el.style.transform = 'scale(1.15)';
        setTimeout(() => {
            el.style.color = '';
            el.style.transform = '';
        }, 800);
    }
}

/* ============================================================
   PARTICLES
   ============================================================ */
function initDashParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    const colors = ['#38bdf8', '#0ea5e9', '#00f0ff', '#60a5fa', '#3b82f6'];
    for (let i = 0; i < 35; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 3.5 + 1.2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        p.style.left            = (Math.random() * 100) + '%';
        p.style.width           = size + 'px';
        p.style.height          = size + 'px';
        p.style.background      = color;
        p.style.boxShadow       = `0 0 ${size*4}px ${color}, 0 0 ${size*8}px ${color}`;
        p.style.animationDuration = (Math.random() * 12 + 8) + 's';
        p.style.animationDelay  = (Math.random() * 10) + 's';
        container.appendChild(p);
    }
}

/* ============================================================
   SIDEBAR
   ============================================================ */
function populateSidebar() {
    if (!currentUser) return;
    setText('sideUsername', currentUser.username || '—');
    setText('sideRole',     roleLabel(currentUser.role));
    setText('sideMoney',    formatNumber(currentUser.money ?? currentUser.balance ?? 0));

    // Check staff permissions for Moderation tab
    const role = (currentUser.role || '').toLowerCase();
    const isStaff = ['owner', 'admin', 'moderator', 'helper'].includes(role);
    const navMod = document.getElementById('navModReports');
    if (navMod) {
        navMod.style.display = isStaff ? 'flex' : 'none';
    }

    if (isStaff) {
        fetch(`${API_BASE}/reports`)
            .then(r => r.json())
            .then(data => {
                if (data.reports) {
                    const pending = data.reports.filter(r => (r.status || 'pending') === 'pending').length;
                    const badge = document.getElementById('modPendingBadge');
                    if (badge) {
                        badge.textContent = pending;
                        badge.style.display = pending > 0 ? 'inline-block' : 'none';
                    }
                }
            })
            .catch(() => {});
    }
}

function roleLabel(role) {
    const map = { owner: '👑 Владелец', admin: '⚡ Администратор', moderator: '🛡️ Модератор', helper: '🔰 Помощник', player: '🎮 Игрок' };
    return map[role] || '🎮 Игрок';
}

/* ============================================================
   TAB SWITCHING
   ============================================================ */
function showTab(tabId, btn) {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dash-nav-item').forEach(b => b.classList.remove('active'));

    const tab = document.getElementById('tab-' + tabId);
    if (tab) tab.classList.add('active');

    if (btn) btn.classList.add('active');
    else {
        const navBtn = document.querySelector(`.dash-nav-item[data-tab="${tabId}"]`);
        if (navBtn) navBtn.classList.add('active');
    }

    if (tabId === 'home')        populateHome();
    if (tabId === 'shop')        renderShop();
    if (tabId === 'inventory')   { renderInventory(); syncProfileWithServer(); }
    if (tabId === 'bank')        updateBankBalance();
    if (tabId === 'reports')     loadMyReports();
    if (tabId === 'mod-reports') fetchModReports();
    if (tabId === 'stats')       renderStats();

    const sidebar = document.getElementById('dashSidebar');
    if (sidebar && sidebar.classList.contains('open')) sidebar.classList.remove('open');
}

function toggleSidebar() {
    const sidebar = document.getElementById('dashSidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

function dashLogout() {
    localStorage.removeItem('infinet_user');
    localStorage.removeItem('infinet_token');
    window.location.href = 'index.html';
}

/* ============================================================
   HOME TAB
   ============================================================ */
function populateHome() {
    if (!currentUser) return;
    const u = currentUser;
    setText('homeUsername',    u.username || '—');
    setText('homeMoney',       formatNumber(u.money ?? u.balance ?? 0));
    setText('homeLevel',       u.level ?? 0);
    setText('homeBlockPoints', u.block_points ?? 0);
    setText('homeExp',         formatNumber(u.exp ?? 0));
    setText('homeBlockKills',  formatNumber(u.block_kills ?? u.blockKills ?? 0));

    // Real purchased items count from DB inventory
    const invCount = Array.isArray(u.inventory) ? u.inventory.length : 0;
    setText('homeItems', invCount);

    // VIP status
    populateHomeVip();
}

function populateHomeVip() {
    if (!currentUser) return;
    const u = currentUser;
    const now = Math.floor(Date.now() / 1000);

    const vipUntil     = Number(u.vip_until      || u.VipUntil     || 0);
    const vipPlusUntil = Number(u.vip_plus_until || u.VipPlusUntil || 0);

    const hasVip     = vipUntil > now;
    const hasVipPlus = vipPlusUntil > now;

    const vipStatus = document.getElementById('homeVipStatus');
    const vipCard   = document.getElementById('homeVipCard');
    const vipBtn    = document.getElementById('homeVipBtn');
    if (vipStatus && vipCard) {
        if (hasVip) {
            const d = new Date(vipUntil * 1000);
            vipStatus.textContent = `Активен до ${d.toLocaleDateString('ru-RU')}`;
            vipCard.classList.add('active-vip');
            if (vipBtn) {
                vipBtn.textContent = 'Продлить';
                vipBtn.disabled = false;
                vipBtn.style.display = '';
                vipBtn.classList.remove('btn-included');
            }
        } else if (hasVipPlus) {
            vipStatus.textContent = 'Включено в активный VIP+';
            vipCard.classList.add('active-vip');
            if (vipBtn) {
                vipBtn.textContent = 'Активно';
                vipBtn.disabled = true;
                vipBtn.classList.add('btn-included');
            }
        } else {
            vipStatus.textContent = 'Нет активной подписки';
            vipCard.classList.remove('active-vip');
            if (vipBtn) {
                vipBtn.textContent = 'Приобрести';
                vipBtn.disabled = false;
                vipBtn.style.display = '';
                vipBtn.classList.remove('btn-included');
            }
        }
    }

    const vpStatus = document.getElementById('homeVipPlusStatus');
    const vpCard   = document.getElementById('homeVipPlusCard');
    const vpBtn    = document.getElementById('homeVipPlusBtn');
    if (vpStatus && vpCard) {
        if (hasVipPlus) {
            const d = new Date(vipPlusUntil * 1000);
            vpStatus.textContent = `Активен до ${d.toLocaleDateString('ru-RU')}`;
            vpCard.classList.add('active-vip-plus');
            vpCard.classList.remove('active-vip');
            if (vpBtn) vpBtn.textContent = 'Продлить';
        } else {
            vpStatus.textContent = 'Нет активной подписки';
            vpCard.classList.remove('active-vip-plus', 'active-vip');
            if (vpBtn) vpBtn.textContent = 'Приобрести';
        }
    }
}

function renderHomeMiniServers() {
    const container = document.getElementById('homeServersMini');
    if (!container) return;
    container.innerHTML = '';

    if (serverDataCache.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 14px; font-size: 0.9rem;">
                <i class="fas fa-spinner fa-spin" style="margin-right: 6px;"></i> Загрузка серверов...
            </div>
        `;
        return;
    }

    serverDataCache.forEach(srv => {
        const row = document.createElement('div');
        row.className = 'home-server-mini';
        row.innerHTML = `
            <span class="dot ${srv.online ? 'online' : 'offline'}"></span>
            <span class="home-server-name">${escapeHtml(srv.name)}</span>
            <span class="home-server-players">${srv.clients}/${srv.maxClients}</span>
        `;
        container.appendChild(row);
    });
}

async function fetchServerData() {
    try {
        let servers = [];
        try {
            const resp = await fetch(`${API_BASE}/servers`, { cache: 'no-store' });
            if (resp.ok) {
                const data = await resp.json();
                if (data.servers && Array.isArray(data.servers) && data.servers.length > 0) {
                    servers = data.servers;
                }
            }
        } catch (e) {}

        if (servers.length === 0) {
            const resp = await fetch('https://master1.ddnet.org/ddnet/15/servers.json');
            if (resp.ok) {
                const data = await resp.json();
                const matched = (data.servers || []).filter(s =>
                    (s.info?.name || '').toLowerCase().includes('infinet')
                );
                servers = matched.map(s => {
                    let port = 25555;
                    for (const a of (s.addresses || [])) {
                        const m = a.match(/:(\d+)$/);
                        if (m) { port = parseInt(m[1], 10); break; }
                    }
                    return {
                        name: s.info?.name || 'InfiNet',
                        port: port,
                        map: s.info?.map?.name || '—',
                        online: true,
                        clients: s.info?.clients?.length ?? 0,
                        maxClients: s.info?.max_clients || 64
                    };
                });
            }
        }

        serverDataCache = servers.map(s => {
            const lower = (s.name || '').toLowerCase();
            let cat = 'block';
            if (lower.includes('train')) cat = 'train';
            else if (lower.includes('fng')) cat = 'fng';
            else if (lower.includes('kog') || lower.includes('gores')) cat = 'kog';
            else if (lower.includes('block')) cat = 'block';

            return {
                name: s.name,
                port: s.port,
                map: s.map || '—',
                category: cat,
                online: s.online !== false,
                clients: s.players ?? s.clients ?? 0,
                maxClients: s.max_players ?? s.maxClients ?? 64
            };
        });

        const catPriority = { 'block': 1, 'kog': 2, 'train': 3, 'fng': 4 };
        const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6 };
        function getServerNum(name) {
            const m = (name || '').match(/\|\s*([IVXLCDM]+)\s*\|/i);
            return m ? (romanMap[m[1].toUpperCase()] || 99) : 99;
        }

        serverDataCache.sort((a, b) => {
            const catA = catPriority[a.category] || 99;
            const catB = catPriority[b.category] || 99;
            if (catA !== catB) return catA - catB;
            const numA = getServerNum(a.name);
            const numB = getServerNum(b.name);
            if (numA !== numB) return numA - numB;
            return (a.name || '').localeCompare(b.name || '');
        });

        const dReportSelect = document.getElementById('dReportServer');
        if (dReportSelect && serverDataCache.length > 0) {
            dReportSelect.innerHTML = serverDataCache.map(s => 
                `<option value="${escapeHtml(s.name)} (${s.port})">${escapeHtml(s.name)}</option>`
            ).join('');
        }
    } catch (e) {
        console.log('Master API error:', e);
    }
}

/* ============================================================
   SHOP TAB
   ============================================================ */
async function fetchShopItems() {
    if (shopItemsCache.length > 0) return shopItemsCache;

    try {
        const resp = await fetch(`${API_BASE}/shop/items`);
        const data = await resp.json();

        // Convert either Array or Object to standard array
        if (Array.isArray(data.items)) {
            shopItemsCache = data.items;
        } else if (data.items && typeof data.items === 'object') {
            shopItemsCache = Object.entries(data.items).map(([k, v]) => ({ key: k, ...v }));
        } else if (Array.isArray(data)) {
            shopItemsCache = data;
        } else {
            shopItemsCache = getEmbeddedCatalog();
        }
    } catch (e) {
        console.log('Shop API offline, using embedded catalog');
        shopItemsCache = getEmbeddedCatalog();
    }
    return shopItemsCache;
}

function renderShop() {
    const grid = document.getElementById('dashShopGrid');
    if (!grid) return;

    fetchShopItems().then(items => {
        if (!items || items.length === 0) {
            grid.innerHTML = '<div class="dash-empty"><i class="fas fa-store-slash"></i><br>Каталог временно недоступен</div>';
            return;
        }

        grid.innerHTML = '';
        items.forEach(item => {
            const card = buildShopCard(item);
            grid.appendChild(card);
        });

        // Update money display
        setText('shopMoneyDisp', formatNumber(currentUser.money ?? currentUser.balance ?? 0));

        // Apply current filter
        const activeTab = document.querySelector('.dash-shop-tab.active');
        if (activeTab) filterShop(activeTab.dataset.scat, activeTab);
    });
}

function buildShopCard(item) {
    const scat = mapCategory(item.category || item.scat || 'all');
    const icon = CAT_ICONS[scat] || 'fa-box';
    const price = typeof item.price === 'string' ? parseInt(item.price.replace(/\s/g, '')) : (item.price || 0);
    const level = item.required_level ?? item.level ?? 0;
    const duration = item.duration || 'forever';
    const itemKey = item.key || item.id || '';

    const inv = Array.isArray(currentUser?.inventory) ? currentUser.inventory : [];
    const now = Math.floor(Date.now() / 1000);
    const vipPlusUntil = Number(currentUser?.vip_plus_until || currentUser?.VipPlusUntil || 0);
    const hasVipPlus = vipPlusUntil > now;
    const isOwned = inv.some(i => (i.id || i.key) === itemKey);
    const isTimed = String(duration).includes('30') || String(duration).includes('дн') || String(duration).includes('day');
    const isForever = duration === 'forever';

    let actionBtn = '';
    if (itemKey === 'vip' && hasVipPlus && !isOwned) {
        actionBtn = `<button class="btn-dash-buy btn-dash-owned" disabled title="Уже включено в ваш VIP+"><i class="fas fa-check"></i> Включено в VIP+</button>`;
    } else if (isOwned && isForever) {
        actionBtn = `<button class="btn-dash-buy btn-dash-owned" disabled><i class="fas fa-check"></i> Куплено</button>`;
    } else if (isOwned && isTimed) {
        actionBtn = `<button class="btn-dash-buy btn-dash-extend" onclick="dashBuyItem('${escapeHtml(itemKey)}', '${escapeHtml(item.name || itemKey)}', ${price})"><i class="fas fa-rotate"></i> Продлить</button>`;
    } else {
        actionBtn = `<button class="btn-dash-buy" onclick="dashBuyItem('${escapeHtml(itemKey)}', '${escapeHtml(item.name || itemKey)}', ${price})"><i class="fas fa-cart-plus"></i> Купить</button>`;
    }

    const card = document.createElement('div');
    card.className = 'dash-shop-card' + (isOwned ? ' owned' : '');
    card.dataset.scat = scat;

    card.innerHTML = `
        <div class="dash-shop-card-icon"><i class="fas ${icon}"></i></div>
        <div class="dash-shop-card-body">
            <div class="dash-shop-card-badges">
                ${level > 0 ? `<span class="badge-lvl">Lv ${level}</span>` : ''}
                <span class="badge-dur">${formatDuration(duration)}</span>
                ${isOwned ? `<span class="badge-owned">✔ Активен</span>` : ''}
            </div>
            <div class="dash-shop-card-name">${escapeHtml(item.name || itemKey || '—')}</div>
            <div class="dash-shop-card-desc">${escapeHtml(item.description || item.desc || '')}</div>
            <div class="dash-shop-card-footer">
                <span class="dash-shop-card-price"><img src="img/coin.png" class="coin-icon" alt="Money"> ${formatNumber(price)}</span>
                ${actionBtn}
            </div>
        </div>
    `;
    return card;
}

function mapCategory(raw) {
    const c = (raw || '').toLowerCase();
    if (c.includes('vip'))          return 'vip';
    if (c.includes('hat'))          return 'hats';
    if (c.includes('death'))        return 'death';
    if (c.includes('spawn'))        return 'weapons';
    if (c.includes('weapon'))       return 'weapons';
    if (c.includes('custom_guns') || c.includes('gun')) return 'effects';
    if (c.includes('effect') || c.includes('rainbow') || c.includes('ghost')) return 'effects';
    if (c.includes('cosmet') || c.includes('halo') || c.includes('circle') ||
        c.includes('lovely') || c.includes('ball') || c.includes('sparkle') ||
        c.includes('heart_hat') || c.includes('pet') || c.includes('lissajous')) return 'cosmetics';
    return 'cosmetics';
}

function formatDuration(d) {
    if (!d || d === 'forever') return '∞ Навсегда';
    if (d === 'dead' || d.includes('смерти')) return '⚡ До смерти';
    if (d.includes('30') || d.includes('дн')) return '📅 30 дней';
    return d;
}

function filterShop(cat, btn) {
    document.querySelectorAll('.dash-shop-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.dash-shop-card').forEach(card => {
        const show = cat === 'all' || card.dataset.scat === cat;
        card.style.display = show ? 'flex' : 'none';
    });
}

/* ============================================================
   BUY ITEM (Applied Directly to SQLite accounts.db)
   ============================================================ */
async function dashBuyItem(itemKey, name, price) {
    if (!currentUser || !currentUser.username) {
        toast('Войдите в аккаунт!');
        return;
    }

    const curBal = Number(currentUser.money ?? currentUser.balance ?? 0);
    if (curBal < price) {
        toast(`Недостаточно денег в игре! Нужно ${formatNumber(price)} (у вас: ${formatNumber(curBal)})`);
        return;
    }

    try {
        const username = currentUser.username;
        const headers = {
            'Content-Type': 'application/json',
            'X-Username': username
        };
        if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

        const resp = await fetch(`${API_BASE}/shop/buy?username=${encodeURIComponent(username)}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ item_key: itemKey })
        });
        const data = await resp.json();

        if (resp.ok && data.success) {
            const newBal = data.new_money !== undefined ? data.new_money : data.newBalance;
            currentUser.money   = newBal;
            currentUser.balance = newBal;

            // Updated inventory directly from database
            if (Array.isArray(data.inventory)) {
                currentUser.inventory = data.inventory;
            }

            localStorage.setItem('infinet_user', JSON.stringify(currentUser));

            // Refresh UI & sync exact VIP timestamps
            await syncProfileWithServer();
            populateSidebar();
            populateHome();
            renderShop();
            renderInventory();
            updateBankBalance();
            setText('shopMoneyDisp', formatNumber(newBal));

            toast(data.message || `Куплено: ${name}! Списано в БД: ${formatNumber(price)}`);
            return;
        } else {
            toast(data.error || 'Ошибка при покупке');
            return;
        }
    } catch (e) {
        toast('Ошибка связи с сервером БД. Попробуйте снова.');
    }
}

/* ============================================================
   INVENTORY TAB (Directly from Database accounts.db)
   ============================================================ */
function renderInventory() {
    const list = document.getElementById('dashInventoryList');
    if (!list) return;

    const inv = Array.isArray(currentUser?.inventory) ? currentUser.inventory : [];

    if (inv.length === 0) {
        list.innerHTML = `
            <div class="dash-empty">
                <i class="fas fa-box-open" style="font-size: 2.5rem; opacity: 0.5; margin-bottom: 12px;"></i><br>
                Активных предметов в базе данных нет.<br>Загляни в 
                <button class="btn-inline-link" onclick="showTab('shop', document.querySelector('[data-tab=shop]'))">
                    Магазин
                </button>!
            </div>
        `;
        return;
    }

    list.innerHTML = '';
    inv.forEach(item => {
        const scat = mapCategory(item.category || '');
        const icon = CAT_ICONS[scat] || 'fa-check-circle';

        const row = document.createElement('div');
        row.className = 'dash-inv-item';
        row.innerHTML = `
            <i class="fas ${icon} dash-inv-icon"></i>
            <div class="dash-inv-info">
                <span class="dash-inv-name">${escapeHtml(item.title || item.name || item.id)}</span>
                <span class="dash-inv-date">Срок: ${escapeHtml(item.duration || item.date || 'Активно')}</span>
            </div>
            <span class="dash-inv-badge">✔ В игре активен</span>
        `;
        list.appendChild(row);
    });
}

/* ============================================================
   BANK TAB (Applied Directly to SQLite accounts.db)
   ============================================================ */
function updateBankBalance() {
    const bal = currentUser ? (currentUser.money ?? currentUser.balance ?? 0) : 0;
    setText('bankBalance', formatNumber(bal));
}

async function demoTopup(amount) {
    if (!currentUser || !currentUser.username) {
        toast('Войдите в аккаунт!');
        return;
    }

    try {
        const username = currentUser.username;
        const headers = {
            'Content-Type': 'application/json',
            'X-Username': username
        };
        if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

        const resp = await fetch(`${API_BASE}/bank/topup?username=${encodeURIComponent(username)}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ amount: amount })
        });
        const data = await resp.json();

        if (resp.ok && data.success) {
            const newBal = data.new_money;
            currentUser.money   = newBal;
            currentUser.balance = newBal;
            localStorage.setItem('infinet_user', JSON.stringify(currentUser));

            updateBankBalance();
            populateSidebar();
            populateHome();
            setText('shopMoneyDisp', formatNumber(newBal));

            toast(`Баланс в игре пополнен на +${formatNumber(amount)}!`);
            return;
        } else {
            toast(data.error || 'Ошибка пополнения');
            return;
        }
    } catch (e) {
        console.log('Topup error:', e);
    }
}

/* ============================================================
   REPORTS TAB
   ============================================================ */
function initDashReportForm() {
    const form = document.getElementById('dashReportForm');
    if (!form) return;

    const nickField = document.getElementById('dReporterNick');
    if (nickField && currentUser) {
        nickField.value = currentUser.username || '';
        nickField.setAttribute('readonly', 'true');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const reporter = currentUser?.username || 'Аноним';
        const target   = document.getElementById('dTargetNick').value.trim();
        const server   = document.getElementById('dReportServer').value;
        const reason   = document.getElementById('dReportReason').value;
        const desc     = document.getElementById('dReportDesc').value.trim();

        if (!target) { toast('Укажи ник нарушителя!'); return; }

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (currentUser?.username) headers['X-Username'] = currentUser.username;
            if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

            const resp = await fetch(`${API_BASE}/reports/submit`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ reporter, target, server, reason, description: desc })
            });
            const data = await resp.json();

            if (resp.ok && data.success) {
                toast(`Репорт на "${target}" успешно отправлен модераторам!`);
                form.reset();
                if (nickField && currentUser) nickField.value = currentUser.username || '';
                await loadMyReports();
                if (typeof fetchModReports === 'function') fetchModReports();
            } else {
                toast(data.error || 'Ошибка отправки жалобы');
            }
        } catch (err) {
            console.error('Submit report error:', err);
            toast('Ошибка подключения к серверу при отправке');
        }
    });
}

async function loadMyReports() {
    const list = document.getElementById('dashReportsList');
    if (!list) return;

    // Purge old offline cache
    try { localStorage.removeItem('infinet_reports'); } catch(e){}

    try {
        const username = (currentUser?.username || '').toLowerCase();
        const headers = {};
        if (currentUser?.username) headers['X-Username'] = currentUser.username;
        if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

        const resp = await fetch(`${API_BASE}/reports`, { headers, cache: 'no-store' });
        if (!resp.ok) throw new Error('API error');
        const data = await resp.json();

        const myReports = (data.reports || []).filter(r => (r.reporter || '').toLowerCase() === username);

        if (myReports.length === 0) {
            list.innerHTML = `
                <div class="dash-empty">
                    <i class="fas fa-check-circle text-green"></i><br>
                    У вас пока нет отправленных жалоб
                </div>
            `;
            return;
        }

        list.innerHTML = myReports.map(r => {
            const status = r.status || 'pending';
            let statusBadge = '';
            if (status === 'approved') {
                statusBadge = `<span class="report-status-badge status-approved"><i class="fas fa-check-circle"></i> Нарушение подтверждено${r.resolved_by ? ` (${escapeHtml(r.resolved_by)})` : ''}</span>`;
            } else if (status === 'rejected') {
                statusBadge = `<span class="report-status-badge status-rejected"><i class="fas fa-times-circle"></i> Отклонено${r.resolved_by ? ` (${escapeHtml(r.resolved_by)})` : ''}</span>`;
            } else {
                statusBadge = `<span class="report-status-badge status-pending"><i class="fas fa-clock"></i> На рассмотрении</span>`;
            }

            const dateStr = r.created_at ? new Date(r.created_at * 1000).toLocaleString('ru-RU') : (r.date || '');

            return `
                <div class="dash-report-item">
                    <div class="dash-report-header">
                        <span class="report-target is-ban"><i class="fas fa-user-slash"></i> Нарушитель: <strong>${escapeHtml(r.target)}</strong></span>
                        ${statusBadge}
                    </div>
                    <div class="report-meta">
                        <span><i class="fas fa-server"></i> ${escapeHtml(r.server)}</span>
                        <span><i class="fas fa-flag"></i> ${escapeHtml(r.reason)}</span>
                        ${dateStr ? `<span><i class="fas fa-clock"></i> ${escapeHtml(dateStr)}</span>` : ''}
                        ${r.resolved_by ? `<span class="report-meta-resolver"><i class="fas fa-user-shield"></i> Рассмотрел: <strong>${escapeHtml(r.resolved_by)}</strong></span>` : ''}
                    </div>
                    ${r.desc || r.description ? `<div class="report-desc">${escapeHtml(r.desc || r.description)}</div>` : ''}
                </div>
            `;
        }).join('');
    } catch (e) {
        list.innerHTML = `<div class="dash-empty text-red"><i class="fas fa-exclamation-triangle"></i> Не удалось загрузить ваши жалобы</div>`;
    }
}

/* ============================================================
   STAFF MODERATION TAB (Owner, Admin, Moderator, Helper)
   ============================================================ */
let allModReports = [];
let modFilter = 'all';

async function fetchModReports() {
    const list = document.getElementById('modReportsList');
    if (!list) return;

    try {
        const username = currentUser?.username || '';
        const headers = { 'X-Username': username };
        if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

        const resp = await fetch(`${API_BASE}/reports`, { headers, cache: 'no-store' });
        if (!resp.ok) throw new Error('API error');
        const data = await resp.json();
        allModReports = data.reports || [];

        // Update pending badge in sidebar
        const pendingCount = allModReports.filter(r => (r.status || 'pending') === 'pending').length;
        const badge = document.getElementById('modPendingBadge');
        if (badge) {
            badge.textContent = pendingCount;
            badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }

        renderModReports();
    } catch (e) {
        console.error('fetchModReports error:', e);
        list.innerHTML = `<div class="dash-empty text-red"><i class="fas fa-exclamation-triangle"></i> Ошибка загрузки списка жалоб</div>`;
    }
}

function filterModReports(filter, btn) {
    modFilter = filter;
    document.querySelectorAll('#tab-mod-reports .filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderModReports();
}

function renderModReports() {
    const list = document.getElementById('modReportsList');
    if (!list) return;

    let filtered = allModReports;
    if (modFilter !== 'all') {
        filtered = allModReports.filter(r => (r.status || 'pending') === modFilter);
    }

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="mod-empty-card">
                <i class="fas fa-check-circle"></i>
                <p class="mod-empty-title">Жалоб в этой категории нет</p>
                <p style="margin:0;font-size:14px;">Все репорты игроков обработаны либо отсутствуют.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = filtered.map(r => {
        const status = r.status || 'pending';
        let statusBadge = '';
        if (status === 'approved') {
            statusBadge = `<span class="report-status-badge status-approved"><i class="fas fa-check"></i> Наказан (${escapeHtml(r.resolved_by || 'Модератор')})</span>`;
        } else if (status === 'rejected') {
            statusBadge = `<span class="report-status-badge status-rejected"><i class="fas fa-times"></i> Отклонено (${escapeHtml(r.resolved_by || 'Модератор')})</span>`;
        } else {
            statusBadge = `<span class="report-status-badge status-pending"><i class="fas fa-clock"></i> На рассмотрении</span>`;
        }

        const dateStr = r.created_at ? new Date(r.created_at * 1000).toLocaleString('ru-RU') : '';

        let actionsHtml = '';
        if (status === 'approved') {
            actionsHtml = `
                <div class="mod-verdict approved">
                    <i class="fas fa-check-circle"></i> Нарушение подтверждено (${escapeHtml(r.resolved_by || 'Модератор')})
                </div>
                <button class="mod-btn-reject" onclick="actionReport(${r.id}, 'reject')">
                    <i class="fas fa-undo"></i> Изменить на «Отклонить»
                </button>
                <button class="mod-btn-delete" onclick="actionReport(${r.id}, 'delete')" title="Удалить репорт">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
        } else if (status === 'rejected') {
            actionsHtml = `
                <div class="mod-verdict rejected">
                    <i class="fas fa-times-circle"></i> Жалоба отклонена (${escapeHtml(r.resolved_by || 'Модератор')})
                </div>
                <button class="mod-btn-approve" onclick="actionReport(${r.id}, 'approve')">
                    <i class="fas fa-undo"></i> Изменить на «Наказать»
                </button>
                <button class="mod-btn-delete" onclick="actionReport(${r.id}, 'delete')" title="Удалить репорт">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
        } else {
            actionsHtml = `
                <button class="mod-btn-approve" onclick="actionReport(${r.id}, 'approve')">
                    <i class="fas fa-check"></i> Подтвердить (Наказан)
                </button>
                <button class="mod-btn-reject" onclick="actionReport(${r.id}, 'reject')">
                    <i class="fas fa-times"></i> Отклонить
                </button>
                <button class="mod-btn-delete" onclick="actionReport(${r.id}, 'delete')" title="Удалить репорт">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
        }

        return `
            <div class="dash-report-card">
                <div class="mod-report-header">
                    <div class="mod-report-title-wrap">
                        <span class="report-target is-ban"><i class="fas fa-user-slash"></i> Нарушитель: ${escapeHtml(r.target)}</span>
                        <span class="report-id-tag">#${r.id}</span>
                    </div>
                    <div>${statusBadge}</div>
                </div>

                <div class="mod-report-meta">
                    <div><span class="meta-lbl"><i class="fas fa-user"></i> Пожаловался:</span> <strong>${escapeHtml(r.reporter || 'Аноним')}</strong></div>
                    <div><span class="meta-lbl"><i class="fas fa-server"></i> Сервер:</span> <strong>${escapeHtml(r.server || '—')}</strong></div>
                    <div><span class="meta-lbl"><i class="fas fa-flag"></i> Причина:</span> <strong>${escapeHtml(r.reason)}</strong></div>
                    <div><span class="meta-lbl"><i class="fas fa-calendar-alt"></i> Время:</span> <span>${escapeHtml(dateStr)}</span></div>
                </div>

                ${r.desc || r.description ? `
                    <div class="mod-report-desc">
                        <span class="mod-report-desc-lbl">Подробности:</span>
                        ${escapeHtml(r.desc || r.description)}
                    </div>
                ` : ''}

                <div class="mod-report-actions">
                    ${actionsHtml}
                </div>
            </div>
        `;
    }).join('');
}

async function actionReport(reportId, action) {
    try {
        const username = currentUser?.username || '';
        const headers = {
            'Content-Type': 'application/json',
            'X-Username': username
        };
        if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

        const resp = await fetch(`${API_BASE}/reports/resolve`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ id: reportId, action })
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
            toast(action === 'delete' ? 'Репорт удалён' : (action === 'approve' ? 'Репорт одобрен! Нарушение зафиксировано.' : 'Репорт отклонён.'));
            await fetchModReports();
            await loadMyReports();
        } else {
            toast(data.error || 'Ошибка при обновлении репорта');
        }
    } catch (e) {
        toast('Ошибка сети при обработке репорта');
    }
}

/* ============================================================
   STATS TAB
   ============================================================ */
async function renderStats() {
    await fetchServerData();

    const totalOnline = serverDataCache.reduce((sum, s) => sum + s.clients, 0);
    const onlineServers = serverDataCache.filter(s => s.online).length;

    setText('statServers', onlineServers);
    setText('statOnline',  totalOnline);

    try {
        const resp = await fetch(`${API_BASE}/stats`);
        if (resp.ok) {
            const data = await resp.json();
            setText('statTotalMoney', formatNumber(data.total_money ?? 0));
        }
    } catch (e) {
        console.log('Stats fetch fallback:', e);
    }

    const container = document.getElementById('statsServersList');
    if (!container) return;
    container.innerHTML = '';

    serverDataCache.forEach(srv => {
        const pct = srv.maxClients > 0 ? Math.round((srv.clients / srv.maxClients) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'stats-server-row';
        row.innerHTML = `
            <div class="stats-srv-left">
                <span class="dot ${srv.online ? 'online' : 'offline'}"></span>
                <span class="stats-srv-name">${escapeHtml(srv.name)}</span>
            </div>
            <div class="stats-srv-right">
                <span class="stats-srv-map"><i class="fas fa-map"></i> ${escapeHtml(srv.map)}</span>
                <span class="stats-srv-players">${srv.clients}/${srv.maxClients}</span>
            </div>
            <div class="stats-srv-bar-wrap">
                <div class="stats-srv-bar" style="width:${pct}%"></div>
            </div>
        `;
        container.appendChild(row);
    });
}

/* ============================================================
   EMBEDDED SHOP CATALOG (offline fallback)
   ============================================================ */
function getEmbeddedCatalog() {
    return [
        { key:'vip',              name:'VIP Статус',        price:500000,  required_level:0,  duration:'30 days', category:'vip',      description:'VIP на 30 дней. Farm bonus: +1 XP и +2 money.' },
        { key:'vip+',             name:'VIP+ Статус',       price:1000000, required_level:0,  duration:'30 days', category:'vip',      description:'VIP+ на 30 дней. Farm bonus: +3 XP и +4 money. Включает косметику и шляпы.' },
        { key:'shotgun',          name:'Дробовик',          price:1000,    required_level:5,  duration:'dead',    category:'weapons',  description:'Дробовик до смерти.' },
        { key:'grenade',          name:'Гранатомёт',        price:1000,    required_level:5,  duration:'dead',    category:'weapons',  description:'Гранатомёт до смерти.' },
        { key:'laser',            name:'Лазерная винтовка', price:1000,    required_level:5,  duration:'dead',    category:'weapons',  description:'Лазерная винтовка до смерти.' },
        { key:'ninja',            name:'Оружие ниндзя',     price:1000,    required_level:5,  duration:'dead',    category:'weapons',  description:'Оружие ниндзя до смерти.' },
        { key:'spawn_shotgun',    name:'Спавн-Дробовик',    price:600000,  required_level:33, duration:'forever', category:'weapons',  description:'Дробовик при спавне навсегда.' },
        { key:'spawn_grenade',    name:'Спавн-Гранатомёт',  price:600000,  required_level:33, duration:'forever', category:'weapons',  description:'Гранатомёт при спавне навсегда.' },
        { key:'spawn_rifle',      name:'Спавн-Винтовка',    price:600000,  required_level:33, duration:'forever', category:'weapons',  description:'Лазер при спавне навсегда.' },
        { key:'halo',             name:'Ореол (Halo)',      price:10000,   required_level:5,  duration:'30 days', category:'cosmetics',description:'Кольцо из лазерных точек.' },
        { key:'epic_circle',      name:'Эпический круг',    price:15000,   required_level:8,  duration:'30 days', category:'cosmetics',description:'Вращающиеся частицы вокруг вас.' },
        { key:'lovely',           name:'Сердечки (Lovely)', price:12000,   required_level:6,  duration:'30 days', category:'cosmetics',description:'Сердечки при движении.' },
        { key:'rotating_ball',    name:'Орбитальный шар',   price:20000,   required_level:10, duration:'30 days', category:'cosmetics',description:'Точка вращается вокруг головы.' },
        { key:'sparkle',          name:'Искры (Sparkle)',   price:25000,   required_level:12, duration:'30 days', category:'cosmetics',description:'Светящиеся искры.' },
        { key:'heart_hat',        name:'Сердечная шляпка',  price:8000,    required_level:5,  duration:'30 days', category:'cosmetics',description:'Два сердечка над персонажем.' },
        { key:'pickup_pet',       name:'Питомец',           price:18000,   required_level:9,  duration:'30 days', category:'cosmetics',description:'Питомец летит рядом.' },
        { key:'lissajous',        name:'Фигура Лиссажу',    price:30000,   required_level:15, duration:'30 days', category:'cosmetics',description:'Фигура Лиссажу вокруг тебя.' },
        { key:'rainbow',          name:'Радуга (Rainbow)',  price:1500,    required_level:5,  duration:'forever', category:'effects',  description:'Быстрая смена цветов скина.' },
        { key:'spooky_ghost',     name:'Призрак',           price:1000000, required_level:1,  duration:'forever', category:'effects',  description:'Скрывайся в кустах, стреляй плазмой.' },
        { key:'dick_gun',         name:'Dick Gun',          price:1000000, required_level:40, duration:'forever', category:'effects',  description:'Только визуал.' },
        { key:'heart_gun',        name:'Heart Gun',         price:100000,  required_level:30, duration:'forever', category:'effects',  description:'Пистолет стреляет сердечками.' },
        { key:'death_hammer',     name:'Смерть: Молот',     price:5000,    required_level:8,  duration:'30 days', category:'death',    description:'Эффект смерти: Удар молотом.' },
        { key:'death_explosion',  name:'Смерть: Взрыв',     price:8000,    required_level:10, duration:'30 days', category:'death',    description:'Эффект смерти: Взрыв.' },
        { key:'death_damageind',  name:'Смерть: Урон',      price:6000,    required_level:9,  duration:'30 days', category:'death',    description:'Эффект смерти: Индикатор урона.' },
        { key:'death_crosshair',  name:'Смерть: Прицел',    price:10000,   required_level:11, duration:'30 days', category:'death',    description:'Эффект смерти: Прицел.' },
        { key:'death_meteor',     name:'Смерть: Метеор',    price:14000,   required_level:13, duration:'30 days', category:'death',    description:'Эффект смерти: Метеор.' },
        { key:'death_gg',         name:'Смерть: GG',        price:16000,   required_level:14, duration:'30 days', category:'death',    description:'Эффект смерти: GG.' },
        { key:'death_cross',      name:'Смерть: Крест',     price:20000,   required_level:16, duration:'30 days', category:'death',    description:'Эффект смерти: Крест.' },
        { key:'death_ghost',      name:'Смерть: Дух',       price:25000,   required_level:18, duration:'30 days', category:'death',    description:'Эффект смерти: Призрак.' },
        { key:'hat_hammer',       name:'Шляпа-хаммер',      price:10000,   required_level:10, duration:'30 days', category:'hats',     description:'Шляпа: Молот.' },
        { key:'hat_gun',          name:'Шляпа-пистолет',    price:10000,   required_level:10, duration:'30 days', category:'hats',     description:'Шляпа: Пистолет.' },
        { key:'hat_shotgun',      name:'Шляпа-дробовик',    price:10000,   required_level:10, duration:'30 days', category:'hats',     description:'Шляпа: Дробовик.' },
        { key:'hat_grenade',      name:'Шляпа-гранатомёт',  price:10000,   required_level:10, duration:'30 days', category:'hats',     description:'Шляпа: Гранатомёт.' },
        { key:'hat_laser',        name:'Шляпа-лазер',       price:10000,   required_level:10, duration:'30 days', category:'hats',     description:'Шляпа: Лазер.' },
        { key:'hat_ninja',        name:'Шляпа-ниндзя',      price:100000,  required_level:10, duration:'30 days', category:'hats',     description:'Шляпа: Ниндзя.' },
        { key:'hat_party',        name:'Праздничный колпак',price:20000,   required_level:10, duration:'30 days', category:'hats',     description:'Праздничный колпак.' },
        { key:'hat_tophat',       name:'Цилиндр',           price:200000,  required_level:10, duration:'30 days', category:'hats',     description:'Классический цилиндр.' },
        { key:'hat_antennae',     name:'Антенны',           price:200000,  required_level:10, duration:'30 days', category:'hats',     description:'Антенны пришельца.' },
        { key:'hat_horns',        name:'Рога',              price:500000,  required_level:10, duration:'30 days', category:'hats',     description:'Демонические рога.' },
        { key:'hat_catears',      name:'Ушки котика',       price:500000,  required_level:10, duration:'30 days', category:'hats',     description:'Ушки котика.' }
    ];
}

/* ============================================================
   UTILS
   ============================================================ */
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function formatNumber(n) {
    n = Number(n) || 0;
    return n.toLocaleString('ru-RU');
}

function toast(msg) {
    const el = document.getElementById('dashToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}
