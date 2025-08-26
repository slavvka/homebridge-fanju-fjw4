/*
 * Copyright (c) 2021. Slava Mankivski
 */

/** Sensor types supported by the device. */
export enum SensorType {
  Temperature = 1,
  Humidity = 2,
}

/** Device metadata returned by the bound device endpoint. */
export type WeatherDevice = {
  id: number;
  mac: string;
  alias: string;
  sn: string;
  type: number;
  serial: number;
  lng: number;
  lat: number;
  geoHash: string;
  country: string;
  city: string;
  timezone: string;
  itimezone: number;
  woeid: string;
  isonline: boolean;
  loginTime: string;
  tickTime: string;
  updateTime: string;
  isDstOffset: boolean;
  matchingMode: string;
};

/** Shape of the realtime state payload provided by the cloud. */
export type RealtimeState = Partial<{
  deviceMac: string;
  devTimezone: number;
  devTime: string;
  atmos: number;
  wirelessStatus: number;
  powerStatus: number;
  weatherStatus: number;
  sensorDatas: SensorData[];
  updateTime: string;
}>;

/** Realtime sensor reading. */
export type SensorData = Partial<{
  type: SensorType;
  channel: number;
  power: number;
  curVal?: number;
  hihgVal?: number;
  lowVal?: number;
}>;

/** HTTP payload shape for bound device endpoint. */
export type BoundDevicePayload = {
  status: number;
  message: string;
  content: WeatherDevice;
};

/** HTTP payload shape for realtime state endpoint. */
export type RealtimeStatePayload = {
  status: number;
  message: string;
  content: RealtimeState;
};
