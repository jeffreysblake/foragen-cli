/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { darkSemanticColors } from './semantic-tokens.js';

const foraDarkColors: ColorsTheme = {
  type: 'dark',
  Background: '#0b0e14',
  Foreground: '#bfbdb6',
  LightBlue: '#59C2FF',
  AccentBlue: '#39BAE6',
  AccentPurple: '#D2A6FF',
  AccentCyan: '#95E6CB',
  AccentGreen: '#AAD94C',
  AccentYellow: '#FFD700',
  AccentRed: '#F26D78',
  DiffAdded: '#AAD94C',
  DiffRemoved: '#F26D78',
  Comment: '#646A71',
  Gray: '#3D4149',
  GradientColors: ['#FFD700', '#da7959'],
};

export const ForaDark: Theme = new Theme(
  'Fora Dark',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: foraDarkColors.Background,
      color: foraDarkColors.Foreground,
    },
    'hljs-keyword': {
      color: foraDarkColors.AccentYellow,
    },
    'hljs-literal': {
      color: foraDarkColors.AccentPurple,
    },
    'hljs-symbol': {
      color: foraDarkColors.AccentCyan,
    },
    'hljs-name': {
      color: foraDarkColors.LightBlue,
    },
    'hljs-link': {
      color: foraDarkColors.AccentBlue,
    },
    'hljs-function .hljs-keyword': {
      color: foraDarkColors.AccentYellow,
    },
    'hljs-subst': {
      color: foraDarkColors.Foreground,
    },
    'hljs-string': {
      color: foraDarkColors.AccentGreen,
    },
    'hljs-title': {
      color: foraDarkColors.AccentYellow,
    },
    'hljs-type': {
      color: foraDarkColors.AccentBlue,
    },
    'hljs-attribute': {
      color: foraDarkColors.AccentYellow,
    },
    'hljs-bullet': {
      color: foraDarkColors.AccentYellow,
    },
    'hljs-addition': {
      color: foraDarkColors.AccentGreen,
    },
    'hljs-variable': {
      color: foraDarkColors.Foreground,
    },
    'hljs-template-tag': {
      color: foraDarkColors.AccentYellow,
    },
    'hljs-template-variable': {
      color: foraDarkColors.AccentYellow,
    },
    'hljs-comment': {
      color: foraDarkColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: foraDarkColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-deletion': {
      color: foraDarkColors.AccentRed,
    },
    'hljs-meta': {
      color: foraDarkColors.AccentYellow,
    },
    'hljs-doctag': {
      fontWeight: 'bold',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
  },
  foraDarkColors,
  darkSemanticColors,
);
