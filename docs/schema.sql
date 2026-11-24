-- Теңгерім дерекқор схемасы (қолданба кестелері).
-- Файл жергілікті SQLite нұсқасынан алынған: python manage.py migrate командасы дәл осы құрылымды жасайды.
-- Render-де сол миграциялар PostgreSQL-де орындалады (DATABASE_URL), құрылым бірдей.

CREATE TABLE "users" (
  "id" varchar(255) NOT NULL PRIMARY KEY
  , "name" varchar(80) NOT NULL
  , "email" varchar(254) NOT NULL UNIQUE
  , "password_hash" varchar(255) NOT NULL
  , "created_at" datetime NOT NULL
  , "phone" varchar(16) NULL UNIQUE
  , "email_verified_at" datetime NULL);

CREATE TABLE "email_challenges" (
  "id" char(32) NOT NULL PRIMARY KEY
  , "purpose" varchar(8) NOT NULL
  , "email" varchar(254) NOT NULL
  , "code_hash" varchar(64) NOT NULL
  , "pending_name" varchar(80) NOT NULL
  , "pending_phone" varchar(16) NOT NULL
  , "pending_password_hash" varchar(255) NOT NULL
  , "password_fingerprint" varchar(64) NOT NULL
  , "expires_at" datetime NOT NULL
  , "attempts" smallint unsigned NOT NULL CHECK ("attempts" >= 0)
  , "created_at" datetime NOT NULL
  , "user_id" varchar(255) NULL REFERENCES "users" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "email_challenges_user_id_c573dbce" ON "email_challenges" ("user_id");

CREATE TABLE "sessions" (
  "token_hash" varchar(64) NOT NULL PRIMARY KEY
  , "expires_at" bigint NOT NULL
  , "user_id" varchar(255) NOT NULL REFERENCES "users" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "sessions_user_id_05e26f4a" ON "sessions" ("user_id");

CREATE TABLE "cards" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT
  , "bank_name" varchar(50) NOT NULL
  , "last4" varchar(4) NOT NULL
  , "created_at" datetime NOT NULL
  , "user_id" varchar(255) NOT NULL REFERENCES "users" ("id") DEFERRABLE INITIALLY DEFERRED
  , "status" varchar(8) NOT NULL);
CREATE INDEX "cards_user_id_8fb8d426" ON "cards" ("user_id");

CREATE TABLE "transactions" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT
  , "merchant" varchar(80) NOT NULL
  , "category" varchar(40) NOT NULL
  , "amount" integer unsigned NOT NULL CHECK ("amount" >= 0)
  , "type" varchar(7) NOT NULL
  , "tx_date" date NOT NULL
  , "created_at" datetime NOT NULL
  , "card_id" integer NULL REFERENCES "cards" ("id") DEFERRABLE INITIALLY DEFERRED
  , "user_id" varchar(255) NOT NULL REFERENCES "users" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "transactions_card_id_f8e89ea3" ON "transactions" ("card_id");
CREATE INDEX "transactions_user_id_766cc893" ON "transactions" ("user_id");

CREATE TABLE "subscriptions" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT
  , "merchant" varchar(80) NOT NULL
  , "monthly_amount" integer unsigned NOT NULL CHECK ("monthly_amount" >= 0)
  , "next_payment" date NOT NULL
  , "status" varchar(9) NOT NULL
  , "created_at" datetime NOT NULL
  , "user_id" varchar(255) NOT NULL REFERENCES "users" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "subscriptions_user_id_599297d4" ON "subscriptions" ("user_id");

CREATE TABLE "budgets" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT
  , "category" varchar(40) NOT NULL
  , "monthly_limit" integer unsigned NOT NULL CHECK ("monthly_limit" >= 0)
  , "updated_at" datetime NOT NULL
  , "user_id" varchar(255) NOT NULL REFERENCES "users" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "unique_budget_user_category" UNIQUE ("user_id"
  , "category"));
CREATE INDEX "budgets_user_id_d4bb9f71" ON "budgets" ("user_id");

CREATE TABLE "cancellation_requests" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT
  , "status" varchar(10) NOT NULL
  , "created_at" datetime NOT NULL
  , "updated_at" datetime NOT NULL
  , "subscription_id" integer NOT NULL REFERENCES "subscriptions" ("id") DEFERRABLE INITIALLY DEFERRED
  , "user_id" varchar(255) NOT NULL REFERENCES "users" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "cancellation_requests_subscription_id_b64ace59" ON "cancellation_requests" ("subscription_id");
CREATE INDEX "cancellation_requests_user_id_dc0ef3a5" ON "cancellation_requests" ("user_id");

CREATE TABLE "ai_insights" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT
  , "period_start" date NOT NULL
  , "period_end" date NOT NULL
  , "rule_code" varchar(30) NOT NULL
  , "message" varchar(400) NOT NULL
  , "basis" varchar(400) NOT NULL
  , "created_at" datetime NOT NULL
  , "user_id" varchar(255) NOT NULL REFERENCES "users" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "unique_insight_user_rule_period" UNIQUE ("user_id"
  , "rule_code"
  , "period_start"
  , "period_end"));
CREATE INDEX "ai_insights_user_id_d69acfd9" ON "ai_insights" ("user_id");

CREATE TABLE "ignored_subscriptions" (
  "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT
  , "key" varchar(80) NOT NULL
  , "created_at" datetime NOT NULL
  , "user_id" varchar(255) NOT NULL REFERENCES "users" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "unique_ignored_user_key" UNIQUE ("user_id"
  , "key"));
CREATE INDEX "ignored_subscriptions_user_id_5585362c" ON "ignored_subscriptions" ("user_id");
