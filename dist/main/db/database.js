"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_path_1 = __importDefault(require("node:path"));
const sql_js_1 = __importDefault(require("sql.js"));
const electron_1 = require("electron");
class Database {
    db;
    filePath;
    SQL;
    async init() {
        this.SQL = await (0, sql_js_1.default)({ locateFile: (file) => require.resolve(`sql.js/dist/${file}`) });
        this.filePath = node_path_1.default.join(electron_1.app.getPath('userData'), 'bestand.sqlite');
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(this.filePath), { recursive: true });
        this.db = node_fs_1.default.existsSync(this.filePath) ? new this.SQL.Database(node_fs_1.default.readFileSync(this.filePath)) : new this.SQL.Database();
        this.db.run('PRAGMA foreign_keys = ON;');
        this.migrate();
    }
    get raw() { return this.db; }
    save() { const data = this.db.export(); node_fs_1.default.writeFileSync(this.filePath, Buffer.from(data)); }
    transaction(fn) { this.db.run('BEGIN'); try {
        const r = fn();
        this.db.run('COMMIT');
        this.save();
        return r;
    }
    catch (e) {
        this.db.run('ROLLBACK');
        throw e;
    } }
    exec(sql, params = []) { const stmt = this.db.prepare(sql); try {
        stmt.bind(params);
        stmt.step();
    }
    finally {
        stmt.free();
    } }
    query(sql, params = []) { const stmt = this.db.prepare(sql); try {
        stmt.bind(params);
        const rows = [];
        while (stmt.step())
            rows.push(stmt.getAsObject());
        return rows;
    }
    finally {
        stmt.free();
    } }
    queryOne(sql, params = []) { return this.query(sql, params)[0]; }
    close() { this.save(); this.db.close(); }
    migrate() {
        this.db.run(`
      CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS permissions(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, permission TEXT NOT NULL, UNIQUE(user_id,permission), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, price_cents INTEGER NOT NULL, cost_cents INTEGER, stock INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS sales(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, payment_method TEXT NOT NULL, total_cents INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS sale_items(id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0), unit_price_cents INTEGER NOT NULL, unit_cost_cents INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(id));
      CREATE TABLE IF NOT EXISTS returns(id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, user_id INTEGER NOT NULL, reason TEXT NOT NULL, reason_other TEXT, total_cents INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(sale_id) REFERENCES sales(id), FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS return_items(id INTEGER PRIMARY KEY AUTOINCREMENT, return_id INTEGER NOT NULL, sale_item_id INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0), unit_price_cents INTEGER NOT NULL, unit_cost_cents INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(return_id) REFERENCES returns(id) ON DELETE CASCADE, FOREIGN KEY(sale_item_id) REFERENCES sale_items(id));
      CREATE TABLE IF NOT EXISTS loads(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS load_items(id INTEGER PRIMARY KEY AUTOINCREMENT, load_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0), source TEXT NOT NULL, unit_cost_cents INTEGER, FOREIGN KEY(load_id) REFERENCES loads(id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(id));
      CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id INTEGER, details TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at); CREATE INDEX IF NOT EXISTS idx_returns_date ON returns(created_at); CREATE INDEX IF NOT EXISTS idx_loads_date ON loads(created_at); CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);
    `);
        const productColumns = this.query("PRAGMA table_info(products)");
        if (!productColumns.some((c) => c.name === 'active'))
            this.db.run('ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
        const saleColumns = this.query("PRAGMA table_info(sale_items)");
        if (!saleColumns.some((c) => c.name === 'unit_cost_cents'))
            this.db.run('ALTER TABLE sale_items ADD COLUMN unit_cost_cents INTEGER NOT NULL DEFAULT 0');
        const returnColumns = this.query("PRAGMA table_info(return_items)");
        if (!returnColumns.some((c) => c.name === 'unit_cost_cents'))
            this.db.run('ALTER TABLE return_items ADD COLUMN unit_cost_cents INTEGER NOT NULL DEFAULT 0');
        const admin = this.queryOne('SELECT id FROM users WHERE username=?', ['admin']);
        if (!admin) {
            const salt = node_crypto_1.default.randomBytes(16).toString('hex');
            const hash = node_crypto_1.default.scryptSync('admin123', salt, 64).toString('hex');
            this.exec('INSERT INTO users(username,password_hash,is_admin) VALUES(?,?,1)', ['admin', `${salt}:${hash}`]);
        }
        this.save();
    }
}
exports.Database = Database;
