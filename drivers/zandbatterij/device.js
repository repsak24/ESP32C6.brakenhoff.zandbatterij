'use strict';

const Homey = require('homey');
const SandBatteryApi = require('../../lib/SandBatteryApi');

const MODE_MAP = { 0: 'idle', 1: 'charging', 2: 'recuperating' };

class SandBatteryDevice extends Homey.Device {

  async onInit() {
    this.log('SandBatteryDevice init');
    this._api = null;
    this._pollInterval = null;
    this.registerCapabilityListener('heat_mode', (value) => this._setMode(value));

    // Start from stored address if available (before first discovery event)
    const address = this.getStoreValue('address');
    if (address) {
      this._api = this._makeApi(address);
      this._startPolling(this.getSetting('poll_interval') || 10);
    }
  }

  // Called for each discovery result — return true if it belongs to this device
  async onDiscoveryResult(discoveryResult) {
    return discoveryResult.id === this.getData().id;
  }

  // Called when device appears on network
  async onDiscoveryAvailable(discoveryResult) {
    await this.setStoreValue('address', discoveryResult.address);
    this._api = this._makeApi(discoveryResult.address);
    this._startPolling(this.getSetting('poll_interval') || 10);
  }

  // Called when IP address changes
  async onDiscoveryAddressChanged(discoveryResult) {
    await this.setStoreValue('address', discoveryResult.address);
    this._api = this._makeApi(discoveryResult.address);
  }

  _makeApi(address) {
    return new SandBatteryApi(
      address,
      this.getSetting('username') || 'admin',
      this.getSetting('password') || '',
    );
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
    if (!this._api) return;
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
      if (typeof val === 'number' && isFinite(val))
        await this.setCapabilityValue(cap, Math.round(val)).catch(this.error.bind(this));
    }

    if (Array.isArray(status.zones) && Array.isArray(status.temps)) {
      const levels = status.zones.map((zone, i) => {
        const t = status.temps[i];
        return (typeof t === 'number' && zone.temp_max_c)
          ? Math.min(100, Math.max(0, (t / zone.temp_max_c) * 100)) : 0;
      });
      const avg = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
      await this.setCapabilityValue('measure_battery', avg).catch(this.error.bind(this));
    }

    if (typeof status.energy_kwh === 'number' && isFinite(status.energy_kwh))
      await this.setCapabilityValue('energy_stored', Math.round(status.energy_kwh * 10) / 10).catch(this.error.bind(this));

    if (typeof status.safety === 'boolean')
      await this.setCapabilityValue('safety_alarm', status.safety).catch(this.error.bind(this));

    if (typeof status.charge_blocked === 'boolean')
      await this.setCapabilityValue('charge_blocked', status.charge_blocked).catch(this.error.bind(this));
  }

  async _setMode(mode) {
    if (!this._api) return;
    await this._api.setAutoMode(true);
    if (mode === 'charging')     await this._api.setCharging(true);
    else if (mode === 'recuperating') await this._api.setRecuperating(true);
    else {
      await this._api.setCharging(false);
      await this._api.setRecuperating(false);
    }
  }

  async onSettings({ newSettings }) {
    const address = this.getStoreValue('address');
    if (address) this._api = this._makeApi(address);
    if (newSettings.poll_interval) this._startPolling(newSettings.poll_interval);
  }

  onDeleted() {
    this._stopPolling();
  }

}

module.exports = SandBatteryDevice;
