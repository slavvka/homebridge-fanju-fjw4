# homebridge-fanju-fjw4

This is a Homebridge accessories plugin for [FanJu FJW4 Wi-Fi Weather Station](https://www.aliexpress.com/item/32955858516.html).

The plugin creates a platform with two separate accessories for indoor amd outdoor sensors in order to have a possibility to assign the to different rooms.

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plug-in using: `npm install -g homebridge-fanju-fjw4`
3. Update your configuration file. See example `config.json` snippet below.

# Configuration

Configuration sample (edit `~/.homebridge/config.json`):

```
    {
        "name": "FanJuFJW4"
        "platform": "FanJuFJW4",
        "options": {
            "username": "xxxx@gmail.com",
            "password": "xxxxxxxxxx"
        }
    }
```

Required fields:

- `name` Required. Must always be `FanJuFJW4`
- `platform` Required. Must always be `FanJuFJW4`
- `username` Required. The username used for authentication in the WeatherSense app
- `password` Required. The password used for authentication in the WeatherSense app
- `pollingInterval` Optional. The frequency in seconds that the plugin polls the cloud to get device updates.

# FanJu FJW4 WI-FI Weather Station Sensors

- _TemperatureSensor_ accessory indicating the ambient temperature at the main station
- _TemperatureSensor_ accessory indicating the ambient temperature at the wireless outdoor sensor
- _HumiditySensor_ accessory indicating the relative humidity at the main station
- _HumiditySensor_ accessory indicating the relative humidity at the wireless outdoor sensor
