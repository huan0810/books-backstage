const fs = require('fs')
const path = require('path')
const { pid } = require('process')
const xml2js = require('xml2js').parseString
const {
  MIME_TYPE_EPUB,
  UPLOAD_URL,
  OLD_UPLOAD_URL,
  UPLOAD_PATH
} = require('../utils/constant')
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
    // console.log('createBookFromFile', file)
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
    this.contentsTree = [] //树状目录结构
    this.cover = '' //封面图片URL
    this.coverPath = '' //封面图片路径
    this.category = -1 //电子书分类ID
    this.categoryText = '' //分类名称
    this.language = '' //语种
    this.unzipUrl = unzipUrl //解压后文件夹的url地址
    this.originalName = originalname //电子书文件的原名
  }
  createBookFromData(data) {
    this.fileName = data.fileName
    this.cover = data.coverPath
    this.title = data.title
    this.author = data.author
    this.publisher = data.publisher
    this.bookId = data.fileName
    this.language = data.language
    this.rootFile = data.rootFile
    this.originalName = data.originalName
    this.path = data.filePath
    this.filePath = data.path || data.filePath
    this.unzipPath = data.unzipPath
    this.coverPath = data.coverPath
    this.createUser = data.username
    this.createDt = new Date().getTime()
    this.updateDt = new Date().getTime()
    this.updateType = data.updateType === 0 ? data.updateType : 1
    // 图书分类
    this.category = data.category || 99
    this.categoryText = data.categoryText || '自定义'
    this.contents = data.contents || []
  }
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
          // console.log('epub end', epub.metadata)
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
            // 解压电子书
            try {
              // 先解压，再解析解压文件中的目录
              this.unzip() //调用解压方法
              // 调用解析目录方法
              this.parseContents(epub).then(({ chapters, chaptersTree }) => {
                this.contents = chapters
                this.contentsTree = chaptersTree
                epub.getImage(cover, handleGetImage)
              })
            } catch (err) {
              reject(err)
            }
          }
        }
      })
      // 解析电子书
      epub.parse()
    })
  }
  // 定义解压方法
  unzip() {
    const AdmZip = require('adm-zip')
    const zip = new AdmZip(Book.genPath(this.path))
    // 将以上路径下的文件解压，放入目标路径.true表示如果路径存在就覆盖
    zip.extractAllTo(Book.genPath(this.unzipPath), true)
  }
  // 定义解析目录方法
  parseContents(epub) {
    function getNcxFilePath() {
      // console.log(epub)
      //epub下面的spine属性的href属性，存放的是目录文件toc.ncx的路径
      const spine = epub && epub.spine
      const manifest = epub && epub.manifest
      const ncx = spine.toc && spine.toc.href
      const id = spine.toc && spine.toc.id
      // console.log('spine', ncx, manifest[id].href)
      if (ncx) {
        return ncx
      } else {
        // 若ncx不存在(即spine.toc.href不存在)，就根据id从manifest里面查找
        return manifest[id].href
      }
    }

    // 目录解析
    function findParent(array, level = 0, pid = '') {
      return array.map((item) => {
        item.level = level
        item.pid = pid
        if (item.navPoint && item.navPoint.length > 0) {
          // navPoint中还嵌套着navPoint，且navPoint又是一个数组时
          item.navPoint = findParent(item.navPoint, level + 1, item['$'].id)
        } else if (item.navPoint) {
          // navPoint是一个对象时
          item.navPoint.level = level
          item.navPoint.pid = item['$'].id
        }
        return item
      })
    }

    // 把目录的树状结构变为一维结构
    function flatten(array) {
      // map() 方法创建一个新数组
      return [].concat(
        ...array.map((item) => {
          if (item.navPoint && item.navPoint.length > 0) {
            // navPoint中还嵌套着navPoint，且navPoint又是一个数组时
            return [].concat(item, ...flatten(item.navPoint))
          } else if (item.navPoint) {
            // navPoint是一个对象时,直接和父结构放入一个数组中
            return [].concat(item, item.navPoint)
          }
          return item
        })
      )
    }

    // getNcxFilePath()获取的是相对路径，需要再转成绝对路径
    const ncxFilePath = Book.genPath(`${this.unzipPath}/${getNcxFilePath()}`)
    if (fs.existsSync(ncxFilePath)) {
      // ncxFilePath存在，即目录文件存在，就开始解析目录
      return new Promise((resolve, reject) => {
        const xml = fs.readFileSync(ncxFilePath, 'utf-8')
        // ncxFilePath是目录文件toc.ncx的绝对路径
        const dir = path.dirname(ncxFilePath).replace(UPLOAD_PATH, '')
        // console.log('ncxFilePath', ncxFilePath)
        // console.log('dir', dir)
        const fileName = this.fileName
        const unzipPath = this.unzipPath
        xml2js(
          xml,
          {
            explicitArray: false,
            ignoreAttrs: false
          },
          function (err, json) {
            if (err) {
              reject(err)
            } else {
              const navMap = json.ncx.navMap
              // console.log('xml', JSON.stringify(navMap))
              if (navMap.navPoint && navMap.navPoint.length > 0) {
                // 目录解析
                navMap.navPoint = findParent(navMap.navPoint)
                // 把树状结构变为一维结构
                const newNavMap = flatten(navMap.navPoint)
                const chapters = []
                // console.log('newNavMap', newNavMap[0].content['$'])
                // epub.flow就是根据目录解析出来的展示顺序
                // epub.flow是阅读电子书的阅读顺序，而newNavMap是目录的信息，故解析目录时应该用newNavMap
                newNavMap.forEach((chapter, index) => {
                  const src = chapter.content['$'].src
                  // 获取章节的URL，放入chapter.text
                  chapter.id = `${src}`
                  chapter.href = `${dir}/${src}`.replace(unzipPath, '')
                  chapter.text = `${UPLOAD_URL}${dir}/${src}`
                  chapter.label = chapter.navLabel.text || ''
                  chapter.navId = chapter['$'].id
                  chapter.fileName = fileName
                  chapter.order = index + 1
                  chapters.push(chapter)
                })
                // console.log('chapters', chapters)
                // chapters是把目录结构扁平化的一维数组，这里再转换成树状结构，再返回给前端
                // 这样前端的逻辑会少一点
                const chaptersTree = Book.genContentsTree(chapters)
                // console.log('chaptersTree', chaptersTree)
                resolve({ chapters, chaptersTree })
              } else {
                reject(new Error('目录解析失败，目录长度为0'))
              }
            }
          }
        )
      })
    } else {
      throw new Error('目录文件不存在')
    }
  }
  // 将Book对象中与数据库相关字段提取出来，供插入数据库时使用
  toDb() {
    return {
      fileName: this.fileName,
      cover: this.coverPath,
      title: this.title,
      author: this.author,
      publisher: this.publisher,
      bookId: this.fileName,
      language: this.language,
      rootFile: this.rootFile,
      originalName: this.originalName,
      filePath: this.path || this.filePath,
      unzipPath: this.unzipPath,
      coverPath: this.coverPath,
      createUser: this.createUser,
      createDt: this.createDt,
      updateDt: this.updateDt,
      updateType: this.updateType,
      // 图书分类
      category: this.category,
      categoryText: this.categoryText
    }
  }
  // 获取用户提交的目录，并做一些预处理
  getContents() {
    return this.contents
  }
  // 删除电子书3个文件
  reset() {
    if (Book.pathExists(this.filePath)) {
      fs.unlinkSync(Book.genPath(this.filePath))
    }
    if (Book.pathExists(this.coverPath)) {
      fs.unlinkSync(Book.genPath(this.coverPath))
    }
    if (Book.pathExists(this.unzipPath)) {
      fs.rmdirSync(Book.genPath(this.unzipPath), { recursive: true })
    }
  }

  // 传入相对路径，生成绝对路径
  static genPath(path) {
    if (!path.startsWith('/')) {
      path = `/${path}`
    }
    return `${UPLOAD_PATH}${path}`
  }
  // 判断路径是否存在
  static pathExists(path) {
    if (path.startsWith(UPLOAD_PATH)) {
      return fs.existsSync(path)
    } else {
      return fs.existsSync(Book.genPath(path))
    }
  }
  // 生成电子书封面图片地址,用于编辑图书时的前端展示。兼容数据库中的旧数据
  static genCoverUrl(book) {
    const { cover } = book
    if (+book.updateType === 0) {
      // 数据库中旧数据
      if (cover) {
        if (cover.startsWith('/')) {
          return `${OLD_UPLOAD_URL}${cover}`
        } else {
          return `${OLD_UPLOAD_URL}/${cover}`
        }
      } else {
        return null
      }
    } else {
      // 数据库中新数据
      if (cover) {
        if (cover.startsWith('/')) {
          return `${UPLOAD_URL}${cover}`
        } else {
          return `${UPLOAD_URL}/${cover}`
        }
      } else {
        return null
      }
    }
  }
  // 获取电子书目录,用于编辑图书时的前端展示。兼容数据库中的旧数据
  static genContentsTree(contents) {
    if (contents) {
      const contentsTree = []
      contents.forEach((c) => {
        c.children = []
        if (c.pid === '') {
          // 若当前项有父级目录，pid就存放父级目录的navId
          // pid为空，说明当前项是一级目录，直接放入chaptersTree
          contentsTree.push(c)
        } else {
          // pid不为空，说明当前项有父级目录,找到父级目录并放入其children数组中
          const parent = contents.find((_) => _.navId === c.pid)
          parent.children.push(c)
        }
      })
      return contentsTree
    }
  }
}

module.exports = Book
