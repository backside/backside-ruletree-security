function DataContext(data, parent) {
  this.data = data
  this.parent = parent
}

DataContext.prototype.val = function() {
  return this.data.value
}

DataContext.prototype.child = function(childName) {
  return this
}

DataContext.prototype.parent = function() {
  return this
}

DataContext.prototype.hasChild = function(childName) {
  if (this.data[childName]) {
    return true
  }
  return false
}

DataContext.prototype.hasChildren = function(children) {
  for (var i = 0; children.length; i++) {
    if (!this.hasChild(children[i])) {
      return false
    }
  }
  return true
}

DataContext.prototype.exists = function() {
  return this.data != null
}

DataContext.prototype.isTypeOf = function(type) {
  return typeof this.data.value === type
}

DataContext.prototype.isNumber = function() {
  return this.isTypeOf("number")
}

DataContext.prototype.isBoolean = function() {
  return this.isTypeOf("boolean")
}

DataContext.prototype.isString = function() {
  return this.isTypeOf("string")
}

module.exports = DataContext
