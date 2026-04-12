(function () {
  const shared = globalThis.ChatGptKeyboardRemapShared;

  if (!shared || !chrome || !chrome.storage || !chrome.storage.sync) {
    return;
  }

  const state = {
    platform: shared.getPlatform(),
    settings: shared.getDefaultSettings(),
  };

  const elements = {
    popup: null,
    enabledToggle: null,
    sendShortcuts: null,
    newlineShortcuts: null,
  };

  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize() {
    elements.popup = document.querySelector(".popup");
    elements.enabledToggle = document.getElementById("enabled-toggle");
    elements.sendShortcuts = document.getElementById("send-shortcuts");
    elements.newlineShortcuts = document.getElementById("newline-shortcuts");

    elements.enabledToggle.addEventListener("change", handleToggleChange);
    elements.sendShortcuts.addEventListener("click", handleShortcutSelection);
    elements.newlineShortcuts.addEventListener("click", handleShortcutSelection);

    renderShortcutGroup(elements.sendShortcuts, "sendShortcut");
    renderShortcutGroup(elements.newlineShortcuts, "newlineShortcut");
    syncUi();

    try {
      state.settings = await shared.loadStoredSettings(state.platform);
      syncUi();
    } catch (error) {}
  }

  function renderShortcutGroup(container, fieldName) {
    const options = shared.getShortcutOptions(state.platform);
    const buttons = options.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "shortcut-button";
      button.dataset.field = fieldName;
      button.dataset.value = option.value;
      button.setAttribute("role", "radio");
      button.textContent = option.label;
      return button;
    });

    container.replaceChildren(...buttons);
  }

  async function handleToggleChange() {
    await updateSettings({
      ...state.settings,
      enabled: elements.enabledToggle.checked,
    });
  }

  async function handleShortcutSelection(event) {
    const button = event.target instanceof Element ? event.target.closest(".shortcut-button") : null;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const fieldName = button.dataset.field;
    const value = button.dataset.value;

    await updateSettings({
      ...state.settings,
      [fieldName]: value,
    });
  }

  async function updateSettings(nextSettings) {
    if (shared.hasShortcutConflict(nextSettings)) {
      setStatus("Send and newline shortcuts must be different.", "error");
      syncUi();
      return;
    }

    try {
      state.settings = await shared.saveStoredSettings(nextSettings, state.platform);
      syncUi();
    } catch (error) {
      syncUi();
    }
  }

  function syncUi() {
    elements.enabledToggle.checked = state.settings.enabled;
    syncShortcutGroup(elements.sendShortcuts, "sendShortcut");
    syncShortcutGroup(elements.newlineShortcuts, "newlineShortcut");
    elements.popup.classList.toggle("is-disabled", !state.settings.enabled);
  }

  function syncShortcutGroup(container, fieldName) {
    const selectedValue = state.settings[fieldName];
    const buttons = container.querySelectorAll(".shortcut-button");

    for (const button of buttons) {
      if (!(button instanceof HTMLButtonElement)) {
        continue;
      }

      const isSelected = button.dataset.value === selectedValue;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-checked", String(isSelected));
    }
  }
})();
