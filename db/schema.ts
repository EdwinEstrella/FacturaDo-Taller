import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  decimal,
  timestamp,
  json,
  index,
} from 'drizzle-orm/pg-core';

// Helper for CUID generation (Next.js CUID)
const cuid = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

// Client
export const clients = pgTable('Client', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  name: text('name').notNull(),
  rnc: text('rnc'),
  cedula: text('cedula'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Client History
export const clientHistory = pgTable('ClientHistory', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  clientId: text('clientId').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  description: text('description'),
  metadata: text('metadata'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index('ClientHistory_clientId_createdAt_idx').on(table.clientId, table.createdAt),
}));

// Product
export const products = pgTable('Product', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  name: text('name').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  cost: decimal('cost', { precision: 10, scale: 2 }).notNull().default('0'),
  stock: integer('stock').notNull().default(0),
  minStock: integer('minStock').notNull().default(0),
  isService: boolean('isService').notNull().default(false),
  category: text('category').notNull().default('ARTICULO'),
  unitType: text('unitType').notNull().default('UNIT'),
  sku: text('sku').unique(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  hasVariants: boolean('hasVariants').notNull().default(false),
});

// Product Variant
export const productVariants = pgTable('ProductVariant', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  productId: text('productId').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  cost: decimal('cost', { precision: 10, scale: 2 }).notNull().default('0'),
  stock: integer('stock').notNull().default(0),
  sku: text('sku'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index('ProductVariant_productId_idx').on(table.productId),
}));

// Invoice
export const invoices = pgTable('Invoice', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  sequenceNumber: integer('sequenceNumber').default(1),
  ncf: text('ncf'),
  ncfType: text('ncfType'),
  clientId: text('clientId').references(() => clients.id),
  clientName: text('clientName'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull().default('PAID'),
  paymentMethod: text('paymentMethod'),
  note: text('note'),
  dispatched: boolean('dispatched').notNull().default(false),
  createdById: text('createdById'),
  creatorName: text('creatorName'),
  shippingCost: decimal('shippingCost', { precision: 10, scale: 2 }).notNull().default('0'),
  deliveryDate: timestamp('deliveryDate'),
  notes: text('notes'),
  balance: decimal('balance', { precision: 10, scale: 2 }).notNull().default('0'),
  tax: decimal('tax', { precision: 10, scale: 2 }).notNull().default('0'),
  hasNcf: boolean('hasNcf').notNull().default(false),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Invoice Item
export const invoiceItems = pgTable('InvoiceItem', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  invoiceId: text('invoiceId').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  productId: text('productId').references(() => products.id),
  variantId: text('variantId').references(() => productVariants.id),
  productName: text('productName').notNull(),
  quantity: integer('quantity').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
});

// Quote
export const quotes = pgTable('Quote', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  clientId: text('clientId').references(() => clients.id),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull().default('PENDING'),
  validUntil: timestamp('validUntil'),
  createdById: text('createdById'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Quote Item
export const quoteItems = pgTable('QuoteItem', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  quoteId: text('quoteId').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  productId: text('productId').references(() => products.id),
  variantId: text('variantId').references(() => productVariants.id),
  productName: text('productName').notNull(),
  quantity: integer('quantity').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
});

// User
export const users = pgTable('User', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  phone: text('phone'),
  password: text('password').notNull(),
  role: text('role').notNull().default('SELLER'),
  customPermissions: json('customPermissions').$type<any>(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Permission
export const permissions = pgTable('Permission', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  userId: text('userId').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  permissions: json('permissions').$type<any>().notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Dispatch
export const dispatches = pgTable('Dispatch', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  invoiceId: text('invoiceId').notNull().unique().references(() => invoices.id),
  status: text('status').notNull().default('PENDING'),
  driverName: text('driverName'),
  technicianId: text('technicianId').references(() => users.id),
  vehicleId: text('vehicleId'),
  deliveredAt: timestamp('deliveredAt'),
  installedAt: timestamp('installedAt'),
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  technicianIdIdx: index('Dispatch_technicianId_idx').on(table.technicianId),
}));

// Dispatch Photo
export const dispatchPhotos = pgTable('DispatchPhoto', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  dispatchId: text('dispatchId').notNull().references(() => dispatches.id, { onDelete: 'cascade' }),
  photoUrl: text('photoUrl').notNull(),
  caption: text('caption'),
  takenAt: timestamp('takenAt').defaultNow().notNull(),
  takenBy: text('takenBy'),
}, (table) => ({
  dispatchIdIdx: index('DispatchPhoto_dispatchId_idx').on(table.dispatchId),
}));

// Payment
export const payments = pgTable('Payment', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  invoiceId: text('invoiceId').notNull().references(() => invoices.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  date: timestamp('date').defaultNow().notNull(),
  method: text('method').notNull(),
  reference: text('reference'),
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Credit Note
export const creditNotes = pgTable('CreditNote', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  sequenceNumber: integer('sequenceNumber').default(1),
  invoiceId: text('invoiceId').notNull().references(() => invoices.id),
  reason: text('reason').notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  items: json('items').$type<any>(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Transaction
export const transactions = pgTable('Transaction', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(),
  category: text('category').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  date: timestamp('date').defaultNow().notNull(),
  referenceId: text('referenceId'),
  closingId: text('closingId'),
});

// Petty Cash Closing
export const pettyCashClosings = pgTable('PettyCashClosing', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  openingBalance: decimal('openingBalance', { precision: 10, scale: 2 }).notNull(),
  totalIncome: decimal('totalIncome', { precision: 10, scale: 2 }).notNull(),
  totalExpense: decimal('totalExpense', { precision: 10, scale: 2 }).notNull(),
  closingBalance: decimal('closingBalance', { precision: 10, scale: 2 }).notNull(),
  notes: text('notes'),
  closedAt: timestamp('closedAt').defaultNow().notNull(),
  closedBy: text('closedBy').notNull(),
  closedByName: text('closedByName').notNull(),
});

// Work Order
export const workOrders = pgTable('WorkOrder', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  invoiceId: text('invoiceId').notNull().unique().references(() => invoices.id),
  status: text('status').notNull().default('PRODUCTION'),
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Setting
export const settings = pgTable('Setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// Supplier
export const suppliers = pgTable('Supplier', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Purchase
export const purchases = pgTable('Purchase', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  sequenceNumber: integer('sequenceNumber').default(1),
  supplierId: text('supplierId').references(() => suppliers.id),
  supplierName: text('supplierName'),
  date: timestamp('date').defaultNow().notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull().default('COMPLETED'),
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Purchase Item
export const purchaseItems = pgTable('PurchaseItem', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  purchaseId: text('purchaseId').notNull().references(() => purchases.id, { onDelete: 'cascade' }),
  productId: text('productId').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  quantityType: text('quantityType').notNull().default('UNIT'),
  unitCost: decimal('unitCost', { precision: 10, scale: 2 }).notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
});

// Daily Close
export const dailyCloses = pgTable('DailyClose', {
  id: text('id').primaryKey().$defaultFn(() => cuid()),
  closeDate: timestamp('closeDate').notNull(),
  totalBilled: decimal('totalBilled', { precision: 10, scale: 2 }).notNull(),
  totalCollected: decimal('totalCollected', { precision: 10, scale: 2 }).notNull(),
  cashCollected: decimal('cashCollected', { precision: 10, scale: 2 }).notNull(),
  otherCollected: decimal('otherCollected', { precision: 10, scale: 2 }).notNull(),
  totalExpenses: decimal('totalExpenses', { precision: 10, scale: 2 }).notNull(),
  netCashInDrawer: decimal('netCashInDrawer', { precision: 10, scale: 2 }).notNull(),
  billBreakdownRD: json('billBreakdownRD').$type<any>(),
  billBreakdownUSD: json('billBreakdownUSD').$type<any>(),
  billBreakdownEUR: json('billBreakdownEUR').$type<any>(),
  totalRD: decimal('totalRD', { precision: 10, scale: 2 }).notNull().default('0'),
  totalUSD: decimal('totalUSD', { precision: 10, scale: 2 }).notNull().default('0'),
  totalEUR: decimal('totalEUR', { precision: 10, scale: 2 }).notNull().default('0'),
  discrepancy: decimal('discrepancy', { precision: 10, scale: 2 }).notNull().default('0'),
  invoicesData: json('invoicesData').$type<any>(),
  expensesData: json('expensesData').$type<any>(),
  closedBy: text('closedBy').notNull(),
  closedByName: text('closedByName').notNull(),
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
}, (table) => ({
  closeDateIdx: index('DailyClose_closeDate_idx').on(table.closeDate),
}));

// Type exports
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type NewQuoteItem = typeof quoteItems.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
