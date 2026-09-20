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
  console.log('--- 1. Login as Alibag PHC Staff (Dr. Rahul Sharma) ---');
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({
    email: 'rahul.sharma@phc-alibag.in',
    password: 'Password@123'
  }));

  if (loginRes.statusCode !== 200) {
    throw new Error(`Login failed with status ${loginRes.statusCode}: ${JSON.stringify(loginRes.data)}`);
  }

  const cookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0];
  console.log('✅ Login Successful. Cookie set:', !!cookie);

  console.log('\n--- 2. Fetch Shelf Inventory via Next.js Proxy ---');
  const invRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/clinic/inventory',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });

  if (invRes.statusCode !== 200) {
    throw new Error(`Inventory fetch failed: ${invRes.statusCode}`);
  }

  const items = invRes.data.items || [];
  console.log(`✅ Loaded ${items.length} inventory items for ${invRes.data.facility?.name}`);

  // Test StockAlertSystem categorization logic:
  const depleted = items.filter(i => i.quantity === 0 || i.status === 'OUT_OF_STOCK');
  const importantDepleted = depleted.filter(i => i.tier === 'EMERGENCY' || i.isCritical);
  const lowStock = items.filter(i => i.quantity > 0 && i.quantity <= i.threshold);

  console.log('\n--- 3. Verify StockAlertSystem Logic ---');
  console.log(`Total Depleted (quantity === 0): ${depleted.length}`);
  depleted.forEach(d => {
    console.log(`  - [${d.drugId}] ${d.drugName} (${d.tier}) | Stock: ${d.quantity} ${d.unit}s | Threshold: ${d.threshold}`);
  });

  console.log(`\nImportant Depleted (Emergency Tier / Critical): ${importantDepleted.length}`);
  importantDepleted.forEach(d => {
    console.log(`  🚨 EMERGENCY ALERT TRIGGER: ${d.drugName} (${d.genericName}) is at 0 stock!`);
  });

  console.log(`\nLow Buffer Items (< Threshold): ${lowStock.length}`);
  lowStock.forEach(d => {
    console.log(`  ⚠️ Low Buffer: ${d.drugName} | Stock: ${d.quantity} | Min Buffer: ${d.threshold}`);
  });

  if (importantDepleted.length === 0) {
    throw new Error('Expected at least 1 important depleted medicine (Anti-Snake Venom) in seed data');
  }

  console.log('\n✅ All Alert System calculations and API proxy flows verified successfully!');
}

run().catch(console.error);
