# Botcycle-botkit

This is the component of **botcycle** that interacts with the messaging platforms. It is responsible to communicate with [the brain of botcycle](https://github.com/MultimediaSemantics/botcycle) over a websocket and providing some platform-specific data on the messaging channels.

## Installing

As a Node.js application, simply run `npm install`

## Running

`node app.js`

Running the app requires some environment variables:

- `WEBSOCKET_TOKEN`: agreed with the brain
- `MAPS_TOKEN`: a google maps token, enabled for static maps API
- `app_id`, `app_password`: to communicate with botframework

## Documentation

### Format of messages

All the messages are json (serialized)

#### From the brain to botkit:

`message={userId, type, text, ...}`

The type is essential for the other part of the message

##### `message.type='text'`

`message.text` contains the text of the message

##### `message.type='request_location'`

The text is contained as always, but the botkit sends platform-dependent messages to display a 'locate me' button on telegram and messenger

##### `message.type='map'`

The message contains an array of markers and an array of buttons.

Buttons can be of type `link` or `text`
