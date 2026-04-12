(function () {
  const shared = globalThis.ChatGptKeyboardRemapShared;
  const PROMPT_SELECTOR = "#prompt-textarea";
  const EDITABLE_SELECTOR = [
    PROMPT_SELECTOR,
    "textarea",
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
    '[role="textbox"]',
  ].join(", ");
  const SEND_BUTTON_SELECTOR = [
    "#composer-submit-button",
    'button[data-testid="send-button"]',
    'button[data-testid*="send"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    'button[title*="Send"]',
    'button[title*="send"]',
  ].join(", ");

  if (!shared || !chrome || !chrome.storage || !chrome.storage.sync) {
    return;
  }

  const state = {
    settings: shared.getDefaultSettings(),
    isComposing: false,
    isReplayingNewline: false,
  };

  initialize();

  function initialize() {
    shared.subscribeToSettings((nextSettings) => {
      state.settings = nextSettings;
    });
    document.addEventListener("compositionstart", handleCompositionStart, true);
    document.addEventListener("compositionend", handleCompositionEnd, true);
    window.addEventListener("keydown", handleKeydown, true);

    shared.loadStoredSettings().then(
      (nextSettings) => {
        state.settings = nextSettings;
      },
      () => {
        // Ignore storage initialization failures and keep the defaults active.
      }
    );
  }

  function handleCompositionStart(event) {
    if (getComposerEditable(event.target)) {
      state.isComposing = true;
    }
  }

  function handleCompositionEnd(event) {
    if (!getComposerEditable(event.target)) {
      return;
    }

    queueMicrotask(() => {
      state.isComposing = false;
    });
  }

  function handleKeydown(event) {
    if (
      state.isReplayingNewline ||
      !state.settings.enabled ||
      event.defaultPrevented ||
      event.key !== "Enter"
    ) {
      return;
    }

    if (event.isComposing || state.isComposing) {
      return;
    }

    const editable = getComposerEditable(event.target);
    if (!editable) {
      return;
    }

    if (shared.matchesShortcut(event, state.settings.sendShortcut)) {
      const sendButton = findSendButton(editable);
      if (!sendButton) {
        return;
      }

      interceptKeyEvent(event);
      sendButton.click();
      return;
    }

    if (shared.matchesShortcut(event, state.settings.newlineShortcut)) {
      interceptKeyEvent(event);
      insertNewline(editable);
    }
  }

  function interceptKeyEvent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function getComposerEditable(target) {
    const element =
      target instanceof Element
        ? target
        : target && target.parentElement instanceof Element
          ? target.parentElement
          : null;

    if (!element) {
      return null;
    }

    const editable = element.closest(EDITABLE_SELECTOR);
    if (!isUsableEditable(editable)) {
      return null;
    }

    if (editable.matches(PROMPT_SELECTOR)) {
      return editable;
    }

    if (
      editable.closest('dialog, [role="dialog"], [aria-modal="true"]') ||
      editable.closest("aside, nav")
    ) {
      return null;
    }

    if (editable.closest("form") && editable.closest("main")) {
      return editable;
    }

    const hintText = [
      editable.id,
      editable.getAttribute("aria-label"),
      editable.getAttribute("placeholder"),
      editable.getAttribute("data-placeholder"),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (editable.closest("main") && /prompt|message|ask anything|chatgpt/.test(hintText)) {
      return editable;
    }

    return null;
  }

  function isUsableEditable(editable) {
    if (!(editable instanceof HTMLElement)) {
      return false;
    }

    if (
      editable instanceof HTMLInputElement &&
      editable.type !== "text" &&
      editable.type !== "search"
    ) {
      return false;
    }

    if (editable.getAttribute("contenteditable") === "false") {
      return false;
    }

    if (editable instanceof HTMLTextAreaElement || editable instanceof HTMLInputElement) {
      if (editable.readOnly || editable.disabled) {
        return false;
      }
    }

    return true;
  }

  function findSendButton(editable) {
    const roots = [editable.closest("form"), editable.closest("main")].filter(
      (root, index, items) => root instanceof HTMLElement && items.indexOf(root) === index
    );

    for (const root of roots) {
      const directMatch = Array.from(root.querySelectorAll(SEND_BUTTON_SELECTOR)).find(isUsableButton);
      if (directMatch) {
        return directMatch;
      }

      const iconMatch = Array.from(root.querySelectorAll("button")).find(
        (button) =>
          isUsableButton(button) && button.querySelector('svg path[d^="M15.192 8.906"]')
      );
      if (iconMatch) {
        return iconMatch;
      }
    }

    return null;
  }

  function isUsableButton(button) {
    return (
      button instanceof HTMLButtonElement &&
      button.getClientRects().length > 0 &&
      !button.disabled &&
      button.getAttribute("aria-disabled") !== "true"
    );
  }

  function insertNewline(editable) {
    editable.focus();

    if (editable instanceof HTMLTextAreaElement || editable instanceof HTMLInputElement) {
      const start = editable.selectionStart == null ? editable.value.length : editable.selectionStart;
      const end = editable.selectionEnd == null ? editable.value.length : editable.selectionEnd;

      editable.setRangeText("\n", start, end, "end");
      dispatchEditableInput(editable, "insertLineBreak", "\n");
      return;
    }

    if (dispatchSyntheticShiftEnter(editable)) {
      return;
    }

    const selection = editable.ownerDocument.getSelection();
    if (!selection || selection.rangeCount === 0) {
      editable.appendChild(document.createElement("br"));
      placeCaretAtEnd(editable);
      dispatchEditableInput(editable, "insertLineBreak", "\n");
      return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const lineBreak = document.createElement("br");
    range.insertNode(lineBreak);
    range.setStartAfter(lineBreak);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);
    dispatchEditableInput(editable, "insertLineBreak", "\n");
  }

  function dispatchSyntheticShiftEnter(editable) {
    const shiftEnterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    state.isReplayingNewline = true;

    try {
      return editable.dispatchEvent(shiftEnterEvent) === false || shiftEnterEvent.defaultPrevented;
    } finally {
      state.isReplayingNewline = false;
    }
  }

  function dispatchEditableInput(editable, inputType, data) {
    try {
      editable.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: false,
          data,
          inputType,
        })
      );
    } catch (error) {
      editable.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function placeCaretAtEnd(editable) {
    const selection = editable.ownerDocument.getSelection();
    if (!selection) {
      return;
    }

    const range = editable.ownerDocument.createRange();
    range.selectNodeContents(editable);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
})();
