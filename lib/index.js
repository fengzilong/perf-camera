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

const FFMPEG_BINARY_PATH = path.resolve( __dirname, '../bin/ffmpeg' )

async function run( urls = [], options = {} ) {
  const results = []

  await urls.reduce( async ( memo, url, index ) => {
    await memo
    const result = await getAverageScoreResult( url, options )
    results.push( result )
  }, Promise.resolve() )

  const videoPaths = await Promise.all( results.map( result => generateVideo( result ) ) )

  const filepath = path.join( process.cwd(), `record-${ Date.now() }.webm` )

  if ( videoPaths.length === 1 ) {
    await fse.copy( videoPaths[ 0 ], filepath )
  } else {
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
    onlyCategories: [ 'performance' ]
  }

  console.log( `${ chalk.blue( 'Url' ) } ${ chalk.green( url ) } ${ chalk.dim( `(${ repeatCount } rounds)` ) }` )

  await new Array( repeatCount ).fill().reduce( async ( memo, current, index ) => {
    await memo
    const result = await runLighthouse( url, opts )

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

function runLighthouse( url, opts, config = null ) {
  return chromeLauncher.launch( { chromeFlags: opts.chromeFlags } ).then( chrome => {
    opts.port = chrome.port
    return lighthouse( url, opts, config ).then( results => {
      // use results.lhr for the JS-consumable output
      // https://github.com/GoogleChrome/lighthouse/blob/master/types/lhr.d.ts
      // use results.report for the HTML/JSON/CSV output as a string
      // use results.artifacts for the trace/screenshots/other specific case you need (rarer)
      return chrome.kill().then( () => results )
    } )
  } )
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
