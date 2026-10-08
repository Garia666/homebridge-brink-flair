'use strict';

// Eén Flair in HomeKit: ventilator (uit = automatisch, stand 0-3 handmatig),
// filtermelding, en temperatuursensoren voor buitenlucht en toevoerlucht.

const { LEVELS, MODE, parse, levelWrites, modeWrites } = require('./flairState');
const { names } = require('./names');

// Vier standen (0-3) op 25/50/75/100 %.
const STEP = 100 / (LEVELS + 1);
const DEBOUNCE_MS = 1000;
const toSpeed = (level) => (level + 1) * STEP;
// Vloeiende schuif in vier gebieden (1-25, 26-50, 51-75, 76-100): de Woning-app slaat
// bij een schuif met stappen van 25 een stand over.
const toLevel = (speed) => Math.min(LEVELS, Math.max(0, Math.ceil(speed / STEP) - 1));

class FlairAccessory {
  constructor(platform, accessory, system) {
    this.platform = platform;
    this.accessory = accessory;
    this.system = system;
    this.log = platform.log;
    this.params = null;
    this.state = null;

    const { Service, Characteristic } = platform.api.hap;
    const n = names(platform.config);
    this.S = Service;
    this.C = Characteristic;

    accessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, 'Brink Climate Systems')
      .setCharacteristic(Characteristic.SerialNumber, String(system.serial || system.id));

    this.fan = accessory.getService(Service.Fanv2) || accessory.addService(Service.Fanv2, n.name);
    this.fan.getCharacteristic(Characteristic.Active).onSet((v) => this.setActive(v));
    this.fan.getCharacteristic(Characteristic.RotationSpeed)
      .setProps({ minValue: 0, maxValue: 100, minStep: 1 })
      .onSet((v) => this.setSpeed(v));
    this.fan.getCharacteristic(Characteristic.TargetFanState).onSet((v) => this.setTargetState(v));

    this.filter = accessory.getService(Service.FilterMaintenance) || accessory.addService(Service.FilterMaintenance, n.filterName);
    this.fan.addLinkedService(this.filter);

    this.fresh = this.sensor(n.freshAirName, 'fresh');
    this.supply = this.sensor(n.supplyAirName, 'supply');

    // Contactsensoren geven een pushmelding in de Woning-app ("geopend" = actie nodig).
    if (platform.config.alertSensors !== false) {
      this.filterAlert = this.contact(n.filterAlertName, 'filter-alert');
      this.faultAlert = this.contact(n.faultAlertName, 'fault-alert');
    }
  }

  contact(name, subtype) {
    return this.accessory.getServiceById(this.S.ContactSensor, subtype)
      || this.accessory.addService(this.S.ContactSensor, name, subtype);
  }

  sensor(name, subtype) {
    const svc = this.accessory.getServiceById(this.S.TemperatureSensor, subtype)
      || this.accessory.addService(this.S.TemperatureSensor, name, subtype);
    svc.getCharacteristic(this.C.CurrentTemperature).setProps({ minValue: -50, maxValue: 100 });
    return svc;
  }

  update(params) {
    this.params = params;
    const s = parse(params);
    this.state = s;
    if (s.level != null) this.lastLevel = s.level;
    const C = this.C;

    this.accessory.getService(this.S.AccessoryInformation)
      .updateCharacteristic(C.Model, s.model)
      .updateCharacteristic(C.FirmwareRevision, s.software.replace(/^S/, '') || '0');

    if (!this.pending) this.showFan(s.mode, this.lastLevel);
    this.filter.updateCharacteristic(C.FilterChangeIndication,
      s.filterDirty ? C.FilterChangeIndication.CHANGE_FILTER : C.FilterChangeIndication.FILTER_OK);
    this.fan.updateCharacteristic(C.StatusFault, s.fault ? C.StatusFault.GENERAL_FAULT : C.StatusFault.NO_FAULT);
    const open = (on) => (on ? C.ContactSensorState.CONTACT_NOT_DETECTED : C.ContactSensorState.CONTACT_DETECTED);
    this.filterAlert?.updateCharacteristic(C.ContactSensorState, open(s.filterDirty));
    this.faultAlert?.updateCharacteristic(C.ContactSensorState, open(s.fault));
    if (s.fault && !this.faultLogged) this.log.warn(`${this.accessory.displayName}: unit reports a ${s.blockingFault ? 'blocking' : 'non-blocking'} fault`);
    if (s.filterDirty && !this.filterLogged) this.log.warn(`${this.accessory.displayName}: filter needs replacing (${s.filterDays ?? '?'} days since reset)`);
    this.faultLogged = s.fault;
    this.filterLogged = s.filterDirty;
    if (s.freshTemp != null) this.fresh.updateCharacteristic(C.CurrentTemperature, s.freshTemp);
    if (s.supplyTemp != null) this.supply.updateCharacteristic(C.CurrentTemperature, s.supplyTemp);
  }

  // Automatisch = "uit" in HomeKit (de Flair regelt zelf); handmatig = aan, met stand 0-3 op 25/50/75/100 %.
  showFan(mode, level) {
    const C = this.C;
    const manual = mode != null && mode !== MODE.AUTO;
    this.fan.updateCharacteristic(C.Active, manual ? C.Active.ACTIVE : C.Active.INACTIVE);
    this.fan.updateCharacteristic(C.CurrentFanState, C.CurrentFanState.BLOWING_AIR);
    this.fan.updateCharacteristic(C.TargetFanState, manual ? C.TargetFanState.MANUAL : C.TargetFanState.AUTO);
    if (level != null) this.fan.updateCharacteristic(C.RotationSpeed, toSpeed(level));
    this.picker?.show(mode, level);
  }

  // Schuifbewegingen samenvoegen: pas schrijven als er 1 seconde niets meer verandert.
  schedule(target) {
    this.pending = target;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.platform.safe(() => this.flush()), DEBOUNCE_MS);
  }

  async flush() {
    const t = this.pending;
    if (!t || !this.params) { this.pending = null; return; }
    // Niets sturen als de Flair al zo staat (HomeKit stuurt soms de huidige waarde opnieuw).
    if (this.state && ((t.auto && this.state.mode === MODE.AUTO) || (!t.auto && this.state.mode === MODE.MANUAL && this.state.level === t.level))) {
      this.pending = null;
      return;
    }
    const what = t.auto ? 'automatic' : `level ${t.level}`;
    const writes = t.auto ? modeWrites(this.params, MODE.AUTO) : levelWrites(this.params, t.level);
    if (!writes.length) {
      this.log.warn(`${this.accessory.displayName}: this unit has no automatic mode in Brink Home`);
      this.pending = null;
      this.platform.refreshSoon();
      return;
    }
    this.log.info(`${this.accessory.displayName}: ${what}`);
    this.platform.debug(`Write ${JSON.stringify(writes)}`);
    try {
      await this.platform.client.writeParameters(this.system.id, writes);
      if (!t.auto) this.lastLevel = t.level;
      this.showFan(t.auto ? MODE.AUTO : MODE.MANUAL, this.lastLevel);
    } catch (e) {
      this.log.error(`Writing to Brink Home failed: ${e.message}`);
    } finally {
      if (this.pending === t) this.pending = null;
      this.platform.refreshSoon();
    }
  }

  setActive(v) {
    if (v === this.C.Active.ACTIVE) {
      if (this.pending || this.state?.mode === MODE.MANUAL) return;
      this.schedule({ level: this.lastLevel ?? 1 });
    } else {
      this.schedule({ auto: true });
    }
  }

  setSpeed(v) {
    if (v <= 0) return this.schedule({ auto: true });
    this.schedule({ level: toLevel(v) });
  }

  setTargetState(v) {
    if (v === this.C.TargetFanState.AUTO) this.schedule({ auto: true });
    else this.schedule({ level: this.lastLevel ?? 1 });
  }
}

module.exports = { FlairAccessory };
