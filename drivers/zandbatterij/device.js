'use strict';

const Homey = require('homey');
const SandBatteryApi = require('../../lib/SandBatteryApi');

const MODE_MAP = {
  0: 'idle',
  1: 'charging',
  2: 'recuperating',
};

class SandBatteryDevice extends Homey.Device {

  async onInit() {
    this.log('SandBatteryDevice init, address:', this.getSetting('address'));
    this._api = new SandBatteryApi(this.getSetting('address'), this.getSetting('api_key') || '');
    this._pollInterval = null;

    this.registerCapabilityListener('heat_mode', (value) => this._setMode(value));

    this._startPolling(this.getSetting('poll_interval') || 10);
  }

  _startPolling(intervalSec) {
    this._stopPolling();
    this._poll();
    this._pollInterval = setInterval(() => this._poll(), intervalSec * 1000);
  }

  _stopPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  async _poll() {
    let status;
    try {
      status = await this._api.getStatus();
    } catch (err) {
      this.error('Poll failed:', err.message);
      return;
    }

    const mode = MODE_MAP[status.mode] || 'idle';
    await this.setCapabilityValue('heat_mode', mode).catch(this.error.bind(this));

    const tempMap = [
      ['measure_temperature.sand_bot', status.temps?.[0]],
      ['measure_temperature.sand_mid', status.temps?.[1]],
      ['measure_temperature.sand_top', status.temps?.[2]],
      ['measure_temperature.air_in',   status.temps?.[3]],
      ['measure_temperature.air_out',  status.temps?.[4]],
      ['measure_temperature.water',    status.temps?.[5]],
    ];

    for (const [cap, val] of tempMap) {
      if (typeof val === 'number' && isFinite(val)) {
        await this.setCapabilityValue(cap, Math.round(val)).catch(this.error.bind(this));
      }
    }

    if (Array.isArray(status.zones) && Array.isArray(status.temps)) {
      const levels = status.zones.map((zone, i) => {
        const t = status.temps[i];
        const max = zone.temp_max_c;
        if (typeof t !== 'number' || !max) return 0;
        return Math.min(100, Math.max(0, (t / max) * 100));
      });
      const avg = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
      await this.setCapabilityValue('measure_battery', avg).catch(this.error.bind(this));
    }

    if (typeof status.energy_kwh === 'number' && isFinite(status.energy_kwh)) {
      await this.setCapabilityValue('energy_stored', Math.round(status.energy_kwh * 10) / 10).catch(this.error.bind(this));
    }

    if (typeof status.safety === 'boolean') {
      await this.setCapabilityValue('safety_alarm', status.safety).catch(this.error.bind(this));
    }
    if (typeof status.charge_blocked === 'boolean') {
      await this.setCapabilityValue('charge_blocked', status.charge_blocked).catch(this.error.bind(this));
    }
  }

  async _setMode(mode) {
    await this._api.setAutoMode(true);
    switch (mode) {
      case 'charging':
        await this._api.setCharging(true);
        break;
      case 'recuperating':
        await this._api.setRecuperating(true);
        break;
      case 'idle':
      default:
        await this._api.setCharging(false);
        await this._api.setRecuperating(false);
        break;
    }
  }

  async onSettings({ newSettings }) {
    if (newSettings.address || newSettings.api_key !== undefined) {
      const address = newSettings.address || this.getSetting('address');
      const apiKey  = newSettings.api_key  !== undefined ? newSettings.api_key : (this.getSetting('api_key') || '');
      this._api = new SandBatteryApi(address, apiKey);
    }
    if (newSettings.poll_interval) {
      this._startPolling(newSettings.poll_interval);
    }
  }

  onDeleted() {
    this._stopPolling();
  }

}

module.exports = SandBatteryDevice;
