/**
 * A stand-in for 2Factor's SMS OTP API, for the tests: the Worker sends its
 * codes here (TWOFACTOR_API_BASE, honoured on test servers only) and the tests
 * read them back. Nothing is sent anywhere.
 */
import http from 'node:http';

/**
 * @param {number} port
 * @returns {Promise<{url: string, messages: object[], failNext: number, codeFor: (phone: string) => string | null, close: () => Promise<void>}>}
 *   messages: every request, as { method, key, phone, code, template }.
 *   failNext: how many of the next messages 2Factor refuses (HTTP 200 with
 *   Status "Error", as 2Factor answers).
 */
export async function startTwoFactorStub(port) {
  const stub = {
    url: `http://127.0.0.1:${port}`,
    messages: [],
    failNext: 0,
    /** The code in the latest SMS to `phone` (+91… or 10 digits). */
    codeFor: (phone) => {
      const m = [...stub.messages].reverse().find((x) => x.phone === String(phone).slice(-10));
      return m ? m.code : null;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
  const server = http.createServer((req, res) => {
    // /API/V1/{key}/SMS/{phone}/{code}[/{template}]
    const parts = req.url.split('?')[0].split('/').slice(1).map(decodeURIComponent);
    if (parts[0] !== 'API' || parts[1] !== 'V1' || parts[3] !== 'SMS' || parts.length < 6) { res.writeHead(404); res.end(); return; }
    const [, , key, , phone, code, template = null] = parts;
    stub.messages.push({ method: req.method, key, phone, code, template });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (stub.failNext > 0) {
      stub.failNext -= 1;
      res.end(JSON.stringify({ Status: 'Error', Details: `Invalid Phone Number ${phone} - Length Mismatch(Expected: 10)` }));
    } else {
      res.end(JSON.stringify({ Status: 'Success', Details: `${'0'.repeat(8)}-${'1'.repeat(4)}-session` }));
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return stub;
}
