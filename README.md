# Redirect Manager

A Manifest V3 extension for Chromium-based browsers to create and manage custom URL redirect rules.

## Features

- Customisable URL redirect rules
- Match hostnames, wildcard subdomains, or exact URLs
- Enable, disable, duplicate, delete, and reorder rules
- Import and export rule configurations
- Test URLs against configured rules
- Optionally log redirect activity

## Rule Behavior

- Rules are evaluated from top to bottom. The first enabled match is applied.
- Drag rule cards to change their evaluation priority.
- Add both `example.com` and `*.example.com` when the root domain and all subdomains must match.
- `*.example.com` matches subdomains such as `test.example.com`, but not the root domain `example.com`.
- Exact URL rules can optionally ignore query strings and URL fragments.
- If any destination does not include a protocol, https:// is assumed.

## Included Sample Rule

The extension includes a sample rule that redirects:
```
msn.com
*.msn.com
bing.com
*.bing.com
```
to:
```
about:newtab
```
The sample rule can be edited, disabled, or deleted from the extension settings.

## Installation

1. Download the ZIP file from releases.
2. Open `chrome://extensions` in a Chromium-based browser.
3. Enable **Developer mode**.
4. Drag the ZIP file onto the Extensions page.

If the browser does not accept direct installation:

1. Download & extract the ZIP from releases.
2. Open `chrome://extensions` in a Chromium-based browser.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted folder containing manifest.json.

## Package the Extension

1. Open `chrome://extensions` in a Chromium-based browser.
2. Enable **Developer mode**.
3. Select **Pack extension**.
4. Choose the project folder as the extension root directory.
5. Leave the private-key field empty when packaging the extension for the first time.

Chromium generates:
```
redirect-manager.crx
redirect-manager.pem
```
Keep the generated .pem file private and store it securely. Do not commit .pem files to Git.
The same key is required to preserve the extension ID when packaging future updates.

## Permissions

Redirect Manager requests the following permissions:

- `storage` to save rules, settings, and optional redirect logs.
- `webNavigation` to detect matching browser navigations.
- `tabs` to replace, create, or close tabs according to the selected redirect method.
- `<all_urls>` to allow rules to match any HTTP and HTTPS hosts.

The `<all_urls>` permission produces a broad site-access warning. Redirect Manager requires this permission because source hosts are configured by the user and cannot be declared individually when the extension is packaged.

All rule evaluation and redirect processing occur locally in the browser.