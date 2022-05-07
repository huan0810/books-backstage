const { MIME_TYPE_EPUB, UPLOAD_URL, UPLOAD_PATH } = require('../utils/constant')
const fs = require('fs')
// 引入Epub库
const Epub = require('../utils/epub')

// 创建 Book 对象，以便于对其解析，(1)生成目录，json格式数据等返回给前端;(2)生成数据库字段名
class Book {
  constructor(file, data) {
    // file表示是新上传的电子书
    // data表示是希望向数据库更新或插入电子书数据
    if (file) {
      this.createBookFromFile(file)
    } else {
      this.createBookFromData(data)
    }
  }

  createBookFromFile(file) {
    console.log('createBookFromFile', file)
    const {
      destination,
      filename,
      mimetype = MIME_TYPE_EPUB,
      path,
      originalname
    } = file
    // 给文件赋后缀名.epub
    const suffix = mimetype === MIME_TYPE_EPUB ? '.epub' : ''
    // 电子书在服务器中的原有路径
    const oldBookPath = path
    // 电子书在服务器中，加上后缀名的路径
    const bookPath = `${destination}/${filename}${suffix}`
    // 生成电子书文件的url下载地址
    const url = `${UPLOAD_URL}/book/${filename}${suffix}`
    // 电子书上传服务器后,解压文件夹在服务器中存储的实际路径(绝对路径)
    const unzipPath = `${UPLOAD_PATH}/unzip/${filename}`
    // 解压后文件夹的url地址
    const unzipUrl = `${UPLOAD_URL}/unzip/${filename}`
    // 若电子书解压路径不存在就创建
    if (!fs.existsSync(unzipPath)) {
      fs.mkdirSync(unzipPath, { recursive: true })
    }
    // 文件重命名，加上.epub后缀名
    if (fs.existsSync(oldBookPath) && !fs.existsSync(bookPath)) {
      fs.renameSync(oldBookPath, bookPath)
    }
    // 把需要返回给前端的属性，保存到Book对象中
    this.fileName = filename //无后缀文件名，可以作为不重复主键
    this.path = `/book/${filename}${suffix}` //epub文件相对路径
    this.filePath = this.path
    this.unzipPath = `/unzip/${filename}` //epub解压后相对路径
    this.url = url //epub文件下载链接
    this.title = '' //书名
    this.author = '' //作者
    this.publisher = '' //出版社
    this.contents = [] //目录
    this.cover = '' //封面图片URL
    this.coverPath = '' //封面图片路径
    this.category = -1 //电子书分类ID
    this.categoryText = '' //分类名称
    this.language = '' //语种
    this.unzipUrl = unzipUrl //解压后文件夹的url地址
    this.originalname = originalname //电子书文件的原名
  }
  createBookFromData() {}
  // 解析电子书
  parse() {
    return new Promise((resolve, reject) => {
      const bookPath = `${UPLOAD_PATH}${this.filePath}`
      if (!fs.existsSync(bookPath)) {
        // 路径不存在时，返回Error
        reject(new Error('电子书不存在'))
      }
      const epub = new Epub(bookPath)
      // Epub库解析中发生异常时回调
      epub.on('error', (err) => {
        reject(err)
      })
      // end事件表示Epub库已经成功解析
      epub.on('end', (err) => {
        if (err) {
          reject(err)
        } else {
          // 解析完毕，没有错误，就可以的到metadata了，记录了电子书信息的对象
          console.log('epub end', epub.metadata)
          const { language, creator, creatorFileAs, title, cover, publisher } =
            epub.metadata
          if (!title) {
            reject(new Error('图书标题为空'))
          } else {
            this.title = title //给this.title赋值，createBookFromFile函数中已初始化为空值
            this.language = language || 'en'
            this.author = creator || creatorFileAs || 'unknown'
            this.publisher = publisher || 'unknown'
            this.rootFile = epub.rootFile
            const handleGetImage = (err, file, mimeType) => {
              if (err) {
                reject(err)
              } else {
                // 取封面图片文件后缀名
                const suffix = mimeType.split('/')[1]
                // 因为是在箭头函数里面，此处this跟作用域this指向一样，指向Book实例
                const coverPath = `${UPLOAD_PATH}/img/${this.fileName}.${suffix}`
                const coverUrl = `${UPLOAD_URL}/img/${this.fileName}.${suffix}`
                // 把封面图片写入磁盘
                fs.writeFileSync(coverPath, file, 'binary')
                // 封面图片的相对路径
                this.coverPath = `/img/${this.fileName}.${suffix}`
                this.cover = coverUrl
                resolve(this) //传入当前的book实例
              }
            }
            console.log('cover', cover)
            epub.getImage(cover, handleGetImage)
          }
        }
      })
      // 解析电子书
      epub.parse()
    })
  }
}

module.exports = Book
