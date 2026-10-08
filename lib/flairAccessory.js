'use strict';

// Eén Flair in HomeKit: ventilator (stand 0-3 en automatisch/handmatig),
// filtermelding, en temperatuursensoren voor buitenlucht en toevoerlucht.

const { LEVELS, MODE, parse, levelWrites, modeWrites } = require('./flairState');

const STEP = 100 / LEVELS;

class FlairAccessory {
  constructor(platform, accessory, system) {
    this.platform = platform;
    this.accessory = accessory;
    this.system = system;
    this.log = platform.log;
    this.params = null;
    this.state = null;

    const { Service, Characteristic } = platform.api.hap;
    this.S = Service;
    this.C = Characteristic;

    accessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, 'Brink Climate Systems')
      .setCharacteristic(Characteristic.SerialNumber, String(system.serial || system.id));

    this.fan = accessory.getService(Service.Fanv2) || accessory.addService(Service.Fanv2, platform.config.name || 'Ventilatie');
    this.fan.getCharacteristic(Characteristic.Active).onSet((v) => this.setActive(v));
    this.fan.getCharacteristic(Characteristic.RotationSpeed)
      .setProps({ minValue: 0, maxValue: 100, minStep: STEP })
      .onSet((v) => this.setSpeed(v));
    this.fan.getCharacteristic(Characteristic.TargetFanState).onSet((v) => this.setTargetState(v));

    this.filter = accessory.getService(Service.FilterMaintenance) || accessory.addService(Service.FilterMaintenance, 'Filter');
    this.fan.addLinkedService(this.filter);

    this.fresh = this.sensor('Buitenlucht', 'fresh');
    this.supply = this.sensor('Toevoerlucht', 'supply');
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
    const C = this.C;

    this.accessory.getService(this.S.AccessoryInformation)
      .updateCharacteristic(C.Model, s.model)
      .updateCharacteristic(C.FirmwareRevision, s.software.replace(/^S/, '') || '0');

    if (s.level != null) {
      this.fan.updateCharacteristic(C.Active, s.level > 0 ? C.Active.ACTIVE : C.Active.INACTIVE);
      this.fan.updateCharacteristic(C.CurrentFanState, s.level > 0 ? C.CurrentFanState.BLOWING_AIR : C.CurrentFanState.IDLE);
      this.fan.updateCharacteristic(C.RotationSpeed, Math.round(s.level * STEP));
    }
    if (s.mode != null) {
      this.fan.updateCharacteristic(C.TargetFanState, s.mode === MODE.AUTO ? C.TargetFanState.AUTO : C.TargetFanState.MANUAL);
    }
    this.filter.updateCharacteristic(C.FilterChangeIndication,
      s.filterDirty ? C.FilterChangeIndication.CHANGE_FILTER : C.FilterChangeIndication.FILTER_OK);
    if (s.freshTemp != null) this.fresh.updateCharacteristic(C.CurrentTemperature, s.freshTemp);
    if (s.supplyTemp != null) this.supply.updateCharacteristic(C.CurrentTemperature, s.supplyTemp);
  }

  async write(writes, what) {
    if (!this.params) throw new this.platform.api.hap.HapStatusError(-70402);
    this.log.info(`${this.accessory.displayName}: ${what}`);
    try {
      await this.platform.client.writeParameters(this.system.id, writes);
      this.platform.refreshSoon();
    } catch (e) {
      this.log.error(`Schrijven naar Brink Home mislukt: ${e.message}`);
      throw new this.platform.api.hap.HapStatusError(-70402);
    }
  }

  // "Uit" bestaat niet bij een WTW: uit = stand 0 (laagste stand).
  async setActive(v) {
    const on = v === this.C.Active.ACTIVE;
    if (on && this.state?.level > 0) return;
    await this.write(levelWrites(this.params, on ? Math.max(1, this.state?.level || 1) : 0), on ? 'aan (stand 1)' : 'stand 0');
  }

  async setSpeed(v) {
    const level = Math.round(v / STEP);
    if (level === this.state?.level && this.state?.mode === MODE.MANUAL) return;
    await this.write(levelWrites(this.params, level), `stand ${level}`);
  }

  async setTargetState(v) {
    const mode = v === this.C.TargetFanState.AUTO ? MODE.AUTO : MODE.MANUAL;
    if (mode === this.state?.mode) return;
    await this.write(modeWrites(this.params, mode), mode === MODE.AUTO ? 'automatisch' : 'handmatig');
  }
}

module.exports = { FlairAccessory };
