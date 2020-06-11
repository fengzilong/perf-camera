#!/usr/bin/env node

const cli = require( 'cac' )()
const run = require( '../lib' )

cli
  .command( '[...urls]', 'Record videos for these urls' )
  .option( '--repeat <count>', 'Repeat count')
  .option( '--port <port>', 'Use custom port')
  .option( '--visible', 'No headless')
  .action( ( urls, options ) => {
    if ( urls.length === 0 ) {
      console.log( 'No url provided' )
      return
    }

    console.log()

    run( urls || [], {
      repeatCount: options.repeat || 3,
      headless: Boolean( options.visible ) === false,
      port: options.port ? Number( options.port ) : void 0,
    } )
  } )

cli.help()

cli.version( require( '../package.json' ).version )

cli.parse()
