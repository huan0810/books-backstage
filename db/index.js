const mysql = require('mysql')
const config = require('./config')
const { debug } = require('../utils/constant')
const { isObject } = require('../utils')
const { reject } = require('lodash')

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

// 查询一组数据
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

// 查询一条数据
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

// 插入数据（电子书和目录）
function insert(module, tableName) {
  return new Promise((resolve, reject) => {
    // 判断book是否是一个对象
    if (!isObject(module)) {
      reject(new Error('插入数据库失败，插入数据非对象'))
    } else {
      const keys = []
      const values = []
      Object.keys(module).forEach((key) => {
        // hasOwnProperty(key)表示只要book对象自身上的key，而不考虑原型链上的属性
        if (module.hasOwnProperty(key)) {
          // 给key加上``,防止有sql关键字而在查询数据库时出错，\`转义
          keys.push(`\`${key}\``)
          values.push(`'${module[key]}'`) //值加上''
        }
      })
      if (keys.length > 0 && values.length > 0) {
        let sql = `insert into \`${tableName}\` `
        const keysString = keys.join(',')
        const valuesString = values.join(',')
        sql = `${sql}(${keysString}) values (${valuesString})`
        debug && console.log(sql)
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

// 编辑图书，更新数据库
function update(model, tableName, where) {
  return new Promise((resolve, reject) => {
    if (!isObject(model)) {
      reject(new Error('插入数据库失败，插入数据非对象'))
    } else {
      const entry = []
      Object.keys(model).forEach((key) => {
        if (model.hasOwnProperty(key)) {
          entry.push(`\`${key}\`='${model[key]}'`)
        }
      })
      if (entry.length > 0) {
        let sql = `update \`${tableName}\` set`
        sql = `${sql} ${entry.join(',')} ${where}`
        debug && console.log(sql)
        const conn = connect()
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
          conn.end()
        }
      }
    }
  })
}

// 在查询图书时，按前端传过来的条件生成where语句,查询分类，直接查询
function and(where, key, val) {
  if (where === 'where') {
    return `${where} \`${key}\`='${val}'`
  } else {
    return `${where} and \`${key}\`='${val}'`
  }
}

// 在查询图书时，按前端传过来的条件生成where语句。查询书名作者，模糊查询
function andLike(where, key, val) {
  if (where === 'where') {
    return `${where} \`${key}\` like '%${val}%'`
  } else {
    return `${where} and \`${key}\` like '%${val}%'` //%表示0或多个的任意字符
  }
}
module.exports = {
  querySql,
  queryOne,
  insert,
  update,
  and,
  andLike
}
