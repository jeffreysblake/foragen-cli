/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DeviceAuthorizationInfo } from './useForaAuth.js';
import { useForaAuth } from './useForaAuth.js';
import {
  AuthType,
  foraOAuth2Events,
  ForaOAuth2Event,
} from '@jeffreysblake/foragen-cli-core';
import type { LoadedSettings } from '../../config/settings.js';

// Mock the foraOAuth2Events
vi.mock('@jeffreysblake/foragen-cli-core', async () => {
  const actual = await vi.importActual('@jeffreysblake/foragen-cli-core');
  const mockEmitter = {
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
  };
  return {
    ...actual,
    foraOAuth2Events: mockEmitter,
    ForaOAuth2Event: {
      AuthUri: 'authUri',
      AuthProgress: 'authProgress',
    },
  };
});

const mockForaOAuth2Events = vi.mocked(foraOAuth2Events);

describe('useForaAuth', () => {
  const mockDeviceAuth: DeviceAuthorizationInfo = {
    verification_uri: 'https://oauth.fora.com/device',
    verification_uri_complete: 'https://oauth.fora.com/device?user_code=ABC123',
    user_code: 'ABC123',
    expires_in: 1800,
  };

  const createMockSettings = (authType: AuthType): LoadedSettings =>
    ({
      merged: {
        security: {
          auth: {
            selectedType: authType,
          },
        },
      },
    }) as LoadedSettings;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state when not Fora auth', () => {
    const settings = createMockSettings(AuthType.USE_GEMINI);
    const { result } = renderHook(() => useForaAuth(settings, false));

    expect(result.current).toEqual({
      isForaAuthenticating: false,
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
      isForaAuth: false,
      cancelForaAuth: expect.any(Function),
    });
  });

  it('should initialize with default state when Fora auth but not authenticating', () => {
    const settings = createMockSettings(AuthType.FORA_OAUTH);
    const { result } = renderHook(() => useForaAuth(settings, false));

    expect(result.current).toEqual({
      isForaAuthenticating: false,
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
      isForaAuth: true,
      cancelForaAuth: expect.any(Function),
    });
  });

  it('should set up event listeners when Fora auth and authenticating', () => {
    const settings = createMockSettings(AuthType.FORA_OAUTH);
    renderHook(() => useForaAuth(settings, true));

    expect(mockForaOAuth2Events.on).toHaveBeenCalledWith(
      ForaOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockForaOAuth2Events.on).toHaveBeenCalledWith(
      ForaOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should handle device auth event', () => {
    const settings = createMockSettings(AuthType.FORA_OAUTH);
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationInfo) => void;

    mockForaOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === ForaOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockForaOAuth2Events;
    });

    const { result } = renderHook(() => useForaAuth(settings, true));

    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.authStatus).toBe('polling');
    expect(result.current.isForaAuthenticating).toBe(true);
  });

  it('should handle auth progress event - success', () => {
    const settings = createMockSettings(AuthType.FORA_OAUTH);
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockForaOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === ForaOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockForaOAuth2Events;
    });

    const { result } = renderHook(() => useForaAuth(settings, true));

    act(() => {
      handleAuthProgress!('success', 'Authentication successful!');
    });

    expect(result.current.authStatus).toBe('success');
    expect(result.current.authMessage).toBe('Authentication successful!');
  });

  it('should handle auth progress event - error', () => {
    const settings = createMockSettings(AuthType.FORA_OAUTH);
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockForaOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === ForaOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockForaOAuth2Events;
    });

    const { result } = renderHook(() => useForaAuth(settings, true));

    act(() => {
      handleAuthProgress!('error', 'Authentication failed');
    });

    expect(result.current.authStatus).toBe('error');
    expect(result.current.authMessage).toBe('Authentication failed');
  });

  it('should handle auth progress event - polling', () => {
    const settings = createMockSettings(AuthType.FORA_OAUTH);
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockForaOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === ForaOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockForaOAuth2Events;
    });

    const { result } = renderHook(() => useForaAuth(settings, true));

    act(() => {
      handleAuthProgress!('polling', 'Waiting for user authorization...');
    });

    expect(result.current.authStatus).toBe('polling');
    expect(result.current.authMessage).toBe(
      'Waiting for user authorization...',
    );
  });

  it('should handle auth progress event - rate_limit', () => {
    const settings = createMockSettings(AuthType.FORA_OAUTH);
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockForaOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === ForaOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockForaOAuth2Events;
    });

    const { result } = renderHook(() => useForaAuth(settings, true));

    act(() => {
      handleAuthProgress!(
        'rate_limit',
        'Too many requests. The server is rate limiting our requests. Please select a different authentication method or try again later.',
      );
    });

    expect(result.current.authStatus).toBe('rate_limit');
    expect(result.current.authMessage).toBe(
      'Too many requests. The server is rate limiting our requests. Please select a different authentication method or try again later.',
    );
  });

  it('should handle auth progress event without message', () => {
    const settings = createMockSettings(AuthType.FORA_OAUTH);
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockForaOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === ForaOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockForaOAuth2Events;
    });

    const { result } = renderHook(() => useForaAuth(settings, true));

    act(() => {
      handleAuthProgress!('success');
    });

    expect(result.current.authStatus).toBe('success');
    expect(result.current.authMessage).toBe(null);
  });

  it('should clean up event listeners when auth type changes', () => {
    const foraSettings = createMockSettings(AuthType.FORA_OAUTH);
    const { rerender } = renderHook(
      ({ settings, isAuthenticating }) =>
        useForaAuth(settings, isAuthenticating),
      { initialProps: { settings: foraSettings, isAuthenticating: true } },
    );

    // Change to non-Fora auth
    const geminiSettings = createMockSettings(AuthType.USE_GEMINI);
    rerender({ settings: geminiSettings, isAuthenticating: true });

    expect(mockForaOAuth2Events.off).toHaveBeenCalledWith(
      ForaOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockForaOAuth2Events.off).toHaveBeenCalledWith(
      ForaOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should clean up event listeners when authentication stops', () => {
    const settings = createMockSettings(AuthType.FORA_OAUTH);
    const { rerender } = renderHook(
      ({ isAuthenticating }) => useForaAuth(settings, isAuthenticating),
      { initialProps: { isAuthenticating: true } },
    );

    // Stop authentication
    rerender({ isAuthenticating: false });

    expect(mockForaOAuth2Events.off).toHaveBeenCalledWith(
      ForaOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockForaOAuth2Events.off).toHaveBeenCalledWith(
      ForaOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should clean up event listeners on unmount', () => {
    const settings = createMockSettings(AuthType.FORA_OAUTH);
    const { unmount } = renderHook(() => useForaAuth(settings, true));

    unmount();

    expect(mockForaOAuth2Events.off).toHaveBeenCalledWith(
      ForaOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockForaOAuth2Events.off).toHaveBeenCalledWith(
      ForaOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should reset state when switching from Fora auth to another auth type', () => {
    const foraSettings = createMockSettings(AuthType.FORA_OAUTH);
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationInfo) => void;

    mockForaOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === ForaOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockForaOAuth2Events;
    });

    const { result, rerender } = renderHook(
      ({ settings, isAuthenticating }) =>
        useForaAuth(settings, isAuthenticating),
      { initialProps: { settings: foraSettings, isAuthenticating: true } },
    );

    // Simulate device auth
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.authStatus).toBe('polling');

    // Switch to different auth type
    const geminiSettings = createMockSettings(AuthType.USE_GEMINI);
    rerender({ settings: geminiSettings, isAuthenticating: true });

    expect(result.current.isForaAuthenticating).toBe(false);
    expect(result.current.deviceAuth).toBe(null);
    expect(result.current.authStatus).toBe('idle');
    expect(result.current.authMessage).toBe(null);
  });

  it('should reset state when authentication stops', () => {
    const settings = createMockSettings(AuthType.FORA_OAUTH);
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationInfo) => void;

    mockForaOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === ForaOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockForaOAuth2Events;
    });

    const { result, rerender } = renderHook(
      ({ isAuthenticating }) => useForaAuth(settings, isAuthenticating),
      { initialProps: { isAuthenticating: true } },
    );

    // Simulate device auth
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.authStatus).toBe('polling');

    // Stop authentication
    rerender({ isAuthenticating: false });

    expect(result.current.isForaAuthenticating).toBe(false);
    expect(result.current.deviceAuth).toBe(null);
    expect(result.current.authStatus).toBe('idle');
    expect(result.current.authMessage).toBe(null);
  });

  it('should handle cancelForaAuth function', () => {
    const settings = createMockSettings(AuthType.FORA_OAUTH);
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationInfo) => void;

    mockForaOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === ForaOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockForaOAuth2Events;
    });

    const { result } = renderHook(() => useForaAuth(settings, true));

    // Set up some state
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.deviceAuth).toEqual(mockDeviceAuth);

    // Cancel auth
    act(() => {
      result.current.cancelForaAuth();
    });

    expect(result.current.isForaAuthenticating).toBe(false);
    expect(result.current.deviceAuth).toBe(null);
    expect(result.current.authStatus).toBe('idle');
    expect(result.current.authMessage).toBe(null);
  });

  it('should maintain isForaAuth flag correctly', () => {
    // Test with Fora OAuth
    const foraSettings = createMockSettings(AuthType.FORA_OAUTH);
    const { result: foraResult } = renderHook(() =>
      useForaAuth(foraSettings, false),
    );
    expect(foraResult.current.isForaAuth).toBe(true);

    // Test with other auth types
    const geminiSettings = createMockSettings(AuthType.USE_GEMINI);
    const { result: geminiResult } = renderHook(() =>
      useForaAuth(geminiSettings, false),
    );
    expect(geminiResult.current.isForaAuth).toBe(false);

    const oauthSettings = createMockSettings(AuthType.LOGIN_WITH_GOOGLE);
    const { result: oauthResult } = renderHook(() =>
      useForaAuth(oauthSettings, false),
    );
    expect(oauthResult.current.isForaAuth).toBe(false);
  });

  it('should set isForaAuthenticating to true when starting authentication with Fora auth', () => {
    const settings = createMockSettings(AuthType.FORA_OAUTH);
    const { result } = renderHook(() => useForaAuth(settings, true));

    expect(result.current.isForaAuthenticating).toBe(true);
    expect(result.current.authStatus).toBe('idle');
  });
});
