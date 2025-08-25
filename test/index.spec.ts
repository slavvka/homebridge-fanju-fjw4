/*
 * Copyright (c) 2025. Slava Mankivski
 */

import register from "../src/index";

describe("index registration", () => {
  it("registers platform with Homebridge API", () => {
    const api = { registerPlatform: jest.fn() } as any;
    register(api);
    expect(api.registerPlatform).toHaveBeenCalled();
  });
});
