const {
  CODE_ERROR,
  CODE_SUCCESS,
  CODE_TOKEN_EXPIRED
} = require('../utils/constant')

// Result类是返回给前端的结果
class Result {
  // options表示返回给前端的额外的信息
  constructor(data, msg = '操作成功', options) {
    this.data = null
    if (arguments.length === 0) {
      this.msg = '操作成功'
    } else if (arguments.length === 1) {
      this.msg = data
    } else {
      this.data = data
      this.msg = msg
      if (options) {
        this.options = options
      }
    }
  }

  createResult() {
    if (!this.code) {
      this.code = CODE_SUCCESS
    }
    let base = {
      code: this.code,
      msg: this.msg
    }
    if (this.data) {
      base.data = this.data
    }
    if (this.options) {
      base = { ...base, ...this.options }
    }
    console.log(base)
    return base
  }

  json(res) {
    //res.json()把请求的返回值的转化成json的格式,返回给前端
    res.json(this.createResult())
  }

  success(res) {
    this.code = CODE_SUCCESS
    this.json(res)
  }

  fail(res) {
    this.code = CODE_ERROR
    this.json(res)
  }

  jwtError(res) {
    this.code = CODE_TOKEN_EXPIRED
    this.json(res)
  }
}

module.exports = Result
