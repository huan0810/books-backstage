const express = require('express')
const multer = require('multer')
const boom = require('boom')
const { UPLOAD_PATH } = require('../utils/constant')
const Result = require('../models/Result')
const Book = require('../models/Book')
const { decoded } = require('../utils')
const bookService = require('../services/book')

const router = express.Router()

// 向服务器上传电子书API
router.post(
  '/upload',
  multer({ dest: `${UPLOAD_PATH}/book` }).single('file'),
  function (req, res, next) {
    if (!req.file || req.file.length === 0) {
      new Result('上传电子书失败').fail(res)
    } else {
      const book = new Book(req.file)
      book
        .parse()
        .then((book) => {
          // console.log('book', book)
          new Result(book, '上传电子书成功').success(res)
        })
        .catch((err) => {
          // 服务端发生解析异常，向前端返回500错误
          next(boom.badImplementation(err))
        })
    }
  }
)

// 向数据库中新增电子书API
router.post('/create', function (req, res, next) {
  // decoded()方法从req的header的token中解析出用户名及过期时间
  const decode = decoded(req)
  if (decode && decode.username) {
    req.body.username = decode.username
  }
  // book实例是前端传过来的参数，经Book对象添加属性之后，得到的实例对象
  const book = new Book(null, req.body)
  bookService
    .insertBook(book)
    .then(() => {
      new Result('添加电子书成功').success(res)
    })
    .catch((err) => {
      next(boom.badImplementation(err))
    })
})

// 编辑图书，更新数据库API
router.post('/update', function (req, res, next) {
  // decoded()方法从req的header的token中解析出用户名及过期时间
  const decode = decoded(req)
  if (decode && decode.username) {
    req.body.username = decode.username
  }
  // book实例是前端传过来的参数，经Book对象添加属性之后，得到的实例对象
  const book = new Book(null, req.body)
  bookService
    .updateBook(book)
    .then(() => {
      new Result('更新电子书成功').success(res)
    })
    .catch((err) => {
      next(boom.badImplementation(err))
    })
})

// 获取对应电子书信息API，返回前端以便于编辑电子书
router.get('/get', function (req, res, next) {
  const { fileName } = req.query
  if (!fileName) {
    next(boom.badRequest(new Error('参数fileName不能为空')))
  } else {
    bookService
      .getBook(fileName)
      .then((book) => {
        new Result(book, '获取图书信息成功').success(res)
      })
      .catch((err) => {
        next(boom.badImplementation(err))
      })
  }
})

// 获取所有电子书分类API
router.get('/category', function (req, res, next) {
  bookService
    .getCategory()
    .then((category) => {
      new Result(category, '获取分类成功').success(res)
    })
    .catch((err) => {
      next(boom.badImplementation(err))
    })
})

// 根据查询条件获取图书列表
router.get('/list', function (req, res, next) {
  bookService
    .listBook(req.query)
    .then(({ list }) => {
      new Result({ list }, '获取图书列表成功').success(res)
    })
    .catch((err) => {
      next(boom.badImplementation(err))
    })
})

module.exports = router
