/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { lightSemanticColors } from './semantic-tokens.js';

const foraLightColors: ColorsTheme = {
  type: 'light',
  Background: '#f8f9fa',
  Foreground: '#5c6166',
  LightBlue: '#55b4d4',
  AccentBlue: '#399ee6',
  AccentPurple: '#a37acc',
  AccentCyan: '#4cbf99',
  AccentGreen: '#86b300',
  AccentYellow: '#f2ae49',
  AccentRed: '#f07171',
  DiffAdded: '#86b300',
  DiffRemoved: '#f07171',
  Comment: '#ABADB1',
  Gray: '#CCCFD3',
  GradientColors: ['#399ee6', '#86b300'],
};

export const ForaLight: Theme = new Theme(
  'Fora Light',
  'light',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: foraLightColors.Background,
      color: foraLightColors.Foreground,
    },
    'hljs-comment': {
      color: foraLightColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: foraLightColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-string': {
      color: foraLightColors.AccentGreen,
    },
    'hljs-constant': {
      color: foraLightColors.AccentCyan,
    },
    'hljs-number': {
      color: foraLightColors.AccentPurple,
    },
    'hljs-keyword': {
      color: foraLightColors.AccentYellow,
    },
    'hljs-selector-tag': {
      color: foraLightColors.AccentYellow,
    },
    'hljs-attribute': {
      color: foraLightColors.AccentYellow,
    },
    'hljs-variable': {
      color: foraLightColors.Foreground,
    },
    'hljs-variable.language': {
      color: foraLightColors.LightBlue,
      fontStyle: 'italic',
    },
    'hljs-title': {
      color: foraLightColors.AccentBlue,
    },
    'hljs-section': {
      color: foraLightColors.AccentGreen,
      fontWeight: 'bold',
    },
    'hljs-type': {
      color: foraLightColors.LightBlue,
    },
    'hljs-class .hljs-title': {
      color: foraLightColors.AccentBlue,
    },
    'hljs-tag': {
      color: foraLightColors.LightBlue,
    },
    'hljs-name': {
      color: foraLightColors.AccentBlue,
    },
    'hljs-builtin-name': {
      color: foraLightColors.AccentYellow,
    },
    'hljs-meta': {
      color: foraLightColors.AccentYellow,
    },
    'hljs-symbol': {
      color: foraLightColors.AccentRed,
    },
    'hljs-bullet': {
      color: foraLightColors.AccentYellow,
    },
    'hljs-regexp': {
      color: foraLightColors.AccentCyan,
    },
    'hljs-link': {
      color: foraLightColors.LightBlue,
    },
    'hljs-deletion': {
      color: foraLightColors.AccentRed,
    },
    'hljs-addition': {
      color: foraLightColors.AccentGreen,
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-literal': {
      color: foraLightColors.AccentCyan,
    },
    'hljs-built_in': {
      color: foraLightColors.AccentRed,
    },
    'hljs-doctag': {
      color: foraLightColors.AccentRed,
    },
    'hljs-template-variable': {
      color: foraLightColors.AccentCyan,
    },
    'hljs-selector-id': {
      color: foraLightColors.AccentRed,
    },
  },
  foraLightColors,
  lightSemanticColors,
);
