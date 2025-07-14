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

/**
 * Mouse constants for PiKVM interface
 */
export const MOUSE_CONSTANTS = {
	RELATIVE_MAX_DELTA: 127,
	RELATIVE_MIN_DELTA: -127,

	SCROLL_THRESHOLD: 100,
	SCROLL_RATE_DEFAULT: 5,
	SCROLL_RATE_MIN: 1,
	SCROLL_RATE_MAX: 25,

	TOUCH_THRESHOLD: 15,

	MOUSE_RATE_MIN: 10,
	MOUSE_RATE_MAX: 100,
	MOUSE_RATE_DEFAULT: 10,

	SENSITIVITY_MIN: 0.1,
	SENSITIVITY_MAX: 1.9,
	SENSITIVITY_DEFAULT: 1.0,

	ABSOLUTE_COORD_MIN: -32768,
	ABSOLUTE_COORD_MAX: 32767,

	SCROLL_FIX_MAC: 5,
	SCROLL_FIX_DEFAULT: 1,

	LED_STATES: {
		GRAY: "led-gray",
		RED: "led-red",
		GREEN: "led-green",
		YELLOW: "led-yellow"
	},

	BUTTON_MAPPINGS: {
		0: "left",    // Left button
		1: "middle",  // Middle button
		2: "right",   // Right button
		3: "up",      // Back button
		4: "down"     // Forward button
	},

	EVENT_TYPES: {
		MOUSE_MOVE: "mouse_move",
		MOUSE_RELATIVE: "mouse_relative",
		MOUSE_BUTTON: "mouse_button",
		MOUSE_WHEEL: "mouse_wheel"
	},

	CSS_CLASSES: {
		MOUSE_DOT: "stream-box-mouse-dot",
		MOUSE_NONE: "stream-box-mouse-none"
	},

	LED_TITLES: {
		MOUSE_FREE: "Mouse free",
		MOUSE_CAPTURED: "Mouse captured",
		HID_OFFLINE: "HID offline",
		INACTIVE_BUSY: "inactive/busy",
		PIKVM_OFFLINE: "PiKVM offline"
	}
};

/**
 * Default mouse settings
 */
export const DEFAULT_MOUSE_SETTINGS = {
	scrollRate: MOUSE_CONSTANTS.SCROLL_RATE_DEFAULT,
	sensitivity: MOUSE_CONSTANTS.SENSITIVITY_DEFAULT,
	mouseRate: MOUSE_CONSTANTS.MOUSE_RATE_DEFAULT,
	squash: true,
	dot: true,
	reverseScrolling: false,
	reversePanning: false,
	cumulativeScrolling: true
};
