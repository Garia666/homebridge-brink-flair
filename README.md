# homebridge-brink-flair

Control your **Brink Flair** heat recovery ventilation unit (WTW) from Apple Home, through the Brink Home cloud.

Tested on a **Flair 400**. Other units that work with Brink Home are expected to work too (see [Compatibility](#compatibility)).

## Requirements

- **Homebridge 1.8 or newer, including Homebridge 2.** Tested on Homebridge 2.4.0.
- **Node.js 20, 22 or 24.** Tested on Node.js 24.21.0.
- A Brink unit connected to **Brink Home** (see below) and an internet connection.

## What you get in the Home app

| Tile | What it does |
|---|---|
| **WTW** (fan) | Off = **automatic** (the unit controls itself). 25 / 50 / 75 / 100 % = **level 0 / 1 / 2 / 3** (manual). |
| **WTW stand** (level picker) | Pick a level by name, like the inputs of a TV: Automatisch, Afwezig, Laag, Normaal, Hoog. |
| **Filter** | Filter indication on the fan tile. |
| **WTW filter** (contact sensor) | Opens when the filter needs replacing. Turn on notifications to get a push message. |
| **WTW storing** (contact sensor) | Opens when the unit reports a fault. |
| **WTW buitenlucht / toevoerlucht** | Fresh air and supply air temperature. |

All names default to Dutch and can be changed in the plugin settings. Each field has an English description.

**Only want the level picker?** Turn off **Show fan tile** in the settings. The fan tile then becomes **WTW temperatuur**: a temperature tile that shows the fresh air temperature on the tile itself, with the supply air temperature, filter and alerts inside. The Home app cannot show temperatures inside the level picker tile.

The Homebridge settings page of the plugin also shows everything Brink Home knows about your unit: serial number, model, software, IP address, mode, level, air flows, temperatures, bypass, pre-heater and filter status.

## Before you start: connect the Flair to Brink Home

The plugin talks to the Brink Home cloud, so your unit must be online and added to a Brink Home account first. You only do this once. The steps below follow Brink's own manual ([Brink Home Flair (NL), 614734](https://www.brinkclimatesystems.nl/documenten/brink-home-portal-installatievoorschriften-nl-614734.pdf)).

You need:
- the **serial number** of the unit: 12 digits on the sticker at the top right of the unit, under the QR code (without the letter in front)
- a phone, tablet or laptop with Wi-Fi
- the name and password of your home Wi-Fi

### Step 1 - Connect to the unit's own Wi-Fi

1. Turn off mobile data on your phone (keep Wi-Fi on).
2. Press the button on the Flair for about **1 second**. The LED blinks **green**. You now have **15 minutes** to connect.
3. In the Wi-Fi settings of your phone, pick the network **Flair** + the last 4 digits of the serial number (for example `Flair1818`).
4. The Wi-Fi password is the **12-digit serial number**. If your phone asks whether to stay connected (no internet), answer **yes**.
5. Open a browser and go to the address on the sticker inside the filter door (usually **http://Brink.local**), or scan the QR code on that sticker.

### Step 2 - Connect the unit to your home Wi-Fi

1. In the Flair user interface, tap the **gear** (settings), scroll down and open menu **13 Network** (Netwerk).
2. Choose **Wi-Fi network setup** (WiFi netwerk instellen) and wait at least 10 seconds for the list of networks.
3. Pick your home network and enter its password.
4. After 10-15 seconds the Wi-Fi symbol stays on and the LED blinks blue and green: the unit is online. Stay on this page.

### Step 3 - Register the unit with Brink Home

1. In menu **13 Network**, choose **Wi-Fi network setup**, then **WiFi**, and confirm with the double arrow.
2. Choose **Register Brink Home** (Aanmelden Brink Home).
3. Create a **device password** and enter it twice. All dots turn black when it is accepted. **Write this password down**: you need it in step 5.
4. After about 15 seconds a **globe** symbol appears next to the Wi-Fi symbol: the unit is registered.
5. Disconnect your phone from the Flair Wi-Fi and turn mobile data back on.

### Step 4 - Create a Brink Home account

1. Go to [www.brink-home.com](https://www.brink-home.com) and choose **Register now** (Nu registreren).
2. Enter your e-mail address twice, choose a language and an **account password** (this is a different password than the device password from step 3).
3. Accept the terms, submit, and follow the link in the confirmation e-mail.

### Step 5 - Add the unit to your account

This only works on the website, not in the Brink Home app.

1. Log in at [www.brink-home.com](https://www.brink-home.com).
2. Click **Add device** (Apparaat toevoegen).
3. Enter the **12-digit serial number** and the **device password** from step 3, then click **Add system**.
4. The unit appears in your system list and the LED on the unit is now steady blue.

You can now control the unit in the Brink Home portal and app, and the plugin can use it.

## Install the plugin

1. In the Homebridge UI, go to **Plugins**, search for `homebridge-brink-flair` and install it.
   Or on the command line: `sudo npm install -g homebridge-brink-flair`
2. Open the plugin **settings**. At the top, enter your **Brink Home e-mail and account password** (from step 4) and click **Save login**. The login is tested first, then stored **encrypted** in the Homebridge storage folder. It is never written to `config.json`.
3. Adjust names if you like, save, and **restart Homebridge**.
4. The fan, sensors and filter tiles appear in the Home app automatically (they are on the Homebridge bridge).
5. The **level picker** is a separate accessory, like a TV. Add it in the Home app: **+ > Add Accessory > More options**, pick **WTW stand**, and enter the Homebridge setup code.
6. In the Home app, open **WTW filter** and **WTW storing** and turn on **notifications**.

## Automations

- **Showering:** at 07:00 set **WTW** to 100 %, at 07:45 turn **WTW** off (= back to automatic).
- **Humidity sensor:** any HomeKit humidity sensor works, for example the IKEA TIMMERFLOTTE (Matter). Automation: when humidity rises above 70 %, set **WTW** to 100 %; when it drops below 60 %, turn **WTW** off.
- **Filter or fault:** let a lamp blink when **WTW filter** or **WTW storing** opens.

Changes reach the unit through the Brink Home cloud and take about 15-30 seconds.

## Compatibility

The plugin uses the Brink Home portal API, which is the same for every unit in Brink Home.

| Unit | Status |
|---|---|
| Flair 400 | Tested with this plugin |
| Flair 325, Renovent Excellent 300, Renovent Sky 300, Renovent 180 / 400 Plus | Reported working with the same API in the [Home Assistant integration](https://github.com/samuolis/brink) |
| Other Flair models (200, 225, 300, 450, 600) | Expected to work (same Brink Home platform), not tested yet |
| Renovent Excellent / Sky / Elan with Brink Home eModule | Expected to work, not tested yet |

Units without an operating mode in Brink Home cannot be switched to automatic; the plugin logs a warning in that case. Using another model? Please open an issue with the result, so this table can be updated.

## Troubleshooting

- **"No login stored"** in the log: enter your Brink Home login on the plugin settings page and restart Homebridge.
- **Login fails:** check that you can log in at [www.brink-home.com](https://www.brink-home.com) with the same e-mail and password.
- **No systems found:** the unit is not added to your account yet (step 5), or it is offline (no globe symbol).
- **New names do not show:** HomeKit keeps the names of accessories that are already added. Rename them in the Home app.

The Brink Home API is not officially documented by Brink. The login flow is based on the [samuolis/brink](https://github.com/samuolis/brink) Home Assistant integration (MIT).

## Support

Like this plugin? Support it at [garia.net](https://garia.net) or [Ko-fi](https://ko-fi.com/garianet).
