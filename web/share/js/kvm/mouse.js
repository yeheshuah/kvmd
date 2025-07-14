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
import { Keypad } from "../keypad.js";
import { MouseState } from "./mouse-state.js";
import { MouseSettings } from "./mouse-settings.js";
import { MouseCommunication } from "./mouse-communication.js";
import { MouseScrollHandler } from "./mouse-scroll-handler.js";
import { AbsoluteMouseStrategy, RelativeMouseStrategy } from "./mouse-strategies.js";
import { MOUSE_CONSTANTS } from "./mouse-constants.js";

/**
 * Refactored mouse controller for PiKVM interface
 * @param {Function} getGeometry - Function to get stream geometry
 * @param {Function} recordWsEvent - Function to record WebSocket events
 */
export function MouseController(getGeometry, recordWsEvent) {
	var self = this;

	// Store geometry function
	this.getGeometry = getGeometry;

	// Initialize modules
	this.state = new MouseState();
	this.settings = new MouseSettings();
	this.communication = new MouseCommunication(recordWsEvent);
	this.scrollHandler = new MouseScrollHandler(this.communication);
	this.keypad = null;

	// Initialize strategies
	this.strategies = {
		absolute: new AbsoluteMouseStrategy(this),
		relative: new RelativeMouseStrategy(this)
	};
	this.currentStrategy = this.strategies.absolute;

	/**
	 * Initialize mouse controller with event handlers
	 */
	const __init__ = function () {
		self.keypad = new Keypad($("stream-mouse-buttons"), self.sendButton.bind(self), false);

		$("hid-mouse-led").title = "Mouse free";

		// Set up state dependencies
		self.state.setBrowser(tools.browser);
		self.state.setStreamBox($("stream-box"));
		self.state.setSettings(self.settings.getSettings());

		// Initialize settings
		self.settings.initialize();
		self.settings.setSendPlannedMoveCallback(self.sendPlannedMove.bind(self));
		self.settings.setLedUpdateCallback(self.updateOnlineLeds.bind(self));
		self.settings.setCssUpdateCallback(self.updateOnlineLeds.bind(self));
		self.settings.setStateUpdateCallback(self.state.updateSettings.bind(self.state));

		// Set up scroll handler
		self.scrollHandler.setScrollFix(self.settings.getSettings().scrollFix);

		// Set up event listeners
		self.setupEventListeners();
	};

	/**
	 * Set up event listeners
	 */
	this.setupEventListeners = function () {
		document.addEventListener("pointerlockchange", this.handlePointerLockChange.bind(this));
		document.addEventListener("pointerlockerror", this.handlePointerLockChange.bind(this));

		$("stream-box").addEventListener("mouseenter", () => this.handleStreamHover(true));
		$("stream-box").addEventListener("mouseleave", () => this.handleStreamHover(false));
		$("stream-box").addEventListener("mousedown", (ev) => this.handleMouseButton(ev, true));
		$("stream-box").addEventListener("mouseup", (ev) => this.handleMouseButton(ev, false));
		$("stream-box").addEventListener("contextmenu", (ev) => ev.preventDefault());
		$("stream-box").addEventListener("mousemove", this.handleMouseMove.bind(this));
		$("stream-box").addEventListener("wheel", this.handleWheel.bind(this));
		$("stream-box").addEventListener("touchstart", this.handleTouchStart.bind(this));
		$("stream-box").addEventListener("touchmove", this.handleTouchMove.bind(this));
		$("stream-box").addEventListener("touchend", this.handleTouchEnd.bind(this));
	};

	/**
	 * Handle pointer lock change
	 */
	this.handlePointerLockChange = function () {
		tools.info("Relative mouse", (this.state.isRelativeCaptured() ? "captured" : "released"), "by pointer lock");
		this.updateOnlineLeds();
	};

	/**
	 * Handle stream hover
	 * @param {boolean} hovered - Whether stream is hovered
	 */
	this.handleStreamHover = function (hovered) {
		if (this.state.absolute) {
			this.state.setStreamHovered(hovered);
			this.updateOnlineLeds();
		}
	};

	/**
	 * Handle mouse button events
	 * @param {MouseEvent} event - Mouse event
	 * @param {boolean} state - Button state
	 */
	this.handleMouseButton = function (event, state) {
		event.preventDefault();
		this.currentStrategy.handleClick(event, state);
	};

	/**
	 * Handle mouse move events
	 * @param {MouseEvent} event - Mouse move event
	 */
	this.handleMouseMove = function (event) {
		this.currentStrategy.handleMove(event);
	};

	/**
	 * Handle wheel events
	 * @param {WheelEvent} event - Wheel event
	 */
	this.handleWheel = function (event) {
		const settings = this.settings.getSettings();
		this.scrollHandler.handleWheel(event, settings, this.state.absolute, this.state.isCaptured());
	};

	/**
	 * Handle touch start events
	 * @param {TouchEvent} event - Touch event
	 */
	this.handleTouchStart = function (event) {
		event.preventDefault();
		this.currentStrategy.handleTouchStart(event);
	};

	/**
	 * Handle touch move events
	 * @param {TouchEvent} event - Touch event
	 */
	this.handleTouchMove = function (event) {
		event.preventDefault();
		this.currentStrategy.handleTouchMove(event);
	};

	/**
	 * Handle touch end events
	 * @param {TouchEvent} event - Touch event
	 */
	this.handleTouchEnd = function (event) {
		event.preventDefault();
		this.currentStrategy.handleTouchEnd(event);
	};

	/**
	 * Update online LED indicators
	 */
	this.updateOnlineLeds = function () {
		const ledState = this.state.getLedState();
		const streamBoxClasses = this.state.getStreamBoxClasses();

		$("hid-mouse-led").className = ledState.led;
		$("hid-mouse-led").title = ledState.title;

		$("stream-box").classList.toggle(MOUSE_CONSTANTS.CSS_CLASSES.MOUSE_DOT, streamBoxClasses.mouseDot);
		$("stream-box").classList.toggle(MOUSE_CONSTANTS.CSS_CLASSES.MOUSE_NONE, streamBoxClasses.mouseNone);
	};

	// Public API methods

	/**
	 * Set WebSocket connection
	 * @param {WebSocket} ws - WebSocket connection
	 */
	this.setSocket = function (ws) {
		this.state.setSocket(ws);
		this.communication.setSocket(ws);

		if (!this.state.absolute && this.state.isRelativeCaptured()) {
			document.exitPointerLock();
		}

		this.updateOnlineLeds();
	};

	/**
	 * Set mouse state
	 * @param {boolean} online - Whether mouse is online
	 * @param {boolean} absolute - Whether absolute mode is enabled
	 * @param {boolean} hidOnline - Whether HID is online
	 * @param {boolean} hidBusy - Whether HID is busy
	 */
	this.setState = function (online, absolute, hidOnline, hidBusy) {
		this.state.setState(online, absolute, hidOnline, hidBusy);

		if (!this.state.absolute && absolute && this.state.isRelativeCaptured()) {
			document.exitPointerLock();
		}

		this.currentStrategy = this.state.absolute ? this.strategies.absolute : this.strategies.relative;

		this.updateOnlineLeds();
	};

	/**
	 * Release all mouse buttons
	 */
	this.releaseAll = function () {
		this.keypad.releaseAll();
	};

	// Controller interface methods for strategies

	/**
	 * Plan mouse movement (for absolute mode)
	 * @param {Object} pos - Position object
	 */
	this.planMove = function (pos) {
		this.state.plannedPos = pos;
	};

	/**
	 * Clear planned move
	 */
	this.clearPlannedMove = function () {
		this.state.plannedPos = null;
	};

	/**
	 * Send planned mouse movement
	 */
	this.sendPlannedMove = function () {
		if (this.state.absolute) {
			const pos = this.state.plannedPos;
			if (pos !== null && (pos.x !== this.state.sentPos.x || pos.y !== this.state.sentPos.y)) {
				const geo = this.getGeometry();
				const to = {
					x: tools.remap(pos.x - geo.x, 0, geo.width - 1, MOUSE_CONSTANTS.ABSOLUTE_COORD_MIN, MOUSE_CONSTANTS.ABSOLUTE_COORD_MAX),
					y: tools.remap(pos.y - geo.y, 0, geo.height - 1, MOUSE_CONSTANTS.ABSOLUTE_COORD_MIN, MOUSE_CONSTANTS.ABSOLUTE_COORD_MAX)
				};
				this.communication.sendMove(to);
				this.state.sentPos = pos;
			}
		} else if (this.state.relativeDeltas.length) {
			this.communication.sendRelativeMove(this.state.relativeDeltas, true);
			this.state.relativeDeltas = [];
		}
	};

	/**
	 * Send relative mouse movement
	 * @param {Object} delta - Movement delta
	 */
	this.sendRelativeMove = function (delta) {
		const settings = this.settings.getSettings();
		const processedDelta = this.communication.processRelativeMove(
			delta,
			settings.relativeSens,
			settings.squash
		);

		if (processedDelta && settings.squash) {
			this.state.relativeDeltas.push(processedDelta);
		}
	};

	/**
	 * Send scroll event
	 * @param {Object} delta - Scroll delta
	 */
	this.sendScroll = function (delta) {
		const settings = this.settings.getSettings();
		this.communication.processScroll(
			delta,
			settings.scrollRate,
			settings.reverseScrolling,
			settings.reversePanning
		);
	};

	/**
	 * Send button event
	 * @param {string} button - Button name
	 * @param {boolean} state - Button state
	 */
	this.sendButton = function (button, state) {
		this.sendPlannedMove();
		this.communication.sendButton(button, state);
	};

	// State access methods for strategies

	/**
	 * Check if stream is hovered
	 * @returns {boolean} Whether stream is hovered
	 */
	this.isStreamHovered = function () {
		return this.state.streamHovered;
	};

	/**
	 * Check if device is mobile
	 * @returns {boolean} Whether device is mobile
	 */
	this.isMobile = function () {
		return tools.browser.is_mobile;
	};

	/**
	 * Check if relative mouse is captured
	 * @returns {boolean} Whether relative mouse is captured
	 */
	this.isRelativeCaptured = function () {
		return this.state.isRelativeCaptured();
	};

	/**
	 * Request pointer lock
	 */
	this.requestPointerLock = function () {
		$("stream-box").requestPointerLock();
	};

	/**
	 * Get relative touch position
	 * @returns {Object|null} Touch position
	 */
	this.getRelativeTouchPos = function () {
		return this.state.relativeTouchPos;
	};

	/**
	 * Set relative touch position
	 * @param {Object} pos - Touch position
	 */
	this.setRelativeTouchPos = function (pos) {
		this.state.relativeTouchPos = pos;
	};

	/**
	 * Clear relative touch position
	 */
	this.clearRelativeTouchPos = function () {
		this.state.relativeTouchPos = null;
	};

	/**
	 * Get scroll touch position
	 * @returns {Object|null} Touch position
	 */
	this.getScrollTouchPos = function () {
		return this.state.scrollTouchPos;
	};

	/**
	 * Set scroll touch position
	 * @param {Object} pos - Touch position
	 */
	this.setScrollTouchPos = function (pos) {
		this.state.scrollTouchPos = pos;
	};

	/**
	 * Clear scroll touch position
	 */
	this.clearScrollTouchPos = function () {
		this.state.scrollTouchPos = null;
	};

	// Initialize
	__init__();
}
