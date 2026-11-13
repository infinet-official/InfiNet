/* ============================================
   InfiNet (I/NET) — Interactive Script
   Dynamic Server Polling & Visual Effects
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initNavbar();
    initScrollAnimations();
    fetchServerStatus();
    fetchTeam();

    // Auto-refresh server status & staff list every 10 seconds
    setInterval(fetchServerStatus, 10000);
    setInterval(fetchTeam, 10000);
});

/* --- Floating Cyber Particles --- */
function initParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    // Glowing vibrant cyan & electric blue palette
    const colors = ['#38bdf8', '#0ea5e9', '#00f0ff', '#60a5fa', '#3b82f6'];
    const count = 45;

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        const x = Math.random() * 100;
        const size = Math.random() * 3.5 + 1.2;
        const duration = Math.random() * 12 + 8;
        const delay = Math.random() * 10;
        const color = colors[Math.floor(Math.random() * colors.length)];

        particle.style.left = x + '%';
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.background = color;
        particle.style.boxShadow = `0 0 ${size * 4}px ${color}, 0 0 ${size * 8}px ${color}`;
        particle.style.animationDuration = duration + 's';
        particle.style.animationDelay = delay + 's';

        container.appendChild(particle);
    }
}

/* --- Navbar Dynamics --- */
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    const navItems = document.querySelectorAll('.nav-link');

    // Scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 40) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Active section indicator
        const sections = document.querySelectorAll('section[id]');
        let current = '';

        sections.forEach(section => {
            const top = section.offsetTop - 120;
            if (window.scrollY >= top) {
                current = section.getAttribute('id');
            }
        });

        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === '#' + current) {
                item.classList.add('active');
            }
        });
    });

    // Mobile Toggle
    if (toggle && links) {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            links.classList.toggle('open');
        });

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                toggle.classList.remove('active');
                links.classList.remove('open');
            });
        });
    }
}

/* --- Scroll Animations --- */
function initScrollAnimations() {
    const elements = document.querySelectorAll(
        '.server-card, .rule-row, .rules-category-title, .team-card, .contact-card'
    );

    elements.forEach(el => el.classList.add('fade-in'));

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        },
        { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );

    elements.forEach(el => observer.observe(el));
}

/* --- Copy IP Address --- */
function copyIP(ip) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(ip).then(showToast).catch(() => fallbackCopy(ip));
    } else {
        fallbackCopy(ip);
    }
}

function fallbackCopy(ip) {
    const ta = document.createElement('textarea');
    ta.value = ip;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast();
    } catch (err) {
        console.error('Could not copy IP:', err);
    }
    document.body.removeChild(ta);
}

function showToast() {
    const toast = document.getElementById('copyToast');
    if (!toast) return;

    toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2200);
}

/* --- Auto-detect and Fetch InfiNet Servers --- */
async function fetchServerStatus() {
    let infinetList = [];

    // 1. Try our high-speed VPS API first
    try {
        const resp = await fetch(`${API_BASE}/servers`, { cache: 'no-store' });
        if (resp.ok) {
            const data = await resp.json();
            if (data.servers && Array.isArray(data.servers) && data.servers.length > 0) {
                infinetList = data.servers;
            }
        }
    } catch (e) {
        console.warn('API /servers fetch error, falling back to master:', e);
    }

    // 2. Fallback to DDNet Master Servers if API didn't return servers
    if (infinetList.length === 0) {
        const endpoints = [
            'https://master1.ddnet.org/ddnet/15/servers.json',
            'https://master2.ddnet.org/ddnet/15/servers.json'
        ];

        for (const url of endpoints) {
            try {
                const resp = await fetch(url);
                if (resp.ok) {
                    const data = await resp.json();
                    const allServers = data.servers || [];

                    // Filter all servers with 'infinet' in their name
                    const matched = allServers.filter(s =>
                        (s.info?.name || '').toLowerCase().includes('infinet')
                    );

                    infinetList = matched.map(srv => {
                        const name = srv.info?.name || 'InfiNet Server';
                        const lower = name.toLowerCase();
                        let cat = 'block';
                        if (lower.includes('train')) cat = 'train';
                        else if (lower.includes('fng')) cat = 'fng';
                        else if (lower.includes('kog') || lower.includes('gores')) cat = 'kog';
                        else if (lower.includes('block')) cat = 'block';

                        // Extract IPv4 and port
                        let ip = '82.148.243.178';
                        let port = 25555;
                        const addrs = srv.addresses || [];
                        for (const addr of addrs) {
                            const m = addr.match(/^(?:tw-0\.[67]\+udp:\/\/)?(\d+\.\d+\.\d+\.\d+):(\d+)$/);
                            if (m) {
                                ip = m[1];
                                port = parseInt(m[2], 10);
                                break;
                            }
                        }

                        const clients = srv.info?.clients || [];
                        const playerNames = clients.map(c => c.name || '').filter(Boolean);

                        return {
                            name: name,
                            ip: ip,
                            port: port,
                            map: srv.info?.map?.name || 'Unknown',
                            category: cat,
                            online: true,
                            players: clients.length,
                            max_players: srv.info?.max_clients || 64,
                            player_list: playerNames
                        };
                    });

                    if (infinetList.length > 0) break;
                }
            } catch (err) {
                console.warn(`Failed to fetch from ${url}:`, err);
            }
        }
    }

    // 2.5 Sort servers logically: Block -> KoG (I, II, III...) -> Train -> FNG (I, II...)
    const catPriority = { 'block': 1, 'kog': 2, 'train': 3, 'fng': 4 };
    const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6 };
    function getServerNum(name) {
        const m = (name || '').match(/\|\s*([IVXLCDM]+)\s*\|/i);
        return m ? (romanMap[m[1].toUpperCase()] || 99) : 99;
    }

    infinetList.sort((a, b) => {
        const catA = catPriority[a.category] || 99;
        const catB = catPriority[b.category] || 99;
        if (catA !== catB) return catA - catB;
        const numA = getServerNum(a.name);
        const numB = getServerNum(b.name);
        if (numA !== numB) return numA - numB;
        return (a.name || '').localeCompare(b.name || '');
    });

    // 3. Update Server Count & Total Online Players in Hero Stats
    const countStat = document.getElementById('serverCount');
    const onlineStat = document.getElementById('onlinePlayerCount');
    const onlineServers = infinetList.filter(s => s.online);
    const totalOnlinePlayers = onlineServers.reduce((sum, s) => sum + (s.players || 0), 0);

    if (countStat) {
        countStat.textContent = onlineServers.length;
    }
    if (onlineStat) {
        onlineStat.textContent = totalOnlinePlayers;
    }

    const reportSelect = document.getElementById('reportServer');
    if (reportSelect && infinetList.length > 0) {
        reportSelect.innerHTML = infinetList.map(s => 
            `<option value="${escapeHtml(s.name)} (${s.port})">${escapeHtml(s.name)}</option>`
        ).join('');
    }

    // 4. Update Servers Grid
    const grid = document.querySelector('.servers-grid');
    if (!grid) return;

    if (infinetList.length === 0) {
        grid.innerHTML = `
            <div class="server-empty-state">
                <i class="fas fa-radar"></i>
                <h3>Поиск серверов InfiNet...</h3>
                <p>Серверы в процессе подключения или перезапускаются.</p>
            </div>
        `;
        return;
    }

    // Render cards dynamically
    grid.innerHTML = infinetList.map(srv => {
        const cat = srv.category || 'block';
        const catUpper = cat === 'kog' ? 'KOG' : (cat === 'fng' ? 'FNG' : (cat === 'train' ? 'TRAIN' : 'BLOCK'));
        const hasPlayers = srv.players > 0;
        const playerBadge = hasPlayers && srv.player_list && srv.player_list.length > 0
            ? `<div class="server-players-preview" title="Игроки онлайн: ${escapeHtml(srv.player_list.join(', '))}">
                 <i class="fas fa-user-check"></i> ${escapeHtml(srv.player_list.slice(0, 3).join(', '))}${srv.player_list.length > 3 ? ` +${srv.player_list.length - 3}` : ''}
               </div>`
            : '';

        return `
            <div class="server-card ${srv.online ? '' : 'is-offline'}" data-category="${escapeHtml(cat)}">
                <div class="server-header">
                    <div class="server-status ${srv.online ? 'online' : 'offline'}" title="${srv.online ? 'Сервер онлайн' : 'Сервер выключен'}"></div>
                    <span class="server-badge ${escapeHtml(cat)}">${catUpper}</span>
                </div>
                <h3 class="server-name">${escapeHtml(srv.name)}</h3>
                <div class="server-info">
                    <div class="server-detail">
                        <i class="fas fa-map"></i>
                        <span>Карта: <strong>${escapeHtml(srv.map || '—')}</strong></span>
                    </div>
                    <div class="server-detail">
                        <i class="fas fa-users"></i>
                        <span class="player-count">
                            ${srv.online 
                                ? `<strong>${srv.players}</strong> / ${srv.max_players} игроков` 
                                : '<span class="offline-text"><i class="fas fa-power-off"></i> Оффлайн</span>'}
                        </span>
                    </div>
                    ${playerBadge}
                </div>
                <button class="server-ip" onclick="copyIP('${escapeHtml(srv.ip)}:${srv.port}')">
                    <i class="fas fa-copy"></i> ${escapeHtml(srv.ip)}:${srv.port}
                </button>
            </div>
        `;
    }).join('');
}

/* --- Dynamic Team (Synced with ZeroX Staff) --- */
async function fetchTeam() {
    const grid = document.getElementById('teamGrid');
    if (!grid) return;

    try {
        const resp = await fetch(`${API_BASE}/staff`, { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json();
        if (!data.success || !Array.isArray(data.staff)) return;

        const staff = data.staff;
        if (staff.length === 0) {
            grid.innerHTML = `
                <div class="team-empty">
                    <i class="fas fa-user-shield"></i>
                    <p class="team-empty-title">Администрация формируется</p>
                    <p style="margin:0;font-size:14px;">Назначение персонала производится в панели управления ZeroX («Персонал сайта»).</p>
                </div>
            `;
            return;
        }

        const roleOrder = { owner: 1, admin: 2, moderator: 3, helper: 4, player: 5 };
        staff.sort((a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99));

        const roleMeta = {
            owner:     { title: 'Владелец',      cls: 'owner',     badgeCls: 'role-owner',  icon: 'fa-crown',         desc: 'Руководитель проекта InfiNet' },
            admin:     { title: 'Администратор', cls: 'admin',     badgeCls: 'role-admin',  icon: 'fa-shield-alt',    desc: 'Технический надзор и порядок на серверах' },
            moderator: { title: 'Модератор',     cls: 'moderator', badgeCls: 'role-mod',    icon: 'fa-bolt',          desc: 'Контроль за соблюдением правил проекта' },
            helper:    { title: 'Помощник',      cls: 'helper',    badgeCls: 'role-helper', icon: 'fa-hands-helping', desc: 'Помощь новым игрокам и поддержка' }
        };

        grid.innerHTML = staff.map(m => {
            const r = (m.role || 'player').toLowerCase();
            const meta = roleMeta[r] || { title: 'Игрок', cls: '', badgeCls: '', icon: 'fa-user', desc: 'Участник проекта' };
            const u = escapeHtml(m.display_name || m.username || '—');
            return `
                <div class="team-card ${meta.cls}">
                    <div class="team-avatar">
                        <i class="fas ${meta.icon}"></i>
                    </div>
                    <h3 class="team-name">${u}</h3>
                    <span class="team-role ${meta.badgeCls}">${meta.title}</span>
                    <p class="team-desc">${meta.desc}</p>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.log('fetchTeam error:', err);
    }
}

/* ============================================
   Hero Halftone Interactive Engine (Top Hero)
   ============================================ */

function initHeroHalftone() {
    const root = document.getElementById('heroHalftone');
    const canvas = document.getElementById('heroHalftoneCanvas');
    if (!root || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const config = {
        wordmark: 'I/NET',
        background: 'transparent',
        ink: [224, 242, 254],     // #e0f2fe
        warm: [56, 189, 248],    // #38bdf8
        dotGap: 6,
        radius: 100,
        grain: 0.35,
        fontFamily: '"Orbitron", "Inter", sans-serif',
        fontWeight: 900
    };

    let w = 0, h = 0, dpr = 1;
    let px = -1e5, py = -1e5;
    let raf = 0;
    let visible = true;
    let awake = true;
    let ring = { x: 0, y: 0, t: -1 };
    let dots = new Float32Array(0);
    let count = 0;
    let grainTile = null;

    function radiusForCoverage(coverage, gap) {
        const c = coverage < 0 ? 0 : coverage > 1 ? 1 : coverage;
        return Math.sqrt(c) * gap * 0.58;
    }

    function stepDot(x, y, vx, vy, hx, hy, px, py, r) {
        const dx = x - px;
        const dy = y - py;
        const d2 = dx * dx + dy * dy;
        if (r > 0 && d2 < r * r) {
            const d = Math.sqrt(d2) + 0.001;
            const f = (1 - d / r) * 2.8;
            vx += (dx / d) * f;
            vy += (dy / d) * f;
        }
        vx = (vx + (hx - x) * 0.06) * 0.83;
        vy = (vy + (hy - y) * 0.06) * 0.83;
        return [x + vx, y + vy, vx, vy];
    }

    function warmth(x, y, hx, hy, span) {
        const d = Math.hypot(x - hx, y - hy);
        return span > 0 ? Math.min(1, d / span) : 0;
    }

    function layout() {
        const rect = root.getBoundingClientRect();
        w = Math.max(1, Math.round(rect.width));
        h = Math.max(1, Math.round(rect.height));
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);

        const mask = document.createElement('canvas');
        mask.width = w;
        mask.height = h;
        const m = mask.getContext('2d', { willReadFrequently: true });
        if (!m) return;

        const testFont = `${config.fontWeight} 100px ${config.fontFamily}`;
        m.font = testFont;
        const testLettersW = m.measureText("INET").width;
        const testSlashW = m.measureText("/").width * 1.38;
        const testTotalW = testLettersW + testSlashW;

        // Ensure both width and height have plenty of breathing room (prevent vertical clipping)
        const fitByWidth = testTotalW > 0 ? ((w * 0.88) / testTotalW) * 100 : 70;
        const fitByHeight = h * 0.54;
        const fit = Math.min(fitByWidth, fitByHeight);

        const fontLetters = `${config.fontWeight} ${Math.round(fit)}px ${config.fontFamily}`;
        const fontSlash = `${config.fontWeight} ${Math.round(fit * 1.36)}px ${config.fontFamily}`;

        // Measure exact parts
        m.font = fontLetters;
        const wI = m.measureText("I").width;
        const wNet = m.measureText("NET").width;

        m.font = fontSlash;
        const wSlash = m.measureText("/").width;

        const spacing = fit * 0.06;
        const totalW = wI + spacing + wSlash + spacing + wNet;
        let curX = (w - totalW) / 2;
        const centerY = h / 2;

        m.fillStyle = '#000';
        m.textBaseline = 'middle';
        m.textAlign = 'left';

        // Draw "I"
        m.font = fontLetters;
        m.fillText("I", curX, centerY);
        curX += wI + spacing;

        // Draw BIG slash "/"
        m.font = fontSlash;
        m.fillText("/", curX, centerY);
        curX += wSlash + spacing;

        // Draw "NET"
        m.font = fontLetters;
        m.fillText("NET", curX, centerY);

        const img = m.getImageData(0, 0, w, h).data;

        const gap = Math.max(3, config.dotGap);
        const cols = Math.ceil(w / gap);
        const rows = Math.ceil(h / gap);
        const tmp = [];

        for (let gy = 0; gy < rows; gy++) {
            for (let gx = 0; gx < cols; gx++) {
                let sum = 0;
                for (let sy = 0; sy < 3; sy++) {
                    for (let sx = 0; sx < 3; sx++) {
                        const x = Math.min(w - 1, Math.floor(gx * gap + ((sx + 0.5) * gap) / 3));
                        const y = Math.min(h - 1, Math.floor(gy * gap + ((sy + 0.5) * gap) / 3));
                        sum += img[(y * w + x) * 4 + 3];
                    }
                }
                const cov = sum / (9 * 255);
                if (cov < 0.05) continue;
                const hx = gx * gap + gap / 2;
                const hy = gy * gap + gap / 2;
                tmp.push(hx, hy, 0, 0, hx, hy, radiusForCoverage(cov, gap));
            }
        }

        dots = new Float32Array(tmp);
        count = tmp.length / 7;

        grainTile = document.createElement('canvas');
        grainTile.width = 256;
        grainTile.height = 256;
        const g = grainTile.getContext('2d');
        if (g) {
            const id = g.createImageData(256, 256);
            for (let i = 0; i < id.data.length; i += 4) {
                const v = Math.random() * 255;
                id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
                id.data[i + 3] = Math.random() < 0.5 ? 0 : 255;
            }
            g.putImageData(id, 0, 0);
        }
        awake = true;
    }

    function draw(now) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const r = !reduced ? config.radius : 0;
        const ringAge = ring.t < 0 ? 1e9 : now - ring.t;
        const ringR = ringAge * 0.95;
        let moving = false;

        for (let i = 0; i < count; i++) {
            const j = i * 7;
            let x = dots[j];
            let y = dots[j + 1];
            let vx = dots[j + 2];
            let vy = dots[j + 3];
            const hx = dots[j + 4];
            const hy = dots[j + 5];

            if (!reduced) {
                if (ringAge < 900) {
                    const dx = hx - ring.x;
                    const dy = hy - ring.y;
                    const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
                    const band = 1 - Math.min(1, Math.abs(d - ringR) / 28);
                    if (band > 0) {
                        const f = band * 3.4 * (1 - ringAge / 900);
                        vx += (dx / d) * f;
                        vy += (dy / d) * f;
                    }
                }

                const s = stepDot(x, y, vx, vy, hx, hy, px, py, r);
                x = s[0]; y = s[1]; vx = s[2]; vy = s[3];

                if (Math.abs(vx) + Math.abs(vy) > 0.02 || Math.abs(x - hx) + Math.abs(y - hy) > 0.05) {
                    moving = true;
                } else {
                    x = hx; y = hy; vx = 0; vy = 0;
                }

                dots[j] = x;
                dots[j + 1] = y;
                dots[j + 2] = vx;
                dots[j + 3] = vy;
            }

            const k = warmth(x, y, hx, hy, 28);
            ctx.fillStyle = k > 0.02
                ? `rgb(${Math.round(config.ink[0] + (config.warm[0] - config.ink[0]) * k)},${Math.round(config.ink[1] + (config.warm[1] - config.ink[1]) * k)},${Math.round(config.ink[2] + (config.warm[2] - config.ink[2]) * k)})`
                : 'rgb(224, 242, 254)';

            ctx.beginPath();
            ctx.arc(x, y, dots[j + 6], 0, 6.2832);
            ctx.fill();
        }

        if (grainTile && config.grain > 0) {
            ctx.globalAlpha = config.grain * 0.08;
            ctx.globalCompositeOperation = 'overlay';
            const pattern = ctx.createPattern(grainTile, 'repeat');
            if (pattern) {
                ctx.fillStyle = pattern;
                ctx.fillRect(0, 0, w, h);
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }

        awake = moving || ringAge < 900 || px > -1e4;
    }

    function loop(now) {
        raf = 0;
        if (!visible) return;
        draw(now);
        if (awake) raf = requestAnimationFrame(loop);
    }

    function wake() {
        awake = true;
        if (!raf && visible) raf = requestAnimationFrame(loop);
    }

    function toLocal(e) {
        const b = canvas.getBoundingClientRect();
        return [e.clientX - b.left, e.clientY - b.top];
    }

    root.addEventListener('pointermove', (e) => {
        const p = toLocal(e);
        px = p[0];
        py = p[1];
        wake();
    });

    root.addEventListener('pointerleave', () => {
        px = -1e5;
        py = -1e5;
        wake();
    });

    root.addEventListener('pointerdown', (e) => {
        if (reduced || e.target.closest('a,button')) return;
        const p = toLocal(e);
        ring = { x: p[0], y: p[1], t: performance.now() };
        wake();
    });

    layout();
    draw(performance.now());
    wake();

    const ro = new ResizeObserver(() => {
        layout();
        wake();
    });
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
        visible = entries[0] ? entries[0].isIntersecting : true;
        if (visible) wake();
    });
    io.observe(root);

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            layout();
            wake();
        });
    }
}

// Call initHeroHalftone
document.addEventListener('DOMContentLoaded', initHeroHalftone);


/* ============================================
   InfiNet Auth, Shop, Balance & Reports System
   ============================================ */

// API Configuration (Auto-switches to secure HTTPS for GitHub Pages)
const API_BASE = (window.location.protocol === 'https:' || window.location.hostname.includes('github.io'))
    ? 'https://82.148.243.178.sslip.io/api'
    : 'https://82.148.243.178.sslip.io/api';

// Current session state (synced with localStorage)
let currentUser = JSON.parse(localStorage.getItem('infinet_user') || 'null');
let userToken = localStorage.getItem('infinet_token') || null;

document.addEventListener('DOMContentLoaded', () => {
    initUserSession();
    initAuthForms();
    initReportForm();
    fetchStats();

    const navShopBtn = document.getElementById('navShopBtn');
    if (navShopBtn) {
        navShopBtn.addEventListener('click', (e) => {
            if (!currentUser) {
                e.preventDefault();
                openModal('authModal');
                showToastMsg('Магазин доступен в личном кабинете после входа!');
            }
        });
    }

    // Live background polling with game server accounts.db (every 3 seconds)
    if (currentUser && currentUser.username) {
        syncMainUserProfile();
        setInterval(syncMainUserProfile, 3000);
    }
});

async function syncMainUserProfile() {
    if (!currentUser || !currentUser.username) return;
    try {
        const username = currentUser.username;
        const resp = await fetch(`${API_BASE}/user/profile?username=${encodeURIComponent(username)}`, {
            headers: { 'X-Username': username }
        });
        if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.user) {
                currentUser = {
                    ...currentUser,
                    ...data.user,
                    inventory: data.inventory || []
                };
                localStorage.setItem('infinet_user', JSON.stringify(currentUser));
                updateNavUser();
                updateReportsVisibility();
            }
        }
    } catch (e) {}
}

function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('ru-RU');
}

async function fetchStats() {
    try {
        const resp = await fetch(`${API_BASE}/stats`);
        if (resp.ok) {
            const data = await resp.json();
            const onlineStat = document.getElementById('onlinePlayerCount');
            if (onlineStat && typeof data.online_players !== 'undefined') {
                onlineStat.textContent = data.online_players;
            }
            const countStat = document.getElementById('serverCount');
            if (countStat && typeof data.online_servers !== 'undefined') {
                countStat.textContent = data.online_servers;
            }
        }
    } catch (e) {
        console.log('Stats offline fallback');
    }
}

function initUserSession() {
    updateNavUser();
    updateReportsVisibility();
}

function updateNavUser() {
    const area = document.getElementById('navUserArea');
    if (!area) return;

    if (currentUser) {
        const bal = currentUser.money ?? currentUser.balance ?? 0;
        area.innerHTML = `
            <a class="nav-auth-btn nav-user-logged" href="dashboard.html">
                <i class="fas fa-user-astronaut"></i>
                <span class="nav-username">${escapeHtml(currentUser.username)}</span>
                <span class="nav-balance"><img src="img/coin.png" class="coin-icon" alt="Money"> ${formatNumber(bal)}</span>
            </a>
            <button class="nav-logout-inline" title="Выйти" onclick="logoutUser()">
                <i class="fas fa-right-from-bracket"></i>
            </button>
        `;
    } else {
        area.innerHTML = `
            <button class="nav-auth-btn" id="openAuthModalBtn" onclick="openModal('authModal')">
                <i class="fas fa-right-to-bracket"></i> Войти
            </button>
        `;
    }
}

function updateReportsVisibility() {
    const lockEl    = document.getElementById('reportsAuthLock');
    const boxEl     = document.getElementById('reportsContainer');
    const badgeEl   = document.getElementById('reportsUserBadge');
    const nickInput = document.getElementById('reporterNick');

    if (currentUser) {
        if (lockEl) lockEl.style.display = 'none';
        if (boxEl)  boxEl.style.display  = 'grid';
        if (badgeEl) badgeEl.textContent = currentUser.username;
        if (nickInput) {
            nickInput.value = currentUser.username;
            nickInput.setAttribute('readonly', 'true');
        }
    } else {
        if (lockEl) lockEl.style.display = 'block';
        if (boxEl)  boxEl.style.display  = 'none';
        if (nickInput) {
            nickInput.value = '';
            nickInput.removeAttribute('readonly');
        }
    }
}

/* --- Modals Control --- */

function showAuthError(msg) {
    const alertBox = document.getElementById('authAlert');
    if (alertBox) {
        alertBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>${escapeHtml(msg)}</span>`;
        alertBox.style.display = 'flex';
    }
    showToastMsg(msg, true);
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        const alertBox = document.getElementById('authAlert');
        if (alertBox) alertBox.style.display = 'none';
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

// Close when clicking outside modal card
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

function switchAuthTab(type) {
    const alertBox = document.getElementById('authAlert');
    if (alertBox) alertBox.style.display = 'none';
    const loginForm = document.getElementById('loginForm');
    const regForm = document.getElementById('registerForm');
    const tabLogin = document.getElementById('tabLogin');
    const tabReg = document.getElementById('tabRegister');

    if (type === 'login') {
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
        tabLogin.classList.add('active');
        tabReg.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
        tabLogin.classList.remove('active');
        tabReg.classList.add('active');
    }
}

/* --- Auth Handlers --- */
function initAuthForms() {
    const loginForm = document.getElementById('loginForm');
    const regForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;

            try {
                // Remote InfiNet API
                const resp = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await resp.json();
                if (resp.ok && data.success) {
                    saveSession({ ...data.user, inventory: data.inventory || [] }, data.token);
                    closeModal('authModal');
                    showToastMsg(`С возвращением, ${data.user.username}!`);
                    setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
                    return;
                } else if (data.error) {
                    showAuthError(data.error);
                    return;
                } else {
                    showAuthError('Неверный логин или пароль.');
                    return;
                }
            } catch (err) {
                console.error('Login error:', err);
                showAuthError('Ошибка подключения к серверу авторизации.');
                return;
            }
        });
    }

    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('regUsername').value.trim();
            const password = document.getElementById('regPassword').value;

            try {
                const resp = await fetch(`${API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await resp.json();
                if (resp.ok && data.success) {
                    saveSession({ ...data.user, inventory: data.inventory || [] }, data.token);
                    closeModal('authModal');
                    showToastMsg(`Аккаунт ${username} успешно создан!`);
                    setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
                    return;
                } else if (data.error) {
                    showAuthError(data.error);
                    return;
                } else {
                    showAuthError('Ошибка регистрации. Попробуйте другой логин.');
                    return;
                }
            } catch (err) {
                console.error('Registration error:', err);
                showAuthError('Ошибка подключения к серверу регистрации.');
                return;
            }
        });
    }
}

function saveSession(user, token) {
    currentUser = user;
    userToken = token;
    localStorage.setItem('infinet_user', JSON.stringify(user));
    if (token) localStorage.setItem('infinet_token', token);
    updateNavUser();
    updateReportsVisibility();
}

function logoutUser() {
    currentUser = null;
    userToken = null;
    localStorage.removeItem('infinet_user');
    localStorage.removeItem('infinet_token');
    updateNavUser();
    updateReportsVisibility();
    showToastMsg('Вы вышли из профиля.');
}

/* --- Shop System --- */
function initShopTabs() {
    const tabs = document.querySelectorAll('.shop-tab');
    const cards = document.querySelectorAll('.shop-card');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const cat = tab.dataset.cat;
            cards.forEach(card => {
                if (cat === 'all' || card.dataset.cat === cat) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

async function buyShopItem(itemKey, title, price) {
    if (!currentUser) {
        openModal('authModal');
        showToastMsg('Войдите в аккаунт — покупки в личном кабинете!');
        return;
    }
    // Logged in — go to dashboard shop tab
    showToastMsg(`Переходим в кабинет для покупки: ${title}`);
    setTimeout(() => { window.location.href = 'dashboard.html#shop'; }, 700);
}

function simulateTopup(amount) {
    // Topup is now on dashboard — redirect there
    showToastMsg('Пополнение баланса доступно в личном кабинете!');
    setTimeout(() => { window.location.href = 'dashboard.html#bank'; }, 700);
}

/* --- Reports System --- */
function initReportForm() {
    const form = document.getElementById('reportForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentUser) {
            openModal('authModal');
            showToastMsg('Отправка жалобы доступна только авторизованным игрокам!');
            return;
        }

        const reporter = currentUser.username;
        const target = document.getElementById('targetNick').value.trim();
        const server = document.getElementById('reportServer').value;
        const reason = document.getElementById('reportReason').value;
        const descEl = document.getElementById('reportDesc');
        const desc = descEl ? descEl.value.trim() : '';

        if (!target) {
            showToastMsg('Укажите ник нарушителя!');
            return;
        }

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
                showToastMsg(`Жалоба на "${target}" отправлена модераторам!`);
            } else {
                showToastMsg(data.error || 'Ошибка отправки жалобы');
            }
        } catch (err) {
            console.log('Saved report error:', err);
        }

        form.reset();
        const nickInput = document.getElementById('reporterNick');
        if (nickInput && currentUser) {
            nickInput.value = currentUser.username;
            nickInput.setAttribute('readonly', 'true');
        }
        showToastMsg(`Репорт на "${target}" передан администрации!`);
    });
}

function showToastMsg(msg, isError = false) {
    const toast = document.getElementById('copyToast');
    if (!toast) return;
    const isErr = isError || (typeof msg === 'string' && (
        msg.toLowerCase().includes('неверн') ||
        msg.toLowerCase().includes('ошибк') ||
        msg.toLowerCase().includes('не найден') ||
        msg.toLowerCase().includes('заполн') ||
        msg.toLowerCase().includes('error')
    ));

    if (isErr) {
        toast.classList.add('error');
        toast.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(msg)}`;
    } else {
        toast.classList.remove('error');
        toast.innerHTML = `<i class="fas fa-check-circle"></i> ${escapeHtml(msg)}`;
    }

    toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}
