// Test script — validates Nomba sandbox connectivity.
// Run: cd services/engine && npx tsx scripts/test-nomba-sandbox.ts

import { RealNombaClient } from '../src/rails/real-nomba-client.js';

const client = new RealNombaClient({
  clientId: process.env.NOMBA_CLIENT_ID!,
  clientSecret: process.env.NOMBA_CLIENT_SECRET!,
  accountId: process.env.NOMBA_ACCOUNT_ID!,
  baseUrl: process.env.NOMBA_BASE_URL ?? 'https://sandbox.api.nomba.com',
});

async function main() {
  console.log('=== 1. TEST CHARGE (SUCCESS CARD) ===');
  try {
    const result = await client.chargeCard({
      token: 'tok_test_success',
      amount: 2500,
      currency: 'NGN',
      customerId: 'cus_test_001',
      merchantTxRef: `test-charge-${Date.now()}`,
    });
    console.log('  Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.log('  Error:', (err as Error).message);
  }

  console.log('\n=== 2. TEST CHARGE (DECLINE CARD) ===');
  try {
    const result = await client.chargeCard({
      token: 'tok_test_decline',
      amount: 1500,
      currency: 'NGN',
      customerId: 'cus_test_002',
      merchantTxRef: `test-decline-${Date.now()}`,
    });
    console.log('  Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.log('  Error:', (err as Error).message);
  }

  console.log('\n=== 3. TEST CREATE VIRTUAL ACCOUNT ===');
  try {
    const result = await client.createVirtualAccount({
      amount: 5000,
      currency: 'NGN',
      reference: `test-va-${Date.now()}`,
      expiresInDays: 7,
      beneficiaryName: 'RailSwitch Test',
    });
    console.log('  Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.log('  Error:', (err as Error).message);
  }

  console.log('\n=== 4. TEST BANK LOOKUP ===');
  try {
    const result = await client.lookupBankAccount('044', '0000000000');
    console.log('  Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.log('  Error:', (err as Error).message);
  }

  console.log('\n=== 5. TEST USSD (expected to fail) ===');
  try {
    await client.triggerUSSD({ amount: 1000, currency: 'NGN', reference: 'test', customerBankCode: '044', customerPhone: '08012345678' });
    console.log('  UNEXPECTED: USSD succeeded');
  } catch (err) {
    console.log('  Expected error:', (err as Error).message);
  }

  console.log('\n=== ALL TESTS COMPLETE ===');
}

main().catch(console.error);
