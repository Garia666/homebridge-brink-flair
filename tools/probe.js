'use strict';

// Proefscript: logt in bij Brink Home en toont alle systemen en parameters.
// Schrijft niets. Inloggegevens komen uit de omgeving (BRINK_USER / BRINK_PASS).
//   node tools/probe.js

const { BrinkClient } = require('../lib/brinkClient');

(async () => {
  const client = new BrinkClient({ username: process.env.BRINK_USER, password: process.env.BRINK_PASS });
  await client.login();
  console.log('Ingelogd bij Brink Home.');
  const systems = await client.getSystems();
  for (const s of systems) {
    console.log(`\nSysteem ${s.id}: ${s.name} (serienummer ${s.serial}, gateway ${s.gatewayState})`);
    const params = await client.getParameters(s.id);
    for (const p of Object.values(params)) {
      const opts = p.options.length ? `  [${p.options.map((o) => `${o.value}=${o.label}`).join(', ')}]` : '';
      console.log(`  ${p.readWrite ? 'RW' : 'R '} ${p.name} = ${p.value}${p.unit ? ' ' + p.unit : ''} (valueId ${p.valueId})${opts}`);
    }
  }
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
