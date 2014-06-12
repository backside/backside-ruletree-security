var treeUtils = require("backside-utils")
var DataContext = require("./DataContext")
function FauxContext(pathArr) {
  this.pathArr = pathArr || []
  this.requiredParent = false
  this.requiredChildren = {}
  this.wasCalled = false
}

FauxContext.prototype.getPath = function() {
  return treeUtils.arrayToPath(this.pathArr)
}

FauxContext.prototype.called = function() {
  this.wasCalled = true
}

FauxContext.prototype.buildContext = function(persistor, cb) {
  if (!this.wasCalled) return cb(null, new DataContext())
  persistor.get(this.getPath(), function(err, data) {
    if (err) return cb(err)
    cb(null, new DataContext(data))
  })
}

FauxContext.prototype.val = function() {
  this.called()
  return ""
}

FauxContext.prototype.child = function(childName) {
  this.called()
  this.pathArr.push(childName)
  return this
}

FauxContext.prototype.parent = function() {
  this.called()
  this.pathArr.pop()
  this.requiredParent = true
  return this
}

// keep track of children
FauxContext.prototype.hasChild = function(childName) {
  this.called()
  this.requiredChildren[childName] = true
  return true
}

FauxContext.prototype.hasChildren = function(children) {
  this.called()
  for (var i = 0; children.length; i++) {
    this.hasChild(children[i])
  }
  return true
}

// mock out with trues
FauxContext.prototype.exists = function() {
  this.called()
  return true
}
FauxContext.prototype.isNumber = function() {
  this.called()
  return true
}
FauxContext.prototype.isBoolean = function() {
  this.called()
  return true
}
FauxContext.prototype.isString = function() {
  this.called()
  return true
}

module.exports = FauxContext
