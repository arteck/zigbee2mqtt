/**
 * This script generates the integrating-with-homeassistant page.
 */

const devices = require('zigbee-shepherd-converters').devices;
const HomeassistantExtension = require('../lib/extension/homeassistant');
const homeassistant = new HomeassistantExtension(null, null, null, null);
const YAML = require('json2yaml');

let template = `# Home Assistant

*NOTE 1: This file has been generated, do not edit this file manually!*

*NOTE 2: If you are using the [Zigbee2mqtt Hass.io add-on](https://github.com/danielwelch/hassio-zigbee2mqtt)
use their documentation*


## MQTT discovery
The easiest way to integrate Zigbee2mqtt with Home Assistant is by
using [MQTT discovery](https://www.home-assistant.io/docs/mqtt/discovery/).
This allows Zigbee2mqtt to automatically add devices to Home Assistant.

To achieve the best possible integration (including MQTT discovery):
- In your **Zigbee2mqtt** \`configuration.yaml\` set \`homeassistant: true\`
- In your **Home Assistant** \`configuration.yaml\`:
\`\`\`yaml
mqtt:
  discovery: true
  broker: [YOUR MQTT BROKER]  # Remove if you want to use builtin-in MQTT broker
  birth_message:
    topic: 'hass/status'
    payload: 'online'
  will_message:
    topic: 'hass/status'
    payload: 'offline'
\`\`\`

Zigbee2mqtt is expecting Home Assistant to send it's birth/will
messages to \`hass/status\`. Be sure to add this to your \`configuration.yaml\` if you want
Zigbee2mqtt to resend the cached values when Home Assistant restarts

## Home Assistant device registry
When using Home Assistant MQTT discovery, Zigbee2mqtt integrates
with the [Home Assistant device registry](https://developers.home-assistant.io/docs/en/device_registry_index.html).
This allows you to change the Home Assistant \`device_id\` and \`friendly_name\` from the web interface
without having to restart Home Assistant. It also makes it possible to show which entities belong to which device.

![Changing name and device ID via web interface](../images/home_assistant_change_name.png)

![Device registry](../images/home_assistant_device_registry.png)

## I'm confused about the different device IDs, names and friendly names
- Home Assistant \`device_id\`: determined on first discovery of the device, can only be changed
via the Home Assistant web interface afterwards. Used to control/read the state from the device (e.g. in automations)
- Zigbee2mqtt \`friendly_name\`: used to change the MQTT topic where the device listens and publishes to.
- Home Assistant \`name\`: name shown in the Home Assistant UI (unless overridden
via a \`friendly_name\` in \`customize.yaml\`). If not changed via the Home Assistant web interface,
it is equal to the Zigbee2mqtt \`friendly_name\`. Is updated if the Zigbee2mqtt \`friendly_name\` changes
(requires restart of Home Assistant)
- Home Assistant \`friendly_name\` (\`customize.yaml\`): overrides the name in the Home Assistant web interface.

## Responding to button clicks
To respond to button clicks (e.g. WXKG01LM) you can use the following Home Assistant configuration:

{% raw %}
\`\`\`yaml
automation:
  - alias: Respond to button clicks
    trigger:
      platform: mqtt
      topic: 'zigbee2mqtt/<FRIENDLY_NAME'
    condition:
      condition: template
      value_template: '{{ "single" == trigger.payload_json.click }}'
    action:
      entity_id: light.bedroom
      service: light.toggle
\`\`\`
{% endraw %}

## Controlling Zigbee2mqtt via Home Assistant
The following Home Assistant configuration allows you to control Zigbee2mqtt from Home Assistant.

{% raw %}
\`\`\`yaml
# Group
group:
  zigbee_group:
    view: no
    control: hidden
    name: Zigbee2mqtt
    entities:
      - input_boolean.zigbee_permit_join
      - timer.zigbee_permit_join
      - sensor.zigbee2mqtt_bridge_state
      - switch.zigbee2mqtt_main_join
      - automation.enable_zigbee_joining
      - automation.disable_zigbee_joining
      - automation.disable_zigbee_joining_by_timer
      - input_select.zigbee2mqtt_log_level
      - automation.zigbee2mqtt_log_level

# Input select for Zigbee2mqtt debug level
input_select:
  zigbee2mqtt_log_level:
    name: Zigbee2mqtt Log Level
    options:
     - debug
     - info
     - warn
     - error
    initial: info
    icon: mdi:format-list-bulleted

# Input boolean for enabling/disabling joining
input_boolean:
  zigbee_permit_join:
    name: Allow devices to join
    initial: off
    icon: mdi:cellphone-wireless

# Timer for joining time remaining (120 sec = 2 min)
timer:
  zigbee_permit_join:
    name: Time remaining
    duration: 120

# Sensor for monitoring the bridge state
sensor:
  - platform: mqtt
    name: Zigbee2mqtt Bridge state
    state_topic: "zigbee2mqtt/bridge/state"
    icon: mdi:router-wireless

# Switch for enabling joining
switch:
  - platform: mqtt
    name: "Zigbee2mqtt Main join"
    state_topic: "zigbee2mqtt/bridge/config/permit_join"
    command_topic: "zigbee2mqtt/bridge/config/permit_join"
    payload_on: "true"
    payload_off: "false"

# Automations
automation:
  - alias: Zigbee2mqtt Log Level
    initial_state: 'on'
    trigger:
      - platform: state
        entity_id: input_select.zigbee2mqtt_log_level
        to: debug
      - platform: state
        entity_id: input_select.zigbee2mqtt_log_level
        to: warn
      - platform: state
        entity_id: input_select.zigbee2mqtt_log_level
        to: error
      - platform: state
        entity_id: input_select.zigbee2mqtt_log_level
        to: info
    action:
      - service: mqtt.publish
        data:
          payload_template: '{{ states(''input_select.zigbee2mqtt_log_level'') }}'
          topic: zigbee2mqtt/bridge/config/log_level

  - id: enable_zigbee_join
    alias: Enable Zigbee joining
    hide_entity: true
    trigger:
      platform: state
      entity_id: input_boolean.zigbee_permit_join
      to: 'on'
    action:
    - service: mqtt.publish
      data:
        topic: zigbee2mqtt/bridge/config/permit_join
        payload: 'true'
    - service: timer.start
      data:
        entity_id: timer.zigbee_permit_join

  - id: disable_zigbee_join
    alias: Disable Zigbee joining
    trigger:
    - entity_id: input_boolean.zigbee_permit_join
      platform: state
      to: 'off'
    action:
    - data:
        payload: 'false'
        topic: zigbee2mqtt/bridge/config/permit_join
      service: mqtt.publish
    - data:
        entity_id: timer.zigbee_permit_join
      service: timer.cancel

  - id: disable_zigbee_join_timer
    alias: Disable Zigbee joining by timer
    hide_entity: true
    trigger:
    - platform: event
      event_type: timer.finished
      event_data:
        entity_id: timer.zigbee_permit_join
    action:
    - service: mqtt.publish
      data:
        topic: zigbee2mqtt/bridge/config/permit_join
        payload: 'false'
    - service: input_boolean.turn_off
      data:
        entity_id: input_boolean.zigbee_permit_join
\`\`\`
{% endraw %}

## Configuration when NOT using Home Assistant MQTT discovery

[CONFIGURATION]
`;

const homeassistantConfig = (device) => {
    const payload = {
        platform: 'mqtt',
        state_topic: 'zigbee2mqtt/<FRIENDLY_NAME>',
        availability_topic: 'zigbee2mqtt/bridge/state',
        ...device.discovery_payload,
    };

    if (payload.command_topic) {
        if (payload.command_topic_prefix) {
            payload.command_topic = `zigbee2mqtt/<FRIENDLY_NAME>/${payload.command_topic_prefix}/set`;
        } else {
            payload.command_topic = `zigbee2mqtt/<FRIENDLY_NAME>/set`;
        }
    }

    delete payload.command_topic_prefix;

    let yml = YAML.stringify([payload]);
    yml = yml.replace(/(-) \n {4}/g, '- ');
    yml = yml.replace('---', `${device.type}:`);
    return yml;
};

let configuration = '';
devices.forEach((device) => {
    configuration += `### ${device.model}\n`;
    configuration += `{% raw %}\n`;
    configuration += '```yaml\n';

    const configurations = homeassistant._getMapping()[device.model];

    if (configurations) {
        configurations.forEach((d, i) => {
            configuration += homeassistantConfig(d);
            if (configurations.length > 1 && i < configurations.length - 1) {
                configuration += '\n';
            }
        });

        configuration += '```\n';
        configuration += '{% endraw %}\n\n';
    }
});


// Insert into template
template = template.replace('[CONFIGURATION]', configuration);

module.exports = template;
