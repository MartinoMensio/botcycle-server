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
