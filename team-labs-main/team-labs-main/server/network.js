import os from 'os';
import fs from 'fs';
import path from 'path';
import selfsigned from 'selfsigned';

export function getLanIps() {
  const list = [];
  for (const [name, ifaces] of Object.entries(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      const n = name.toLowerCase();
      let priority = 5;
      if (/wi-?fi|wireless|wlan/.test(n)) priority = 10;
      else if (/^eth|ethernet|^en\d/.test(n)) priority = 8;
      if (/vethernet|wsl|hyper-v|virtual|vmware|vbox|docker|tailscale|zerotier|loopback/.test(n)) priority = 1;
      if (iface.address.startsWith('169.254.')) continue;
      if (iface.address.startsWith('192.168.137.')) priority = 12;
      list.push({ name, address: iface.address, priority });
    }
  }
  return list.sort((a, b) => b.priority - a.priority);
}

export function loadCertificate(dir, ips) {
  const certFile = path.join(dir, 'cert.pem');
  const keyFile = path.join(dir, 'key.pem');
  const metaFile = path.join(dir, 'ips.json');
  const wanted = JSON.stringify([...ips].sort());

  try {
    if (fs.readFileSync(metaFile, 'utf8') === wanted) {
      return { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) };
    }
  } catch {
  }

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    ...ips.map((ip) => ({ type: 7, ip }))
  ];
  const pems = selfsigned.generate([{ name: 'commonName', value: 'wildscan.local' }], {
    days: 825,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames }
    ]
  });

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(certFile, pems.cert);
  fs.writeFileSync(keyFile, pems.private);
  fs.writeFileSync(metaFile, wanted);
  return { cert: pems.cert, key: pems.private };
}
