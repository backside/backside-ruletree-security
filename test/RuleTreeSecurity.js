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


var RuleTreeSecurity = require("../lib/RuleTreeSecurity")
describe("RuleTreeSecurity", function() {
  describe("validate a rule set", function() {
    it("should be able to validate a whole rule set successfully", function(done) {
      var rv = new RuleTreeSecurity({})
      rv.validateRuleSet(rules.rules, function(err) {
        if (err) throw err
        assert.ifError(err)
        done()
      })
    })
    it("should be able to detect some basic errors in rule structure", function(done) {
      var badRules = {
        user: {
          "_bad" : true
        }
      }
      var rv = new RuleTreeSecurity({})
      rv.validateRuleSet(badRules, function(err) {
        assert(err != null, "an error")
        done()
      })
    })
  })

})
