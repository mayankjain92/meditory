import http from 'http';
import { URL } from 'url';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { loginHandler, meHandler, logoutHandler } from './handlers/auth.js';
import { inventoryHandler } from './handlers/inventory.js';
import { dispenseHandler } from './handlers/dispense.js';
import { restockHandler } from './handlers/restock.js';
import { locatorHandler } from './handlers/locator.js';
import { auditHandler } from './handlers/audit.js';
import { doctorsHandler } from './handlers/doctors.js';
import {
  createRequisitionHandler,
  getRequisitionsHandler,
  respondRequisitionHandler,
  handshakeDispenseHandler,
  confirmIntakeHandler,
} from './handlers/requisitions.js';
import { syncBatchHandler } from './handlers/sync.js';
import {
  registerFacilityHandler,
  getPendingRegistrationsHandler,
  approveRegistrationHandler,
  rejectRegistrationHandler,
} from './handlers/registration.js';
import { isLocal, localEndpoint, ensureTablesExist } from './shared/ddb.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

function toLambdaEvent(
  req: http.IncomingMessage,
  body: string,
  url: URL
): APIGatewayProxyEventV2 {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
  }

  const queryStringParameters: Record<string, string> = {};
  url.searchParams.forEach((val, key) => {
    queryStringParameters[key] = val;
  });

  const cookies: string[] = req.headers.cookie ? req.headers.cookie.split(';').map((c) => c.trim()) : [];

  return {
    version: '2.0',
    routeKey: `${req.method} ${url.pathname}`,
    rawPath: url.pathname,
    rawQueryString: url.search.replace(/^\?/, ''),
    headers,
    cookies,
    queryStringParameters: Object.keys(queryStringParameters).length ? queryStringParameters : undefined,
    body: body || undefined,
    isBase64Encoded: false,
    requestContext: {
      accountId: 'local',
      apiId: 'local-api',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: req.method || 'GET',
        path: url.pathname,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
      },
      requestId: `req-${Date.now()}`,
      routeKey: `${req.method} ${url.pathname}`,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
  };
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || 'http://localhost:3000';

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    });
    res.end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', async () => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const event = toLambdaEvent(req, body, url);

    try {
      let response;
      const path = url.pathname.replace(/^\/api/, '');
      const method = req.method;

      if (method === 'POST' && path === '/auth/login') {
        response = await loginHandler(event);
      } else if (method === 'POST' && path === '/auth/logout') {
        response = await logoutHandler();
      } else if (method === 'GET' && path === '/auth/me') {
        response = await meHandler(event);
      } else if (method === 'GET' && path === '/clinic/inventory') {
        response = await inventoryHandler(event);
      } else if (method === 'POST' && path === '/clinic/dispense') {
        response = await dispenseHandler(event);
      } else if (method === 'POST' && path === '/clinic/restock') {
        response = await restockHandler(event);
      } else if (method === 'GET' && path === '/clinic/audit') {
        response = await auditHandler(event);
      } else if (method === 'GET' && path === '/network/stock-locator') {
        response = await locatorHandler(event);
      } else if (method === 'GET' && path === '/clinic/doctors') {
        response = await doctorsHandler(event);
      } else if (method === 'POST' && path === '/requisitions/request') {
        response = await createRequisitionHandler(event);
      } else if (method === 'GET' && path === '/requisitions') {
        response = await getRequisitionsHandler(event);
      } else if (method === 'POST' && path === '/requisitions/respond') {
        response = await respondRequisitionHandler(event);
      } else if (method === 'POST' && path === '/requisitions/handshake-dispense') {
        response = await handshakeDispenseHandler(event);
      } else if (method === 'POST' && path === '/requisitions/confirm-intake') {
        response = await confirmIntakeHandler(event);
      } else if (method === 'POST' && path === '/clinic/sync-batch') {
        response = await syncBatchHandler(event);
      } else if (method === 'POST' && path === '/facilities/register') {
        response = await registerFacilityHandler(event);
      } else if (method === 'GET' && path === '/admin/registrations') {
        response = await getPendingRegistrationsHandler(event);
      } else if (method === 'POST' && path === '/admin/registrations/approve') {
        response = await approveRegistrationHandler(event);
      } else if (method === 'POST' && path === '/admin/registrations/reject') {
        response = await rejectRegistrationHandler(event);
      } else {
        response = {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'NOT_FOUND', message: `Route ${method} ${path} not found.` }),
        };
      }

      // Write response
      const headers = response.headers || {};
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';

      res.writeHead(response.statusCode, headers);
      res.end(response.body);
    } catch (err: any) {
      if (err?.code === 'ECONNREFUSED' && (err?.port === 8000 || err?.address === '127.0.0.1')) {
        console.error(`\n❌ [LocalServer Error]: DynamoDB Local is not running on port 8000.`);
        console.error(`👉 Run 'docker compose up -d' (or 'pnpm ddb:local') followed by 'pnpm seed' to start and seed the database.\n`);
      } else {
        console.error(`[LocalServer Error]:`, err);
      }
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      });
      res.end(JSON.stringify({
        error: 'INTERNAL_SERVER_ERROR',
        message: err?.code === 'ECONNREFUSED'
          ? 'Cannot connect to DynamoDB Local (127.0.0.1:8000). Please run "docker compose up -d" and "pnpm seed".'
          : String(err),
      }));
    }
  });
});

export function startLocalServer(port: number = PORT) {
  server.listen(port, async () => {
    console.log(`\n======================================================`);
    console.log(`🚀 [Meditory Local API Server] Running on http://localhost:${port}`);
    console.log(`   Connected to DDB: ${isLocal ? `${localEndpoint} (Local)` : (process.env.DYNAMODB_ENDPOINT || 'AWS Cloud')}`);
    console.log(`======================================================\n`);

    try {
      await ensureTablesExist();
    } catch (e) {
      console.warn('[LocalServer] Warning on ensureTablesExist:', (e as Error).message);
    }
  });
  return server;
}

if (process.argv[1]?.endsWith('local-server.ts') || process.argv[1]?.endsWith('local-server.js')) {
  startLocalServer();
}
