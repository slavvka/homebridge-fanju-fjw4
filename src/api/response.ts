/*
 * Copyright (c) 2021. Slava Mankivski
 */

export enum SensorType {
  Temperature = 1,
  Humidity = 2,
}

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

export type SensorData = Partial<{
  type: SensorType;
  channel: number;
  power: number;
  curVal?: number;
  hihgVal?: number;
  lowVal?: number;
}>;

export type BoundDevicePayload = {
  status: number;
  message: string;
  content: WeatherDevice;
};

export type RealtimeStatePayload = {
  status: number;
  message: string;
  content: RealtimeState;
};
