# Changelog

## 1.1.1
- Package: declares HAP support (`supports-hap`); the developer probe script is no longer included in the npm package.

## 1.1.0
- New setting **Show fan tile**. Turned off, the fan tile becomes a temperature tile (WTW temperatuur) and the unit is controlled with the level picker only.

## 1.0.3
- Fix: names from the settings were not applied to an accessory that already existed, so Homebridge kept showing the names from the first install.
- Temperatures are rounded to one decimal.

## 1.0.2
- Fix: the settings page did not load (script error since 0.7.0), so the login and unit information were not shown.

## 1.0.1
- All asynchronous work (start-up, polling, writes) catches and logs its own errors.

## 1.0.0
- First public release. Tested on a Brink Flair 400 with Homebridge 2.4.0 and Node.js 24.

## 0.7.1
- Diagnostics: read the Homebridge version correctly on Homebridge 2.

## 0.7.0
- Debug logging option: every Brink Home request, the values read and written. No passwords or tokens.
- Copy diagnostics button on the settings page for GitHub issues (versions and all unit values; e-mail, serial and IP masked).
- Log messages in English.

## 0.6.0
- All tile and level names can be set in the plugin settings, with Dutch defaults and English descriptions.
- Units without an operating mode log a warning instead of failing when set to automatic.
- Extended setup guide in the README.

## 0.5.0
- Settings page in the Homebridge UI: Brink Home login (stored encrypted) and all unit information.
- No write to Brink Home when the unit is already in the requested state.

## 0.4.0
- Filter and fault contact sensors for Home app notifications; fault status on the fan.

## 0.3.0
- Level picker tile with named levels, like TV inputs.

## 0.2.0
- Four levels on the fan slider (25/50/75/100 %), off = automatic.
- Slider changes are combined before writing.

## 0.1.0
- First version: fan level, auto/manual mode, filter status, fresh and supply air temperature.
