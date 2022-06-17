const express = require('express')
const router = require('./router')
// 引入解析body参数的中间件
const bodyParser = require('body-parser')
// cors解决跨域问题
const cors = require('cors')
const app = express()
app.use(express.json({ limit: '2100000kb' }))
app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use('/', router)

// 启动服务器
const server = app.listen(5000, function () {
  const { address, port } = server.address()
  console.log('HTTP启动成功：http://www.huan.world:%s', port)
})
