const Book = require('../models/Book')
const db = require('../db')
const _ = require('lodash')

// 判断传入电子书在数据库中是否已存在
function exists(book) {
  return false
}

// 移除电子书
function removeBook(book) {}

// 向数据库中插入电子书目录
async function insertContents(book) {
  const contents = book.getContents()
  if (contents && contents.length > 0) {
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i]
      const _content = _.pick(content, [
        'fileName',
        'id',
        'href',
        'order',
        'level',
        'text',
        'label',
        'pid',
        'navId'
      ])
      console.log('_content', _content)
      await db.insert(_content, 'contents')
    }
  }
}

// 向数据库新增电子书
function insertBook(book) {
  return new Promise(async (resolve, reject) => {
    try {
      if (book instanceof Book) {
        // instanceof确保当前的book参数是Book对象的一个实例
        const result = await exists(book) //判断电子书是否存在
        if (result) {
          // 电子书已存在，就移除电子书
          await removeBook(book)
          reject(new Error('电子书已存在'))
        } else {
          // 电子书不存在，数据库新增记录
          //第一个book是book实例，第二个'book'是数据库book表
          await db.insert(book.toDb(), 'book')
          // 创建目录
          await insertContents(book)
          resolve()
        }
      } else {
        reject(new Error('添加的图书对象不合法'))
      }
    } catch (error) {
      reject(error)
    }
  })
}

module.exports = { insertBook }
