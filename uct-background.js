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
        settingsVersion: 1.1,
        allowMultiple: false,
        notifyMe: true
    },
	//unused, written for for clarity. this is done in initializeSettings()
    per_window_toggles: new Map()
}

async function windowCreated(window){
    let settings = await browser.storage.local.get();
	if(!settings.current_windowId===undefined){
		settings.per_window_toggles[window.id]=(settings.per_window_toggles[settings.current_windowId]);
	} else {
		settings.per_window_toggles[window.id]=defaultSettings.toggles;
	}
    await updateSettings(settings);
}

async function windowDestroyed(windowId){
    let settings = await browser.storage.local.get();
    settings.per_window_toggles.delete(windowId);
    await updateSettings(settings);
}

async function windowFocusChanged(windowId){
    let settings = await browser.storage.local.get();
    settings.current_windowId=windowId;
    await updateSettings(settings);
	await updateButtonStatus();
}


async function main() {
    await initializeSettings();
    await updateTitlePrefixes();

    // Always toggle style 1 on button click
    // This event will only fire when the button is not in pop-up mode
    browser.browserAction.onClicked.addListener(() => {
        userToggle(1)
    });

    // Trigger on registered hotkeys
    browser.commands.onCommand.addListener(userToggle);
    
    // Proper window state handling
    browser.windows.onCreated.addListener(windowCreated);
    browser.windows.onRemoved.addListener(windowDestroyed);
    browser.windows.onFocusChanged.addListener(windowFocusChanged);
    console.log('Init complete');
}

// Update user settings to new defaults after updating the extension
async function updateSettings(settings) {
    if (settings.general.settingsVersion < defaultSettings.general.settingsVersion) {
        if (settings.general.settingsVersion < 1.1) {
            settings.general.notifyMe = defaultSettings.general.notifyMe;
        }

        settings.general.settingsVersion < defaultSettings.general.settingsVersion
        await browser.storage.local.set(settings);
    }

    return settings;
}

async function updateButtonStatus() {
    let settings = await browser.storage.local.get('toggles');

    // Use reduce function on array to count all enabled toggles
    let togglesEnabled = settings.per_window_toggles[settings.current_windowId].reduce((count, toggle) => toggle.enabled ? count + 1 : count, 0);

    if (togglesEnabled < 2) {
        let toggle = (settings.per_window_toggles[settings.current_windowId])[0];
        browser.browserAction.setTitle({
            title: `Turn ${toggle.name} ` + (toggle.state ? 'off' : 'on')
        });

        // Disable popup mode
        browser.browserAction.setPopup({ popup: null })
        console.log('Disabled popup mode');
    } else {
        browser.browserAction.setTitle({
            title: 'Show userchrome toggles'
        });

        // Enable popup mode
        browser.browserAction.setPopup({ popup: "popup/popup.html" })
        console.log('Enabled popup mode', togglesEnabled);
    }
}

async function getStyleSettings(styleId) {
    let settings = await browser.storage.local.get('toggles');
    return (settings.per_window_toggles[settings.current_windowId])[styleId - 1].prefix;
}

async function initializeSettings() {
    let settings = await browser.storage.local.get();
	settings.per_window_toggles=new Map();
    if (settings.toggles) {
        console.log('Loading user settings', settings);
        settings = await updateSettings(settings);
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
    const toggles = (settings.per_window_toggles[settings.current_windowId]);
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

    if (styleId && !(settings.per_window_toggles[settings.current_windowId])[styleId[0] - 1].enabled) {
        console.log('Style is disabled', (settings.per_window_toggles[settings.current_windowId])[styleId[0] - 1]);
        return
    }

    // When only one option allowed or no valid style is selected, reset all others
    // Also do this when no valid style has been found
    if (!settings.general.allowMultiple || !styleId) {
        for (let i = 0; i < (settings.per_window_toggles[settings.current_windowId]).length; i++) {
            if (!styleId || styleId[0] - 1 != i)
                (settings.per_window_toggles[settings.current_windowId])[i].state = false;
        }
    }

    // When valid style has been selected
    if (styleId) {
        styleId = styleId[0];
        // Invert toggle state or set requested state and save in settings
        toggle = (settings.per_window_toggles[settings.current_windowId])[styleId - 1];

        if (typeof(newState) == 'undefined')
            newState = !toggle.state;

        (settings.per_window_toggles[settings.current_windowId])[styleId - 1].state = newState;

        if (newState)
            hrState = 'on';
    }

    // Generate user notification when enabled
    console.log('Toggling', styleId, hrState);
    if (settings.general.notifyMe) {
        browser.notifications.create(`toggle-${styleId}`, {
            type: "basic",
            title: "Userchrome style toggle",
            message: `Turned ${toggle.name} ${hrState}`
        });
    }

    await browser.storage.local.set(settings);

    // Update title to reflect new truth
    updateTitlePrefixes();
    updateButtonStatus();
}


main();
