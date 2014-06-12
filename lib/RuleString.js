// firebase adds a few methods onto the string prototype, we extend the string class
// and then inject it into the context

module.exports = {
  patch: "String.prototype.beginsWith = beginsWith;\n" +
    "String.prototype.endsWith = endsWith;\n",
  beginsWith: function(prefix) {
    for (var i = 0; i < prefix.length; i++) {
      if (this.charAt(i) !== prefix.charAt(i)) {
        return false
      }
    }
    return true
  },
  endsWith: function(suffix) {
    if (this.length - suffix.length < 0) {
      return false
    }
    var endOfString = this.substr(this.length - suffix.length)
    return endOfString === suffix
  }
}
