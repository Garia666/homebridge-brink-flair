'use strict';

// Alle namen die in de Woning-app verschijnen, met Nederlandse standaarden.
// Elke naam is los aan te passen in de instellingen (config.schema.json).
// Let op: HomeKit onthoudt de naam van een accessoire dat al gekoppeld is.

const DEFAULTS = {
  name: 'WTW',
  tempTileName: 'WTW temperatuur',
  pickerName: 'WTW stand',
  autoName: 'Automatisch',
  level0Name: 'Afwezig',
  level1Name: 'Laag',
  level2Name: 'Normaal',
  level3Name: 'Hoog',
  freshAirName: 'WTW buitenlucht',
  supplyAirName: 'WTW toevoerlucht',
  filterName: 'Filter',
  filterAlertName: 'WTW filter',
  faultAlertName: 'WTW storing',
};

function names(config = {}) {
  const out = {};
  for (const [k, d] of Object.entries(DEFAULTS)) out[k] = String(config[k] || '').trim() || d;
  out.levels = [out.level0Name, out.level1Name, out.level2Name, out.level3Name];
  return out;
}

module.exports = { names, DEFAULTS };
