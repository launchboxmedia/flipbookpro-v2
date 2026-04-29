/* One-shot setup: creates the two FlipBookPro products and four prices in
 * Stripe (live or test, depending on which key is in STRIPE_SECRET_KEY).
 * Idempotent: re-runs reuse existing products/prices by name + amount.
 *
 * Run with: node scripts/stripe-setup.js
 */

require('dotenv').config({ path: '.env.local' })
const Stripe = require('stripe')

// `node scripts/stripe-setup.js --test` reads STRIPE_SECRET_KEY_TEST instead
// of the default live key. This keeps a single idempotent script for both
// modes — the same products/prices get created in whichever account the key
// belongs to.
const useTest = process.argv.includes('--test')
const keyName = useTest ? 'STRIPE_SECRET_KEY_TEST' : 'STRIPE_SECRET_KEY'
const apiKey = process.env[keyName]
if (!apiKey) {
  console.error(`FATAL: ${keyName} is not set in .env.local`)
  process.exit(1)
}

const stripe = new Stripe(apiKey, {
  apiVersion: '2026-03-25.dahlia',
})

async function findOrCreateProduct(name, description) {
  // Look up by name across active products
  const list = await stripe.products.list({ limit: 100, active: true })
  const found = list.data.find((p) => p.name === name)
  if (found) {
    console.log(`  product reused: ${name} (${found.id})`)
    return found
  }
  const created = await stripe.products.create({ name, description })
  console.log(`  product created: ${name} (${created.id})`)
  return created
}

async function findOrCreatePrice({ product, unit_amount, interval, nickname, lookup_key }) {
  // Use lookup_key for idempotency — Stripe enforces uniqueness on it
  if (lookup_key) {
    const list = await stripe.prices.list({ lookup_keys: [lookup_key], active: true, limit: 1 })
    if (list.data.length > 0) {
      const found = list.data[0]
      console.log(`  price reused: ${nickname} (${found.id}) [${lookup_key}]`)
      return found
    }
  }
  const created = await stripe.prices.create({
    product: product.id,
    unit_amount,
    currency: 'usd',
    recurring: { interval },
    nickname,
    lookup_key,
  })
  console.log(`  price created: ${nickname} (${created.id}) [${lookup_key}]`)
  return created
}

async function main() {
  // Confirm key mode + account. Detect from the key prefix of the actual key
  // we're using for THIS run, not from the live env var.
  const acct = await stripe.accounts.retrieve()
  const livemode = apiKey.startsWith('sk_live_')
  console.log(`\nStripe account ${acct.id} (${acct.country}) — ${livemode ? 'LIVE' : 'TEST'} mode\n`)

  console.log('Products:')
  const standard = await findOrCreateProduct(
    'FlipBookPro Standard',
    'Standard plan: 3 books per month, up to 8 chapters per book, all export formats, lead capture, priority support.',
  )
  const pro = await findOrCreateProduct(
    'FlipBookPro Pro',
    'Pro plan: 10 books per month, up to 15 chapters per book, Stripe Connect book sales, brand identity, Telegram notifications.',
  )

  console.log('\nPrices:')
  const stdMo = await findOrCreatePrice({
    product: standard, unit_amount: 900, interval: 'month',
    nickname: 'Standard Monthly', lookup_key: 'flipbookpro_standard_monthly',
  })
  const stdYr = await findOrCreatePrice({
    product: standard, unit_amount: 7900, interval: 'year',
    nickname: 'Standard Yearly', lookup_key: 'flipbookpro_standard_yearly',
  })
  const proMo = await findOrCreatePrice({
    product: pro, unit_amount: 4900, interval: 'month',
    nickname: 'Pro Monthly', lookup_key: 'flipbookpro_pro_monthly',
  })
  const proYr = await findOrCreatePrice({
    product: pro, unit_amount: 39900, interval: 'year',
    nickname: 'Pro Yearly', lookup_key: 'flipbookpro_pro_yearly',
  })

  const suffix = useTest ? '_TEST' : ''
  console.log('\n# Add these to .env.local')
  console.log(`STRIPE_PRICE_STANDARD_MONTHLY${suffix}=${stdMo.id}`)
  console.log(`STRIPE_PRICE_STANDARD_YEARLY${suffix}=${stdYr.id}`)
  console.log(`STRIPE_PRICE_PRO_MONTHLY${suffix}=${proMo.id}`)
  console.log(`STRIPE_PRICE_PRO_YEARLY${suffix}=${proYr.id}`)

  // Emit machine-parseable JSON last for the harness to capture
  console.log('---JSON---')
  console.log(JSON.stringify({
    mode: livemode ? 'live' : 'test',
    accountId: acct.id,
    productStandard: standard.id,
    productPro: pro.id,
    priceStandardMonthly: stdMo.id,
    priceStandardYearly:  stdYr.id,
    priceProMonthly:      proMo.id,
    priceProYearly:       proYr.id,
  }, null, 2))
}

main().catch((err) => {
  console.error('FATAL', err.type ?? err.name, '|', err.message)
  process.exit(1)
})
