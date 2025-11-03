/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { AuthType } from '@jeffreysblake/foragen-cli-core';
import { Box, Text } from 'ink';
import { validateAuthMethod } from '../../config/auth.js';
import { type LoadedSettings, SettingScope } from '../../config/settings.js';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { OpenAIKeyPrompt } from '../components/OpenAIKeyPrompt.js';
import { LocalModelPrompt } from '../components/LocalModelPrompt.js';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';

interface AuthDialogProps {
  onSelect: (
    authMethod: AuthType | undefined,
    scope: SettingScope,
    credentials?: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    },
  ) => void;
  settings: LoadedSettings;
  initialErrorMessage?: string | null;
}

function parseDefaultAuthType(
  defaultAuthType: string | undefined,
): AuthType | null {
  if (
    defaultAuthType &&
    Object.values(AuthType).includes(defaultAuthType as AuthType)
  ) {
    return defaultAuthType as AuthType;
  }
  return null;
}

export function AuthDialog({
  onSelect,
  settings,
  initialErrorMessage,
}: AuthDialogProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage || null,
  );
  const [showOpenAIKeyPrompt, setShowOpenAIKeyPrompt] = useState(false);
  const [showLocalModelPrompt, setShowLocalModelPrompt] = useState(false);
  const items = [
    {
      key: AuthType.FORA_OAUTH,
      label: 'Fora OAuth',
      value: AuthType.FORA_OAUTH,
    },
    { key: AuthType.USE_OPENAI, label: 'OpenAI', value: AuthType.USE_OPENAI },
    {
      key: AuthType.LOCAL,
      label: 'Local Model Server',
      value: AuthType.LOCAL,
    },
  ];

  const initialAuthIndex = Math.max(
    0,
    items.findIndex((item) => {
      if (settings.merged.security?.auth?.selectedType) {
        return item.value === settings.merged.security?.auth?.selectedType;
      }

      const defaultAuthType = parseDefaultAuthType(
        process.env['FORA_DEFAULT_AUTH_TYPE'],
      );
      if (defaultAuthType) {
        return item.value === defaultAuthType;
      }

      return item.value === AuthType.FORA_OAUTH;
    }),
  );

  const handleAuthSelect = (authMethod: AuthType) => {
    const error = validateAuthMethod(authMethod);
    if (error) {
      if (
        authMethod === AuthType.USE_OPENAI &&
        !process.env['OPENAI_API_KEY']
      ) {
        setShowOpenAIKeyPrompt(true);
        setErrorMessage(null);
      } else if (
        authMethod === AuthType.LOCAL &&
        !process.env['OPENAI_BASE_URL']
      ) {
        // Show local model prompt if no base URL is configured
        setShowLocalModelPrompt(true);
        setErrorMessage(null);
      } else {
        setErrorMessage(error);
      }
    } else {
      setErrorMessage(null);
      onSelect(authMethod, SettingScope.User);
    }
  };

  const handleOpenAIKeySubmit = (
    apiKey: string,
    baseUrl: string,
    model: string,
  ) => {
    setShowOpenAIKeyPrompt(false);
    onSelect(AuthType.USE_OPENAI, SettingScope.User, {
      apiKey,
      baseUrl,
      model,
    });
  };

  const handleOpenAIKeyCancel = () => {
    setShowOpenAIKeyPrompt(false);
    setErrorMessage('OpenAI API key is required to use OpenAI authentication.');
  };

  const handleLocalModelSubmit = (
    serverUrl: string,
    model: string,
    apiKey?: string,
  ) => {
    setShowLocalModelPrompt(false);
    onSelect(AuthType.LOCAL, SettingScope.User, {
      baseUrl: serverUrl,
      model,
      apiKey: apiKey || 'local', // Use 'local' as default if no API key provided
    });
  };

  const handleLocalModelCancel = () => {
    setShowLocalModelPrompt(false);
    setErrorMessage(
      'Local model server configuration is required to use local models.',
    );
  };

  useKeypress(
    (key) => {
      if (showOpenAIKeyPrompt || showLocalModelPrompt) {
        return;
      }

      if (key.name === 'escape') {
        // Prevent exit if there is an error message.
        // This means they user is not authenticated yet.
        if (errorMessage) {
          return;
        }
        if (settings.merged.security?.auth?.selectedType === undefined) {
          // Prevent exiting if no auth method is set
          setErrorMessage(
            'You must select an auth method to proceed. Press Ctrl+C again to exit.',
          );
          return;
        }
        onSelect(undefined, SettingScope.User);
      }
    },
    { isActive: true },
  );

  if (showOpenAIKeyPrompt) {
    return (
      <OpenAIKeyPrompt
        onSubmit={handleOpenAIKeySubmit}
        onCancel={handleOpenAIKeyCancel}
      />
    );
  }

  if (showLocalModelPrompt) {
    return (
      <LocalModelPrompt
        onSubmit={handleLocalModelSubmit}
        onCancel={handleLocalModelCancel}
        initialUrl={
          settings.merged.security?.auth?.baseUrl || 'http://localhost:1234'
        }
      />
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Get started</Text>
      <Box marginTop={1}>
        <Text>How would you like to authenticate for this project?</Text>
      </Box>
      <Box marginTop={1}>
        <RadioButtonSelect
          items={items}
          initialIndex={initialAuthIndex}
          onSelect={handleAuthSelect}
        />
      </Box>
      {errorMessage && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{errorMessage}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={Colors.AccentPurple}>(Use Enter to Set Auth)</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Terms of Services and Privacy Notice for Foragen CLI</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.AccentBlue}>
          {'https://github.com/jeffreysblake/foragen-cli/blob/main/README.md'}
        </Text>
      </Box>
    </Box>
  );
}
