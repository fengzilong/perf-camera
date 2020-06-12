const getScore = require( './get-score' )

module.exports = function computeMedianRun( results = [] ) {
  results.sort( ( a, b ) => {
    return getScore( a ) - getScore( b )
  } )

  const index = middle( results.length ) - 1

  return results[ index ]
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
