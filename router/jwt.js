// 服务端的JWT认证

const jwt = require('express-jwt')
const { PRIVATE_KEY } = require('../utils/constant')

module.exports = jwt({
  secret: PRIVATE_KEY,
  credentialsRequired: true
}).unless({
  //配置白名单
  path: ['/', '/user/login']
})
