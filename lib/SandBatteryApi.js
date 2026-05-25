'use strict';

const http = require('http');

// HTTP client for the ESP32 sand battery controller.
// All methods return Promises and reject on network error or timeout.
class SandBatteryApi {

  constructor(address, apiKey = '') {
    const [host, port] = address.split(':');
    this.host = host;
    this.port = port ? parseInt(port, 10) : 80;
    this.timeout = 5000;
    this.apiKey = apiKey;
  }

  // GET /api/status → parsed JSON object
  getStatus() {
    return this._get('/api/status');
  }

  // POST /api/charge   { on: true|false }
  setCharging(on) {
    return this._post('/api/charge', { on });
  }

  // POST /api/recuperate   { on: true|false }
  setRecuperating(on) {
    return this._post('/api/recuperate', { on });
  }

  // POST /api/auto_mode   { on: true|false }
  setAutoMode(on) {
    return this._post('/api/auto_mode', { on });
  }

  // POST /api/fan_speed   { value: 0-100 }  (recuperation speed)
  setFanSpeed(pct) {
    return this._post('/api/fan_speed', { value: Math.round(pct) });
  }

  // POST /api/charge_fan_speed   { value: 0-100 }
  setChargeFanSpeed(pct) {
    return this._post('/api/charge_fan_speed', { value: Math.round(pct) });
  }

  // POST /api/temp_max   { value: 50-500 }  (all zones)
  setTempMax(celsius) {
    return this._post('/api/temp_max', { value: celsius });
  }

  // POST /api/zone   { zone: 0-2, enabled?, charge_power?, temp_max_c? }
  setZone(zone, fields) {
    return this._post('/api/zone', { zone, ...fields });
  }

  // ── internals ──────────────────────────────────────────────────────────────

  _get(path) {
    return new Promise((resolve, reject) => {
      const req = http.get(
        { host: this.host, port: this.port, path, timeout: this.timeout,
          headers: { 'X-API-Key': this.apiKey } },
        (res) => {
          let raw = '';
          res.on('data', (c) => { raw += c; });
          res.on('end', () => {
            try { resolve(JSON.parse(raw)); }
            catch (e) { reject(new Error('Invalid JSON from device')); }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    });
  }

  _post(path, body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const options = {
        host: this.host,
        port: this.port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'X-API-Key': this.apiKey,
        },
        timeout: this.timeout,
      };
      const req = http.request(options, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => resolve(raw));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
      req.write(data);
      req.end();
    });
  }

}

module.exports = SandBatteryApi;
