(function () {
  const STORAGE_KEY = "settings";
  const MAC_PLATFORM = "mac";
  const OTHER_PLATFORM = "other";

  const SHORTCUTS = Object.freeze({
    ENTER: "enter",
    SHIFT_ENTER: "shiftEnter",
    CTRL_ENTER: "ctrlEnter",
    META_ENTER: "metaEnter",
  });

  const SHORTCUT_OPTIONS = Object.freeze({
    [MAC_PLATFORM]: Object.freeze([
      { value: SHORTCUTS.ENTER, label: "Enter" },
      { value: SHORTCUTS.SHIFT_ENTER, label: "Shift+Enter" },
      { value: SHORTCUTS.META_ENTER, label: "Command+Enter" },
      { value: SHORTCUTS.CTRL_ENTER, label: "Control+Enter" },
    ]),
    [OTHER_PLATFORM]: Object.freeze([
      { value: SHORTCUTS.ENTER, label: "Enter" },
      { value: SHORTCUTS.SHIFT_ENTER, label: "Shift+Enter" },
      { value: SHORTCUTS.CTRL_ENTER, label: "Ctrl+Enter" },
    ]),
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

  function getShortcutOptions(platform) {
    return SHORTCUT_OPTIONS[resolvePlatform(platform)];
  }

  function getDefaultSettings(platform) {
    const resolvedPlatform = resolvePlatform(platform);

    return {
      enabled: true,
      sendShortcut:
        resolvedPlatform === MAC_PLATFORM ? SHORTCUTS.META_ENTER : SHORTCUTS.CTRL_ENTER,
      newlineShortcut: SHORTCUTS.ENTER,
    };
  }

  function normalizeSettings(rawSettings, platform) {
    const defaults = getDefaultSettings(platform);
    const allowedValues = new Set(getShortcutOptions(platform).map((option) => option.value));
    const normalized = {
      enabled:
        rawSettings && typeof rawSettings.enabled === "boolean"
          ? rawSettings.enabled
          : defaults.enabled,
      sendShortcut:
        rawSettings && allowedValues.has(rawSettings.sendShortcut)
          ? rawSettings.sendShortcut
          : defaults.sendShortcut,
      newlineShortcut:
        rawSettings && allowedValues.has(rawSettings.newlineShortcut)
          ? rawSettings.newlineShortcut
          : defaults.newlineShortcut,
    };

    if (hasShortcutConflict(normalized)) {
      return defaults;
    }

    return normalized;
  }

  function hasShortcutConflict(settings) {
    return !!settings && settings.sendShortcut === settings.newlineShortcut;
  }

  function matchesShortcut(event, shortcut) {
    if (!event || event.key !== "Enter" || event.altKey) {
      return false;
    }

    switch (shortcut) {
      case SHORTCUTS.ENTER:
        return !event.shiftKey && !event.ctrlKey && !event.metaKey;
      case SHORTCUTS.SHIFT_ENTER:
        return event.shiftKey && !event.ctrlKey && !event.metaKey;
      case SHORTCUTS.CTRL_ENTER:
        return event.ctrlKey && !event.shiftKey && !event.metaKey;
      case SHORTCUTS.META_ENTER:
        return event.metaKey && !event.shiftKey && !event.ctrlKey;
      default:
        return false;
    }
  }

  function formatShortcut(shortcut, platform) {
    const resolvedPlatform = resolvePlatform(platform);
    const option = getShortcutOptions(resolvedPlatform).find((item) => item.value === shortcut);
    return option ? option.label : "Enter";
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

    if (!(STORAGE_KEY in result)) {
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
    SHORTCUTS,
    getPlatform,
    getShortcutOptions,
    getDefaultSettings,
    normalizeSettings,
    hasShortcutConflict,
    matchesShortcut,
    formatShortcut,
    describeBehavior,
    loadStoredSettings,
    saveStoredSettings,
    subscribeToSettings,
  };
})();
