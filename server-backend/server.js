/**
 * InfiNet Secure Backend API
 * Production-ready server with strong security:
 * - Helmet security headers
 * - Strict Rate Limiting (anti-bruteforce)
 * - Bcrypt password hashing (salted)
 * - Prepared Statements (100% SQL-injection proof)
 * - JWT authentication
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'infinet_super_secure_vault_key_2026_xyz987';

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: '*', // Allows github.io and localhost
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10kb' })); // Anti DoS body limit

// Strict Rate Limiting for Auth
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 15, // max 15 attempts per IP
    message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' }
});

const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 120
});
app.use('/api/', generalLimiter);

// Database initialization
const db = new sqlite3.Database(path.join(__dirname, 'infinet_database.sqlite'), (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to secure SQLite database');
        initDatabase();
    }
});

function initDatabase() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'player',
            balance INTEGER DEFAULT 100,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Shop Items Table
        db.run(`CREATE TABLE IF NOT EXISTS shop_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            price INTEGER NOT NULL,
            icon TEXT NOT NULL,
            description TEXT
        )`);

        // User Inventory / Purchases
        db.run(`CREATE TABLE IF NOT EXISTS user_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (item_id) REFERENCES shop_items(id)
        )`);

        // Reports Table
        db.run(`CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reporter_name TEXT NOT NULL,
            target_name TEXT NOT NULL,
            reason TEXT NOT NULL,
            server_name TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Seed default shop items if empty
        db.get('SELECT COUNT(*) as count FROM shop_items', (err, row) => {
            if (row && row.count === 0) {
                const stmt = db.prepare('INSERT INTO shop_items (title, category, price, icon, description) VALUES (?, ?, ?, ?, ?)');
                stmt.run('Префикс [VIP]', 'prefixes', 150, 'fa-crown', 'Золотой префикс перед ником в чате');
                stmt.run('Лазерный след (Cyan)', 'trails', 250, 'fa-bolt', 'Электрический неоновый след за хуком');
                stmt.run('Префикс [PRO]', 'prefixes', 100, 'fa-star', 'Стильный синий префикс игрока');
                stmt.run('Скин Rainbow Tee', 'skins', 300, 'fa-palette', 'Эксклюзивный градиентный скин для DDNet');
                stmt.run('Неоновый молот', 'weapons', 200, 'fa-hammer', 'Свечение и кастомные искры при ударе');
                stmt.run('Размут чата (Instant)', 'services', 80, 'fa-comment', 'Снятие одного текущего мута на сервере');
                stmt.finalize();
                console.log('Seeded default shop items');
            }
        });
    });
}

// Helper: JWT verification middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Требуется авторизация' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Сессия устарела или недействительна' });
        req.user = user;
        next();
    });
}

// --- API ROUTES ---

// 1. Registration
app.post('/api/register', authLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Укажите никнейм и пароль' });
    }

    const cleanUsername = username.trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
        return res.status(400).json({ error: 'Ник должен быть от 3 до 20 символов' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (username, password_hash, balance, role) VALUES (?, ?, 100, ?)';
        
        // Auto-assign owner role for initial creators if desired
        const role = (cleanUsername.toLowerCase() === 'karapys' || cleanUsername.toLowerCase() === 'blyua') ? 'owner' : 'player';

        db.run(query, [cleanUsername, hash, role], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Игрок с таким ником уже зарегистрирован' });
                }
                return res.status(500).json({ error: 'Ошибка базы данных' });
            }

            const token = jwt.sign({ id: this.lastID, username: cleanUsername, role }, JWT_SECRET, { expiresIn: '7d' });
            res.json({
                success: true,
                message: 'Регистрация успешна! Вам начислено 100 стартовых коинов.',
                token,
                user: { id: this.lastID, username: cleanUsername, role, balance: 100 }
            });
        });
    } catch (e) {
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// 2. Login
app.post('/api/login', authLimiter, (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Введите ник и пароль' });
    }

    db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [username.trim()], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'Неверный никнейм или пароль' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(400).json({ error: 'Неверный никнейм или пароль' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            success: true,
            token,
            user: { id: user.id, username: user.username, role: user.role, balance: user.balance }
        });
    });
});

// 3. Current User Profile & Balance
app.get('/api/me', authenticateToken, (req, res) => {
    db.get('SELECT id, username, role, balance, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Пользователь не найден' });
        
        // Also get inventory
        db.all(`SELECT s.id, s.title, s.category, s.icon, ui.purchased_at 
                FROM user_inventory ui 
                JOIN shop_items s ON ui.item_id = s.id 
                WHERE ui.user_id = ?`, [user.id], (err, items) => {
            res.json({
                user: { ...user, inventory: items || [] }
            });
        });
    });
});

// 4. Shop Items
app.get('/api/shop/items', (req, res) => {
    db.all('SELECT * FROM shop_items', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Не удалось загрузить товары' });
        res.json({ items: rows || [] });
    });
});

// 5. Buy Item
app.post('/api/shop/buy', authenticateToken, (req, res) => {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: 'Не указан предмет' });

    db.get('SELECT * FROM shop_items WHERE id = ?', [itemId], (err, item) => {
        if (err || !item) return res.status(404).json({ error: 'Товар не найден' });

        db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'Пользователь не найден' });

            if (user.balance < item.price) {
                return res.status(400).json({ error: `Недостаточно коинов! Требуется: ${item.price}, ваш баланс: ${user.balance}` });
            }

            // Deduct balance and add to inventory
            const newBalance = user.balance - item.price;
            db.serialize(() => {
                db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id]);
                db.run('INSERT INTO user_inventory (user_id, item_id) VALUES (?, ?)', [req.user.id, item.id]);
                res.json({
                    success: true,
                    message: `Вы успешно приобрели "${item.title}"!`,
                    newBalance
                });
            });
        });
    });
});

// 6. Reports API (for web and in-game mod)
app.post('/api/report', (req, res) => {
    const { reporter, target, reason, server } = req.body;
    if (!target || !reason) {
        return res.status(400).json({ error: 'Укажите ник нарушителя и причину' });
    }

    const stmt = db.prepare('INSERT INTO reports (reporter_name, target_name, reason, server_name) VALUES (?, ?, ?, ?)');
    stmt.run([reporter || 'Аноним', target.trim(), reason.trim(), server || 'InfiNet Global'], function(err) {
        if (err) return res.status(500).json({ error: 'Ошибка сохранения жалобы' });
        res.json({ success: true, message: 'Жалоба принята на рассмотрение модерацией.', reportId: this.lastID });
    });
});

// 7. Get Reports (Admin/Mod only)
app.get('/api/reports', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'owner' && req.user.role !== 'moderator') {
        return res.status(403).json({ error: 'Доступ разрешен только администрации' });
    }

    db.all('SELECT * FROM reports ORDER BY id DESC LIMIT 50', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Не удалось получить репорты' });
        res.json({ reports: rows || [] });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`InfiNet Backend Secure API running on port ${PORT}`);
});
