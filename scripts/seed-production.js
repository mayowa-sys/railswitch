#!/usr/bin/env node
/**
 * Production Seed Script — runs inside the engine container via `fly ssh`
 * Seeds: plans, customers, subscriptions, payment methods, invoices
 * Uses SQL directly (bypasses API for speed and to set states properly)
 */
const { Client } = require('pg');
const crypto = require('crypto');

const MID = 'mer_k_W0XspbNN';
const API_KEY = 'sk_test_mer_k_W0XspbNN__y70_WaK_hR1iJU7qn95WUclycPU';

function rng(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rng(0, arr.length - 1)]; }
function uid() { return crypto.randomUUID().replace(/-/g, '').slice(0, 20); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().replace('T', ' ').slice(0, 19); }
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().replace('T', ' ').slice(0, 19); }

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log('Connected to production DB');

  // Clean existing data for this merchant
  console.log('Cleaning existing data...');
  await c.query(`UPDATE subscriptions SET current_invoice_id = NULL WHERE merchant_id = $1`, [MID]);
  for (const t of ['charge_attempts', 'audit_log', 'processed_events',
    'webhook_delivery_attempts', 'webhook_events', 'webhook_endpoints',
    'payment_methods', 'invoices', 'subscriptions', 'customers', 'plans']) {
    await c.query(`DELETE FROM ${t} WHERE merchant_id = $1`, [MID]);
  }

  // ── PLANS ──
  console.log('Creating plans...');
  const plans = {};
  const planData = [
    ['Basic', 'Perfect for individuals starting their fitness journey.', 990000],
    ['Pro', 'For dedicated members who want full access and training.', 2990000],
    ['Elite', 'Premium experience with personal training and recovery.', 7990000],
    ['Corporate', 'Complete wellness solution for your entire team.', 24900000],
  ];
  for (const [name, desc, amount] of planData) {
    const r = await c.query(
      `INSERT INTO plans (id, merchant_id, name, description, amount, currency, interval, interval_count, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'NGN', 'monthly', 1, true, NOW(), NOW()) RETURNING id`,
      [uid(), MID, name, desc, amount]
    );
    plans[name.toLowerCase()] = r.rows[0].id;
    console.log(`  ${name}: ${plans[name.toLowerCase()]} (₦${(amount / 100).toLocaleString()}/mo)`);
  }

  // Legacy plan (inactive)
  const lr = await c.query(
    `INSERT INTO plans (id, merchant_id, name, description, amount, currency, interval, interval_count, is_active, created_at, updated_at)
     VALUES ($1, $2, 'Basic (Legacy)', 'Grandfathered plan.', 490000, 'NGN', 'monthly', 1, false, NOW(), NOW()) RETURNING id`,
    [uid(), MID]
  );
  plans.legacy = lr.rows[0].id;

  // ── CUSTOMERS ──
  console.log('Creating 285 customers...');
  const firstNames = ["Adeola","Chinedu","Fatima","Emeka","Blessing","Tunde","Ngozi","Yusuf","Grace","David","Ifeoma","Musa","Sarah","Obinna","Zainab","Kelechi","Aisha","John","Adaobi","Oluwaseun","Chinaza","Ibrahim","Folake","Uche","Hauwa","Seyi","Nneka","Tobi","Moji","Ebuka","Chiamaka","Yemi","Bimpe","Bayo","Ronke","Sola","Lola","Femi","Dapo","Wale","Amara","Chuka","Efe","Gbenga","Halima","Ifeanyi","Jumoke","Kola","Lara","Moses","Olga","Chidinma","Temitope","Akin","Bola","Doris","Emmanuel","Funke","Gideon","Helen","Ifeanyichukwu","Joseph","Kemi","Linda","Michael","Ngozika","Olumide","Priscilla","Quadri","Rasheedat","Sade","Toyin","Udo","Victoria","Wunmi","Xavier","Yinka","Zainab","Abel","Cynthia","Daniel","Esther","Frank","Gloria","Henry","James","Kunle","Lydia","Matthew","Ola","Patrick","Rita","Sunday","Titilayo","Uchenna","Vincent"];
  const lastNames = ["Ibrahim","Okonkwo","Bello","Nwosu","Adeyemi","Bakare","Eze","Mohammed","Oluwole","Chukwu","Abdullahi","Johnson","Okafor","Usman","Madu","Bala","Peters","Obi","Adebayo","Musa","Abubakar","Nwachukwu","Ogunleye","Akpan","Ekong","Oladipo","Balogun","Ajayi","Lawal","Nwankwo","Ogunbanjo","Bankole","Alabi","Suleiman","Danjuma","Okoro","Adesina","Onyeka","Taiwo","Kehinde","Idris","Garba","Emenike","Olamide","Somto","Chibueze","Nnamdi","Oluwadare","Abiola","Fashola","Amoo","Oyewole","Olaniyan","Akinwale","Oyedele"];

  const customers = [];
  const usedNames = new Set();
  for (let i = 0; i < 285; i++) {
    let name;
    do { name = `${pick(firstNames)} ${pick(lastNames)}`; } while (usedNames.has(name));
    usedNames.add(name);
    const email = `user${i}@demo.dev`;
    const created = daysAgo(rng(5, 365));
    const r = await c.query(
      `INSERT INTO customers (id, merchant_id, name, email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
      [uid(), MID, name, email, created]
    );
    customers.push(r.rows[0].id);
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/285 customers`);
  }
  console.log(`  285 customers created`);

  // ── SUBSCRIPTIONS ──
  console.log('Creating 275 subscriptions...');
  let cursor = 0;

  // 255 active: 120 basic + 85 pro + 35 elite + 15 corporate
  const activeDist = [['basic', 120], ['pro', 85], ['elite', 35], ['corporate', 15]];
  for (const [planKey, count] of activeDist) {
    for (let i = 0; i < count; i++) {
      const idx = cursor + i;
      const monthsAgo = rng(1, 10);
      const periodStart = daysAgo(30 * monthsAgo + rng(0, 10));
      const periodEnd = daysFromNow(rng(10, 25));
      await c.query(
        `INSERT INTO subscriptions (id, merchant_id, customer_id, plan_id, state, version, current_period_start, current_period_end, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'active', 1, $5, $6, NOW() - INTERVAL '${monthsAgo} months', NOW())`,
        [uid(), MID, customers[idx], plans[planKey], periodStart, periodEnd]
      );
    }
    cursor += count;
  }
  console.log('  255 active subs created');

  // 10 cancelled
  const cancelReasons = ["Switched to competitor","Budget constraints","No longer needed","Moving to new city","Business closed","Relocating abroad","Found alternative","Too expensive","Poor experience","Personal reasons"];
  for (let i = 0; i < 10; i++) {
    const idx = cursor + i;
    const monthsAgo = rng(2, 10);
    const periodStart = daysAgo(30 * monthsAgo + rng(0, 10));
    const periodEnd = daysFromNow(rng(10, 25));
    const subId = uid();
    await c.query(
      `INSERT INTO subscriptions (id, merchant_id, customer_id, plan_id, state, version, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'cancelled', 1, $5, $6, false, NOW() - INTERVAL '${monthsAgo} months', NOW())`,
      [subId, MID, customers[idx], pick([plans.basic, plans.pro]), periodStart, periodEnd]
    );
  }
  cursor += 10;
  console.log('  10 cancelled subs created');

  // 5 paused
  for (let i = 0; i < 5; i++) {
    const idx = cursor + i;
    const monthsAgo = rng(1, 6);
    const periodStart = daysAgo(30 * monthsAgo + rng(0, 10));
    const periodEnd = daysFromNow(rng(10, 25));
    await c.query(
      `INSERT INTO subscriptions (id, merchant_id, customer_id, plan_id, state, version, current_period_start, current_period_end, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'paused', 1, $5, $6, NOW() - INTERVAL '${monthsAgo} months', NOW())`,
      [uid(), MID, customers[idx], pick([plans.pro, plans.elite]), periodStart, periodEnd]
    );
  }
  cursor += 5;
  console.log('  5 paused subs created');

  // 5 trialing
  for (let i = 0; i < 5; i++) {
    const idx = cursor + i;
    const trialEnd = daysFromNow(rng(2, 12));
    const start = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await c.query(
      `INSERT INTO subscriptions (id, merchant_id, customer_id, plan_id, state, version, current_period_start, current_period_end, trial_ends_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'trialing', 1, $5, $5, $6, NOW(), NOW())`,
      [uid(), MID, customers[idx], pick([plans.basic, plans.pro, plans.elite]), start, trialEnd]
    );
  }
  cursor += 5;
  console.log('  5 trialing subs created');

  // ── CASCADE STATE SUBS ──
  console.log('Creating 10 cascade-state subs...');
  const cascadeConfigs = [
    ['retrying', 'basic', 2, 'Card declined: insufficient funds'],
    ['retrying', 'pro', 1, 'Card declined: do not honor'],
    ['va_fallback', 'pro', 5, 'Card retry limit reached'],
    ['va_fallback', 'basic', 5, 'Card retry limit reached'],
    ['whatsapp_fallback', 'elite', 5, 'Virtual account expired'],
    ['whatsapp_fallback', 'pro', 5, 'Virtual account expired'],
    ['past_due', 'basic', 5, 'All recovery channels exhausted'],
    ['past_due', 'pro', 5, 'All recovery channels exhausted'],
    ['past_due', 'elite', 5, 'All recovery channels exhausted'],
    ['past_due', 'basic', 5, 'All recovery channels exhausted'],
  ];
  const planAmounts = { [plans.basic]: 990000, [plans.pro]: 2990000, [plans.elite]: 7990000, [plans.corporate]: 24900000 };

  for (let i = 0; i < cascadeConfigs.length; i++) {
    const [state, planKey, retryCount, lastFailure] = cascadeConfigs[i];
    const subId = `sub_cascade_${String(i + 1).padStart(3, '0')}`;
    const periodStart = daysAgo(rng(1, 25));
    const periodEnd = daysFromNow(rng(5, 25));
    const vaId = ['va_fallback', 'whatsapp_fallback', 'past_due'].includes(state) ? `va_${subId}` : null;
    const vaExpires = vaId ? daysFromNow(rng(-2, 3)) : null;
    const isRetryable = state === 'retrying';

    await c.query(
      `INSERT INTO subscriptions (id, merchant_id, customer_id, plan_id, state, version, retry_count, last_failure_reason, last_failure_retryable, va_id, va_expires_at, current_period_start, current_period_end, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10, $11, $12, NOW() - INTERVAL '${rng(15, 60)} days', NOW())
       ON CONFLICT DO NOTHING`,
      [subId, MID, customers[cursor + i], plans[planKey], state, retryCount, lastFailure, isRetryable, vaId, vaExpires, periodStart, periodEnd]
    );

    // Failed invoice
    const invId = `inv_cascade_${String(i + 1).padStart(3, '0')}`;
    const amount = planAmounts[plans[planKey]];
    const dueDate = daysAgo(rng(1, 10));
    const invStatus = state === 'past_due' ? 'uncollectible' : 'pending_retry';

    await c.query(
      `INSERT INTO invoices (id, subscription_id, merchant_id, amount, currency, status, due_date, created_at)
       VALUES ($1, $2, $3, $4, 'NGN', $5, $6, NOW()) ON CONFLICT DO NOTHING`,
      [invId, subId, MID, amount, invStatus, dueDate]
    );
    await c.query(`UPDATE subscriptions SET current_invoice_id = $1 WHERE id = $2`, [invId, subId]);

    // Charge attempts
    for (let a = 0; a < retryCount; a++) {
      await c.query(
        `INSERT INTO charge_attempts (id, invoice_id, merchant_id, attempted_at, status, reason)
         VALUES ($1, $2, $3, $4, 'failed', $5) ON CONFLICT DO NOTHING`,
        [`ch_cascade_${String(i + 1).padStart(3, '0')}_${a + 1}`, invId, MID, daysAgo(rng(1, 8)), lastFailure]
      );
    }
  }
  cursor += 10;
  console.log('  10 cascade subs created');

  // ── PAYMENT METHODS ──
  console.log('Creating payment methods...');
  const brands = ['visa', 'mastercard', 'verve'];
  for (let i = 0; i < 255; i++) {
    await c.query(
      `INSERT INTO payment_methods (id, merchant_id, customer_id, type, nomba_token, last4, brand, is_default, exp_month, exp_year, created_at)
       VALUES ($1, $2, $3, 'card', $4, $5, $6, true, $7, $8, NOW())`,
      [uid(), MID, customers[i], `tok_demo_${i}`, String(rng(1000, 9999)), pick(brands), rng(1, 12), rng(27, 30)]
    );
  }
  // ~30% second cards
  const secondCardIndices = [];
  const used = new Set();
  while (secondCardIndices.length < 75) {
    const idx = rng(0, 254);
    if (!used.has(idx)) { used.add(idx); secondCardIndices.push(idx); }
  }
  for (const i of secondCardIndices) {
    await c.query(
      `INSERT INTO payment_methods (id, merchant_id, customer_id, type, nomba_token, last4, brand, is_default, exp_month, exp_year, created_at)
       VALUES ($1, $2, $3, 'card', $4, $5, $6, false, $7, $8, NOW())`,
      [uid(), MID, customers[i], `tok_demo_${i}_b`, String(rng(1000, 9999)), pick(brands), rng(1, 12), rng(27, 30)]
    );
  }
  console.log(`  255 primary + 75 secondary cards`);

  // ── INVOICE HISTORY ──
  console.log('Generating 6 months of invoice history...');
  const subsResult = await c.query(`SELECT id, plan_id, state, current_period_start FROM subscriptions WHERE merchant_id = $1`, [MID]);
  const subs = subsResult.rows;
  let invoiceCount = 0;
  for (const sub of subs) {
    if (sub.state === 'trialing') continue;
    const started = new Date(sub.current_period_start);
    const now = new Date();
    const monthsActive = Math.max(1, (now.getFullYear() - started.getFullYear()) * 12 + (now.getMonth() - started.getMonth()));
    const amount = planAmounts[sub.plan_id] || 990000;

    for (let m = 0; m < monthsActive; m++) {
      const due = new Date(started); due.setDate(due.getDate() + 30 * m);
      const paid = new Date(due); paid.setDate(paid.getDate() + 1);
      const invId = `inv_${sub.id.slice(0, 8)}_${m}`;
      const r = Math.random();
      let invStatus, paidAt;
      if (r < 0.95) { invStatus = 'paid'; paidAt = paid.toISOString().replace('T', ' ').slice(0, 19); }
      else if (r < 0.965) { invStatus = 'uncollectible'; paidAt = null; }
      else { invStatus = 'pending_retry'; paidAt = null; }

      const dueStr = due.toISOString().replace('T', ' ').slice(0, 19);
      await c.query(
        `INSERT INTO invoices (id, subscription_id, merchant_id, amount, currency, status, due_date, paid_at, created_at)
         VALUES ($1, $2, $3, $4, 'NGN', $5, $6, $7, $6) ON CONFLICT DO NOTHING`,
        [invId, sub.id, MID, amount, invStatus, dueStr, paidAt]
      );
      invoiceCount++;
    }
  }
  console.log(`  ${invoiceCount} invoices generated`);

  // ── VERIFY ──
  const subCount = await c.query(`SELECT state, COUNT(*) as c FROM subscriptions WHERE merchant_id = $1 GROUP BY state`, [MID]);
  const invStats = await c.query(`SELECT status, COUNT(*) as c FROM invoices WHERE merchant_id = $1 GROUP BY status`, [MID]);
  const custCount = await c.query(`SELECT COUNT(*) as c FROM customers WHERE merchant_id = $1`, [MID]);
  const planCount = await c.query(`SELECT COUNT(*) as c FROM plans WHERE merchant_id = $1`, [MID]);

  console.log('\n' + '='.repeat(50));
  console.log('  FITCORE NIGERIA — PRODUCTION SEED COMPLETE');
  console.log('='.repeat(50));
  console.log(`  Merchant:    ${MID}`);
  console.log(`  Customers:   ${custCount.rows[0].c}`);
  console.log(`  Plans:       ${planCount.rows[0].c}`);
  console.log(`  Subscriptions:`);
  for (const row of subCount.rows) console.log(`    ${row.state}: ${row.c}`);
  console.log(`  Invoices:`);
  for (const row of invStats.rows) console.log(`    ${row.status}: ${row.c}`);
  console.log(`  API Key:     ${API_KEY}`);
  console.log('='.repeat(50));

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
