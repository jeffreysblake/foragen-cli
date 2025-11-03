/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import {
  AuthType,
  ModelSlashCommandEvent,
  logModelSlashCommand,
} from '@jeffreysblake/foragen-cli-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { Colors } from '../colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import {
  getAvailableModelsForAuthType,
  getAvailableModelsForAuthTypeAsync,
  type AvailableModel,
  MAINLINE_CODER,
} from '../models/availableModels.js';
import { loadSettings, SettingScope } from '../../config/settings.js';

interface ModelDialogProps {
  onClose: () => void;
}

export function ModelDialog({ onClose }: ModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext);

  // Get auth type from config, default to FORA_OAUTH if not available
  const authType = config?.getAuthType() ?? AuthType.FORA_OAUTH;

  // State for async model loading
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch models based on auth type
  useEffect(() => {
    const fetchModels = async () => {
      if (authType === AuthType.LOCAL) {
        setIsLoading(true);
        setError(null);
        try {
          const models = await getAvailableModelsForAuthTypeAsync(authType);
          setAvailableModels(models);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to fetch models from local server',
          );
          setAvailableModels([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Synchronous fetch for other auth types
        const models = getAvailableModelsForAuthType(authType);
        setAvailableModels(models);
      }
    };

    void fetchModels();
  }, [authType]);

  const MODEL_OPTIONS = useMemo(
    () =>
      availableModels.map((model) => ({
        value: model.id,
        title: model.label,
        description: model.description || '',
        key: model.id,
      })),
    [availableModels],
  );

  // Determine the Preferred Model (read once when the dialog opens).
  const preferredModel = config?.getModel() || MAINLINE_CODER;

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onClose();
      }
    },
    { isActive: true },
  );

  // Calculate the initial index based on the preferred model.
  const initialIndex = useMemo(
    () => MODEL_OPTIONS.findIndex((option) => option.value === preferredModel),
    [MODEL_OPTIONS, preferredModel],
  );

  // Handle selection internally (Autonomous Dialog).
  const handleSelect = useCallback(
    (model: string) => {
      if (config) {
        config.setModel(model);
        const event = new ModelSlashCommandEvent(model);
        logModelSlashCommand(config, event);

        // Persist model selection to settings
        const settings = loadSettings();
        settings.setValue(SettingScope.User, 'model.name', model);
      }
      onClose();
    },
    [config, onClose],
  );

  // Show loading state
  if (isLoading) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.border.default}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold>Select Model</Text>
        <Box marginTop={1} flexDirection="row" gap={1}>
          <Text color={theme.text.accent}>
            <Spinner type="dots" />
          </Text>
          <Text>Fetching models from local server...</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>(Press Esc to cancel)</Text>
        </Box>
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.AccentRed}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold color={Colors.AccentRed}>
          Error Fetching Models
        </Text>
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            Please check that your local model server is running and accessible.
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>(Press Esc to close)</Text>
        </Box>
      </Box>
    );
  }

  // Show model selection
  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Select Model</Text>
      <Box marginTop={1}>
        {MODEL_OPTIONS.length > 0 ? (
          <DescriptiveRadioButtonSelect
            items={MODEL_OPTIONS}
            onSelect={handleSelect}
            initialIndex={initialIndex}
            showNumbers={true}
          />
        ) : (
          <Text color={Colors.AccentYellow}>
            No models available for {authType} authentication.
          </Text>
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>(Press Esc to close)</Text>
      </Box>
    </Box>
  );
}
