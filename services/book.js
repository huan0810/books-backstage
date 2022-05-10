const Book = require('../models/Book')
const db = require('../db')
const _ = require('lodash')
const { reject } = require('lodash')
const { debug } = require('../utils/constant')

// 判断传入电子书在数据库中是否已存在
function exists(book) {
  // 书名，作者，出版社全部存在，就认为这本书已经存在
  const { title, author, publisher } = book
  const sql = `select * from book where title='${title}' and author='${author}' and publisher='${publisher}'`
  return db.queryOne(sql)
}

// 移除电子书,同时移除电子书在服务器中的文件，以及数据库记录
async function removeBook(book) {
  if (book) {
    // 删除电子书文件
    book.reset()
    if (book.fileName) {
      const removeBookSql = `delete from book where fileName='${book.fileName}'`
      const removeContentsSql = `delete from contents where fileName='${book.fileName}'`
      await db.querySql(removeBookSql)
      await db.querySql(removeContentsSql)
    }
  }
}

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
          // await removeBook(book)
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

// 编辑图书，更新数据库
function updateBook(book) {
  return new Promise(async (resolve, reject) => {
    try {
      if (book instanceof Book) {
        const result = await getBook(book.fileName)
        if (result) {
          const model = book.toDb()
          if (+result.updateType === 0) {
            reject(new Error('内置图书不能编辑'))
          } else {
            await db.update(model, 'book', `where fileName='${book.fileName}'`)
            resolve()
          }
        }
      } else {
        reject(new Error('添加的图书对象不合法'))
      }
    } catch (error) {
      reject(error)
    }
  })
}

// 获取对应电子书信息API，返回前端以便于编辑电子书
function getBook(fileName) {
  return new Promise(async (resolve, reject) => {
    // 根据前端传入的fileName，取数据库查询图书信息、目录信息
    const bookSql = `select * from book where fileName='${fileName}'`
    const contentsSql = `select * from contents where fileName='${fileName}' order by \`order\``
    const book = await db.queryOne(bookSql)
    const contents = await db.querySql(contentsSql)
    if (book) {
      book.cover = Book.genCoverUrl(book) // 获取封面
      book.contentsTree = Book.genContentsTree(contents)
      resolve(book)
    } else {
      reject(new Error('电子书不存在'))
    }
  })
}

// 获取所有电子书分类API
async function getCategory() {
  const sql = 'select * from category order by category asc'
  const result = await db.querySql(sql)
  const categoryList = []
  result.forEach((item) => {
    categoryList.push({
      label: item.categoryText,
      value: item.category,
      num: item.num
    })
  })
  return categoryList
}

// 根据查询条件获取图书列表
async function listBook(query) {
  debug && console.log(query)
  const { category, author, title, page = 1, pageSize = 20, sort } = query
  const offset = (page - 1) * pageSize //查询偏移量，从下一条数据开始查起
  let bookSql = 'select * from book'
  // 根据传入参数生成查询条件
  let where = 'where'
  title && (where = db.andLike(where, 'title', title))
  author && (where = db.andLike(where, 'author', author))
  category && (where = db.and(where, 'category', category))
  if (where !== 'where') {
    bookSql = `${bookSql} ${where}`
  }
  if (sort) {
    // 按id升降序
    const symbol = sort[0] //取+-号,代表升序或降序
    const column = sort.slice(1) //取排序字段,如id
    const order = symbol === '+' ? 'asc' : 'desc'
    bookSql = `${bookSql} order by \`${column}\` ${order}`
  }
  bookSql = `${bookSql} limit ${pageSize} offset ${offset}`
  const list = await db.querySql(bookSql)
  return { list } //async await方法中返回得内容会自动转成Promise实例对象
}
module.exports = { insertBook, getBook, updateBook, getCategory, listBook }
