/*
 * Copyright (c) 2021. Slava Mankivski
 */

type Config = {
  options?: {
    username?: string;
    password?: string;
    pollingInterval?: number;
  };
};

export type WeatherStationConfig = Config;
