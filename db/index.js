const mysql = require('mysql')
const config = require('./config')
const { debug } = require('../utils/constant')
const { isObject } = require('../utils')

function connect() {
  return mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    // multipleStatements：允许每条 mysql 语句有多条查询.
    multipleStatements: true
  })
}

function querySql(sql) {
  // 建立连接
  const conn = connect()
  // 打印日志
  debug && console.log(sql)
  return new Promise((resolve, reject) => {
    try {
      conn.query(sql, (err, results) => {
        if (err) {
          debug && console.log('查询失败，原因:' + JSON.stringify(err))
          reject(err)
        } else {
          debug && console.log('查询成功:' + JSON.stringify(results))
          resolve(results)
        }
      })
    } catch (error) {
      reject(error)
    } finally {
      // 释放连接，防止内存泄漏
      conn.end()
    }
  })
}

function queryOne(sql) {
  return new Promise((resolve, reject) => {
    querySql(sql)
      .then((results) => {
        if (results && results.length > 0) {
          resolve(results[0])
        } else {
          resolve(null)
        }
      })
      .catch((err) => {
        reject(err)
      })
  })
}

// 向数据库插入电子书
function insert(book, tableName) {
  return new Promise((resolve, reject) => {
    // 判断book是否是一个对象
    if (!isObject(book)) {
      reject(new Error('插入数据库失败，插入数据非对象'))
    } else {
      const keys = []
      const values = []
      Object.keys(book).forEach((key) => {
        // hasOwnProperty(key)表示只要book对象自身上的key，而不考虑原型链上的属性
        if (book.hasOwnProperty(key)) {
          // 给key加上``,防止有sql关键字而在查询数据库时出错，\`转义
          keys.push(`\`${key}\``)
          values.push(`'${book[key]}'`) //值加上''
        }
      })
      if (keys.length > 0 && values.length > 0) {
        let sql = `insert into \`${tableName}\` `
        const keysString = keys.join(',')
        const valuesString = values.join(',')
        sql = `${sql}(${keysString}) values (${valuesString})`
        // debug && console.log(sql)
        const conn = connect() //创建数据库连接
        try {
          conn.query(sql, (err, result) => {
            if (err) {
              reject(err)
            } else {
              resolve(result)
            }
          })
        } catch (error) {
          reject(error)
        } finally {
          conn.end() //释放数据库连接
        }
      } else {
        reject(new Error('插入数据库失败，对象中没有任何属性'))
      }
    }
  })
}

module.exports = {
  querySql,
  queryOne,
  insert
}
