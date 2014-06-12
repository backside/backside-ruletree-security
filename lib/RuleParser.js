var esprima = require("esprima")

function RuleParser() {}

var calls = {
  val: { ret: "literal", valid: "data" },
  child: { ret: "data", valid: "data", arg: "string"},
  parent: { ret: "data", valid: "data" },
  hasChild: { ret: "boolean", valid: "data", arg: "sring" },
  hasChildren: { ret: "boolean", valid: "data", arg: "array" },
  exists: { ret: "boolean", valid: "data" },
  getPriority: { ret: "number", valid: "data" },
  isNumber: { ret: "boolean", valid: "data" },
  isString: { ret: "boolean", valid: "data" },
  isBoolean: { ret: "boolean", valid: "data" },
  contains: { ret: "boolean", valid: "string", arg: "string" },
  beginsWith: { ret: "boolean", valid: "string", arg: "string" },
  endsWith: { ret: "boolean", valid: "string", arg: "string" },
  replace: { ret: "string", valid: "string" , arg: "string" },
  toLowerCase: { ret: "string", valid: "string" },
  toUpperCase: { ret: "string", valid: "string" },
  length: { ret: "number", valid: "string", call: false }
}

var whereValid = {
  all : {_read: true, _write: true, _valididate: true},
  noRead : {_write: true, _validate: true}
}

var validVars = {
  auth: { type: "object", validIn: whereValid.all },
  now: { type: "number", validIn: whereValid.all },
  root: { type: "data", validIn: whereValid.all },
  data: { type: "data", validIn: whereValid.all },
  newData: { type: "data", validIn: whereValid.noRead }
}

var ops = {
  "==" : "boolean",
  "===" : "boolean",
  "!=" : "boolean",
  "!==" : "boolean",
  "&&" : "boolean",
  "||" : "boolean",
  "!" : "boolean",
  "<" : "boolean",
  "<=" : "boolean",
  ">" : "boolean",
  ">=" : "boolean",
  "+" : "number",
  "-" : "number",
  "*" : "number",
  "/" : "number",
  "%" : "number"
}

RuleParser.prototype.getCalleeName = function(callee) {
  if (callee.type === "Identifier") {
    return callee.name
  } else if (callee.type === "Literal") {
    return callee.value
  } else if (callee.type === "MemberExpression") {
    if (callee.computed) {
      throw new Error("Invalid expression, can not dynamically acces property")
    }
    return this.getCalleeName(callee.property)
  } else {
    throw new Error("I probably screwed up...")
  }
}

RuleParser.prototype.getType = function(arg, opType, scopes) {
  if (arg.type === "Identifier") {
    if (scopes[arg.name]) {
      return "string"
    }
    var varInfo = validVars[arg.name]
    if (!varInfo) {
      throw new Error("Unknown variable " + arg.name)
    }
    if (!varInfo.validIn[opType]) {
      throw new Error("Variable " + arg.name + " invalid in " + opType)
    }
    return varInfo.type
  } else if (arg.type === "Literal") {
    return typeof arg.value
  } else if (arg.type === "ArrayExpression") {
    return "array"
  } else if (arg.type === "MemberExpression") {
    var objType = this.getType(arg.object, opType, scopes)
    // small hack for dealing with object types, assuming all properties are strings
    if (objType === "object") {
      return "string"
    }
    var call = this.getCalleeName(arg.property)
    var callInfo = calls[call]
    if (!callInfo) {
        throw new Error("Unknown property " + call)
    }
    return callInfo.ret
  } else if (arg.type === "CallExpression") {
    this.checkCalls(opType, arg.calleee, scopes)
    return this.getType(arg.callee, opType, scopes)
  }
}

RuleParser.prototype.checkCallingObject = function(opType, callee, scopes) {
  if (callee.type === "Literal") {
    // nothing here
  } else if (callee.type === "Identifier") {
    if (scopes[callee.name]) return
    var varInfo = validVars[callee.name]
    if (!varInfo) {
      throw new Error("Unknown variable " + callee.name)
    }
    if (!varInfo.validIn[opType]) {
      throw new Error("Variable " + callee.name + " invalid in " + opType)
    }
  } else if (callee.type === "MemberExpression") {
    this.checkCallingObject(opType, callee.object, scopes)
  } else if (callee.type === "CallExpression") {

  } else {
    throw new Error("I probably screwed up..." + callee.type )
  }

}

RuleParser.prototype.checkCalls = function(opType, tree, scopes) {
  this.checkCallingObject(opType, tree.callee, scopes)
  var call = this.getCalleeName(tree.callee)
  var callInfo = calls[call]
  if (!callInfo) {
      throw new Error("Unknown property " + call)
  }
  if (callInfo.call === false) {
    throw new Error("property can not be called as a function")
  }
  // currently, all functions to zero or no args
  var expectedArgs = callInfo.arg ? 1 : 0
  if (tree.arguments.length !== expectedArgs) {
    throw new Error("function expected " + expectedArgs + " argument(s)")
  }
  if (expectedArgs) {
    if (callInfo.arg !== this.getType(tree.arguments[0], opType, scopes)) {
      throw new Error("argument is an invalid type, expected " + callInfo.arg)
    }
  }
}

RuleParser.prototype.checkMember = function(opType, tree, scopes) {
  // have string
  this.checkNodes(opType, tree.object, scopes, "object")
  if (tree.object.type === "Literal") {
    this.checkNodes(opType, tree.property, scopes, "property")
  } else if (tree.object.type === "CallExpression") {
    this.checkCalls(opType, tree.object, scopes)
  } else {
    if (tree.object.type !== "Identifier") {
      throw new Error("Unexpected expression")
    }
    // we don't need to check auth, it can have arbitrary stuff
    if (tree.object.name !== "auth") {
      this.checkNodes(opType, tree.property, scopes, "property")
    }
  }
}

RuleParser.prototype.checkIdent = function(opType, tree, scopes, part, type) {
  if (part === "property") {
    if (!calls[tree.name] ||(calls[tree.name] && calls[tree.name].valid !== type)) {
      throw new Error("Unknown property " + tree.name)
    }
  } else if (part === "callee") {
    throw new Error("Property " + tree.name + " is not a function")
  } else {
    var varScope = validVars[tree.name]
    if (!varScope && !scopes[tree.name]) {
      throw new Error("Unknown variable " + tree.name)
    }
    if (opType === "read" && opType !== "read") {
      throw new Error("Unknown variable " + tree.name)
    }
  }
}

RuleParser.prototype.checkLiteral = function(opType, tree, scopes, part, type) {
  if (part === "property") {
    if (!calls[tree.value] ||(calls[tree.value] && calls[tree.value].valid !== type)) {
      throw new Error("Unknown property " + tree.value)
    }
  }
}

RuleParser.prototype.checkNodes = function(opType, tree, scopes, part, type) {
  var type = tree.type
  if (type === "ExpressionStatement") {
    this.checkNodes(opType, tree.expression, scopes)
  } else if (type === "LogicalExpression" || type === "BinaryExpression") {
    if (!ops[tree.operator]) {
      throw new Error("Invalid operator " + tree.operator)
    }
    this.checkNodes(opType, tree.left, scopes, "left")
    this.checkNodes(opType, tree.right, scopes, "right")
  } else if (type === "UnaryExpression") {
    if (!ops[tree.operator]) {
      throw new Error("Invalid operator " + tree.operator)
    }
    this.checkNodes(opType, tree.argument, scopes)
  } else if (type === "CallExpression") {
    this.checkCalls(opType, tree, scopes)
  } else if (type === "MemberExpression") {
    this.checkMember(opType, tree, scopes)
  } else if (type === "Identifier") {
    this.checkIdent(opType, tree, scopes, part, type)
  } else if (type === "Literal") {
    this.checkLiteral(opType, tree, scopes, part, type)
  }
}

RuleParser.prototype.ensureBoolReturn = function(tree) {
  if (tree.type === "BinaryExpression" && ops[tree.operator] === "boolean") {
    return true
  }
  if (tree.type === "LogicalExpression") {
    return true
  }
  if (tree.type === "CallExpression") {
    var callName = this.getCalleeName(tree.callee)
    return calls[callName].ret === "boolean"
  }
  return false
}

RuleParser.prototype.validateRule = function(type, rule, scopes) {
  scopes = scopes || {}
  var ast = null
  try {
    var ast = esprima.parse(rule)
  } catch (e) {
    return e
  }
  if (ast.body.length === 0) return new Error("No expression provided")
  if (ast.body.length > 1) return new Error("Multiple expressions provided, invalid")
  var exp = ast.body[0]
  try {
    this.checkNodes(type, exp, scopes)
  } catch (e) {
    return e
  }
  if (!this.ensureBoolReturn(exp.expression)) {
    return new Error("Expression does not result in boolean return")
  }
  return null
}

module.exports = RuleParser
