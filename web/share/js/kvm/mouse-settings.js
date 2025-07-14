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
import { MOUSE_CONSTANTS, DEFAULT_MOUSE_SETTINGS } from "./mouse-constants.js";

/**
 * Mouse settings manager for PiKVM interface
 */
export class MouseSettings {
	constructor() {
		this.settings = { ...DEFAULT_MOUSE_SETTINGS };
		this.timer = null;
		this.relativeSens = MOUSE_CONSTANTS.SENSITIVITY_DEFAULT;
		this.scrollRate = MOUSE_CONSTANTS.SCROLL_RATE_DEFAULT;
		this.scrollFix = (tools.browser.is_mac ? MOUSE_CONSTANTS.SCROLL_FIX_MAC : MOUSE_CONSTANTS.SCROLL_FIX_DEFAULT);
	}

	/**
	 * Initialize mouse settings with UI bindings
	 */
	initialize() {
		tools.storage.bindSimpleSwitch($("hid-mouse-squash-switch"), "hid.mouse.squash", true);
		tools.storage.bindSimpleSwitch($("hid-mouse-reverse-scrolling-switch"), "hid.mouse.reverse_scrolling", false);
		tools.storage.bindSimpleSwitch($("hid-mouse-reverse-panning-switch"), "hid.mouse.reverse_panning", false);
		tools.storage.bindSimpleSwitch($("hid-mouse-dot-switch"), "hid.mouse.dot", true, this.onDotSwitchChange.bind(this));

		let cumulativeScrolling = !(tools.browser.is_firefox && !tools.browser.is_mac);
		tools.storage.bindSimpleSwitch($("hid-mouse-cumulative-scrolling-switch"), "hid.mouse.cumulative_scrolling", cumulativeScrolling);

		this.setupSensitivitySlider();
		this.setupRateSlider();
		this.setupScrollRateSlider();

		const currentRate = tools.storage.get("hid.mouse.rate", MOUSE_CONSTANTS.MOUSE_RATE_DEFAULT);
		this.updateRate(currentRate);
	}

	/**
	 * Setup sensitivity slider
	 */
	setupSensitivitySlider() {
		const currentValue = tools.storage.get("hid.mouse.sens", MOUSE_CONSTANTS.SENSITIVITY_DEFAULT);
		tools.slider.setParams(
			$("hid-mouse-sens-slider"),
			MOUSE_CONSTANTS.SENSITIVITY_MIN,
			MOUSE_CONSTANTS.SENSITIVITY_MAX,
			0.1,
			currentValue,
			(value) => this.updateRelativeSens(value)
		);
	}

	/**
	 * Setup mouse rate slider
	 */
	setupRateSlider() {
		const currentValue = tools.storage.get("hid.mouse.rate", MOUSE_CONSTANTS.MOUSE_RATE_DEFAULT);
		tools.slider.setParams(
			$("hid-mouse-rate-slider"),
			MOUSE_CONSTANTS.MOUSE_RATE_MIN,
			MOUSE_CONSTANTS.MOUSE_RATE_MAX,
			10,
			currentValue,
			(value) => this.updateRate(value)
		);
	}

	/**
	 * Setup scroll rate slider
	 */
	setupScrollRateSlider() {
		const currentValue = tools.storage.get("hid.mouse.scroll_rate", MOUSE_CONSTANTS.SCROLL_RATE_DEFAULT);
		tools.slider.setParams(
			$("hid-mouse-scroll-slider"),
			MOUSE_CONSTANTS.SCROLL_RATE_MIN,
			MOUSE_CONSTANTS.SCROLL_RATE_MAX,
			1,
			currentValue,
			(value) => this.updateScrollRate(value)
		);
	}

	/**
	 * Update relative sensitivity setting
	 * @param {number} value - New sensitivity value
	 */
	updateRelativeSens(value) {
		$("hid-mouse-sens-value").innerText = value.toFixed(1);
		tools.storage.set("hid.mouse.sens", value);
		this.relativeSens = value;
	}

	/**
	 * Update mouse rate and restart timer
	 * @param {number} value - New rate value
	 */
	updateRate(value) {
		$("hid-mouse-rate-value").innerText = value + " ms";
		tools.storage.set("hid.mouse.rate", value);

		if (this.timer) {
			clearInterval(this.timer);
		}

		this.timer = setInterval(() => {
			if (this.onSendPlannedMove) {
				this.onSendPlannedMove();
			}
		}, value);
	}

	/**
	 * Update scroll rate setting
	 * @param {number} value - New scroll rate value
	 */
	updateScrollRate(value) {
		$("hid-mouse-scroll-value").innerText = value;
		tools.storage.set("hid.mouse.scroll_rate", value);
		this.scrollRate = value;
	}

	/**
	 * Get current settings
	 * @returns {Object} Current settings
	 */
	getSettings() {
		return {
			...this.settings,
			relativeSens: this.relativeSens,
			scrollRate: this.scrollRate,
			scrollFix: this.scrollFix,
			squash: $("hid-mouse-squash-switch").checked,
			reverseScrolling: $("hid-mouse-reverse-scrolling-switch").checked,
			reversePanning: $("hid-mouse-reverse-panning-switch").checked,
			dot: $("hid-mouse-dot-switch").checked,
			cumulativeScrolling: $("hid-mouse-cumulative-scrolling-switch").checked
		};
	}

	/**
	 * Set callback for planned move sending
	 * @param {Function} callback - Callback function
	 */
	setSendPlannedMoveCallback(callback) {
		this.onSendPlannedMove = callback;
	}

	/**
	 * Set callback for LED updates
	 * @param {Function} callback - Callback function
	 */
	setLedUpdateCallback(callback) {
		this.onLedUpdate = callback;
	}

	/**
	 * Set callback for CSS class updates
	 * @param {Function} callback - Callback function
	 */
	setCssUpdateCallback(callback) {
		this.onCssUpdate = callback;
	}

	/**
	 * Set callback for state updates
	 * @param {Function} callback - Callback function
	 */
	setStateUpdateCallback(callback) {
		this.stateUpdateCallback = callback;
	}

	/**
	 * Handle dot switch change
	 */
	onDotSwitchChange() {
		if (this.onLedUpdate) {
			this.onLedUpdate();
		}
		if (this.onCssUpdate) {
			this.onCssUpdate();
		}
		if (this.stateUpdateCallback) {
			this.stateUpdateCallback(this.getSettings());
		}
	}
}
