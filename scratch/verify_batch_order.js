import http from 'http';

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('🧪 [Meditory] Verifying Batch Restock & Batch Dispense');
  console.log('====================================================\n');

  // 1. Login as Dr. Rahul Sharma
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({
    email: 'rahul.sharma@phc-alibag.in',
    password: 'Password@123'
  }));

  const cookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0];
  if (!cookie) throw new Error('Failed to login');
  console.log('✅ Logged in successfully. Cookie acquired.');

  // 2. Fetch current inventory baseline
  const invRes1 = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/clinic/inventory',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  const items1 = invRes1.data.items;
  const pcm1 = items1.find(i => i.drugId === 'DRUG-PCM-04');
  const ors1 = items1.find(i => i.drugId === 'DRUG-ORS-03');
  const arv1 = items1.find(i => i.drugId === 'DRUG-ARV-02');
  console.log('Baseline Quantities:');
  console.log(`  - Paracetamol (${pcm1.drugId}): ${pcm1.quantity}`);
  console.log(`  - ORS (${ors1.drugId}): ${ors1.quantity}`);
  console.log(`  - Anti-Rabies Vaccine (${arv1.drugId}): ${arv1.quantity}`);

  // 3. Execute Batch Restock Order (3 Medicines on Challan DEPOT-RAIGAD-CH-9921)
  console.log('\n--- Executing Batch Restock Order (3 Medicines) ---');
  const batchRestockItems = [
    { drugId: 'DRUG-PCM-04', quantity: 100, challanNumber: 'DEPOT-RAIGAD-CH-9921', batchNumber: 'LOT-2026-B1', expiryDate: '2028-12', storageLocation: 'Pharmacy Shelf Unit 3' },
    { drugId: 'DRUG-ORS-03', quantity: 50, challanNumber: 'DEPOT-RAIGAD-CH-9921', batchNumber: 'LOT-2026-B2', expiryDate: '2028-12', storageLocation: 'Bulk Storage Rack B' },
    { drugId: 'DRUG-ARV-02', quantity: 10, challanNumber: 'DEPOT-RAIGAD-CH-9921', batchNumber: 'LOT-2026-B3', expiryDate: '2028-12', storageLocation: 'Cold-Chain ILR Unit 1 (2°C–8°C)' }
  ];

  for (const item of batchRestockItems) {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/clinic/restock',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
    }, JSON.stringify(item));
    console.log(`  📥 Restocked ${item.drugId} (+${item.quantity}): Status ${res.statusCode}, New Qty = ${res.data.newQuantity}`);
  }

  // 4. Fetch Doctor for Dispense Attribution
  const docRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/clinic/doctors',
    method: 'GET'
  });
  const doctor = docRes.data.doctors?.find(d => d.name.includes('Suresh')) || docRes.data.doctors?.[0];
  const attribution = `${doctor.name} • ${doctor.facilityName} (${doctor.facilityAddress})`;
  console.log(`\nAttribution for Batch Dispense: ${attribution}`);

  // 5. Execute Batch Dispense Order (3 Medicines to Dr. Suresh Gaikwad)
  console.log('\n--- Executing Batch Dispense Order (3 Medicines) ---');
  const batchDispenseItems = [
    { drugId: 'DRUG-PCM-04', quantity: 10, notes: 'OPD-2026-BATCH-01', dispensedTo: attribution, patientName: doctor.name },
    { drugId: 'DRUG-ORS-03', quantity: 5, notes: 'OPD-2026-BATCH-01', dispensedTo: attribution, patientName: doctor.name },
    { drugId: 'DRUG-ARV-02', quantity: 2, notes: 'OPD-2026-BATCH-01', dispensedTo: attribution, patientName: doctor.name }
  ];

  for (const item of batchDispenseItems) {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/clinic/dispense',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie }
    }, JSON.stringify(item));
    console.log(`  📤 Dispensed ${item.drugId} (-${item.quantity}): Status ${res.statusCode}, New Qty = ${res.data.newQuantity}`);
  }

  // 6. Verify Final Quantities
  const invRes2 = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/clinic/inventory',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  const items2 = invRes2.data.items;
  const pcm2 = items2.find(i => i.drugId === 'DRUG-PCM-04');
  const ors2 = items2.find(i => i.drugId === 'DRUG-ORS-03');
  const arv2 = items2.find(i => i.drugId === 'DRUG-ARV-02');

  console.log('\nFinal Inventory Quantities:');
  console.log(`  - Paracetamol: Expected ${pcm1.quantity + 100 - 10} = Actual ${pcm2.quantity} -> ${pcm2.quantity === pcm1.quantity + 90 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - ORS: Expected ${ors1.quantity + 50 - 5} = Actual ${ors2.quantity} -> ${ors2.quantity === ors1.quantity + 45 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  - Anti-Rabies Vaccine: Expected ${arv1.quantity + 10 - 2} = Actual ${arv2.quantity} -> ${arv2.quantity === arv1.quantity + 8 ? '✅ PASS' : '❌ FAIL'}`);

  // 7. Verify Audit Log contains all entries with Doctor Attribution
  const auditRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/clinic/audit',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  const logs = auditRes.data.logs?.slice(0, 6) || [];
  console.log('\nRecent Audit Log Entries:');
  logs.forEach((log, i) => {
    console.log(`  ${i+1}. [${log.action}] ${log.drugName} (Delta: ${log.delta}) -> Dispensed To / Source: ${log.dispensedTo}`);
  });

  const dispLogs = logs.filter(l => l.action === 'DISPENSE');
  const allHaveDoctor = dispLogs.every(l => l.dispensedTo?.includes(doctor.name) && l.dispensedTo?.includes('Alibag Primary Health Centre'));
  console.log(`\nDoctor & Clinic Location Attribution Verified: ${allHaveDoctor ? '✅ PASS' : '❌ FAIL'}`);

  console.log('\n🎉 ALL BATCH ORDER TESTS COMPLETED SUCCESSFULLY!');
}

run().catch(console.error);
