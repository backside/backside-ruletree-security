var assert = require("chai").assert

assert.noErrRet = function(retVal) {
  if (retVal instanceof Error) {
    throw retVal
  }
}

assert.exErrRet = function(retVal) {
  if (!(retVal instanceof Error)) {
    throw new Error("expected function to return an error, did not")
  }
}

var RuleParser = require("../lib/RuleParser")

describe("Rule Parser", function() {
  describe("rule syntax validation", function() {
    var rp = new RuleParser()
    it("should be able to validate some simple rules", function() {
      assert.noErrRet(rp.validateRule("_write", "newData.val() === 'foo'"))
      assert.noErrRet(rp.validateRule("_read", "data.child('stuff').val() > 4"))
      assert.noErrRet(rp.validateRule("_read", "now > 123456789"))
      assert.noErrRet(rp.validateRule("_read", "$stuff === 'foo'", {"$stuff" : true}))
    })
    it("should be able to invalidate some obvious things", function() {
      // can't access newData on a read rule
      assert.exErrRet(rp.validateRule("_read", "newData.val() === 'foo'"))
      // need a var in scope
      assert.exErrRet(rp.validateRule("_read", "$stuff === 'foo'", {}))
      // function doesn't return a boolean (bad operator)
      assert.exErrRet(rp.validateRule("_read", "data.child('stuff').val() + 4"))
      // doesn't return boolean (bad function)
      assert.exErrRet(rp.validateRule("_read", "data.child('stuff')"))
    })
    it("should be able to handle so more complex rules", function() {
      assert.noErrRet(rp.validateRule("_read", "root.child('users').child(auth.id).child('active').val() == true"))
      assert.noErrRet(rp.validateRule("_write", "newData.child('name').val().length > 4"))
    })
    it("be able to detect when bad types are used", function() {
      assert.exErrRet(rp.validateRule("_read", "root.child('user').length"))
      assert.exErrRet(rp.validateRule("_read", "root.hasChildren('user')"))
      assert.exErrRet(rp.validateRule("_read", "root.hasChild(['user', 'dude'])"))
    })
  })
})
