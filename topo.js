// require dependencies
var fs = require('fs'),
    cache = require('./cache.js'),
    https = require('https'),
    topojson = require('topojson'),
    d3 = require('d3')
    ;


var Topology = function Topology() {} ;

Topology.prototype.get = function( filename, url, callback) {

  cache.load( filename, function(cacheCallback) {
    
    https.get( url, function(httpResponse) {
      var body = '';
      httpResponse.on('data', function(data) { body += data; });
      httpResponse.on('end', function() { cacheCallback(null,JSON.parse(body)); })
    }) 
    ;
    
  }, callback ) ;
    
};
  
  
Topology.prototype.focusedPostalCodes = function( topology, postalCodes, callback) {

  var projection = d3.geo.albersUsa();
  var path = d3.geo.path().projection(projection);

  var allPostalCodeBoundaries = topojson.feature(topology, topology.objects.zip_codes_for_the_usa).features ;
  var targetedPostalCodeBoundaries = allPostalCodeBoundaries.filter( function(d) { return postalCodes.indexOf(d.properties.zip) >= 0 ; } ) ;
  var c = path.centroid( targetedPostalCodeBoundaries[0] ) ;

  var focusedPostalCodeBoundaries = allPostalCodeBoundaries.filter( function(d) {
    var c2 = path.centroid( d ) ;
    return (c2[0] - c[0])*(c2[0] - c[0]) + (c2[1] - c[1])*(c2[1] - c[1]) < 10*10 ;
  } ) ;

  var focusedPostalCodes = focusedPostalCodeBoundaries.map( function(d) {
    return d.properties.zip ;
  }) ; 

  var data = {
    targetedPostalCodeBoundaries: targetedPostalCodeBoundaries,
    focusedPostalCodeBoundaries: focusedPostalCodeBoundaries,
    focusedPostalCodes: focusedPostalCodes,
    center: c
  } ;
  
  callback( null, data ) ;
  
};
  
  
Topology.prototype.focusedCounties = function( topology, c, callback) {

  console.log( "c", c) ;
  
  var projection = d3.geo.albersUsa();
  var path = d3.geo.path().projection(projection);

  var allCountyBoundaries = topojson.feature(topology, topology.objects.county).features ;
  var focusedCountyBoundaries = allCountyBoundaries.filter( function(d) {
    var c2 = path.centroid( d ) ;
    return (c2[0] - c[0])*(c2[0] - c[0]) + (c2[1] - c[1])*(c2[1] - c[1]) < 10*10;
  } ) ;

  var data = {
    focusedCountyBoundaries: focusedCountyBoundaries
  } ;
  
  callback( null, data ) ;

} ;

module.exports = new Topology() ;