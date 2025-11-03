/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import {
  pingLocalServer,
  normalizeServerUrl,
} from '@jeffreysblake/foragen-cli-core';

interface LocalModelPromptProps {
  onSubmit: (serverUrl: string, model: string, apiKey?: string) => void;
  onCancel: () => void;
  initialUrl?: string;
}

type FieldType = 'serverUrl' | 'apiKey' | 'model';

export function LocalModelPrompt({
  onSubmit,
  onCancel,
  initialUrl = 'http://localhost:1234',
}: LocalModelPromptProps): React.JSX.Element {
  const [serverUrl, setServerUrl] = useState(initialUrl);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [currentField, setCurrentField] = useState<FieldType>('serverUrl');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [serverStatus, setServerStatus] = useState<
    'unknown' | 'checking' | 'connected' | 'unreachable'
  >('unknown');
  const [statusMessage, setStatusMessage] = useState('');

  // Auto-check server health when URL changes
  useEffect(() => {
    const checkServer = async () => {
      const normalized = normalizeServerUrl(serverUrl);
      if (!normalized) {
        setServerStatus('unknown');
        setStatusMessage('');
        setAvailableModels([]);
        return;
      }

      setServerStatus('checking');
      setStatusMessage('Checking server...');

      const health = await pingLocalServer(normalized, 5000);

      if (health.isReachable && health.models) {
        setServerStatus('connected');
        setStatusMessage(
          `Connected (${health.responseTime}ms) - ${health.models.length} model(s) available`,
        );
        setAvailableModels(health.models);

        // Auto-select first model if no model is selected
        if (!model && health.models.length > 0) {
          setModel(health.models[0] || '');
        }
      } else {
        setServerStatus('unreachable');
        setStatusMessage(health.error || 'Server unreachable');
        setAvailableModels([]);
      }
    };

    // Debounce server checks
    const timeoutId = setTimeout(() => {
      void checkServer();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [serverUrl, model]);

  useKeypress(
    (key) => {
      // Handle escape
      if (key.name === 'escape') {
        onCancel();
        return;
      }

      // Handle Enter key
      if (key.name === 'return') {
        if (currentField === 'serverUrl') {
          setCurrentField('apiKey');
          return;
        } else if (currentField === 'apiKey') {
          // Skip to model selection
          if (availableModels.length > 0) {
            setCurrentField('model');
          } else {
            // If no models available, allow manual entry
            setCurrentField('model');
          }
          return;
        } else if (currentField === 'model') {
          // Submit if server is connected and model is selected
          if (serverStatus === 'connected' && model.trim()) {
            const normalized = normalizeServerUrl(serverUrl);
            onSubmit(normalized, model.trim(), apiKey.trim() || undefined);
          } else if (!model.trim()) {
            // If no model, go back to model field
            setCurrentField('model');
          } else {
            // If server not connected, go back to URL field
            setCurrentField('serverUrl');
          }
        }
        return;
      }

      // Handle Tab key for field navigation
      if (key.name === 'tab') {
        if (currentField === 'serverUrl') {
          setCurrentField('apiKey');
        } else if (currentField === 'apiKey') {
          setCurrentField('model');
        } else if (currentField === 'model') {
          setCurrentField('serverUrl');
        }
        return;
      }

      // Handle arrow keys for field navigation
      if (key.name === 'up') {
        if (currentField === 'apiKey') {
          setCurrentField('serverUrl');
        } else if (currentField === 'model') {
          setCurrentField('apiKey');
        }
        return;
      }

      if (key.name === 'down') {
        if (currentField === 'serverUrl') {
          setCurrentField('apiKey');
        } else if (currentField === 'apiKey') {
          setCurrentField('model');
        }
        return;
      }

      // Handle backspace/delete
      if (key.name === 'backspace' || key.name === 'delete') {
        if (currentField === 'serverUrl') {
          setServerUrl((prev) => prev.slice(0, -1));
        } else if (currentField === 'apiKey') {
          setApiKey((prev) => prev.slice(0, -1));
        } else if (currentField === 'model') {
          setModel((prev) => prev.slice(0, -1));
        }
        return;
      }

      // Handle paste mode - if it's a paste event with content
      if (key.paste && key.sequence) {
        let cleanInput = key.sequence
          .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '') // eslint-disable-line no-control-regex
          .replace(/\[200~/g, '')
          .replace(/\[201~/g, '')
          .replace(/^\[|~$/g, '');

        cleanInput = cleanInput
          .split('')
          .filter((ch) => ch.charCodeAt(0) >= 32)
          .join('');

        if (cleanInput.length > 0) {
          if (currentField === 'serverUrl') {
            setServerUrl((prev) => prev + cleanInput);
          } else if (currentField === 'apiKey') {
            setApiKey((prev) => prev + cleanInput);
          } else if (currentField === 'model') {
            setModel((prev) => prev + cleanInput);
          }
        }
        return;
      }

      // Handle regular character input
      if (key.sequence && !key.ctrl && !key.meta) {
        const cleanInput = key.sequence
          .split('')
          .filter((ch) => ch.charCodeAt(0) >= 32)
          .join('');

        if (cleanInput.length > 0) {
          if (currentField === 'serverUrl') {
            setServerUrl((prev) => prev + cleanInput);
          } else if (currentField === 'apiKey') {
            setApiKey((prev) => prev + cleanInput);
          } else if (currentField === 'model') {
            setModel((prev) => prev + cleanInput);
          }
        }
      }
    },
    { isActive: true },
  );

  // Get status indicator
  const getStatusIndicator = () => {
    switch (serverStatus) {
      case 'checking':
        return <Text color={Colors.AccentYellow}>⏳ Checking...</Text>;
      case 'connected':
        return <Text color={Colors.AccentGreen}>✓ Connected</Text>;
      case 'unreachable':
        return <Text color={Colors.AccentRed}>✗ Unreachable</Text>;
      default:
        return <Text color={Colors.Gray}>⋯ Not checked</Text>;
    }
  };

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={Colors.AccentBlue}>
        Local Model Server Configuration
      </Text>
      <Box marginTop={1}>
        <Text>
          Configure your local model server (Ollama, LM Studio, etc.). The
          server must support OpenAI-compatible API.
        </Text>
      </Box>

      {/* Server URL field */}
      <Box marginTop={1} flexDirection="row">
        <Box width={14}>
          <Text
            color={
              currentField === 'serverUrl' ? Colors.AccentBlue : Colors.Gray
            }
          >
            Server URL:
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'serverUrl' ? '> ' : '  '}
            {serverUrl || ' '}
          </Text>
        </Box>
      </Box>

      {/* Server status */}
      <Box marginTop={0} marginLeft={14} flexDirection="row">
        <Box flexGrow={1}>{getStatusIndicator()}</Box>
      </Box>
      {statusMessage && (
        <Box marginTop={0} marginLeft={14}>
          <Text color={Colors.Gray} dimColor>
            {statusMessage}
          </Text>
        </Box>
      )}

      {/* API Key field (optional) */}
      <Box marginTop={1} flexDirection="row">
        <Box width={14}>
          <Text
            color={currentField === 'apiKey' ? Colors.AccentBlue : Colors.Gray}
          >
            API Key:
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'apiKey' ? '> ' : '  '}
            {apiKey || '(optional)'}
          </Text>
        </Box>
      </Box>

      {/* Model field */}
      <Box marginTop={1} flexDirection="row">
        <Box width={14}>
          <Text
            color={currentField === 'model' ? Colors.AccentBlue : Colors.Gray}
          >
            Model:
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'model' ? '> ' : '  '}
            {model || ' '}
          </Text>
        </Box>
      </Box>

      {/* Show available models hint */}
      {availableModels.length > 0 && currentField === 'model' && (
        <Box marginTop={0} marginLeft={14}>
          <Text color={Colors.Gray} dimColor>
            Available: {availableModels.slice(0, 3).join(', ')}
            {availableModels.length > 3 &&
              ` +${availableModels.length - 3} more`}
          </Text>
        </Box>
      )}

      {/* Help text */}
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          Press Enter to continue, Tab/↑↓ to navigate, Esc to cancel
        </Text>
      </Box>

      {/* Submit hint */}
      {serverStatus === 'connected' && model.trim() && (
        <Box marginTop={0}>
          <Text color={Colors.AccentGreen}>
            ✓ Ready to connect! Press Enter on Model field to submit.
          </Text>
        </Box>
      )}
    </Box>
  );
}
