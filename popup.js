(function () {
  const shared = globalThis.ChatGptKeyboardRemapShared;

  if (!shared || !chrome || !chrome.storage || !chrome.storage.sync) {
    return;
  }

  const state = {
    platform: shared.getPlatform(),
    settings: shared.getDefaultSettings(),
    recordingField: null,
    messages: {
      sendShortcut: "",
      newlineShortcut: "",
    },
  };

  const elements = {
    popup: null,
    enabledToggle: null,
    sendShortcutValue: null,
    newlineShortcutValue: null,
    sendShortcutHelp: null,
    newlineShortcutHelp: null,
    recordButtons: [],
  };

  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize() {
    elements.popup = document.querySelector(".popup");
    elements.enabledToggle = document.getElementById("enabled-toggle");
    elements.sendShortcutValue = document.getElementById("send-shortcut-value");
    elements.newlineShortcutValue = document.getElementById("newline-shortcut-value");
    elements.sendShortcutHelp = document.getElementById("send-shortcut-help");
    elements.newlineShortcutHelp = document.getElementById("newline-shortcut-help");
    elements.recordButtons = Array.from(document.querySelectorAll(".record-button"));

    elements.enabledToggle.addEventListener("change", handleToggleChange);
    document.addEventListener("click", handleRecordButtonClick);
    window.addEventListener("keydown", handleRecordingKeydown, true);

    syncUi();

    try {
      state.settings = await shared.loadStoredSettings(state.platform);
      syncUi();
    } catch (error) {
      setMessage("sendShortcut", "");
      setMessage("newlineShortcut", "");
    }
  }

  async function handleToggleChange() {
    await persistSettings({
      ...state.settings,
      enabled: elements.enabledToggle.checked,
    });
  }

  function handleRecordButtonClick(event) {
    const button = event.target instanceof Element ? event.target.closest(".record-button") : null;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const fieldName = button.dataset.field;
    if (!fieldName) {
      return;
    }

    if (state.recordingField === fieldName) {
      stopRecording();
      return;
    }

    startRecording(fieldName);
  }

  async function handleRecordingKeydown(event) {
    if (!state.recordingField) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      stopRecording();
      return;
    }

    if (isModifierKey(event.key)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const shortcut = shared.buildShortcutFromKeyboardEvent(event);
    if (!shortcut) {
      setMessage(
        state.recordingField,
        "Press Enter with optional modifiers. Press Esc to cancel."
      );
      syncUi();
      return;
    }

    const nextSettings = {
      ...state.settings,
      [state.recordingField]: shortcut,
    };

    if (shared.hasShortcutConflict(nextSettings)) {
      setMessage(state.recordingField, "That shortcut is already used by the other action.");
      syncUi();
      return;
    }

    const fieldName = state.recordingField;
    await persistSettings(nextSettings);
    stopRecording();
    setMessage(fieldName, "");
    syncUi();
  }

  function isModifierKey(key) {
    return key === "Shift" || key === "Control" || key === "Alt" || key === "Meta";
  }

  function startRecording(fieldName) {
    state.recordingField = fieldName;
    clearMessages();
    setMessage(fieldName, "Press Enter with optional modifiers. Press Esc to cancel.");
    syncUi();
  }

  function stopRecording() {
    state.recordingField = null;
    clearMessages();
    syncUi();
  }

  async function persistSettings(nextSettings) {
    try {
      state.settings = await shared.saveStoredSettings(nextSettings, state.platform);
    } catch (error) {}
  }

  function clearMessages() {
    setMessage("sendShortcut", "");
    setMessage("newlineShortcut", "");
  }

  function setMessage(fieldName, message) {
    state.messages[fieldName] = message;
  }

  function syncUi() {
    elements.enabledToggle.checked = state.settings.enabled;
    elements.popup.classList.toggle("is-disabled", !state.settings.enabled);
    elements.sendShortcutValue.textContent = shared.formatShortcut(
      state.settings.sendShortcut,
      state.platform
    );
    elements.newlineShortcutValue.textContent = shared.formatShortcut(
      state.settings.newlineShortcut,
      state.platform
    );

    for (const button of elements.recordButtons) {
      if (!(button instanceof HTMLButtonElement)) {
        continue;
      }

      const fieldName = button.dataset.field;
      const isRecording = fieldName === state.recordingField;
      button.classList.toggle("is-recording", isRecording);
      const value = button.querySelector(".record-button__value");
      if (value instanceof HTMLElement && isRecording) {
        value.textContent = "Press shortcut...";
      }
    }

    syncHelpText(elements.sendShortcutHelp, state.messages.sendShortcut);
    syncHelpText(elements.newlineShortcutHelp, state.messages.newlineShortcut);
  }

  function syncHelpText(element, message) {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    const hasMessage = !!message;
    element.hidden = false;
    element.textContent = hasMessage ? message : "Click the shortcut box to set a new shortcut.";
    element.classList.toggle("is-error", hasMessage && /already used/i.test(message));
  }
})();
