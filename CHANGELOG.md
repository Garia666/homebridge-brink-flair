# Changelog

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
