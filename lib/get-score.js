module.exports = function getScore( result = {} ) {
  return ( result.lhr.categories.performance.score * 100 ).toFixed( 0 )
}
