(function () {
  const STORAGE_KEY = "settings";
  const MAC_PLATFORM = "mac";
  const OTHER_PLATFORM = "other";
  const SHORTCUT_KEY = "Enter";
  const MODIFIER_FIELDS = ["ctrlKey", "metaKey", "altKey", "shiftKey"];

  const LEGACY_SHORTCUTS = Object.freeze({
    enter: { key: SHORTCUT_KEY },
    shiftEnter: { key: SHORTCUT_KEY, shiftKey: true },
    ctrlEnter: { key: SHORTCUT_KEY, ctrlKey: true },
    metaEnter: { key: SHORTCUT_KEY, metaKey: true },
  });

  const DISPLAY_ORDER = Object.freeze({
    [MAC_PLATFORM]: [
      ["ctrlKey", "Control"],
      ["altKey", "Option"],
      ["shiftKey", "Shift"],
      ["metaKey", "Command"],
    ],
    [OTHER_PLATFORM]: [
      ["ctrlKey", "Ctrl"],
      ["altKey", "Alt"],
      ["shiftKey", "Shift"],
      ["metaKey", "Meta"],
    ],
  });

  function getPlatform() {
    if (typeof navigator === "undefined") {
      return OTHER_PLATFORM;
    }

    const platform = navigator.userAgentData?.platform || navigator.userAgent || "";
    return /mac|iphone|ipad|ipod/i.test(platform) ? MAC_PLATFORM : OTHER_PLATFORM;
  }

  function resolvePlatform(platform) {
    return platform || getPlatform();
  }

  function createShortcut(rawShortcut) {
    return {
      key: SHORTCUT_KEY,
      ctrlKey: !!(rawShortcut && rawShortcut.ctrlKey),
      metaKey: !!(rawShortcut && rawShortcut.metaKey),
      altKey: !!(rawShortcut && rawShortcut.altKey),
      shiftKey: !!(rawShortcut && rawShortcut.shiftKey),
    };
  }

  function migrateLegacyShortcut(rawShortcut) {
    return typeof rawShortcut === "string" && LEGACY_SHORTCUTS[rawShortcut]
      ? LEGACY_SHORTCUTS[rawShortcut]
      : rawShortcut;
  }

  function normalizeShortcut(rawShortcut, fallbackShortcut) {
    const fallback = fallbackShortcut == null ? null : createShortcut(fallbackShortcut);
    const candidate = migrateLegacyShortcut(rawShortcut);

    if (!candidate || typeof candidate !== "object") {
      return fallback;
    }

    if ((candidate.key && candidate.key !== SHORTCUT_KEY) || (candidate.code && candidate.code !== SHORTCUT_KEY)) {
      return fallback;
    }

    return createShortcut(candidate);
  }

  function serializeShortcut(shortcut) {
    const normalized = normalizeShortcut(shortcut, createShortcut());
    return [
      normalized.key,
      normalized.ctrlKey ? 1 : 0,
      normalized.metaKey ? 1 : 0,
      normalized.altKey ? 1 : 0,
      normalized.shiftKey ? 1 : 0,
    ].join(":");
  }

  function getDefaultSettings(platform) {
    const resolvedPlatform = resolvePlatform(platform);

    return {
      enabled: true,
      sendShortcut: createShortcut(
        resolvedPlatform === MAC_PLATFORM ? { metaKey: true } : { ctrlKey: true }
      ),
      newlineShortcut: createShortcut(),
    };
  }

  function normalizeSettings(rawSettings, platform) {
    const defaults = getDefaultSettings(platform);
    const normalized = {
      enabled:
        rawSettings && typeof rawSettings.enabled === "boolean"
          ? rawSettings.enabled
          : defaults.enabled,
      sendShortcut: normalizeShortcut(rawSettings && rawSettings.sendShortcut, defaults.sendShortcut),
      newlineShortcut: normalizeShortcut(
        rawSettings && rawSettings.newlineShortcut,
        defaults.newlineShortcut
      ),
    };

    if (hasShortcutConflict(normalized)) {
      return defaults;
    }

    return normalized;
  }

  function hasShortcutConflict(settings) {
    return (
      !!settings &&
      serializeShortcut(settings.sendShortcut) === serializeShortcut(settings.newlineShortcut)
    );
  }

  function matchesShortcut(event, shortcut) {
    const normalized = normalizeShortcut(shortcut, null);
    if (!event || !normalized || event.key !== SHORTCUT_KEY) {
      return false;
    }

    return MODIFIER_FIELDS.every((field) => !!event[field] === normalized[field]);
  }

  function buildShortcutFromKeyboardEvent(event) {
    if (!event || event.key !== SHORTCUT_KEY) {
      return null;
    }

    return createShortcut(event);
  }

  function formatShortcut(shortcut, platform) {
    const normalized = normalizeShortcut(shortcut, createShortcut());
    const labels = DISPLAY_ORDER[resolvePlatform(platform)];
    const parts = labels.filter(([field]) => normalized[field]).map(([, label]) => label);
    parts.push("Enter");
    return parts.join("+");
  }

  function describeBehavior(settings, platform) {
    const resolvedPlatform = resolvePlatform(platform);
    const normalized = normalizeSettings(settings, resolvedPlatform);
    return (
      formatShortcut(normalized.newlineShortcut, resolvedPlatform) +
      " inserts a newline, " +
      formatShortcut(normalized.sendShortcut, resolvedPlatform) +
      " sends the message."
    );
  }

  async function loadStoredSettings(platform) {
    const resolvedPlatform = resolvePlatform(platform);
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    const settings = normalizeSettings(result[STORAGE_KEY], resolvedPlatform);

    if (!(STORAGE_KEY in result) || JSON.stringify(result[STORAGE_KEY]) !== JSON.stringify(settings)) {
      await saveStoredSettings(settings, resolvedPlatform);
    }

    return settings;
  }

  async function saveStoredSettings(nextSettings, platform) {
    const normalized = normalizeSettings(nextSettings, platform);
    await chrome.storage.sync.set({
      [STORAGE_KEY]: normalized,
    });
    return normalized;
  }

  function subscribeToSettings(listener, platform) {
    const resolvedPlatform = resolvePlatform(platform);
    const handleStorageChange = (changes, areaName) => {
      if (areaName !== "sync" || !changes[STORAGE_KEY]) {
        return;
      }

      listener(normalizeSettings(changes[STORAGE_KEY].newValue, resolvedPlatform));
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }

  globalThis.ChatGptKeyboardRemapShared = {
    STORAGE_KEY,
    getPlatform,
    createShortcut,
    normalizeShortcut,
    getDefaultSettings,
    normalizeSettings,
    hasShortcutConflict,
    matchesShortcut,
    buildShortcutFromKeyboardEvent,
    formatShortcut,
    describeBehavior,
    loadStoredSettings,
    saveStoredSettings,
    subscribeToSettings,
  };
})();
