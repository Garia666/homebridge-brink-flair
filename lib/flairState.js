'use strict';

// Vertaalt de (Duitstalige) parameters van Brink Home naar een vaste toestand
// en terug. Eén plek waar de parameternamen staan.

const P = {
  level: 'Lüftungsstufe',
  mode: 'Betriebsart',
  filter: 'Status Filtermeldung',
  filterDays: 'Anzahl der Tage seit Filterreset',
  control: 'Aktive Regelung',
  supplyFlow: 'Ist-Wert Luftdurchsatz Zuluft',
  exhaustFlow: 'Ist-Wert Luftdurchsatz Abluft',
  freshTemp: 'Frischlufttemperatur',
  supplyTemp: 'Zulufttemperatur',
  bypass: 'Status Bypassklappe',
  model: 'deviceTypeTitle',
  software: 'softwareLabel',
};

const MODE = { AUTO: 0, MANUAL: 1 };
const LEVELS = 3; // standen 0 t/m 3

const num = (p) => (p == null || p.value == null || p.value === '' ? null : Number(p.value));

function parse(params) {
  const level = num(params[P.level]);
  return {
    // Buiten 0-3 (bijv. "4" voordat er via het portaal een stand is gezet) is de stand onbekend.
    level: level != null && level >= 0 && level <= LEVELS ? level : null,
    rawLevel: level,
    mode: num(params[P.mode]),
    filterDirty: num(params[P.filter]) === 1,
    filterDays: num(params[P.filterDays]),
    control: num(params[P.control]),
    supplyFlow: num(params[P.supplyFlow]),
    exhaustFlow: num(params[P.exhaustFlow]),
    freshTemp: num(params[P.freshTemp]),
    supplyTemp: num(params[P.supplyTemp]),
    bypassOpen: num(params[P.bypass]) === 3 || num(params[P.bypass]) === 1,
    model: params[P.model]?.value || 'Flair',
    software: params[P.software]?.value || '',
  };
}

// Schrijfopdrachten voor "zet stand X" (zet tegelijk handmatige modus).
function levelWrites(params, level) {
  const out = [];
  if (params[P.mode]?.valueId != null) out.push({ valueId: params[P.mode].valueId, value: MODE.MANUAL });
  out.push({ valueId: params[P.level].valueId, value: Math.min(Math.max(level, 0), LEVELS) });
  return out;
}

function modeWrites(params, mode) {
  return [{ valueId: params[P.mode].valueId, value: mode }];
}

module.exports = { P, MODE, LEVELS, parse, levelWrites, modeWrites };
