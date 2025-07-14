/*****************************************************************************
#                                                                            #
#    KVMD - The main PiKVM daemon.                                           #
#                                                                            #
#    Copyright (C) 2018-2024  Maxim Devaev <mdevaev@gmail.com>               #
#                                                                            #
#    This program is free software: you can redistribute it and/or modify    #
#    it under the terms of the GNU General Public License as published by    #
#    the Free Software Foundation, either version 3 of the License, or       #
#    (at your option) any later version.                                     #
#                                                                            #
#    This program is distributed in the hope that it will be useful,         #
#    but WITHOUT ANY WARRANTY; without even the implied warranty of          #
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           #
#    GNU General Public License for more details.                            #
#                                                                            #
#    You should have received a copy of the GNU General Public License       #
#    along with this program.  If not, see <https://www.gnu.org/licenses/>.  #
#                                                                            #
*****************************************************************************/

"use strict";

import { $ } from "../tools.js";
import { MOUSE_CONSTANTS } from "./mouse-constants.js";

/**
 * Mouse state manager for PiKVM interface
 */
export class MouseState {
	constructor() {
		this.reset();
	}

	/**
	 * Reset mouse state to initial values
	 */
	reset() {
		this.ws = null;
		this.online = true;
		this.absolute = true;
		this.streamHovered = false;

		this.plannedPos = null;
		this.sentPos = { x: 0, y: 0 };

		this.relativeDeltas = [];
		this.relativeTouchPos = null;

		this.scrollDelta = { x: 0, y: 0 };
		this.scrollTouchPos = null;

		this.browser = null;
		this.streamBox = null;
		this.settings = null;
	}

	/**
	 * Set WebSocket connection
	 * @param {WebSocket} ws - WebSocket connection
	 */
	setSocket(ws) {
		this.ws = ws;
	}

	/**
	 * Set mouse state from server
	 * @param {boolean} online - Whether mouse is online
	 * @param {boolean} absolute - Whether absolute mode is enabled
	 * @param {boolean} hidOnline - Whether HID is online
	 * @param {boolean} hidBusy - Whether HID is busy
	 */
	setState(online, absolute, hidOnline, hidBusy) {
		if (!hidOnline) {
			this.online = null;
		} else {
			this.online = (online && !hidBusy);
		}

		if (!this.absolute && absolute) {
			this.clearRelativeState();
		}

		if (this.absolute && !absolute) {
			this.relativeDeltas = [];
			this.relativeTouchPos = null;
		}

		this.absolute = absolute;
	}

	/**
	 * Set stream hover state
	 * @param {boolean} hovered - Whether stream is hovered
	 */
	setStreamHovered(hovered) {
		if (this.absolute) {
			this.streamHovered = hovered;
		}
	}

	/**
	 * Clear relative mode state
	 */
	clearRelativeState() {
		this.relativeDeltas = [];
		this.relativeTouchPos = null;
	}

	/**
	 * Check if mouse is captured
	 * @returns {boolean} Whether mouse is captured
	 */
	isCaptured() {
		if (this.absolute) {
			return (this.streamHovered || this.browser?.is_mobile);
		} else {
			return this.isRelativeCaptured();
		}
	}

	/**
	 * Check if relative mouse is captured
	 * @returns {boolean} Whether relative mouse is captured
	 */
	isRelativeCaptured() {
		return (document.pointerLockElement === this.streamBox);
	}

	/**
	 * Get LED state based on current mouse state
	 * @returns {Object} LED state and title
	 */
	getLedState() {
		const isCaptured = this.isCaptured();
		let led = MOUSE_CONSTANTS.LED_STATES.GRAY;
		let title = MOUSE_CONSTANTS.LED_TITLES.MOUSE_FREE;

		if (this.ws) {
			if (this.online === null) {
				led = MOUSE_CONSTANTS.LED_STATES.RED;
				title = isCaptured
					? `${MOUSE_CONSTANTS.LED_TITLES.MOUSE_CAPTURED}, ${MOUSE_CONSTANTS.LED_TITLES.HID_OFFLINE}`
					: `${MOUSE_CONSTANTS.LED_TITLES.MOUSE_FREE}, ${MOUSE_CONSTANTS.LED_TITLES.HID_OFFLINE}`;
			} else if (this.online) {
				if (isCaptured) {
					led = MOUSE_CONSTANTS.LED_STATES.GREEN;
					title = MOUSE_CONSTANTS.LED_TITLES.MOUSE_CAPTURED;
				}
			} else {
				led = MOUSE_CONSTANTS.LED_STATES.YELLOW;
				title = isCaptured
					? `${MOUSE_CONSTANTS.LED_TITLES.MOUSE_CAPTURED}, ${MOUSE_CONSTANTS.LED_TITLES.INACTIVE_BUSY}`
					: `${MOUSE_CONSTANTS.LED_TITLES.MOUSE_FREE}, ${MOUSE_CONSTANTS.LED_TITLES.INACTIVE_BUSY}`;
			}
		} else {
			if (isCaptured) {
				title = `${MOUSE_CONSTANTS.LED_TITLES.MOUSE_CAPTURED}, ${MOUSE_CONSTANTS.LED_TITLES.PIKVM_OFFLINE}`;
			}
		}

		return { led, title };
	}

	/**
	 * Get CSS classes for stream box based on state
	 * @returns {Object} CSS class states
	 */
	getStreamBoxClasses() {
		const isCaptured = this.isCaptured();
		const dot = $("hid-mouse-dot-switch").checked;

		return {
			mouseDot: (this.absolute && isCaptured && dot && this.ws),
			mouseNone: (this.absolute && isCaptured && !dot && this.ws)
		};
	}

	/**
	 * Set browser info for state calculations
	 * @param {Object} browser - Browser information
	 */
	setBrowser(browser) {
		this.browser = browser;
	}

	/**
	 * Set stream box element for state calculations
	 * @param {HTMLElement} streamBox - Stream box element
	 */
	setStreamBox(streamBox) {
		this.streamBox = streamBox;
	}

	/**
	 * Set settings for state calculations
	 * @param {Object} settings - Mouse settings
	 */
	setSettings(settings) {
		this.settings = settings;
	}

	/**
	 * Update settings reference
	 * @param {Object} settings - Mouse settings
	 */
	updateSettings(settings) {
		this.settings = settings;
	}
}
