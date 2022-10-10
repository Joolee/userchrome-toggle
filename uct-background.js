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
    }
}

this.per_window_toggles=new Map();
this.lastWindowId=undefined;
this.secondToLastWindowId=undefined;

async function windowCreated(window){
	console.log(`Created: ${window.id}, last: ${lastWindowId}, secondLast: ${secondToLastWindowId}, current: ${(await browser.windows.getCurrent()).id}`);
	let lastId=lastWindowId;
	if(lastId===window.id){
		lastId=secondToLastWindowId;
	}
	let pwt;
	if(lastId!==undefined){
		pwt=structuredClone(per_window_toggles.get(lastId));
	} else {
		pwt=structuredClone(defaultSettings.toggles);
	}
	per_window_toggles.set(window.id,pwt);
	await updateTitlePrefixes();
}

async function windowDestroyed(windowId){
    per_window_toggles.delete(windowId);
}

async function windowFocusChanged(windowId){
	if(windowId===browser.windows.WINDOW_ID_NONE) return;
	
	let toggles=per_window_toggles.get(windowId);
	
	if(toggles===undefined){
		//if extension was just loaded for example
		per_window_toggles.set(windowId,structuredClone(defaultSettings.toggles));
	}
		
	secondToLastWindowId=lastWindowId;
	lastWindowId=windowId;
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
    }
    return settings;
}

async function updateButtonStatus() {

    // Use reduce function on array to count all enabled toggles
    let togglesEnabled = per_window_toggles.get((await browser.windows.getCurrent()).id)
		.reduce((count, toggle) => toggle.enabled ? count + 1 : count, 0);

    if (togglesEnabled < 2) {
        let toggle = (per_window_toggles.get((await browser.windows.getCurrent()).id))[0];
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
    return (per_window_toggles.get((await browser.windows.getCurrent()).id))[styleId - 1].prefix;
}

async function initializeSettings() {
    let settings = await browser.storage.local.get();
    if (settings.toggles) {
        console.log('Loading user settings', settings);
        await updateSettings(settings);
    } else {
        console.log('Initializing default settings', defaultSettings);
        await browser.storage.local.set(defaultSettings);

        // Open settings page for the user
        browser.runtime.openOptionsPage();
    }
	await browser.storage.local.set(settings);
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
	let settings = await browser.storage.local.get();
	per_window_toggles.forEach((toggles,windowId) => {
		console.log(`updating: ${windowId} ${toggles}`);
		let titlePrefix = '';

		// Loop through all toggles
		for (let i = 0; i < toggles.length; i++) {
			if (toggles[i].state) {
				titlePrefix += String(toggles[i].prefix);

				// When only one toggle may be active at once, stop after the first
				if (!settings.general.allowMultiple){
					break;
				}
			}
		}

		browser.windows.update(windowId, {
			titlePreface: titlePrefix
		});
	});
	await browser.storage.local.set(settings);
}

// Respond to button clicks and registered hotkeys
async function userToggle(styleId, newState) {
    // Extract style number from end of string
    styleId = String(styleId).match(/[0-9]+$/);
	let windowId = (await browser.windows.getCurrent()).id;
    let settings = await browser.storage.local.get();
    let hrState = 'off';
    let toggle = { name: 'all styles' }

    if (
		styleId
		&& !(
				per_window_toggles.get(
					windowId
				)
			)[styleId[0] - 1].enabled
		) {
        console.log('Style is disabled', (per_window_toggles.get(windowId))[styleId[0] - 1]);
        return
    }

    // When only one option allowed or no valid style is selected, reset all others
    // Also do this when no valid style has been found
    if (!settings.general.allowMultiple || !styleId) {
        for (let i = 0; i < (per_window_toggles.get(windowId)).length; i++) {
            if (!styleId || styleId[0] - 1 != i){
                (per_window_toggles.get(windowId))[i].state = false;
			}
        }
    }

    // When valid style has been selected
    if (styleId) {
        styleId = styleId[0];
        // Invert toggle state or set requested state and save in settings
        toggle = (per_window_toggles.get(windowId))[styleId - 1];

        if (typeof(newState) == 'undefined')
            newState = !toggle.state;

        (per_window_toggles.get(windowId))[styleId - 1].state = newState;

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

    // Update title to reflect new truth
	await updateTitlePrefixes();
    await updateButtonStatus();
}


main();
