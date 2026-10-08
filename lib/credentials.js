'use strict';

// Inloggegevens voor Brink Home, versleuteld opgeslagen (AES-256-GCM) in de
// opslagmap van Homebridge, zodat ze niet leesbaar in config.json staan.
// De sleutel is afgeleid van /etc/machine-id: het bestand is op een andere
// machine niet te ontsleutelen.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const FILE = 'brink-flair.credentials';

function key() {
  let id = 'homebridge-brink-flair';
  for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
    try { id = fs.readFileSync(f, 'utf8').trim(); break; } catch { /* volgende */ }
  }
  return crypto.scryptSync(id, 'homebridge-brink-flair', 32);
}

function file(storagePath) {
  return path.join(storagePath, FILE);
}

function save(storagePath, { username, password }) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify({ username, password }), 'utf8'), c.final()]);
  const out = { v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
  fs.writeFileSync(file(storagePath), JSON.stringify(out), { mode: 0o600 });
}

function load(storagePath) {
  const f = file(storagePath);
  if (!fs.existsSync(f)) return null;
  const s = JSON.parse(fs.readFileSync(f, 'utf8'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(s.iv, 'base64'));
  d.setAuthTag(Buffer.from(s.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(s.data, 'base64')), d.final()]).toString('utf8'));
}

module.exports = { save, load, FILE };
