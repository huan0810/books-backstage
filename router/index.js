const express = require('express')
const boom = require('boom')
const userRouter = require('./user')
const bookRouter = require('./book')
const jwtAuth = require('./jwt')
const Result = require('../models/Result')

// 注册路由
const router = express.Router()

router.use(jwtAuth)

router.get('/', function (req, res) {
  res.send('欢迎来到图书管理后台')
})

// 后面的路由都是嵌套在/user后面的
router.use('/user', userRouter)
// 后面的路由都是嵌套在/book后面的
router.use('/book', bookRouter)

/**
 * 集中处理404请求的中间件
 * 注意：该中间件必须放在正常处理流程之后
 * 否则，会拦截正常请求
 */
router.use((req, res, next) => {
  // 使用next()继续把异常向下传递，给异常处理中间件
  next(boom.notFound('接口不存在'))
})

/**
 * 自定义路由异常处理中间件
 * 注意两点：
 * 第一，方法的参数不能减少
 * 第二，方法的必须放在路由最后
 */
router.use((err, req, res, next) => {
  // console.log(err.name) //UnauthorizedError表示token验证失败
  if (err.name && err.name === 'UnauthorizedError') {
    // UnauthorizedError表示token错误
    const { status = 401, message } = err
    new Result(null, 'Token验证失败', {
      error: status,
      errorMsg: message
    }).jwtError(res.status(status))
  } else {
    const msg = (err && err.message) || '系统错误'
    const statusCode = (err.output && err.output.statusCode) || 500
    const errorMsg =
      (err.output && err.output.payload && err.output.payload.error) ||
      err.message
    new Result(null, msg, {
      error: statusCode,
      errorMsg
    }).fail(res.status(statusCode))
  }
})

// 导出路由
module.exports = router
