-- 1. 会员订阅表
CREATE TABLE IF NOT EXISTS memberships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(20) DEFAULT 'free', -- free, pro, enterprise
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active', -- active, expired, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 积分余额表
CREATE TABLE IF NOT EXISTS credits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    balance INTEGER DEFAULT 100, -- 默认赠送100积分
    total_earned INTEGER DEFAULT 100,
    total_spent INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 积分交易流水表
CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type VARCHAR(10) NOT NULL, -- earn, spend
    reason VARCHAR(100) NOT NULL, -- e.g., 'video_generation', 'recharge', 'bonus'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始化现有用户的积分记录 (针对已有用户)
INSERT INTO credits (user_id, balance, total_earned)
SELECT id, 100, 100 FROM users
ON CONFLICT (user_id) DO NOTHING;

-- 初始化现有用户的会员记录
INSERT INTO memberships (user_id, plan_type)
SELECT id, 'free' FROM users
WHERE NOT EXISTS (SELECT 1 FROM memberships WHERE user_id = users.id);

-- 创建索引提高查询效率
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
