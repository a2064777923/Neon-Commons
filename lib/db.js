const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const { TEMPLATE_DEFINITIONS, DEFAULT_SYSTEM_CONFIG } = require("./defaults");

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        "postgres://postgres:postgres@127.0.0.1:5432/doudezhu"
    });
  }

  return pool;
}

async function query(text, params = []) {
  const db = getPool();
  return db.query(text, params);
}

async function initializeDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(40) UNIQUE NOT NULL,
      email VARCHAR(120) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(60) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'player',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      coins INTEGER NOT NULL DEFAULT 10000,
      rank_score INTEGER NOT NULL DEFAULT 1000,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      landlord_wins INTEGER NOT NULL DEFAULT 0,
      landlord_losses INTEGER NOT NULL DEFAULT 0,
      farmer_wins INTEGER NOT NULL DEFAULT 0,
      farmer_losses INTEGER NOT NULL DEFAULT 0,
      total_games INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS room_templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(60) UNIQUE NOT NULL,
      title VARCHAR(80) NOT NULL,
      description TEXT NOT NULL,
      mode VARCHAR(30) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS game_results (
      id SERIAL PRIMARY KEY,
      room_no VARCHAR(16) NOT NULL,
      template_id INTEGER REFERENCES room_templates(id) ON DELETE SET NULL,
      winner_side VARCHAR(20) NOT NULL,
      landlord_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      multiplier INTEGER NOT NULL,
      base_score INTEGER NOT NULL,
      score_delta JSONB NOT NULL DEFAULT '{}'::jsonb,
      summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS system_configs (
      key VARCHAR(80) PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id SERIAL PRIMARY KEY,
      operator_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(80) NOT NULL,
      detail JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS guest_match_links (
      id SERIAL PRIMARY KEY,
      guest_id VARCHAR(80) NOT NULL,
      claimed_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      game_key VARCHAR(40) NOT NULL,
      room_no VARCHAR(16) NOT NULL,
      summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      claimed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS room_directory_snapshots (
      room_no VARCHAR(16) PRIMARY KEY,
      family_key VARCHAR(20) NOT NULL,
      game_key VARCHAR(40) NOT NULL,
      title VARCHAR(120) NOT NULL DEFAULT '',
      strapline TEXT NOT NULL DEFAULT '',
      detail_route VARCHAR(255) NOT NULL,
      join_route VARCHAR(255) NOT NULL,
      visibility VARCHAR(20) NOT NULL DEFAULT 'public',
      owner_id VARCHAR(80),
      room_state VARCHAR(40) NOT NULL DEFAULT 'waiting',
      supports_share_link BOOLEAN NOT NULL DEFAULT FALSE,
      guest_allowed BOOLEAN NOT NULL DEFAULT FALSE,
      member_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source VARCHAR(20) NOT NULL DEFAULT 'live',
      restored_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS bio VARCHAR(160);
  `);

  await seedDefaults();
}

async function seedDefaults() {
  for (const template of TEMPLATE_DEFINITIONS) {
    await query(
      `
        INSERT INTO room_templates (name, title, description, mode, is_active, settings)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (name)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          mode = EXCLUDED.mode,
          is_active = EXCLUDED.is_active,
          settings = EXCLUDED.settings,
          updated_at = NOW()
      `,
      [
        template.name,
        template.title,
        template.description,
        template.mode,
        template.isActive,
        JSON.stringify(template.settings)
      ]
    );
  }

  for (const [key, value] of Object.entries(DEFAULT_SYSTEM_CONFIG)) {
    await query(
      `
        INSERT INTO system_configs (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `,
      [key, JSON.stringify(value)]
    );
  }

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123456";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await query(
    `
      INSERT INTO users (username, email, password_hash, display_name, role)
      VALUES ($1, $2, $3, $4, 'admin')
      ON CONFLICT (username)
      DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        display_name = EXCLUDED.display_name,
        role = 'admin',
        updated_at = NOW()
    `,
    [adminUsername, adminEmail, passwordHash, "系統管理員"]
  );
}

module.exports = {
  getPool,
  query,
  initializeDatabase
};
