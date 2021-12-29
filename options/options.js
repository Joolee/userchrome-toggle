'use strict';

async function documentLoaded() {
    await fillSettings();
    await listHotkeys();
    attachSelectorUpdaters();
    attachSavebuttons();
    attachRestoreDefault();
    attachClipboardButtons();
    document.getElementById('save-general').addEventListener('click', event => saveGeneralSettings(event));

}

// Retrieves latest settings from the settings store and fills out the form
async function fillSettings() {
    let settings = await browser.storage.local.get(['toggles', 'general']);
    let defaultSettings = browser.extension.getBackgroundPage().defaultSettings;
    let toggles = settings.toggles;

    document.getElementById('allowmultiple').checked = settings.general.allowMultiple;
    document.getElementById('notifyme').checked = settings.general.notifyMe;

    for (let i = 0; i < toggles.length; i++) {
        let prefixId = i + 1;
        let defaultWarning = document.getElementById(`default-warning-${prefixId}`);

        // Displays a warning when the default value is active. This is an empty-looking value that might be confusing
        if (defaultWarning) {
            if (defaultSettings.toggles[i].prefix == toggles[i].prefix) {
                defaultWarning.style.display = 'block';
            } else {
                defaultWarning.style.display = 'none';
            }
        }
        document.getElementById(`enable-${prefixId}`).checked = toggles[i].enabled;
        document.getElementById(`name-${prefixId}`).value = toggles[i].name;
        document.getElementById(`prefix-${prefixId}`).value = toggles[i].prefix;
        // Update CSS selector field
        updateSelector(prefixId);
    }
}

// Retrieve a list of hotkeys (commands) from Firefox and display to the user
async function listHotkeys() {
    return browser.commands.getAll().then(result => {
        for (let i = 0; i < result.length; i++) {
            document.getElementById('hotkey-' + (i + 1)).textContent = result[i].shortcut;
        }
    });
}

// Attaches event listener to update the 'selector' box when the prefix is changed by the user
function attachSelectorUpdaters() {
    let input;
    for (let i = 1; input = document.getElementById(`prefix-${i}`); i++) {
        input.addEventListener('input', event => updateSelector(event.target.id.match(/[0-9]+$/)[0]))
    }
}

// Generate the correct CSS selector and display to the user
async function updateSelector(prefixId) {
    let settings = await browser.storage.local.get('general');

    const prefix = document.getElementById(`prefix-${prefixId}`).value;
    let compare = '=';
    if (settings.general.allowMultiple) {
        compare = '*=';
    }

    const selector = `:root[titlepreface${compare}"${prefix}"]`;
    document.getElementById(`selector-${prefixId}`).value = selector;
}

// Attaches event listener to the save buttons
function attachSavebuttons() {
    let button;
    for (let i = 1; button = document.getElementById(`save-${i}`); i++) {
        button.addEventListener('click', event => saveChanges(event.target.id.match(/[0-9]+$/)[0]));
    }
}

// Save and apply user changes
async function saveChanges(prefixId) {
    let settings = await browser.storage.local.get('toggles');

    settings.toggles[prefixId - 1].enabled = document.getElementById(`enable-${prefixId}`).checked;
    settings.toggles[prefixId - 1].prefix = document.getElementById(`prefix-${prefixId}`).value;
    settings.toggles[prefixId - 1].name = document.getElementById(`name-${prefixId}`).value;
    console.log('Save', prefixId, settings);
    await browser.storage.local.set(settings);

    // Let the toolbar button reflect the changes
    browser.extension.getBackgroundPage().updateButtonStatus();

    document.getElementById(`save-message-${prefixId}`).style.display = "block";
    setTimeout(() => {
        document.getElementById(`save-message-${prefixId}`).style.display = "none";
    }, 2000)
}

// Attaches event listeners to the 'restore default' buttons
function attachRestoreDefault() {
    let button;
    for (let i = 1; button = document.getElementById(`default-${i}`); i++) {
        button.addEventListener('click', event => restoreDefault(event.target.id.match(/[0-9]+$/)[0]));
    }
}

// Populate 'prefix' field with default setting again
function restoreDefault(prefixId) {
    let defaultSettings = browser.extension.getBackgroundPage().defaultSettings;
    document.getElementById(`prefix-${prefixId}`).value = defaultSettings.toggles[prefixId - 1].prefix;
    updateSelector(prefixId);
}

// Attaches event listeners to the 'copy to clipboard' buttons
function attachClipboardButtons() {
    let button;
    for (let i = 1; button = document.getElementById(`clipboard-${i}`); i++) {
        button.addEventListener('click', event => copySelectorToClipboard(event.target.id.match(/[0-9]+$/)[0]));
    }
}

function copySelectorToClipboard(prefixId) {
    const input = document.getElementById(`selector-${prefixId}`);
    input.select();
    navigator.clipboard.writeText(input.value);
}

// Store general settings and recalculate CSS selector fields
async function saveGeneralSettings(event) {
    let settings = await browser.storage.local.get('general');
    settings.general.allowMultiple = document.getElementById('allowmultiple').checked;
    settings.general.notifyMe = document.getElementById('notifyme').checked;
    console.log('Save general', settings);
    await browser.storage.local.set(settings);

    // The selector as displayed to the client must change when multiple styles are allowed to be active
    settings = await browser.storage.local.get('toggles');
    for (let i = 0; i < settings.toggles.length; i++) {
        updateSelector(i + 1);
    }
}

document.addEventListener('DOMContentLoaded', documentLoaded);