const lighthouse = require( 'lighthouse' )
const chromeLauncher = require( 'chrome-launcher' )
const { nanoid } = require( 'nanoid' )
const fse = require( 'fs-extra' )
const fs = require( 'fs' )
const path = require( 'path' )
const speedline = require( 'speedline-core' )
const execa = require( 'execa' )
const tempy = require( 'tempy' )
const chalk = require( 'chalk' )
const tildify = require( 'tildify' )
const ffmpeg = require( '@ffmpeg-installer/ffmpeg' )

const FFMPEG_BINARY_PATH = ffmpeg.path

async function run( urls = [], options = {} ) {
  const results = []

  await urls.reduce( async ( memo, url, index ) => {
    await memo
    const result = await getAverageScoreResult( url, options )
    results.push( result )
  }, Promise.resolve() )

  console.log( 'Generating video...' )
  const videoPaths = await Promise.all( results.map( result => generateVideo( result ) ) )

  const filepath = path.join( process.cwd(), `record-${ Date.now() }.webm` )

  if ( videoPaths.length === 1 ) {
    await fse.copy( videoPaths[ 0 ], filepath )
  } else {
    console.log( 'Merging videos...' )
    await execa(
      FFMPEG_BINARY_PATH,
      (
        videoPaths.map( path => `-i ${ path }` ).join( ' ' ) +
        ` -filter_complex hstack ${ filepath }`
      ).split( ' ' )
    )
  }

  console.log( `Video has been saved to ${ tildify( filepath ) }` );
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

  results.sort( ( a, b ) => {
    return getScore( a ) - getScore( b )
  } )

  const index = middle( results.length ) - 1

  console.log( `${ chalk.blue( 'Median' ) } ${ getScore( results[ index ] ) }` )
  console.log()

  return results[ index ]
}

function getFrames( trace = {} ) {
  return speedline( trace ).then( ( { frames = [] } ) => {
    const root = tempy.directory()

    return {
      root,
      frames: frames.map( ( frame, index ) => {
        const filename = `${ index }.jpg`
        const buffer = frame.getImage()
        fs.writeFileSync( path.join( root, filename ), buffer )

        return {
          filename,
          timestamp: frame.getTimeStamp(),
          progress: frame.getPerceptualProgress(),
        }
      } )
    }
  } )
}

async function generateVideo( result ) {
  const trace = result.artifacts.traces.defaultPass || {}
  const { root, frames } = await getFrames( trace )

  fs.writeFileSync(
    path.join( root, 'frames.txt' ),
    frames.reduce( ( memo, frame, index ) => {
      let duration = 0

      if ( frames[ index + 1 ] ) {
        duration = ( frames[ index + 1 ].timestamp - frames[ index ].timestamp ) / 1000
      }

      memo = memo + `file '${ frame.filename }'\nduration ${ duration }\n`

      return memo
    }, '' ),
    'utf8'
  )

  await execa( FFMPEG_BINARY_PATH, `-f concat -i frames.txt record.webm`.split( ' ' ), {
    cwd: root
  } )

  return path.join( root, 'record.webm' )
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

function sum( min, max ) {
  let result = 0

  for ( let i = min; i <= max; i++ ) {
    result = result + i
  }

  return result
}

function middle( count ) {
  return Math.floor( sum( 1, count ) / count )
}

function getScore( result = {} ) {
  return ( result.lhr.categories.performance.score * 100 ).toFixed( 0 )
}

module.exports = run
