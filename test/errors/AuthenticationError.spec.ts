/*
 * Copyright (c) 2025. Slava Mankivski
 */

import { AuthenticationError } from "../../src/errors";

describe("AuthenticationError", () => {
  it("is instance of Error", () => {
    const err = new AuthenticationError("msg");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("msg");
  });
});
