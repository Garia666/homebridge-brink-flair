'use strict';

// Keuzelijst met standnamen, zoals de ingangen van een tv of versterker in de
// Woning-app. HomeKit toont zo'n keuzelijst alleen bij een Television-dienst,
// en die moet als los (extern) accessoire gepubliceerd worden.

const { MODE } = require('./flairState');

const AUTO_ID = 1; // Identifier 1 = automatisch, 2-5 = stand 0-3

class FlairPicker {
  constructor(platform, device, names) {
    const { hap } = platform.api;
    const { Service, Characteristic: C, Categories } = hap;
    this.C = C;
    this.device = device;
    const name = `${platform.config.name || 'WTW'} stand`;

    const acc = new platform.api.platformAccessory(name, hap.uuid.generate(`brink-flair-picker-${device.system.id}`), Categories.AIR_PURIFIER);
    acc.getService(Service.AccessoryInformation)
      .setCharacteristic(C.Manufacturer, 'Brink Climate Systems')
      .setCharacteristic(C.Model, 'Flair')
      .setCharacteristic(C.SerialNumber, `${device.system.serial || device.system.id}-stand`);

    this.tv = acc.addService(Service.Television, name);
    this.tv.setCharacteristic(C.ConfiguredName, name)
      .setCharacteristic(C.SleepDiscoveryMode, C.SleepDiscoveryMode.ALWAYS_DISCOVERABLE)
      .setCharacteristic(C.Active, C.Active.ACTIVE);
    // Uit = automatisch; de lijst blijft dan gewoon kiesbaar.
    this.tv.getCharacteristic(C.Active).onSet((v) => {
      if (v === C.Active.INACTIVE) device.schedule({ auto: true });
    });
    this.tv.getCharacteristic(C.ActiveIdentifier).onSet((id) => {
      device.schedule(id === AUTO_ID ? { auto: true } : { level: id - 2 });
    });

    ['Automatisch', ...names].forEach((label, i) => {
      const input = acc.addService(Service.InputSource, label, `stand-${i}`);
      input.setCharacteristic(C.Identifier, i + 1)
        .setCharacteristic(C.ConfiguredName, label)
        .setCharacteristic(C.IsConfigured, C.IsConfigured.CONFIGURED)
        .setCharacteristic(C.InputSourceType, C.InputSourceType.OTHER)
        .setCharacteristic(C.CurrentVisibilityState, C.CurrentVisibilityState.SHOWN);
      this.tv.addLinkedService(input);
    });

    this.accessory = acc;
  }

  show(mode, level) {
    const id = mode === MODE.AUTO || level == null ? AUTO_ID : level + 2;
    this.tv.updateCharacteristic(this.C.Active, this.C.Active.ACTIVE);
    this.tv.updateCharacteristic(this.C.ActiveIdentifier, id);
  }
}

module.exports = { FlairPicker };
