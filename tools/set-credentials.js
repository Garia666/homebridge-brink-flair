'use strict';

// Slaat de inloggegevens van Brink Home versleuteld op in de opslagmap van Homebridge.
// Leest twee regels van stdin: e-mailadres en wachtwoord.
//   node tools/set-credentials.js [opslagmap]   (standaard /var/lib/homebridge)
// Daarna controleert hij of inloggen lukt.

const readline = require('node:readline');
const credentials = require('../lib/credentials');
const { BrinkClient } = require('../lib/brinkClient');

const storage = process.argv[2] || '/var/lib/homebridge';

(async () => {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  const lines = [];
  for await (const l of rl) { lines.push(l.trim()); if (lines.length === 2) break; }
  const [username, password] = lines;
  if (!username || !password) throw new Error('Verwacht twee regels: e-mailadres en wachtwoord');
  const client = new BrinkClient({ username, password });
  await client.login();
  const systems = await client.getSystems();
  credentials.save(storage, { username, password });
  console.log(`Opgeslagen in ${storage}/${credentials.FILE}. Gevonden: ${systems.map((s) => s.name).join(', ') || 'geen systemen'}`);
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
