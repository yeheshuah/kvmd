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

import { tools } from "../tools.js";
import { MOUSE_CONSTANTS } from "./mouse-constants.js";

/**
 * Mouse scroll handler for PiKVM interface
 */
export class MouseScrollHandler {
	constructor(communication) {
		this.communication = communication;
		this.scrollDelta = { x: 0, y: 0 };
		this.scrollFix = (tools.browser.is_mac ? 5 : 1);
	}

	/**
	 * Set scroll fix based on browser
	 * @param {number} scrollFix - Browser-specific scroll fix
	 */
	setScrollFix(scrollFix) {
		this.scrollFix = scrollFix;
	}

	/**
	 * Handle wheel event
	 * @param {WheelEvent} event - Wheel event
	 * @param {Object} settings - Mouse settings
	 * @param {boolean} isAbsolute - Whether in absolute mode
	 * @param {boolean} isCaptured - Whether mouse is captured
	 */
	handleWheel(event, settings, isAbsolute, isCaptured) {
		event.preventDefault();

		if (!isAbsolute && !isCaptured) {
			return;
		}

		const delta = this.calculateDelta(event, settings.cumulativeScrolling);
		this.processScroll(delta, settings);
	}

	/**
	 * Calculate scroll delta from wheel event
	 * @param {WheelEvent} event - Wheel event
	 * @param {boolean} cumulativeScrolling - Whether to use cumulative scrolling
	 * @returns {Object} Scroll delta
	 */
	calculateDelta(event, cumulativeScrolling) {
		if (cumulativeScrolling) {
			return this.calculateCumulativeDelta(event);
		} else {
			return {
				x: event.deltaX,
				y: event.deltaY
			};
		}
	}

	/**
	 * Calculate cumulative scroll delta
	 * @param {WheelEvent} event - Wheel event
	 * @returns {Object} Processed scroll delta
	 */
	calculateCumulativeDelta(event) {
		const processedDelta = { x: 0, y: 0 };

		// Process X axis
		if (this.scrollDelta.x && Math.sign(this.scrollDelta.x) !== Math.sign(event.deltaX)) {
			processedDelta.x = this.scrollDelta.x;
			this.scrollDelta.x = 0;
		} else {
			this.scrollDelta.x += event.deltaX * this.scrollFix;
			if (Math.abs(this.scrollDelta.x) >= MOUSE_CONSTANTS.SCROLL_THRESHOLD) {
				processedDelta.x = this.scrollDelta.x;
				this.scrollDelta.x = 0;
			}
		}

		// Process Y axis
		if (this.scrollDelta.y && Math.sign(this.scrollDelta.y) !== Math.sign(event.deltaY)) {
			processedDelta.y = this.scrollDelta.y;
			this.scrollDelta.y = 0;
		} else {
			this.scrollDelta.y += event.deltaY * this.scrollFix;
			if (Math.abs(this.scrollDelta.y) >= MOUSE_CONSTANTS.SCROLL_THRESHOLD) {
				processedDelta.y = this.scrollDelta.y;
				this.scrollDelta.y = 0;
			}
		}

		return processedDelta;
	}

	/**
	 * Process scroll delta and send to server
	 * @param {Object} delta - Scroll delta
	 * @param {Object} settings - Mouse settings
	 */
	processScroll(delta, settings) {
		this.communication.processScroll(
			delta,
			settings.scrollRate,
			settings.reverseScrolling,
			settings.reversePanning
		);
	}
}
