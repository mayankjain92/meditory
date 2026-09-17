import http from 'http';
import { URL } from 'url';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { loginHandler, meHandler, logoutHandler } from './handlers/auth.js';
import { inventoryHandler } from './handlers/inventory.js';
import { dispenseHandler } from './handlers/dispense.js';
import { restockHandler } from './handlers/restock.js';
import { locatorHandler } from './handlers/locator.js';
import { auditHandler } from './handlers/audit.js';

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
    } catch (err) {
      console.error(`[LocalServer Error]:`, err);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      });
      res.end(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR', message: String(err) }));
    }
  });
});

export function startLocalServer(port: number = PORT) {
  server.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 [Meditory Local API Server] Running on http://localhost:${port}`);
    console.log(`   Connected to DDB: ${process.env.DYNAMODB_ENDPOINT || 'AWS Cloud'}`);
    console.log(`======================================================\n`);
  });
  return server;
}

if (process.argv[1]?.endsWith('local-server.ts') || process.argv[1]?.endsWith('local-server.js')) {
  startLocalServer();
}
