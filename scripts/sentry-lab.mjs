// Disposable loopback envelope receiver. No external Sentry project or credential is used.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

export async function sentryLab(controlToken) {
  const events = [], headerChecks = [];
  const publicKey = randomBytes(16).toString('hex');
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/events' && req.method === 'GET' && req.headers.authorization === 'Bearer ' + controlToken) {
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(events)); return;
    }
    if (req.method !== 'POST' || url.pathname !== '/api/1/envelope/' || url.searchParams.get('sentry_key') !== publicKey) {
      res.writeHead(403); res.end(); return;
    }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    try {
      const lines = Buffer.concat(chunks).toString().trim().split('\n').map(line => JSON.parse(line));
      assert.equal(lines.length, 3);
      assert.deepEqual(Object.keys(lines[0]).sort(), ['event_id', 'sent_at']);
      assert.deepEqual(lines[1], { type: 'event' });
      events.push(lines[2]);
      headerChecks.push(!req.headers.cookie && !req.headers.authorization && !req.headers.referer);
      res.end('{}');
    } catch { headerChecks.push(false); res.writeHead(400); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  return {
    dsn: origin.replace('://', '://' + publicKey + '@') + '/1', eventsUrl: origin + '/events', events,
    verify(enabled) {
      assert.ok(headerChecks.every(Boolean), 'Telemetry envelope or transport headers violated policy');
      if (!enabled) assert.equal(events.length, 0, 'Monitoring without DSN must send nothing');
      for (const event of events) {
        assert.deepEqual(Object.keys(event).sort(), ['environment','event_id','exception','level','platform','release','tags','timestamp'].sort());
        assert.deepEqual(Object.keys(event.tags).sort(), ['route', 'runtime']);
        assert.ok(!JSON.stringify(event).includes('sentry-private-sentinel'));
      }
      console.log('PASS monitoring envelope privacy and disabled-DSN isolation');
    },
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
  };
}
