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


import { ROOT_PREFIX } from "../vars.js";
import { tools, $ } from "../tools.js";


/**
 * MJPEG HTTP streamer class for PiKVM
 * Класс MJPEG HTTP стримера для PiKVM
 * @param {Function} __setActive - Callback when stream becomes active / Колбэк когда стрим становится активным
 * @param {Function} __setInactive - Callback when stream becomes inactive / Колбэк когда стрим становится неактивным
 * @param {Function} __setInfo - Callback to set stream info / Колбэк для установки информации о стриме
 * @param {Function} __organizeHook - Callback to organize stream window / Колбэк для организации окна стрима
 */
export function MjpegStreamer(__setActive, __setInactive, __setInfo, __organizeHook) {
	var self = this;

	/************************************************************************/

	var __key = tools.makeRandomId();
	var __id = "";
	var __fps = -1;
	var __state = null;

	var __timer = null;
	var __timer_retries = 0;

	/************************************************************************/

	/**
	 * Get streamer name for display
	 * Получение имени стримера для отображения
	 * @returns {string} Streamer name / Имя стримера
	 */
	self.getName = () => "HTTP MJPEG";

	/**
	 * Get streamer mode identifier
	 * Получение идентификатора режима стримера
	 * @returns {string} Streamer mode / Режим стримера
	 */
	self.getMode = () => "mjpeg";

	/**
	 * Get current stream resolution information
	 * Получение информации о текущем разрешении стрима
	 * @returns {Object} Resolution object with real and view dimensions / Объект разрешения с реальными и отображаемыми размерами
	 */
	self.getResolution = function () {
		let el = $("stream-image");
		return {
			"real_width": el.naturalWidth,
			"real_height": el.naturalHeight,
			"view_width": el.offsetWidth,
			"view_height": el.offsetHeight,
		};
	};

	/**
	 * Ensure stream is running with given state
	 * Обеспечение работы стрима с заданным состоянием
	 * @param {Object} state - Stream state object / Объект состояния стрима
	 */
	self.ensureStream = function (state) {
		if (state) {
			__state = state;
			__findId();
			if (__id.length > 0 && __id in __state.stream.clients_stat) {
				__setStreamActive();
				__stopChecking();
				__organizeHook();
			} else {
				__ensureChecking();
			}
		} else {
			__stopChecking();
			__setStreamInactive();
		}
	};

	/**
	 * Stop the stream and show blank image
	 * Остановка стрима и отображение пустого изображения
	 */
	self.stopStream = function () {
		self.ensureStream(null);
		let blank = `${ROOT_PREFIX}share/png/blank-stream.png`;
		if (!String.prototype.endsWith.call($("stream-image").src, blank)) {
			$("stream-image").src = blank;
		}
	};

	/**
	 * Set stream as active and update FPS info
	 * Установка стрима как активного и обновление информации о FPS
	 */
	var __setStreamActive = function () {
		let old_fps = __fps;
		__fps = __state.stream.clients_stat[__id].fps;
		if (old_fps < 0) {
			__logInfo("Active");
			__setActive();
		}
		__setInfo(true, __state.source.online, `${__fps} fps dynamic`);
	};

	/**
	 * Set stream as inactive and reset state
	 * Установка стрима как неактивного и сброс состояния
	 */
	var __setStreamInactive = function () {
		let old_fps = __fps;
		__key = tools.makeRandomId();
		__id = "";
		__fps = -1;
		__state = null;
		if (old_fps >= 0) {
			__logInfo("Inactive");
			__setInactive();
			__setInfo(false, false, "");
		}
	};

	/**
	 * Start checking stream status periodically
	 * Запуск периодической проверки статуса стрима
	 */
	var __ensureChecking = function () {
		if (!__timer) {
			__timer_retries = 10;
			__timer = setInterval(__checkStream, 100);
		}
	};

	/**
	 * Stop checking stream status
	 * Остановка проверки статуса стрима
	 */
	var __stopChecking = function () {
		if (__timer) {
			clearInterval(__timer);
		}
		__timer = null;
		__timer_retries = 0;
	};

	/**
	 * Find stream client ID from cookie
	 * Поиск ID клиента стрима из cookie
	 */
	var __findId = function () {
		let sc = tools.cookies.get("stream_client");
		if (__id.length === 0 && sc && sc.startsWith(__key + "/")) {
			__logInfo("Found acceptable stream_client cookie:", sc);
			__id = sc.slice(sc.indexOf("/") + 1);
		}
	};

	/**
	 * Check stream status and handle reconnection
	 * Проверка статуса стрима и обработка переподключения
	 */
	var __checkStream = function () {
		__findId();

		if (__id.legnth > 0 && __id in __state.stream.clients_stat) {
			__setStreamActive();
			__stopChecking();

		} else if (__id.length > 0 && __timer_retries >= 0) {
			__timer_retries -= 1;

		} else {
			__setStreamInactive();
			__stopChecking();

			let path = `${ROOT_PREFIX}streamer/stream?key=${encodeURIComponent(__key)}`;
			if (tools.browser.is_safari || tools.browser.is_ios) {
				// uStreamer fix for WebKit
				__logInfo("Using dual_final_frames=1 to fix WebKit bugs");
				path += "&dual_final_frames=1";
			} else if (tools.browser.is_chrome || tools.browser.is_blink) {
				// uStreamer fix for Blink https://bugs.chromium.org/p/chromium/issues/detail?id=527446
				__logInfo("Using advance_headers=1 to fix Blink bugs");
				path += "&advance_headers=1";
			}

			__logInfo("Refreshing ...");
			$("stream-image").src = path;
		}
	};

	/**
	 * Log information messages for debugging
	 * Логирование информационных сообщений для отладки
	 * @param {...*} args - Arguments to log / Аргументы для логирования
	 */
	var __logInfo = (...args) => tools.info("Stream [MJPEG]:", ...args);
}
