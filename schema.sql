DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS bots;

-- Clients (Bot Owners)
CREATE TABLE bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL,
    owner_id INTEGER,
    client_name TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- End Users
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER,
    telegram_id INTEGER,
    first_name TEXT,
    balance INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bot_id, telegram_id)
);

-- Transactions
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER,
    user_id INTEGER,
    amount INTEGER,
    type TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
