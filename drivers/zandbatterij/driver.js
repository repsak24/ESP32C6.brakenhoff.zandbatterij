'use strict';

const Homey = require('homey');
const SandBatteryApi = require('../../lib/SandBatteryApi');

class SandBatteryDriver extends Homey.Driver {

  async onInit() {
    this.log('SandBatteryDriver ready');
  }

  async onPair(session) {
    const strategy = this.homey.discovery.getStrategy('zandbatterij');
    let _credentials = { username: 'admin', password: '' };

    // Return discovered devices to the pair view
    session.setHandler('discover', async () => {
      const results = Object.values(strategy.getDiscoveryResults());
      return results.map(r => ({ id: r.id, address: r.address }));
    });

    // Verify credentials against the device
    session.setHandler('login', async ({ username, password }) => {
      const results = Object.values(strategy.getDiscoveryResults());
      if (results.length === 0) throw new Error('No device found on network');
      const r = results[0];
      const api = new SandBatteryApi(r.address, username, password);
      await api.getSettings(); // throws on 401 or network error
      _credentials = { username, password };
      return true;
    });

    // Called by add_devices template
    session.setHandler('list_devices', async () => {
      const results = Object.values(strategy.getDiscoveryResults());
      return results.map(r => ({
        name: 'Sand Battery',
        data: { id: r.id },
        settings: {
          username: _credentials.username,
          password: _credentials.password,
        },
      }));
    });
  }

}

module.exports = SandBatteryDriver;
