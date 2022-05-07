const { env } = require('./env')
// 定义文件上传路径(本地环境：线上文件)
const UPLOAD_PATH =
  env === 'dev'
    ? 'D:\\ProgramFiles\\nginx\\nginx-1.21.6\\upload\\books-manage-upload'
    : '/root/upload/ebook'

// 定义接口状态码，CODE_ERROR失败，CODE_SUCCESS成功，并导出
module.exports = {
  CODE_ERROR: -1,
  CODE_SUCCESS: 0,
  // token验证错误是返回-2
  CODE_TOKEN_EXPIRED: -2,
  // debug参数为true，用于打印日志
  debug: true,
  // 数据库中存储的密码是加密的，此密钥用于用户密码的加密解密
  PWD_SALT: '这是一个密钥',
  // JWT认证
  PRIVATE_KEY: '这又是一个密钥',
  JWT_EXPIRED: 60 * 60,
  UPLOAD_PATH
}
