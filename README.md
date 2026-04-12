# ChatGPT Keyboard Remap

ChatGPT Keyboard Remap is a lightweight Manifest V3 Chrome extension that changes ChatGPT's composer shortcuts so `Enter` inserts a newline and `Ctrl+Enter` on Windows/Linux or `Command+Enter` on macOS sends the message by default.

It runs directly on:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

No framework, build step, or external dependency is required.

## Features

- IME-safe keyboard remapping for the ChatGPT composer
- Default behavior:
  - `Enter` inserts a newline
  - `Ctrl+Enter` sends on Windows/Linux
  - `Command+Enter` sends on macOS
- Popup settings UI for:
  - enabling or disabling the extension
  - choosing the send shortcut
  - choosing the newline shortcut
- Immediate updates through `chrome.storage.sync`
- Shortcut conflict prevention in the popup
- Unconfigured supported `Enter` shortcuts keep ChatGPT's native behavior
- Graceful failure when the ChatGPT DOM changes

## Supported shortcuts

The popup offers a compact, practical set of shortcuts.

On macOS:

- `Enter`
- `Shift+Enter`
- `Command+Enter`
- `Control+Enter`

On Windows/Linux:

- `Enter`
- `Shift+Enter`
- `Ctrl+Enter`

## Repository structure

```text
chatgpt-keyboard-remap/
├── .gitignore
├── LICENSE
├── README.md
├── jsconfig.json
├── assets/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       ├── icon-128.png
│       └── icon.svg
├── content.js
├── manifest.json
├── popup.css
├── popup.html
├── popup.js
├── shared.js
└── types/
    └── chrome-extension.d.ts
```

## How to load the unpacked extension

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `chatgpt-keyboard-remap` folder.
5. Pin the extension if you want quick access to the popup.

## How it works

### Architecture

- `manifest.json` registers the popup UI and injects the content script on ChatGPT pages.
- `shared.js` contains the small shared settings model, defaults, platform detection, and shortcut matching helpers used by both the popup and the content script.
- `content.js` listens for `keydown` events in the capture phase, detects the active ChatGPT composer, and either inserts a newline or clicks the native send button.
- For newline insertion, the content script first replays ChatGPT's native `Shift+Enter` path and only falls back to direct DOM insertion if needed.
- `popup.html`, `popup.css`, and `popup.js` provide a polished settings panel that stores preferences in `chrome.storage.sync`.

### ChatGPT DOM integration notes

The integration intentionally avoids brittle class names.

- The content script only acts when the key event originates from an editable field that appears to belong to the chat composer.
- It looks for a nearby `form` and a send button using stable-ish signals such as `data-testid="send-button"` or accessible labels containing `Send`.
- If no composer or send button can be identified, the script does nothing instead of forcing a fallback that might affect unrelated forms.

That means the extension should fail quietly if ChatGPT significantly changes its DOM, rather than break other inputs on the page.

### IME handling

The extension explicitly avoids remapping `Enter` while IME composition is active.

- It checks `event.isComposing`
- It tracks `compositionstart` and `compositionend` to avoid sending messages while composing Chinese, Japanese, or Korean text

## Known limitations

- ChatGPT's internal DOM is private and can change at any time.
- The send action prefers clicking ChatGPT's real send button; if that button cannot be found, the extension intentionally does nothing.
- Shortcut options are intentionally limited to a small, practical set instead of allowing arbitrary key combinations.

## Manual testing checklist

1. Load the unpacked extension in Chrome.
2. Open `https://chatgpt.com/` or `https://chat.openai.com/`.
3. Verify the default behavior:
   - `Enter` inserts a newline
   - `Ctrl+Enter` sends on Windows/Linux
   - `Command+Enter` sends on macOS
4. Click the extension icon and confirm the popup opens with the current settings.
5. Change the send shortcut, return to ChatGPT, and verify the new shortcut works without reloading the page.
6. Change the newline shortcut, return to ChatGPT, and verify the new shortcut works immediately.
7. Try setting both actions to the same shortcut and verify the popup blocks the invalid configuration.
8. Disable the extension in the popup and confirm ChatGPT returns to its native keyboard behavior.
9. Start a new chat and verify the remap still works after ChatGPT rerenders the composer.
10. If you use a Chinese, Japanese, or Korean IME, verify that pressing `Enter` during composition does not send the message.
