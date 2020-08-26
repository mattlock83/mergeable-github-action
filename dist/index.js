module.exports =
/******/ (function(modules, runtime) { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete installedModules[moduleId];
/******/ 		}
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	__webpack_require__.ab = __dirname + "/";
/******/
/******/ 	// the startup function
/******/ 	function startup() {
/******/ 		// Load entry module and return exports
/******/ 		return __webpack_require__(578);
/******/ 	};
/******/
/******/ 	// run startup
/******/ 	return startup();
/******/ })
/************************************************************************/
/******/ ({

/***/ 38:
/***/ (function(module, __unusedexports, __webpack_require__) {

const yaml = __webpack_require__(707)
const _ = __webpack_require__(356)

class Configuration {
  constructor (settings) {
    this.errors = new Map()
    this.warnings = new Map()
    if (settings === undefined) {
      return // intentionally return since there's not much more we can do.
    }

    this.settings = settings

    this.validate()
    if (this.errors.size > 0) return

    const version = this.checkConfigVersion()

    // Can't use variables within a require statement using NCC distribution
    if (version === 2) {
      this.settings = (__webpack_require__(110).transform(this.settings))
    } else {
      this.settings = (__webpack_require__(877).transform(this.settings))
    }
    this.settings = this.settings.mergeable
  }

  hasErrors () {
    return (this.errors.size > 0)
  }

  checkConfigVersion () {
    if (!this.settings.version) return 1
    return (this.settings.version)
  }

  validate () {
    if (this.settings.version && typeof this.settings.version !== 'number') {
      this.errors.set(
        ERROR_CODES.UNKOWN_VERSION,
        ERROR_MESSAGES.UNKNOWN_VERSION
      )
    }
    if (this.settings.mergeable === undefined) {
      this.errors.set(
        ERROR_CODES.MISSING_MERGEABLE_NODE,
        ERROR_MESSAGES.MISSING_MERGEABLE_NODE
      )
      return
    }

    if (this.settings.mergeable === null) {
      this.errors.set(
        ERROR_CODES.MISSING_RULE_SETS,
        ERROR_MESSAGES.MISSING_RULE_SETS
      )
      return
    }

    if (this.checkConfigVersion() === 2) {
      if (!_.isArray(this.settings.mergeable)) {
        this.errors.set(
          ERROR_CODES.NON_ARRAY_MERGEABLE,
          ERROR_MESSAGES.NON_ARRAY_MERGEABLE
        )
        return
      }

      this.settings.mergeable.forEach(ruleSet => {
        if (_.isUndefined(ruleSet.when)) {
          this.errors.set(
            ERROR_CODES.MISSING_WHEN_KEYWORD,
            ERROR_MESSAGES.MISSING_WHEN_KEYWORD
          )
        }
        if (_.isUndefined(ruleSet.validate)) {
          this.errors.set(
            ERROR_CODES.MISSING_VALIDATE_KEYWORD,
            ERROR_MESSAGES.MISSING_VALIDATE_KEYWORD
          )
          return
        }

        if (!_.isArray(ruleSet.validate)) {
          this.errors.set(
            ERROR_CODES.NON_ARRAY_VALIDATE,
            ERROR_MESSAGES.NON_ARRAY_VALIDATE
          )
        }
      })
    }
  }

  static async fetchConfigFile (context) {
    let github = context.github
    let repo = context.repo()

    if (['pull_request', 'pull_request_review'].includes(context.event)) {
      // get modified file list
      let result = await context.github.paginate(
        context.github.pulls.listFiles.endpoint.merge(
          context.repo({ pull_number: context.payload.pull_request.number })
        ),
        res => res.data
      )

      let modifiedFiles = result
        .filter(file => ['modified', 'added'].includes(file.status))
        .map(file => file.filename)

      // check if config file is in that list
      if (modifiedFiles.includes(Configuration.FILE_NAME)) {
        // if yes return, return below else do nothing
        return github.repos.getContents({
          owner: repo.owner,
          repo: repo.repo,
          path: Configuration.FILE_NAME,
          ref: context.payload.pull_request.head.sha
        }).then(response => {
          return yaml.safeLoad(Buffer.from(response.data.content, 'base64').toString())
        })
      }
    }

    // probotContext.config loads config from current repo or from a repo called
    // '.github' in the same organisation as a fallback. It returns the parsed YAML object.

    const configPath = process.env.CONFIG_PATH ? process.env.CONFIG_PATH : 'mergeable.yml'
    const config = await context.probotContext.config(configPath)
    if (config === null || config === undefined) {
      throw new ConfigFileNotFoundException('Could not find config file.')
    }

    return config
  }

  static instanceWithContext (context) {
    return Configuration.fetchConfigFile(context).then(config => {
      return new Configuration(config)
    }).catch(error => {
      let config = new Configuration()
      if (error instanceof ConfigFileNotFoundException) {
        config.errors.set(ERROR_CODES.NO_YML, `No Config File found`)
      } else if (error instanceof yaml.YAMLException) {
        config.errors.set(ERROR_CODES.BAD_YML, `Invalid YML format > ${error.message}`)
      } else {
        const errorMsg = `Github API Error occurred while fetching the config file at ${Configuration.FILE_NAME} \n Error from api: ${error}`
        config.errors.set(ERROR_CODES.GITHUB_API_ERROR, errorMsg)
      }
      return config
    })
  }
}

class ConfigFileNotFoundException extends Error {}

Configuration.FILE_NAME = '.github/mergeable.yml'
Configuration.DEFAULTS = {
  stale: {
    message: 'There haven\'t been much activity here. This is stale. Is it still relevant? This is a friendly reminder to please resolve it. :-)'
  }
}
const ERROR_CODES = {
  BAD_YML: 10,
  MISSING_MERGEABLE_NODE: 20,
  UNKOWN_VERSION: 30,
  CONFIG_NOT_FOUND: 40,
  GITHUB_API_ERROR: 50,
  NO_YML: 60,
  MISSING_RULE_SETS: 70,
  NON_ARRAY_MERGEABLE: 80,
  MISSING_WHEN_KEYWORD: 90,
  MISSING_VALIDATE_KEYWORD: 100,
  NON_ARRAY_VALIDATE: 110
}
Configuration.ERROR_CODES = ERROR_CODES
const ERROR_MESSAGES = {
  MISSING_MERGEABLE_NODE: 'The `mergeable` node is missing.',
  MISSING_RULE_SETS: '`mergeable` node does not contain any rule sets',
  NON_ARRAY_MERGEABLE: '`mergeable` must be an array for version 2 config',
  MISSING_WHEN_KEYWORD: 'One or more rule set is missing `when` keyword',
  MISSING_VALIDATE_KEYWORD: 'One or more rule set is missing `validate` keyword',
  NON_ARRAY_VALIDATE: '`validate` must be an array of rules',
  UNKNOWN_VERSION: 'Invalid `version` found.'
}

module.exports = Configuration


/***/ }),

/***/ 52:
/***/ (function(module) {

module.exports = eval("require")("probot-actions-adapter");


/***/ }),

/***/ 64:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Action } = __webpack_require__(394)
const UnSupportedSettingError = __webpack_require__(894)

const MERGE_METHOD_OPTIONS = ['merge', 'rebase', 'squash']

const checkIfMerged = async (context, prNumber) => {
  let status = true

  // return can be 204 or 404 only
  try {
    await context.github.pulls.checkIfMerged(
      context.repo({ pull_number: prNumber })
    )
  } catch (err) {
    if (err.status === 404) {
      status = false
    } else {
      throw err
    }
  }

  return status
}

class Merge extends Action {
  constructor () {
    super('merge')
    this.supportedEvents = [
      'pull_request.*'
    ]

    this.supportedSettings = {
      merge_method: 'string'
    }
  }

  // there is nothing to do
  async beforeValidate () {}

  async afterValidate (context, settings, results) {
    const prNumber = this.getPayload(context).number
    const isMerged = await checkIfMerged(context, prNumber)

    if (!isMerged) {
      if (settings.merge_method && !MERGE_METHOD_OPTIONS.includes(settings.merge_method)) {
        throw new UnSupportedSettingError(`Unknown Merge method, supported options are ${MERGE_METHOD_OPTIONS.join(', ')}`)
      }
      let mergeMethod = settings.merge_method ? settings.merge_method : 'merge'
      try {
        await context.github.pulls.merge(context.repo({ pull_number: prNumber, merge_method: mergeMethod }))
      } catch (err) {
        // skip on known errors
        // 405 === Method not allowed , 409 === Conflict
        if (err.status === 405 || err.status === 409) {
          throw new Error(`Merge failed! error : err`)
        } else {
          throw err
        }
      }
    }
  }
}

module.exports = Merge


/***/ }),

/***/ 67:
/***/ (function(module) {

module.exports = eval("require")("node-fetch");


/***/ }),

/***/ 74:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)

class Label extends Validator {
  constructor () {
    super('label')
    this.supportedEvents = [
      'pull_request.opened',
      'pull_request.edited',
      'pull_request_review.submitted',
      'pull_request_review.edited',
      'pull_request_review.dismissed',
      'pull_request.labeled',
      'pull_request.milestoned',
      'pull_request.demilestoned',
      'pull_request.assigned',
      'pull_request.unassigned',
      'pull_request.unlabeled',
      'pull_request.synchronize',
      'pull_request.push_synchronize',
      'issues.*'
    ]
    this.supportedSettings = {
      no_empty: {
        enabled: 'boolean',
        message: 'string'
      },
      must_include: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string'
      },
      must_exclude: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string'
      },
      begins_with: {
        match: ['string', 'array'],
        message: 'string'
      },
      ends_with: {
        match: ['string', 'array'],
        message: 'string'
      },
      min: {
        count: 'number',
        message: 'string'
      },
      max: {
        count: 'number',
        message: 'string'
      }
    }
  }

  async validate (context, validationSettings) {
    let labels = await context.github.issues.listLabelsOnIssue(
      context.repo({ issue_number: this.getPayload(context).number })
    )

    return this.processOptions(
      validationSettings,
      labels.data.map(label => label.name)
    )
  }
}

module.exports = Label


/***/ }),

/***/ 79:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)
const minimatch = __webpack_require__(955)
const consolidateResult = __webpack_require__(136)
const constructOutput = __webpack_require__(406)

const DEFAULT_SUCCESS_MESSAGE = 'Your Contents passes validations'
const VALIDATOR_CONTEXT = { name: 'contents' }

class Contents extends Validator {
  constructor () {
    super('contents')
    this.supportedEvents = [
      'pull_request.*',
      'pull_request_review.*'
    ]
    this.supportedSettings = {
      files: {
        pr_diff: 'boolean',
        ignore: 'array'
      },
      must_include: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string'
      },
      must_exclude: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string'
      },
      begins_with: {
        match: ['string', 'array'],
        message: 'string'
      },
      ends_with: {
        match: ['string', 'array'],
        message: 'string'
      }
    }
  }

  async validate (context, validationSettings) {
    let fileOptions = null
    let patternsToIgnore = ['.github/mergeable.yml']

    let parseOption = validationSettings

    if (validationSettings.files) {
      fileOptions = validationSettings.files
      if (fileOptions.ignore) patternsToIgnore = fileOptions.ignore
      delete parseOption.files
    }

    let result = await context.github.paginate(
      context.github.pulls.listFiles.endpoint.merge(
        context.repo({ pull_number: this.getPayload(context).number })
      ),
      res => res.data
    )
    let changedFiles = result
      .filter(file => !matchesIgnoredPatterns(file.filename, patternsToIgnore))
      .filter(file => file.status === 'modified' || file.status === 'added')
      .map(file => file.filename)

    let failedFiles = []
    for (let file of changedFiles) {
      const content = await getContent(context, file)

      if (content === null) {
        failedFiles.push(`${file} (Not Found)`)
        continue
      }

      const processed = this.processOptions(parseOption, content)
      if (processed.status === 'error') return processed
      if (processed.status === 'fail') failedFiles.push(file)
    }

    const isMergeable = failedFiles.length === 0
    const output = [constructOutput(VALIDATOR_CONTEXT, changedFiles, validationSettings, {
      status: isMergeable ? 'pass' : 'fail',
      description: isMergeable ? DEFAULT_SUCCESS_MESSAGE : `Failed files : '${failedFiles.join(',')}'`
    })]

    return consolidateResult(output, VALIDATOR_CONTEXT)
  }
}

const matchesIgnoredPatterns = (filename, patternsToIgnore) => (
  patternsToIgnore.some((ignorePattern) => minimatch(filename, ignorePattern))
)

const getContent = async (context, path) => {
  return context.github.repos.getContents(context.repo({
    path: path,
    ref: context.payload.pull_request.head.sha
  })).then(res => {
    return Buffer.from(res.data.content, 'base64').toString()
  }).catch(error => {
    if (error.code === 404) return null
    else throw error
  })
}

module.exports = Contents


/***/ }),

/***/ 80:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)
const andOrValidatorProcessor = __webpack_require__(233)

class And extends Validator {
  constructor () {
    super('and')
    this.supportedEvents = [
      '*'
    ]
    this.supportedOptions = [
      'validate'
    ]
    this.supportedSettings = {}
  }

  async validate (context, validationSettings, registry) {
    return andOrValidatorProcessor(context, validationSettings.validate, registry, 'And')
  }

  // skip validating settings
  validateSettings (supportedSettings, settingToCheck) {}
}

module.exports = And


/***/ }),

/***/ 97:
/***/ (function(module) {

class EventAware {
  /**
   * @param eventName
   *  An event name to be evaluated for support. The name is as in the GitHub
   *  webhook format of issues.opened, pull_request.opened, etc
   *
   * @return boolean true if the EventAware object supports the event. i.e. issues.opened
   */
  isEventSupported (eventName) {
    let eventObject = eventName.split('.')[0]
    let relevantEvent = this.supportedEvents.filter(event => event.split('.')[0] === eventObject || event === '*')
    return relevantEvent.indexOf('*') > -1 ||
      relevantEvent.indexOf(`${eventObject}.*`) > -1 ||
      relevantEvent.indexOf(eventName) > -1
  }

  getPayload (context) {
    if (context.event === 'issues') { // event name is 'issues' but payload contain 'issue'
      return context.payload['issue']
    } else if (context.event === 'pull_request_review') {
      return context.payload['pull_request']
    } else {
      return context.payload[context.event]
    }
  }
}

module.exports = EventAware


/***/ }),

/***/ 110:
/***/ (function(module, __unusedexports, __webpack_require__) {

const _ = __webpack_require__(356)
const consts = __webpack_require__(327)

class V2Config {
  static transform (config) {
    let transformedConfig = _.cloneDeep(config)
    setPullRequestDefault(transformedConfig)
    return transformedConfig
  }
}

const checkAndSetDefault = (ruleSet, defaultValue) => {
  if (ruleSet === undefined) {
    return defaultValue
  } else {
    return ruleSet.map(rule => {
      if (rule.do === 'checks') {
        const newRule = _.cloneDeep(rule)
        if (_.isUndefined(newRule.status)) newRule.status = defaultValue[0].status
        if (_.isUndefined(newRule.payload)) {
          newRule.payload = defaultValue[0].payload
        } else {
          if (_.isUndefined(newRule.payload.title)) newRule.payload.title = defaultValue[0].payload.title
          if (_.isUndefined(newRule.payload.summary)) newRule.payload.summary = defaultValue[0].payload.summary
        }
        return newRule
      }

      return rule
    })
  }
}

const setPullRequestDefault = (config) => {
  config.mergeable.forEach((recipe) => {
    if (recipe.when.includes('pull_request')) {
      if (!checkIfDefaultShouldBeApplied(recipe)) {
        if (recipe.pass === undefined) {
          recipe.pass = []
        }
        if (recipe.fail === undefined) {
          recipe.fail = []
        }
        if (recipe.error === undefined) {
          recipe.error = []
        }
        return
      }
      recipe.pass = checkAndSetDefault(recipe.pass, consts.DEFAULT_PR_PASS)
      recipe.fail = checkAndSetDefault(recipe.fail, consts.DEFAULT_PR_FAIL)
      recipe.error = checkAndSetDefault(recipe.error, consts.DEFAULT_PR_ERROR)
    } else {
      if (recipe.pass === undefined) {
        recipe.pass = []
      }
      if (recipe.fail === undefined) {
        recipe.fail = []
      }
      if (recipe.error === undefined) {
        recipe.error = []
      }
    }
  })
}

const checkIfDefaultShouldBeApplied = (recipe) => {
  if (recipe.pass === undefined && recipe.fail === undefined && recipe.error === undefined) return true

  // if any of the cases include 'check', then others should have `check' default as well, otherwise, don't do anything
  if (checkIfCheckActionExists(recipe.pass)) return true
  if (checkIfCheckActionExists(recipe.fail)) return true
  if (checkIfCheckActionExists(recipe.error)) return true
}

const checkIfCheckActionExists = (outcome) => {
  if (_.isUndefined(outcome) || outcome === null) return false
  return outcome.find(element => element.do === 'checks')
}

module.exports = V2Config


/***/ }),

/***/ 122:
/***/ (function(module, __unusedexports, __webpack_require__) {

const getValidatorPromises = __webpack_require__(770)
const getActionPromises = __webpack_require__(481)
const consolidateResult = __webpack_require__(136)
const constructErrorOutput = __webpack_require__(958)
const Register = __webpack_require__(187)
const extractValidationStats = __webpack_require__(126)
const Checks = __webpack_require__(543)
const Comment = __webpack_require__(175)
const _ = __webpack_require__(356)

const logger = __webpack_require__(410)

const processWorkflow = async (context, registry, config) => {
  let log = logger.create('flex')
  // go through the settings and register all the validators
  try {
    Register.registerValidatorsAndActions(config.settings, registry)
  } catch (err) {
    let evt = `${context.event}.${context.payload.action}`
    let checks = new Checks()
    if (checks.isEventSupported(evt)) {
      checks.run({
        context: context,
        payload: {
          status: 'completed',
          conclusion: 'cancelled',
          output: {
            title: 'Invalid Validators or Actions',
            summary: `${err}`
          },
          completed_at: new Date()
        }
      })
    }
  }

  // do pre validation actions
  await processPreActions(context, registry, config)

  for (const rule of config.settings) {
    if (isEventInContext(rule.when, context)) {
      const result = await Promise.all(getValidatorPromises(context, registry, rule)).catch((err) => {
        const unknownErrorLog = {
          log_type: logger.logTypes.UNKNOWN_ERROR_VALIDATOR,
          errors: err.toString(),
          repo: context.payload.repository.full_name,
          event: `${context.event}.${context.payload.action}`,
          settings: JSON.stringify(config.settings)
        }
        log.error(unknownErrorLog)

        return Promise.resolve([consolidateResult(
          [
            constructErrorOutput(
              'An error occured',
              '',
              {},
              'Internal error!',
              'This is a mergeable bug, please report it on our issue tracker: https://github.com/mergeability/mergeable/issues/new\n\n' +
              '```\n' + (err.stack ? err.stack : err.toString()) + '\n```\n\n'
            )
          ],
          {name: 'Internal error'}
        )])
      })

      const translatedOutput = extractValidationStats(result)
      const promises = getActionPromises(context, registry, rule, translatedOutput)
      if (promises) {
        let errorOccurred = false

        const event = `${context.event}.${context.payload.action}`
        const comment = new Comment()

        await Promise.all(promises).catch((err) => {
          errorOccurred = true
          const payload = {
            body: '####  :x: Error Occurred while executing an Action \n\n ' +
              'If you believe this is an unexpected error, please report it on our issue tracker: https://github.com/mergeability/mergeable/issues/new \n' +
              '##### Error Details \n' +
              '-------------------- \n' +
              `${err.toString()}`
          }

          const unknownErrorLog = {
            log_type: logger.logTypes.UNKNOWN_ERROR_ACTION,
            errors: err.toString(),
            repo: context.payload.repository.full_name,
            event: `${context.event}.${context.payload.action}`,
            settings: JSON.stringify(config.settings)
          }
          log.error(unknownErrorLog)
          if (comment.isEventSupported(event)) {
            comment.handleError(context, payload)
          }
        })

        if (!errorOccurred && comment.isEventSupported(event)) await comment.removeErrorComments(context)
      }
    }
  }
}

// call all action classes' beforeValidate, regardless of whether they are in failure or pass situation
const processPreActions = async (context, registry, config) => {
  let promises = []

  config.settings.forEach(rule => {
    if (isEventInContext(rule.when, context)) {
      // get actions within this rule
      const actions = extractAllActionFromRecipe(rule)
      // for each action, do the following
      actions.forEach(action => {
        if (registry.actions.get(action).isEventSupported(`${context.event}.${context.payload.action}`)) {
          promises.push(registry.actions.get(action).processBeforeValidate(context, rule, rule.name))
        }
      })
    }
  })

  await Promise.all(promises)
}

const extractAllActionFromRecipe = (recipe) => {
  let passActions = recipe.pass ? recipe.pass.map(action => action.do) : []
  let failActions = recipe.fail ? recipe.fail.map(action => action.do) : []
  let errorActions = recipe.error ? recipe.error.map(action => action.do) : []

  let action = _.union(passActions, failActions)
  action = _.union(action, errorActions)

  return action
}

const isEventInContext = (event, context) => {
  let eventArray = event.split(', ')
  let contextEvent = `${context.event}.${context.payload.action}`
  let found = eventArray.find(element => {
    if (element.split('.')[1] === '*') {
      return element.split('.')[0] === context.event
    } else {
      return element === contextEvent
    }
  })

  return !!found
}

module.exports = processWorkflow


/***/ }),

/***/ 126:
/***/ (function(module) {

/**
 * extract validation stats to be used in populating the output template using handlebars
 *
 * The following Values are extracted
 *
 * validationStatus OverAll status of the valiations
 * validationCount Num of Validations ran
 * passCount Num of validations passed
 * failureCount Num of validations failed
 * errorCount Num of validations errored
 * validations : [{
 *  validatorName: // Validator that was run
 *  status: 'pass|fail|error'
 *  description: 'Defaul or custom Message'
 *  details {
 *    input: // input the tests are run against
 *    setting: rule
 *  }]
 * }
 *
 */
module.exports = (results) => {
  const validationStatuses = results.map(result => result.status)
  const passCount = validationStatuses.filter(status => status === 'pass').length
  const failCount = validationStatuses.filter(status => status === 'fail').length
  const errorCount = validationStatuses.filter(status => status === 'error').length
  let validationStatus = 'pass'

  if (errorCount > 0) {
    validationStatus = 'error'
  } else if (failCount > 0) {
    validationStatus = 'fail'
  }

  const output = {
    validationStatus,
    validationCount: validationStatuses.length,
    passCount,
    failCount,
    errorCount,
    validationSuites: results
  }

  return output
}


/***/ }),

/***/ 136:
/***/ (function(module) {

/**
 * Consolidate Results
 * Take all the result from individual tests and determine whether or not test suite passed
 *
 */
module.exports = (result, validatorContext) => {
  let status = 'pass'
  let tests = []

  result.forEach(res => {
    if (res.status === 'fail' && status !== 'error') {
      status = 'fail'
    }
    if (res.status === 'error') {
      status = 'error'
    }

    tests.push(res)
  })

  return {status: status, name: validatorContext.name, validations: tests}
}


/***/ }),

/***/ 148:
/***/ (function(module) {

module.exports = eval("require")("handlebars");


/***/ }),

/***/ 169:
/***/ (function(module) {

const REGEX_NOT_FOUND_ERROR = `Failed to run the test because 'regex' is not provided for 'must_exclude' option. Please check README for more information about configuration`
const UNKNOWN_INPUT_TYPE_ERROR = `Input type invalid, expected either string or array of string as input`

class MustExclude {
  static process (validatorContext, input, rule) {
    const filter = rule.must_exclude

    const regex = filter['regex']
    let description = filter['message']
    if (!regex) {
      throw new Error(REGEX_NOT_FOUND_ERROR)
    }

    let isMergeable

    const DEFAULT_SUCCESS_MESSAGE = `${validatorContext.name} ${filter.all ? 'all' : ''}must exclude '${regex}'`
    if (!description) description = `${validatorContext.name} ${filter.all ? 'all' : ''}does not exclude "${regex}"`
    let regexObj

    try {
      let regexFlag = 'i'
      if (filter.regex_flag) {
        regexFlag = filter.regex_flag === 'none' ? '' : filter.regex_flag
      }

      regexObj = new RegExp(regex, regexFlag)
    } catch (err) {
      throw new Error(`Failed to create a regex expression with the provided regex: ${regex}`)
    }

    if (typeof input === 'string') {
      isMergeable = !regexObj.test(input)
    } else if (Array.isArray(input)) {
      if (filter.all) {
        isMergeable = input.every(label => !regexObj.test(label))
      } else {
        isMergeable = !input.some(label => regexObj.test(label))
      }
    } else {
      throw new Error(UNKNOWN_INPUT_TYPE_ERROR)
    }

    return {
      status: isMergeable ? 'pass' : 'fail',
      description: isMergeable ? DEFAULT_SUCCESS_MESSAGE : description
    }
  }
}

module.exports = MustExclude


/***/ }),

/***/ 175:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Action } = __webpack_require__(394)
const populateTemplate = __webpack_require__(615)
const _ = __webpack_require__(356)

const createComment = async (context, issueNumber, body) => {
  return context.github.issues.createComment(
    context.repo({ issue_number: issueNumber, body })
  )
}

const fetchCommentsByMergeable = async (context, issueNumber) => {
  const comments = await context.github.issues.listComments(
    context.repo({ issue_number: issueNumber })
  )

  const botName = process.env.APP_NAME ? process.env.APP_NAME : 'Mergeable'
  return comments.data.filter(comment => comment.user.login.toLowerCase() === `${botName.toLowerCase()}[bot]`)
}

const deleteOldComments = async (context, oldComments) => {
  for (let comment of oldComments) {
    await context.github.issues.deleteComment(
      context.repo({ comment_id: comment.id })
    )
  }
}

class Comment extends Action {
  constructor () {
    super('comment')
    this.supportedEvents = [
      'pull_request.*',
      'issues.*',
      'schedule.repository'
    ]
  }

  async handleError (context, payload) {
    const issueNumber = this.getPayload(context).number

    await this.removeErrorComments(context)

    return createComment(
      context,
      issueNumber,
      payload.body
    )
  }

  async removeErrorComments (context) {
    if (_.isUndefined(this.getPayload(context))) return
    const issueNumber = this.getPayload(context).number
    const oldComments = await fetchCommentsByMergeable(context, issueNumber)
    const errorComments = oldComments.filter(comment => comment.body.toLowerCase().includes('error'))

    return deleteOldComments(context, errorComments)
  }

  // there is nothing to do
  async beforeValidate () {}

  async afterValidate (context, settings, name, results) {
    if (!settings.leave_old_comment) {
      const oldComments = await fetchCommentsByMergeable(context, this.getPayload(context).number)
      await deleteOldComments(context, oldComments)
    }

    let scheduleResults = results.validationSuites && results.validationSuites[0].schedule
    let commentables = (scheduleResults)
      ? scheduleResults.issues.concat(scheduleResults.pulls)
      : [this.getPayload(context)]

    return Promise.all(
      commentables.map(issue => {
        createComment(
          context,
          issue.number,
          populateTemplate(settings.payload.body, results, this.getPayload(context))
        )
      })
    )
  }
}

module.exports = Comment


/***/ }),

/***/ 187:
/***/ (function(module, __unusedexports, __webpack_require__) {

function __ncc_wildcard$0 (arg) {
  if (arg === "and.js" || arg === "and") return __webpack_require__(80);
  else if (arg === "approvals.js" || arg === "approvals") return __webpack_require__(431);
  else if (arg === "assignee.js" || arg === "assignee") return __webpack_require__(713);
  else if (arg === "changeset.js" || arg === "changeset") return __webpack_require__(236);
  else if (arg === "commit.js" || arg === "commit") return __webpack_require__(371);
  else if (arg === "contents.js" || arg === "contents") return __webpack_require__(79);
  else if (arg === "dependent.js" || arg === "dependent") return __webpack_require__(862);
  else if (arg === "description.js" || arg === "description") return __webpack_require__(729);
  else if (arg === "label.js" || arg === "label") return __webpack_require__(74);
  else if (arg === "milestone.js" || arg === "milestone") return __webpack_require__(380);
  else if (arg === "or.js" || arg === "or") return __webpack_require__(803);
  else if (arg === "project.js" || arg === "project") return __webpack_require__(517);
  else if (arg === "size.js" || arg === "size") return __webpack_require__(915);
  else if (arg === "stale.js" || arg === "stale") return __webpack_require__(412);
  else if (arg === "title.js" || arg === "title") return __webpack_require__(502);
  else if (arg === "validator.js" || arg === "validator") return __webpack_require__(333);
}
function __ncc_wildcard$1 (arg) {
  if (arg === "action.js" || arg === "action") return __webpack_require__(394);
  else if (arg === "assign.js" || arg === "assign") return __webpack_require__(929);
  else if (arg === "checks.js" || arg === "checks") return __webpack_require__(543);
  else if (arg === "close.js" || arg === "close") return __webpack_require__(719);
  else if (arg === "comment.js" || arg === "comment") return __webpack_require__(175);
  else if (arg === "labels.js" || arg === "labels") return __webpack_require__(840);
  else if (arg === "merge.js" || arg === "merge") return __webpack_require__(64);
  else if (arg === "request_review.js" || arg === "request_review") return __webpack_require__(883);
  else if (arg === "results_as_review.js" || arg === "results_as_review") return __webpack_require__(549);
}
class Register {
  static registerValidators (rule, registry) {
    rule.validate.forEach(validation => {
      let key = validation.do

      if (!registry.validators.has(key)) {
        let Validator = __ncc_wildcard$0(key)
        registry.validators.set(key, new Validator())
      }
    })
  }
  static registerActions (rule, registry) {
    let possibleActions = []
    let outcomesToCheck = [rule.pass, rule.fail, rule.error]

    outcomesToCheck.forEach(actions => {
      if (actions) {
        possibleActions = possibleActions.concat(actions)
      }
    })

    possibleActions.forEach(action => {
      let key = action.do
      if (!registry.actions.has(key)) {
        let Action = __ncc_wildcard$1(key)
        registry.actions.set(key, new Action())
      }
    })
  }

  static registerValidatorsAndActions (settings, registry) {
    settings.forEach(rule => {
      try {
        this.registerValidators(rule, registry)
      } catch (err) {
        throw new Error('Validators have thrown ' + err)
      }
      try {
        this.registerActions(rule, registry)
      } catch (err) {
        throw new Error('Actions have thrown ' + err)
      }
    })
  }
}

module.exports = Register


/***/ }),

/***/ 233:
/***/ (function(module, __unusedexports, __webpack_require__) {

const Register = __webpack_require__(187)
const getValidatorPromises = __webpack_require__(770)
const consolidateResult = __webpack_require__(136)
const constructErrorOutput = __webpack_require__(958)

const OPTION_MISSING_ERROR_MESSAGE = `Failed to validate because the 'validate' option is missing or empty. Please check the documentation.`

const andOrValidatorProcessor = async (context, settings, registry, validatorName) => {
  const validatorContext = { name: validatorName }

  if (!Array.isArray(settings) || settings.length === 0 || settings.validate) {
    return consolidateResult(
      [
        constructErrorOutput(
          validatorName,
          '',
          settings,
          OPTION_MISSING_ERROR_MESSAGE
        )
      ],
      validatorContext
    )
  }

  const rules = { validate: settings }

  try {
    Register.registerValidators(rules, registry)
  } catch (err) {
    return consolidateResult(
      [
        constructErrorOutput(
          validatorName,
          '',
          settings,
          'Unsupported validator ' + err
        )
      ],
      validatorContext
    )
  }

  const promises = getValidatorPromises(context, registry, rules)

  const output = await Promise.all(promises)

  const validations = []
  let status = 'fail'

  if (validatorName === 'And') {
    status = 'pass'
  }

  let count = 1
  for (let result of output) {
    if (result.status === 'error') {
      status = 'error'
    }

    if (validatorName === 'Or' && result.status === 'pass' && status !== 'error') {
      status = 'pass'
    }

    if (validatorName === 'And' && result.status === 'fail' && status !== 'error') {
      status = 'fail'
    }

    for (let validation of result.validations) {
      validation.description = `Option ${count}: ${result.name}: ${validation.description}`
    }

    validations.push(...result.validations)
    count++
  }

  return {
    status,
    name: validatorName,
    validations
  }
}

module.exports = andOrValidatorProcessor


/***/ }),

/***/ 236:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)

class Changeset extends Validator {
  constructor () {
    super('changeset')
    this.supportedEvents = [
      'pull_request.opened',
      'pull_request.edited',
      'pull_request_review.submitted',
      'pull_request_review.edited',
      'pull_request_review.dismissed',
      'pull_request.labeled',
      'pull_request.milestoned',
      'pull_request.demilestoned',
      'pull_request.assigned',
      'pull_request.unassigned',
      'pull_request.unlabeled',
      'pull_request.synchronize',
      'pull_request.push_synchronize'
    ]
    this.supportedSettings = {
      no_empty: {
        enabled: 'boolean',
        message: 'string'
      },
      must_include: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string'
      },
      must_exclude: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string'
      },
      begins_with: {
        match: ['string', 'array'],
        message: 'string'
      },
      ends_with: {
        match: ['string', 'array'],
        message: 'string'
      },
      min: {
        count: 'number',
        message: 'string'
      },
      max: {
        count: 'number',
        message: 'string'
      }
    }
  }

  async validate (context, validationSettings) {
    // fetch the file list
    let result = await context.github.paginate(
      context.github.pulls.listFiles.endpoint.merge(
        context.repo({ pull_number: this.getPayload(context).number })
      ),
      res => res.data
    )

    let changedFiles = result.map(file => file.filename)

    return this.processOptions(validationSettings, changedFiles)
  }
}

module.exports = Changeset


/***/ }),

/***/ 244:
/***/ (function(module, __unusedexports, __webpack_require__) {

const Interceptor = __webpack_require__(514)

/**
 * Handles milestoned and demilestoned for Pull Requests.
 */
class Milestoned extends Interceptor {
  async process (context) {
    if (this.valid(context)) {
      let res = await context.github.pulls.get(context.repo({number: context.payload.issue.number}))
      res.data.action = context.payload.action
      context.event = 'pull_request'
      context.payload.pull_request = res.data
    }
    return context
  }

  /**
   * @return true if issue has the action milestoned or demilestoned but is from a pull_request.
   */
  valid (context) {
    // GH does not differentiate between issues and pulls for milestones. The only differentiator
    // is the payload for issues containing a pull_request property.
    return (context.event === 'issues' &&
      (context.payload.action === 'milestoned' ||
      context.payload.action === 'demilestoned')) &&
      !!context.payload.issue.pull_request
  }
}

module.exports = Milestoned


/***/ }),

/***/ 279:
/***/ (function(module) {

module.exports = {
  EVENT_RECEIVED: 'event_received',
  CONFIG_INVALID_YML: 'config_invalid_yml',
  CONFIG_NO_YML: 'config_no_yml',
  UNKNOWN_ERROR_VALIDATOR: 'unknown_error_validator',
  UNKNOWN_ERROR_ACTION: 'unknown_error_action',
  VALIDATOR_PROCESS: 'validator_process',
  ACTION_BEFORE_VALIDATE_EXECUTE: 'action_before_validate_execute',
  ACTION_AFTER_VALIDATE_EXECUTE: 'action_after_validate_execute',
  POTENTIAL_INJECTION: 'potential_injection',
  CONFIG: 'config'
}


/***/ }),

/***/ 291:
/***/ (function(module) {

const SPECIAL_ANNOTATION = {
  '@author': payload => payload.user.login
}

const searchAndReplaceSpecialAnnotations = (template, payload) => {
  let newTemplate = template

  for (let annotation of Object.keys(SPECIAL_ANNOTATION)) {
    let specialAnnotationRegex = new RegExp(`([^\\\\])${annotation}`)
    let annotationAtStartRegex = new RegExp(`^${annotation}`)
    let escapeAnnotationRegex = new RegExp(`(\\\\){1}${annotation}`)

    newTemplate = newTemplate.replace(specialAnnotationRegex, ` ${SPECIAL_ANNOTATION[annotation](payload)}`)
    newTemplate = newTemplate.replace(escapeAnnotationRegex, annotation)
    newTemplate = newTemplate.replace(annotationAtStartRegex, SPECIAL_ANNOTATION[annotation](payload))
  }
  return newTemplate
}

module.exports = searchAndReplaceSpecialAnnotations


/***/ }),

/***/ 313:
/***/ (function(module, __unusedexports, __webpack_require__) {

const TeamNotFoundError = __webpack_require__(700)
const _ = __webpack_require__(356)

class Teams {
  static async extractTeamMembers (context, teams) {
    let teamMembers = []

    if (!teams || teams.length === 0) return teamMembers

    for (let team of teams) {
      let members = []
      try {
        members = await getTeamMembers(context, team)
      } catch (err) {
        throw err
      }

      teamMembers = teamMembers.concat(members)
    }
    return _.uniq(teamMembers)
  }
}

const getTeamMembers = async (context, team) => {
  const stringArray = team.split('/')
  if (stringArray.length !== 2) {
    throw Error(`each team id needs to be given in 'org/team_slug'`)
  }
  if (stringArray[0].indexOf('@') === 0) stringArray[0] = stringArray[0].substring(1)

  const org = stringArray[0]
  const teamSlug = stringArray[1]

  let res
  try {
    res = await context.github.teams.listMembersInOrg({
      org,
      team_slug: teamSlug
    })
  } catch (err) {
    if (err.status === 404) {
      throw new TeamNotFoundError(team)
    }
    throw err
  }

  return res.data.map(member => member.login)
}

module.exports = Teams


/***/ }),

/***/ 327:
/***/ (function(module) {

module.exports = {
  CONFIGURATION_FILE_PATH: '.github/mergeable.yml',
  ERROR_INVALID_YML: 'Invalid mergeable YML file format. Root mergeable node is missing.',
  DEFAULT_PR_PASS: [{
    do: 'checks',
    state: 'completed',
    status: 'success',
    payload: {
      title: 'Mergeable Run has been Completed!',
      summary: `All the validators have returned 'pass'! \n Here are some stats of the run: \n {{validationCount}} validations were ran`
    }
  }],
  DEFAULT_PR_FAIL: [{
    do: 'checks',
    state: 'completed',
    status: 'failure',
    payload: {
      title: `Mergeable run returned Status ***{{toUpperCase validationStatus}}***`,
      summary: `### Status: {{toUpperCase validationStatus}}

        Here are some stats of the run:
        {{validationCount}} validations were ran.
        {{passCount}} PASSED
        {{failCount}} FAILED
      `,
      text: `{{#each validationSuites}}
#### {{{statusIcon status}}} Validator: {{toUpperCase name}}
{{#each validations }} * {{{statusIcon status}}} ***{{{ description }}}***
       Input : {{{details.input}}}
       Settings : {{{displaySettings details.settings}}}
       {{/each}}
{{/each}}`
    }
  }],
  DEFAULT_PR_ERROR: [{
    do: 'checks',
    state: 'completed',
    status: 'action_required',
    payload: {
      title: 'Mergeable found some failed checks!',
      summary: `### Status: {{toUpperCase validationStatus}}
      Some or All of the validators have returned 'error' status, please check below for details
      
      Here are some stats of the run: 
      {{validationCount}} validations were ran. 
      {{passCount}} ***PASSED***
      {{failCount}} ***FAILED***
      {{errorCount}} ***ERRORED***`,
      text: `{{#each validationSuites}}
#### {{{statusIcon status}}} Validator: {{toUpperCase name}}
Status {{toUpperCase status}}
{{#each validations }} * {{{statusIcon status}}} ***{{{ description }}}***
       Input : {{{details.input}}}
       Settings : {{{displaySettings details.settings}}}
       {{#if details.error}}
       Error : {{{details.error}}}
       {{/if}}
       {{/each}}
{{/each}}`
    }
  }],
  DEFAULT_ISSUES_PASS: [{
    do: 'comment',
    payload: {
      body: `All the validators have returned 'pass'! \n Here are some stats of the run: \n {{validationCount}} validations were ran`
    }
  }],
  DEFAULT_ISSUES_FAIL: [{
    do: 'comment',
    payload: {
      body: `### We found some failed validations in your Issue
{{#each validationSuites}}
{{#ifEquals status "fail"}}
#### {{{statusIcon status}}} Validator: {{toUpperCase name}}
{{#each validations }} * {{{statusIcon status}}} ***{{{ description }}}***
Input : {{{details.input}}}
Settings : {{{displaySettings details.settings}}}
{{/each}}
{{/ifEquals}}
{{/each}}`
    }
  }],
  DEFAULT_ISSUES_ERROR: [{
    do: 'comment',
    payload: {
      body: `### We found some error in your mergeable configuration
{{#each validationSuites}}
{{#ifEquals status "error"}}
#### {{{statusIcon status}}} Validator: {{toUpperCase name}}
{{#each validations }} * {{{statusIcon status}}} ***{{{ description }}}***
Input : {{{details.input}}}
Settings : {{{displaySettings details.settings}}}
{{#if details.error}}
Error : {{{details.error}}}
{{/if}}
{{/each}}
{{/ifEquals}}
{{/each}}
        `
    }
  }],
  DEFAULT_PR_VALIDATE: [{
    do: 'title',
    must_exclude: {
      regex: '^wip'
    }
  }, {
    do: 'label',
    must_exclude: {
      regex: 'work in progress|wip|do not merge'
    }
  }, {
    do: 'description',
    no_empty: {
      enabled: true
    }
  }]
}


/***/ }),

/***/ 333:
/***/ (function(module, __unusedexports, __webpack_require__) {

const _ = __webpack_require__(356)
const EventAware = __webpack_require__(97)
const options = __webpack_require__(627)
const logger = __webpack_require__(410)
const UnSupportedSettingError = __webpack_require__(894)
const constructErrorOutput = __webpack_require__(958)
const consolidateResult = __webpack_require__(136)

const DEFAULT_SUPPORTED_OPTIONS = [
  'and',
  'or',
  'begins_with',
  'ends_with',
  'max',
  'min',
  'must_exclude',
  'must_include',
  'no_empty',
  'required'
]

class Validator extends EventAware {
  constructor (name) {
    super()
    this.processor = options
    this.name = name
    this.log = logger.create(`validator/${name}`)
    this.supportedOptions = DEFAULT_SUPPORTED_OPTIONS
  }

  async validate () {
    throw new Error('Class extending validator must implement validate function')
  }

  async processValidate (context, validationSettings, registry) {
    if (!this.supportedSettings) {
      throw new Error('Class extending validators must provide supported Settings')
    }

    this.logUsage(context, validationSettings)
    try {
      this.validateSettings(this.supportedSettings, validationSettings)
    } catch (err) {
      if (err instanceof UnSupportedSettingError) {
        const validatorContext = {name: this.name}
        const output = [constructErrorOutput(validatorContext, JSON.stringify(this.supportedSettings), validationSettings, `${err.name}`, err)]
        return consolidateResult(output, validatorContext)
      } else {
        throw err
      }
    }

    return this.validate(context, validationSettings, registry)
  }

  processOptions (vSettings, value, supportedOptions) {
    return options.process({
      name: vSettings.do,
      supportedOptions: supportedOptions || DEFAULT_SUPPORTED_OPTIONS
    }, value, vSettings)
  }

  logUsage (context, settings) {
    const usageLog = {
      log_type: logger.logTypes.VALIDATOR_PROCESS,
      repo: context.payload.repository.full_name,
      validator_name: this.name,
      settings: JSON.stringify(settings)
    }
    this.log.info(JSON.stringify(usageLog))
  }

  validateSettings (supportedSettings, settingToCheck, nestings = []) {
    const supportedSettingKeys = Object.keys(supportedSettings)

    for (let key of Object.keys(settingToCheck)) {
      if (key === 'do' || key === 'and' || key === 'or') continue
      if (!supportedSettingKeys.includes(key)) {
        throw new UnSupportedSettingError(`validator/${this.name}: ${nestings.join('.')}${nestings.length > 0 ? '.' : ''}${key} option is not supported`)
      }
      const optionType = getOptionType(settingToCheck[key])
      if (optionType === 'object') {
        this.validateSettings(supportedSettings[key], settingToCheck[key], nestings.concat([key]))
      } else if (!supportedSettings[key].includes(optionType)) {
        throw new UnSupportedSettingError(`validator/${this.name}: ${nestings.join('.')}${nestings.length > 0 ? '.' : ''}${key} is expected to be of type: ${supportedSettings[key]}`)
      }
    }
  }
}

const getOptionType = (option) => {
  if (typeof option === 'object' && _.isArray(option)) {
    return 'array'
  }
  return typeof option
}

module.exports = {
  Validator: Validator
}


/***/ }),

/***/ 356:
/***/ (function(module) {

module.exports = eval("require")("lodash");


/***/ }),

/***/ 364:
/***/ (function(module, __unusedexports, __webpack_require__) {

const options = __webpack_require__(627)

const UNKNOWN_INPUT_TYPE_ERROR = `Input type invalid, expected array type as input`

const andOrProcessor = (validatorContext, input, rule, key) => {
  const filters = rule[key]

  if (!Array.isArray(filters)) {
    throw new Error(UNKNOWN_INPUT_TYPE_ERROR)
  }

  const validated = filters.map(filter => {
    if (filter.and) {
      return andOrProcessor(validatorContext, input, filter, 'and')
    }
    if (filter.or) {
      return andOrProcessor(validatorContext, input, filter, 'or')
    }

    // we are only passing in one item at a time, so this will only return one element array
    return options.process(validatorContext, input, filter, true)[0]
  })

  let isMergeable
  let DEFAULT_SUCCESS_MESSAGE = `All the requisite validations passed for '${key}' option`
  let descriptions = ''
  let doesErrorExists = false
  let errorMessage = 'Error occurred: \n'

  validated.forEach(result => {
    if (result.status === 'error') {
      doesErrorExists = true
      errorMessage += `- ${result.description} \n`
    }

    const resultSuccess = result.status === 'pass'
    if (isMergeable !== undefined) {
      isMergeable = key === 'and' ? isMergeable && resultSuccess : isMergeable || resultSuccess
    } else {
      isMergeable = resultSuccess
    }

    if (result.status === 'fail') {
      if (descriptions.length > 2) {
        descriptions += ` ${key === 'and' ? ` ***AND*** ` : ` ***OR*** `} ${result.description}`
      } else {
        descriptions += `${result.description}`
      }
    }
  })

  let status = 'error'
  let description = errorMessage

  if (!doesErrorExists) {
    status = isMergeable ? 'pass' : 'fail'
    description = isMergeable ? DEFAULT_SUCCESS_MESSAGE : `(${descriptions})`
  }

  return {
    status,
    description
  }
}

module.exports = andOrProcessor


/***/ }),

/***/ 371:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)
const _ = __webpack_require__(356)
const mustInclude = __webpack_require__(506)
const constructOutput = __webpack_require__(406)
const consolidateResult = __webpack_require__(136)

const MESSAGE_NOT_FOUND_ERROR = `Failed to run the 'commit' validator because 'message' option is not found. Please check README for more information about configuration`
const REGEX_NOT_FOUND_ERROR = `Failed to run the test because 'regex' is not provided for 'message' option. Please check README for more information about configuration`
const DEFAULT_FAIL_MESSAGE = `Some or all of your commit messages doesn't meet the criteria`
const DEFAULT_SUCCESS_MESSAGE = `Your commit messages met the specified criteria`

class Commit extends Validator {
  constructor () {
    super('commit')
    this.supportedEvents = [
      'pull_request.opened',
      'pull_request.edited',
      'pull_request_review.submitted',
      'pull_request_review.edited',
      'pull_request_review.dismissed',
      'pull_request.labeled',
      'pull_request.milestoned',
      'pull_request.demilestoned',
      'pull_request.assigned',
      'pull_request.unassigned',
      'pull_request.unlabeled',
      'pull_request.synchronize',
      'pull_request.push_synchronize'
    ]
    this.supportedSettings = {
      message: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string',
        skip_merge: 'boolean',
        oldest_only: 'boolean',
        single_commit_only: 'boolean'
      }
    }
  }

  async validate (context, validationSettings) {
    if (_.isUndefined(validationSettings.message)) throw Error(MESSAGE_NOT_FOUND_ERROR)
    if (_.isUndefined(validationSettings.message.regex)) throw Error(REGEX_NOT_FOUND_ERROR)

    let messageSettings = validationSettings.message
    let oldestCommitOnly = _.isUndefined(messageSettings.oldest_only) ? false : messageSettings.oldest_only
    let skipMerge = _.isUndefined(messageSettings.skip_merge) ? true : messageSettings.skip_merge
    let singleCommitOnly = _.isUndefined(messageSettings.single_commit_only) ? false : messageSettings.single_commit_only

    const validatorContext = { name: 'commit' }

    let commits = await context.github.paginate(
      context.github.pulls.listCommits.endpoint.merge(
        context.repo({ pull_number: this.getPayload(context).number })
      ),
      res => res.data.map(o => ({ message: o.commit.message, date: o.commit.author.date }))
    )
    let orderedCommits = _.orderBy(commits, ['date'], ['asc'])

    if (singleCommitOnly && orderedCommits.length !== 1) {
      return consolidateResult([constructOutput(
        validatorContext,
        orderedCommits.map(commit => commit.message),
        validationSettings,
        {
          status: 'pass',
          description: 'Since there are more than one commits, Skipping validation'
        }
      )], validatorContext)
    }

    if (skipMerge) {
      orderedCommits = orderedCommits.filter(commit => !commit.message.includes('Merge branch'))
    }

    if (oldestCommitOnly) {
      orderedCommits = [orderedCommits[0]]
    }

    const commitMessages = orderedCommits.map(commit => commit.message)

    const result = mustInclude.process(validatorContext, commitMessages, {
      must_include: {
        all: true,
        regex: messageSettings.regex,
        regex_flag: messageSettings.regex_flag,
        message: messageSettings.message ? messageSettings.message : DEFAULT_FAIL_MESSAGE
      }})

    if (result.status === 'pass') {
      result.description = DEFAULT_SUCCESS_MESSAGE
    }
    const output = [constructOutput(validatorContext, commitMessages, validationSettings, result)]

    return consolidateResult(output, validatorContext)
  }
}

module.exports = Commit


/***/ }),

/***/ 380:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)
const deepValidation = __webpack_require__(837)

class Milestone extends Validator {
  constructor () {
    super('milestone')
    this.supportedEvents = [
      'pull_request.opened',
      'pull_request.edited',
      'pull_request_review.submitted',
      'pull_request_review.edited',
      'pull_request_review.dismissed',
      'pull_request.labeled',
      'pull_request.milestoned',
      'pull_request.demilestoned',
      'pull_request.assigned',
      'pull_request.unassigned',
      'pull_request.unlabeled',
      'pull_request.synchronize',
      'pull_request.push_synchronize',
      'issues.*'
    ]
    this.supportedSettings = {
      no_empty: {
        enabled: 'boolean',
        message: 'string'
      },
      must_include: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string'
      },
      must_exclude: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string'
      },
      begins_with: {
        match: ['string', 'array'],
        message: 'string'
      },
      ends_with: {
        match: ['string', 'array'],
        message: 'string'
      },
      min: {
        count: 'number',
        message: 'string'
      },
      max: {
        count: 'number',
        message: 'string'
      }
    }
  }

  async validate (context, validationSettings) {
    let milestone = this.getPayload(context).milestone ? this.getPayload(context).milestone.title : ''
    let output = this.processOptions(
      validationSettings,
      milestone
    )

    // check PR body to see if closes an issue
    if (output.status === 'fail') {
      const res = deepValidation.checkIfClosesAnIssue(this.getPayload(context).body)
      if (res.length > 0) {
        const result = await deepValidation.checkIfIssueHaveProperty(context, res, 'milestone')
        result.forEach(issue => {
          const processed = this.processOptions(validationSettings, issue.title)
          output = processed
        })
      }
    }

    return output
  }
}

module.exports = Milestone


/***/ }),

/***/ 394:
/***/ (function(module, __unusedexports, __webpack_require__) {

const EventAware = __webpack_require__(97)
const logger = __webpack_require__(410)

class Action extends EventAware {
  constructor (name) {
    super()
    this.name = name
    this.log = logger.create(`action/${name}`)
  }

  async beforeValidate () {
    throw new Error('class extending Action must implement beforeValidate function')
  }
  async afterValidate () {
    throw new Error('class extending Action must implement afterValidate function')
  }

  async processBeforeValidate (context, settings, name) {
    this.logBeforeValidateUsage(context, settings)
    return this.beforeValidate(context, settings, name)
  }

  async processAfterValidate (context, settings, name, results) {
    this.logAfterValidateUsage(context, settings)
    return this.afterValidate(context, settings, name, results)
  }

  // intentionally do nothing. To be implemented by the inheriting Action classes.
  async run ({ context, settings, payload }) {}

  logBeforeValidateUsage (context, settings) {
    const usageLog = {
      log_type: logger.logTypes.ACTION_BEFORE_VALIDATE_EXECUTE,
      repo: context.payload.repository.full_name,
      action_name: this.name,
      settings: JSON.stringify(settings)
    }
    this.log.info(JSON.stringify(usageLog))
  }

  logAfterValidateUsage (context, settings) {
    const usageLog = {
      log_type: logger.logTypes.ACTION_AFTER_VALIDATE_EXECUTE,
      repo: context.payload.repository.full_name,
      action_name: this.name,
      settings: JSON.stringify(settings)
    }
    this.log.info(JSON.stringify(usageLog))
  }
}

module.exports = {
  Action
}


/***/ }),

/***/ 396:
/***/ (function(module, __unusedexports, __webpack_require__) {

const Interceptor = __webpack_require__(514)
const MetaData = __webpack_require__(759)
const Logger = __webpack_require__(410)

/**
 * Checks the event for a re-requested check_run. This GH event is triggered when the user
 * clicks on "Re-run" or "Re-run failed checks" in the UI and expects conditions to be re-validated. Fetch the PR and it's stored condition from
 * the check run text.
 *
 * Set the context up with the appropriate PR payload, event and action for a validation and check run.
 *
 * NOTE: "Re-run all checks" generates a different event and is not taken care of in this interceptor.
 */
class CheckReRun extends Interceptor {
  async process (context) {
    if (!(context.event === 'check_run' && context.payload.action === 'rerequested')) return context

    let checkRun = context.payload.check_run
    if (!checkRun) return context

    let meta = MetaData.deserialize(checkRun.output.text)
    if (this.possibleInjection(context, checkRun, meta)) return context

    let pr = await context.github.pulls.get(context.repo({number: checkRun.pull_requests[0].number}))
    context.payload.action = meta.action
    context.event = meta.event
    context.payload.pull_request = pr.data
    return context
  }

  possibleInjection (context, checkRun, meta) {
    let isInjection = checkRun.id !== meta.id
    if (isInjection) {
      const log = Logger.create('interceptors/checkReRun')
      log.warn({
        log_type: Logger.logTypes.POTENTIAL_INJECTION,
        message: 'ids in payload do not match. Potential injection.',
        check_run: checkRun,
        meta: meta
      })
    }
    return isInjection
  }
}

module.exports = CheckReRun


/***/ }),

/***/ 406:
/***/ (function(module) {

/**
 * Contruct Output
 * Allows the processor Options module to create the uniform output type
 *
 * Expected Input:
 * validatorContext: {
 *  name: validatorName
 * }
 *
 * input the rule was run against
 * rule: {
 *    // rule used during the test
 * }
 *
 *
 * result: {
 *   status: 'pass|fail|error'
 *   description : 'Default or custom message'
 * }
 *
 * Output format:
 * output : {
 *   validatorName: // Validator that was run
 *   status: 'pass|fail|error'
 *   description: 'Defaul or custom Message'
 *   details {
 *     input: // input the tests are run against
 *     setting: rule
 *     error: String // Optional, only should be sent when status == error
 *   }
 * }
 *
 */
module.exports = (validatorContext, input, rule, result, error) => {
  return {
    validator: validatorContext,
    status: result.status,
    description: result.description,
    details: {
      input: input,
      settings: rule,
      error: error
    }
  }
}


/***/ }),

/***/ 410:
/***/ (function(module, __unusedexports, __webpack_require__) {

// Our log object is provided by probot and we only have access to it during run-time
// this module acts as a singleton for log object and needs to be initialized before using it
let logger

const logType = __webpack_require__(279)

class Logger {
  static get logTypes () {
    return logType
  }

  static create (name = 'mergeable') {
    if (logger === undefined) {
      throw Error('Logger has not been initialized')
    }

    return logger.child({ name })
  }

  static init (log) {
    if (logger !== undefined) {
      throw Error('Logger has already been initialized, no need to initialize it again')
    }

    logger = log
    log.info('Logger Successfully initialized')
  }
}

module.exports = Logger


/***/ }),

/***/ 411:
/***/ (function(module) {

const MATCH_NOT_FOUND_ERROR = `Failed to run the test because 'match' is not provided for 'ends_with' option. Please check README for more information about configuration`
const UNKNOWN_MATCH_TYPE_ERROR = `'match' type invalid, expected string or Array type`
const UNKNOWN_INPUT_TYPE_ERROR = `Input type invalid, expected string or Array as input`

class EndsWith {
  static process (validatorContext, input, rule) {
    const filter = rule.ends_with

    const match = filter['match']
    let description = filter['message']
    if (!match) {
      throw new Error(MATCH_NOT_FOUND_ERROR)
    }

    const DEFAULT_SUCCESS_MESSAGE = `${validatorContext.name} does end with '${match}'`
    if (!description) description = `${validatorContext.name} must end with "${match}"`

    let isMergeable

    try {
      isMergeable = checkIfMergeable(input, match)
    } catch (err) {
      throw new Error(UNKNOWN_INPUT_TYPE_ERROR)
    }

    return {
      status: isMergeable ? 'pass' : 'fail',
      description: isMergeable ? DEFAULT_SUCCESS_MESSAGE : description
    }
  }
}

function checkIfMergeable (input, match) {
  if (typeof input !== 'string' && !Array.isArray(input)) {
    throw new Error(UNKNOWN_INPUT_TYPE_ERROR)
  }

  if (typeof match !== 'string' && !Array.isArray(match)) {
    throw new Error(UNKNOWN_MATCH_TYPE_ERROR)
  }

  if (typeof input === 'string') {
    return checkIfInputMatches(match, (item) => input.indexOf(item) === (input.length - item.length))
  } else {
    return input.some(inputItem =>
      checkIfInputMatches(match, (matchItem) => inputItem.indexOf(matchItem) === (inputItem.length - matchItem.length))
    )
  }
}

function checkIfInputMatches (match, func) {
  if (typeof match === 'string') {
    return func(match)
  } else {
    return match.some(item => func(item))
  }
}

module.exports = EndsWith


/***/ }),

/***/ 412:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)
const constructOutput = __webpack_require__(406)
const moment = __webpack_require__(536)

const dayOfTheWeek = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat'
]

const MAX_ISSUES = 20 // max issues to retrieve each time.

class Stale extends Validator {
  constructor () {
    super('stale')
    this.supportedEvents = [
      'schedule.repository'
    ]
    this.supportedSettings = {
      days: 'number',
      type: 'array',
      time_constraint: {
        time_zone: 'string',
        hours_between: 'array',
        days_of_week: 'array'
      }
    }
  }

  async validate (context, validationSettings) {
    if (validationSettings.time_constraint) {
      const timeOptions = validationSettings.time_constraint
      const now = moment().utc(false)

      if (timeOptions.time_zone) now.tz(timeOptions.time_zone)
      if (timeOptions.days_of_week && !timeOptions.days_of_week.includes(dayOfTheWeek[now.day()])) return craftFailOutput(validationSettings)
      if (timeOptions.hours_between && timeOptions.hours_between.length === 2) {
        const hourNow = now.hour()
        if (hourNow < timeOptions.hours_between[0] || hourNow > timeOptions.hours_between[1]) return craftFailOutput(validationSettings)
      }
    }

    let days = validationSettings.days || 20
    let typeSetting = validationSettings.type || ['issue', 'pr']
    let types = Array.isArray(typeSetting) &&
      typeSetting.filter(type => type === 'issues' || type === 'pull_request')
    types = types || [typeSetting]
    types = types.map(type => {
      if (type === 'issues') return 'issue'
      if (type === 'pull_request') return 'pr'
    })

    let typeQuery = (types.length === 1) ? ` type:${types[0]}` : ''
    let secs = days * 24 * 60 * 60 * 1000
    let timestamp = new Date(new Date() - secs)
    timestamp = timestamp.toISOString().replace(/\.\d{3}\w$/, '')

    let results = await context.github.search.issuesAndPullRequests({
      q: `repo:${context.repo().owner}/${context.repo().repo} is:open updated:<${timestamp}${typeQuery}`,
      sort: 'updated',
      order: 'desc',
      per_page: MAX_ISSUES
    })

    let items = results.data.items

    let scheduleResult = {
      issues: items.filter(item => !item.pull_request),
      pulls: items.filter(item => item.pull_request)
    }

    return getResult(scheduleResult, { days: days, types: types }, validationSettings)
  }
}

const craftFailOutput = (validationSettings) => {
  return {
    status: 'fail',
    name: 'stale',
    validations: constructOutput(
      'stale',
      'fail',
      validationSettings,
      validationSettings
    )
  }
}

const getResult = (scheduleResult, input, settings) => {
  let isPass = scheduleResult.issues.length > 0 ||
    scheduleResult.pulls.length > 0
  let name = 'stale'
  let status = isPass ? 'pass' : 'fail'

  return {
    status: status,
    name: name,
    validations: constructOutput(
      name,
      status,
      input,
      settings
    ),
    schedule: scheduleResult
  }
}

module.exports = Stale


/***/ }),

/***/ 420:
/***/ (function(module, __unusedexports, __webpack_require__) {

const Configuration = __webpack_require__(38)
const Checks = __webpack_require__(543)

const logger = __webpack_require__(410)

const logAndProcessConfigErrors = (context, config) => {
  const log = logger.create('flex')
  const event = `${context.event}.${context.payload.action}`
  const errors = config.errors

  let checks = new Checks()
  if (!checks.isEventSupported(event)) return

  let checkRunParam = {
    context: context,
    payload: {
      status: 'completed',
      conclusion: 'cancelled',
      output: {
        title: 'Invalid Configuration',
        summary: formatErrorSummary(errors)
      },
      completed_at: new Date()
    }
  }

  const configErrorLog = {
    log_type: logger.logTypes.CONFIG_INVALID_YML,
    errors,
    repo: context.payload.repository.full_name,
    event,
    settings: JSON.stringify(config.settings)
  }

  if (errors.has(Configuration.ERROR_CODES.NO_YML)) {
    checkRunParam.payload.conclusion = 'success'
    checkRunParam.payload.output = {
      title: 'No Config file found',
      summary: 'To enable Mergeable, please create a .github/mergeable.yml' +
        '\n\nSee the [documentation](https://github.com/mergeability/mergeable) for details on configuration.'
    }

    configErrorLog.log_type = logger.logTypes.CONFIG_NO_YML
  }

  log.info(JSON.stringify(configErrorLog))

  return checks.run(checkRunParam)
}

const formatErrorSummary = (errors) => {
  let it = errors.values()
  let summary = `Errors were found in the configuration (${Configuration.FILE_NAME}):`
  let message = it.next()
  while (!message.done) {
    summary += '\n- ' + message.value
    message = it.next()
  }
  summary += '\n\nSee the [documentation](https://github.com/mergeability/mergeable) for details on configuration.'
  return summary
}

module.exports = logAndProcessConfigErrors


/***/ }),

/***/ 424:
/***/ (function(module, __unusedexports, __webpack_require__) {

const Configuration = __webpack_require__(38)
const logAndProcessConfigErrors = __webpack_require__(420)
const interceptors = __webpack_require__(603)
const processWorkflow = __webpack_require__(122)

const logger = __webpack_require__(410)

// Main logic Processor of mergeable
const executeMergeable = async (context, registry) => {
  if (registry === undefined) {
    registry = { validators: new Map(), actions: new Map() }
  }

  // interceptors
  await interceptors(context)

  // first fetch the configuration
  let config = await Configuration.instanceWithContext(context)

  if (config.hasErrors()) {
    return logAndProcessConfigErrors(context, config)
  }

  if (process.env.LOG_CONFIG) {
    const log = logger.create('flex')
    const configLog = {
      log_type: logger.logTypes.CONFIG,
      repo: context.payload.repository.full_name,
      settings: JSON.stringify(config.settings)
    }

    log.info(JSON.stringify(configLog))
  }

  await processWorkflow(context, registry, config)
}

module.exports = executeMergeable


/***/ }),

/***/ 431:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)
const Owner = __webpack_require__(855)
const Assignees = __webpack_require__(872)
const RequestedReviewers = __webpack_require__(553)
const consolidateResult = __webpack_require__(136)
const constructOutput = __webpack_require__(406)
const constructErrorOutput = __webpack_require__(958)
const TeamNotFoundError = __webpack_require__(700)
const options = __webpack_require__(627)
const Teams = __webpack_require__(313)
const _ = __webpack_require__(356)

class Approvals extends Validator {
  constructor () {
    super('approvals')
    this.supportedEvents = [
      'pull_request.opened',
      'pull_request.edited',
      'pull_request_review.submitted',
      'pull_request_review.edited',
      'pull_request_review.dismissed',
      'pull_request.labeled',
      'pull_request.milestoned',
      'pull_request.demilestoned',
      'pull_request.assigned',
      'pull_request.unassigned',
      'pull_request.unlabeled',
      'pull_request.synchronize',
      'pull_request.push_synchronize'
    ]

    this.supportedSettings = {
      min: {
        count: 'number',
        message: 'string'
      },
      max: {
        count: 'number',
        message: 'string'
      },
      required: {
        reviewers: 'array',
        owners: 'boolean',
        assignees: 'boolean',
        requested_reviewers: 'boolean',
        message: 'string'
      },
      block: {
        changes_requested: 'boolean',
        message: 'string'
      },
      limit: {
        teams: 'array',
        owners: 'boolean'
      }
    }
  }

  processOptions (vSettings, value, supportedOptions) {
    return options.process({
      name: vSettings.do,
      supportedOptions: supportedOptions || this.supportedOptions
    }, value, vSettings, true)
  }

  async validate (context, validationSettings) {
    let blockOption = null
    if (validationSettings.block) {
      blockOption = validationSettings.block
      delete validationSettings.block
    }

    let limitOption = null
    if (validationSettings.limit) {
      limitOption = validationSettings.limit
      delete validationSettings.limit
    }

    let reviews = await context.github.paginate(
      context.github.pulls.listReviews.endpoint.merge(
        context.repo({ pull_number: this.getPayload(context).number })
      ),
      res => res.data
    )

    let { requiredReviewers, ownerList, assigneeList, requestedReviewerList } = await this.getRequiredReviewerList(context, validationSettings)

    if (requiredReviewers.length > 0) {
      validationSettings = Object.assign({}, validationSettings, {required: { owners: ownerList, assignees: assigneeList, reviewers: requiredReviewers, requested_reviewers: requestedReviewerList }})
    }

    let approvedReviewers = findReviewersByState(reviews, 'approved')

    // if limit is provided, we only filter the approved Reviewers to members of the teams provided
    if (limitOption) {
      let owners = []
      let teams = []
      let teamMembers = []
      if (limitOption.teams) teams = teams.concat(limitOption.teams)
      if (limitOption.owners) {
        owners = await Owner.process(this.getPayload(context), context)
      }

      try {
        teamMembers = await Teams.extractTeamMembers(context, teams)
      } catch (err) {
        if (err instanceof TeamNotFoundError) {
          const validatorContext = { name: 'approvals' }
          const output = [constructErrorOutput(validatorContext, teams, limitOption, `${err.name}`, err)]
          return consolidateResult(output, validatorContext)
        }
        throw err
      }

      teamMembers = _.union(teamMembers, owners)

      approvedReviewers = _.intersection(approvedReviewers, teamMembers)
    }

    let output = await this.processOptions(validationSettings, approvedReviewers)

    if (blockOption && blockOption.changes_requested) {
      output.push(processBlockOption(blockOption, reviews))
    }

    return consolidateResult(output, { name: 'approvals' })
  }

  async getRequiredReviewerList (context, validationSettings) {
    let prCreator = this.getPayload(context).user.login
    let requiredReviewers = []

    if (validationSettings.required &&
      validationSettings.required.reviewers) {
      requiredReviewers = validationSettings.required.reviewers
    }

    let ownerList = []
    if (validationSettings && validationSettings.required && validationSettings.required.owners) {
      try {
        ownerList = await Owner.process(this.getPayload(context), context)
      } catch (err) {
        if (err instanceof TeamNotFoundError) {
          const validatorContext = { name: 'approvals' }
          const output = [constructErrorOutput(validatorContext, ownerList, validationSettings, `${err.name}`, err)]
          return consolidateResult(output, validatorContext)
        }
        throw err
      }
    }

    if (ownerList.length > 0) {
      // append it to the required reviewer list
      requiredReviewers = requiredReviewers.concat(ownerList)

      // there could be duplicates between reviewer and ownerlist
      requiredReviewers = _.uniq(requiredReviewers)
    }

    const assigneeList = (validationSettings && validationSettings.required && validationSettings.required.assignees)
      ? await Assignees.process(this.getPayload(context), context) : []

    if (assigneeList.length > 0) {
      // append it to the required reviewer list
      requiredReviewers = requiredReviewers.concat(assigneeList)

      // there could be duplicates between reviewer and assigneeList
      requiredReviewers = _.uniq(requiredReviewers)
    }

    const requestedReviewerList = (validationSettings && validationSettings.required && validationSettings.required.requested_reviewers)
      ? await RequestedReviewers.process(this.getPayload(context), context) : []

    if (requestedReviewerList.length > 0) {
      // append it to the required reviewer list
      requiredReviewers = requiredReviewers.concat(requestedReviewerList)

      // there could be duplicates between reviewer and assigneeList
      requiredReviewers = _.uniq(requiredReviewers)
    }

    // if pr creator exists in the list of required reviewers, remove it
    if (requiredReviewers.includes(prCreator)) {
      const foundIndex = requiredReviewers.indexOf(prCreator)
      requiredReviewers.splice(foundIndex, 1)
    }

    return { requiredReviewers, ownerList, assigneeList, requestedReviewerList }
  }
}

const processBlockOption = (blockOption, reviews) => {
  const DEFAULT_SUCCESS_MESSAGE = 'No Changes are Requested'

  const description = blockOption.message ? blockOption.message : 'Please resolve all the changes requested'

  const changesRequestedReviewers = findReviewersByState(reviews, 'changes_requested')

  let isMergeable = true

  if (changesRequestedReviewers.length > 0) {
    isMergeable = false
  }

  let validatorContext = { name: 'approvals' }
  let result = {
    status: isMergeable ? 'pass' : 'fail',
    description: isMergeable ? DEFAULT_SUCCESS_MESSAGE : description
  }

  return constructOutput(validatorContext, changesRequestedReviewers, blockOption, result)
}

const findReviewersByState = (reviews, state) => {
  // filter out review submitted comments because it does not nullify an approved state.
  // Other possible states are PENDING and REQUEST_CHANGES. At those states the user has not approved the PR.
  // See https://developer.github.com/v3/pulls/reviews/#list-reviews-on-a-pull-request
  // While submitting a review requires the states be PENDING, REQUEST_CHANGES, COMMENT and APPROVE
  // The payload actually returns the state in past tense: i.e. APPROVED, COMMENTED
  const relevantReviews = reviews.filter(element => element.state.toLowerCase() !== 'commented')

  // order it by date of submission. The docs says the order is chronological but we sort it so that
  // uniqBy will extract the correct last submitted state for the user.
  const ordered = _.orderBy(relevantReviews, ['submitted_at'], ['desc'])
  const uniqueByUser = _.uniqBy(ordered, 'user.login')

  // approved reviewers are ones that are approved and not nullified by other submissions later.
  return uniqueByUser
    .filter(element => element.state.toLowerCase() === state)
    .map(review => review.user && review.user.login)
}

module.exports = Approvals


/***/ }),

/***/ 436:
/***/ (function(module, __unusedexports, __webpack_require__) {

const Interceptor = __webpack_require__(514)
const processWorkflow = __webpack_require__(122)
const Configuration = __webpack_require__(38)
const logAndProcessConfigErrors = __webpack_require__(420)
const _ = __webpack_require__(356)

/**
 * Checks the event for a push event. This GH event is triggered when the user push commits to any branch
 *
 * Re-run checks on all PR against the branch in which the commits have been pushed iff the config file has been changed
 */
class Push extends Interceptor {
  async process (context) {
    if (context.event !== 'push') return context

    // if there is no head_commit, just skip
    if (_.isUndefined(context.payload.head_commit) || !context.payload.head_commit) return context

    const addedFiles = context.payload.head_commit.added
    const modifiedFiles = context.payload.head_commit.modified

    const configPath = process.env.CONFIG_PATH ? process.env.CONFIG_PATH : 'mergeable.yml'
    if (!(addedFiles.includes(`.github/${configPath}`) || modifiedFiles.includes(`.github/${configPath}`))) return context
    const config = await Configuration.instanceWithContext(context)
    if (config.hasErrors()) {
      await logAndProcessConfigErrors(context, config)
      return context
    }

    const registry = { validators: new Map(), actions: new Map() }

    const res = await context.github.pulls.list(context.repo({
      base: context.payload.ref
    }))

    const pulls = res.data
    await Promise.all(pulls.map(pullRequest => {
      const newContext = _.cloneDeep(context)
      newContext.event = 'pull_request'
      newContext.payload.pull_request = pullRequest
      newContext.payload.action = 'push_synchronize'
      return processWorkflow(newContext, registry, config)
    }))

    return context
  }
}

module.exports = Push


/***/ }),

/***/ 481:
/***/ (function(module, __unusedexports, __webpack_require__) {

const createPromises = __webpack_require__(986)

const getActionPromises = (context, registry, rule, result) => {
  const actions = rule[result.validationStatus]
  if (actions) {
    const afterValidateFuncCall = (actionClass, context, action, name, result) => actionClass.processAfterValidate(context, action, name, result)

    return createPromises(actions, 'actions', afterValidateFuncCall, context, registry, rule.name, result)
  }
}

module.exports = getActionPromises


/***/ }),

/***/ 502:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)

class Title extends Validator {
  constructor () {
    super('title')
    this.supportedEvents = [
      'pull_request.opened',
      'pull_request.edited',
      'pull_request_review.submitted',
      'pull_request_review.edited',
      'pull_request_review.dismissed',
      'pull_request.labeled',
      'pull_request.milestoned',
      'pull_request.demilestoned',
      'pull_request.assigned',
      'pull_request.unassigned',
      'pull_request.unlabeled',
      'pull_request.synchronize',
      'pull_request.push_synchronize',
      'issues.*'
    ]
    this.supportedSettings = {
      no_empty: {
        enabled: 'boolean',
        message: 'string'
      },
      must_include: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string'
      },
      must_exclude: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string'
      },
      begins_with: {
        match: ['string', 'array'],
        message: 'string'
      },
      ends_with: {
        match: ['string', 'array'],
        message: 'string'
      },
      min: {
        count: 'number',
        message: 'string'
      },
      max: {
        count: 'number',
        message: 'string'
      }
    }
  }

  async validate (context, validationSettings) {
    return this.processOptions(
      validationSettings,
      this.getPayload(context).title
    )
  }
}

module.exports = Title


/***/ }),

/***/ 503:
/***/ (function(module, __unusedexports, __webpack_require__) {

const createScheduler = __webpack_require__(537)
const flexExecutor = __webpack_require__(424)
const Context = __webpack_require__(558)
const logger = __webpack_require__(410)
const _ = __webpack_require__(356)

__webpack_require__(869)

function logEventReceived (context) {
  let log = logger.create('mergeable')

  const event = `${context.event}.${context.payload.action}`

  const eventReceivedLog = {
    log_type: logger.logTypes.EVENT_RECEIVED,
    event
  }

  if (event.includes('installation')) {
    const installation = context.payload.installation

    let repositoriesAdded = []
    let repositoriesRemoved = []

    if (event === 'installation') {
      repositoriesAdded = context.payload.repositories.map(repo => repo.full_name)
    } else if (event === 'installation_repositories') {
      repositoriesAdded = context.payload.repositories_added.map(repo => repo.full_name)
      repositoriesRemoved = context.payload.repositories_removed.map(repo => repo.full_name)
    }

    Object.assign(eventReceivedLog, {
      installation_id: installation.id,
      account: installation.account.login,
      account_type: installation.account.type,
      repositories: { added: repositoriesAdded, removed: repositoriesRemoved },
      sender: context.payload.sender.login
    })
  }

  if (!(_.isUndefined(context.payload.repository))) {
    Object.assign(eventReceivedLog, {
      repo: context.payload.repository.full_name,
      url: context.payload.repository.html_url,
      isPrivate: context.payload.repository.private
    })
  }

  log.info(JSON.stringify(eventReceivedLog))
}

class Mergeable {
  constructor (mode) {
    this.mode = mode
  }

  start (robot) {
    let log = logger.create('mergeable')
    let scheduleIntervalSeconds = 2
    if (this.mode === 'development') {
      log.info('In DEVELOPMENT mode.')
    } else {
      log.info('In PRODUCTION mode.')
      scheduleIntervalSeconds = 3600
    }

    if (process.env.MERGEABLE_SCHEDULER === 'true') {
      log.info('Starting scheduler at ' + scheduleIntervalSeconds + ' second intervals.')
      this.schedule(robot, { interval: scheduleIntervalSeconds * 1000 })
    } else {
      log.info(`Scheduler: ${'off'.bold.white}!`)
    }

    this.flex(robot)
  }

  schedule (robot, options) {
    createScheduler(robot, options)
  }

  // version 2 of mergeable.
  flex (robot) {
    robot.on('*', async pContext => {
      let context = new Context(pContext)
      logEventReceived(context)

      await flexExecutor(context)
    })
  }
}

module.exports = { Mergeable: Mergeable }


/***/ }),

/***/ 506:
/***/ (function(module) {

const REGEX_NOT_FOUND_ERROR = `Failed to run the test because 'regex' is not provided for 'must_include' option. Please check README for more information about configuration`
const UNKNOWN_INPUT_TYPE_ERROR = `Input type invalid, expected either string or array of string as input`

class MustInclude {
  static process (validatorContext, input, rule) {
    const filter = rule.must_include

    const regex = filter['regex']
    let description = filter['message']
    if (!regex) {
      throw new Error(REGEX_NOT_FOUND_ERROR)
    }

    let isMergeable

    const DEFAULT_SUCCESS_MESSAGE = `${validatorContext.name} ${filter.all ? 'all' : ''}must include '${regex}'`
    if (!description) description = `${validatorContext.name} ${filter.all ? 'all' : ''}does not include "${regex}"`
    let regexObj

    try {
      let regexFlag = 'i'
      if (filter.regex_flag) {
        regexFlag = filter.regex_flag === 'none' ? '' : filter.regex_flag
      }

      regexObj = new RegExp(regex, regexFlag)
    } catch (err) {
      throw new Error(`Failed to create a regex expression with the provided regex: ${regex}`)
    }

    if (typeof input === 'string') {
      isMergeable = regexObj.test(input)
    } else if (Array.isArray(input)) {
      if (filter.all) {
        isMergeable = input.every(label => regexObj.test(label))
      } else {
        isMergeable = input.some(label => regexObj.test(label))
      }
    } else {
      throw new Error(UNKNOWN_INPUT_TYPE_ERROR)
    }

    return {
      status: isMergeable ? 'pass' : 'fail',
      description: isMergeable ? DEFAULT_SUCCESS_MESSAGE : description
    }
  }
}

module.exports = MustInclude


/***/ }),

/***/ 514:
/***/ (function(module) {

/**
 * The Interceptor class defines the interface for all inheriting interceptors that
 * mutates the probot context with additional meta data or changes existing property Values
 * depending on certain criterias.
 *
 * This is used to filter by event and manipulate (add data or modify) the context such that the workflow engine is interacting
 * with the data in context depending on certain scenarios.
 *
 * Interceptors are cached instances and should be treated as singletons and is NOT thread safe. Instance variables should be treated as constants.
 */
class Interceptor {
  /**
   * All Interceptors should overwrite this method and mutate the context as needed.
   * By default returns the context unchanged.
   */
  async process (context) {
    return context
  }
}

module.exports = Interceptor


/***/ }),

/***/ 517:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)
const deepValidation = __webpack_require__(837)
const constructOutput = __webpack_require__(406)
const consolidateResult = __webpack_require__(136)
const constructError = __webpack_require__(958)

class Project extends Validator {
  constructor () {
    super('project')
    this.supportedEvents = [
      'pull_request.opened',
      'pull_request.edited',
      'pull_request_review.submitted',
      'pull_request_review.edited',
      'pull_request_review.dismissed',
      'pull_request.labeled',
      'pull_request.milestoned',
      'pull_request.demilestoned',
      'pull_request.assigned',
      'pull_request.unassigned',
      'pull_request.unlabeled',
      'pull_request.synchronize',
      'pull_request.push_synchronize',
      'issues.*'
    ]
    this.supportedSettings = {
      must_include: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string'
      }
    }
  }

  async validate (context, validationSettings) {
    const pr = this.getPayload(context)
    let projectName = validationSettings.must_include &&
      validationSettings.must_include.regex

    const MATCH_NOT_FOUND_ERROR = `Failed to run the test because 'match' is not provided for 'project' option. Please check README for more information about configuration`
    const DEFUALT_SUCCESS_MESSAGE = 'Required Project is present'
    let description = validationSettings.message ||
      `Must be in the "${projectName}" project.`

    let projects = await getProjects(context)
    const validatorContext = {name: 'project'}
    if (!projectName) {
      return consolidateResult([constructError('project', projects, validationSettings, MATCH_NOT_FOUND_ERROR)], validatorContext)
    }

    const regex = new RegExp(projectName, 'i')

    let projIds = projects.filter(project => regex.test(project.name)).map(project => project.id)
    let projectCards = await getProjectCards(context, projIds)
    const idsFromCards = extractIssueIdsFromCards(pr, projectCards)
    let isMergeable = idsFromCards.includes(String(pr.number))

    if (!isMergeable) { // do deep validation
      const issuesPrCloses = deepValidation.checkIfClosesAnIssue(pr.body)

      isMergeable = issuesPrCloses.some(issue => idsFromCards.includes(issue))
    }
    return consolidateResult([constructOutput(validatorContext, projects.map(proj => proj.name), validationSettings, {
      status: isMergeable ? 'pass' : 'fail',
      description: isMergeable ? DEFUALT_SUCCESS_MESSAGE : description
    })], validatorContext)
  }
}

const extractIssueIdsFromCards = (pr, cards) => {
  let ids = []
  let issueUrl = pr.head.repo.issues_url
  issueUrl = issueUrl.substring(0, issueUrl.length - ('{/number}').length)

  for (let card of cards) {
    const match = card.indexOf(issueUrl)

    if (match !== -1) {
      ids.push(card.substring(match + issueUrl.length + 1))
    }
  }

  return ids
}

const getProjects = async (context) => {
  const res = await context.github.projects.listForRepo(
    context.repo()
  )

  return res.data.map(project => ({id: project.id, name: project.name}))
}

const getProjectCards = async (context, projIds) => {
  let cards = []

  // get all the project columns
  for (let i = 0; i < projIds.length; i++) {
    let res = await context.github.projects.listColumns({project_id: projIds[i]})
    const columnIds = res.data.map(project => project.id)

    res = await Promise.all(columnIds.map(id => context.github.projects.listCards({column_id: id})))
    res.forEach(card => {
      cards = cards.concat(card.data)
    })
  }

  return cards.map(card => card.content_url)
}

module.exports = Project


/***/ }),

/***/ 536:
/***/ (function(module) {

module.exports = eval("require")("moment-timezone");


/***/ }),

/***/ 537:
/***/ (function(module) {

module.exports = eval("require")("probot-scheduler");


/***/ }),

/***/ 543:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Action } = __webpack_require__(394)
const MetaData = __webpack_require__(759)
const populateTemplate = __webpack_require__(615)
const logger = __webpack_require__(410)
const _ = __webpack_require__(356)

const createChecks = async (context, payload) => {
  let params = _.cloneDeep(payload)
  params.name = createCheckName(params.name)

  // Note: octokit (wrapped by probot) requires head_branch.
  // Contradicting API docs that only requires head_sha
  // --> https://developer.github.com/v3/checks/runs/#create-a-check-run
  if (context.payload.checksuite) {
    params.head_branch = context.payload.checksuite.head_branch
    params.head_sha = context.payload.checksuite.head_sha
  } else {
    params.head_branch = context.payload.pull_request.head.ref
    params.head_sha = context.payload.pull_request.head.sha
  }

  let log = logger.create('action/checks')
  log.debug(`Creating Check for ${context.payload.repository.full_name} - status=${params.status}`)
  log.debug(params)
  return context.github.checks.create(context.repo(params))
}

const createCheckName = (name) => {
  return _.isUndefined(name) ? 'Mergeable' : `Mergeable: ${name}`
}

const updateChecks = async (context, id, name, status, conclusion, output) => {
  if (!output) {
    output = {
      title: 'Test SUCCESS output',
      summary: 'Success summary'
    }
  }

  status = !status ? 'completed' : status
  conclusion = !conclusion ? 'success' : conclusion

  let log = logger.create('action/checks')
  let params = updateParams({context, name, status, output, id, conclusion})
  log.debug(`Updating Check for ${context.payload.repository.full_name} - status=${status}`)
  log.debug(params)
  await context.github.checks.update(params)
}

const updateParams = ({context, id, name, status, output, conclusion}) => {
  return context.repo({
    name: name,
    status: status,
    output: output,
    check_run_id: id,
    conclusion: conclusion,
    completed_at: new Date()
  })
}

class Checks extends Action {
  constructor () {
    super('checks')
    this.supportedEvents = [
      'pull_request.opened',
      'pull_request.edited',
      'pull_request_review.submitted',
      'pull_request_review.edited',
      'pull_request_review.dismissed',
      'pull_request.labeled',
      'pull_request.milestoned',
      'pull_request.demilestoned',
      'pull_request.assigned',
      'pull_request.unassigned',
      'pull_request.unlabeled',
      'pull_request.synchronize',
      'pull_request.push_synchronize'
    ]
    this.checkRunResult = new Map()
  }

  async beforeValidate (context, settings, name) {
    const result = await createChecks(context, {
      status: 'in_progress',
      output: {
        title: 'Mergeable is running.',
        summary: `Please be patient. We'll get you the results as soon as possible.`
      },
      name: name,
      started_at: new Date()
    })

    this.checkRunResult.set(name, result)
  }

  populatePayloadWithResult (settings, results, context) {
    const output = {}
    Object.keys(settings).forEach(key => {
      output[key] = populateTemplate(settings[key], results, this.getPayload(context))
    })

    return output
  }

  async run ({ context, settings, payload }) {
    await createChecks(context, payload)
  }

  async afterValidate (context, settings, name, results) {
    const checkRunResult = this.checkRunResult.get(name)

    let payload = this.populatePayloadWithResult(settings.payload, results, context)

    if (payload.text !== undefined) {
      payload.text += MetaData.serialize({
        id: checkRunResult.data.id,
        event: context.event,
        action: context.payload.action
      })
    }

    await updateChecks(
      context,
      checkRunResult.data.id,
      createCheckName(name),
      settings.state,
      settings.status,
      payload)
  }
}

module.exports = Checks


/***/ }),

/***/ 549:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Action } = __webpack_require__(394)

const reviewComment = '**Mergeable Results**'
const staleResultComment = 'Mergeable results outdated'

const addReview = async (context, prNumber, reviewBody, eventType) => {
  return context.github.pulls.createReview(
    context.repo({ pull_number: prNumber, body: reviewBody, event: eventType })
  )
}

const getMergeableRequestChangesReviews = async (context, prNumber) => {
  const reviews = await context.github.pulls.listReviews(
    context.repo({ pull_number: prNumber })
  )
  const botName = process.env.APP_NAME ? process.env.APP_NAME : 'Mergeable'
  return reviews.data.filter(review => (review.user.login.toLowerCase() === `${botName.toLowerCase()}[bot]` && review.state === 'CHANGES_REQUESTED' && review.body.startsWith(reviewComment)))
}

const dismissReviews = async (context, prNumber, mergeableReviews) => {
  for (let review of mergeableReviews) {
    await context.github.pulls.dismissReview(
      context.repo({ pull_number: prNumber, review_id: review.id, message: staleResultComment })
    )
  }
}

const updateReviewComments = async (context, prNumber, mergeableReviews) => {
  for (let review of mergeableReviews) {
    await context.github.pulls.updateReview(
      context.repo({ pull_number: prNumber, review_id: review.id, body: staleResultComment })
    )
  }
}

class ResultsAsReview extends Action {
  constructor () {
    super('results_as_review')
    this.supportedEvents = [
      'pull_request.*'
    ]
  }

  // there is nothing to do
  async beforeValidate () {}

  async afterValidate (context, settings, name, results) {
    const payload = this.getPayload(context)
    const prNumber = payload.number

    // Dismiss any old reviews left by the github actions bot user
    const oldReviews = await getMergeableRequestChangesReviews(context, prNumber)
    await updateReviewComments(context, prNumber, oldReviews)
    await dismissReviews(context, prNumber, oldReviews)


    // Add a request changes review and a comment with the failures
    if (results.validationStatus === 'fail') {
      const validationErrors = []
      results.validationSuites.forEach(val => {
        val.validations.forEach(el => {
          if (el.status === 'fail') {
            validationErrors.push(' - ' + el.description)
          }
        })
      })
      return addReview(
        context,
        prNumber,
        reviewComment + '\n' + validationErrors.join('\n'),
        'REQUEST_CHANGES'
      )
    }
  }
}

module.exports = ResultsAsReview


/***/ }),

/***/ 553:
/***/ (function(module) {

class RequestedReviewers {
  static async process (payload, context) {
    return payload.requested_reviewers.map(user => user.login)
  }
}

module.exports = RequestedReviewers


/***/ }),

/***/ 558:
/***/ (function(module) {

/**
 * The Mergeable context is a wrapper and extension of the probot context with some convenience
 * methods (in the future).
 */
class Context {
  constructor (context) {
    this.probotContext = context
    this.event = context.event
    this.payload = context.payload
    this.github = context.github
    this.log = context.log
  }

  repo (obj) {
    return this.probotContext.repo(obj)
  }
}

module.exports = Context


/***/ }),

/***/ 578:
/***/ (function(__unusedmodule, __unusedexports, __webpack_require__) {

// Running as a github action
process.env.APP_NAME = 'github-actions'

// Set mergeable yml config to config_file input from Actions workflow if provided
if (process.env.INPUT_CONFIG_FILE) {
  process.env.CONFIG_PATH = process.env.INPUT_CONFIG_FILE
}

// Start Mergeable using the Probot Actions Adapter
const adapt = __webpack_require__(52)
const probot = __webpack_require__(622) // Mergeable
adapt(probot)


/***/ }),

/***/ 603:
/***/ (function(module, __unusedexports, __webpack_require__) {

const REGISTRY = [
  new (__webpack_require__(396))(),
  new (__webpack_require__(244))(),
  new (__webpack_require__(436))()
] // eslint-disable-line

/**
 * Processes all the interceptors in the order of the registry array.
 */
module.exports = async (context) => {
  await Promise.all(REGISTRY.map(interceptor => interceptor.process(context)))
}


/***/ }),

/***/ 615:
/***/ (function(module, __unusedexports, __webpack_require__) {

const handlebars = __webpack_require__(148)
const searchAndReplaceSpecialAnnotations = __webpack_require__(291)

handlebars.registerHelper('breaklines', function (text) {
  text = handlebars.Utils.escapeExpression(text)
  text = text.replace(/(\r\n|\n|\r|\n\n)/gm, '<br>')
  return new handlebars.SafeString(text)
})

handlebars.registerHelper('toUpperCase', function (str) {
  return str.toUpperCase()
})

handlebars.registerHelper('displaySettings', function (settings) {
  return `\`\`\`${JSON.stringify(settings)}\`\`\``
})

handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
  return (arg1 === arg2) ? options.fn(this) : options.inverse(this)
})

handlebars.registerHelper('statusIcon', function (str) {
  switch (str) {
    case 'pass':
      return ':heavy_check_mark:'
    case 'fail':
      return ':x:'
    case 'error':
      return ':heavy_exclamation_mark:'
    default:
      return `Unknown Status given: ${str}`
  }
})

const populateTemplate = (template, validationResult, payload) => {
  const newTemplate = searchAndReplaceSpecialAnnotations(template, payload)
  const handlebarsTemplate = handlebars.compile(newTemplate)
  return handlebarsTemplate(validationResult)
}

module.exports = populateTemplate


/***/ }),

/***/ 622:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Mergeable } = __webpack_require__(503)
const logger = __webpack_require__(410)

module.exports = (robot) => {
  logger.init(robot.log)
  let mergeable = new Mergeable(process.env.NODE_ENV)
  mergeable.start(robot)
}


/***/ }),

/***/ 627:
/***/ (function(module, __unusedexports, __webpack_require__) {

function __ncc_wildcard$0 (arg) {
  if (arg === "and.js" || arg === "and") return __webpack_require__(726);
  else if (arg === "begins_with.js" || arg === "begins_with") return __webpack_require__(811);
  else if (arg === "ends_with.js" || arg === "ends_with") return __webpack_require__(411);
  else if (arg === "max.js" || arg === "max") return __webpack_require__(641);
  else if (arg === "min.js" || arg === "min") return __webpack_require__(745);
  else if (arg === "must_exclude.js" || arg === "must_exclude") return __webpack_require__(169);
  else if (arg === "must_include.js" || arg === "must_include") return __webpack_require__(506);
  else if (arg === "no_empty.js" || arg === "no_empty") return __webpack_require__(859);
  else if (arg === "or.js" || arg === "or") return __webpack_require__(675);
  else if (arg === "required.js" || arg === "required") return __webpack_require__(918);
}
const consolidateResult = __webpack_require__(136)
const constructError = __webpack_require__(958)
const constructOutput = __webpack_require__(406)

/**
 * Validation Processor
 * Process tests on the input based on the set of rules
 *
 * Params must be in the follow format
 * validatorContext: {
 *   name: validatorName
 * }
 * Input: string or an Array to run test against
 *
 * Rules: [{
 *   option: either JSON object or Array of JSON objects
 * }]
 *
 * @param validatorContext
 * @param input
 * @param rules
 * @returns {{mergeable, description}}
 */

class Options {
  static process (validatorContext, input, rules, returnRawOutput) {
    const output = []
    if (!Array.isArray(rules)) {
      rules = [rules]
    }

    rules.forEach(rule => {
      Object.keys(rule).forEach(key => {
        if (key === 'do') return
        const setting = {}
        setting[key] = rule[key]
        try {
          if (validatorContext.supportedOptions && validatorContext.supportedOptions.indexOf(key) === -1) {
            output.push(constructError(validatorContext, input, setting, `The '${key}' option is not supported for '${validatorContext.name}' validator, please see README for all available options`))
          } else {
            const result = __ncc_wildcard$0(key).process(validatorContext, input, rule)
            output.push(constructOutput(validatorContext, input, setting, result))
          }
        } catch (err) {
          output.push(constructError(validatorContext, input, setting, err.message))
        }
      })
    })

    return returnRawOutput ? output : consolidateResult(output, validatorContext)
  }
}

module.exports = Options


/***/ }),

/***/ 641:
/***/ (function(module) {

const COUNT_NOT_FOUND_ERROR = `Failed to run the test because 'count' is not provided for 'max' option. Please check README for more information about configuration`
const UNKNOWN_INPUT_TYPE_ERROR = `Input type invalid, expected Array or Integer as input`

class Max {
  static process (validatorContext, input, rule) {
    const filter = rule.max

    let count = filter['count'] ? filter['count'] : filter
    let description = filter['message']
    if (typeof count !== 'number') {
      throw new Error(COUNT_NOT_FOUND_ERROR)
    }

    let isMergeable

    const DEFAULT_SUCCESS_MESSAGE = `${validatorContext.name} does have a maximum of '${count}'`
    if (!description) description = `${validatorContext.name} count is more than "${count}"`

    if (Array.isArray(input)) {
      isMergeable = input.length <= count
    } else if (Number.isInteger(input)) {
      isMergeable = input <= count
    } else {
      throw new Error(UNKNOWN_INPUT_TYPE_ERROR)
    }

    return {
      status: isMergeable ? 'pass' : 'fail',
      description: isMergeable ? DEFAULT_SUCCESS_MESSAGE : description
    }
  }
}

module.exports = Max


/***/ }),

/***/ 675:
/***/ (function(module, __unusedexports, __webpack_require__) {

const andOrProcessor = __webpack_require__(364)

class OrProcessor {
  static process (validatorContext, input, rule) {
    return andOrProcessor(validatorContext, input, rule, 'or')
  }
}

module.exports = OrProcessor


/***/ }),

/***/ 700:
/***/ (function(module) {

class TeamNotFoundError extends Error {
  constructor (message) {
    super(message)
    this.name = 'TeamNotFoundError'
  }
}

module.exports = TeamNotFoundError


/***/ }),

/***/ 707:
/***/ (function(module) {

module.exports = eval("require")("js-yaml");


/***/ }),

/***/ 713:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)

class Assignee extends Validator {
  constructor () {
    super('assignee')
    this.supportedEvents = [
      'pull_request.opened',
      'pull_request.edited',
      'pull_request_review.submitted',
      'pull_request_review.edited',
      'pull_request_review.dismissed',
      'pull_request.labeled',
      'pull_request.milestoned',
      'pull_request.demilestoned',
      'pull_request.assigned',
      'pull_request.unassigned',
      'pull_request.unlabeled',
      'pull_request.synchronize',
      'pull_request.push_synchronize',
      'issues.*'
    ]

    this.supportedSettings = {
      min: {
        count: 'number',
        message: 'string'
      },
      max: {
        count: 'number',
        message: 'string'
      }
    }
  }

  async validate (context, validationSettings) {
    let assignees = this.getPayload(context).assignees

    return this.processOptions(
      validationSettings,
      assignees.map(assignee => assignee.login)
    )
  }
}

module.exports = Assignee


/***/ }),

/***/ 714:
/***/ (function(module) {

const matchOneDirRegex = new RegExp(`\\/[*]$`, 'i')
const matchAllRegex = new RegExp('^[*]$', 'i')
const matchFileTypeRegex = new RegExp('^[*][\\.]\\w*$', 'i')
const matchAnyMiddleDirRegex = new RegExp('\\/[*]{2}\\/', 'i') // check if two stars exists in the middle
const matchtwoStarAtTheEndRegex = new RegExp('\\/[*]{2}$', 'i')
const matchtwoStarAtTheStartRegex = new RegExp('^[*]{2}\\/', 'i')

class GitPattern {
  static parseOwnerFile (content) {
    const owners = parseGitPatten(content)

    return {
      for: (path) => {
        let res = []
        owners.filter(([globs]) => {
          return !globs || globs.split(' ').find(glob => this.checkIfPathMatches(path, glob))
        }).forEach(owners => {
          res = owners.slice(1)
        })
        return res
      }
    }
  }

  static checkIfPathMatches (path, toMatch) {
    if (matchAllRegex.test(toMatch)) {
      return true
    }
    if (matchFileTypeRegex.exec(toMatch)) {
      const file = getFileName(path)
      const regex = new RegExp(toMatch.slice(1), 'i')
      return regex.test(file)
    }
    // all the simple cases are matched, now to the complex regex string
    const regex = createRegexToMatch(toMatch)
    if (path.charAt(0) === '/') {
      path = path.slice(1)
    }

    return regex.test(path)
  }
}

const createRegexToMatch = (toMatch) => {
  let regexString = ''
  const onlyRootMatch = toMatch.charAt(0) === '/'
  if (onlyRootMatch) {
    toMatch = toMatch.substring(1)
    regexString += `^`
  }

  const matchOneDir = matchOneDirRegex.test(toMatch)
  if (matchOneDir) {
    toMatch = toMatch.substring(0, toMatch.length - 1)
  }

  const matchAnyMiddleDir = matchAnyMiddleDirRegex.test(toMatch)
  if (matchAnyMiddleDir) {
    toMatch = toMatch.replace('/**/', `\\/(\\w*\\/)*`)
  }

  const matchtwoStarAtTheEnd = matchtwoStarAtTheEndRegex.test(toMatch)

  if (matchtwoStarAtTheEnd) {
    toMatch = toMatch.replace('/**', `\\/`)
  }

  const matchtwoStarAtTheStart = matchtwoStarAtTheStartRegex.test(toMatch)

  if (matchtwoStarAtTheStart) {
    toMatch = toMatch.replace('**/', ``)
  }

  regexString += toMatch

  if (matchOneDir) {
    regexString += `\\w*[.]?\\w*$`
  }
  return new RegExp(regexString, 'i')
}

const getFileName = (path) => {
  const regex = new RegExp(`\\/\\w+[.](\\w*)$`, 'i')
  const fileName = regex.exec(path)
  if (fileName) {
    return fileName[0].substring(1)
  }
  return fileName
}

const parseGitPatten = (content) => {
  let lines = content.split(/\r\n|\n/)
  return parse(lines)
}

const parse = (arr) => {
  arr = arrayify(arr)
  let output = []

  arr.forEach(str => {
    str = (str || '').trim()

    // skip comments
    if (str && str.charAt(0) !== '#') {
      const parsedArray = []

      str.split(' ').forEach(string => {
        if (string !== '') {
          parsedArray.push(string)
        }
      })

      output.push(parsedArray)
    }
  })
  return output
}

const arrayify = (val) => {
  return Array.isArray(val) ? val : [val]
}

module.exports = GitPattern


/***/ }),

/***/ 719:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Action } = __webpack_require__(394)

const closeIssue = async (context, issueNumber) => {
  return context.github.issues.update(
    context.repo({ issue_number: issueNumber, state: 'closed' })
  )
}

class Close extends Action {
  constructor () {
    super('close')
    this.supportedEvents = [
      'pull_request.*',
      'issues.*'
    ]
  }

  // there is nothing to do
  async beforeValidate () {}

  async afterValidate (context, settings, name, results) {
    const payload = this.getPayload(context)
    const issueNumber = payload.number

    return closeIssue(
      context,
      issueNumber
    )
  }
}

module.exports = Close


/***/ }),

/***/ 726:
/***/ (function(module, __unusedexports, __webpack_require__) {

const andOrProcessor = __webpack_require__(364)

class AndProcessor {
  static process (validatorContext, input, rule) {
    return andOrProcessor(validatorContext, input, rule, 'and')
  }
}

module.exports = AndProcessor


/***/ }),

/***/ 729:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)

class Description extends Validator {
  constructor () {
    super('description')
    this.supportedEvents = [
      'pull_request.opened',
      'pull_request.edited',
      'pull_request_review.submitted',
      'pull_request_review.edited',
      'pull_request_review.dismissed',
      'pull_request.labeled',
      'pull_request.milestoned',
      'pull_request.demilestoned',
      'pull_request.assigned',
      'pull_request.unassigned',
      'pull_request.unlabeled',
      'pull_request.synchronize',
      'pull_request.push_synchronize',
      'issues.*'
    ]
    this.supportedSettings = {
      no_empty: {
        enabled: 'boolean',
        message: 'string'
      },
      must_include: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string'
      },
      must_exclude: {
        regex: 'string',
        regex_flag: 'string',
        message: 'string'
      },
      begins_with: {
        match: ['string', 'array'],
        message: 'string'
      },
      ends_with: {
        match: ['string', 'array'],
        message: 'string'
      },
      min: {
        count: 'number',
        message: 'string'
      },
      max: {
        count: 'number',
        message: 'string'
      }
    }
  }

  async validate (context, validationSettings) {
    let description = this.getPayload(context).body

    return this.processOptions(
      validationSettings,
      description
    )
  }
}

module.exports = Description


/***/ }),

/***/ 745:
/***/ (function(module) {

const COUNT_NOT_FOUND_ERROR = `Failed to run the test because 'count' is not provided for 'min' option. Please check README for more information about configuration`
const UNKNOWN_INPUT_TYPE_ERROR = `Input type invalid, expected Array as input`

class Min {
  static process (validatorContext, input, rule) {
    const filter = rule.min

    let count = filter['count'] ? filter['count'] : filter
    let description = filter['message']
    if (typeof count !== 'number') {
      throw new Error(COUNT_NOT_FOUND_ERROR)
    }

    let isMergeable

    const DEFAULT_SUCCESS_MESSAGE = `${validatorContext.name} does have a minimum of '${count}'`
    if (!description) description = `${validatorContext.name} count is less than "${count}"`

    if (Array.isArray(input)) {
      isMergeable = !(input.length < count)
    } else {
      throw new Error(UNKNOWN_INPUT_TYPE_ERROR)
    }

    return {
      status: isMergeable ? 'pass' : 'fail',
      description: isMergeable ? DEFAULT_SUCCESS_MESSAGE : description
    }
  }
}

module.exports = Min


/***/ }),

/***/ 759:
/***/ (function(module) {


const DATA_START = '<!-- #mergeable-data'
const DATA_END = '#mergeable-data -->'

/**
 * Utility class to serialize/deserialuze a json/string to be appended to any text element in a
 * GH check_run, issue body, pull body, comments, etc.
 * i.e. <!-- #mergeable-data { "id": "123", "event": "pull_request", "action": "unlabeled" } #mergeable-data -->
 *
 * This is primarily used to store meta-data to be retrieved later in a payload/webhook.
 * Since all of these elements in GH is markdown the text is in a HTML comment that will be hidden to the user.
 *
 */
class MetaData {
  /**
   * @return a string representation of the meta-data
   */
  static serialize (json) {
    return `${DATA_START} ${JSON.stringify(json)} ${DATA_END}`
  }

  /**
   * @return true if meta data exists in a string.
   */
  static exists (text) {
    return (text !== undefined && text.indexOf(DATA_START) !== -1 && text.indexOf(DATA_END) !== -1)
  }

  /**
   * @return the jsob object in a string that contains the serialized meta-data.
   */
  static deserialize (text) {
    let begin = text.indexOf(DATA_START) + DATA_START.length
    let end = text.indexOf(DATA_END)
    let jsonString = text.substring(begin, end)
    return JSON.parse(jsonString.trim())
  }
}

module.exports = MetaData


/***/ }),

/***/ 770:
/***/ (function(module, __unusedexports, __webpack_require__) {

const createPromises = __webpack_require__(986)

const getValidatorPromises = (context, registry, rule) => {
  const validateFuncCall = (validator, context, validation) => validator.processValidate(context, validation, registry)

  return createPromises(rule.validate, 'validators', validateFuncCall, context, registry)
}

module.exports = getValidatorPromises


/***/ }),

/***/ 803:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)
const andOrValidatorProcessor = __webpack_require__(233)

class Or extends Validator {
  constructor () {
    super('or')
    this.supportedEvents = [
      '*'
    ]
    this.supportedOptions = [
      'validate'
    ]
    this.supportedSettings = {}
  }

  async validate (context, validationSettings, registry) {
    return andOrValidatorProcessor(context, validationSettings.validate, registry, 'Or')
  }

  // skip validating settings
  validateSettings (supportedSettings, settingToCheck) {}
}

module.exports = Or


/***/ }),

/***/ 811:
/***/ (function(module) {

const MATCH_NOT_FOUND_ERROR = `Failed to run the test because 'match' is not provided for 'begins_with' option. Please check README for more information about configuration`
const UNKNOWN_MATCH_TYPE_ERROR = `'match' type invalid, expected string or Array type`
const UNKNOWN_INPUT_TYPE_ERROR = `Input type invalid, expected string or Array as input`

class BeginsWith {
  static process (validatorContext, input, rule) {
    const filter = rule.begins_with

    const match = filter['match']
    let description = filter['message']
    if (!match) {
      throw new Error(MATCH_NOT_FOUND_ERROR)
    }

    const DEFAULT_SUCCESS_MESSAGE = `${validatorContext.name} does begins with '${match}'`
    if (!description) description = `${validatorContext.name} must begins with "${match}"`

    let isMergeable

    try {
      isMergeable = checkIfMergeable(input, match)
    } catch (err) {
      throw new Error(UNKNOWN_INPUT_TYPE_ERROR)
    }

    return {
      status: isMergeable ? 'pass' : 'fail',
      description: isMergeable ? DEFAULT_SUCCESS_MESSAGE : description
    }
  }
}

function checkIfMergeable (input, match) {
  if (typeof input !== 'string' && !Array.isArray(input)) {
    throw new Error(UNKNOWN_INPUT_TYPE_ERROR)
  }

  if (typeof match !== 'string' && !Array.isArray(match)) {
    throw new Error(UNKNOWN_MATCH_TYPE_ERROR)
  }

  if (typeof input === 'string') {
    return checkIfInputMatches(match, (item) => input.indexOf(item) === 0)
  } else {
    return input.some(inputItem =>
      checkIfInputMatches(match, (matchItem) => inputItem.indexOf(matchItem) === 0)
    )
  }
}

function checkIfInputMatches (match, func) {
  if (typeof match === 'string') {
    return func(match)
  } else {
    return match.some(item => func(item))
  }
}

module.exports = BeginsWith


/***/ }),

/***/ 837:
/***/ (function(module) {

const CLOSES_ISSUE_REGEX = new RegExp(`\\b(closes?|closed|fix|fixes?|fixed|resolves?|resolved)\\b.#[0-9]*`, 'ig')

class DeepValidation {
  static checkIfClosesAnIssue (description) {
    let res
    let issues = []

    do {
      res = CLOSES_ISSUE_REGEX.exec(description)
      if (res) {
        const match = res[0].indexOf('#')
        issues.push(res[0].substr(match + 1))
      }
    } while (res)
    return issues
  }

  static async checkIfIssueHaveProperty (context, issues, property) {
    const output = []
    for (let i = 0; i < issues.length; i++) {
      const issue = await getIssue(context, issues[i])
      if (issue.data[property]) {
        output.push(issue.data[property])
      }
    }
    return output
  }
}

const getIssue = async (context, issueNumber) => {
  return context.github.issues.get(context.repo({ number: issueNumber }))
}

module.exports = DeepValidation


/***/ }),

/***/ 840:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Action } = __webpack_require__(394)

const addLabels = async (context, issueNumber, labels) => {
  return context.github.issues.addLabels(
    context.repo({ issue_number: issueNumber, labels })
  )
}

class Labels extends Action {
  constructor () {
    super('labels')
    this.supportedEvents = [
      'pull_request.*',
      'issues.*'
    ]
  }

  // there is nothing to do
  async beforeValidate () {}

  async afterValidate (context, settings, name, results) {
    const payload = this.getPayload(context)
    const issueNumber = payload.number

    const labelsToCreate = {
      labels: settings.labels
    }

    return addLabels(
      context,
      issueNumber,
      labelsToCreate
    )
  }
}

module.exports = Labels


/***/ }),

/***/ 855:
/***/ (function(module, __unusedexports, __webpack_require__) {

const gitPattern = __webpack_require__(714)
const Teams = __webpack_require__(313)
const _ = __webpack_require__(356)

class Owner {
  static async process (payload, context) {
    const CODEOWNERS = await retrieveCODEOWNER(context, payload.number)

    if (CODEOWNERS === null) return []

    const owners = gitPattern.parseOwnerFile(CODEOWNERS)

    const compare = await context.github.repos.compareCommits(context.repo({
      base: payload.base.sha,
      head: payload.head.sha
    }))

    const paths = compare.data.files.map(file => file.filename)

    let ownerList = []

    paths.forEach(path => {
      const res = owners.for(path)
      if (res.length > 0) {
        ownerList = res
      }
    })

    // since requiredOwners could be email addresses make sure
    ownerList = await extractUserId(ownerList)

    const { teams, individuals } = this.separateTeamsAndIndividuals(ownerList)
    let requiredIndividuals = individuals
    let teamMembers = []
    if (teams.length > 0) {
      try {
        teamMembers = Teams.extractTeamMembers(teams)
      } catch (err) {
        throw err
      }
    }

    return _.union(teamMembers, requiredIndividuals)
  }

  static separateTeamsAndIndividuals (owners) {
    let teams = []
    let individuals = []
    owners.forEach(owner => {
      if (owner.includes('/')) teams.push(owner)
      else individuals.push(owner)
    })

    return { teams, individuals }
  }
}

const extractUserId = async (owners) => {
  return owners.map(owner => {
    if (owner.charAt(0) === '@') {
      return owner.slice(1)
    } else if (EMAIL_REGEX.test(owner)) {
      return owner
    } else {
      return owner
    }
  })
}

const retrieveCODEOWNER = async (context, pullNumber) => {
  // if PR contains a modified/added CODEOWNER, use that instead
  let github = context.github
  let repo = context.repo()

  if (['pull_request', 'pull_request_review'].includes(context.event)) {
    // get modified file list
    let result = await context.github.paginate(
      context.github.pulls.listFiles.endpoint.merge(
        context.repo({ pull_number: pullNumber })
      ),
      res => res.data
    )

    let modifiedFiles = result
      .filter(file => ['modified', 'added'].includes(file.status))
      .map(file => file.filename)

    // check if config file is in that list

    if (modifiedFiles.includes(OWNER_FILE_PATH)) {
      // if yes return, return below else do nothing
      return github.repos.getContents({
        owner: repo.owner,
        repo: repo.repo,
        path: OWNER_FILE_PATH,
        ref: context.payload.pull_request.head.sha
      }).then(response => {
        return Buffer.from(response.data.content, 'base64').toString()
      })
    }
  }

  return context.github.repos.getContents(context.repo({
    path: OWNER_FILE_PATH
  })).then(res => {
    return Buffer.from(res.data.content, 'base64').toString()
  }).catch(error => {
    if (error.code === 404) return null
    else throw error
  })
}

const OWNER_FILE_PATH = `.github/CODEOWNERS`
const EMAIL_REGEX = new RegExp(`(?:[a-z0-9!#$%&'*+/=?^_\`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_\`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\\])`, 'i')

module.exports = Owner


/***/ }),

/***/ 859:
/***/ (function(module) {

const ENABLED_NOT_FOUND_ERROR = `Failed to run the test because 'enabled' is not provided for 'no_empty' option. Please check README for more information about configuration`
const UNKNOWN_INPUT_TYPE_ERROR = `Input type invalid, expected string as input`

class NoEmpty {
  static process (validatorContext, input, rule) {
    const filter = rule.no_empty

    const enabled = filter['enabled']
    let description = filter['message']
    if (!enabled && enabled !== false) {
      throw new Error(ENABLED_NOT_FOUND_ERROR)
    }

    if (enabled === false) {
      return {
        status: 'pass',
        description: 'No_empty option is not enabled, as such this validator did not run'
      }
    }

    let isMergeable

    const DEFAULT_SUCCESS_MESSAGE = `The ${validatorContext.name} is not empty`
    if (!description) description = `The ${validatorContext.name} can't be empty`

    if (typeof input === 'string') {
      isMergeable = input.trim().length !== 0
    } else if (Array.isArray(input)) {
      isMergeable = input.length !== 0
    } else {
      throw new Error(UNKNOWN_INPUT_TYPE_ERROR)
    }

    return {
      status: isMergeable ? 'pass' : 'fail',
      description: isMergeable ? DEFAULT_SUCCESS_MESSAGE : description
    }
  }
}

module.exports = NoEmpty


/***/ }),

/***/ 862:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Validator } = __webpack_require__(333)
const _ = __webpack_require__(356)
const minimatch = __webpack_require__(955)
const constructOutput = __webpack_require__(406)
const consolidateResult = __webpack_require__(136)
const constructError = __webpack_require__(958)

class Dependent extends Validator {
  constructor () {
    super('dependent')
    this.supportedEvents = [
      'pull_request.opened',
      'pull_request.edited',
      'pull_request_review.submitted',
      'pull_request_review.edited',
      'pull_request_review.dismissed',
      'pull_request.labeled',
      'pull_request.milestoned',
      'pull_request.demilestoned',
      'pull_request.assigned',
      'pull_request.unassigned',
      'pull_request.unlabeled',
      'pull_request.synchronize',
      'pull_request.push_synchronize'
    ]
    this.supportedSettings = {
      files: 'array',
      message: 'string',
      changed: {
        file: 'string',
        required: 'array',
        files: 'array'
      }
    }
  }

  async validate (context, validationSettings) {
    let dependentFiles = validationSettings.files

    const FILE_NOT_FOUND_ERROR = `Failed to validate because the 'file' sub option for 'changed' option is missing. Please check the documentation`
    const FILES_NOT_FOUND_ERROR = `Failed to validate because the 'files' or 'changed' option is missing. Please check the documentation.`
    const DEFUALT_SUCCESS_MESSAGE = 'All the Dependents files are present!'

    // fetch the file list
    let result = await context.github.paginate(
      context.github.pulls.listFiles.endpoint.merge(
        context.repo({ pull_number: this.getPayload(context).number })
      ),
      res => res.data
    )

    let modifiedFiles = result
      .filter(file => file.status === 'modified' || file.status === 'added')
      .map(file => file.filename)
    const validatorContext = {name: 'Dependent'}

    if (!dependentFiles && !validationSettings.changed) {
      return consolidateResult([constructError('Dependent', modifiedFiles, validationSettings, FILES_NOT_FOUND_ERROR)], validatorContext)
    }

    let isMergeable
    let fileDiff
    // when changed option is specified, the validator uses this instead as it's files to validate
    if (validationSettings.changed) {
      if (_.isUndefined(validationSettings.changed.file)) {
        return consolidateResult([constructError('Dependent', modifiedFiles, validationSettings, FILE_NOT_FOUND_ERROR)], validatorContext)
      }
      dependentFiles = modifiedFiles.some((filename) => minimatch(filename, validationSettings.changed.file))
        ? validationSettings.changed.required ? validationSettings.changed.required : validationSettings.changed.files
        : []

      fileDiff = _.difference(dependentFiles, modifiedFiles)
      isMergeable = fileDiff.length === 0
    } else {
      fileDiff = _.difference(dependentFiles, modifiedFiles)
      isMergeable = fileDiff.length === dependentFiles.length || fileDiff.length === 0
    }

    let description = validationSettings.message ||
      `One or more files (${fileDiff.join(', ')}) are missing from your pull request because they are dependent on the following: ${_.difference(dependentFiles, fileDiff)}`

    const output = [constructOutput('Dependent', modifiedFiles, validationSettings, {
      status: isMergeable ? 'pass' : 'fail',
      description: isMergeable ? DEFUALT_SUCCESS_MESSAGE : description
    })]

    return consolidateResult(output, validatorContext)
  }
}

module.exports = Dependent


/***/ }),

/***/ 869:
/***/ (function(module) {

module.exports = eval("require")("colors");


/***/ }),

/***/ 872:
/***/ (function(module) {

class Assignees {
  static async process (payload, context) {
    return payload.assignees.map(user => user.login)
  }
}

module.exports = Assignees


/***/ }),

/***/ 877:
/***/ (function(module, __unusedexports, __webpack_require__) {

const consts = __webpack_require__(327)
const Configuration = __webpack_require__(38)

const simpleConfigMapping = {
  assignee: (num) => ({do: 'assignee',
    min: {
      count: num
    }}),
  label: (string) => ({do: 'label',
    must_exclude: {
      regex: string
    }}),
  title: (string) => ({do: 'title',
    must_exclude: {
      regex: string
    }}),
  approvals: (num) => ({do: 'approvals',
    min: {
      count: num
    }}),
  milestone: (string) => ({do: 'milestone',
    must_include: {
      regex: string
    }}),
  project: (string) => ({do: 'project',
    must_include: {
      regex: string
    }
  })
}

class V1Config {
  static transform (config) {
    config = config.mergeable
    const output = []

    if (config.issues) {
      output.push(processValidators('issues.*', config.issues, {pass: [], fail: consts.DEFAULT_ISSUES_FAIL, error: consts.DEFAULT_ISSUES_ERROR}))
      processStale('issues', config.issues, output)
    }

    if (config.pull_requests) {
      output.push(processValidators('pull_request.*', config.pull_requests, {pass: consts.DEFAULT_PR_PASS, fail: consts.DEFAULT_PR_FAIL, error: consts.DEFAULT_PR_ERROR}))
      output.push(processValidators('pull_request_review.*', config.pull_requests, {pass: consts.DEFAULT_PR_PASS, fail: consts.DEFAULT_PR_FAIL, error: consts.DEFAULT_PR_ERROR}))
      processStale('pull_request', config.pull_requests, output)
    }
    if (!config.pull_requests && !config.issues) {
      output.push(processValidators('pull_request.*', config, {pass: consts.DEFAULT_PR_PASS, fail: consts.DEFAULT_PR_FAIL, error: consts.DEFAULT_PR_ERROR}))
      output.push(processValidators('pull_request_review.*', config, {pass: consts.DEFAULT_PR_PASS, fail: consts.DEFAULT_PR_FAIL, error: consts.DEFAULT_PR_ERROR}))
    }
    return {mergeable: output}
  }
}

const processStale = (type, config, output) => {
  const stale = config.stale
  if (stale) {
    output.push({
      when: 'schedule.repository',
      validate: [{
        do: 'stale',
        days: stale.days,
        type: type
      }],
      pass: [ { do: 'comment', payload: { body: stale.message || Configuration.DEFAULTS.stale.message } } ]
    })
  }
}

const processValidators = (event, config, options) => {
  // first take care of exclude
  if (config.exclude) {
    const excludeList = config.exclude.split(',')
    excludeList.push('exclude') // also needs to remove exclude

    excludeList.forEach(item => {
      delete config[item.trim()]
    })
  }

  const validate = Object.keys(config).filter(validator => validator !== 'stale').map(validator => {
    const value = config[validator]

    if (typeof value !== 'object') {
      return simpleConfigMapping[validator](value)
    }

    if (validator === 'description' &&
      (typeof value.no_empty === 'boolean' ||
      value['no-empty'] !== undefined)
    ) {
      let enabled = (typeof value.no_empty === 'boolean')
        ? value.no_empty : value['no-empty'].enabled || value['no-empty']
      return {
        do: 'description',
        no_empty: { enabled: enabled }
      }
    }

    return Object.assign(value, {'do': validator})
  })

  return Object.assign({ when: event, validate }, options)
}

module.exports = V1Config


/***/ }),

/***/ 883:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Action } = __webpack_require__(394)
const _ = __webpack_require__(356)

const createRequestReview = async (context, number, reviewers) => {
  return context.github.pulls.createReviewRequest(
    context.repo({ pull_number: number, reviewers })
  )
}

const fetchCollaborators = async (context) => {
  return context.github.repos.listCollaborators(
    context.repo()
  )
}

class RequestReview extends Action {
  constructor () {
    super('request_review')
    this.supportedEvents = [
      'pull_request.*'
    ]
  }

  // there is nothing to do
  async beforeValidate () {}

  async afterValidate (context, settings, name, results) {
    const payload = this.getPayload(context)

    let requestedReviewer = payload.requested_reviewers.map(reviewer => reviewer.login)
    let reviewers = settings.reviewers
    let reviewerToRequest = _.difference(reviewers, requestedReviewer)
    let prNumber = payload.number

    // get Collaborators
    let rawCollaboratorsResult = await fetchCollaborators(context)
    let collaborators = rawCollaboratorsResult.data.map(user => user.login)

    // remove anyone in the array that is not a collaborator
    let collaboratorsToRequest = _.intersection(reviewerToRequest, collaborators)

    if (collaboratorsToRequest.length === 0) {
      return
    }
    return createRequestReview(
      context,
      prNumber,
      reviewerToRequest
    )
  }
}

module.exports = RequestReview


/***/ }),

/***/ 894:
/***/ (function(module) {

class UnSupportedSettingError extends Error {
  constructor (message) {
    super(message)
    this.name = 'UnSupportedSettingError'
  }
}

module.exports = UnSupportedSettingError


/***/ }),

/***/ 915:
/***/ (function(module, __unusedexports, __webpack_require__) {

const minimatch = __webpack_require__(955)
const { pick, mapKeys, isUndefined } = __webpack_require__(356)
const fetch = __webpack_require__(67)

const { Validator } = __webpack_require__(333)
const constructOutput = __webpack_require__(406)
const consolidateResult = __webpack_require__(136)
const constructErrorOutput = __webpack_require__(958)

const SINGLE_LINE_COMMENT_REGEXES = {
  '.js': /^\/\//i,
  '.py': /^#/i
}

const BLOCK_COMMENT_REGEXES = {
  '.js': {
    beginning: /\/\*/i,
    end: /\*\//i
  },
  '.py': null
}

class Size extends Validator {
  constructor () {
    super('size')
    this.supportedFileExtensionForCommentIgnore = [
      '.js',
      '.py'
    ]
    this.supportedEvents = [
      'pull_request.opened',
      'pull_request.edited',
      'pull_request_review.submitted',
      'pull_request_review.edited',
      'pull_request_review.dismissed',
      'pull_request.labeled',
      'pull_request.milestoned',
      'pull_request.demilestoned',
      'pull_request.assigned',
      'pull_request.unassigned',
      'pull_request.unlabeled',
      'pull_request.synchronize',
      'pull_request.push_synchronize'
    ]
    this.supportedSettings = {
      ignore: 'array',
      lines: {
        max: {
          count: 'number',
          message: 'string'
        },
        total: {
          count: 'number',
          message: 'string'
        },
        additions: {
          count: 'number',
          message: 'string'
        },
        deletions: {
          count: 'number',
          message: 'string'
        },
        ignore_comments: 'boolean'
      }
    }
  }

  async validate (context, validationSettings) {
    const ERROR_MESSAGE = `Failed to validate because the 'lines' or 'max / total', 'additions' or 'deletions' option is missing. Please check the documentation.`
    const ERROR_MAX_TOTAL = 'Options max and total cannot be used together. Please choose one'
    const VALIDATOR_NAME = 'Size'
    const validatorContext = {name: VALIDATOR_NAME}

    const patternsToIgnore = validationSettings.ignore || []
    const listFilesResult = await context.github.paginate(
      context.github.pulls.listFiles.endpoint.merge(
        context.repo({ pull_number: this.getPayload(context).number })
      ),
      res => res.data
    )

    let modifiedFiles
    if (validationSettings.lines && validationSettings.lines.ignore_comments) {
      modifiedFiles = await this.calculateChangesWithoutComments(this.getPayload(context).diff_url)
    } else {
      // Possible file statuses: added, modified, removed.
      modifiedFiles = listFilesResult
        .filter(file => !matchesIgnoredPatterns(file.filename, patternsToIgnore))
        .filter(file => file.status === 'modified' || file.status === 'added')
        .map(
          file => ({
            filename: file.filename,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes
          })
        )
    }

    let prSizeChanges = {
      additions: 0,
      deletions: 0,
      total: 0
    }

    modifiedFiles.forEach((file) => {
      prSizeChanges.additions += file.additions
      prSizeChanges.deletions += file.deletions
      prSizeChanges.total += file.changes
    })

    const inputMessage = `${prSizeChanges.total} total, ${prSizeChanges.additions} additions, ${prSizeChanges.deletions} deletions`

    if (!validationSettings.lines) {
      return consolidateResult(
        [
          constructErrorOutput(
            VALIDATOR_NAME,
            inputMessage,
            validationSettings,
            ERROR_MESSAGE
          )
        ],
        validatorContext
      )
    }

    // lets get available keys. must be either total, max, additions or deletions
    const prSize = pick(validationSettings.lines, ['additions', 'deletions', 'total', 'max'])

    if (!isUndefined(prSize.max) && !isUndefined(prSize.total)) {
      return consolidateResult(
        [
          constructErrorOutput(
            VALIDATOR_NAME,
            inputMessage,
            validationSettings,
            ERROR_MAX_TOTAL
          )
        ],
        validatorContext
      )
    }

    if (prSize.max) {
      prSize.total = prSize.max
      delete prSize.max
    }
    let output = []

    mapKeys(prSize, (value, key) => {
      const isMergeable = prSizeChanges[key] <= value.count
      const message = key === 'total' ? 'total additions + deletions' : key
      const defaultFailMessage = `PR is too large. Should be under ${value.count} ${message}`
      const description = isMergeable
        ? `PR size for ${message} is OK!`
        : value.message || defaultFailMessage
      const result = {
        status: isMergeable ? 'pass' : 'fail',
        description: description
      }

      output.push(constructOutput(
        validatorContext,
        inputMessage,
        validationSettings,
        result
      ))
    })

    if (output.length === 0) {
      return consolidateResult(
        [
          constructErrorOutput(
            VALIDATOR_NAME,
            inputMessage,
            validationSettings,
            ERROR_MESSAGE
          )
        ],
        validatorContext
      )
    }

    return consolidateResult(output, validatorContext)
  }

  async calculateChangesWithoutComments (url) {
    const response = await fetch(url)
    const diffs = await response.text()
    const files = diffs.split('diff --git')
    files.shift()

    const processedFiles = []

    for (let file of files) {
      const filename = extractFileName(file)
      const fileExtension = extractFileExtension(filename)

      const lines = file.split('\n')

      if (file.includes('deleted')) continue

      const addOrDeleteRegex = new RegExp(/^(\+|-)/i)
      const fileModifierRegex = new RegExp(/(\+\+\+|---)/i)
      const singleLineCommentRegex = new RegExp(SINGLE_LINE_COMMENT_REGEXES[fileExtension])

      let additions = 0
      let deletions = 0
      let isBlockCommentActive = false
      for (let line of lines) {
        if (addOrDeleteRegex.test(line) && !fileModifierRegex.test(line)) {
          if (this.supportedFileExtensionForCommentIgnore.includes(fileExtension)) {
            const lineContent = line.substring(1).trim()
            if (singleLineCommentRegex.test(lineContent)) continue

            if (BLOCK_COMMENT_REGEXES[fileExtension] !== null) {
              const blockCommentStartRegex = new RegExp(BLOCK_COMMENT_REGEXES[fileExtension].beginning)
              const blockCommentEndRegex = new RegExp(BLOCK_COMMENT_REGEXES[fileExtension].end)

              if (isBlockCommentActive) {
                if (blockCommentEndRegex.test(lineContent)) isBlockCommentActive = false
                continue
              } else if (blockCommentStartRegex.test(lineContent)) {
                if (!blockCommentEndRegex.test(lineContent)) {
                  isBlockCommentActive = true
                }
                continue
              }
            }
          }

          const plusOrMinus = line[0]
          if (plusOrMinus === '+') additions++
          else deletions++
        }
      }

      processedFiles.push({
        filename: filename,
        additions,
        deletions,
        changes: additions + deletions
      })
    }

    return processedFiles
  }
}

const extractFileExtension = (filename) => {
  const fileExtensionRegex = new RegExp(/\.[0-9a-z]+$/i)

  const matches = filename.match(fileExtensionRegex)
  return matches ? matches[0] : matches
}

const extractFileName = (file) => {
  const startIndex = file.indexOf('+++ b/')
  const endIndex = file.indexOf('\n', startIndex)

  return file.substring(startIndex + 6, endIndex)
}

const matchesIgnoredPatterns = (filename, patternsToIgnore) => (
  patternsToIgnore.some((ignorePattern) => minimatch(filename, ignorePattern))
)

module.exports = Size


/***/ }),

/***/ 918:
/***/ (function(module) {

const UNKNOWN_INPUT_TYPE_ERROR = `Input type invalid, expected array of string as input`

class Required {
  static process (validatorContext, input, rule) {
    const filter = rule.required

    const reviewers = filter['reviewers'] ? filter['reviewers'] : []
    const owners = filter['owners'] ? filter['owners'] : []
    const assignees = filter['assignees'] ? filter['assignees'] : []
    const requestedReviewers = filter['requested_reviewers'] ? filter['requested_reviewers'] : []
    let description = filter['message']

    if (!Array.isArray(input)) {
      throw new Error(UNKNOWN_INPUT_TYPE_ERROR)
    }

    // go thru the required list and check against inputs
    let remainingRequired = new Map(reviewers.map(user => [user.toLowerCase(), user]))
    input.forEach(user => remainingRequired.delete(user.toLowerCase()))

    const isMergeable = remainingRequired.size === 0

    const requiredReviewers = Array.from(remainingRequired.values()).map(user => {
      if (owners.includes(user)) {
        return user + '(Code Owner) '
      }
      if (assignees.includes(user)) {
        return user + '(Assignee) '
      }
      if (requestedReviewers.includes(user)) {
        return user + '(Requested Reviewer) '
      }

      return user + ' '
    })

    const DEFAULT_SUCCESS_MESSAGE = `${validatorContext.name}: all required reviewers have approved`
    if (!description) description = `${validatorContext.name}: ${requiredReviewers}required`

    return {
      status: isMergeable ? 'pass' : 'fail',
      description: isMergeable ? DEFAULT_SUCCESS_MESSAGE : description
    }
  }
}

module.exports = Required


/***/ }),

/***/ 929:
/***/ (function(module, __unusedexports, __webpack_require__) {

const { Action } = __webpack_require__(394)
const searchAndReplaceSpecialAnnotations = __webpack_require__(291)

const addAssignees = async (context, issueNumber, assignees) => {
  return context.github.issues.addAssignees(
    context.repo({ issue_number: issueNumber, assignees })
  )
}

const isValidAssignee = (assignee) => {
  return assignee.status === 204
}

const checkAssignee = async (context, issueNumber, assignee) => {
  const checkResult = await context.github.issues.checkAssignee(
    context.repo({ issue_number: issueNumber, assignee })
  ).catch(err => {
    if (err.status === 404) return { status: 404 }
  })

  return isValidAssignee(checkResult) ? assignee : null
}

class Assign extends Action {
  constructor () {
    super('assign')
    this.supportedEvents = [
      'pull_request.*',
      'issues.*'
    ]
  }

  // there is nothing to do
  async beforeValidate () {}

  async afterValidate (context, settings, name, results) {
    const payload = this.getPayload(context)
    const issueNumber = payload.number
    const assignees = settings.assignees.map(assignee => searchAndReplaceSpecialAnnotations(assignee, payload))
    const checkResults = await Promise.all(assignees.map(assignee => checkAssignee(context, issueNumber, assignee)))

    const authorizedAssignees = checkResults.filter(assignee => assignee !== null)

    return addAssignees(context, issueNumber, authorizedAssignees)
  }
}

module.exports = Assign


/***/ }),

/***/ 955:
/***/ (function(module) {

module.exports = eval("require")("minimatch");


/***/ }),

/***/ 958:
/***/ (function(module, __unusedexports, __webpack_require__) {

const constructOuput = __webpack_require__(406)

module.exports = (validatorContext, input, rule, error, errorDetails) => {
  return constructOuput(validatorContext, input, rule, {
    status: 'error',
    description: error
  }, errorDetails)
}


/***/ }),

/***/ 986:
/***/ (function(module) {

const createPromises = (arrayToIterate, registryName, funcCall, context, registry, name, result) => {
  let promises = []
  arrayToIterate.forEach(element => {
    let key = element.do

    let klass = registry[registryName].get(key)
    let eventName = `${context.event}.${context.payload.action}`
    if (klass.isEventSupported(eventName)) {
      promises.push(funcCall(klass, context, element, name, result))
    }
  })
  return promises
}

module.exports = createPromises


/***/ })

/******/ });