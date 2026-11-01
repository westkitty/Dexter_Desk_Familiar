const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const script = path.join(__dirname, '..', 'scripts', 'egress-audit.mjs');
function audit(lines, env = {}) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'egress-')), 'trace.log');
  fs.writeFileSync(file, lines.join('\n'));
  const clean = {...process.env};
  for (const k of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) delete clean[k];
  return spawnSync(process.execPath, [script, file], {encoding: 'utf8', env: {...clean, ...env}});
}
const v4 = (addr, port) => `12 connect(5, {sa_family=AF_INET, sin_port=htons(${port}), sin_addr=inet_addr("${addr}")}, 16) = 0`;
test('loopback-only traces pass', () => {
  assert.equal(audit([v4('127.0.0.1', 41234), v4('127.0.0.1', 41234)]).status, 0);
});
test('non-loopback, DNS, proxy port and proxy CONNECT all fail', () => {
  assert.equal(audit([v4('142.250.31.101', 443)]).status, 1);
  assert.equal(audit([v4('127.0.0.53', 53)]).status, 1);
  assert.equal(audit([v4('127.0.0.1', 42679)], {HTTPS_PROXY: 'http://127.0.0.1:42679'}).status, 1);
  assert.equal(audit(['3854 sendto(18, "CONNECT redirector.gvt1.com:443 HTTP/1.1\\r\\n", 40, 0, NULL, 0) = 40']).status, 1);
  const v6 = '1 connect(7, {sa_family=AF_INET6, sin6_port=htons(53), sin6_flowinfo=htonl(0), inet_pton(AF_INET6, "2001:4860:4860::8888", &sin6_addr), sin6_scope_id=0}, 28) = 0';
  assert.equal(audit([v6]).status, 1);
});
