'use strict';

// Dynamisch platform: zoekt de Flair-systemen in het Brink Home-account,
// maakt per systeem een accessoire aan en ververst de waarden periodiek.

const { BrinkClient, BrinkAuthError } = require('./brinkClient');
const credentials = require('./credentials');
const { FlairAccessory } = require('./flairAccessory');
const { FlairPicker } = require('./flairPicker');

const DEFAULT_NAMES = ['Afwezig', 'Laag', 'Normaal', 'Hoog'];

const PLUGIN = 'homebridge-brink-flair';
const PLATFORM = 'BrinkFlair';

class BrinkFlairPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;
    this.cached = new Map();
    this.devices = new Map();
    this.interval = Math.max(30, Number(this.config.pollSeconds) || 60) * 1000;

    api.on('didFinishLaunching', () => this.start());
    api.on('shutdown', () => clearTimeout(this.timer));
  }

  configureAccessory(accessory) {
    this.cached.set(accessory.UUID, accessory);
  }

  async start() {
    let cred;
    try {
      cred = credentials.load(this.api.user.storagePath());
    } catch (e) {
      this.log.error(`Inloggegevens niet te lezen: ${e.message}`);
    }
    if (!cred) {
      this.log.error(`Geen inloggegevens. Zet ze met: node ${require.resolve('../tools/set-credentials.js')}`);
      return;
    }
    this.client = new BrinkClient({ ...cred, log: this.log });

    try {
      const systems = await this.client.getSystems();
      if (!systems.length) this.log.warn('Geen systemen gevonden in het Brink Home-account.');
      for (const s of systems) this.addSystem(s);
      for (const [uuid, acc] of this.cached) {
        if (!this.devices.has(uuid)) {
          this.log.info(`Verwijder accessoire dat niet meer in Brink Home staat: ${acc.displayName}`);
          this.api.unregisterPlatformAccessories(PLUGIN, PLATFORM, [acc]);
        }
      }
    } catch (e) {
      this.log.error(`Brink Home niet bereikbaar: ${e.message}`);
      if (e instanceof BrinkAuthError && e.credentials) return;
      this.timer = setTimeout(() => this.start(), 5 * 60 * 1000);
      return;
    }
    await this.poll();
  }

  addSystem(system) {
    const uuid = this.api.hap.uuid.generate(`brink-flair-${system.id}`);
    let acc = this.cached.get(uuid);
    if (!acc) {
      acc = new this.api.platformAccessory(this.config.name || 'WTW', uuid);
      this.api.registerPlatformAccessories(PLUGIN, PLATFORM, [acc]);
      this.log.info(`Nieuw accessoire: ${system.name}`);
    }
    acc.context.systemId = system.id;
    const device = new FlairAccessory(this, acc, system);
    this.devices.set(uuid, device);

    if (this.config.picker !== false) {
      const names = DEFAULT_NAMES.map((d, i) => (this.config.levelNames || [])[i] || d);
      device.picker = new FlairPicker(this, device, names);
      this.api.publishExternalAccessories(PLUGIN, [device.picker.accessory]);
    }
  }

  async poll() {
    clearTimeout(this.timer);
    for (const dev of this.devices.values()) {
      try {
        dev.update(await this.client.getParameters(dev.system.id));
        this.failures = 0;
      } catch (e) {
        this.failures = (this.failures || 0) + 1;
        if (this.failures === 1 || this.failures % 10 === 0) this.log.warn(`Ophalen mislukt (${this.failures}x): ${e.message}`);
      }
    }
    this.timer = setTimeout(() => this.poll(), this.interval);
  }

  // Na een wijziging even later opnieuw ophalen, zodat HomeKit de echte stand toont.
  refreshSoon() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.poll(), 5000);
  }
}

module.exports = { BrinkFlairPlatform, PLUGIN, PLATFORM };
