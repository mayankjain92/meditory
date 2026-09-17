import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { loginHandler, meHandler } from './handlers/auth.js';
import { inventoryHandler } from './handlers/inventory.js';
import { dispenseHandler } from './handlers/dispense.js';
import { restockHandler } from './handlers/restock.js';
import { locatorHandler } from './handlers/locator.js';
import { auditHandler } from './handlers/audit.js';

function createMockEvent(options: {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  cookies?: string[];
  queryStringParameters?: Record<string, string>;
}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `${options.method} ${options.path}`,
    rawPath: options.path,
    rawQueryString: '',
    headers: options.headers || {},
    cookies: options.cookies,
    queryStringParameters: options.queryStringParameters,
    body: options.body ? JSON.stringify(options.body) : undefined,
    isBase64Encoded: false,
    requestContext: {
      accountId: 'local',
      apiId: 'mock-api',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: options.method,
        path: options.path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'req-test',
      routeKey: `${options.method} ${options.path}`,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
  };
}

async function runTests() {
  console.log(`\n======================================================`);
  console.log(`🧪 [Meditory Test Suite] Running End-to-End Handler Tests`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // --- 1. AUTHENTICATION TESTS ---
  console.log(`\n[Group 1: Authentication & JWT Cookies]`);

  // Test 1.1: Valid Login
  const loginEvent = createMockEvent({
    method: 'POST',
    path: '/auth/login',
    body: { email: 'rahul.sharma@phc-alibag.in', password: 'Password@123' },
  });
  const loginRes = await loginHandler(loginEvent);
  const loginData = JSON.parse(loginRes.body);

  assert(loginRes.statusCode === 200, 'Valid login returns HTTP 200');
  assert(!!loginData.token, 'Login returns signed JWT token');
  assert(loginData.facility.id === 'PHC-ALIBAG-01', 'Login assigns correct clinic facility (PHC-ALIBAG-01)');
  assert(
    loginRes.headers['Set-Cookie']?.includes('HttpOnly') && loginRes.headers['Set-Cookie']?.includes('meditory_session'),
    'Login sets HttpOnly meditory_session cookie'
  );

  const token = loginData.token;
  const cookieString = `meditory_session=${token}`;

  // Test 1.2: Invalid Password
  const badLoginEvent = createMockEvent({
    method: 'POST',
    path: '/auth/login',
    body: { email: 'rahul.sharma@phc-alibag.in', password: 'WrongPassword' },
  });
  const badLoginRes = await loginHandler(badLoginEvent);
  assert(badLoginRes.statusCode === 401, 'Invalid password returns HTTP 401 Unauthorized');

  // Test 1.3: Profile via Cookie
  const meEvent = createMockEvent({
    method: 'GET',
    path: '/auth/me',
    headers: { cookie: cookieString },
  });
  const meRes = await meHandler(meEvent);
  const meData = JSON.parse(meRes.body);
  assert(meRes.statusCode === 200, 'GET /auth/me returns HTTP 200 via HttpOnly cookie');
  assert(meData.user.name === 'Dr. Rahul Sharma', 'GET /auth/me returns correct user profile');

  // --- 2. CLINIC-TO-CLINIC ISOLATION & INVENTORY TESTS ---
  console.log(`\n[Group 2: Clinic Isolation & Inventory Management]`);

  // Test 2.1: View Own Clinic Inventory
  const invEvent = createMockEvent({
    method: 'GET',
    path: '/clinic/inventory',
    headers: { authorization: `Bearer ${token}` },
  });
  const invRes = await inventoryHandler(invEvent);
  const invData = JSON.parse(invRes.body);
  assert(invRes.statusCode === 200, 'GET /clinic/inventory returns HTTP 200');
  assert(invData.items.length === 6, 'Alibag PHC has 6 shelf items');
  assert(invData.items[0].tier === 'EMERGENCY', 'Inventory properly sorts EMERGENCY drugs to the top');

  // Test 2.2: Cross-Clinic Tampering Attempt (Security Boundary)
  const tamperEvent = createMockEvent({
    method: 'GET',
    path: '/clinic/inventory',
    headers: { authorization: `Bearer ${token}` },
    queryStringParameters: { facilityId: 'PHC-VADKHAL-02' },
  });
  const tamperRes = await inventoryHandler(tamperEvent);
  assert(tamperRes.statusCode === 403, 'Attempting to query other clinic returns HTTP 403 Forbidden (FR-8)');

  // --- 3. FLEXIBLE DISPENSING TESTS (CUSTOM INPUT & RACE CONDITIONS) ---
  console.log(`\n[Group 3: Flexible Dispensing & Atomic Condition Expressions]`);

  // Test 3.1: 1-Tap Dispense (-1) on Anti-Rabies Vaccine
  const dispenseSingleEvent = createMockEvent({
    method: 'POST',
    path: '/clinic/dispense',
    headers: { authorization: `Bearer ${token}` },
    body: { drugId: 'DRUG-ARV-02' }, // quantity omitted, defaults to 1
  });
  const dispenseSingleRes = await dispenseHandler(dispenseSingleEvent);
  const dispenseSingleData = JSON.parse(dispenseSingleRes.body);
  assert(dispenseSingleRes.statusCode === 200, '1-tap dispense (-1) returns HTTP 200');
  assert(dispenseSingleData.newQuantity === 13, 'Stock decremented by 1 (14 -> 13)');
  assert(dispenseSingleData.auditEntry.delta === -1, 'Audit log recorded delta of -1');

  // Test 3.2: Custom Quantity Dispense (-10) on Paracetamol
  const dispenseBatchEvent = createMockEvent({
    method: 'POST',
    path: '/clinic/dispense',
    headers: { authorization: `Bearer ${token}` },
    body: { drugId: 'DRUG-PCM-04', quantity: 10 },
  });
  const dispenseBatchRes = await dispenseHandler(dispenseBatchEvent);
  const dispenseBatchData = JSON.parse(dispenseBatchRes.body);
  assert(dispenseBatchRes.statusCode === 200, 'Custom quantity dispense (-10) returns HTTP 200');
  assert(dispenseBatchData.newQuantity === 440, 'Stock decremented by 10 (450 -> 440)');

  // Test 3.3: Preventing Negative Stock / Insufficient Stock Overdraft
  const overdraftEvent = createMockEvent({
    method: 'POST',
    path: '/clinic/dispense',
    headers: { authorization: `Bearer ${token}` },
    body: { drugId: 'DRUG-ASV-01', quantity: 1 }, // Stock is 0!
  });
  const overdraftRes = await dispenseHandler(overdraftEvent);
  assert(overdraftRes.statusCode === 400, 'Dispensing exceeding available stock is blocked with HTTP 400');

  // Test 3.4: Cross-Clinic Dispensing Tamper Attempt
  const crossDispenseEvent = createMockEvent({
    method: 'POST',
    path: '/clinic/dispense',
    headers: { authorization: `Bearer ${token}` },
    body: { drugId: 'DRUG-PCM-04', quantity: 1, facilityId: 'PHC-VADKHAL-02' },
  });
  const crossDispenseRes = await dispenseHandler(crossDispenseEvent);
  assert(crossDispenseRes.statusCode === 403, 'Cross-clinic dispense attempt returns HTTP 403 Forbidden');

  // --- 4. AUDIT LOG & RESTOCK TESTS ---
  console.log(`\n[Group 4: Audit Trail & Restocking]`);

  // Test 4.1: Restock Paracetamol (+50)
  const restockEvent = createMockEvent({
    method: 'POST',
    path: '/clinic/restock',
    headers: { authorization: `Bearer ${token}` },
    body: { drugId: 'DRUG-PCM-04', quantity: 50 },
  });
  const restockRes = await restockHandler(restockEvent);
  const restockData = JSON.parse(restockRes.body);
  assert(restockRes.statusCode === 200, 'Restock (+50) returns HTTP 200');
  assert(restockData.newQuantity === 490, 'Stock increased by 50 (440 -> 490)');

  // Test 4.2: Audit Trail Timeline
  const auditEvent = createMockEvent({
    method: 'GET',
    path: '/clinic/audit',
    headers: { authorization: `Bearer ${token}` },
  });
  const auditRes = await auditHandler(auditEvent);
  const auditData = JSON.parse(auditRes.body);
  assert(auditRes.statusCode === 200, 'GET /clinic/audit returns HTTP 200');
  assert(auditData.logs.length >= 2, 'Audit log contains recent dispense and restock events');
  assert(auditData.logs[0].action === 'RESTOCK', 'Most recent audit log is the restock event');

  // --- 5. INTER-CLINIC EMERGENCY REFERRAL LOCATOR ---
  console.log(`\n[Group 5: Inter-Clinic Referral Locator]`);

  // Test 5.1: Locating Anti-Snake Venom when Alibag stock is 0
  const locatorEvent = createMockEvent({
    method: 'GET',
    path: '/network/stock-locator',
    headers: { authorization: `Bearer ${token}` },
    queryStringParameters: { drugId: 'DRUG-ASV-01' },
  });
  const locatorRes = await locatorHandler(locatorEvent);
  const locatorData = JSON.parse(locatorRes.body);
  assert(locatorRes.statusCode === 200, 'GET /network/stock-locator returns HTTP 200');
  assert(locatorData.localQuantity === 0, 'Correctly identifies local clinic stock is 0');
  assert(locatorData.results.length === 2, 'Returns 2 neighboring clinics with registered ASV data');
  assert(locatorData.results[0].facilityId === 'CHC-PEN-03', 'Top referral choice is Pen CHC (25 vials, IN_STOCK)');
  assert(locatorData.results[0].phone === '+91 2143 252030', 'Includes direct phone contact for emergency referral');

  console.log(`\n======================================================`);
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(`Unhandled test suite error:`, err);
  process.exit(1);
});
