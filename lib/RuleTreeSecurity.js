var RuleParser = require("./RuleParser")
var RuleRunner = require("./RuleRunner")
var treeUtils = require("backside-utils")
var ruleTypes = [
  "_write",
  "_read",
  "_validate"
]

// if we don't have any rules, this gets set as the rules
var defaultRules = {
  rules: {
    _read: true,
    _write: true
  }
}

function RuleTreeSecurity(persistence, opts) {
  opts = opts || {}
  this.persistence = persistence
  this.rulesKey = opts.rulesPath || "/_rules"
  this.ruleParser = new RuleParser()
  this.ruleRunner = new RuleRunner(this.persistence)
}
RuleTreeSecurity.prototype.setRules = function(user, rules, cb) {
  // also check the user has permission to set rules... or maybe out of scope of this?
  var self = this
  this.validateRuleSet(rules, function(err) {
    if (err) return cb(err)
    self.persistence.privateSet(self.rulesKey, rules, null, cb)
  })
}
RuleTreeSecurity.prototype.getRules = function(user, cb) {
  this.persistence.privateGet(this.rulesKey, cb)
}

RuleTreeSecurity.prototype.validateRuleSet = function(rules, cb) {
  if (rules.rules) rules = rules.rules
  var ruleArray = gatherRuleLeaves(rules)
  for (var i = 0; i < ruleArray.length; i++) {
    var ruleObj = ruleArray[i]
    if (ruleTypes.indexOf(ruleObj.ruleType) === -1) {
      return cb(new Error("Invalid rule type, must be on of " + ruleTypes.join(",")))
    }

    if (ruleObj.rule === false || ruleObj.rule === true) continue
    if (typeof ruleObj.rule !== "string") {
      return cb(new Error("Invalid rule, must be of type string or boolean"))
    }

    var err = this.ruleParser.validateRule(ruleObj.ruleType, ruleObj.rule, ruleObj.scopes)
    if (err) return cb(err)
  }
  cb()
}

RuleTreeSecurity.prototype.getAndRunRules = function(opType, user, key, val, cb) {
  var self = this
  this.persistence.privateGet(this.rulesKey, function(err, rules) {
    if (err) return cb(err)
    rules = treeUtils.collapseTree(rules) || defaultRules
    self.ruleRunner.runRules(opType, rules, user, key, val, cb)
  })
}

RuleTreeSecurity.prototype.canWrite = function(user, key, val, cb) {
  this.getAndRunRules("write", user, key, val, cb)
}

// reads are similiar to above, but we don't need to worry about validate rules
RuleTreeSecurity.prototype.canRead = function(user, key, cb) {
  this.getAndRunRules("read", user, key, null, cb)
}

RuleTreeSecurity.prototype.getRoutes = function() {
  var self = this
  return {
    post: {
      "/_rules": function(req, res, next) {
        var body = req.body
        if (typeof body !== "object") {
          return next(new Error("expected body to be json"))
        }
        self.setRules(req.user, body, function(err, set) {
          if (err) return next(err)
          res.json(set)
        })
      }
    },
    get: {
      "/_rules": function(req, res, next) {
        self.getRules(req.user, function(err, rules) {
          if (err) return next(err)
          res.json(treeUtils.collapseTree(rules))
        })
      }
    }
  }

}

module.exports = RuleTreeSecurity
// finds all the leaves of a tree whose values aren't a hash
function gatherRuleLeaves(tree) {
  var rules = []
  var scopes = []
  gatherRuleCtx(tree, rules, scopes)
  return rules
}
function gatherRuleCtx(tree, rules, scopes) {
  for (var key in tree) {
    if (typeof tree[key] !== "object") {
      rules.push({ruleType: key, rule: tree[key], scopes: arrToObj(scopes)})
    } else {
      if (key.charAt(0) === "$") {
        scopes.push(key)
      }
      // slice the scopes array so we get a different copy all the way down
      gatherRuleCtx(tree[key], rules, scopes.slice(0))
    }
  }
}
function arrToObj(arr) {
  var obj = {}
  arr.forEach(function(a) {
    obj[a] = true
  })
  return obj
}

