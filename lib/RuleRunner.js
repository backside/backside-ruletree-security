var async = require("async")
var vm = require("vm")
var FauxContext = require("./FauxContext")
var RuleString = require("./RuleString")
var treeUtils = require("backside-utils")


function RuleRunner(persistence) {
  this.persistence = persistence
}

RuleRunner.prototype.extractDataContexts = function(rulePath, rule, auth, scopes, newData, cb) {
  var self = this

  var fakeCxt = this.newContext(auth, scopes, newData)
  fakeCxt.root = new FauxContext(treeUtils.pathToArray("/"))
  fakeCxt.data = new FauxContext(treeUtils.pathToArray(rulePath))

  try {
    this.run(rule, fakeCxt)
  } catch (e) {
    return cb(e)
  }

  fakeCxt.data.buildContext(this.persistence, function(err, data) {
    if (err) return cb(err)
    fakeCxt.root.buildContext(self.persistence, function(err, root) {
      if (err) return cb(err)
      cb(null, {
        data: data,
        root: root
      })
    })
  })
}

RuleRunner.prototype.run = function(rule, context) {
  return vm.runInNewContext(RuleString.patch + rule, context)
}

RuleRunner.prototype.runRule = function(auth, scopes, newData, rule, cb) {
  var self = this
  // if the rule is a boolean, short circuit and just return the bool value
  if (typeof rule.rule === "boolean") {
    return cb(null, rule.rule)
  }
  var context = this.newContext(auth, scopes, newData)
  this.extractDataContexts(rule.path, rule.rule, auth, scopes, newData, function(err, cn) {
    if (err) return cb(err)
    context.data = cn.data || {}
    context.root = cn.root || {}
    var res = null
    try {
      res = self.run(rule.rule, context)
    } catch (e) {
      return cb(e)
    }
    cb(err, res)
  })
}

RuleRunner.prototype.runRules = function(opType, rules, user, key, val, cb) {
  var self = this
  var extractedRules = this.extractRules(rules, key, val)
  rules = null
  validationRules = []
  if (opType === "read") {
    rules = extractedRules.read
  } else {
    rules = extractedRules.write
    validationRules = extractedRules.validate
  }
  var scopes = extractedRules.scopes
  function rulePasses(r, acb) {
    self.runRule(user, scopes, val, r, function(err, res) {
      if (err) return cb(err)
      acb(res)
    })
  }
  async.some(rules, rulePasses, function(passes) {
    if (!passes) return cb(null, passes)
    async.every(validationRules, rulePasses, function(passes) {
      cb(null, passes)
    })
  })
}

RuleRunner.prototype.newContext = function(auth, scopes, newData) {
  var context = {
    now: Date.now(),
    auth: auth,
    newData: newData,
    beginsWith: RuleString.beginsWith,
    endsWith: RuleString.endsWith
  }

  scopes.forEach(function(s) {
    context[s.scope] = s.val
  })

  return context
}

RuleRunner.prototype.extractRules = function(rules, key, val) {
  // don't want to include split before first slash
  var paths = treeUtils.pathToArray(key)
  var writes = []
  var reads = []
  var validators = []
  var scopes = []
  var ptr = rules.rules
  var pathSoFar = []
  while (ptr) {
    var wildKey = false
    for (var key in ptr) {
      if (key === "_write") {
        writes.push({rule: ptr[key], path: treeUtils.arrayToPath(pathSoFar)})
      }
      if (key === "_read") {
        reads.push({rule: ptr[key], path: treeUtils.arrayToPath(pathSoFar)})
      }
      if (key === "_validate") {
        validators.push({rule: ptr[key], path: treeUtils.arrayToPath(pathSoFar)})
      }
      if (key.charAt(0) === "$") {
        // get the next key out of the path
        var scopePath = pathSoFar.slice(0)
        var maskedKey = paths[0]
        scopePath.push(maskedKey)
        scopes.push({scope: key, path: treeUtils.arrayToPath(scopePath), val: maskedKey})
        wildKey = key
      }
    }
    var nextPath = paths.shift()
    pathSoFar.push(nextPath)
    // if we already went through all the paths, then its
    // time to break out
    if (nextPath === undefined) {
      break
    }
    if (ptr[nextPath]) {
      ptr = ptr[nextPath]
    } else if (wildKey) {
      ptr = ptr[wildKey]
    } else {
      ptr = null
    }
  }
  if (ptr) {
    this.getValidators(ptr, val, pathSoFar, validators)
  }
  return {
    write: writes,
    read: reads,
    validate: validators,
    scopes: scopes
  }
}

RuleRunner.prototype.getValidators = function(tree, val, pathSoFar, array) {
  for (var key in val) {
    if (tree[key] && tree[key]["_validate"]) {
      array.push({rule: tree[key]["_validate"], path: treeUtils.arrayToPath(pathSoFar)})
    }
    if (typeof val[key] === "object") {
      var psf = pathSoFar.slice(0)
      psf.push(key)
      this.getValidators(tree[key], val[key], psf, array)
    }
  }
}
module.exports = RuleRunner

