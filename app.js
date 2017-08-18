const express = require('express')
const http = require('http')
const url = require('url')
const WebSocket = require('ws')
const path = require('path')
const bodyParser = require('body-parser')
const Botkit = require('botkit')
// const locationDialog = require('botbuilder-location')

const port = process.env.PORT || 8888
const authorizationHeader = process.env.BRAIN_JWT || 'pizza'

// express configuration
const app = express()
// public folder for static content
app.use(express.static(path.join(__dirname, '/public')))
// parsing application/json and urlencoded
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
// the http server
const server = http.createServer(app)

// this is a flag that reflects the status of the connection with the brain
let brainConnected = false
let websocket = null

// configuration of the websocket for communication with the brain
const wss = new WebSocket.Server({ server })

wss.on('connection', (ws, request) => {
  // TODO check the path inside resource
  console.log('request received')
  const urlParsed = url.parse(request.url, true)
  if (urlParsed.pathname !== '/brain') {
    ws.close(3001, 'please connect on the path /brain')
    return
  }
  if (urlParsed.query['jwt'] !== authorizationHeader) {
    ws.close(3002, 'authentication of brain failed')
    return
  }
  if (brainConnected) {
    // the brain is already connected
    ws.close(3003, 'a brain is already connected')
    console.log('the brain is already connected. Rejected connection request ' + request)
  } else {
    // TODO check authentication of brain (some headers constant)
    console.log('accepting brain connection request' + request)

    brainConnected = true
    websocket = ws

    ws.on('message', (message) => {
      // TODO message from brain received
      console.log('Received Message from brain: ' + message)
      ws.send('ok received ' + message)
    })

    ws.on('close', (message) => {
      // closed connection with the brain
      brainConnected = false
      websocket = null
    })
  }
})

// configuration of botkit
const controller = Botkit.botframeworkbot({ port: port })

const bot = controller.spawn({
  appId: process.env.app_id,
  appPassword: process.env.app_password
})

// configuration of the the webser endpoints
controller.createWebhookEndpoints(app, bot, function () {
  console.log('This bot is online!!!')
})

// message received from botframework
controller.on('message_received', (bot, message) => {
  console.log(message)
  // TODO preprocess message
  // TODO check if brain connected
  if (brainConnected) {
    // deliver the message to the brain
    websocket.send(message)
    // TODO
    bot.reply(message, 'sent to the brain')
  } else {
    // TODO store the message for future connection with brain?
    bot.reply(message, 'my brain is offline!')
  }
})

// finally start listening on the port
server.listen(port, () => {
  console.log('Listening on %d', server.address().port)
})
