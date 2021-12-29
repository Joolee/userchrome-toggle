'use strict';

this.defaultSettings = {
    toggles: [{
            name: 'userchrome style',
            enabled: true,
            prefix: '\u180E',
            state: false
        },
        {
            name: 'Style 2',
            enabled: false,
            prefix: '\u200B',
            state: false
        },
        {
            name: 'Style 3',
            enabled: false,
            prefix: '\u200C',
            state: false
        }
    ],
    general: {
        settingsVersion: 1,
        allowMultiple: false
    }
}


async function main() {
    await initializeSettings();
    await updateButtonStatus();
    await updateTitlePrefixes()

    // Always toggle style 1 on button click
    // This event will only fire when no other toggles have been enabled
    browser.browserAction.onClicked.addListener(() => {
        userToggle(1)
    });

    // Trigger on registered hotkeys
    browser.commands.onCommand.addListener(userToggle);
    console.log('Init complete');
}

async function updateButtonStatus() {
    let settings = await browser.storage.local.get('toggles');
    // Use reduce function on array to count all enabled toggles
    let togglesEnabled = settings.toggles.reduce((pv, cv) => cv.enabled ? pv + 1 : pv, 0);

    if (togglesEnabled < 2) {
        browser.browserAction.setTitle({
            title: 'Toggle ' + settings.toggles[0].name
        });

        // Disable popup mode
        browser.browserAction.setPopup({ popup: null })
        console.log('Disable popup mode');
    } else {
        browser.browserAction.setTitle({
            title: 'Show userchrome toggles'
        });

        // Enable popup mode
        browser.browserAction.setPopup({ popup: "popup/popup.html" })
        console.log('Enable popup mode', togglesEnabled);
    }
}

async function getStyleSettings(styleId) {
    let settings = await browser.storage.local.get('toggles');
    return settings.toggles[styleId - 1].prefix;
}

async function initializeSettings() {
    let settings = await browser.storage.local.get('toggles');
    if (settings.toggles) {
        console.log('Loading user settings', settings);
    } else {
        console.log('Initializing default settings', defaultSettings);

        await browser.storage.local.set(defaultSettings);

        // Open settings page for the user
        browser.runtime.openOptionsPage();
    }
}

// Detect current window title prefix to allow toggling
async function toggleTitlePrefix(windowId, titlePrefix) {
    const windowInfo = await browser.windows.get(windowId.id);

    if (windowInfo.title && windowInfo.title.startsWith(titlePrefix))
        titlePrefix = '';

    return setTitlePrefix(windowId, titlePrefix);
}

// Update prefix for specified window
async function updateTitlePrefixes() {
    // Only change current window
    const windowId = await browser.windows.getCurrent();
    const settings = await browser.storage.local.get(['toggles', 'general']);
    const toggles = settings.toggles;
    let titlePrefix = '';

    // Loop through all toggles
    for (let i = 0; i < toggles.length; i++) {
        if (toggles[i].state) {
            titlePrefix += String(toggles[i].prefix);

            // When only one toggle may be active at once, stop after the first
            if (!settings.general.allowMultiple)
                break;
        }
    }

    browser.windows.update(windowId.id, {
        titlePreface: titlePrefix
    });
}

// Respond to button clicks and registered hotkeys
async function userToggle(styleId, newState) {
    // Extract style number from end of string
    styleId = String(styleId).match(/[0-9]+$/);

    let settings = await browser.storage.local.get(['toggles', 'general']);
    let hrState = 'off';
    let toggle = { name: 'all styles' }

    if (styleId && !settings.toggles[styleId[0] - 1].enabled) {
        console.log('Style is disabled', settings.toggles[styleId[0] - 1]);
        return
    }

    // When only one option allowed or no valid style is selected, reset all others
    // Also do this when no valid style has been found
    if (!settings.general.allowMultiple || !styleId) {
        for (let i = 0; i < settings.toggles.length; i++) {
            if (!styleId || styleId[0] - 1 != i)
                settings.toggles[i].state = false;
        }
    }

    // When valid style has been selected
    if (styleId) {
        styleId = styleId[0];
        // Invert toggle state or set requested state and save in settings
        toggle = settings.toggles[styleId - 1];

        if (typeof(newState) == 'undefined')
            newState = !toggle.state;

        settings.toggles[styleId - 1].state = newState;

        if (newState)
            hrState = 'on';
    }

    // Generate user notification
    console.log('Toggling', styleId, hrState);
    browser.notifications.create(`toggle-${styleId}`, {
        type: "basic",
        title: "Userchrome style toggle",
        message: `Turned ${toggle.name} ${hrState}`
    });


    await browser.storage.local.set(settings);

    // Update title to reflect new truth
    updateTitlePrefixes();
}


main();