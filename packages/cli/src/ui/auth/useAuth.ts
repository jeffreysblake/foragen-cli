/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import type { LoadedSettings } from '../../config/settings.js';
import { SettingScope } from '../../config/settings.js';
import type { AuthType, Config } from '@jeffreysblake/foragen-cli-core';
import {
  clearCachedCredentialFile,
  getErrorMessage,
  autoDetectLocalServer,
} from '@jeffreysblake/foragen-cli-core';
import { AuthState } from '../types.js';
import { validateAuthMethod } from '../../config/auth.js';
import { clearLocalModelCache } from '../models/availableModels.js';

export function validateAuthMethodWithSettings(
  authType: AuthType,
  settings: LoadedSettings,
): string | null {
  const enforcedType = settings.merged.security?.auth?.enforcedType;
  if (enforcedType && enforcedType !== authType) {
    return `Authentication is enforced to be ${enforcedType}, but you are currently using ${authType}.`;
  }
  if (settings.merged.security?.auth?.useExternal) {
    return null;
  }
  return validateAuthMethod(authType);
}

export const useAuthCommand = (settings: LoadedSettings, config: Config) => {
  const unAuthenticated =
    settings.merged.security?.auth?.selectedType === undefined;

  const [authState, setAuthState] = useState<AuthState>(
    unAuthenticated ? AuthState.Updating : AuthState.Unauthenticated,
  );

  const [authError, setAuthError] = useState<string | null>(null);

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(unAuthenticated);
  const [autoDetectionAttempted, setAutoDetectionAttempted] = useState(false);

  const onAuthError = useCallback(
    (error: string | null) => {
      setAuthError(error);
      if (error) {
        setAuthState(AuthState.Updating);
        setIsAuthDialogOpen(true);
      }
    },
    [setAuthError, setAuthState],
  );

  // Auto-detection of local model servers on first run
  useEffect(() => {
    const detectLocalServer = async () => {
      // Only attempt auto-detection once and only if no auth type is selected
      if (
        autoDetectionAttempted ||
        settings.merged.security?.auth?.selectedType
      ) {
        return;
      }

      setAutoDetectionAttempted(true);

      // Known servers to check (user's LM Studio server first, then common ports)
      const knownServers = ['http://192.168.1.227:1234'];

      console.log('Attempting to auto-detect local model servers...');

      const detected = await autoDetectLocalServer(knownServers, true);

      if (detected && detected.models.length > 0) {
        console.log(
          `Auto-detected local model server at ${detected.url} with ${detected.models.length} model(s)`,
        );

        // Auto-populate settings with detected server
        config.updateCredentials({
          apiKey: 'local', // Default API key for local servers
          baseUrl: detected.url,
          model: detected.models[0], // Use first available model
        });

        settings.setValue(SettingScope.User, 'security.auth.apiKey', 'local');
        settings.setValue(
          SettingScope.User,
          'security.auth.baseUrl',
          detected.url,
        );
        settings.setValue(
          SettingScope.User,
          'model.name',
          detected.models[0] || '',
        );
        settings.setValue(
          SettingScope.User,
          'security.auth.selectedType',
          'local',
        );

        // Close auth dialog since we auto-configured
        setIsAuthDialogOpen(false);
      } else {
        console.log('No local model servers detected');
      }
    };

    void detectLocalServer();
  }, [autoDetectionAttempted, settings, config]);

  // Authentication flow
  useEffect(() => {
    const authFlow = async () => {
      const authType = settings.merged.security?.auth?.selectedType;
      if (isAuthDialogOpen || !authType) {
        return;
      }

      const validationError = validateAuthMethodWithSettings(
        authType,
        settings,
      );
      if (validationError) {
        // For LOCAL auth, if validation fails due to server unavailability,
        // clear the config and show auth dialog
        if (authType === 'local') {
          console.log(
            'Local model server configuration invalid or server unreachable. Clearing config.',
          );
          settings.setValue(
            SettingScope.User,
            'security.auth.selectedType',
            undefined,
          );
          settings.setValue(
            SettingScope.User,
            'security.auth.baseUrl',
            undefined,
          );
        }
        onAuthError(validationError);
        return;
      }

      // Additional health check for LOCAL auth type
      if (authType === 'local') {
        const baseUrl = settings.merged.security?.auth?.baseUrl;
        if (baseUrl) {
          console.log(`Checking local model server health at ${baseUrl}...`);
          const { pingLocalServer } = await import(
            '@jeffreysblake/foragen-cli-core'
          );
          const health = await pingLocalServer(baseUrl, 5000);

          if (!health.isReachable) {
            console.log(
              `Local model server at ${baseUrl} is unreachable: ${health.error}`,
            );
            // Clear invalid config and show auth dialog
            settings.setValue(
              SettingScope.User,
              'security.auth.selectedType',
              undefined,
            );
            settings.setValue(
              SettingScope.User,
              'security.auth.baseUrl',
              undefined,
            );
            onAuthError(
              `Local model server at ${baseUrl} is unreachable. ${health.error || 'Please check the server and try again.'}`,
            );
            return;
          }

          console.log(
            `Local model server is reachable (${health.responseTime}ms)`,
          );
        }
      }

      try {
        setIsAuthenticating(true);
        await config.refreshAuth(authType);
        console.log(`Authenticated via "${authType}".`);
        setAuthError(null);
        setAuthState(AuthState.Authenticated);
      } catch (e) {
        onAuthError(`Failed to login. Message: ${getErrorMessage(e)}`);
      } finally {
        setIsAuthenticating(false);
      }
    };

    void authFlow();
  }, [isAuthDialogOpen, settings, config, onAuthError]);

  // Handle auth selection from dialog
  const handleAuthSelect = useCallback(
    async (
      authType: AuthType | undefined,
      scope: SettingScope,
      credentials?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
      },
    ) => {
      if (authType) {
        await clearCachedCredentialFile();
        // Clear model cache when changing auth types
        clearLocalModelCache();

        // Save OpenAI credentials if provided
        if (credentials) {
          // Update Config's internal generationConfig before calling refreshAuth
          // This ensures refreshAuth has access to the new credentials
          config.updateCredentials({
            apiKey: credentials.apiKey,
            baseUrl: credentials.baseUrl,
            model: credentials.model,
          });

          // Also set environment variables for compatibility with other parts of the code
          if (credentials.apiKey) {
            settings.setValue(
              scope,
              'security.auth.apiKey',
              credentials.apiKey,
            );
          }
          if (credentials.baseUrl) {
            settings.setValue(
              scope,
              'security.auth.baseUrl',
              credentials.baseUrl,
            );
          }
          if (credentials.model) {
            settings.setValue(scope, 'model.name', credentials.model);
          }
        }

        settings.setValue(scope, 'security.auth.selectedType', authType);
      }

      setIsAuthDialogOpen(false);
      setAuthError(null);
    },
    [settings, config],
  );

  const openAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(true);
  }, []);

  const cancelAuthentication = useCallback(() => {
    setIsAuthenticating(false);
  }, []);

  return {
    authState,
    setAuthState,
    authError,
    onAuthError,
    isAuthDialogOpen,
    isAuthenticating,
    handleAuthSelect,
    openAuthDialog,
    cancelAuthentication,
  };
};
