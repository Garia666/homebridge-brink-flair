'use strict';

// Dynamisch platform: zoekt de Flair-systemen in het Brink Home-account,
// maakt per systeem een accessoire aan en ververst de waarden periodiek.

const { BrinkClient, BrinkAuthError } = require('./brinkClient');
const credentials = require('./credentials');
const { FlairAccessory } = require('./flairAccessory');
const { FlairPicker } = require('./flairPicker');

const { names } = require('./names');

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
    this.debugOn = this.config.debug === true;

    api.on('didFinishLaunching', () => this.safe(() => this.start()));
    api.on('shutdown', () => clearTimeout(this.timer));
  }

  // Uitgebreide logging voor probleemoplossing (instelling "debug"). Nooit wachtwoorden of tokens.
  debug(message) {
    if (this.debugOn) this.log.info(`[debug] ${message}`);
  }

  // Geen onafgevangen fouten: alles wat async loopt via safe().
  safe(fn) {
    Promise.resolve().then(fn).catch((e) => this.log.error(`Unexpected error: ${e?.stack || e}`));
  }

  configureAccessory(accessory) {
    this.cached.set(accessory.UUID, accessory);
  }

  async start() {
    let cred;
    try {
      cred = credentials.load(this.api.user.storagePath());
    } catch (e) {
      this.log.error(`Stored login cannot be read: ${e.message}`);
    }
    if (!cred) {
      this.log.error('No Brink Home login stored. Enter it on the settings page of this plugin in the Homebridge UI, then restart Homebridge.');
      return;
    }
    this.client = new BrinkClient({ ...cred, debug: (m) => this.debug(m) });

    try {
      const systems = await this.client.getSystems();
      if (!systems.length) this.log.warn('No systems found in the Brink Home account. Add your unit at www.brink-home.com first.');
      for (const s of systems) this.addSystem(s);
      for (const [uuid, acc] of this.cached) {
        if (!this.devices.has(uuid)) {
          this.log.info(`Removing accessory that is no longer in Brink Home: ${acc.displayName}`);
          this.api.unregisterPlatformAccessories(PLUGIN, PLATFORM, [acc]);
        }
      }
    } catch (e) {
      this.log.error(`Brink Home not reachable: ${e.message}`);
      if (e instanceof BrinkAuthError && e.credentials) return;
      this.timer = setTimeout(() => this.safe(() => this.start()), 5 * 60 * 1000);
      return;
    }
    await this.poll();
  }

  addSystem(system) {
    const uuid = this.api.hap.uuid.generate(`brink-flair-${system.id}`);
    let acc = this.cached.get(uuid);
    if (!acc) {
      acc = new this.api.platformAccessory(names(this.config).name, uuid);
      this.api.registerPlatformAccessories(PLUGIN, PLATFORM, [acc]);
      this.log.info(`New accessory: ${system.name}`);
    }
    acc.context.systemId = system.id;
    const device = new FlairAccessory(this, acc, system);
    this.devices.set(uuid, device);

    if (this.config.picker !== false) {
      device.picker = new FlairPicker(this, device, names(this.config));
      this.api.publishExternalAccessories(PLUGIN, [device.picker.accessory]);
    }
  }

  async poll() {
    clearTimeout(this.timer);
    for (const dev of this.devices.values()) {
      try {
        const params = await this.client.getParameters(dev.system.id);
        if (this.debugOn) this.debug(`${dev.system.name}: ${Object.values(params).map((p) => `${p.name}=${p.value}`).join(', ')}`);
        dev.update(params);
        this.failures = 0;
      } catch (e) {
        this.failures = (this.failures || 0) + 1;
        if (this.failures === 1 || this.failures % 10 === 0) this.log.warn(`Reading from Brink Home failed (${this.failures}x): ${e.message}`);
      }
    }
    this.timer = setTimeout(() => this.safe(() => this.poll()), this.interval);
  }

  // Na een wijziging even later opnieuw ophalen, zodat HomeKit de echte stand toont.
  refreshSoon() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.safe(() => this.poll()), 5000);
  }
}

module.exports = { BrinkFlairPlatform, PLUGIN, PLATFORM };
