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

import { MOUSE_CONSTANTS } from "./mouse-constants.js";

/**
 * Base mouse mode strategy
 */
export class MouseModeStrategy {
	constructor(controller) {
		this.controller = controller;
	}

	/**
	 * Handle mouse move event
	 * @param {MouseEvent} event - Mouse move event
	 */
	handleMove(event) {
		throw new Error("handleMove must be implemented");
	}

	/**
	 * Handle mouse click event - common logic for both strategies
	 * @param {MouseEvent} event - Mouse click event
	 * @param {boolean} state - Button state
	 */
	handleClick(event, state) {
		if (this.controller.state.absolute || this.controller.isRelativeCaptured()) {
			const buttonName = MOUSE_CONSTANTS.BUTTON_MAPPINGS[event.button];
			if (buttonName) {
				this.controller.keypad.emitByCode(buttonName, state);
			}
		} else if (!this.controller.state.absolute && !this.controller.isRelativeCaptured() && !state) {
			this.controller.requestPointerLock();
		}
	}

	/**
	 * Handle touch start event
	 * @param {TouchEvent} event - Touch start event
	 */
	handleTouchStart(event) {
		throw new Error("handleTouchStart must be implemented");
	}

	/**
	 * Handle touch move event
	 * @param {TouchEvent} event - Touch move event
	 */
	handleTouchMove(event) {
		throw new Error("handleTouchMove must be implemented");
	}

	/**
	 * Handle touch end event
	 * @param {TouchEvent} event - Touch end event
	 */
	handleTouchEnd(event) {
		throw new Error("handleTouchEnd must be implemented");
	}

	/**
	 * Check if mouse is captured
	 * @returns {boolean} Whether mouse is captured
	 */
	isCaptured() {
		throw new Error("isCaptured must be implemented");
	}

	/**
	 * Get touch position relative to target element
	 * @param {TouchEvent} event - Touch event
	 * @param {number} index - Touch index
	 * @returns {Object|null} Touch position object with x, y coordinates or null
	 */
	getTouchPosition(event, index) {
		if (event.touches[index].target && event.touches[index].target.getBoundingClientRect) {
			const rect = event.touches[index].target.getBoundingClientRect();
			return {
				x: Math.round(event.touches[index].clientX - rect.left),
				y: Math.round(event.touches[index].clientY - rect.top)
			};
		}
		return null;
	}
}

/**
 * Absolute mouse mode strategy
 */
export class AbsoluteMouseStrategy extends MouseModeStrategy {
	/**
	 * Handle mouse move event
	 * @param {MouseEvent} event - Mouse move event
	 */
	handleMove(event) {
		const rect = event.target.getBoundingClientRect();
		const pos = {
			x: Math.max(Math.round(event.clientX - rect.left), 0),
			y: Math.max(Math.round(event.clientY - rect.top), 0)
		};

		this.controller.planMove(pos);
	}

	/**
	 * Handle touch start event
	 * @param {TouchEvent} event - Touch start event
	 */
	handleTouchStart(event) {
		if (event.touches.length === 1) {
			const pos = this.getTouchPosition(event, 0);
			if (pos) {
				this.controller.planMove(pos);
				this.controller.sendPlannedMove();
			}
		} else if (event.touches.length >= 2) {
			this.controller.clearPlannedMove();
		}
	}

	/**
	 * Handle touch move event
	 * @param {TouchEvent} event - Touch move event
	 */
	handleTouchMove(event) {
		if (event.touches.length === 1) {
			const pos = this.getTouchPosition(event, 0);
			if (pos) {
				this.controller.planMove(pos);
			}
		} else if (event.touches.length >= 2) {
			this.handleMultiTouchScroll(event);
		}
	}

	/**
	 * Handle touch end event
	 * @param {TouchEvent} event - Touch end event
	 */
	handleTouchEnd(event) {
		this.controller.sendPlannedMove();
		this.controller.clearScrollTouchPos();

		if (event.touches.length >= 2) {
			this.controller.clearPlannedMove();
		}
	}

	/**
	 * Handle multi-touch scroll
	 * @param {TouchEvent} event - Touch move event
	 */
	handleMultiTouchScroll(event) {
		const pos = this.getTouchPosition(event, 0);
		if (!pos) return;

		const scrollPos = this.controller.getScrollTouchPos();
		if (scrollPos === null) {
			this.controller.setScrollTouchPos(pos);
		} else {
			const dx = scrollPos.x - pos.x;
			const dy = scrollPos.y - pos.y;

			const threshold = MOUSE_CONSTANTS.TOUCH_THRESHOLD;
			const delta = {
				x: Math.abs(dx) < threshold ? 0 : dx,
				y: Math.abs(dy) < threshold ? 0 : dy
			};

			if (delta.x || delta.y) {
				this.controller.sendScroll(delta);
				this.controller.setScrollTouchPos(null);
			}
		}
	}

	/**
	 * Check if mouse is captured
	 * @returns {boolean} Whether mouse is captured
	 */
	isCaptured() {
		return this.controller.isStreamHovered() || this.controller.isMobile();
	}
}

/**
 * Relative mouse mode strategy
 */
export class RelativeMouseStrategy extends MouseModeStrategy {
	/**
	 * Handle mouse move event
	 * @param {MouseEvent} event - Mouse move event
	 */
	handleMove(event) {
		if (this.isCaptured()) {
			const delta = {
				x: event.movementX,
				y: event.movementY
			};
			this.controller.sendRelativeMove(delta);
		}
	}

	/**
	 * Handle touch start event
	 * @param {TouchEvent} event - Touch start event
	 */
	handleTouchStart(event) {
		if (event.touches.length === 1) {
			const pos = this.getTouchPosition(event, 0);
			if (pos) {
				this.controller.setRelativeTouchPos(pos);
			}
		} else if (event.touches.length >= 2) {
			this.controller.clearRelativeTouchPos();
		}
	}

	/**
	 * Handle touch move event
	 * @param {TouchEvent} event - Touch move event
	 */
	handleTouchMove(event) {
		if (event.touches.length === 1) {
			const pos = this.getTouchPosition(event, 0);
			if (!pos) return;

			const touchPos = this.controller.getRelativeTouchPos();
			if (touchPos === null) {
				this.controller.setRelativeTouchPos(pos);
			} else {
				const delta = {
					x: pos.x - touchPos.x,
					y: pos.y - touchPos.y
				};
				this.controller.sendRelativeMove(delta);
				this.controller.setRelativeTouchPos(pos);
			}
		} else if (event.touches.length >= 2) {
			this.handleMultiTouchScroll(event);
		}
	}

	/**
	 * Handle touch end event
	 * @param {TouchEvent} event - Touch end event
	 */
	handleTouchEnd(event) {
		this.controller.sendPlannedMove();
		this.controller.clearScrollTouchPos();

		if (event.touches.length >= 2) {
			this.controller.clearRelativeTouchPos();
		}
	}

	/**
	 * Handle multi-touch scroll
	 * @param {TouchEvent} event - Touch move event
	 */
	handleMultiTouchScroll(event) {
		const pos = this.getTouchPosition(event, 0);
		if (!pos) return;

		const scrollPos = this.controller.getScrollTouchPos();
		if (scrollPos === null) {
			this.controller.setScrollTouchPos(pos);
		} else {
			const dx = scrollPos.x - pos.x;
			const dy = scrollPos.y - pos.y;

			const threshold = MOUSE_CONSTANTS.TOUCH_THRESHOLD;
			const delta = {
				x: Math.abs(dx) < threshold ? 0 : dx,
				y: Math.abs(dy) < threshold ? 0 : dy
			};

			if (delta.x || delta.y) {
				this.controller.sendScroll(delta);
				this.controller.setScrollTouchPos(null);
			}
		}
	}

	/**
	 * Check if mouse is captured
	 * @returns {boolean} Whether mouse is captured
	 */
	isCaptured() {
		return this.controller.isRelativeCaptured();
	}
}
