import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  bankName: text("bank_name").notNull(),
  last4: text("last4").notNull(),
  createdAt: text("created_at").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  cardId: integer("card_id"),
  merchant: text("merchant").notNull(),
  category: text("category").notNull(),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  txDate: text("tx_date").notNull(),
  createdAt: text("created_at").notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  merchant: text("merchant").notNull(),
  monthlyAmount: integer("monthly_amount").notNull(),
  nextPayment: text("next_payment").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});
