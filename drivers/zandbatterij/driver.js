'use strict';

const Homey = require('homey');

class SandBatteryDriver extends Homey.Driver {

  async onInit() {
    this.log('SandBatteryDriver ready');
  }

  async onPair(session) {
    this.log('onPair started');

    session.setHandler('list_devices', async () => {
      return [
        {
          name: 'Sand Battery',
          data: { id: 'zandbatterij-esp32-1' },
          settings: { address: '192.168.2.86' },
        },
      ];
    });

    session.setHandler('showView', async (viewId) => {
      if (viewId === 'list_devices') {
        await session.showView('add_devices');
      }
    });
  }

  async onPairListDevices() {
    return [
      {
        name: 'Sand Battery',
        data: { id: 'zandbatterij-esp32-1' },
        settings: { address: '192.168.2.86' },
      },
    ];
  }

}

module.exports = SandBatteryDriver;
