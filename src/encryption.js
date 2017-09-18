// This module simply encrypts/decrypts user id when creating links, in order that the channel id is not exposed

const crypto = require('crypto')
const algorithm = 'aes-256-cbc'
const password = process.env.ENC_KEY

const encrypt = (text) => {
  const cipher = crypto.createCipher(algorithm, password)
  let crypted = cipher.update(text, 'utf8', 'hex')
  crypted += cipher.final('hex')
  return crypted
}

const decrypt = (text) => {
  const decipher = crypto.createDecipher(algorithm, password)
  let dec = decipher.update(text, 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec
}

module.exports = {
  encrypt: encrypt,
  decrypt: decrypt
}
