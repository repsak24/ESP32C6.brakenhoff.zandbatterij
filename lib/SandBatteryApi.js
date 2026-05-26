'use strict';

const http = require('http');

class SandBatteryApi {

  constructor(address, username = 'admin', password = '') {
    const [host, port] = address.split(':');
    this.host = host;
    this.port = port ? parseInt(port, 10) : 80;
    this.timeout = 5000;
    this._auth = Buffer.from(`${username}:${password}`).toString('base64');
  }

  getStatus()           { return this._get('/api/status'); }
  getSettings()         { return this._get('/api/settings'); }

  setCharging(on)       { return this._post('/api/charge',           { on }); }
  setRecuperating(on)   { return this._post('/api/recuperate',       { on }); }
  setAutoMode(on)       { return this._post('/api/auto_mode',        { on }); }
  setFanSpeed(pct)      { return this._post('/api/fan_speed',        { value: Math.round(pct) }); }
  setChargeFanSpeed(pct){ return this._post('/api/charge_fan_speed', { value: Math.round(pct) }); }
  setTempMax(celsius)   { return this._post('/api/temp_max',         { value: celsius }); }
  setZone(zone, fields) { return this._post('/api/zone',             { zone, ...fields }); }
  setSettings(settings) { return this._post('/api/settings',         settings); }

  _headers() {
    return { Authorization: `Basic ${this._auth}` };
  }

  _get(path) {
    return new Promise((resolve, reject) => {
      const req = http.get(
        { host: this.host, port: this.port, path, timeout: this.timeout,
          headers: this._headers() },
        (res) => {
          if (res.statusCode === 401) {
            reject(new Error('Unauthorized — check username/password'));
            res.resume();
            return;
          }
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
        host: this.host, port: this.port, path,
        method: 'POST',
        headers: {
          ...this._headers(),
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: this.timeout,
      };
      const req = http.request(options, (res) => {
        if (res.statusCode === 401) {
          reject(new Error('Unauthorized — check username/password'));
          res.resume();
          return;
        }
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
