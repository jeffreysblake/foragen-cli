/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box } from 'ink';
import { RadioButtonSelect } from '../../shared/RadioButtonSelect.js';
import type { WizardStepProps } from '../types.js';

interface GenerationOption {
  label: string;
  value: 'fora' | 'manual';
}

const generationOptions: GenerationOption[] = [
  {
    label: 'Generate with Foragen CLI (Recommended)',
    value: 'fora',
  },
  {
    label: 'Manual Creation',
    value: 'manual',
  },
];

/**
 * Step 2: Generation method selection.
 */
export function GenerationMethodSelector({
  state,
  dispatch,
  onNext,
  onPrevious: _onPrevious,
}: WizardStepProps) {
  const handleSelect = (selectedValue: string) => {
    const method = selectedValue as 'fora' | 'manual';
    dispatch({ type: 'SET_GENERATION_METHOD', method });
    onNext();
  };

  return (
    <Box flexDirection="column">
      <RadioButtonSelect
        items={generationOptions.map((option) => ({
          key: option.value,
          label: option.label,
          value: option.value,
        }))}
        initialIndex={generationOptions.findIndex(
          (opt) => opt.value === state.generationMethod,
        )}
        onSelect={handleSelect}
        isFocused={true}
      />
    </Box>
  );
}
