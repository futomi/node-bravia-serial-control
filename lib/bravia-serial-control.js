/* ------------------------------------------------------------------
* node-bravia-serial-control - bravia-serial-control.js
*
* Copyright (c) 2019, Futomi Hatano, All rights reserved.
* Released under the MIT license
* Date: 2019-07-27
* ---------------------------------------------------------------- */
'use strict';
const mSerialPort = require('./bravia-serial-control-port.js');

/* ------------------------------------------------------------------
* BraviaSerialControl()
* - Constructor
*
* [Arguments]
* - params     | Object  | Required | 
*   - path     | String  | Required | The identifier of the serial port
*              |         |          | (e.g., "/dev/ttyUSB0", "COM3")
*   - interval | Integer | Optional | Command interval (msec)
*              |         |          | (Default: 500ms)
* ---------------------------------------------------------------- */
const BraviaSerialControl = function (params) {
	// Public
	this.onclose = null;

	// Private
	this._serialPort = new mSerialPort(params);
	this._sircs_code_map = require('./bravia-serial-control-sircs.js');
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
BraviaSerialControl.prototype.open = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.open().then(() => {
			this._serialPort.onclose = (event) => {
				if (this.onclose && typeof (this.onclose) === 'function') {
					this.onclose(event);
				}
			};
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
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
BraviaSerialControl.prototype.close = function () {
	return this._serialPort.close();
};

/* ------------------------------------------------------------------
* isOpen()
* - Get the connection status of the serial port
*
* [Arguments]
* - none
*
* [Return value]
* - - true: opened, false: closed
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.isOpen = function () {
	return this._serialPort.isOpen();
};

/* ------------------------------------------------------------------
* getPowerStatus()
* - Get the power status
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function. 
*
* {
*   "status": true // true: Active (On), false: Standby (Off)
* }
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.getPowerStatus = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestRead(0x00).then((frame) => {
			let data = frame['data'];
			if (data.length !== 1) {
				reject(new Error('Unknown response data.'));
				return;
			}
			if (data[0] === 0x00) {
				resolve({ status: false });
			} else if (data[0] === 0x01) {
				resolve({ status: true });
			} else {
				reject(new Error('Unknown response data.'));
			}
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* setPowerStatus(params)
* - Change the power status
*
* [Arguments]
* - params   | Object  | Optional |
*   - status | Boolean | Optional | `true`: ON, `false`: OFF
*
* * If the `status` is not specified, this method toggles the status.
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function. 
*
* {
*   "status": true
* }.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setPowerStatus = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			params = {};
		}

		let status = null;
		if ('status' in params) {
			status = params['status'];
			if (typeof (status) !== 'boolean') {
				reject(new Error('The `status` must be `true` or `false`.'));
				return;
			}
		}

		if (status === null) {
			this.togglePowerStatus().then((res) => {
				resolve(res);
			}).catch((error) => {
				reject(error);
			});
		} else {
			if (status === true) {
				this.powerOn().then((res) => {
					resolve(res);
				}).catch((error) => {
					reject(error);
				});
			} else {
				this.powerOff().then((res) => {
					resolve(res);
				}).catch((error) => {
					reject(error);
				});
			}
		}
	});
	return promise;
};

/* ------------------------------------------------------------------
* powerOn()
* - Turn on the BRAVIA
*
* [Arguments]
* - none
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function. 
*
* {
*   "status": true
* }
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.powerOn = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestWrite(0x00, [0x01]).then((frame) => {
			return this._wait(1000);
		}).then(() => {
			return this.getPowerStatus();
		}).then((res) => {
			if (res['status'] === true) {
				resolve(res);
			} else {
				reject(new Error('Failed to power on. The standby mode is possibly disabled. It is recommended to turn on the BRAVIA manually, then enable the standby mode in advance (use `enableStandby()` method). Once the standby mode is enabled, you can turn on the BRAVIA using the `powerOn()` method anytime.'));
			}
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

BraviaSerialControl.prototype._wait = function (msec) {
	let promise = new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve();
		}, msec);
	});
	return promise;
};

/* ------------------------------------------------------------------
* powerOff()
* - Turn off the BRAVIA
*
* [Arguments]
* - none
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function. 
*
* {
*   "status": false
* }
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.powerOff = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestWrite(0x00, [0x00]).then((frame) => {
			return this._wait(1000);
		}).then(() => {
			return this.getPowerStatus();
		}).then((res) => {
			if (res['status'] === false) {
				resolve(res);
			} else {
				reject(new Error('Failed to power off.'));
			}
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* togglePowerStatus()
* - Toggle the power status
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function. 
*
* {
*   "status": true // true: Active (On), false: Standby (Off)
* }
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.togglePowerStatus = function () {
	let promise = new Promise((resolve, reject) => {
		this.getPowerStatus().then((res) => {
			if (res['status'] === true) {
				return this.powerOff();
			} else {
				return this.powerOn();
			}
		}).then((res) => {
			resolve(res);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* enableStandby()
* - Enable the standby mode
*
* [Arguments]
* - none
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
*
* Note that the standby mode has been already enabled, the BRAVIA
* will respond an error.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.enableStandby = function () {
	let promise = new Promise((resolve, reject) => {
		this.getPowerStatus().then((res) => {
			if (res['status'] === false) {
				throw new Error('Turn on the BRAVIA in advance to use the `enableStandby()` method.');
			}
			return this._serialPort.requestWrite(0x01, [0x01]);
		}).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		})
	});
	return promise;
};

/* ------------------------------------------------------------------
* disableStandby()
* - disable the standby mode
*
* [Arguments]
* - none
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
*
* Note that the standby mode has been already disabled, the BRAVIA
* will respond an error.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.disableStandby = function () {
	let promise = new Promise((resolve, reject) => {
		this.getPowerStatus().then((res) => {
			if (res['status'] === false) {
				throw new Error('Turn on the BRAVIA in advance to use the `disableStandby()` method.');
			}
			return this._serialPort.requestWrite(0x01, [0x00]);
		}).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		})
	});
	return promise;
};

/* ------------------------------------------------------------------
* getInput()
* - Get current input
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function. 
*
* {
*   "type": "hdmi",
*   "port": 1
* }
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.getInput = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestRead(0x02).then((frame) => {
			let data = frame['data'];
			if (data.length !== 2) {
				reject(new Error('Unknown response data.'));
				return;
			}
			if (data[0] === 0x01) {
				// This is not defined in the official specification.
				// Just happened to notice.
				// The meaning of the port number is unknown.
				// At least, the port number does not seem to mean a channel number.
				resolve({ type: 'tv', port: data[1] });
			} else if (data[0] === 0x02) {
				resolve({ type: 'video', port: data[1] });
			} else if (data[0] === 0x03) {
				resolve({ type: 'component', port: data[1] });
			} else if (data[0] === 0x04) {
				resolve({ type: 'hdmi', port: data[1] });
			} else if (data[0] === 0x05) {
				resolve({ type: 'pc', port: data[1] });
			} else if (data[0] === 0x07) {
				resolve({ type: 'shared', port: data[1] });
			} else {
				reject(new Error('Unknown response data: ' + Buffer.from(data).toString('hex')));
			}
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* setInput(params)
* - Change the external input
*
* [Arguments]
* - params   | Object  | Required |
*   - type   | String  | Required | "tv", "video", "component", "hdmi", "pc", or "shared"
*   - port   | Integer | Required | 1 - 5 (The maximum number depends on the `type`)
*
* If "tv" is specified to the `type`, the value of `port` must be 1.
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setInput = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			reject(new Error('The `params` must be an object.'));
			return;
		}
		let type = '';
		if ('type' in params) {
			type = params['type'];
			if (typeof (type) !== 'string' || !/^(tv|video|component|hdmi|pc|shared)$/.test(type)) {
				reject(new Error('The `type` must be "tv", "video", "component", "hdmi", "pc", or "shared".'));
				return;
			}
		} else {
			reject(new Error('The `type` is required.'));
			return;
		}
		let type_code_map = {
			tv: 0x01,
			video: 0x02,
			component: 0x03,
			hdmi: 0x04,
			pc: 0x05,
			shared: 0x07
		};
		let type_code = type_code_map[type];

		let port = 0;
		if ('port' in params) {
			port = params['port'];
			let max_map = {
				tv: 1,
				video: 3,
				component: 3,
				hdmi: 5,
				pc: 1,
				shared: 1
			};
			let max = max_map[type];
			if (typeof (port) !== 'number' || port % 1 > 0 || port < 1 || port > max) {
				reject(new Error('The `port` must be an integer between 1 and ' + max + '.'));
				return;
			}
		} else {
			reject(new Error('The `port` is required.'));
			return;
		}

		let bytes = [type_code, port];
		if (type === 'tv') {
			bytes = [type_code];
		}
		this._serialPort.requestWrite(0x02, bytes).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* getAudioVolume()
* - Get the volume
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function.
*
* {
*   "volume": 20
* }
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.getAudioVolume = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestRead(0x05).then((frame) => {
			let data = frame['data'];
			if (data.length !== 2) {
				reject(new Error('Unknown response data.'));
				return;
			}
			if (data[0] !== 0x01) {
				reject(new Error('Unknown response data.'));
				return;
			}
			resolve({ volume: data[1] });
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* setAudioVolume(params)
* - Set the volume
*
* [Arguments]
* - params   | Object  | Required |
*   - volume | Integer | Required | 0 - 100
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function.
*
* {
*   "volume": 20
* }
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setAudioVolume = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			reject(new Error('The `params` must be an object.'));
			return;
		}
		let vol = 0;
		if ('volume' in params) {
			vol = params['volume'];
			if (typeof (vol) !== 'number' || vol % 1 > 0 || vol < 0 || vol > 100) {
				reject(new Error('The `volume` must be an integer between 0 and 100.'));
				return;
			}
		} else {
			reject(new Error('The `volume` is required.'));
			return;
		}
		this._serialPort.requestWrite(0x05, [0x01, vol]).then((frame) => {
			return this.getAudioVolume();
		}).then((res) => {
			resolve(res);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* volumeUp(params)
* - Increment the volume level by the specified steps
*
* [Arguments]
* - params  | Object  | Optional |
*   - step  | Integer | Optional | 1 - 100 (Default: 1)
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function.
*
* {
*   "volume": 20
* }
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.volumeUp = function (params) {
	let promise = new Promise((resolve, reject) => {
		let step = 1;
		if (params) {
			if (typeof (params) !== 'object') {
				reject(new Error('The `params` must be an object.'));
				return;
			}
			if ('step' in params) {
				step = params['step'];
				if (typeof (step) !== 'number' || step % 1 > 0 || step < 1 || step > 100) {
					reject(new Error('The `step` must be an integer between 1 and 100.'));
					return;
				}
			}
		}

		this.getAudioVolume().then((res) => {
			let vol = res['volume'] + step;
			if (vol > 100) {
				vol = 100;
			}
			return this.setAudioVolume({ volume: vol });
		}).then((res) => {
			resolve(res);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* volumeDown(params)
* - Decrement the volume level by the specified steps
*
* [Arguments]
* - params   | Object  | Optional |
*   - step   | Integer | Optional | 1 - 100 (Default: 1)
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function.
*
* {
*   "volume": 20
* }
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.volumeDown = function (params) {
	let promise = new Promise((resolve, reject) => {
		let step = 1;
		if (params) {
			if (typeof (params) !== 'object') {
				reject(new Error('The `params` must be an object.'));
				return;
			}
			if ('step' in params) {
				step = params['step'];
				if (typeof (step) !== 'number' || step % 1 > 0 || step < 1 || step > 100) {
					reject(new Error('The `step` must be an integer between 1 and 100.'));
					return;
				}
			}
		}

		this.getAudioVolume().then((res) => {
			let vol = res['volume'] - step;
			if (vol <= 0) {
				vol = 0;
			}
			return this.setAudioVolume({ volume: vol });
		}).then((res) => {
			resolve(res);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* getAudioMute()
* - Retrieve the audio mute status
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function.
*
* {
*   "status": true
* }
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.getAudioMute = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestRead(0x06).then((frame) => {
			let data = frame['data'];
			if (data.length !== 2) {
				reject(new Error('Unknown response data.'));
				return;
			}
			if (data[0] !== 0x01) {
				reject(new Error('Unknown response data.'));
				return;
			}
			let status = data[1] ? true : false;
			resolve({ status: status });
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* setAudioMute(params)
* - Change the audio mute status
*
* [Arguments]
* - params   | Object  | Optional |
*   - status | Boolean | Optional | `true`: ON, `false`: OFF
*
* * If the `status` is not specified, this method toggles the status.
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setAudioMute = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			params = {};
		}

		let status = null;
		if ('status' in params) {
			status = params['status'];
			if (typeof (status) !== 'boolean') {
				reject(new Error('The `status` must be `true` or `false`.'));
				return;
			}
		}

		if (status === null) {
			this._serialPort.requestWrite(0x06, [0x00]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		} else {
			let code = (status === true) ? 0x01 : 0x00;
			this._serialPort.requestWrite(0x06, [0x01, code]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		}
	});
	return promise;
};

/* ------------------------------------------------------------------
* muteAudio()
* - Mute
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function.
*
* {
*   "status": true
* } 
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.muteAudio = function () {
	return this.setAudioMute({ status: true });
};

/* ------------------------------------------------------------------
* unmuteAudio()
* - Unmute
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function.
*
* {
*   "status": true
* }  
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.unmuteAudio = function () {
	return this.setAudioMute({ status: false });
};

/* ------------------------------------------------------------------
* setOffTimer()
* - Set the off timer (sleep timer)
*
* [Arguments]
* - params   | Object  | Required |
*   - offset | Integer | Required | 0 - 255 (minites)
*
* The maximum value of the `offset` depends on the BRAVIA.
* Specifying 0 to the `offset` means disabling off timer.
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setOffTimer = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			reject(new Error('The `params` must be an object.'));
			return;
		}
		let offset = 0;
		if ('offset' in params) {
			offset = params['offset'];
			if (typeof (offset) !== 'number' || offset % 1 > 0 || offset < 0 || offset > 255) {
				reject(new Error('The `offset` must be an integer between 0 and 255.'));
				return;
			}
		} else {
			reject(new Error('The `offset` is required.'));
			return;
		}

		this._serialPort.requestWrite(0x0C, [0x01, offset]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* setPictureMute(params)
* - Change the picture mute status
*
* [Arguments]
* - params   | Object  | Optional |
*   - status | Boolean | Optional | `true`: ON, `false`: OFF
*
* * If the `status` is not specified, this method toggles the status.
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
*
* My BRAVIA accepts the toggle command, but does not accepts ON/OFF...
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setPictureMute = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			params = {};
		}

		let status = null;
		if ('status' in params) {
			status = params['status'];
			if (typeof (status) !== 'boolean') {
				reject(new Error('The `status` must be `true` or `false`.'));
				return;
			}
		}

		if (status === null) {
			this._serialPort.requestWrite(0x0D, [0x00]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		} else {
			let code = (status === true) ? 0x00 : 0x01;
			this._serialPort.requestWrite(0x0D, [0x01, code]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		}
	});
	return promise;
};

/* ------------------------------------------------------------------
* mutePicture()
* - Mute picture (Picture OFF)
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.mutePicture = function () {
	return this.setPictureMute({ status: true });
};

/* ------------------------------------------------------------------
* unmutePicture()
* - Unmute picture (Picture ON)
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.unmutePicture = function () {
	return this.setPictureMute({ status: false });
};

/* ------------------------------------------------------------------
* getTeletext()
* - Retrieve the teletext mode
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function.
*
* {
*   "mode": "text"
* }
*
* My BRAVIA returns an error...
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.getTeletext = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestRead(0x0E).then((frame) => {
			let data = frame['data'];
			if (data.length !== 2) {
				reject(new Error('Unknown response data.'));
				return;
			}
			if (data[0] !== 0x01) {
				reject(new Error('Unknown response data.'));
				return;
			}
			let mode = '';
			if (data[1] === 0x00) {
				mode = 'off';
			} else if (data[1] === 0x01) {
				mode = 'text';
			} else if (data[1] === 0x02) {
				mode = 'mix';
			} else {
				reject(new Error('Unknown response data.'));
				return;
			}
			resolve({ mode: mode });
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* toggleTeletext()
* - Toggle the teletext mode
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
*
* My BRAVIA returns an error...
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.toggleTeletext = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestWrite(0x0E, [0x00]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* toggleDisplay()
* - Toggle the display mode
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.toggleDisplay = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestWrite(0x0F, [0x00]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* setClosedCaptionStatus(params)
* - Change the closed caption status
*
* [Arguments]
* - params   | Object  | Optional |
*   - status | Boolean | Optional | `true`: ON, `false`: OFF
*
* * If the `status` is not specified, this method toggles the status.
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
*
* My BRAVIA accepts the toggle command, but does not accepts ON/OFF...
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setClosedCaptionStatus = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			params = {};
		}

		let status = null;
		if ('status' in params) {
			status = params['status'];
			if (typeof (status) !== 'boolean') {
				reject(new Error('The `status` must be `true` or `false`.'));
				return;
			}
		}

		if (status === null) {
			this._serialPort.requestWrite(0x10, [0x00]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		} else {
			let code = (status === true) ? 0x01 : 0x00;
			this._serialPort.requestWrite(0x10, [0x01, code]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		}
	});
	return promise;
};

/* ------------------------------------------------------------------
* setClosedCaptionMode()
* - Change the closed caption mode
*
* [Arguments]
* - params   | Object  | Required |
*   - type   | String  | Required | "analog" or "digital"
*   - mode   | String  | Required | See the description blow.
*
* * If the `type` is "analog", the possible values of the `mode` are:
*   - cc1
*   - cc2
*   - cc3
*   - cc4
*   - text1
*   - text2
*   - text3
*   - text4
* * If the `type` is "digital", the possible values of the `mode` are:
*   - service1
*   - service2
*   - service3
*   - service4
*   - service5
*   - service6
*   - cc1
*   - cc2
*   - cc3
*   - cc4
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
*
* My BRAVIA returns OK, but this method does not work...
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setClosedCaptionMode = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			reject(new Error('The `params` must be an object.'));
			return;
		}

		let type = '';
		if ('type' in params) {
			type = params['type'];
			if (typeof (type) !== 'string' || !/^(analog|digital)$/.test(type)) {
				reject(new Error('The `type` must be "analog" or "digital".'));
				return;
			}
		} else {
			reject(new Error('The `type` is required.'));
			return;
		}
		let type_code = 0;
		if (type === 'analog') {
			type_code = 0x00;
		} else if (type === 'digital') {
			type_code = 0x01;
		}

		let mode = '';
		if ('mode' in params) {
			mode = params['mode'];
			if (typeof (type) !== 'string') {
				reject(new Error('The `mode` must be a string.'));
				return;
			}
			if (type === 'analog') {
				if (!/^(cc[1-4]|text[1-4])$/.test(mode)) {
					reject(new Error('The `mode` is invalid.'));
					return;
				}
			} else if (type === 'digital') {
				if (!/^(cc[1-4]|service[1-6])$/.test(mode)) {
					reject(new Error('The `mode` is invalid.'));
					return;
				}
			}
		} else {
			reject(new Error('The `mode` is required.'));
			return;
		}
		let mode_code_map = {
			'analog': {
				cc1: 0x01,
				cc2: 0x02,
				cc3: 0x03,
				cc4: 0x04,
				text1: 0x05,
				text2: 0x06,
				text3: 0x07,
				text4: 0x08
			},
			'digital': {
				service1: 0x01,
				service2: 0x02,
				service3: 0x03,
				service4: 0x04,
				service5: 0x05,
				service6: 0x06,
				cc1: 0x07,
				cc2: 0x08,
				cc3: 0x09,
				cc4: 0x0A
			}
		}
		let mode_code = mode_code_map[type][mode];

		this._serialPort.requestWrite(0x10, [0x02, type_code, mode_code]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* setPictureMode()
* - Change the picture mode
*
* [Arguments]
* - params   | Object  | Optional |
*   - mode   | String  | Optional | See the description blow.
*
* * The possible values of the `mode` are:
*   - vivid
*   - standard
*   - cinema
*   - custom
*   - cine2
*   - sports
*   - game
*   - graphics
*
* * If the `mode` is not specified, this method toggles the mode.
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setPictureMode = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			params = {};
		}

		let mode = null;
		if ('mode' in params) {
			mode = params['mode'];
			if (typeof (mode) !== 'string') {
				reject(new Error('The `mode` must be a string.'));
				return;
			}
			if (!/^(vivid|standard|cinema|custom|cine2|sports|game|graphics)$/.test(mode)) {
				reject(new Error('The `mode` is invalid.'));
				return;
			}
		}

		if (mode === null) {
			this._serialPort.requestWrite(0x20, [0x00]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		} else {
			let code_map = {
				vivid: 0x00,
				standard: 0x01,
				cinema: 0x02,
				custom: 0x03,
				cine2: 0x06,
				sports: 0x07,
				game: 0x08,
				graphics: 0x09
			}
			let code = code_map[mode];
			this._serialPort.requestWrite(0x20, [0x01, code]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		}
	});
	return promise;
};

/* ------------------------------------------------------------------
* setContrast()
* - Set the contrast
*
* [Arguments]
* - params  | Object  | Required |
*   - value | Integer | Required | 0 - 100.

* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setContrast = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			reject(new Error('The `params` must be an object.'));
			return;
		}

		let val = 0;
		if ('value' in params) {
			val = params['value'];
			if (typeof (val) !== 'number' || val % 1 > 0 || val < 0 || val > 100) {
				reject(new Error('The `value` must be an integer between 0 and 100.'));
				return;
			}
		} else {
			reject(new Error('The `value` is required.'));
			return;
		}

		this._serialPort.requestWrite(0x23, [0x01, val]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* contrastUp()
* - Increase the contrast
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.contrastUp = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestWrite(0x23, [0x00, 0x00]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* contrastDown()
* - Decrease the contrast
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.contrastDown = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestWrite(0x23, [0x00, 0x01]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* setBrightness()
* - Set the brightness
*
* [Arguments]
* - params  | Object  | Required |
*   - value | Integer | Required | 1 - 100.

* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setBrightness = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			reject(new Error('The `params` must be an object.'));
			return;
		}

		let val = 0;
		if ('value' in params) {
			val = params['value'];
			if (typeof (val) !== 'number' || val % 1 > 0 || val < 0 || val > 100) {
				reject(new Error('The `value` must be an integer between 0 and 100.'));
				return;
			}
		} else {
			reject(new Error('The `value` is required.'));
			return;
		}

		this._serialPort.requestWrite(0x24, [0x01, val]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* brightnessUp()
* - Turn up the brightness a step
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.brightnessUp = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestWrite(0x24, [0x00, 0x00]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* brightnessDown()
* - Turn down the brightness a step
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.brightnessDown = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestWrite(0x24, [0x00, 0x01]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* setSaturation()
* - Set the saturation
*
* [Arguments]
* - params  | Object  | Required |
*   - value | Integer | Required | 0 - 100.

* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setSaturation = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			reject(new Error('The `params` must be an object.'));
			return;
		}

		let val = 0;
		if ('value' in params) {
			val = params['value'];
			if (typeof (val) !== 'number' || val % 1 > 0 || val < 0 || val > 100) {
				reject(new Error('The `value` must be an integer between 0 and 100.'));
				return;
			}
		} else {
			reject(new Error('The `value` is required.'));
			return;
		}

		this._serialPort.requestWrite(0x25, [0x01, val]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* saturationUp()
* - Turn up the saturation a step
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.saturationUp = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestWrite(0x25, [0x00, 0x00]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* saturationDown()
* - Turn down the saturation a step
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.saturationDown = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestWrite(0x25, [0x00, 0x01]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* hueUp()
* - Turn up the hue a step (to green)
*
* [Arguments]
* - params  | Object  | Optional |
*   - step  | Integer | Optional | 1 - 100 (Default: 1)
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.hueUp = function (params) {
	let promise = new Promise((resolve, reject) => {
		let step = 1;
		if (params) {
			if (typeof (params) !== 'object') {
				reject(new Error('The `params` must be an object.'));
				return;
			}
			if ('step' in params) {
				step = params['step'];
				if (typeof (step) !== 'number' || step % 1 > 0 || step < 1 || step > 100) {
					reject(new Error('The `step` must be an integer between 1 and 100.'));
					return;
				}
			}
		}

		this._serialPort.requestWrite(0x26, [0x01, 0x01, step]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* hueDown()
* - Turn down the hue a step (to red)
*
* [Arguments]
* - params  | Object  | Required |
*   - step  | Integer | Optional | 1 - 100 (Default: 1)
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.hueDown = function (params) {
	let promise = new Promise((resolve, reject) => {
		let step = 1;
		if (params) {
			if (typeof (params) !== 'object') {
				reject(new Error('The `params` must be an object.'));
				return;
			}
			if ('step' in params) {
				step = params['step'];
				if (typeof (step) !== 'number' || step % 1 > 0 || step < 1 || step > 100) {
					reject(new Error('The `step` must be an integer between 1 and 100.'));
					return;
				}
			}
		}

		this._serialPort.requestWrite(0x26, [0x01, 0x00, step]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* setSharpness()
* - Set the sharpness
*
* [Arguments]
* - params  | Object  | Required |
*   - value | Integer | Required | 0 - 100.

* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setSharpness = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			reject(new Error('The `params` must be an object.'));
			return;
		}

		let val = 0;
		if ('value' in params) {
			val = params['value'];
			if (typeof (val) !== 'number' || val % 1 > 0 || val < 0 || val > 100) {
				reject(new Error('The `value` must be an integer between 0 and 100.'));
				return;
			}
		} else {
			reject(new Error('The `value` is required.'));
			return;
		}

		this._serialPort.requestWrite(0x28, [0x01, val]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* sharpnessUp()
* - Turn up the sharpness a step
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.sharpnessUp = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestWrite(0x28, [0x00, 0x00]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* sharpnessDown()
* - Turn down the sharpness a step
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function. 
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.sharpnessDown = function () {
	let promise = new Promise((resolve, reject) => {
		this._serialPort.requestWrite(0x28, [0x00, 0x01]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* setCineMotionStatus(params)
* - Change the Cine Motion (Cinema Drive) status
*
* [Arguments]
* - params   | Object  | Required |
*   - status | Boolean | Required | `true`: ON, `false`: OFF
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setCineMotionStatus = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			reject(new Error('The `params` must be an object.'));
			return;
		}

		let status = null;
		if ('status' in params) {
			status = params['status'];
			if (typeof (status) !== 'boolean') {
				reject(new Error('The `status` must be `true` or `false`.'));
				return;
			}
		} else {
			reject(new Error('The `value` is required.'));
			return;
		}

		let code = (status === true) ? 0x01 : 0x00;
		this._serialPort.requestWrite(0x2A, [code]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* setSoundMode(params)
* - Change the sound mode
*
* [Arguments]
* - params  | Object  | Required |
*   - mode  | String  | Required | See the description blow.
*
* * The possible values of the `mode` are:
*   - standard
*   - cinema
*   - sports
*   - music
*   - game
*
* * If the `mode` is not specified, this method toggles the mode.
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setSoundMode = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			params = {};
		}

		let mode = null;
		if ('mode' in params) {
			mode = params['mode'];
			if (typeof (mode) !== 'string') {
				reject(new Error('The `mode` must be a string.'));
				return;
			}
			if (!/^(standard|cinema|sports|music|game)$/.test(mode)) {
				reject(new Error('The `mode` is invalid.'));
				return;
			}
		}

		if (mode === null) {
			this._serialPort.requestWrite(0x30, [0x00]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		} else {
			let code_map = {
				standard: 0x01,
				cinema: 0x04,
				sports: 0x05,
				music: 0x06,
				game: 0x07
			}
			let code = code_map[mode];
			this._serialPort.requestWrite(0x30, [0x01, code]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		}
	});
	return promise;
};

/* ------------------------------------------------------------------
* setSpeakerStatus(params)
* - Change the speaker status
*
* [Arguments]
* - params   | Object  | Optional |
*   - status | Boolean | Optional | `true`: ON, `false`: OFF
*
* * If the `status` is not specified, this method toggles the status.
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setSpeakerStatus = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			params = {};
		}

		let status = null;
		if ('status' in params) {
			status = params['status'];
			if (typeof (status) !== 'boolean') {
				reject(new Error('The `status` must be `true` or `false`.'));
				return;
			}
		}

		if (status === null) {
			this._serialPort.requestWrite(0x36, [0x00]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		} else {
			let code = (status === true) ? 0x00 : 0x01;
			this._serialPort.requestWrite(0x36, [0x01, code]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		}
	});
	return promise;
};

/* ------------------------------------------------------------------
* shiftScreenPosition(params)
* - Shift the screen position
*
* [Arguments]
* - params  | Object  | Required |
*   - h     | Integer | Required | Steps of horizotal shift (in the range of -10 to +10 (Default: 0))
*   - v     | Integer | Required | Steps of Vertical shift (in the range of -10 to +10 (Default: 0))
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.shiftScreenPosition = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			reject(new Error('The `params` must be an object.'));
			return;
		}

		let hori = 0;
		if ('h' in params) {
			hori = params['h'];
			if (typeof (hori) !== 'number' || hori % 1 > 0 || hori < -10 || hori > 10) {
				reject(new Error('The `h` must be an integer in the range of -10 to 10.'));
				return;
			}
		}
		let vert = 0;
		if ('v' in params) {
			vert = params['v'];
			if (typeof (vert) !== 'number' || vert % 1 > 0 || vert < -10 || vert > 10) {
				reject(new Error('The `v` must be an integer in the range of -10 to 10.'));
				return;
			}
		}

		let hbytes = [0x01, 0x00, 0x00];
		if (hori > 0) {
			hbytes = [0x01, 0x00, hori];
		} else if (hori < 0) {
			hbytes = [0x01, 0x01, -hori];
		}

		let vbytes = [0x01, 0x00, 0x00];
		if (vert > 0) {
			vbytes = [0x01, 0x00, vert];
		} else if (vert < 0) {
			vbytes = [0x01, 0x01, -vert];
		}

		this._serialPort.requestWrite(0x41, hbytes).then((frame) => {
			return this._serialPort.requestWrite(0x43, vbytes);
		}).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* setScreenWideMode(params)
* - Change the screen wide mode
*
* [Arguments]
* - params  | Object  | Optional |
*   - mode  | String  | Optional | See the description blow.
*
* * The possible values of the `mode` are:
*   - wide_zoom
*   - full
*   - zoom
*   - normal
*   - pc_normal
*   - pc_full1
*   - pc_full2
*
* * If the `mode` is not specified, this method toggles the mode.
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setScreenWideMode = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			params = {};
		}

		let mode = null;
		if ('mode' in params) {
			mode = params['mode'];
			if (typeof (mode) !== 'string') {
				reject(new Error('The `mode` must be a string.'));
				return;
			}
			if (!/^(wide_zoom|full|zoom|normal|pc_normal|pc_full1|pc_full2)$/.test(mode)) {
				reject(new Error('The `mode` is invalid.'));
				return;
			}
		}

		if (mode === null) {
			this._serialPort.requestWrite(0x44, [0x00]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		} else {
			let mode_code_map = {
				wide_zoom: 0x00,
				full: 0x01,
				zoom: 0x02,
				normal: 0x03,
				pc_normal: 0x05,
				pc_full1: 0x06,
				pc_full2: 0x07
			}
			let mode_code = mode_code_map[mode];
			this._serialPort.requestWrite(0x44, [0x01, mode_code]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		}
	});
	return promise;
};

/* ------------------------------------------------------------------
* setScreenAutoWideStatus(params)
* - Change the screen auto wide status
*
* [Arguments]
* - params   | Object  | Optional |
*   - status | Boolean | Optional | `true`: ON, `false`: OFF
*
* * If the `status` is not specified, this method toggles the status.
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setScreenAutoWideStatus = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			params = {};
		}

		let status = null;
		if ('status' in params) {
			status = params['status'];
			if (typeof (status) !== 'boolean') {
				reject(new Error('The `status` must be `true` or `false`.'));
				return;
			}
		}

		if (status === null) {
			this._serialPort.requestWrite(0x45, [0x00]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		} else {
			let code = (status === true) ? 0x01 : 0x00;
			this._serialPort.requestWrite(0x45, [0x01, code]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		}
	});
	return promise;
};

/* ------------------------------------------------------------------
* setScreen4To3Mode(params)
* - Change the screen 4:3 mode
*
* [Arguments]
* - params  | Object  | Required |
*   - mode  | String  | Required | See the description blow.
*
* * The possible values of the `mode` are:
*   - normal
*   - wide_zoom
*   - off
*
* * If the `mode` is not specified, this method toggles the mode.
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.setScreen4To3Mode = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			params = {};
		}

		let mode = null;
		if ('mode' in params) {
			mode = params['mode'];
			if (typeof (mode) !== 'string') {
				reject(new Error('The `mode` must be a string.'));
				return;
			}
			if (!/^(normal|wide_zoom|off)$/.test(mode)) {
				reject(new Error('The `mode` is invalid.'));
				return;
			}
		}

		if (mode === null) {
			this._serialPort.requestWrite(0x46, [0x00]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		} else {
			let mode_code_map = {
				wide_zoom: 0x03,
				normal: 0x04,
				off: 0x00
			}
			let mode_code = mode_code_map[mode];
			this._serialPort.requestWrite(0x46, [0x01, mode_code]).then((frame) => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		}
	});
	return promise;
};

/* ------------------------------------------------------------------
* emulateSircs(params)
* - Send a SIRCS (Sony IR Control System) code
*
* [Arguments]
* - params   | Object  | Required |
*   - code   | String  | Required | See the description blow.
*
*  https://pro-bravia.sony.net/develop/integrate/rs-232c/command-definitions/sircs/index.html
*
* [Return value]
* - A promise object
*
* Nothing will be passed to the resolve() function.
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.emulateSircs = function (params) {
	let promise = new Promise((resolve, reject) => {
		if (!params || typeof (params) !== 'object') {
			params = {};
		}

		let code = null;
		if ('code' in params) {
			code = params['code'];
			if (typeof (code) !== 'string') {
				reject(new Error('The `code` must be a string.'));
				return;
			}
		} else {
			reject(new Error('The `code` is required.'));
			return;
		}

		let code_data = this._sircs_code_map[code];
		if (!code_data) {
			reject(new Error('The `code` is invalid.'));
			return;
		}

		let cate = code_data['category'];
		let data = code_data['data'];
		this._serialPort.requestWrite(0x67, [cate, data]).then((frame) => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

/* ------------------------------------------------------------------
* getSignageInfo()
* - Get the Signage Info
*
* [Arguments]
* - None
*
* [Return value]
* - A promise object
*
* The object blow will be passed to the resolve() function. 
*
* {
*   "command": "ba",
*   "info1": "KJ-43X",
*   "info2": "8300D",
*   "info3": ""
* }
* ---------------------------------------------------------------- */
BraviaSerialControl.prototype.getSignageInfo = function () {
	let promise = new Promise((resolve, reject) => {
		let res = {};
		// Get the ID command
		this._serialPort.requestRead(0x6F).then((frame) => {
			let data = frame['data'];
			res['command'] = Buffer.from(data).toString('hex');
			// Get the product info1
			return this._serialPort.requestRead(0x6E);
		}).then((frame) => {
			let data = frame['data'];
			res['info1'] = Buffer.from(data).toString('utf8');
			// Get the product info2
			return this._serialPort.requestRead(0x6D);
		}).then((frame) => {
			let data = frame['data'];
			res['info2'] = Buffer.from(data).toString('utf8');
			// Get the product info3
			return this._serialPort.requestRead(0x6C);
		}).then((frame) => {
			let data = frame['data'];
			res['info3'] = Buffer.from(data).toString('utf8');
			resolve(res);
		}).catch((error) => {
			reject(error);
		});
	});
	return promise;
};

module.exports = BraviaSerialControl;
