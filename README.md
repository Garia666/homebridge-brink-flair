# homebridge-brink-flair

Brings a Brink Flair heat recovery unit (tested: Flair 400) into HomeKit through the Brink Home cloud.

HomeKit shows:
- **Fan**: ventilation level 0-3, auto/manual mode. "Off" sets level 0 (a heat recovery unit never stops completely).
- **Filter**: change-filter indication.
- **Temperature sensors**: fresh (outside) air and supply air.

## Setup

1. Install the plugin and add the platform to `config.json`:
   ```json
   { "platform": "BrinkFlair", "name": "Ventilatie", "pollSeconds": 60 }
   ```
2. Store the Brink Home login encrypted (two lines on stdin: e-mail, password):
   ```
   node tools/set-credentials.js /var/lib/homebridge
   ```
   The file `brink-flair.credentials` is encrypted with a key derived from the machine id.
3. Restart Homebridge.

`tools/probe.js` (with `BRINK_USER` / `BRINK_PASS` in the environment) lists all parameters read-only.

The Brink Home API is not officially documented; the login flow follows [samuolis/brink](https://github.com/samuolis/brink).
