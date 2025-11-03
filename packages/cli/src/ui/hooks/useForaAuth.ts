/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import type { LoadedSettings } from '../../config/settings.js';
import {
  AuthType,
  foraOAuth2Events,
  ForaOAuth2Event,
} from '@jeffreysblake/foragen-cli-core';

export interface DeviceAuthorizationInfo {
  verification_uri: string;
  verification_uri_complete: string;
  user_code: string;
  expires_in: number;
}

interface ForaAuthState {
  isForaAuthenticating: boolean;
  deviceAuth: DeviceAuthorizationInfo | null;
  authStatus:
    | 'idle'
    | 'polling'
    | 'success'
    | 'error'
    | 'timeout'
    | 'rate_limit';
  authMessage: string | null;
}

export const useForaAuth = (
  settings: LoadedSettings,
  isAuthenticating: boolean,
) => {
  const [foraAuthState, setForaAuthState] = useState<ForaAuthState>({
    isForaAuthenticating: false,
    deviceAuth: null,
    authStatus: 'idle',
    authMessage: null,
  });

  const isForaAuth =
    settings.merged.security?.auth?.selectedType === AuthType.FORA_OAUTH;

  // Set up event listeners when authentication starts
  useEffect(() => {
    if (!isForaAuth || !isAuthenticating) {
      // Reset state when not authenticating or not Fora auth
      setForaAuthState({
        isForaAuthenticating: false,
        deviceAuth: null,
        authStatus: 'idle',
        authMessage: null,
      });
      return;
    }

    setForaAuthState((prev) => ({
      ...prev,
      isForaAuthenticating: true,
      authStatus: 'idle',
    }));

    // Set up event listeners
    const handleDeviceAuth = (deviceAuth: DeviceAuthorizationInfo) => {
      setForaAuthState((prev) => ({
        ...prev,
        deviceAuth: {
          verification_uri: deviceAuth.verification_uri,
          verification_uri_complete: deviceAuth.verification_uri_complete,
          user_code: deviceAuth.user_code,
          expires_in: deviceAuth.expires_in,
        },
        authStatus: 'polling',
      }));
    };

    const handleAuthProgress = (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => {
      setForaAuthState((prev) => ({
        ...prev,
        authStatus: status,
        authMessage: message || null,
      }));
    };

    // Add event listeners
    foraOAuth2Events.on(ForaOAuth2Event.AuthUri, handleDeviceAuth);
    foraOAuth2Events.on(ForaOAuth2Event.AuthProgress, handleAuthProgress);

    // Cleanup event listeners when component unmounts or auth finishes
    return () => {
      foraOAuth2Events.off(ForaOAuth2Event.AuthUri, handleDeviceAuth);
      foraOAuth2Events.off(ForaOAuth2Event.AuthProgress, handleAuthProgress);
    };
  }, [isForaAuth, isAuthenticating]);

  const cancelForaAuth = useCallback(() => {
    // Emit cancel event to stop polling
    foraOAuth2Events.emit(ForaOAuth2Event.AuthCancel);

    setForaAuthState({
      isForaAuthenticating: false,
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
    });
  }, []);

  return {
    ...foraAuthState,
    isForaAuth,
    cancelForaAuth,
  };
};
