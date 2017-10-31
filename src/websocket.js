const url = require('url')
const WebSocket = require('ws')
const sendHeartbeats = require('ws-heartbeats')

let configurations = null

// websocketNames is a object that maps each BRAIN_NAME to its AUTH_TOKEN
const config = (httpServer, languages, onMessage, websocketConfigs = {'/main': null}) => {
  // multiply each websocket configuration with the languages
  const localizedConfigs = {}
  for (var key in websocketConfigs) {
    var element = websocketConfigs[key]
    languages.forEach(lang => {
      localizedConfigs[`/${lang}${key}`] = {
        auth: element,
        language: lang
      }
    })
  }
  configurations = Object.keys(localizedConfigs).reduce((map, key) => {
    // each configuration object has token, status and corresponding websocket
    return map.set(key, {token: localizedConfigs[key].auth, connected: false, websocket: null, language: localizedConfigs[key].language})
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
          onMessage(message, conf.language)
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

const send = (message, brainName = '/main', language = 'en') => {
  const localizedBrainName = '/' + language + brainName
  const conf = configurations.get(localizedBrainName)
  if (!conf) {
    console.log(`unregistered brain with name ${localizedBrainName}`)
    return false
  } else if (!conf.connected) {
    console.log(`brain ${localizedBrainName} is not connected`)
    return false
  } else {
    // deliver the message to the brain
    conf.websocket.send(JSON.stringify(message))
    return true
  }
}
const isConnected = (brainName = '/main', language = 'en') => {
  const localizedBrainName = '/' + language + brainName
  const conf = configurations.get(localizedBrainName)
  if (!conf) {
    console.log(`unregistered brain with name ${localizedBrainName}`)
    return false
  } else {
    return conf.connected
  }
}

module.exports = {
  config,
  send,
  isConnected
}
