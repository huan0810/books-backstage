const { env } = require('./env')
// 定义文件上传路径(本地环境：线上环境)
const UPLOAD_PATH =
  env === 'dev'
    ? 'D:\\ProgramFiles\\nginx\\nginx-1.21.6\\upload\\books-manage-upload'
    : '/root/upload/ebook'

// 电子书文件上传后的url下载地址(本地服务器：线上服务器)
const UPLOAD_URL =
  env === 'dev'
    ? 'http://books.backstage.com:8089/books-manage-upload'
    : 'http://www.backstage.com:8089/books-manage-upload'

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
  UPLOAD_PATH,
  UPLOAD_URL,
  // 上传电子书的默认文件类型是epub
  MIME_TYPE_EPUB: 'application/epub+zip'
}
