/**
 * A stand-in for Twilio's Messages API, for the tests: the Worker posts its
 * SMS here (TWILIO_API_BASE, honoured on test servers only) and the tests read
 * the codes back. Nothing is sent anywhere.
 */
import http from 'node:http';

/**
 * @param {number} port
 * @returns {Promise<{url: string, messages: object[], failNext: number, codeFor: (phone: string) => string | null, close: () => Promise<void>}>}
 *   messages: every request, as { account, auth, To, From | MessagingServiceSid, Body }.
 *   failNext: how many of the next messages Twilio refuses (400, error 21211).
 */
export async function startTwilioStub(port) {
  const stub = {
    url: `http://127.0.0.1:${port}`,
    messages: [],
    failNext: 0,
    /** The code in the latest SMS to `phone` (+91…). */
    codeFor: (phone) => {
      const m = [...stub.messages].reverse().find((x) => x.To === phone);
      return m ? (m.Body.match(/\b(\d{6})\b/) || [])[1] || null : null;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const m = /^\/2010-04-01\/Accounts\/([^/]+)\/Messages\.json$/.exec(req.url);
      if (req.method !== 'POST' || !m) { res.writeHead(404); res.end(); return; }
      const form = Object.fromEntries(new URLSearchParams(body));
      stub.messages.push({ account: decodeURIComponent(m[1]), auth: req.headers.authorization || '', ...form });
      res.writeHead(stub.failNext > 0 ? 400 : 201, { 'Content-Type': 'application/json' });
      if (stub.failNext > 0) {
        stub.failNext -= 1;
        res.end(JSON.stringify({ code: 21211, message: `The 'To' number ${form.To} is not a valid phone number.`, status: 400 }));
      } else {
        res.end(JSON.stringify({ sid: `SM${'0'.repeat(32)}`, status: 'queued' }));
      }
    });
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return stub;
}
