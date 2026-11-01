// Parse an strace log of the whole Electron process tree and fail on any
// outbound network activity that is not loopback, any DNS lookup, and any
// HTTP proxy CONNECT. Usage: node scripts/egress-audit.mjs <strace.log>
// Trace with: strace -f -qq -s 300 -e trace=connect,sendto,sendmsg,write -o log <electron binary> ...
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: egress-audit.mjs <strace.log>'); process.exit(2); }
const lines = fs.readFileSync(file, 'utf8').split('\n');
const proxyPorts = new Set();
for (const name of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) {
  try { const u = new URL(process.env[name] || ''); if (u.port) proxyPorts.add(Number(u.port)); } catch {}
}
const loopback = addr => /^127\./.test(addr) || addr === '::1' || addr === '0.0.0.0' || addr === '::';
const violations = [];
const destinations = new Map();
for (const line of lines) {
  const v4 = /sa_family=AF_INET, sin_port=htons\((\d+)\), sin_addr=inet_addr\("([^"]+)"\)/.exec(line);
  const v6 = /sa_family=AF_INET6, sin6_port=htons\((\d+)\),.*inet_pton\(AF_INET6, "([^"]+)"/.exec(line);
  const hit = v4 || v6;
  if (hit) {
    const port = Number(hit[1]), addr = hit[2];
    const key = addr + ':' + port;
    destinations.set(key, (destinations.get(key) || 0) + 1);
    if (!loopback(addr)) violations.push('non-loopback ' + key);
    else if (port === 53) violations.push('DNS lookup via ' + key);
    else if (proxyPorts.has(port)) violations.push('traffic to configured proxy ' + key);
  }
  const connect = /CONNECT ([^ \\]+) HTTP/.exec(line);
  if (connect) violations.push('proxy CONNECT ' + connect[1]);
}
console.log('IP destinations seen:', Object.fromEntries(destinations));
if (violations.length) {
  console.error('EGRESS AUDIT FAIL:\n  ' + [...new Set(violations)].join('\n  '));
  process.exit(1);
}
console.log('EGRESS AUDIT PASS: loopback only, no DNS, no proxy CONNECT.');
