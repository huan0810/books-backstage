const fs = require('fs')
const xml2js = require('xml2js').parseString
const { MIME_TYPE_EPUB, UPLOAD_URL, UPLOAD_PATH } = require('../utils/constant')
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
              this.parseContents(epub).then(({ chapters }) => {
                this.contents = chapters
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
        const fileName = this.fileName
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
                // epub.flow就是根据目录解析出来的展示顺序
                epub.flow.forEach((chapter, index) => {
                  if (index > newNavMap.length - 1) {
                    return
                  }
                  const nav = newNavMap[index]
                  // 获取章节的URL，放入chapter.text
                  chapter.text = `${UPLOAD_URL}/unzip/${fileName}/${chapter.href}`
                  // console.log(chapter.text)
                  if (nav && nav.navLabel) {
                    chapter.label = nav.navLabel.text || ''
                  } else {
                    chapter.label = ''
                  }
                  chapter.level = nav.level
                  chapter.pid = nav.pid
                  chapter.navId = nav['$'].id
                  chapter.fileName = fileName
                  chapter.order = index + 1
                  chapters.push(chapter)
                })
                // console.log('chapters', chapters)
                resolve({ chapters })
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
  // 传入相对路径，生成绝对路径
  static genPath(path) {
    if (!path.startsWith('/')) {
      path = `/${path}`
    }
    return `${UPLOAD_PATH}${path}`
  }
}

module.exports = Book
