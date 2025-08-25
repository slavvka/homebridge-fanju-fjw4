/*
 * Copyright (c) 2025. Slava Mankivski
 */

import {Session} from '../../src/api/session';

describe('Session', () => {
  it('should store and return access token', () => {
    const session = new Session('token-1');
    expect(session.hasToken()).toBe(true);
    expect(session.getAccessToken()).toBe('token-1');

    session.resetToken('token-2');
    expect(session.getAccessToken()).toBe('token-2');
  });
});


