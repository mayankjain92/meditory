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
  console.log('--- 1. Testing GET /api/clinic/doctors ---');
  const docRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/clinic/doctors',
    method: 'GET'
  });
  console.log('Status:', docRes.statusCode);
  console.log('Current Facility:', docRes.data.currentFacility?.name, '| Location:', docRes.data.currentFacility?.address);
  console.log('Doctor Count:', docRes.data.doctors?.length);
  docRes.data.doctors?.forEach((d, idx) => {
    console.log(`  ${idx + 1}. ${d.name} (${d.facilityName}) -> Location: ${d.facilityAddress}`);
  });

  console.log('\n--- 2. Login as Dr. Rahul Sharma ---');
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
  console.log('Login Status:', loginRes.statusCode, '| Cookie set:', !!cookie);

  console.log('\n--- 3. Dispensing to Dr. Anjali Deshmukh with Clinic & Location attribution ---');
  const selectedDoc = docRes.data.doctors?.find(d => d.name.includes('Anjali')) || docRes.data.doctors?.[0];
  const attribution = `${selectedDoc.name} • ${selectedDoc.facilityName} (${selectedDoc.facilityAddress})`;
  
  const dispRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/clinic/dispense',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    }
  }, JSON.stringify({
    drugId: 'DRUG-PCM-04',
    quantity: 5,
    dispensedTo: attribution,
    patientName: selectedDoc.name,
    notes: 'Prescription Ref #RX-ALIBAG-902'
  }));
  console.log('Dispense Status:', dispRes.statusCode, dispRes.data);

  console.log('\n--- 4. Checking Audit Log for Dispensed To Attribution ---');
  const auditRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/clinic/audit',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log('Audit Log Status:', auditRes.statusCode);
  const latestLog = auditRes.data?.logs?.[0];
  console.log('Latest Log Action:', latestLog?.action);
  console.log('Latest Log Dispensed To:', latestLog?.dispensedTo);
  console.log('Latest Log Medicine:', latestLog?.drugName, 'Delta:', latestLog?.delta);
  console.log('\n✅ Verification Complete!');
}

run().catch(console.error);
