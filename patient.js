// require dependencies
var xml2js = require('xml2js'),
    xpath = require("xml2js-xpath"),
    https = require('https'),
    url = require('url'),
    crypto = require('crypto'),
    querystring = require('querystring')
    ;

var Patient = function Patient( iss, access_token, patientId ) {
  this.iss = url.parse(iss) ;
  this.access_token = access_token ;
  this.patientId = patientId ;
} ;


Patient.prototype.resource = function( resourceType, identifier, query, callback ) {
  var headers = {
    Authentication: 'Bearer ' + this.access_token,
    Accept: 'application/json'
  } ;
  
  var path = this.iss.path ;
  path += '/' + resourceType ;
  if ( identifier )
    path += '/' + identifier ;
  if ( query )
    path += '?' + querystring.stringify( query ) ;
  
  https.get( { host: this.iss.host, path: path, headers: headers }, function(httpResponse) {
  
    if ( 200 == httpResponse.statusCode ) {
      
      var body = '';
      httpResponse.on( 'data', function(data) { body += data; }) ;
      httpResponse.on( 'end', function() {
        var jsonResponse = JSON.parse( body ) ;
      
        callback( undefined, jsonResponse ) ;

      }) ;
      
    } else {
      
       callback( httpResponse.statusCode, undefined ) ;
      
    }
    
    
  })
  .on( 'error', callback )
  ;
} ;


Patient.prototype.get = function( callback ) {
  this.resource('Patient', this.patientId, null, callback );
} ;


Patient.prototype.allResources = function( resourceType, identifier, query, callback ) {
  this.resource(resourceType, identifier, query, function(err,searchset) {
    
    if ( err ) {
      callback( err, searchset );
    } else {
      callback( err, xpath.find( searchset.entry, '//resource' ) ) ;
    }
             
  } );
} ;

Patient.prototype.immunizations = function( callback ) {
  this.allResources('Immunization', null, { patient: this.patientId }, callback );
} ;

module.exports = Patient ;