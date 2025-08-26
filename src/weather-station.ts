/*
 * Copyright (c) 2021. Slava Mankivski
 */

import type {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  Logging,
  Service,
} from "homebridge";
import { SensorType } from "./api/response";
import { DISPLAY_NAME, MANUFACTURER, MODEL, VERSION } from "./settings";

/**
 * WeatherStation accessory representing either Indoor or Outdoor sensors.
 *
 * Exposes:
 * - TemperatureSensor (CurrentTemperature)
 * - HumiditySensor (CurrentRelativeHumidity)
 *
 * Reads data from the platform-provided WeatherApi state cache on each GET request
 * (the Home app will trigger these frequently). When data is temporarily unavailable
 * the handlers return null to indicate TemporaryUnavailable to HAP.
 */
export class WeatherStation implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly config: AccessoryConfig;
  private readonly api: API;
  private readonly name: string;

  private readonly Service: typeof Service;
  private readonly Characteristic: typeof Characteristic;

  private readonly suffix: string;
  private readonly temperature: Service;
  private readonly temperatureName: string = "Temperature";
  private readonly humidity: Service;
  private readonly humidityName: string = "Humidity";
  private readonly informationService: Service;

  /**
   * Create a new WeatherStation accessory.
   * @param log Homebridge logger
   * @param config Accessory config (includes isIndoor, weatherApi, device)
   * @param api Homebridge API
   */
  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.name = config.name;

    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.suffix = this.config.isIndoor ? "Indoor" : "Outdoor";

    this.informationService = new this.Service.AccessoryInformation(
      DISPLAY_NAME + " " + this.suffix,
    );
    this.informationService
      .setCharacteristic(
        this.Characteristic.SerialNumber,
        this.config.device?.sn || "",
      )
      .setCharacteristic(this.Characteristic.Manufacturer, MANUFACTURER)
      .setCharacteristic(this.Characteristic.Model, MODEL)
      .setCharacteristic(
        this.Characteristic.Name,
        DISPLAY_NAME + " " + this.suffix,
      )
      .setCharacteristic(this.Characteristic.FirmwareRevision, VERSION)
      .setCharacteristic(this.Characteristic.SoftwareRevision, VERSION);

    this.temperature = new this.Service.TemperatureSensor(
      DISPLAY_NAME + " " + this.suffix + " " + this.temperatureName,
      this.temperatureName,
    );
    this.humidity = new this.Service.HumiditySensor(
      DISPLAY_NAME + " " + this.suffix + " " + this.humidityName,
      this.humidityName,
    );
    this.temperature
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.handleTemperatureGet.bind(this));
    this.humidity
      .getCharacteristic(this.Characteristic.CurrentRelativeHumidity)
      .onGet(this.handleHumidityGet.bind(this));

    this.log.debug("Finished initializing accessory:", this.config.name);
  }

  /** Convert Fahrenheit to Celsius. */
  private static fahrenheitToCelsius(fahrenheit: number): number {
    return ((fahrenheit - 32) * 5) / 9;
  }

  /**
   * Get sensor reading for the provided sensor type and channel from cached state.
   * @param type Sensor type (Temperature or Humidity)
   * @param channel 0 for Indoor, 1 for Outdoor
   */
  async getSensorData(type: SensorType, channel: number) {
    const state = await this.config.weatherApi?.getRealtimeState();
    return state?.sensorDatas?.find(
      (d: { type?: SensorType; channel?: number }) =>
        d?.type === type && d?.channel === channel,
    );
  }

  /** Handle CurrentTemperature GET. Returns null when data is unavailable. */
  async handleTemperatureGet() {
    const data = await this.getSensorData(
      SensorType.Temperature,
      this.config.isIndoor ? 0 : 1,
    );
    if (data?.curVal == null) {
      // Indicate temporary unavailability with null per HAP expectations
      return null;
    }
    this.log.info("Retrieved " + this.suffix + " temperature: " + data.curVal);
    return WeatherStation.fahrenheitToCelsius(data.curVal);
  }

  /** Handle CurrentRelativeHumidity GET. Returns null when data is unavailable. */
  async handleHumidityGet() {
    const data = await this.getSensorData(
      SensorType.Humidity,
      this.config.isIndoor ? 0 : 1,
    );
    if (data?.curVal == null) {
      return null;
    }
    this.log.info("Retrieved " + this.suffix + " humidity: " + data.curVal);
    return data.curVal;
  }

  /** Return HAP services exposed by this accessory. */
  getServices(): Service[] {
    return [this.informationService, this.temperature, this.humidity];
  }
}
