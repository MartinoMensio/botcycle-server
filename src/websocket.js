const url = require('url')
const WebSocket = require('ws')
const sendHeartbeats = require('ws-heartbeats')

let configurations = null

// websocketNames is a object that maps each BRAIN_NAME to its AUTH_TOKEN
const config = (httpServer, onMessage, websocketConfigs = {'/main': null}) => {
  configurations = Object.keys(websocketConfigs).reduce((map, key) => {
    // each configuration object has token, status and corresponding websocket
    return map.set(key, {token: websocketConfigs[key], connected: false, websocket: null})
  }, new Map())
  // configuration of the websocket for communication with the brain
  const wss = new WebSocket.Server({ server: httpServer })
  wss.on('connection', (ws, request) => {
    const urlParsed = url.parse(request.url, true)
    console.log(`request received with path ${urlParsed.pathname}`)
    // get the configuration
    const conf = configurations.get(urlParsed.pathname)
    if (!conf) {
      // pathname did not match with registered ones
      ws.close(3001, `unregistered path ${urlParsed.pathname}`)
    } else if (urlParsed.query['token'] !== conf.token) {
      ws.close(3002, `wrong authentication token for path ${urlParsed.pathname}`)
    } else if (conf.connected) {
      ws.close(3003, `a brain is already connected on path ${urlParsed.pathname}`)
    } else {
      console.log(`${new Date()} - accepted brain connection on path ${urlParsed.pathname} from ${request.headers['user-agent']}`)
      conf.connected = true
      conf.websocket = ws

      // enable heartbeats to keep the connection alive
      sendHeartbeats(ws)

      ws.on('message', (messageStr) => {
        // message from brain received
        console.log('Received Message from brain: ' + messageStr)
        try {
          const message = JSON.parse(messageStr)
          // call the callback
          onMessage(message)
        } catch (error) {
          console.log(error)
        }
      })
      ws.on('close', (message) => {
        // closed connection with the brain
        conf.connected = false
        conf.websocket = null
      })
    }
  })
}

const send = (message, brainName = '/main') => {
  const conf = configurations.get(brainName)
  if (!conf) {
    console.log(`unregistered brain with name ${brainName}`)
    return false
  } else if (!conf.connected) {
    console.log(`brain ${brainName} is not connected`)
    return false
  } else {
    // deliver the message to the brain
    conf.websocket.send(JSON.stringify(message))
    return true
  }
}

module.exports = {
  config,
  send
}
