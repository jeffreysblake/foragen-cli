# Fora Code: Terms of Service and Privacy Notice

Fora Code is an open-source AI coding assistant tool maintained by the Fora Code team. This document outlines the terms of service and privacy policies that apply when using Fora Code's authentication methods and AI model services.

## How to determine your authentication method

Fora Code supports two main authentication methods to access AI models. Your authentication method determines which terms of service and privacy policies apply to your usage:

1. **Fora OAuth** - Log in with your fora.ai account
2. **OpenAI-Compatible API** - Use API keys from various AI model providers

For each authentication method, different Terms of Service and Privacy Notices may apply depending on the underlying service provider.

| Authentication Method | Provider          | Terms of Service                                                              | Privacy Notice                                       |
| :-------------------- | :---------------- | :---------------------------------------------------------------------------- | :--------------------------------------------------- |
| Fora OAuth            | Fora AI           | [Fora Terms of Service](https://fora.ai/termsservice)                         | [Fora Privacy Policy](https://fora.ai/privacypolicy) |
| OpenAI-Compatible API | Various Providers | Depends on your chosen API provider (OpenAI, Alibaba Cloud, ModelScope, etc.) | Depends on your chosen API provider                  |

## 1. If you are using Fora OAuth Authentication

When you authenticate using your fora.ai account, these Terms of Service and Privacy Notice documents apply:

- **Terms of Service:** Your use is governed by the [Fora Terms of Service](https://fora.ai/termsservice).
- **Privacy Notice:** The collection and use of your data is described in the [Fora Privacy Policy](https://fora.ai/privacypolicy).

For details about authentication setup, quotas, and supported features, see [Authentication Setup](./cli/authentication.md).

## 2. If you are using OpenAI-Compatible API Authentication

When you authenticate using API keys from OpenAI-compatible providers, the applicable Terms of Service and Privacy Notice depend on your chosen provider.

**Important:** When using OpenAI-compatible API authentication, you are subject to the terms and privacy policies of your chosen API provider, not Fora Code's terms. Please review your provider's documentation for specific details about data usage, retention, and privacy practices.

Fora Code supports various OpenAI-compatible providers. Please refer to your specific provider's terms of service and privacy policy for detailed information.

## Usage Statistics and Telemetry

Fora Code may collect anonymous usage statistics and telemetry data to improve the user experience and product quality. This data collection is optional and can be controlled through configuration settings.

### What Data is Collected

When enabled, Fora Code may collect:

- Anonymous usage statistics (commands run, performance metrics)
- Error reports and crash data
- Feature usage patterns

### Data Collection by Authentication Method

- **Fora OAuth:** Usage statistics are governed by Fora's privacy policy. You can opt-out through Fora Code's configuration settings.
- **OpenAI-Compatible API:** No additional data is collected by Fora Code beyond what your chosen API provider collects.

### Opt-Out Instructions

You can disable usage statistics collection by following the instructions in the [Usage Statistics Configuration](./cli/configuration.md#usage-statistics) documentation.

## Frequently Asked Questions (FAQ)

### 1. Is my code, including prompts and answers, used to train AI models?

Whether your code, including prompts and answers, is used to train AI models depends on your authentication method and the specific AI service provider you use:

- **Fora OAuth**: Data usage is governed by [Fora's Privacy Policy](https://fora.ai/privacy). Please refer to their policy for specific details about data collection and model training practices.

- **OpenAI-Compatible API**: Data usage depends entirely on your chosen API provider. Each provider has their own data usage policies. Please review the privacy policy and terms of service of your specific provider.

**Important**: Fora Code itself does not use your prompts, code, or responses for model training. Any data usage for training purposes would be governed by the policies of the AI service provider you authenticate with.

### 2. What are Usage Statistics and what does the opt-out control?

The **Usage Statistics** setting controls optional data collection by Fora Code for improving the user experience and product quality.

When enabled, Fora Code may collect:

- Anonymous telemetry (commands run, performance metrics, feature usage)
- Error reports and crash data
- General usage patterns

**What is NOT collected by Fora Code:**

- Your code content
- Prompts sent to AI models
- Responses from AI models
- Personal information

The Usage Statistics setting only controls data collection by Fora Code itself. It does not affect what data your chosen AI service provider (Fora, OpenAI, etc.) may collect according to their own privacy policies.

You can disable Usage Statistics collection by following the instructions in the [Usage Statistics Configuration](./cli/configuration.md#usage-statistics) documentation.

### 3. How do I switch between authentication methods?

You can switch between Fora OAuth and OpenAI-compatible API authentication at any time:

1. **During startup**: Choose your preferred authentication method when prompted
2. **Within the CLI**: Use the `/auth` command to reconfigure your authentication method
3. **Environment variables**: Set up `.env` files for automatic OpenAI-compatible API authentication

For detailed instructions, see the [Authentication Setup](./cli/authentication.md) documentation.
