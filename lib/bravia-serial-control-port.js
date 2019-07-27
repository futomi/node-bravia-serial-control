/* ------------------------------------------------------------------
* node-bravia-serial-control - bravia-serial-control-port.js
*
* Copyright (c) 2019, Futomi Hatano, All rights reserved.
* Released under the MIT license
* Date: 2019-07-27
* ---------------------------------------------------------------- */
'use strict';
const mSerialPort = require('serialport');

/* ------------------------------------------------------------------
* BraviaSerialControlPort()
* - Constructor
*
* [Arguments]
* - params     | Object  | Required | 
*   - path     | String  | Required | The identifier of the serial port
*              |         |          | (e.g., "/dev/ttyUSB0", "COM3")
*   - interval | Integer | Optional | Command interval (msec)
*              |         |          | (Default: 500ms)
* ---------------------------------------------------------------- */
const BraviaSerialControlPort = function (params) {
	if (!params || typeof (params) !== 'object') {
		throw new Error('The `params` must be an object.');
	}
	// Check the `path`
	let path = params['path'];
	if (!path) {
		throw new Error('The `path` is required.');
	} else if (typeof (path) !== 'string') {
		throw new Error('The `path` must be a string.');
	}
	// Check the `interval`
	let interval = 500;
	if ('interval' in params) {
		interval = params['interval'];
		if (typeof (interval) !== 'number' || interval % 1 > 0 || interval < 0 || interval > 1000) {
			throw new Error('The `interval` must be an integer in the range of 0 to 1000.');
		}
	}

	// Private
	this._path = path;
	this._interval = interval;
	this._port = null;
	this._ondata = null;
	this._received_byte_list = [];
	this._received_byte_sum = 0;
	this._last_received_time = 0;
	this._connection_closed_intentionally = false;

	// Public
	this.onclose = null;
};

/* ------------------------------------------------------------------
* isOpen()
* - Get the connection status of the serial port
*
* [Arguments]
* - none
*
* [Return value]
* - true: opened, false: closed
* ---------------------------------------------------------------- */
BraviaSerialControlPort.prototype.isOpen = function () {
	if (this._port) {
		return this._port.isOpen;
	} else {
		return false;
	}
};

/* ------------------------------------------------------------------
* open()
* - Open the serial port.
*
* [Arguments]
* - none
*
* [Return value]
* - A promise object
* ---------------------------------------------------------------- */
BraviaSerialControlPort.prototype.open = function () {
	let promise = new Promise((resolve, reject) => {
		this._connection_closed_intentionally = false;
		let port = new mSerialPort(this._path, {
			autoOpen: false,
			baudRate: 9600,
			dataBits: 8,
			stopBits: 1,
			parity: 'none'
		});
		port.open((error) => {
			if (error) {
				reject(error);
			} else {
				port.on('data', (buf) => {
					this._receivedData(buf);
				});
				port.on('close', () => {
					this._closed();
				});
				this._port = port;
				resolve();
			}
		});
	});
	return promise;
};

BraviaSerialControlPort.prototype._closed = function () {
	this._port = null;
	if (this.onclose && typeof (this.onclose) === 'function') {
		this.onclose({ intentional: this._connection_closed_intentionally });
		this.onclose = null;
	}
	this._connection_closed_intentionally = false;
};

BraviaSerialControlPort.prototype._receivedData = function (buf) {
	let now = Date.now();
	if (now - this._last_received_time > 5000) {
		this._received_byte_list = [];
		this._received_byte_sum = 0;
	}
	this._last_received_time = now;

	let last_val = 0;
	for (let val of buf.values()) {
		this._received_byte_list.push(val);
		this._received_byte_sum += val;
		last_val = val;
	}
	if ((this._received_byte_sum - last_val) % 256 === last_val) {
		let frame = this._parseDataFrame(this._received_byte_list);
		this._received_byte_list = [];
		this._received_byte_sum = 0;
		if (!frame) {
			return;
		}
		if (this._ondata && typeof (this._ondata) === 'function') {
			this._ondata(frame);
		}
	}
};

BraviaSerialControlPort.prototype._parseDataFrame = function (bytes) {
	// Check the header value
	let header = bytes[0];
	if (header !== 0x70) {
		return null;
	}

	let ans = bytes[1];
	let frame = {
		data: [],
		code: ans,
		message: ''
	};

	if (bytes.length === 3) {
		// Response to Control Request (BRAVIA Professional Display to PC)
		// Response to Query Request (Abnormal End)
		if (ans === 0x00) {
			frame['message'] = 'Completed';
		} else if (ans === 0x01) {
			frame['message'] = 'Limit Over (over maximum value)';
		} else if (ans === 0x02) {
			frame['message'] = 'Limit Over (under minimum value)';
		} else if (ans === 0x03) {
			frame['message'] = 'Command Canceled';
		} else if (ans === 0x04) {
			frame['message'] = 'Parse Error (Data Format Error)';
		} else {
			let ans_hex = Buffer.from([ans]).toString('hex');
			frame['message'] = 'Unknown Answer (0x' + ans_hex + ')';
		}
	} else {
		// Response to Query Request (Normal End)
		if (ans === 0x00) {
			frame['message'] = 'Completed';
		} else if (ans === 0x03) {
			frame['message'] = 'Command Canceled';
		} else if (ans === 0x04) {
			frame['message'] = 'Parse Error (Data Format Error)';
		} else {
			let ans_hex = Buffer.from([ans]).toString('hex');
			frame['message'] = 'Unknown Answer (0x' + ans_hex + ')';
		}
		let data_size = bytes[2] - 1;
		let data = [];
		for (let i = 0; i < data_size; i++) {
			data.push(bytes[i + 3]);
		}
		frame['data'] = data;
	}
	return frame;
};

/* ------------------------------------------------------------------
* close()
* - Close the serial port.
*
* [Arguments]
* - none
*
* [Return value]
* - A promise object
* ---------------------------------------------------------------- */
BraviaSerialControlPort.prototype.close = function () {
	let promise = new Promise((resolve, reject) => {
		if (!this._port) {
			resolve();
			return;
		}
		this._connection_closed_intentionally = true;
		this._port.close((error) => {
			if (error) {
				reject(error);
			} else {
				this._port = null;
				resolve();
			}
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* requestRead()
* - Send a request for reading data and receive a response.
*
* [Arguments]
* - none
*
* [Return value]
* - A promise object
* ---------------------------------------------------------------- */
BraviaSerialControlPort.prototype.requestRead = function (func_code) {
	let promise = new Promise((resolve, reject) => {
		let bytes = [0x83, 0x00, func_code, 0xff, 0xff];
		this._request(bytes).then((frame) => {
			resolve(frame);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* requestWrite()
* - Send a request for writing data and receive a response.
*
* [Arguments]
* - none
*
* [Return value]
* - A promise object
* ---------------------------------------------------------------- */
BraviaSerialControlPort.prototype.requestWrite = function (func_code, data) {
	let promise = new Promise((resolve, reject) => {
		let bytes = [0x8C, 0x00, func_code, data.length + 1];
		data.forEach((n) => {
			bytes.push(n);
		});
		this._request(bytes).then((frame) => {
			resolve(frame);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

BraviaSerialControlPort.prototype._request = function (bytes) {
	let promise = new Promise((resolve, reject) => {
		let chksum = this._createCheckSum(bytes);
		bytes.push(chksum);
		let buf = Buffer.from(bytes);
		this._waitForRequestInterval(() => {
			this._port.write(buf, (error) => {
				if (error) {
					reject(error);
				}
				this._ondata = (frame) => {
					this._ondata = null;
					if (frame['code'] === 0) {
						resolve(frame);
					} else {
						reject(new Error(frame['message']));
					}
				};
			});
		});
	});
	return promise;
};

BraviaSerialControlPort.prototype._waitForRequestInterval = function (callback) {
	let promise = new Promise((resolve, reject) => {
		let now = Date.now();
		let elapse = now - this._last_request_time;
		this._last_request_time = now;
		if (elapse < this._interval) {
			let delay = this._interval - elapse;
			setTimeout(() => {
				callback();
			}, delay);
		} else {
			callback();
		}
	});
	return promise;
};

BraviaSerialControlPort.prototype._createCheckSum = function (bytes) {
	let sum = 0;
	bytes.forEach((n) => {
		sum += n;
	});
	let chksum = sum % 256;
	return chksum;
};

module.exports = BraviaSerialControlPort;
