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

import { tools, $ } from "../tools.js";
import { MOUSE_CONSTANTS } from "./mouse-constants.js";

/**
 * Mouse communication manager for PiKVM interface
 */
export class MouseCommunication {
	constructor(recordWsEvent) {
		this.recordWsEvent = recordWsEvent;
		this.ws = null;
	}

	/**
	 * Set WebSocket connection
	 * @param {WebSocket} ws - WebSocket connection
	 */
	setSocket(ws) {
		this.ws = ws;
	}

	/**
	 * Send HID event to WebSocket
	 * @param {string} evType - Event type
	 * @param {Object} ev - Event data
	 */
	sendEvent(evType, ev) {
		const event = {
			event_type: evType,
			event: ev
		};

		if (this.ws && !$("hid-mute-switch").checked) {
			this.ws.sendHidEvent(event);
		}

		this.recordWsEvent(event);
	}

	/**
	 * Send mouse button event
	 * @param {string} button - Button name
	 * @param {boolean} state - Button state (pressed/released)
	 */
	sendButton(button, state) {
		tools.debug("Mouse: button", (state ? "pressed:" : "released:"), button);
		this.sendEvent(MOUSE_CONSTANTS.EVENT_TYPES.MOUSE_BUTTON, {
			button: button,
			state: state
		});
	}

	/**
	 * Send mouse movement event (absolute)
	 * @param {Object} to - Target position
	 */
	sendMove(to) {
		tools.debug("Mouse: moved:", to);
		this.sendEvent(MOUSE_CONSTANTS.EVENT_TYPES.MOUSE_MOVE, { to: to });
	}

	/**
	 * Send relative mouse movement event
	 * @param {Object} delta - Movement delta
	 * @param {boolean} squash - Whether to squash multiple deltas
	 */
	sendRelativeMove(delta, squash = false) {
		if (squash) {
			tools.debug("Mouse: relative:", delta);
			this.sendEvent(MOUSE_CONSTANTS.EVENT_TYPES.MOUSE_RELATIVE, {
				delta: delta,
				squash: true
			});
		} else {
			tools.debug("Mouse: relative:", delta);
			this.sendEvent(MOUSE_CONSTANTS.EVENT_TYPES.MOUSE_RELATIVE, {
				delta: delta
			});
		}
	}

	/**
	 * Send scroll event
	 * @param {Object} delta - Scroll delta
	 */
	sendScroll(delta) {
		tools.debug("Mouse: scrolled:", delta);
		this.sendEvent(MOUSE_CONSTANTS.EVENT_TYPES.MOUSE_WHEEL, {
			delta: delta
		});
	}

	/**
	 * Process and send relative movement with sensitivity
	 * @param {Object} delta - Raw movement delta
	 * @param {number} sensitivity - Sensitivity multiplier
	 * @param {boolean} squash - Whether to squash movements
	 */
	processRelativeMove(delta, sensitivity, squash = false) {
		const processedDelta = {
			x: Math.min(Math.max(
				MOUSE_CONSTANTS.RELATIVE_MIN_DELTA,
				Math.floor(delta.x * sensitivity)
			), MOUSE_CONSTANTS.RELATIVE_MAX_DELTA),
			y: Math.min(Math.max(
				MOUSE_CONSTANTS.RELATIVE_MIN_DELTA,
				Math.floor(delta.y * sensitivity)
			), MOUSE_CONSTANTS.RELATIVE_MAX_DELTA)
		};

		if (processedDelta.x || processedDelta.y) {
			if (squash) {
				// Store for later sending
				return processedDelta;
			} else {
				this.sendRelativeMove(processedDelta);
				return null;
			}
		}

		return null;
	}

	/**
	 * Process and send scroll with rate and direction settings
	 * @param {Object} delta - Raw scroll delta
	 * @param {number} scrollRate - Scroll rate
	 * @param {boolean} reverseScrolling - Whether to reverse scrolling
	 * @param {boolean} reversePanning - Whether to reverse panning
	 */
	processScroll(delta, scrollRate, reverseScrolling = false, reversePanning = false) {
		const processedDelta = { x: 0, y: 0 };

		if (delta.x) {
			processedDelta.x = Math.sign(delta.x) * (-scrollRate);
			if (reversePanning) {
				processedDelta.x *= -1;
			}
		}

		if (delta.y) {
			processedDelta.y = Math.sign(delta.y) * (-scrollRate);
			if (reverseScrolling) {
				processedDelta.y *= -1;
			}
		}

		if (processedDelta.x || processedDelta.y) {
			this.sendScroll(processedDelta);
		}
	}
}
