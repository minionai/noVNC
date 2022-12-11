/*
 * noVNC: HTML5 VNC client
 * Copyright (c) 2021 Juanjo Díaz
 * Licensed under MPL 2.0 or any later version (see LICENSE.txt)
 */

import * as Log from "./util/logging.js";
import { isSafari } from "./util/browser.js";

export default class Clipboard {
    constructor(target) {
        this._target = target;

        // Safari only allows interacting with the clipboard during a user interaction
        // So we keep data in a fake clipboard and then sync it
        this.isSafari = isSafari();
        if (this.isSafari) {
            this.fakeClipboard = [];
        }

        this._eventHandlers = {
            'copy': this._handleCopy.bind(this),
            'focus': this._handleFocus.bind(this),
            'syncFromFakeClipboard': this._syncFromFakeClipboard.bind(this)
        };

        // ===== EVENT HANDLERS =====

        this.onpaste = () => {};
    }

    // ===== PRIVATE METHODS =====

    async _handleCopy(e) {
        try {
            if (navigator.permissions && navigator.permissions.query) {
                const permission = await navigator.permissions.query({ name: "clipboard-write", allowWithoutGesture: false });
                if (permission.state === 'denied') return;
            }
        } catch (err) {
            // Some browsers might error due to lack of support, e.g. Firefox.
        }

        if (navigator.clipboard.writeText) {
            try {
                if (this.isSafari) {
                    this.fakeClipboard.push(e.clipboardData.getData('text/plain'));
                    return;
                }
                await navigator.clipboard.writeText(e.clipboardData.getData('text/plain'));
            } catch (err) {
                Log.Warn(`Couldn't write to clipboard. ${err.message}`);
            }
        }
    }

    async _handleFocus(e) {
        try {
            if (navigator.permissions && navigator.permissions.query) {
                const permission = await navigator.permissions.query({ name: "clipboard-read", allowWithoutGesture: false });
                if (permission.state === 'denied') return;
            }
        } catch (err) {
            // Some browsers might error due to lack of support, e.g. Firefox.
        }

        if (navigator.clipboard.readText) {
            try {
                const data = await navigator.clipboard.readText();
                this.onpaste(data);
            } catch (err) {
                Log.Warn(`Couldn't read from clipboard. ${err.message}`);
            }
        }
    }

    async _syncFromFakeClipboard() {
        if (navigator.clipboard.writeText) {
            while (this.fakeClipboard.length) {
                try {
                    await navigator.clipboard.writeText(this.fakeClipboard.shift());
                } catch (err) {
                    Log.Warn(`Couldn't write to clipboard. ${err.message}`);
                }
            }
        }
    }

    // ===== PUBLIC METHODS =====

    grab() {
        if (!Clipboard.isSupported) return;
        this._target.addEventListener('copy', this._eventHandlers.copy);
        if (this.isSafari) {
            this._target.addEventListener('pointerdown', this._eventHandlers.focus);
            // For some reason pointerup doen´t trigger on safari
            this._target.addEventListener('mouseup', this._eventHandlers._syncFromFakeClipboard);
            this._target.addEventListener('keyup', this._eventHandlers._syncFromFakeClipboard);
        } else {
            this._target.addEventListener('focus', this._eventHandlers.focus);
        }
    }

    ungrab() {
        if (!Clipboard.isSupported) return;
        this._target.removeEventListener('copy', this._eventHandlers.copy);
        if (this.isSafari) {
            this._target.removeEventListener('pointerdown', this._eventHandlers.focus);
            // For some reason pointerup doen´t trigger on safari
            this._target.removeEventListener('mouseup', this._eventHandlers._syncFromFakeClipboard);
            this._target.removeEventListener('keyup', this._eventHandlers._syncFromFakeClipboard);
        } else {
            this._target.removeEventListener('focus', this._eventHandlers.focus);
        }
    }
}

Clipboard.isSupported = (navigator && navigator.clipboard) ? true : false;
