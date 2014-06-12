var assert = require("chai").assert
var rules = {
  "rules" : {
    "_write" : false,
    "_read" : true,
    "foo" : {
      "bar" : {
        "baz" : {
          "_write" : true,
          "_validate" : "newData.val() == 'things'"
        }
      },
      "bat" : {
        "_write" : true,
        "$stuff" : {
          "_read" : "$stuff.val() == 'beep'"
        }
      }
    },
    "users" : {
      "$user" : {
        "_validate" : "newData.hasChildren(['name'])",
        "name" : {
          "_validate" : "newData.hasChildren(['first', 'last'])",
          "first": {
            "_validate" : "newData.isString()"
          },
          "last": {
            "_validate" : "newData.isString()"
          }
        }
      }
    }
  }
}


var RuleRunner = require("../lib/RuleRunner")
describe("RuleRunner", function() {
  describe("extractRules", function() {
    it("should be able to extract rules from root of the tree", function() {
      // mock out persistence with simple object, it sgThouldn't be called
      var rv = new RuleRunner({})
      var rc = rv.extractRules(rules, "/", {beep: "boop"})
      assert.equal(rc.write.length, 1)
      assert.equal(rc.write[0].rule, false)
      assert.equal(rc.read.length, 1)
      assert.equal(rc.read[0].rule, true)
      assert.equal(rc.validate.length, 0)
      assert.equal(rc.scopes.length, 0)
    })
    it("should be able to extract rules from deeper in the tree", function() {
      // mock out persistence with simple object, it sgThouldn't be called
      var rv = new RuleRunner({})
      var rc = rv.extractRules(rules, "/foo/bar/baz", {beep: "boop"})
      assert.equal(rc.write.length, 2)
      assert.equal(rc.write[0].rule, false)
      assert.equal(rc.write[1].rule, true)
      assert.equal(rc.read.length, 1)
      assert.equal(rc.read[0].rule, true)
      assert.equal(rc.validate.length, 1)
      assert.equal(rc.validate[0].rule, "newData.val() == 'things'")
      assert.equal(rc.scopes.length, 0)
    })
    it("should be able to extract rules even if the path doesn't have tree in the tree", function() {
      // mock out persistence with simple object, it sgThouldn't be called
      var rv = new RuleRunner({})
      var rc = rv.extractRules(rules, "/beep", {beep: "boop"})
      assert.equal(rc.write.length, 1)
      assert.equal(rc.write[0].rule, false)
      assert.equal(rc.read.length, 1)
      assert.equal(rc.read[0].rule, true)
      assert.equal(rc.validate.length, 0)
      assert.equal(rc.scopes.length, 0)
    })
    it("should be able to extract scopes", function() {
      // mock out persistence with simple object, it sgThouldn't be called
      var rv = new RuleRunner({})
      var rc = rv.extractRules(rules, "/foo/bat/twinky", {beep: "boop"})
      assert.equal(rc.write.length, 2)
      assert.equal(rc.write[0].rule, false)
      assert.equal(rc.write[1].rule, true)
      assert.equal(rc.read.length, 2)
      assert.equal(rc.read[0].rule, true)
      assert.equal(rc.read[1].rule, "$stuff.val() == 'beep'")
      assert.equal(rc.validate.length, 0)
      assert.equal(rc.scopes.length, 1)
      assert.equal(rc.scopes[0].scope, "$stuff")
      assert.equal(rc.scopes[0].path, "/foo/bat/twinky")
    })
    it("should be able to extract validator from the document", function() {
      // mock out persistence with simple object, it sgThouldn't be called
      var rv = new RuleRunner({})
      var rc = rv.extractRules(rules, "/users/addison", {name: {first: "addison", last: "dude"}})
      assert.equal(rc.write.length, 1)
      assert.equal(rc.write[0].rule, false)
      assert.equal(rc.read.length, 1)
      assert.equal(rc.read[0].rule, true)
      assert.equal(rc.validate.length, 4)
      assert.equal(rc.validate[0].rule, "newData.hasChildren(['name'])")
      assert.equal(rc.validate[1].rule, "newData.hasChildren(['first', 'last'])")
      assert.equal(rc.validate[2].rule, "newData.isString()")
      assert.equal(rc.validate[3].rule, "newData.isString()")
      assert.equal(rc.scopes.length, 1)
      assert.equal(rc.scopes[0].scope, "$user")
      assert.deepEqual(rc.scopes[0].path, "/users/addison")
    })
  })

  describe("run rules", function() {
    it("should be able run a simple boolean rule", function(done) {
      var rv = new RuleRunner({})
      rv.runRules("read", {rules: {_read: true}}, {}, "/", null, function(err, res) {
        assert.ifError(err)
        assert.equal(res, true)
        done()
      })
    })

    it("should be able run a simple read rule", function(done) {
      var rv = new RuleRunner({})
      rv.runRules("read", {rules: {_read: "auth.id === 1234"}}, {id: 1234}, "/", null, function(err, res) {
        assert.ifError(err)
        assert.equal(res, true)
        done()
      })
    })

    it("should be able run a write and validate rule", function(done) {
      var rv = new RuleRunner({})
      rv.runRules("write", {rules: {foo: {_write: "auth.id === 1234", _validate: "newData.name === 'bob'"}}}, {id: 1234}, "/foo/bar", {name: "bob"}, function(err, res) {
        assert.ifError(err)
        assert.equal(res, true)
        done()
      })
    })
    it("should be able run multiple write rules", function(done) {
      var rv = new RuleRunner({})
      rv.runRules("write", {rules: {_write: true, foo: {_write: "auth.id === 1234", _validate: "newData.name === 'bob'"}}}, {id: 1234}, "/foo/bar", {name: "bob"}, function(err, res) {
        assert.ifError(err)
        assert.equal(res, true)
        done()
      })
    })
    it("should be able run a rule using scopes", function(done) {
      var persistMock = {
        get: function(key, cb) {
          cb(null, {
            beep: {
              value: 1,
              priority: 1
            },
            boop: {
              value: 1,
              priority: 1
            }
          })
        }
      }
      var rv = new RuleRunner(persistMock)
      rv.runRules("write", {rules: {foo: {$bar: {_write: "$bar == 'baz'"}}}}, {id: 1234}, "/foo/baz", {name: "bob"}, function(err, res) {
        assert.ifError(err)
        assert.equal(res, true)
        done()
      })
    })
    it("should be able run a rule using data context", function(done) {
      var persistMock = {
        get: function(key, cb) {
          cb(null, {
            value: 1
          })
        }
      }
      var rv = new RuleRunner(persistMock)
      rv.runRules("write", {rules: {foo: {_write: "data.child('baz').child('beep').val() === 1"}}}, {id: 1234}, "/foo/baz", {name: "bob"}, function(err, res) {
        if (err) throw err
        assert.equal(res, true)
        done()
      })
    })
    it("should work with the patched string methods", function(done) {
      var rv = new RuleRunner({})
      rv.runRules("read", {rules: {_read: "'hello'.beginsWith('he') && auth.id.endsWith('me')"}}, {id: "name"}, "/foo/bar", {}, function(err, res) {
        assert.ifError(err)
        assert.equal(res, true)
        done()
      })
    })
    // TODO: fix this!
    it("will fail with multiple uses of a context (TODO: fix this)", function(done) {
      var persistMock = {
        get: function(key, cb) {
          cb(null, {
            value: 2
          })
        }
      }
      var rv = new RuleRunner(persistMock)
      rv.runRules("write", {rules: {foo: {_write: "data.child('bear').val() === 2 && data.child('baz').child('beep').val() === 1"}}}, {id: 1234}, "/foo/baz", {name: "bob"}, function(err, res) {
        if (err) throw err
        assert.equal(res, false)
        done()
      })
    })
  })
})
