'use strict';

// Server-kant van de eigen pagina in de Homebridge-UI: inloggegevens opslaan
// en alle gegevens van de Flair uit Brink Home ophalen.

const { BrinkClient } = require('../lib/brinkClient');
const credentials = require('../lib/credentials');

(async () => {
  const { HomebridgePluginUiServer, RequestError } = await import('@homebridge/plugin-ui-utils');

  class UiServer extends HomebridgePluginUiServer {
    constructor() {
      super();
      this.onRequest('/credentials', (p) => this.saveCredentials(p));
      this.onRequest('/status', () => this.status());
      this.ready();
    }

    async saveCredentials({ username, password }) {
      if (!username || !password) throw new RequestError('E-mail and password are required', { status: 400 });
      const client = new BrinkClient({ username, password });
      try {
        await client.login();
        const systems = await client.getSystems();
        credentials.save(this.homebridgeStoragePath, { username, password });
        return { ok: true, systems: systems.map((s) => s.name) };
      } catch (e) {
        throw new RequestError(e.message, { status: 400 });
      }
    }

    async status() {
      let cred;
      try {
        cred = credentials.load(this.homebridgeStoragePath);
      } catch (e) {
        throw new RequestError(`Stored login cannot be read: ${e.message}`, { status: 500 });
      }
      if (!cred) return { configured: false };
      try {
        const client = new BrinkClient(cred);
        const systems = [];
        for (const s of await client.getSystems()) {
          const params = await client.getParameters(s.id);
          systems.push({
            id: s.id, name: s.name, serial: s.serial, gatewayState: s.gatewayState,
            params: Object.values(params).map((p) => ({
              name: p.name, value: p.value, unit: p.unit,
              label: p.options.find((o) => o.value === String(p.value))?.label,
            })),
          });
        }
        return { configured: true, username: cred.username, systems };
      } catch (e) {
        throw new RequestError(e.message, { status: 502 });
      }
    }
  }

  return new UiServer();
})();
