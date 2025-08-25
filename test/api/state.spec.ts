/*
 * Copyright (c) 2025. Slava Mankivski
 */

import { State } from "../../src/api/state";

describe("State", () => {
  it("should set and get realtime state", () => {
    const s = new State();
    const payload = { deviceMac: "AA:BB:CC", sensorDatas: [] };
    s.setState(payload);
    expect(s.getState()).toEqual(payload);
  });
});
