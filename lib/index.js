const lighthouse = require( 'lighthouse' )
const chromeLauncher = require( 'chrome-launcher' )
const chalk = require( 'chalk' )
const composeVideo = require( './compose-video' )
const computeMedianRun = require( './compute-median-run' )
const getScore = require( './get-score' )

async function run( urls = [], options = {} ) {
  const results = []

  await urls.reduce( async ( memo, url, index ) => {
    await memo
    const result = await getAverageScoreResult( url, options )
    results.push( result )
  }, Promise.resolve() )

  const traces = results.map( result => ( result.artifacts.traces.defaultPass || {} ) )

  await composeVideo( traces )
}

async function getAverageScoreResult( url, options = {} ) {
  const { repeatCount = 3, headless = false } = options

  const results = []
  const opts = {
    chromeFlags: headless ? [ '--headless' ] : [],
    onlyCategories: [ 'performance' ],
    port: options.port,
  }

  const config = {
    extends: 'lighthouse:default',
    settings: {
      onlyCategories: [ 'performance' ]
    }
  }

  if ( options.disableThrottling === true ) {
    config.settings.emulatedFormFactor = 'none'
    config.settings.throttlingMethod = 'provided',
    config.settings.throttling = {
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    }
  }

  console.log( `${ chalk.blue( 'Url' ) } ${ chalk.green( url ) } ${ chalk.dim( `(${ repeatCount } rounds)` ) }` )

  await new Array( repeatCount ).fill().reduce( async ( memo, current, index ) => {
    await memo
    const result = await runLighthouse( url, opts, config )

    console.log( `${ chalk.blue( `Round #${ index + 1 }` ) } score ${ getScore( result ) }` )
    results.push( result )
  }, Promise.resolve() )

  const medianResult = computeMedianRun( results )

  console.log( `${ chalk.blue( 'Median' ) } ${ getScore( medianResult ) }` )
  console.log()

  return medianResult
}

async function runLighthouse( url, opts, config = null ) {
  let chrome

  if ( !opts.port ) {
    chrome = await chromeLauncher.launch( { chromeFlags: opts.chromeFlags } )
    opts.port = chrome.port
  }

  const results = await lighthouse( url, opts, config )

  if ( chrome ) {
    await chrome.kill()
    delete opts.port
  }

  return results
}

module.exports = run
