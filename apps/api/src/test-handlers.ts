import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { loginHandler, meHandler } from './handlers/auth.js';
import { inventoryHandler } from './handlers/inventory.js';
import { dispenseHandler } from './handlers/dispense.js';
import { restockHandler } from './handlers/restock.js';
import { locatorHandler } from './handlers/locator.js';
import { auditHandler } from './handlers/audit.js';
import {
  createRequisitionHandler,
  getRequisitionsHandler,
  respondRequisitionHandler,
  handshakeDispenseHandler,
  confirmIntakeHandler,
} from './handlers/requisitions.js';
import { syncBatchHandler } from './handlers/sync.js';
import { doctorsHandler } from './handlers/doctors.js';
import {
  registerFacilityHandler,
  getPendingRegistrationsHandler,
  approveRegistrationHandler,
  rejectRegistrationHandler,
} from './handlers/registration.js';
import { runSeed } from './seeds/seed-data.js';

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

  // Ensure fresh baseline data before test assertions
  await runSeed();

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

  // Test 2.3: Unauthenticated Access to /clinic/inventory (Auth Bypass Prevention)
  const unauthInvEvent = createMockEvent({
    method: 'GET',
    path: '/clinic/inventory',
  });
  const unauthInvRes = await inventoryHandler(unauthInvEvent);
  assert(unauthInvRes.statusCode === 401, 'Unauthenticated request to /clinic/inventory returns HTTP 401 Unauthorized (Auth Bypass Patched)');

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

  // Test 3.5: Attempting to Dispense to Unverified/Walk-in without attribution is Blocked
  const walkinDispenseEvent = createMockEvent({
    method: 'POST',
    path: '/clinic/dispense',
    headers: { authorization: `Bearer ${token}` },
    body: {
      drugId: 'DRUG-PCM-04',
      quantity: 1,
      dispensedTo: 'walk-in',
    },
  });
  const walkinDispenseRes = await dispenseHandler(walkinDispenseEvent);
  assert(
    walkinDispenseRes.statusCode === 400,
    'Dispensing to unverified walk-in is blocked with HTTP 400'
  );

  // Test 3.6: In-Clinic Internal Consumption (Emergency Triage / Ward Patient Treatment)
  const inClinicDispenseEvent = createMockEvent({
    method: 'POST',
    path: '/clinic/dispense',
    headers: { authorization: `Bearer ${token}` },
    body: {
      drugId: 'DRUG-PCM-04',
      quantity: 5,
      dispensedTo: 'Internal Clinic Use - Emergency Triage (Pen PHC)',
      notes: 'ER-Bite-Protocol-491',
    },
  });
  const inClinicDispenseRes = await dispenseHandler(inClinicDispenseEvent);
  const inClinicData = JSON.parse(inClinicDispenseRes.body);
  assert(inClinicDispenseRes.statusCode === 200, 'In-clinic internal consumption returns HTTP 200');
  assert(inClinicData.newQuantity === 435, 'Stock correctly decremented by 5 for internal consumption (440 -> 435)');
  assert(
    inClinicData.auditEntry.dispensedTo === 'Internal Clinic Use - Emergency Triage (Pen PHC)',
    'Audit log attributes internal clinic emergency room usage'
  );

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
  assert(restockData.newQuantity === 485, 'Stock increased by 50 (435 -> 485)');

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
  assert(locatorData.results.length >= 2, 'Returns 2 neighboring clinics with registered ASV data');
  assert(locatorData.results[0].facilityId === 'CHC-PEN-03', 'Top referral choice is Pen CHC (25 vials, IN_STOCK)');
  assert(locatorData.results[0].phone === '+91 2143 252030', 'Includes direct phone contact for emergency referral');

  // --- 6. TWO-WAY HANDSHAKE INTER-CLINIC REQUISITION PROTOCOL ---
  console.log(`\n[Group 6: Two-Way Handshake Inter-Clinic Requisitions]`);

  // Login as Pen CHC Worker
  const penLoginEvent = createMockEvent({
    method: 'POST',
    path: '/auth/login',
    body: { email: 'amit.patil@chc-pen.in', password: 'Password@123' },
  });
  const penLoginRes = await loginHandler(penLoginEvent);
  const penLoginData = JSON.parse(penLoginRes.body);
  const penToken = penLoginData.token;
  assert(!!penToken, 'Pen CHC staff login succeeds with JWT');

  // Test 6.1: Alibag creates requisition for 2 vials of ASV from Pen CHC
  const createReqEvent = createMockEvent({
    method: 'POST',
    path: '/requisitions/request',
    headers: { authorization: `Bearer ${token}` },
    body: {
      donorFacilityId: 'CHC-PEN-03',
      drugId: 'DRUG-ASV-01',
      quantity: 2,
      urgency: 'EMERGENCY',
      patientNotes: 'Urgent venom bite transfer',
    },
  });
  const createReqRes = await createRequisitionHandler(createReqEvent);
  const createReqData = JSON.parse(createReqRes.body);
  assert(createReqRes.statusCode === 201, 'Alibag creates requisition: HTTP 201 Created');
  assert(createReqData.requisition.status === 'PENDING', 'Requisition created in PENDING status');
  assert(createReqData.requisition.quantity === 2, 'Requisition quantity is 2 vials');
  const reqId = createReqData.requisition.id;

  // Test 6.2: Clinic boundary check: Requester cannot approve their own requisition
  const badApproveEvent = createMockEvent({
    method: 'POST',
    path: '/requisitions/respond',
    headers: { authorization: `Bearer ${token}` },
    body: { requisitionId: reqId, action: 'APPROVE' },
  });
  const badApproveRes = await respondRequisitionHandler(badApproveEvent);
  assert(badApproveRes.statusCode === 403, 'Requester cannot approve their own requisition: HTTP 403 Forbidden');

  // Test 6.3: Pen CHC approves requisition & generates 6-digit Handshake PIN
  const approveEvent = createMockEvent({
    method: 'POST',
    path: '/requisitions/respond',
    headers: { authorization: `Bearer ${penToken}` },
    body: { requisitionId: reqId, action: 'APPROVE' },
  });
  const approveRes = await respondRequisitionHandler(approveEvent);
  const approveData = JSON.parse(approveRes.body);
  assert(approveRes.statusCode === 200, 'Pen CHC approves requisition: HTTP 200 OK');
  assert(approveData.requisition.status === 'APPROVED', 'Requisition transitioned to APPROVED');
  const handshakePin = approveData.requisition.handshakePin;
  assert(typeof handshakePin === 'string' && handshakePin.length === 6, 'Generated valid 6-digit Handshake PIN');

  // Test 6.4: Handshake dispense fails with invalid PIN
  const badHandshakeEvent = createMockEvent({
    method: 'POST',
    path: '/requisitions/handshake-dispense',
    headers: { authorization: `Bearer ${penToken}` },
    body: { requisitionId: reqId, handshakePin: '000000' },
  });
  const badHandshakeRes = await handshakeDispenseHandler(badHandshakeEvent);
  assert(badHandshakeRes.statusCode === 400, 'Handshake dispense with wrong PIN returns HTTP 400 Bad Request');

  // Test 6.5: Handshake dispense succeeds with correct PIN (Pen stock 25 -> 23, status -> IN_TRANSIT)
  const goodHandshakeEvent = createMockEvent({
    method: 'POST',
    path: '/requisitions/handshake-dispense',
    headers: { authorization: `Bearer ${penToken}` },
    body: { requisitionId: reqId, handshakePin },
  });
  const goodHandshakeRes = await handshakeDispenseHandler(goodHandshakeEvent);
  const goodHandshakeData = JSON.parse(goodHandshakeRes.body);
  assert(goodHandshakeRes.statusCode === 200, 'Handshake dispense succeeds: HTTP 200 OK');
  assert(goodHandshakeData.requisition.status === 'IN_TRANSIT', 'Requisition transitioned to IN_TRANSIT');
  assert(goodHandshakeData.newDonorQuantity === 23, 'Pen CHC stock decremented from 25 to 23');

  // Test 6.6: Alibag confirms intake upon arrival (Alibag stock 0 -> 2, status -> COMPLETED)
  const intakeEvent = createMockEvent({
    method: 'POST',
    path: '/requisitions/confirm-intake',
    headers: { authorization: `Bearer ${token}` },
    body: { requisitionId: reqId },
  });
  const intakeRes = await confirmIntakeHandler(intakeEvent);
  const intakeData = JSON.parse(intakeRes.body);
  assert(intakeRes.statusCode === 200, 'Alibag confirms intake: HTTP 200 OK');
  assert(intakeData.requisition.status === 'COMPLETED', 'Requisition transitioned to COMPLETED');
  assert(intakeData.newLocalQuantity === 2, 'Alibag shelf stock incremented from 0 to 2 vials');

  // Test 6.7: Query requisitions for Alibag and Pen CHC
  const getReqsEvent = createMockEvent({
    method: 'GET',
    path: '/requisitions',
    headers: { authorization: `Bearer ${token}` },
  });
  const getReqsRes = await getRequisitionsHandler(getReqsEvent);
  const getReqsData = JSON.parse(getReqsRes.body);
  assert(getReqsRes.statusCode === 200, 'GET /requisitions returns HTTP 200');
  assert(getReqsData.outgoing.length >= 1, 'Alibag outgoing requisitions contains completed transfer');

  // --- 7. OFFLINE-FIRST ENGINE & BATCH REPLAY SYNC ---
  console.log(`\n[Group 7: Offline-First Engine & Batch Sync]`);

  // Test 7.1: Batch sync of multiple offline actions
  const offlineAction1Id = `act-${Date.now()}-01`;
  const offlineAction2Id = `act-${Date.now()}-02`;
  const offlineAction3Id = `act-${Date.now()}-03`;

  const syncEvent = createMockEvent({
    method: 'POST',
    path: '/clinic/sync-batch',
    headers: { authorization: `Bearer ${token}` },
    body: {
      actions: [
        {
          clientActionId: offlineAction1Id,
          action: 'DISPENSE',
          drugId: 'DRUG-PCM-04',
          quantity: 5,
          patientName: 'Offline OPD Patient 1',
          timestamp: new Date().toISOString(),
        },
        {
          clientActionId: offlineAction2Id,
          action: 'DISPENSE',
          drugId: 'DRUG-PCM-04',
          quantity: 15,
          patientName: 'Offline OPD Patient 2',
          timestamp: new Date().toISOString(),
        },
        {
          clientActionId: offlineAction3Id,
          action: 'RESTOCK',
          drugId: 'DRUG-PCM-04',
          quantity: 100,
          dispensedTo: 'Depot Challan #OFFLINE-01',
          timestamp: new Date().toISOString(),
        },
      ],
    },
  });
  const syncRes = await syncBatchHandler(syncEvent);
  const syncData = JSON.parse(syncRes.body);
  assert(syncRes.statusCode === 200, 'Batch sync returns HTTP 200');
  assert(syncData.success === true, 'Batch sync reported overall success');
  assert(syncData.syncedCount === 3, 'All 3 queued offline actions were synchronized');
  assert(syncData.results[0].success === true, 'Offline dispense 1 succeeded');
  assert(syncData.results[1].success === true, 'Offline dispense 2 succeeded');
  assert(syncData.results[2].success === true, 'Offline restock succeeded');
  assert(syncData.updatedInventory.length > 0, 'Returns fresh updated clinic inventory');

  // Test 7.2: Idempotency check: Replaying the same offline batch skips duplicate execution
  const replaySyncRes = await syncBatchHandler(syncEvent);
  const replayData = JSON.parse(replaySyncRes.body);
  assert(replaySyncRes.statusCode === 200, 'Replay batch sync returns HTTP 200');
  assert(replayData.syncedCount === 3, 'Replay recognized all 3 items without crashing');
  assert(
    replayData.results[0].error?.includes('idempotent replay skipped'),
    'Idempotency guard prevented double-deduction'
  );

  // Test 7.3: Conflict handling: Dispense exceeding stock reports error for that item without failing batch
  const conflictSyncEvent = createMockEvent({
    method: 'POST',
    path: '/clinic/sync-batch',
    headers: { authorization: `Bearer ${token}` },
    body: {
      actions: [
        {
          clientActionId: `act-excessive-${Date.now()}`,
          action: 'DISPENSE',
          drugId: 'DRUG-ASV-01',
          quantity: 9999, // Impossible quantity
          timestamp: new Date().toISOString(),
        },
      ],
    },
  });
  const conflictRes = await syncBatchHandler(conflictSyncEvent);
  const conflictData = JSON.parse(conflictRes.body);
  assert(conflictRes.statusCode === 200, 'Batch with conflicting action returns HTTP 200');
  assert(conflictData.results[0].success === false, 'Conflicting dispense was cleanly rejected with error');

  // Test 7.4: Emergency override token allows sync without 401
  const emergencySyncEvent = createMockEvent({
    method: 'POST',
    path: '/clinic/sync-batch',
    headers: { authorization: 'Bearer emergency_override_token' },
    body: {
      actions: [
        {
          clientActionId: `act-emergency-${Date.now()}`,
          action: 'RESTOCK',
          drugId: 'DRUG-PCM-04',
          quantity: 20,
          notes: 'Emergency duty intake',
          timestamp: new Date().toISOString(),
        },
      ],
    },
  });
  const emergencyRes = await syncBatchHandler(emergencySyncEvent);
  const emergencyData = JSON.parse(emergencyRes.body);
  assert(emergencyRes.statusCode === 200, 'Emergency override batch sync returns HTTP 200 (not 401)');
  assert(emergencyData.syncedCount === 1, 'Emergency queued action was synchronized');

  // =========================================================================
  // Group 8: Emergency Doctor & Clinic Phone Directory
  // =========================================================================
  console.log(`\n[Group 8: Emergency Doctor & Clinic Phone Directory]`);

  // Test 8.1: Unauthenticated Doctor Directory Call (Zero-Trust Guard)
  const unauthDocEvent = createMockEvent({
    method: 'GET',
    path: '/clinic/doctors',
  });
  const unauthDocRes = await doctorsHandler(unauthDocEvent);
  assert(
    unauthDocRes.statusCode === 401,
    'Unauthenticated GET /clinic/doctors rejected with HTTP 401 Unauthorized'
  );

  // Test 8.2: Authenticated Doctor Directory Query
  const docEvent = createMockEvent({
    method: 'GET',
    path: '/clinic/doctors',
    headers: { authorization: `Bearer ${token}` },
  });
  const docRes = await doctorsHandler(docEvent);
  const docData = JSON.parse(docRes.body);
  assert(docRes.statusCode === 200, 'Authenticated GET /clinic/doctors returns HTTP 200');
  assert(docData.currentFacility.name.includes('Alibag'), 'Identifies current logged-in facility');
  assert(docData.facilities.length >= 3, 'Returns registered network health facilities');
  assert(Array.isArray(docData.directory), 'Returns complete district directory array');
  assert(docData.directory.length >= 7, 'District directory contains medical staff across facilities');
  const penDoctor = docData.directory.find((d: any) => d.name === 'Dr. Amit Patil');
  assert(Boolean(penDoctor), 'Directory includes neighboring MOIC Dr. Amit Patil');
  assert(penDoctor?.facilityName.includes('Pen'), 'Pen doctor mapped to Pen Community Health Centre');
  assert(Boolean(penDoctor?.phone), 'Doctor record has direct emergency phone number');

  // =========================================================================
  // Group 9: Clinic Registration & District Admin Approval Workflow
  // =========================================================================
  console.log(`\n[Group 9: Clinic Registration & District Admin Approval Workflow]`);

  // Test 9.1: Clinic Self-Registration
  const testDoctorEmail = `kavita.verma.${Date.now()}@phc-roha.in`;
  const registerEvent = createMockEvent({
    method: 'POST',
    path: '/facilities/register',
    body: {
      name: 'Roha Primary Health Centre',
      type: 'PHC',
      districtName: 'Raigad',
      taluka: 'Roha',
      pinCode: '402109',
      address: 'Near Old Bus Stand, Roha City',
      phone: '+91 2144 222120',
      latitude: 18.4358,
      longitude: 73.1197,
      doctorName: 'Dr. Kavita Verma',
      doctorEmail: testDoctorEmail,
      doctorPhone: '+91 98231 44552',
      password: 'Password@123',
    },
  });
  const registerRes = await registerFacilityHandler(registerEvent);
  const registerData = JSON.parse(registerRes.body);
  assert(registerRes.statusCode === 201, 'POST /facilities/register returns HTTP 201 Created');
  assert(registerData.success === true, 'Clinic registered successfully');
  assert(registerData.facility.approvalStatus === 'PENDING', 'New clinic starts in PENDING approval status');
  const rohaFacilityId = registerData.registrationId;
  assert(Boolean(rohaFacilityId), 'Registration generates unique facilityId reference');
  assert(registerData.emailNotification?.sent === true, 'Submission confirmation email dispatched to registered clinic');

  // Test 9.2: Attempt Login Before Approval (Zero-Trust Guard)
  const preApprovalLoginEvent = createMockEvent({
    method: 'POST',
    path: '/auth/login',
    body: {
      email: testDoctorEmail,
      password: 'Password@123',
    },
  });
  const preApprovalLoginRes = await loginHandler(preApprovalLoginEvent);
  assert(
    preApprovalLoginRes.statusCode === 401,
    'Unapproved clinic doctor cannot log in (HTTP 401 Unauthorized)'
  );

  // Test 9.3a: Anonymous Caller Rejected from Admin Queue (Zero-Trust Guard)
  const anonAdminListEvent = createMockEvent({
    method: 'GET',
    path: '/admin/registrations',
  });
  const anonAdminListRes = await getPendingRegistrationsHandler(anonAdminListEvent);
  assert(
    anonAdminListRes.statusCode === 401,
    'Unauthenticated GET /admin/registrations rejected with HTTP 401 Unauthorized'
  );

  // Test 9.3b: Clinic Worker Blocked from Admin Queue (RBAC Guard)
  const workerAdminListEvent = createMockEvent({
    method: 'GET',
    path: '/admin/registrations',
    headers: { authorization: `Bearer ${token}` }, // role: 'facility_worker'
  });
  const workerAdminListRes = await getPendingRegistrationsHandler(workerAdminListEvent);
  assert(
    workerAdminListRes.statusCode === 403,
    'Clinic worker calling GET /admin/registrations blocked with HTTP 403 Forbidden'
  );

  // Test 9.3c: District Health Authority Admin Logs In
  const adminLoginEvent = createMockEvent({
    method: 'POST',
    path: '/auth/login',
    body: {
      email: 'admin@meditory.gov.in',
      password: 'Password@123',
    },
  });
  const adminLoginRes = await loginHandler(adminLoginEvent);
  const adminLoginData = JSON.parse(adminLoginRes.body);
  assert(adminLoginRes.statusCode === 200, 'District Admin logs in successfully with HTTP 200');
  assert(adminLoginData.user.role === 'admin', 'Admin user payload has role: "admin"');
  const adminToken = adminLoginData.token;
  assert(Boolean(adminToken), 'Admin receives signed JWT authorization token');

  // Test 9.3d: Authenticated District Admin Queries Pending Applications
  const adminListEvent = createMockEvent({
    method: 'GET',
    path: '/admin/registrations',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const adminListRes = await getPendingRegistrationsHandler(adminListEvent);
  const adminListData = JSON.parse(adminListRes.body);
  assert(adminListRes.statusCode === 200, 'Authenticated Admin GET /admin/registrations returns HTTP 200');
  assert(adminListData.pendingCount >= 1, 'Admin queue identifies at least 1 pending application');
  const rohaInQueue = adminListData.facilities.find((f: any) => f.id === rohaFacilityId);
  assert(Boolean(rohaInQueue), 'Roha PHC appears in Admin review queue');
  assert(rohaInQueue.approvalStatus === 'PENDING', 'Roha PHC status is PENDING');

  // Test 9.4a: Unauthenticated Clinic Approval Rejected
  const unauthApproveEvent = createMockEvent({
    method: 'POST',
    path: '/admin/registrations/approve',
    body: { facilityId: rohaFacilityId },
  });
  const unauthApproveRes = await approveRegistrationHandler(unauthApproveEvent);
  assert(
    unauthApproveRes.statusCode === 401,
    'Unauthenticated POST /admin/registrations/approve rejected with HTTP 401'
  );

  // Test 9.4b: Clinic Worker Approving Clinic Rejected (RBAC Guard)
  const workerApproveEvent = createMockEvent({
    method: 'POST',
    path: '/admin/registrations/approve',
    headers: { authorization: `Bearer ${token}` }, // role: 'facility_worker'
    body: { facilityId: rohaFacilityId },
  });
  const workerApproveRes = await approveRegistrationHandler(workerApproveEvent);
  assert(
    workerApproveRes.statusCode === 403,
    'Clinic worker calling POST /admin/registrations/approve blocked with HTTP 403 Forbidden'
  );

  // Test 9.4c: Authenticated District Admin Approves Clinic Registration
  const clinicApproveEvent = createMockEvent({
    method: 'POST',
    path: '/admin/registrations/approve',
    headers: { authorization: `Bearer ${adminToken}` },
    body: {
      facilityId: rohaFacilityId,
      remarks: 'Verified by Raigad Civil Surgeon',
      approvedBy: 'Dr. State Health Mission Admin',
    },
  });
  const clinicApproveRes = await approveRegistrationHandler(clinicApproveEvent);
  const clinicApproveData = JSON.parse(clinicApproveRes.body);
  assert(clinicApproveRes.statusCode === 200, 'Admin POST /admin/registrations/approve returns HTTP 200');
  assert(clinicApproveData.success === true, 'Admin approval succeeds');
  assert(clinicApproveData.status === 'APPROVED', 'Clinic status updated to APPROVED');
  assert(clinicApproveData.seededItemsCount >= 4, 'Starter emergency formulary automatically seeded');
  assert(clinicApproveData.emailNotification?.sent === true, 'Approval confirmation email dispatched to clinic doctor');

  // Test 9.5: Doctor Signs in Post-Approval
  const postApprovalLoginEvent = createMockEvent({
    method: 'POST',
    path: '/auth/login',
    body: {
      email: testDoctorEmail,
      password: 'Password@123',
    },
  });
  const postApprovalLoginRes = await loginHandler(postApprovalLoginEvent);
  const postApprovalLoginData = JSON.parse(postApprovalLoginRes.body);
  assert(postApprovalLoginRes.statusCode === 200, 'Approved clinic doctor signs in with HTTP 200');
  assert(Boolean(postApprovalLoginData.token), 'Doctor receives valid signed JWT token');
  assert(postApprovalLoginData.facility.id === rohaFacilityId, 'Assigned to newly approved Roha PHC');

  // Test 9.6: View Approved Clinic Shelf Inventory
  const rohaToken = postApprovalLoginData.token;
  const rohaInvEvent = createMockEvent({
    method: 'GET',
    path: '/clinic/inventory',
    headers: { authorization: `Bearer ${rohaToken}` },
  });
  const rohaInvRes = await inventoryHandler(rohaInvEvent);
  const rohaInvData = JSON.parse(rohaInvRes.body);
  assert(rohaInvRes.statusCode === 200, 'Approved clinic can view shelf inventory: HTTP 200');
  assert(rohaInvData.items.length >= 4, 'Roha PHC has starter formulary items provisioned');

  // Test 9.7: Reject Registration Pathway
  const rejectClinicRegEvent = createMockEvent({
    method: 'POST',
    path: '/facilities/register',
    body: {
      name: 'Test Incomplete Clinic',
      phone: '+91 2144 000000',
      doctorName: 'Dr. Dummy Doctor',
      doctorEmail: `dummy.${Date.now()}@clinic.in`,
      password: 'Password@123',
    },
  });
  const dummyRegRes = await registerFacilityHandler(rejectClinicRegEvent);
  const dummyRegData = JSON.parse(dummyRegRes.body);
  const dummyFacId = dummyRegData.registrationId;

  // Test 9.7a: Clinic Worker Attempting to Reject Registration Blocked
  const workerRejectEvent = createMockEvent({
    method: 'POST',
    path: '/admin/registrations/reject',
    headers: { authorization: `Bearer ${token}` }, // role: 'facility_worker'
    body: {
      facilityId: dummyFacId,
      rejectionReason: 'Invalid facility physical address provided.',
    },
  });
  const workerRejectRes = await rejectRegistrationHandler(workerRejectEvent);
  assert(
    workerRejectRes.statusCode === 403,
    'Clinic worker calling POST /admin/registrations/reject blocked with HTTP 403 Forbidden'
  );

  // Test 9.7b: Authenticated Admin Rejects Registration
  const rejectEvent = createMockEvent({
    method: 'POST',
    path: '/admin/registrations/reject',
    headers: { authorization: `Bearer ${adminToken}` },
    body: {
      facilityId: dummyFacId,
      rejectionReason: 'Invalid facility physical address provided.',
    },
  });
  const rejectRes = await rejectRegistrationHandler(rejectEvent);
  const rejectData = JSON.parse(rejectRes.body);
  assert(rejectRes.statusCode === 200, 'Admin POST /admin/registrations/reject returns HTTP 200');
  assert(rejectData.status === 'REJECTED', 'Application marked as REJECTED');

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
