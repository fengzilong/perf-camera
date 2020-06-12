const path = require( 'path' )
const fs = require( 'fs' )
const fse = require( 'fs-extra' )
const tildify = require( 'tildify' )
const execa = require( 'execa' )
const { nanoid } = require( 'nanoid' )
const tempy = require( 'tempy' )
const speedline = require( 'speedline-core' )
const ffmpeg = require( '@ffmpeg-installer/ffmpeg' )

const FFMPEG_BINARY_PATH = ffmpeg.path

module.exports = async function composeVideo( traces = [] ) {
  console.log( 'Generating video...' )
  const artifacts = await Promise.all( traces.map( generateVideo ) )

  const outputPath = path.join( process.cwd(), `record-${ Date.now() }.webm` )

  if ( artifacts.length === 1 ) {
    await fse.copy( artifacts[ 0 ].path, outputPath )
  } else {
    console.log( 'Merging videos...' )
    await execa(
      FFMPEG_BINARY_PATH,
      (
        artifacts.map( v => `-i ${ v.path }` ).join( ' ' ) +
        ` -filter_complex hstack ${ outputPath }`
      ).split( ' ' )
    )
  }

  console.log( `Video has been saved to ${ tildify( outputPath ) }` )
}

async function generateVideo( trace = {} ) {
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

  return {
    root,
    frames,
    path: path.join( root, 'record.webm' ),
  }
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
          progress: frame.getProgress(),
        }
      } )
    }
  } )
}
